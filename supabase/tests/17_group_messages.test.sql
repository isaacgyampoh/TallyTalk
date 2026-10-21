-- ============================================================================
-- Group conversations, search and read receipts (0013).
--
-- Groups are the ones that already existed for shared task lists, so these
-- assertions are as much about the membership rules holding up under a second
-- use as about the new tables.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233310000001', 'Ama G')   as a \gset a_
select test.signup('+233310000002', 'Kofi G')  as k \gset k_
select test.signup('+233310000003', 'Esi G')   as e \gset e_
select test.signup('+233310000004', 'Yaw G')   as y \gset y_
\set ama  :a_a
\set kofi :k_k
\set esi  :e_e
\set yaw  :y_y

-- Ama makes a group; the 0003 trigger seats her as its administrator.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
insert into public.groups (id, name, created_by)
values ('99990000-0000-0000-0000-000000009999', 'Site Works', :'ama');
commit;

select test.ok(public.is_group_admin('99990000-0000-0000-0000-000000009999', :'ama'),
  'the person who made the group administers it');

-- ===========================================================================
-- Membership is the whole access rule.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.allows(
  format('insert into public.group_members (group_id, user_id) values (''99990000-0000-0000-0000-000000009999'', %L)', :'kofi'),
  'an admin can add a member');
select test.allows(
  format('insert into public.group_members (group_id, user_id) values (''99990000-0000-0000-0000-000000009999'', %L)', :'esi'),
  'and another');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.refuses(
  format('insert into public.group_members (group_id, user_id) values (''99990000-0000-0000-0000-000000009999'', %L)', :'yaw'),
  'an outsider cannot add themselves to a group');
select test.sees('select 1 from public.groups', 0, 'nor even see that it exists');
select test.sees('select 1 from public.group_members', 0, 'nor who is in it');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.refuses(
  format('insert into public.group_members (group_id, user_id) values (''99990000-0000-0000-0000-000000009999'', %L)', :'yaw'),
  'an ordinary member cannot add anybody');
select test.ignores(
  format('update public.group_members set role = ''administrator'' where user_id = %L', :'kofi'),
  'nor promote themselves to administrator');
rollback;

-- ===========================================================================
-- Talking in a group.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.allows(
  format('insert into public.messages (sender_id, group_id, body) values (%L, ''99990000-0000-0000-0000-000000009999'', %L)',
         :'kofi', 'Scaffolding arrives Thursday'),
  'a member can write to the group');
select test.refuses(
  format('insert into public.messages (sender_id, group_id, recipient_id, body) values (%L, ''99990000-0000-0000-0000-000000009999'', %L, %L)',
         :'kofi', :'ama', 'Both at once'),
  'but a message goes to a person or a group, never both');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
select test.sees('select 1 from public.messages', 1, 'every member reads it');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from public.messages', 0,
  'an outsider reads nothing, even knowing the group id');
select test.refuses(
  format('insert into public.messages (sender_id, group_id, body) values (%L, ''99990000-0000-0000-0000-000000009999'', %L)',
         :'yaw', 'Let me in'),
  'and cannot write to it');
rollback;

-- ===========================================================================
-- Removal ends access to what comes next.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
delete from public.group_members where user_id = :'esi';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
insert into public.messages (sender_id, group_id, body)
values (:'kofi', '99990000-0000-0000-0000-000000009999', 'Said after Esi left');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
select test.sees('select 1 from public.messages', 0,
  'a removed member reads nothing further — including what was said before they left');
select test.refuses(
  format('insert into public.messages (sender_id, group_id, body) values (%L, ''99990000-0000-0000-0000-000000009999'', %L)',
         :'esi', 'Still here?'),
  'and cannot write');
rollback;

-- ===========================================================================
-- Read receipts.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.allows(
  format($$insert into public.message_reads (message_id, user_id)
           select id, %L from public.messages where body = 'Scaffolding arrives Thursday'$$, :'ama'),
  'a member records their own reading');
select test.refuses(
  format($$insert into public.message_reads (message_id, user_id)
           select id, %L from public.messages where body = 'Scaffolding arrives Thursday'$$, :'kofi'),
  'but cannot record somebody else''s');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.refuses(
  format($$insert into public.message_reads (message_id, user_id)
           select id, %L from public.messages where body = 'Scaffolding arrives Thursday'$$, :'kofi'),
  'and nobody marks their own message read');
rollback;

-- Taken as the superuser so the outsider below is handed a real id rather
-- than selecting nothing: an insert that quietly affects no rows would pass a
-- "refused" assertion for the wrong reason.
select id as msg from public.messages where body = 'Said after Esi left' \gset m_
\set hidden :m_msg

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.refuses(
  format('insert into public.message_reads (message_id, user_id) values (%L, %L)',
         :'hidden', :'yaw'),
  'an outsider holding a real message id still cannot record a reading of it');
select test.refuses(
  format('insert into public.messages (sender_id, group_id, body) values (%L, ''99990000-0000-0000-0000-000000009999'', %L)',
         :'yaw', 'Guessed the id'),
  'nor write to the group by knowing its id');
rollback;

-- Ama reads it for real, then the sender can see who has.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
insert into public.message_reads (message_id, user_id)
select id, :'ama' from public.messages where body = 'Scaffolding arrives Thursday';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.sees(
  $$select * from public.message_receipts(
      (select id from public.messages where body = 'Scaffolding arrives Thursday'))$$,
  1, 'the sender sees one other member to account for');
select test.ok(
  (select read_at is not null from public.message_receipts(
     (select id from public.messages where body = 'Scaffolding arrives Thursday'))),
  'and that they have read it');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees(
  $$select * from public.message_receipts(
      (select id from public.messages where body = 'Said after Esi left'))$$,
  0, 'an outsider guessing a message id learns nothing about who is in the group');
rollback;

-- ===========================================================================
-- Unread, and the conversation list.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
select test.ok(public.unread_message_count() = 1,
  'a group message I have not read counts as unread');
select test.sees('select 1 from public.list_conversations()', 1, 'the group is a conversation');
select test.ok(
  (select kind from public.list_conversations()) = 'group', 'listed as a group');
select test.ok(
  (select display_name from public.list_conversations()) = 'Site Works', 'by its name');
select test.ok(
  (select members from public.list_conversations()) = 2, 'with how many people are in it');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from public.list_conversations()', 0,
  'and does not appear for anybody outside it');
rollback;

-- ===========================================================================
-- Search sees exactly what the searcher may read.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.sees($$select * from public.search_messages('scaffolding')$$, 1,
  'a member finds what was said in their group');
select test.sees($$select * from public.search_messages('Thursday scaffolding')$$, 1,
  'word order does not matter');
select test.sees($$select * from public.search_messages('helicopter')$$, 0,
  'and nothing matches nothing');
select test.sees($$select * from public.search_messages('a')$$, 0,
  'a single letter is not a search');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees($$select * from public.search_messages('scaffolding')$$, 0,
  'an outsider searching the same word finds nothing — search runs as the caller');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'esi')::text, true);
select test.sees($$select * from public.search_messages('scaffolding')$$, 0,
  'and neither does a removed member, for messages sent while they belonged');
rollback;

-- ===========================================================================
-- Creating a group the way a client actually does it (0014).
--
-- supabase-js writes `.insert({...}).select('id').single()`, which is
-- INSERT ... RETURNING. RETURNING is checked against the SELECT policy before
-- the AFTER trigger has made the creator a member — so this failed for every
-- real client while plain-SQL tests passed.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.allows(
  format('insert into public.groups (name, created_by) values (''Returning Works'', %L) returning id', :'yaw'),
  'a group can be created and its id returned in one statement');
select test.sees('select 1 from public.groups where name = ''Returning Works''', 1,
  'and the creator can see it immediately');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);
insert into public.groups (id, name, created_by)
values ('88880000-0000-0000-0000-000000008888', 'Private Plans', :'ama');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaw')::text, true);
select test.sees('select 1 from public.groups where name = ''Private Plans''', 0,
  'while somebody else''s group stays invisible — the fix widens nothing');
rollback;
