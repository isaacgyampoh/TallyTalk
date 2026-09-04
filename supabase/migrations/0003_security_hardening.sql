-- ============================================================================
-- TaskTally — security hardening
-- Run after 0002_push_tokens.sql.
--
-- Closes the gaps found in the audit of 0001_init.sql:
--   * private task attachments were readable by every signed-up user
--   * a group could be created but never joined (creator was not made admin)
--   * accepting an invitation did not actually add you to the group
--   * UPDATE policies with no WITH CHECK let rows be rewritten past their guard
--   * a profile's phone number — the identity in this app — was editable
--   * avatar/group-photo uploads were unscoped
--   * pokes, messages and tasks ignored blocking
--   * the phone-discovery RPC that 0001's profiles policy documents was missing
--
-- NOTE ON EXISTING DATA: the attachments and avatars policies below expect a
-- path convention (see each policy). Objects already stored under other paths
-- stop resolving. That is intentional — it is the fix — and safe here because
-- the app has no live uploads yet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: a cast that cannot abort the query it is filtering.
-- Storage paths are user-supplied, so `text::uuid` inside a policy would raise
-- on the first malformed name and fail the whole request.
-- ---------------------------------------------------------------------------
create or replace function public.safe_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception
  when others then return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Groups are joinable again: the creator becomes their first administrator.
--    Without this, groups_insert_creator lets you make a group that
--    group_members_admin_manage then forbids you from joining.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id, role)
    values (new.id, new.created_by, 'administrator')
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Accepting an invitation now actually puts you in the group.
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.group_members (group_id, user_id, role)
    values (new.group_id, new.invited_user, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_invitation_accepted on public.group_invitations;
create trigger on_invitation_accepted
  after update on public.group_invitations
  for each row execute function public.handle_invitation_accepted();

-- ---------------------------------------------------------------------------
-- 2. Tasks cannot be reassigned or moved between groups.
--    The UPDATE policy alone could not express this: it only sees the finished
--    row, so a participant could hand a task to someone else and still satisfy
--    it. Ownership columns are therefore fixed at creation.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_guard_ownership()
returns trigger language plpgsql as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.assignee_id is distinct from old.assignee_id
     or new.group_id is distinct from old.group_id then
    raise exception 'A task cannot be reassigned or moved between groups';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_no_reassign on public.tasks;
create trigger tasks_no_reassign
  before update on public.tasks
  for each row execute function public.tasks_guard_ownership();

drop policy if exists tasks_update_participant on public.tasks;
create policy tasks_update_participant on public.tasks
  for update to authenticated
  using (
    requester_id = auth.uid()
    or assignee_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  )
  with check (
    requester_id = auth.uid()
    or assignee_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

-- You may only raise a task against someone who has not blocked you, and only
-- inside a group you actually belong to.
drop policy if exists tasks_insert_requester on public.tasks;
create policy tasks_insert_requester on public.tasks
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id, auth.uid()))
    and (
      assignee_id is null
      or not exists (
        select 1 from public.contacts c
        where c.owner_id = assignee_id and c.contact_id = auth.uid() and c.is_blocked
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. An invitee may answer an invitation, not rewrite it.
-- ---------------------------------------------------------------------------
create or replace function public.invitations_guard_target()
returns trigger language plpgsql as $$
begin
  if new.group_id is distinct from old.group_id
     or new.invited_user is distinct from old.invited_user
     or new.invited_by is distinct from old.invited_by then
    raise exception 'Only the status of an invitation may change';
  end if;
  return new;
end;
$$;

drop trigger if exists group_invitations_status_only on public.group_invitations;
create trigger group_invitations_status_only
  before update on public.group_invitations
  for each row execute function public.invitations_guard_target();

drop policy if exists group_invitations_invitee_respond on public.group_invitations;
create policy group_invitations_invitee_respond on public.group_invitations
  for update to authenticated
  using (invited_user = auth.uid())
  with check (invited_user = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. The phone number is the identity in this app, so it is not user-editable.
--    It arrives from the verified OTP sign-in via handle_new_user().
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_phone()
returns trigger language plpgsql as $$
begin
  if new.phone is distinct from old.phone then
    raise exception 'Your phone number comes from your verified sign-in and cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_phone_locked on public.profiles;
create trigger profiles_phone_locked
  before update on public.profiles
  for each row execute function public.profiles_guard_phone();

-- A self-inserted profile must carry the phone number on the caller's own JWT,
-- so nobody can claim someone else's number before they sign up.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and phone = (auth.jwt() ->> 'phone'));

-- ---------------------------------------------------------------------------
-- 5. Public image buckets: you write inside your own folder only.
--    Path convention:  avatars/<user id>/<file>   group-photos/<user id>/<file>
-- ---------------------------------------------------------------------------
drop policy if exists storage_public_write on storage.objects;
create policy storage_public_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'group-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_public_update on storage.objects;
create policy storage_public_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'group-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'group-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_public_delete on storage.objects;
create policy storage_public_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'group-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 6. Attachments are private to the people on the task.
--    Path convention:  attachments/<task id>/<file>
--    This replaces the MVP policy that let any authenticated user read every
--    attachment in the bucket.
-- ---------------------------------------------------------------------------
drop policy if exists storage_attachments_rw on storage.objects;

create policy storage_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_access_task(public.safe_uuid((storage.foldername(name))[1]), auth.uid())
  );

create policy storage_attachments_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_access_task(public.safe_uuid((storage.foldername(name))[1]), auth.uid())
  );

create policy storage_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Pokes and messages respect blocking, and a poke needs a real connection.
-- ---------------------------------------------------------------------------
drop policy if exists pokes_insert_sender on public.pokes;
create policy pokes_insert_sender on public.pokes
  for insert to authenticated
  with check (
    from_user = auth.uid()
    and not exists (
      select 1 from public.contacts c
      where c.owner_id = to_user and c.contact_id = auth.uid() and c.is_blocked
    )
    and (
      (task_id is not null and public.can_access_task(task_id, auth.uid()))
      or exists (
        select 1 from public.contacts c
        where c.owner_id = auth.uid() and c.contact_id = to_user and not c.is_blocked
      )
    )
  );

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not exists (
      select 1 from public.contacts c
      where c.owner_id = recipient_id and c.contact_id = auth.uid() and c.is_blocked
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Finding someone by phone number.
--    0001's profiles policy says discovery happens "by a SECURITY DEFINER RPC,
--    not by opening this table up to everyone" — but that RPC was never
--    written, so adding a contact could not work. Here it is. It honours
--    searchable_by_number, photo_visibility and blocking, and returns at most
--    one row so it cannot be used to enumerate the user base.
-- ---------------------------------------------------------------------------
create or replace function public.find_profile_by_phone(phone_number text)
returns table (id uuid, display_name text, photo_url text)
language sql security definer stable set search_path = public as $$
  select
    p.id,
    p.display_name,
    case when p.photo_visibility = 'nobody' then null else p.photo_url end
  from public.profiles p
  where p.phone = phone_number
    and p.searchable_by_number
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.contacts c
      where c.owner_id = p.id and c.contact_id = auth.uid() and c.is_blocked
    )
  limit 1;
$$;

revoke all on function public.find_profile_by_phone(text) from public, anon;
grant execute on function public.find_profile_by_phone(text) to authenticated;
