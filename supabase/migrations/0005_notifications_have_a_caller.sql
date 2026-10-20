-- ============================================================================
-- TaskTally — something finally calls send-push
-- Run after 0004_policies_can_see_what_they_check.sql.
--
-- The send-push Edge Function has been deployable since 0002 and nothing ever
-- invoked it, so the app has never notified anyone. The caller belongs in the
-- database rather than in the client: a notification must be sent because a row
-- was written, not because the writer's phone stayed on long enough to send it.
--
-- How it works: each trigger decides who should hear about a row and asks
-- public.send_push(), which posts to the function through pg_net. pg_net queues
-- the request and returns immediately, so a slow or dead function can never
-- delay — or roll back — the write that triggered it.
--
-- Configuration (server-side, once):
--   select vault.create_secret('https://<project>.supabase.co', 'project_url');
--   select vault.create_secret('<SEND_PUSH_SECRET>', 'send_push_secret');
-- Until both exist, every trigger here is a no-op: nothing is sent, nothing
-- fails, and no write is blocked. That is deliberate — a database without
-- secrets is a development database, not a broken one.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Configuration. Vault is the sanctioned place for a secret in Postgres; the
-- current_setting fallback exists for a local database, where a GUC is simpler
-- than installing the vault extension.
-- ---------------------------------------------------------------------------
create or replace function public.push_setting(secret_name text, guc text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  value text;
begin
  begin
    execute format(
      'select decrypted_secret from vault.decrypted_secrets where name = %L limit 1', secret_name
    ) into value;
  exception when others then
    value := null;  -- no vault extension on this database
  end;
  return coalesce(nullif(value, ''), nullif(current_setting(guc, true), ''));
end
$$;

-- ---------------------------------------------------------------------------
-- Does this user still want this category? Mirrors categoryEnabled() in
-- src/lib/notifications.ts: absent prefs mean yes, and an unrecognised
-- category is never silently dropped.
--
-- send-push checks this too. Checking here as well keeps a muted notification
-- from costing an HTTP request, and makes "muted users get nothing" something
-- the database tests can assert.
-- ---------------------------------------------------------------------------
create or replace function public.wants_category(recipient uuid, category text)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select notification_prefs -> category <> 'false'::jsonb
       from public.profiles where id = recipient),
    true
  );
$$;

-- ---------------------------------------------------------------------------
-- The one place that talks to send-push.
--
-- SECURITY DEFINER because the triggers run as whoever wrote the row, and that
-- person can neither read the recipient's device tokens nor their preferences —
-- correctly so.
-- ---------------------------------------------------------------------------
create or replace function public.send_push(
  recipient uuid,
  title text,
  body text,
  data jsonb,
  category text
) returns void language plpgsql security definer set search_path = public as $$
declare
  base_url text := public.push_setting('project_url', 'app.settings.project_url');
  secret   text := public.push_setting('send_push_secret', 'app.settings.send_push_secret');
begin
  if recipient is null or base_url is null or secret is null then
    return;  -- not configured; see the header
  end if;
  if not public.wants_category(recipient, category) then
    return;  -- muted this category
  end if;
  if not exists (select 1 from public.push_tokens where user_id = recipient) then
    return;  -- no device to send to
  end if;

  perform net.http_post(
    url     := base_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secret
               ),
    -- The payload carries ids and the title the user typed — never a comment
    -- body or anything else a notification is the wrong place for.
    body    := jsonb_build_object(
                 'userId', recipient,
                 'title', title,
                 'body', coalesce(body, ''),
                 'data', coalesce(data, '{}'::jsonb) || jsonb_build_object('category', category),
                 'category', category
               )
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 1. A new task notifies the person being asked.
--
-- `contactId` is the *other* party from the recipient's point of view, which is
-- what routeForNotification() needs to open the right task space.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requester_name text;
  group_name     text;
  member         record;
begin
  select display_name into requester_name from public.profiles where id = new.requester_id;

  if new.assignee_id is not null and new.assignee_id <> new.requester_id then
    perform public.send_push(
      new.assignee_id,
      coalesce(requester_name, 'Someone') || ' sent you a task',
      new.title,
      jsonb_build_object('taskId', new.id, 'contactId', new.requester_id),
      'assignments'
    );
  elsif new.group_id is not null then
    select name into group_name from public.groups where id = new.group_id;
    for member in
      select user_id from public.group_members
      where group_id = new.group_id and user_id <> new.requester_id
    loop
      perform public.send_push(
        member.user_id,
        coalesce(group_name, 'Your group') || ' — new task',
        new.title,
        jsonb_build_object('taskId', new.id, 'groupId', new.group_id),
        'assignments'
      );
    end loop;
  end if;
  return new;
end
$$;

drop trigger if exists tasks_notify_new on public.tasks;
create trigger tasks_notify_new
  after insert on public.tasks
  for each row execute function public.notify_new_task();

-- ---------------------------------------------------------------------------
-- 2. A poke is the whole point of the wand: it has to arrive.
-- ---------------------------------------------------------------------------
create or replace function public.notify_poke()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  task_title  text;
begin
  if new.to_user = new.from_user then
    return new;
  end if;
  select display_name into sender_name from public.profiles where id = new.from_user;
  if new.task_id is not null then
    select title into task_title from public.tasks where id = new.task_id;
  end if;

  perform public.send_push(
    new.to_user,
    coalesce(sender_name, 'Someone') || ' poked you',
    coalesce(task_title, ''),
    jsonb_build_object('taskId', new.task_id, 'contactId', new.from_user),
    'pokes'
  );
  return new;
end
$$;

drop trigger if exists pokes_notify on public.pokes;
create trigger pokes_notify
  after insert on public.pokes
  for each row execute function public.notify_poke();

-- ---------------------------------------------------------------------------
-- 3. Comments and status changes: everyone on the task except whoever did it.
--
-- 'created' and 'poked' are deliberately skipped — the two triggers above
-- already cover them, and nobody should hear about the same thing twice.
-- ---------------------------------------------------------------------------
create or replace function public.notify_task_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  task       record;
  actor_name text;
  category   text;
  title      text;
  recipient  uuid;
  member     record;
begin
  if new.event_type in ('created', 'poked') then
    return new;
  end if;

  select * into task from public.tasks where id = new.task_id;
  if task is null then
    return new;
  end if;
  select display_name into actor_name from public.profiles where id = new.actor_id;
  actor_name := coalesce(actor_name, 'Someone');

  if new.event_type = 'comment' then
    category := 'comments';
    title    := actor_name || ' commented';
  else
    category := 'updates';
    title    := actor_name || ' ' || new.event_type || ' a task';
  end if;

  if task.group_id is not null then
    for member in
      select user_id from public.group_members
      where group_id = task.group_id and user_id is distinct from new.actor_id
    loop
      perform public.send_push(
        member.user_id, title, task.title,
        jsonb_build_object('taskId', task.id, 'groupId', task.group_id),
        category
      );
    end loop;
  else
    -- The other side of a two-person task.
    recipient := case
      when new.actor_id = task.requester_id then task.assignee_id
      else task.requester_id
    end;
    if recipient is not null and recipient is distinct from new.actor_id then
      perform public.send_push(
        recipient, title, task.title,
        jsonb_build_object(
          'taskId', task.id,
          'contactId', case when recipient = task.requester_id
                            then task.assignee_id else task.requester_id end
        ),
        category
      );
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists task_events_notify on public.task_events;
create trigger task_events_notify
  after insert on public.task_events
  for each row execute function public.notify_task_event();

-- ---------------------------------------------------------------------------
-- 4. Overdue tasks, which no row arrives to announce.
--
-- A stamp on the task, rather than a log table: it makes "notified once" a
-- property of the task, and the index keeps the sweep cheap.
--
-- Schedule it once pg_cron is enabled on the project:
--   select cron.schedule('overdue-sweep', '0 7 * * *',
--                        $$select public.notify_overdue_tasks()$$);
-- 07:00 UTC is 07:00 in Accra — morning, not the middle of the night.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists overdue_notified_at timestamptz;
create index if not exists tasks_overdue_sweep_idx
  on public.tasks (due_date)
  where overdue_notified_at is null;

create or replace function public.notify_overdue_tasks()
returns integer language plpgsql security definer set search_path = public as $$
declare
  task       record;
  owner_name text;
  sent       integer := 0;
begin
  for task in
    select t.*, p.display_name as requester_name
    from public.tasks t
    left join public.profiles p on p.id = t.requester_id
    where t.due_date < now()
      and t.overdue_notified_at is null
      and t.status in ('pending_acceptance', 'active')
  loop
    owner_name := coalesce(task.requester_name, 'Someone');
    if task.assignee_id is not null then
      perform public.send_push(
        task.assignee_id,
        'Overdue: ' || owner_name || ' is still waiting',
        task.title,
        jsonb_build_object('taskId', task.id, 'contactId', task.requester_id),
        'updates'
      );
      sent := sent + 1;
    end if;
    update public.tasks set overdue_notified_at = now() where id = task.id;
  end loop;
  return sent;
end
$$;

revoke all on function public.send_push(uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.notify_overdue_tasks() from public, anon, authenticated;
revoke all on function public.push_setting(text, text) from public, anon, authenticated;
