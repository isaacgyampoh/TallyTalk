-- ============================================================================
-- Private messages (0011): who may write to whom, what arrives, and what a
-- message is allowed to become after it is sent.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233290000001', 'Abena') as abena \gset ab_
select test.signup('+233290000002', 'Kwesi') as kwesi \gset kw_
select test.signup('+233290000003', 'Nii')   as nii   \gset ni_
\set abena :ab_abena
\set kwesi :kw_kwesi
\set nii   :ni_nii

-- ===========================================================================
-- A message needs a connection, which 0009 made something both people agreed.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'abena', :'kwesi', 'Hello'),
  'a stranger cannot be written to');
rollback;

-- They connect, the way the app does it.
insert into public.contact_requests (from_user, to_user) values (:'abena', :'kwesi');
update public.contact_requests set status = 'accepted' where from_user = :'abena';
delete from public.notifications;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.allows(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'abena', :'kwesi', 'Did the invoice go out?'),
  'a contact can be written to');
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'kwesi', :'abena', 'Not from me'),
  'and nobody can put words in somebody else''s mouth');
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'abena', :'abena', 'Talking to myself'),
  'nor write to themselves');
commit;

-- ===========================================================================
-- It arrives, and it is announced once, to one person.
-- ===========================================================================
select test.sees(format('select 1 from public.notifications where user_id = %L and category = ''messages''', :'kwesi'),
  1, 'the recipient is told');
select test.ok(
  (select title from public.notifications where user_id = :'kwesi') = 'Abena sent you a message',
  'with the sender''s name');
select test.ok(
  (select body from public.notifications where user_id = :'kwesi') = 'Did the invoice go out?',
  'and enough of it to be worth reading');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'abena'), 0,
  'the sender is not told about their own message');

-- ===========================================================================
-- Reading it is the recipient's business, and all they may do.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kwesi')::text, true);
select test.sees('select 1 from public.messages', 1, 'the recipient can read it');
select test.ok(public.unread_message_count() = 1, 'and it counts as unread');
select test.allows('update public.messages set read_at = now()', 'they can mark it read');
select test.ok(public.unread_message_count() = 0, 'which clears the count');
select test.refuses(
  'update public.messages set body = ''Something else''',
  'but a message cannot be rewritten after it is sent');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.ignores('update public.messages set read_at = null',
  'and the sender cannot mark their own message unread for someone else');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'nii')::text, true);
select test.sees('select 1 from public.messages', 0,
  'somebody outside the conversation sees nothing of it');
select test.ok(public.unread_message_count() = 0, 'and has nothing waiting');
rollback;

-- ===========================================================================
-- Blocking stops a conversation in both useful directions.
-- ===========================================================================
update public.contacts set is_blocked = true where owner_id = :'kwesi' and contact_id = :'abena';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'abena', :'kwesi', 'Still here'),
  'someone who blocked me cannot be written to');
rollback;

update public.contacts set is_blocked = false where owner_id = :'kwesi' and contact_id = :'abena';
update public.contacts set is_blocked = true where owner_id = :'abena' and contact_id = :'kwesi';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'abena', :'kwesi', 'Changed my mind'),
  'and I cannot write to someone I have blocked myself');
select test.sees('select 1 from public.list_conversations()', 0,
  'a blocked contact drops out of the conversation list');
rollback;
update public.contacts set is_blocked = false where owner_id = :'abena' and contact_id = :'kwesi';

-- ===========================================================================
-- The conversation list.
-- ===========================================================================
insert into public.messages (sender_id, recipient_id, body, created_at)
values (:'kwesi', :'abena', 'It went this morning', now() + interval '1 minute');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.sees('select 1 from public.list_conversations()', 1,
  'one conversation, not one row per message');
select test.ok(
  (select last_body from public.list_conversations()) = 'It went this morning',
  'showing the latest thing said');
select test.ok(
  (select last_mine from public.list_conversations()) = false,
  'and who said it');
select test.ok((select unread from public.list_conversations()) = 1,
  'with what I have not read');
select test.ok(
  (select display_name from public.list_conversations()) = 'Kwesi',
  'and who it is with');
rollback;

-- Someone connected but never messaged is not a conversation.
insert into public.contacts (owner_id, contact_id) values (:'abena', :'nii')
on conflict do nothing;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'abena')::text, true);
select test.sees('select 1 from public.list_conversations()', 1,
  'a contact you have never written to is not listed as a conversation');
rollback;

-- ===========================================================================
-- An account that leaves takes its side of the conversation with it.
-- ===========================================================================
select test.allows(format('delete from public.profiles where id = %L', :'kwesi'),
  'the other person can delete their account');
select test.sees(format('select 1 from public.messages where recipient_id = %L', :'abena'), 0,
  'and the messages go with them, rather than lingering unreadable');
