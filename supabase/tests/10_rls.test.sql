-- ============================================================================
-- Row-Level Security, as the client actually meets it.
--
-- Every block below runs as the `authenticated` role with a JWT claim set, the
-- way PostgREST runs a request. Seeding happens as the superuser (RLS off), so
-- a denial here is the policy's work and nothing else.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

-- --- cast -------------------------------------------------------------------
select test.signup('+233240000001', 'Ama')    as ama   \gset ama_
select test.signup('+233240000002', 'Kwame')  as kwame \gset kwame_
select test.signup('+233240000003', 'Yaw')    as yaw   \gset yaw_

\set ama   :ama_ama
\set kwame :kwame_kwame
\set yaw   :yaw_yaw

select test.ok(
  (select count(*) from public.profiles where id in (:'ama', :'kwame', :'yaw')) = 3,
  'signing up creates a profile row (on_auth_user_created)');
select test.ok(
  (select phone from public.profiles where id = :'ama') = '233240000001',
  'the profile carries the phone number from the sign-in, as GoTrue stores it');

-- Ama knows Kwame; Yaw knows nobody.
insert into public.contacts (owner_id, contact_id) values (:'ama', :'kwame');
insert into public.contacts (owner_id, contact_id) values (:'kwame', :'ama');

-- ===========================================================================
-- profiles
-- ===========================================================================
-- `set_config(..., true)` is how each block below takes on an identity: psql
-- cannot interpolate a variable into SET, and the `true` keeps it local to the
-- transaction, so one block's identity never leaks into the next.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);

select test.sees(format('select 1 from public.profiles where id = %L', :'ama'), 1,
  'I can read my own profile');
select test.sees(format('select 1 from public.profiles where id = %L', :'kwame'), 1,
  'I can read the profile of someone I have as a contact');
select test.sees(format('select 1 from public.profiles where id = %L', :'yaw'), 0,
  'a stranger''s profile is invisible');

select test.allows(
  format('update public.profiles set display_name = %L where id = %L', 'Ama S.', :'ama'),
  'I can rename myself');
select test.ignores(
  format('update public.profiles set display_name = %L where id = %L', 'Hacked', :'kwame'),
  'I cannot rename someone else');
select test.refuses(
  format('update public.profiles set phone = %L where id = %L', '+233249999999', :'ama'),
  'I cannot change my own phone number (profiles_phone_locked)');
rollback;

-- ===========================================================================
-- tasks
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);

select test.allows(
  format('insert into public.tasks (title, requester_id, assignee_id) values (%L, %L, %L)',
         'Send the Ecobank document', :'ama', :'kwame'),
  'I can raise a task against my contact');
select test.refuses(
  format('insert into public.tasks (title, requester_id, assignee_id) values (%L, %L, %L)',
         'Not mine to send', :'kwame', :'yaw'),
  'I cannot raise a task in someone else''s name');
rollback;

-- A real task to read from, inserted as the superuser.
insert into public.tasks (id, title, requester_id, assignee_id)
values ('aaaaaaaa-0000-0000-0000-00000000aaaa', 'Confirm the venue', :'ama', :'kwame');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kwame')::text, true);
select test.sees('select 1 from public.tasks where id = ''aaaaaaaa-0000-0000-0000-00000000aaaa''', 1,
  'the assignee can see the task');
select test.refuses(
  format('update public.tasks set assignee_id = %L where id = %L',
         :'yaw', 'aaaaaaaa-0000-0000-0000-00000000aaaa'),
  'a task cannot be reassigned (tasks_no_reassign)');
select test.allows(
  'update public.tasks set status = ''active'' where id = ''aaaaaaaa-0000-0000-0000-00000000aaaa''',
  'the assignee can accept the task');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from public.tasks where id = ''aaaaaaaa-0000-0000-0000-00000000aaaa''', 0,
  'an unrelated user cannot see the task');
select test.sees('select 1 from public.tasks', 0,
  'and cannot see any task at all');
rollback;

-- ===========================================================================
-- attachments: the gap 0003 closed
-- ===========================================================================
insert into public.task_attachments (task_id, uploaded_by, storage_path, attachment_type, file_name)
values ('aaaaaaaa-0000-0000-0000-00000000aaaa', :'ama',
        'aaaaaaaa-0000-0000-0000-00000000aaaa/scan.pdf', 'document', 'scan.pdf');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kwame')::text, true);
select test.sees('select 1 from public.task_attachments', 1,
  'a task participant can list its attachments');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from public.task_attachments', 0,
  'someone outside the task cannot (the 0003 fix)');
rollback;

-- The storage policies that back those rows, by path convention.
insert into storage.objects (bucket_id, name, owner)
values ('attachments', 'aaaaaaaa-0000-0000-0000-00000000aaaa/scan.pdf', :'ama');
insert into storage.objects (bucket_id, name, owner)
values ('attachments', 'not-a-uuid/scan.pdf', :'ama');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kwame')::text, true);
select test.sees('select 1 from storage.objects where bucket_id = ''attachments''', 1,
  'a participant can read the stored file under the task''s folder');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from storage.objects where bucket_id = ''attachments''', 0,
  'an outsider reads nothing from the private bucket');
select test.ok(public.safe_uuid('not-a-uuid') is null,
  'a malformed path yields null rather than aborting the query (safe_uuid)');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.allows(
  format('insert into storage.objects (bucket_id, name, owner) values (''avatars'', %L, %L)',
         :'ama' || '/avatar.png', :'ama'),
  'I can upload an avatar inside my own folder');
select test.refuses(
  format('insert into storage.objects (bucket_id, name, owner) values (''avatars'', %L, %L)',
         :'kwame' || '/avatar.png', :'ama'),
  'I cannot write into someone else''s avatar folder');
rollback;

-- ===========================================================================
-- being added by someone else
--
-- 0001's profiles policy is written to work in both directions: "(c.owner_id =
-- auth.uid() and c.contact_id = profiles.id) or (c.contact_id = auth.uid() and
-- c.owner_id = profiles.id)". Someone who adds you must therefore be visible
-- to you — otherwise their task arrives from a blank name.
-- ===========================================================================
insert into public.contacts (owner_id, contact_id) values (:'yaw', :'ama');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.sees(format('select 1 from public.profiles where id = %L', :'yaw'), 1,
  'I can read the profile of someone who added me');
rollback;

-- ===========================================================================
-- blocking
-- ===========================================================================
update public.contacts set is_blocked = true where owner_id = :'kwame' and contact_id = :'ama';

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.refuses(
  format('insert into public.tasks (title, requester_id, assignee_id) values (%L, %L, %L)',
         'Please do this', :'ama', :'kwame'),
  'someone who blocked me cannot be sent a task');
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'ama', :'kwame', 'hello'),
  'nor a message');
select test.refuses(
  format('insert into public.pokes (from_user, to_user) values (%L, %L)', :'ama', :'kwame'),
  'nor a poke');
rollback;
update public.contacts set is_blocked = false where owner_id = :'kwame' and contact_id = :'ama';

-- ===========================================================================
-- personal checklists and device tokens are strictly private
-- ===========================================================================
insert into public.checklists (id, owner_id, title)
values ('bbbbbbbb-0000-0000-0000-00000000bbbb', :'ama', 'Market list');
insert into public.push_tokens (user_id, token, platform)
values (:'ama', 'token-for-ama', 'android');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kwame')::text, true);
select test.sees('select 1 from public.checklists', 0,
  'a personal checklist is invisible to everyone else');
select test.sees('select 1 from public.push_tokens', 0,
  'so is a device token');
select test.refuses(
  format('insert into public.push_tokens (user_id, token, platform) values (%L, %L, ''android'')',
         :'ama', 'stolen'),
  'and nobody can register a token against another account');
rollback;

-- ===========================================================================
-- discovery by phone number
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
-- The app sends what the person typed plus a dial code: "+233…". GoTrue
-- stores "233…". Both have to find the same human being, or adding a contact
-- by number silently finds nobody — which is what happened on the live site.
select test.sees('select * from public.find_profile_by_phone(''+233240000003'')', 1,
  'I can find someone using the +233 form the app sends');
select test.sees('select * from public.find_profile_by_phone(''233240000003'')', 1,
  'and using the stored form, without the plus');
select test.sees('select * from public.find_profile_by_phone(''+233 24 000 0003'')', 1,
  'spaces in a typed number do not hide them either');
select test.sees('select * from public.find_profile_by_phone(''+233240000001'')', 0,
  'the lookup never returns me to myself');
select test.sees('select * from public.find_profile_by_phone(''+233249999999'')', 0,
  'an unknown number finds nothing');
rollback;

update public.profiles set searchable_by_number = false where id = :'yaw';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.sees('select * from public.find_profile_by_phone(''+233240000003'')', 0,
  'someone who opted out of number search cannot be found');
rollback;

begin;
set local role anon;
select test.refuses('select * from public.find_profile_by_phone(''+233240000003'')',
  'the lookup is not open to anonymous callers');
rollback;
