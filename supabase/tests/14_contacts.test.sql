-- ============================================================================
-- Asking to connect (0009): who may ask, who may answer, and what an answer
-- actually does.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233280000001', 'Adjoa') as adjoa \gset a_
select test.signup('+233280000002', 'Kofi')  as kofi  \gset k_
select test.signup('+233280000003', 'Yaa')   as yaa   \gset y_
select test.signup('+233280000004', 'Esi')   as esi   \gset e_
\set adjoa :a_adjoa
\set kofi  :k_kofi
\set yaa   :y_yaa
\set esi   :e_esi

-- ===========================================================================
-- Asking.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adjoa')::text, true);

select test.ok(public.contact_request_state(:'kofi') = 'open',
  'someone I have no history with can be asked');
select test.ok(public.contact_request_state(:'adjoa') = 'self',
  'and I am never a candidate myself');

select test.allows(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'adjoa', :'kofi'),
  'I can ask someone to connect');
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'kofi', :'yaa'),
  'I cannot ask on somebody else''s behalf');
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'adjoa', :'adjoa'),
  'nor ask myself');
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'adjoa', :'kofi'),
  'nor ask the same person twice');
select test.ok(public.contact_request_state(:'kofi') = 'sent',
  'the sheet can see that it is already sent');
commit;

select test.sees(format('select 1 from public.notifications where user_id = %L and category = ''contacts''', :'kofi'),
  1, 'the person asked hears about it');
select test.ok(
  (select title from public.notifications where user_id = :'kofi') = 'Adjoa wants to connect',
  'and the notification names who is asking');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'adjoa'), 0,
  'the asker is not notified about their own request');

-- ===========================================================================
-- Who can see it, and who can answer it.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaa')::text, true);
select test.sees('select 1 from public.contact_requests', 0,
  'a request between two other people is invisible');
select test.ignores(
  'update public.contact_requests set status = ''accepted''',
  'and cannot be answered by a bystander');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adjoa')::text, true);
select test.sees('select 1 from public.contact_requests', 1, 'the asker can see their own request');
select test.ignores(
  'update public.contact_requests set status = ''accepted''',
  'but cannot accept it on the other person''s behalf');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.ok(public.contact_request_state(:'adjoa') = 'incoming',
  'the person asked sees it as incoming');
select test.refuses(
  format('update public.contact_requests set from_user = %L', :'yaa'),
  'they cannot rewrite who asked');
select test.refuses(
  'update public.contact_requests set status = ''pending''',
  'nor leave it unanswered-but-touched');
commit;

-- ===========================================================================
-- Accepting connects both sides.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.allows('update public.contact_requests set status = ''accepted''',
  'the person asked can accept');
commit;

select test.sees(format('select 1 from public.contacts where owner_id = %L and contact_id = %L', :'adjoa', :'kofi'),
  1, 'the asker now has them as a contact');
select test.sees(format('select 1 from public.contacts where owner_id = %L and contact_id = %L', :'kofi', :'adjoa'),
  1, 'and they have the asker — a connection cannot exist in one direction only');
select test.ok(
  (select responded_at is not null from public.contact_requests),
  'the answer is stamped');
select test.ok(
  (select count(*) from public.notifications where user_id = :'adjoa' and category = 'contacts') = 1,
  'the asker is told it was accepted');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.refuses('update public.contact_requests set status = ''declined''',
  'an answered request cannot be answered again');
select test.ok(public.contact_request_state(:'adjoa') = 'connected',
  'and the state now reads as connected');
rollback;

-- ===========================================================================
-- Declining is final, and quiet.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaa')::text, true);
insert into public.contact_requests (from_user, to_user) values (:'yaa', :'kofi');
commit;
delete from public.notifications where user_id = :'kofi';

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
update public.contact_requests set status = 'declined' where from_user = :'yaa';
commit;

select test.sees(format('select 1 from public.contacts where owner_id = %L and contact_id = %L', :'yaa', :'kofi'),
  0, 'declining connects nobody');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'yaa'), 0,
  'and the person refused is not told, which would only invite another attempt');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaa')::text, true);
select test.ok(public.contact_request_state(:'kofi') = 'declined',
  'their own client can see it was answered');
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'yaa', :'kofi'),
  'and a refusal cannot be followed by asking again');
rollback;

-- ===========================================================================
-- Blocking, in both directions.
-- ===========================================================================
insert into public.contacts (owner_id, contact_id, is_blocked) values (:'yaa', :'adjoa', true);

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adjoa')::text, true);
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'adjoa', :'yaa'),
  'someone who blocked me cannot be asked');
select test.ok(public.contact_request_state(:'yaa') = 'unavailable',
  'and the sheet is told only that they are unavailable, never that it is a block');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'yaa')::text, true);
select test.refuses(
  format('insert into public.contact_requests (from_user, to_user) values (%L, %L)', :'yaa', :'adjoa'),
  'and I cannot ask someone I have blocked myself');
rollback;
delete from public.contacts where owner_id = :'yaa' and contact_id = :'adjoa';

-- ===========================================================================
-- Withdrawing.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adjoa')::text, true);
insert into public.contact_requests (from_user, to_user) values (:'adjoa', :'yaa');
select test.allows(
  format('delete from public.contact_requests where from_user = %L and to_user = %L', :'adjoa', :'yaa'),
  'I can withdraw a request I have sent');
select test.ignores(
  format('delete from public.contact_requests where from_user = %L', :'yaa'),
  'but not one somebody else sent');
rollback;

-- ===========================================================================
-- SMS invitations: limits that cannot be moved by the client.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adjoa')::text, true);
select test.refuses(
  format('insert into public.sms_invitations (inviter, phone_digits) values (%L, ''233244000000'')', :'adjoa'),
  'a client cannot write its own invitation rows, which would hide its own rate limiting');
select test.sees('select 1 from public.sms_invitations', 0, 'and sees none yet');
rollback;

select test.ok(public.may_invite(:'adjoa', '233244000000') = 'ok', 'a first invitation is allowed');
select test.ok(public.may_invite(:'adjoa', '12345') = 'invalid', 'a number too short to dial is refused');

insert into public.sms_invitations (inviter, phone_digits) values (:'adjoa', '233244000000');
select test.ok(public.may_invite(:'adjoa', '233244000000') = 'already-invited',
  'the same number cannot be invited twice in a day by the same person');

-- A different number, so the per-inviter rule above does not answer first:
-- three people have already invited it today, and a fourth may not.
insert into public.sms_invitations (inviter, phone_digits) values
  (:'kofi', '233244000111'), (:'yaa', '233244000111'), (:'esi', '233244000111');
select test.ok(public.may_invite(:'adjoa', '233244000111') = 'number-limit',
  'and one number cannot be piled on by several people');

insert into public.sms_invitations (inviter, phone_digits)
select :'adjoa', '23324400' || lpad(g::text, 4, '0') from generate_series(1, 9) g;
select test.ok(public.may_invite(:'adjoa', '233200111222') = 'daily-limit',
  'nobody can be used as a bulk sender');
select test.ok(public.may_invite(:'kofi', '233200111222') = 'ok',
  'while everyone else is unaffected by that');

-- Yesterday's invitations do not count against today.
update public.sms_invitations set created_at = now() - interval '25 hours' where inviter = :'adjoa';
select test.ok(public.may_invite(:'adjoa', '233200111222') = 'ok',
  'and the limit is a rolling day, not a lifetime');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'kofi')::text, true);
select test.sees('select 1 from public.sms_invitations', 1, 'I see the invitations I sent');
select test.sees(format('select 1 from public.sms_invitations where inviter = %L', :'adjoa'), 0,
  'and never who else invited a number, which would leak who knows whom');
rollback;
