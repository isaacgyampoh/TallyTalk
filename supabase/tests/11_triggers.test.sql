-- ============================================================================
-- The triggers and SECURITY DEFINER functions the app leans on, exercised the
-- way the client reaches them: as `authenticated`, through RLS.
--
-- These are the writes the client is deliberately *not* allowed to make
-- itself, so if a trigger stops firing the app breaks in a way no amount of
-- client-side testing would show.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233250000001', 'Esi')    as esi  \gset esi_
select test.signup('+233250000002', 'Kofi')   as kofi \gset kofi_
select test.signup('+233250000003', 'Adwoa')  as adw  \gset adw_
\set esi  :esi_esi
\set kofi :kofi_kofi
\set adwoa :adw_adw

-- ===========================================================================
-- Creating a group seats its creator as administrator (on_group_created).
--
-- Without this the group is a dead end: groups_insert_creator lets you create
-- it, and group_members_admin_manage then forbids you from joining your own
-- group, because there is no admin yet.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);

insert into public.groups (id, name, created_by)
values ('cccccccc-0000-0000-0000-00000000cccc', 'Wedding Committee', :'esi');

select test.sees(
  format('select 1 from public.group_members where group_id = ''cccccccc-0000-0000-0000-00000000cccc'' and user_id = %L and role = ''administrator''', :'esi'),
  1, 'the creator is seated as administrator, and can see it');
select test.ok(public.is_group_admin('cccccccc-0000-0000-0000-00000000cccc', :'esi'),
  'and is recognised as an admin by is_group_admin');
commit;

-- ===========================================================================
-- Accepting an invitation puts you in the group (on_invitation_accepted).
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
select test.allows(
  format('insert into public.group_invitations (id, group_id, invited_user, invited_by) values (''dddddddd-0000-0000-0000-00000000dddd'', ''cccccccc-0000-0000-0000-00000000cccc'', %L, %L)',
         :'kofi', :'esi'),
  'an admin can invite someone');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adwoa')::text, true);
select test.sees('select 1 from public.group_invitations', 0,
  'an invitation is invisible to an unrelated user');
select test.ignores(
  'update public.group_invitations set status = ''accepted'' where id = ''dddddddd-0000-0000-0000-00000000dddd''',
  'and cannot be accepted by anyone but the invitee');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.sees('select 1 from public.group_invitations', 1,
  'the invitee can see their invitation');
select test.refuses(
  format('update public.group_invitations set invited_user = %L where id = ''dddddddd-0000-0000-0000-00000000dddd''', :'adwoa'),
  'the invitee cannot redirect it to someone else (group_invitations_status_only)');
select test.allows(
  'update public.group_invitations set status = ''accepted'' where id = ''dddddddd-0000-0000-0000-00000000dddd''',
  'the invitee can accept');
select test.sees(
  format('select 1 from public.group_members where group_id = ''cccccccc-0000-0000-0000-00000000cccc'' and user_id = %L and role = ''member''', :'kofi'),
  1, 'accepting made them a member (on_invitation_accepted)');
select test.ok(public.is_group_member('cccccccc-0000-0000-0000-00000000cccc', :'kofi'),
  'and is_group_member agrees');
commit;

-- ===========================================================================
-- What group membership opens up.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.sees(format('select 1 from public.profiles where id = %L', :'esi'), 1,
  'fellow members can read each other''s profiles');
select test.allows(
  format('insert into public.tasks (title, requester_id, group_id) values (%L, %L, ''cccccccc-0000-0000-0000-00000000cccc'')',
         'Book the canopies', :'kofi'),
  'a member can raise a task in the group');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adwoa')::text, true);
select test.refuses(
  format('insert into public.tasks (title, requester_id, group_id) values (%L, %L, ''cccccccc-0000-0000-0000-00000000cccc'')',
         'Not my group', :'adwoa'),
  'a non-member cannot raise a task in that group');
select test.sees('select 1 from public.group_members', 0,
  'nor see who belongs to it');
rollback;

-- ===========================================================================
-- A profile cannot be created claiming someone else's number
-- (profiles_insert_self, tightened in 0003).
-- ===========================================================================
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '99999999-9999-9999-9999-999999999999', 'phone', '+233259999999')::text,
  true);
select test.refuses(
  'insert into public.profiles (id, phone, display_name) values (''99999999-9999-9999-9999-999999999999'', ''+233250000001'', ''Impostor'')',
  'a self-inserted profile cannot claim a number that is not on its own token');
rollback;

-- ===========================================================================
-- Discovery by number honours blocking and opting out.
-- ===========================================================================
insert into public.contacts (owner_id, contact_id, is_blocked)
values (:'adwoa', :'esi', true);

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
select test.sees('select * from public.find_profile_by_phone(''+233250000003'')', 0,
  'someone who blocked me does not come up in a number search');
select test.sees('select * from public.find_profile_by_phone(''+233250000002'')', 1,
  'but an ordinary user does');
rollback;

-- ===========================================================================
-- updated_at is maintained by the database, not the client.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
insert into public.tasks (id, title, requester_id, assignee_id)
values ('eeeeeeee-0000-0000-0000-00000000eeee', 'Touch test', :'esi', :'kofi');
update public.tasks set updated_at = '2000-01-01'
where id = 'eeeeeeee-0000-0000-0000-00000000eeee';
select test.ok(
  (select updated_at from public.tasks where id = 'eeeeeeee-0000-0000-0000-00000000eeee') > now() - interval '1 minute',
  'a client cannot backdate updated_at (touch_updated_at)');
rollback;

-- ===========================================================================
-- task_events is an append-only log.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
insert into public.tasks (id, title, requester_id, assignee_id)
values ('ffffffff-0000-0000-0000-00000000ffff', 'Event test', :'esi', :'kofi');
insert into public.task_events (task_id, actor_id, event_type)
values ('ffffffff-0000-0000-0000-00000000ffff', :'esi', 'created');
select test.ignores(
  'update public.task_events set event_type = ''rewritten''',
  'an event cannot be rewritten after the fact');
select test.ignores(
  'delete from public.task_events',
  'nor deleted');
rollback;
