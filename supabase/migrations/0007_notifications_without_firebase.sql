-- ============================================================================
-- TaskTally — notifications that do not depend on Firebase
-- Run after 0006_crash_reports.sql.
--
-- 0005 sent every notification straight to FCM and kept no record of it. That
-- made Firebase load-bearing for a core feature and meant a notification missed
-- while the phone was off was gone for good.
--
-- This splits the two ideas that were tangled together:
--
--   * The RECORD — public.notifications. Every notification-worthy event
--     becomes a durable row belonging to one person, whether or not any push
--     reaches them. This is what the in-app inbox reads, what survives a flat
--     battery or a paused backend, and what makes the app useful with no push
--     provider at all. It is plain Postgres: nothing here ties it to a vendor.
--
--   * The DELIVERY — an attempt to interrupt someone, which may fail, be
--     disabled, or not apply (no subscription, muted category). Delivery is now
--     standards-based Web Push (VAPID), so no Firebase project, service account
--     or SDK is involved on our side.
--
-- Muting a category silences the interruption, not the record: a muted
-- notification still lands in the inbox, where the person can find it when they
-- look. Hiding it entirely would lose information they asked to receive at a
-- quieter time, not to never receive.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The record.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  category   text not null check (category in ('assignments', 'updates', 'comments', 'pokes')),
  title      text not null check (char_length(title) between 1 and 200),
  body       text check (char_length(body) <= 300),
  -- What to open. Ids only, as notifications.ts has always required.
  task_id    uuid references public.tasks (id) on delete cascade,
  group_id   uuid references public.groups (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  -- Lets the same event be announced twice without notifying twice: the
  -- overdue sweep, a retried write, a trigger that fires again.
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create unique index notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.notifications enable row level security;

-- You read your own, and you may mark them read. Nothing else: the rows are
-- written by the triggers below, which run as SECURITY DEFINER, so a client
-- cannot invent a notification for themselves or for anybody else.
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- Marking as read is the only field a client may change. Without this, the
-- UPDATE policy above would let someone rewrite the title of their own
-- notification — harmless to others, but it would make the inbox untrustworthy
-- as a record of what actually happened.
create or replace function public.notifications_guard_fields()
returns trigger language plpgsql as $$
begin
  if new.user_id    is distinct from old.user_id
     or new.category is distinct from old.category
     or new.title    is distinct from old.title
     or new.body     is distinct from old.body
     or new.task_id  is distinct from old.task_id
     or new.group_id is distinct from old.group_id
     or new.actor_id is distinct from old.actor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at may be changed on a notification';
  end if;
  return new;
end
$$;

drop trigger if exists notifications_read_only on public.notifications;
create trigger notifications_read_only
  before update on public.notifications
  for each row execute function public.notifications_guard_fields();

-- ---------------------------------------------------------------------------
-- The delivery channel: Web Push subscriptions (RFC 8291 / RFC 8292).
--
-- A subscription is a URL on a browser vendor's push service plus two keys the
-- sender encrypts to. It replaces push_tokens, which held FCM registration
-- tokens; that table is left in place but unused, and is listed for removal in
-- the migration notes rather than dropped here.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- The push service endpoint. Unique so re-subscribing the same browser
  -- updates one row rather than accumulating them.
  endpoint    text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  last_sent_at timestamptz,
  failures    integer not null default 0
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Your own subscriptions only — in both directions. Without the insert check,
-- one account could register a subscription under another's id and receive
-- their notifications.
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- One way in. Records first, interrupts second.
--
-- Returns the notification's id, or null when nothing was recorded because the
-- same event had already been recorded (see dedupe_key).
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  recipient uuid,
  category  text,
  title     text,
  body      text,
  data      jsonb default '{}'::jsonb,
  dedupe    text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  note_id  uuid;
  base_url text;
  secret   text;
begin
  if recipient is null then
    return null;
  end if;

  insert into public.notifications (user_id, category, title, body, task_id, group_id, actor_id, dedupe_key)
  values (
    recipient,
    category,
    left(title, 200),
    left(coalesce(body, ''), 300),
    (data ->> 'taskId')::uuid,
    (data ->> 'groupId')::uuid,
    (data ->> 'actorId')::uuid,
    dedupe
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into note_id;

  -- Already recorded: the same event reaching here twice must not interrupt
  -- anyone twice either.
  if note_id is null then
    return null;
  end if;

  -- From here on it is only delivery, and every reason to stop is ordinary.
  if not public.wants_category(recipient, category) then
    return note_id;  -- muted: recorded, not announced
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = recipient) then
    return note_id;  -- nothing subscribed
  end if;

  base_url := public.push_setting('project_url', 'app.settings.project_url');
  secret   := public.push_setting('send_push_secret', 'app.settings.send_push_secret');
  if base_url is null or secret is null then
    return note_id;  -- not configured; a development database, not a broken one
  end if;

  -- Only the id travels: the function reads the row itself, so the payload
  -- cannot drift from the record and a retry delivers the same thing.
  perform net.http_post(
    url     := base_url || '/functions/v1/send-notification',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secret
               ),
    body    := jsonb_build_object('notificationId', note_id)
  );
  return note_id;
end
$$;

revoke all on function public.notify(uuid, text, text, text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The triggers from 0005, pointed at notify() and given dedupe keys.
-- Behaviour is unchanged: who hears about what is the same.
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
    perform public.notify(
      new.assignee_id, 'assignments',
      coalesce(requester_name, 'Someone') || ' sent you a task',
      new.title,
      jsonb_build_object('taskId', new.id, 'contactId', new.requester_id, 'actorId', new.requester_id),
      'task:' || new.id
    );
  elsif new.group_id is not null then
    select name into group_name from public.groups where id = new.group_id;
    for member in
      select user_id from public.group_members
      where group_id = new.group_id and user_id <> new.requester_id
    loop
      perform public.notify(
        member.user_id, 'assignments',
        coalesce(group_name, 'Your group') || ' — new task',
        new.title,
        jsonb_build_object('taskId', new.id, 'groupId', new.group_id, 'actorId', new.requester_id),
        'task:' || new.id
      );
    end loop;
  end if;
  return new;
end
$$;

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

  perform public.notify(
    new.to_user, 'pokes',
    coalesce(sender_name, 'Someone') || ' poked you',
    coalesce(task_title, ''),
    jsonb_build_object('taskId', new.task_id, 'contactId', new.from_user, 'actorId', new.from_user),
    'poke:' || new.id
  );
  return new;
end
$$;

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
      perform public.notify(
        member.user_id, category, title, task.title,
        jsonb_build_object('taskId', task.id, 'groupId', task.group_id, 'actorId', new.actor_id),
        'event:' || new.id || ':' || member.user_id
      );
    end loop;
  else
    recipient := case
      when new.actor_id = task.requester_id then task.assignee_id
      else task.requester_id
    end;
    if recipient is not null and recipient is distinct from new.actor_id then
      perform public.notify(
        recipient, category, title, task.title,
        jsonb_build_object(
          'taskId', task.id,
          'contactId', case when recipient = task.requester_id
                            then task.assignee_id else task.requester_id end,
          'actorId', new.actor_id
        ),
        'event:' || new.id
      );
    end if;
  end if;
  return new;
end
$$;

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
      perform public.notify(
        task.assignee_id, 'updates',
        'Overdue: ' || owner_name || ' is still waiting',
        task.title,
        -- actorId is how the record remembers the other person, which is what
        -- the tap needs to open the right task space.
        jsonb_build_object('taskId', task.id, 'contactId', task.requester_id,
                           'actorId', task.requester_id),
        -- Belt and braces with overdue_notified_at: even if the stamp is lost,
        -- the same task cannot be announced overdue twice.
        'overdue:' || task.id
      );
      sent := sent + 1;
    end if;
    update public.tasks set overdue_notified_at = now() where id = task.id;
  end loop;
  return sent;
end
$$;

-- The FCM-era sender is gone. Nothing calls it, and leaving it would leave a
-- second, divergent way to notify someone.
drop function if exists public.send_push(uuid, text, text, jsonb, text);

-- push_tokens is left in place, empty and unused, rather than dropped: see
-- docs/MIGRATION.md. It holds FCM registration tokens, which nothing issues now.
comment on table public.push_tokens is
  'Obsolete: FCM registration tokens. Replaced by push_subscriptions (Web Push). Safe to drop once no deployed client writes to it.';
