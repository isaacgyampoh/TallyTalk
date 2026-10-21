-- ============================================================================
-- TaskTally — private messages between people who have agreed to connect
-- Run after 0010_deleting_an_account_works_again.sql.
--
-- The table has existed since 0001 ("ordinary chat for restricted contacts"),
-- with policies and realtime, and nothing has ever written to it. What it was
-- missing is everything that makes a conversation work: read state, a rule
-- about who may start one, somewhere to see them listed, and a notification
-- when one arrives.
--
-- The message is the record. A notification is a second thing that may fail —
-- the message is in the database the moment it is sent, so a push that never
-- arrives costs nobody their words.
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('assignments', 'updates', 'comments', 'pokes', 'contacts', 'messages'));

alter table public.messages add column if not exists read_at timestamptz;

-- The two questions a conversation asks: "what did we say" and "what have I
-- not read". Both want the pair and the time.
create index if not exists messages_thread_idx
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index if not exists messages_unread_idx
  on public.messages (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- You may write to someone you are connected to, who has not blocked you.
--
-- The contacts row is your own, so the policy can see it. Requiring it is what
-- makes a message something you agreed to be able to receive: 0009 made
-- connecting a request, and this is the first thing that depends on it.
-- ---------------------------------------------------------------------------
drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_id <> recipient_id
    and not public.has_blocked(recipient_id, auth.uid())
    and exists (
      select 1 from public.contacts c
      where c.owner_id = auth.uid() and c.contact_id = recipient_id and not c.is_blocked
    )
  );

-- Marking as read is the recipient's, and is all they may do.
drop policy if exists messages_update_recipient on public.messages;
create policy messages_update_recipient on public.messages
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.messages_guard_fields()
returns trigger language plpgsql as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'A message cannot be rewritten after it is sent';
  end if;
  return new;
end
$$;

drop trigger if exists messages_read_only on public.messages;
create trigger messages_read_only
  before update on public.messages
  for each row execute function public.messages_guard_fields();

-- ---------------------------------------------------------------------------
-- A new message tells the recipient, and only them.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  perform public.notify(
    new.recipient_id, 'messages',
    coalesce(sender_name, 'Someone') || ' sent you a message',
    -- The first few words, so the notification is worth reading. The rest
    -- stays in the conversation, where it is protected by the same policies.
    left(new.body, 80),
    jsonb_build_object('contactId', new.sender_id, 'actorId', new.sender_id),
    'message:' || new.id
  );
  return new;
end
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ---------------------------------------------------------------------------
-- The conversation list: one row per person, newest first.
--
-- A function rather than a view because it needs auth.uid(), and because the
-- lateral join is the part worth keeping in one place — done in the client it
-- would be a query per contact.
-- ---------------------------------------------------------------------------
create or replace function public.list_conversations()
returns table (
  contact_id   uuid,
  display_name text,
  photo_url    text,
  last_body    text,
  last_at      timestamptz,
  last_mine    boolean,
  unread       integer
)
language sql security definer stable set search_path = public as $$
  select
    p.id,
    p.display_name,
    case when p.photo_visibility = 'nobody' then null else p.photo_url end,
    m.body,
    m.created_at,
    m.sender_id = auth.uid(),
    coalesce(u.unread, 0)::int
  from public.contacts c
  join public.profiles p on p.id = c.contact_id
  left join lateral (
    select body, created_at, sender_id
    from public.messages
    where (sender_id = auth.uid() and recipient_id = c.contact_id)
       or (sender_id = c.contact_id and recipient_id = auth.uid())
    order by created_at desc
    limit 1
  ) m on true
  left join lateral (
    select count(*) as unread
    from public.messages
    where recipient_id = auth.uid() and sender_id = c.contact_id and read_at is null
  ) u on true
  where c.owner_id = auth.uid()
    and not c.is_blocked
    and m.created_at is not null   -- only people you have actually talked to
  order by m.created_at desc
$$;

revoke all on function public.list_conversations() from public, anon;
grant execute on function public.list_conversations() to authenticated;

/** How many messages are waiting for me, across everyone. */
create or replace function public.unread_message_count()
returns integer language sql security definer stable set search_path = public as $$
  select count(*)::int from public.messages
  where recipient_id = auth.uid() and read_at is null
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;
