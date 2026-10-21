-- ============================================================================
-- TaskTally — you can see the group you just made
-- Run after 0013_group_messages_search_and_receipts.sql.
--
-- Creating a group has never worked from the app, and the database tests did
-- not show it because they insert with plain SQL.
--
-- groups_select_member (0001) lets you see a group you are a member of.
-- on_group_created (0003) makes the creator its first member — but it is an
-- AFTER trigger, and RETURNING is evaluated before AFTER triggers run. So:
--
--   insert into groups (...) returning id
--   -> ERROR: new row violates row-level security policy for table "groups"
--
-- The row is inserted and then the statement fails on the way out, which reads
-- like the insert itself was refused. Every client that asks for the created
-- row back hits this, and supabase-js does exactly that:
-- .insert({...}).select('id').single().
--
-- A plain insert with no RETURNING succeeds, which is why this survived: the
-- tests, and the 0003 trigger tests, all insert that way.
--
-- The fix is the honest statement of the rule: a group you created is one you
-- can see, membership or not. It does not widen access to anybody else — only
-- the creator's own row, which they are about to be made a member of anyway.
-- ============================================================================

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
  for select to authenticated
  using (
    public.is_group_member(id, auth.uid())
    or created_by = auth.uid()
  );
