-- ============================================================================
-- TaskTally — policies can only check what they are allowed to see
-- Run after 0003_security_hardening.sql.
--
-- Found by applying 0001–0003 to a real Postgres and exercising the policies as
-- the `authenticated` role (see supabase/tests). Two of them read
-- `public.contacts` with an inline sub-select. That sub-select runs as the
-- caller, so `contacts_all_own` — "using (owner_id = auth.uid())" — hides every
-- row the caller does not own. A policy cannot check a row it cannot see, and
-- `not exists (...)` over an invisible row is silently true.
--
-- The consequences were the opposite of what 0003 set out to do:
--
--   * Blocking did nothing. The block lives on the blocker's contact row, so
--     the person being blocked could never see it, and the guard in
--     tasks_insert_requester, pokes_insert_sender and messages_insert_sender
--     always passed. Blocked users could still be sent tasks, pokes and
--     messages.
--   * Being added by someone did not let you see their name. The second half of
--     profiles_select_self_or_connected ("they added me") reads a contact row
--     owned by them, so it never matched. A task would arrive from a profile
--     the recipient could not read.
--
-- 0001 already knew about this trap: is_group_member, can_access_task and
-- owns_checklist are all SECURITY DEFINER for exactly this reason. These
-- checks now go through functions of the same kind, and the tests assert both
-- directions so the regression cannot come back quietly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Has `blocker` blocked `other`? Reads the blocker's own contact row, which is
-- invisible to `other` — hence SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create or replace function public.has_blocked(blocker uuid, other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.contacts c
    where c.owner_id = blocker and c.contact_id = other and c.is_blocked
  );
$$;

-- ---------------------------------------------------------------------------
-- Is there a contact row between these two, in either direction? Used to
-- decide whether one may see the other's profile.
-- ---------------------------------------------------------------------------
create or replace function public.are_connected(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.contacts c
    where (c.owner_id = a and c.contact_id = b)
       or (c.owner_id = b and c.contact_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Does `owner` keep `other` as a contact they have not blocked? This is the
-- "we have a connection" branch of the poke policy.
-- ---------------------------------------------------------------------------
create or replace function public.keeps_contact(owner uuid, other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.contacts c
    where c.owner_id = owner and c.contact_id = other and not c.is_blocked
  );
$$;

revoke all on function public.has_blocked(uuid, uuid)   from public, anon;
revoke all on function public.are_connected(uuid, uuid)  from public, anon;
revoke all on function public.keeps_contact(uuid, uuid)  from public, anon;
grant execute on function public.has_blocked(uuid, uuid)  to authenticated;
grant execute on function public.are_connected(uuid, uuid) to authenticated;
grant execute on function public.keeps_contact(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Profiles: both directions of a connection now work.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self_or_connected on public.profiles;
create policy profiles_select_self_or_connected on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.are_connected(auth.uid(), profiles.id)
    or exists (
      -- group_members is visible to fellow members, so this one needs no help.
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Blocking takes effect: tasks.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_insert_requester on public.tasks;
create policy tasks_insert_requester on public.tasks
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id, auth.uid()))
    and (assignee_id is null or not public.has_blocked(assignee_id, auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 3. Blocking takes effect: pokes. A poke still needs either access to the
--    task it refers to, or a contact of your own to poke.
-- ---------------------------------------------------------------------------
drop policy if exists pokes_insert_sender on public.pokes;
create policy pokes_insert_sender on public.pokes
  for insert to authenticated
  with check (
    from_user = auth.uid()
    and not public.has_blocked(to_user, auth.uid())
    and (
      (task_id is not null and public.can_access_task(task_id, auth.uid()))
      or public.keeps_contact(auth.uid(), to_user)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Blocking takes effect: messages.
-- ---------------------------------------------------------------------------
drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not public.has_blocked(recipient_id, auth.uid())
  );
