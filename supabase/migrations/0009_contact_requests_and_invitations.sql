-- ============================================================================
-- TaskTally — asking to connect, and inviting people who are not here yet
-- Run after 0008_find_people_by_the_number_they_typed.sql.
--
-- Until now, adding a contact was unilateral: find someone by number and they
-- are in your list, with no say in it. That is wrong for a product where a
-- contact can then send you obligations — so connecting is now a request the
-- other person accepts or declines.
--
-- The second half is the dead end this replaces: searching for a number that
-- has not signed up said "nobody is using this number" and offered nothing.
-- Now it can send one SMS invitation, through the same Arkesel integration the
-- sign-in codes use, rate-limited so it cannot become a way to send texts.
--
-- Deliberately NOT here: anything that tells a sender whether an invited
-- number later registered. That is the invitee's to disclose, by accepting a
-- request or sending one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Notifications gained a category, so the inbox can carry "wants to connect".
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('assignments', 'updates', 'comments', 'pokes', 'contacts'));

-- ---------------------------------------------------------------------------
-- The request itself.
-- ---------------------------------------------------------------------------
create type contact_request_status as enum ('pending', 'accepted', 'declined');

create table public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references public.profiles (id) on delete cascade,
  to_user      uuid not null references public.profiles (id) on delete cascade,
  status       contact_request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  -- One request per direction, ever. A declined request cannot be re-sent:
  -- the unique row is what stops a refusal becoming a way to keep asking.
  -- Someone who changes their mind can send their own request the other way.
  unique (from_user, to_user),
  check (from_user <> to_user)
);

create index contact_requests_incoming_idx on public.contact_requests (to_user, status);
create index contact_requests_outgoing_idx on public.contact_requests (from_user, status);

alter table public.contact_requests enable row level security;

-- Both sides can see a request between them, and nobody else can.
create policy contact_requests_select_party on public.contact_requests
  for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- You may ask on your own behalf, of someone who has not blocked you and whom
-- you have not blocked. has_blocked is SECURITY DEFINER for the reason 0004
-- sets out: the blocking row belongs to the blocker and is invisible to the
-- person being checked, so an inline sub-select here would always pass.
create policy contact_requests_insert_sender on public.contact_requests
  for insert to authenticated
  with check (
    from_user = auth.uid()
    and from_user <> to_user
    and not public.has_blocked(to_user, auth.uid())
    and not public.has_blocked(auth.uid(), to_user)
  );

-- Only the person asked may answer.
create policy contact_requests_respond on public.contact_requests
  for update to authenticated
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

-- The sender may withdraw one they have sent, while it is still pending.
create policy contact_requests_withdraw on public.contact_requests
  for delete to authenticated
  using (from_user = auth.uid() and status = 'pending');

/**
 * An answer is an answer: only the status may change, only from pending, and
 * only to a final state. Without this the UPDATE policy above would let the
 * recipient rewrite who asked, or flip an accepted request back to pending.
 */
create or replace function public.contact_requests_guard()
returns trigger language plpgsql as $$
begin
  if new.from_user is distinct from old.from_user
     or new.to_user is distinct from old.to_user
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the status of a contact request may change';
  end if;
  if old.status <> 'pending' then
    raise exception 'This request has already been answered';
  end if;
  if new.status not in ('accepted', 'declined') then
    raise exception 'A request is either accepted or declined';
  end if;
  new.responded_at := now();
  return new;
end
$$;

drop trigger if exists contact_requests_answer_only on public.contact_requests;
create trigger contact_requests_answer_only
  before update on public.contact_requests
  for each row execute function public.contact_requests_guard();

/**
 * Asking tells the other person. Accepting connects both sides.
 *
 * The contact rows are written here rather than by the client because
 * contacts_all_own only lets you write your own side — the person accepting
 * cannot create the requester's row, and the requester is not present to
 * create theirs. A connection that only exists in one direction would show one
 * of them a name and the other a stranger.
 */
create or replace function public.contact_requests_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  asker_name     text;
  accepter_name  text;
begin
  if tg_op = 'INSERT' then
    select display_name into asker_name from public.profiles where id = new.from_user;
    perform public.notify(
      new.to_user, 'contacts',
      coalesce(asker_name, 'Someone') || ' wants to connect',
      'Accept to start sending tasks to each other',
      jsonb_build_object('actorId', new.from_user),
      'contact-request:' || new.id
    );
    return new;
  end if;

  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.contacts (owner_id, contact_id)
    values (new.from_user, new.to_user)
    on conflict (owner_id, contact_id) do nothing;
    insert into public.contacts (owner_id, contact_id)
    values (new.to_user, new.from_user)
    on conflict (owner_id, contact_id) do nothing;

    select display_name into accepter_name from public.profiles where id = new.to_user;
    perform public.notify(
      new.from_user, 'contacts',
      coalesce(accepter_name, 'Someone') || ' accepted your request',
      'You can send each other tasks now',
      jsonb_build_object('actorId', new.to_user),
      'contact-accepted:' || new.id
    );
  end if;
  -- A decline is deliberately silent. Telling someone they were refused
  -- invites a second attempt, and the refusal is already enforced.
  return new;
end
$$;

drop trigger if exists contact_requests_announce on public.contact_requests;
create trigger contact_requests_announce
  after insert or update on public.contact_requests
  for each row execute function public.contact_requests_notify();

/**
 * Who may be asked, answered in one place so the client cannot be the only
 * thing enforcing it. Returns a reason rather than a bare false, because the
 * sheet has something different to say for each case.
 *
 * "blocked" is deliberately indistinguishable from "already connected" to the
 * caller — see find_profile_by_phone, which hides the same thing.
 */
create or replace function public.contact_request_state(target uuid)
returns text language sql security definer stable set search_path = public as $$
  select case
    when target is null or target = auth.uid() then 'self'
    when exists (select 1 from public.contacts
                  where owner_id = auth.uid() and contact_id = target) then 'connected'
    when public.has_blocked(target, auth.uid()) or public.has_blocked(auth.uid(), target)
      then 'unavailable'
    when exists (select 1 from public.contact_requests
                  where from_user = auth.uid() and to_user = target and status = 'pending')
      then 'sent'
    when exists (select 1 from public.contact_requests
                  where from_user = target and to_user = auth.uid() and status = 'pending')
      then 'incoming'
    when exists (select 1 from public.contact_requests
                  where from_user = auth.uid() and to_user = target and status = 'declined')
      then 'declined'
    else 'open'
  end
$$;

revoke all on function public.contact_request_state(uuid) from public, anon;
grant execute on function public.contact_request_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- SMS invitations.
--
-- Stored by digits so a number invited as "+233 24 412 3456" and "0244123456"
-- is recognised as the same person being invited twice.
-- ---------------------------------------------------------------------------
create table public.sms_invitations (
  id           uuid primary key default gen_random_uuid(),
  inviter      uuid not null references public.profiles (id) on delete cascade,
  phone_digits text not null check (char_length(phone_digits) between 7 and 15),
  created_at   timestamptz not null default now(),
  delivered    boolean
);

create index sms_invitations_inviter_idx on public.sms_invitations (inviter, created_at desc);
create index sms_invitations_number_idx on public.sms_invitations (phone_digits, created_at desc);

alter table public.sms_invitations enable row level security;

-- You can see the invitations you sent. Nothing else — in particular, nobody
-- can read who invited a given number, which would leak a social graph.
create policy sms_invitations_own on public.sms_invitations
  for select to authenticated using (inviter = auth.uid());

-- Writes happen in the send-invite function, under the service role, after the
-- limits below have been checked. There is deliberately no insert policy: a
-- client that could write rows here could also hide its own rate limiting.

/** How many invitations this person has sent in the last day. */
create or replace function public.invites_sent_today(who uuid)
returns integer language sql security definer stable set search_path = public as $$
  select count(*)::int from public.sms_invitations
  where inviter = who and created_at > now() - interval '24 hours'
$$;

/**
 * May this invitation be sent?
 *
 * Three limits, each for a different abuse: a person cannot be used as a bulk
 * sender, one number cannot be invited repeatedly by different people, and the
 * same person cannot re-invite the same number for a day.
 *
 * Returns a reason so the caller can say something true, and because "no"
 * alone is impossible to support.
 */
create or replace function public.may_invite(who uuid, digits text)
returns text language plpgsql security definer set search_path = public as $$
declare
  per_person constant integer := 10;  -- per inviter per day
  per_number constant integer := 3;   -- from anyone, per day
begin
  if digits is null or char_length(digits) < 7 then
    return 'invalid';
  end if;
  if public.invites_sent_today(who) >= per_person then
    return 'daily-limit';
  end if;
  if (select count(*) from public.sms_invitations
       where inviter = who and phone_digits = digits
         and created_at > now() - interval '24 hours') > 0 then
    return 'already-invited';
  end if;
  if (select count(*) from public.sms_invitations
       where phone_digits = digits and created_at > now() - interval '24 hours') >= per_number then
    return 'number-limit';
  end if;
  return 'ok';
end
$$;

revoke all on function public.may_invite(uuid, text) from public, anon, authenticated;
revoke all on function public.invites_sent_today(uuid) from public, anon;
grant execute on function public.invites_sent_today(uuid) to authenticated;

/**
 * The inviter's name, for the message. A function rather than a table read
 * from the edge function, so the name is all it can reach.
 */
create or replace function public.inviter_display_name(who uuid)
returns text language sql security definer stable set search_path = public as $$
  select display_name from public.profiles where id = who
$$;

revoke all on function public.inviter_display_name(uuid) from public, anon, authenticated;
