-- ============================================================================
-- TaskTally — group conversations, search, and read receipts worth believing
-- Run after 0012_message_attachments.sql.
--
-- Groups already exist. `groups` and `group_members` have carried shared task
-- lists since 0001, with roles, with is_group_member/is_group_admin, and with
-- a trigger that seats the creator as administrator. Group messaging extends
-- that rather than inventing a parallel idea of a conversation: one group, one
-- membership, one set of rules about who belongs.
--
-- Read receipts get their own table rather than more columns on `messages`,
-- because in a group "read" is a fact about a person, not about a message.
-- `messages.read_at` stays, maintained by a trigger, so everything written
-- against it keeps working.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A message goes to a person or to a group — exactly one.
-- ---------------------------------------------------------------------------
alter table public.messages alter column recipient_id drop not null;
alter table public.messages add column if not exists group_id uuid
  references public.groups (id) on delete cascade;

alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_one_destination
  check (
    (recipient_id is not null and group_id is null and sender_id <> recipient_id)
    or (recipient_id is null and group_id is not null)
  );

create index if not exists messages_group_idx on public.messages (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Who may read and write what.
--
-- A group message is readable by the group's members and nobody else, which is
-- is_group_member's job — SECURITY DEFINER since 0001, because group_members
-- is itself behind RLS.
-- ---------------------------------------------------------------------------
drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      -- To a person: someone you are connected to, who has not blocked you.
      (
        group_id is null
        and recipient_id is not null
        and not public.has_blocked(recipient_id, auth.uid())
        and exists (
          select 1 from public.contacts c
          where c.owner_id = auth.uid() and c.contact_id = recipient_id and not c.is_blocked
        )
      )
      -- To a group: a group you are currently in. Leaving or being removed
      -- ends the ability to post, with no client involvement.
      or (recipient_id is null and group_id is not null
          and public.is_group_member(group_id, auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Read receipts.
--
-- One row per person per message, written only by the person who read it.
-- Nobody can mark a message read on someone else's behalf, and nobody can
-- un-read one: there is no update policy at all.
-- ---------------------------------------------------------------------------
create table public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reads_user_idx on public.message_reads (user_id, read_at desc);

alter table public.message_reads enable row level security;

-- You see receipts for messages you can see — your own, so you know who has
-- read them, and others' in a group you belong to.
create policy message_reads_select on public.message_reads
  for select to authenticated
  using (public.can_access_message(message_id, auth.uid()));

-- You record only your own reading, of something you are allowed to read, and
-- never of your own message.
create policy message_reads_insert on public.message_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_message(message_id, auth.uid())
    and not exists (
      select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- can_access_message has to understand groups now, since a group message has
-- no recipient_id at all.
create or replace function public.can_access_message(mid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.messages m
    where m.id = mid
      and (
        m.sender_id = uid
        or m.recipient_id = uid
        or (m.group_id is not null and public.is_group_member(m.group_id, uid))
      )
  );
$$;

/**
 * Keep messages.read_at in step for one-to-one messages.
 *
 * The receipts table is the truth; this column is a convenience that unread
 * counts and the conversation list already read. Maintaining it here means
 * none of that had to change, and the two cannot drift.
 */
create or replace function public.message_reads_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.messages
     set read_at = coalesce(read_at, new.read_at)
   where id = new.message_id and recipient_id = new.user_id;
  return new;
end
$$;

drop trigger if exists message_reads_mark on public.message_reads;
create trigger message_reads_mark
  after insert on public.message_reads
  for each row execute function public.message_reads_touch();

/**
 * Who has read a message, for the sender's receipt list.
 *
 * SECURITY DEFINER so it can name group members, with its own check first:
 * the caller must be able to see the message. Without that check this would
 * hand anybody the membership of any group by guessing a message id.
 */
create or replace function public.message_receipts(mid uuid)
returns table (user_id uuid, display_name text, read_at timestamptz)
language sql security definer stable set search_path = public as $$
  select p.id, p.display_name, r.read_at
  from public.messages m
  join public.profiles p
    on (m.group_id is not null and p.id in (
          select gm.user_id from public.group_members gm where gm.group_id = m.group_id
        ))
    or (m.group_id is null and p.id = m.recipient_id)
  left join public.message_reads r on r.message_id = m.id and r.user_id = p.id
  where m.id = mid
    and p.id <> m.sender_id
    and public.can_access_message(mid, auth.uid())
  order by r.read_at nulls last, p.display_name
$$;

revoke all on function public.message_receipts(uuid) from public, anon;
grant execute on function public.message_receipts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Search.
--
-- A generated column plus a GIN index: Postgres does the work, the device
-- downloads only what matched. SECURITY INVOKER — deliberately — so the same
-- RLS that governs reading a conversation governs finding one.
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple', coalesce(body, ''))) stored;

create index if not exists messages_search_idx on public.messages using gin (search_vector);

create or replace function public.search_messages(
  q text,
  in_group uuid default null,
  with_contact uuid default null,
  max_results integer default 30
)
returns table (
  id           uuid,
  sender_id    uuid,
  recipient_id uuid,
  group_id     uuid,
  body         text,
  created_at   timestamptz
)
language sql stable as $$
  select m.id, m.sender_id, m.recipient_id, m.group_id, m.body, m.created_at
  from public.messages m
  where length(btrim(q)) >= 2
    and m.search_vector @@ websearch_to_tsquery('simple', q)
    and (in_group is null or m.group_id = in_group)
    and (
      with_contact is null
      or m.sender_id = with_contact
      or m.recipient_id = with_contact
    )
  order by m.created_at desc
  limit least(greatest(max_results, 1), 100)
$$;

-- No SECURITY DEFINER here, and that is the point: the function sees exactly
-- what the caller sees, so a search can never return a message from a
-- conversation they are not part of.
revoke all on function public.search_messages(text, uuid, uuid, integer) from public, anon;
grant execute on function public.search_messages(text, uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Images: a thumbnail beside the file, so a conversation never downloads a
-- full-resolution photograph to show a preview.
-- ---------------------------------------------------------------------------
alter table public.message_attachments add column if not exists thumbnail_path text
  check (thumbnail_path is null or char_length(thumbnail_path) between 3 and 400);
alter table public.message_attachments add column if not exists width integer
  check (width is null or (width > 0 and width <= 20000));
alter table public.message_attachments add column if not exists height integer
  check (height is null or (height > 0 and height <= 20000));

-- ---------------------------------------------------------------------------
-- The conversation list, now with groups in it.
-- ---------------------------------------------------------------------------
drop function if exists public.list_conversations();
create or replace function public.list_conversations()
returns table (
  kind         text,
  id           uuid,
  display_name text,
  photo_url    text,
  last_body    text,
  last_at      timestamptz,
  last_mine    boolean,
  unread       integer,
  members      integer
)
language sql security definer stable set search_path = public as $$
  -- People
  select
    'person'::text, p.id, p.display_name,
    case when p.photo_visibility = 'nobody' then null else p.photo_url end,
    m.body, m.created_at, m.sender_id = auth.uid(),
    coalesce(u.unread, 0)::int, null::int
  from public.contacts c
  join public.profiles p on p.id = c.contact_id
  left join lateral (
    select body, created_at, sender_id from public.messages
    where group_id is null
      and ((sender_id = auth.uid() and recipient_id = c.contact_id)
        or (sender_id = c.contact_id and recipient_id = auth.uid()))
    order by created_at desc limit 1
  ) m on true
  left join lateral (
    select count(*) as unread from public.messages
    where group_id is null and recipient_id = auth.uid()
      and sender_id = c.contact_id and read_at is null
  ) u on true
  where c.owner_id = auth.uid() and not c.is_blocked and m.created_at is not null

  union all

  -- Groups you are in that have been spoken in
  select
    'group'::text, g.id, g.name, g.photo_url,
    m.body, m.created_at, m.sender_id = auth.uid(),
    coalesce(u.unread, 0)::int,
    (select count(*) from public.group_members gm where gm.group_id = g.id)::int
  from public.group_members me
  join public.groups g on g.id = me.group_id
  left join lateral (
    select body, created_at, sender_id from public.messages
    where group_id = g.id order by created_at desc limit 1
  ) m on true
  left join lateral (
    select count(*) as unread from public.messages msg
    where msg.group_id = g.id
      and msg.sender_id <> auth.uid()
      and not exists (
        select 1 from public.message_reads r
        where r.message_id = msg.id and r.user_id = auth.uid()
      )
  ) u on true
  where me.user_id = auth.uid() and m.created_at is not null

  -- By position: a UNION's branches have no column names to order by.
  order by 6 desc
$$;

revoke all on function public.list_conversations() from public, anon;
grant execute on function public.list_conversations() to authenticated;

/** Everything waiting for me, in people and in groups. */
create or replace function public.unread_message_count()
returns integer language sql security definer stable set search_path = public as $$
  select (
    select count(*) from public.messages
    where group_id is null and recipient_id = auth.uid() and read_at is null
  )::int + (
    select count(*) from public.messages m
    join public.group_members gm on gm.group_id = m.group_id and gm.user_id = auth.uid()
    where m.group_id is not null
      and m.sender_id <> auth.uid()
      and not exists (
        select 1 from public.message_reads r
        where r.message_id = m.id and r.user_id = auth.uid()
      )
  )::int
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- ---------------------------------------------------------------------------
-- A group message tells every other member.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  group_name  text;
  member      record;
  preview     text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  sender_name := coalesce(sender_name, 'Someone');
  -- Never the whole message, and never a file's contents.
  preview := coalesce(nullif(left(new.body, 80), ''), 'Sent a file');

  if new.group_id is not null then
    select name into group_name from public.groups where id = new.group_id;
    for member in
      select user_id from public.group_members
      where group_id = new.group_id and user_id <> new.sender_id
    loop
      perform public.notify(
        member.user_id, 'messages',
        sender_name || ' in ' || coalesce(group_name, 'a group'),
        preview,
        jsonb_build_object('groupId', new.group_id, 'actorId', new.sender_id),
        'message:' || new.id || ':' || member.user_id
      );
    end loop;
  else
    perform public.notify(
      new.recipient_id, 'messages',
      sender_name || ' sent you a message',
      preview,
      jsonb_build_object('contactId', new.sender_id, 'actorId', new.sender_id),
      'message:' || new.id
    );
  end if;
  return new;
end
$$;
