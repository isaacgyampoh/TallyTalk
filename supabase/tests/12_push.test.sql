-- ============================================================================
-- Who gets notified, and who does not (0005).
--
-- net.http_post is captured rather than sent (see 00_shim.sql), so each
-- assertion below is about the exact request the database would have made to
-- the send-push function. Delivery itself needs FCM credentials and a handset;
-- that is PB-021 and cannot be faked here.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

-- The configuration the triggers look for. Without it every trigger is a
-- no-op, which is itself asserted at the end.
insert into vault.decrypted_secrets (name, decrypted_secret)
values ('project_url', 'https://project.supabase.test'),
       ('send_push_secret', 'test-secret');

select test.signup('+233260000001', 'Afia')  as afia \gset afia_
select test.signup('+233260000002', 'Mensah') as men \gset men_
select test.signup('+233260000003', 'Nana')  as nana \gset nana_
\set afia  :afia_afia
\set mensah :men_men
\set nana  :nana_nana

insert into public.contacts (owner_id, contact_id) values (:'afia', :'mensah');
insert into public.contacts (owner_id, contact_id) values (:'mensah', :'afia');

-- Every recipient needs a registered device, or there is nothing to send to.
insert into public.push_tokens (user_id, token, platform) values
  (:'afia', 'device-afia', 'android'),
  (:'mensah', 'device-mensah', 'android'),
  (:'nana', 'device-nana', 'ios');

-- ===========================================================================
-- A new task notifies its assignee — and nobody else.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (id, title, requester_id, assignee_id)
values ('11111111-1111-1111-1111-111111111111', 'Send the Ecobank document', :'afia', :'mensah');
commit;

select test.sees('select 1 from net.captured', 1,
  'a new task sends exactly one notification');
select test.ok(
  (select body ->> 'userId' from net.captured order by id desc limit 1) = :'mensah',
  'it goes to the assignee, not the requester');
select test.ok(
  (select body ->> 'title' from net.captured order by id desc limit 1) = 'Afia sent you a task',
  'the title names who asked');
select test.ok(
  (select body ->> 'body' from net.captured order by id desc limit 1) = 'Send the Ecobank document',
  'the body is the task itself');
select test.ok(
  (select body -> 'data' ->> 'contactId' from net.captured order by id desc limit 1) = :'afia',
  'contactId is the other party, so the tap opens the right task space');
select test.ok(
  (select body -> 'data' ->> 'taskId' from net.captured order by id desc limit 1)
    = '11111111-1111-1111-1111-111111111111',
  'and taskId opens the task itself');
select test.ok(
  (select body ->> 'category' from net.captured order by id desc limit 1) = 'assignments',
  'it is sent on the assignments channel');
select test.ok(
  (select url from net.captured order by id desc limit 1)
    = 'https://project.supabase.test/functions/v1/send-push',
  'it is addressed to the send-push function');
select test.ok(
  (select headers ->> 'Authorization' from net.captured order by id desc limit 1)
    = 'Bearer test-secret',
  'and carries the shared secret, which is what the function checks');

-- ===========================================================================
-- Muting works, and so does having no device.
-- ===========================================================================
truncate net.captured;
update public.profiles set notification_prefs = '{"assignments": false}'::jsonb
where id = :'mensah';

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (title, requester_id, assignee_id)
values ('A muted task', :'afia', :'mensah');
commit;
select test.sees('select 1 from net.captured', 0,
  'someone who muted assignments gets nothing');

update public.profiles set notification_prefs = '{"pokes": false}'::jsonb where id = :'mensah';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (title, requester_id, assignee_id)
values ('An unmuted task', :'afia', :'mensah');
commit;
select test.sees('select 1 from net.captured', 1,
  'muting one category leaves the others alone');

truncate net.captured;
update public.profiles set notification_prefs = '{}'::jsonb where id = :'mensah';
delete from public.push_tokens where user_id = :'mensah';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (title, requester_id, assignee_id)
values ('No device', :'afia', :'mensah');
commit;
select test.sees('select 1 from net.captured', 0,
  'nothing is sent to someone with no registered device');
insert into public.push_tokens (user_id, token, platform) values (:'mensah', 'device-mensah', 'android');

-- ===========================================================================
-- A poke, which is the whole point of the wand.
-- ===========================================================================
truncate net.captured;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.pokes (from_user, to_user, task_id)
values (:'afia', :'mensah', '11111111-1111-1111-1111-111111111111');
commit;
select test.ok(
  (select body ->> 'title' from net.captured order by id desc limit 1) = 'Afia poked you',
  'a poke notifies the person being poked');
select test.ok(
  (select body ->> 'category' from net.captured order by id desc limit 1) = 'pokes',
  'on the pokes channel');
select test.ok(
  (select body ->> 'body' from net.captured order by id desc limit 1) = 'Send the Ecobank document',
  'naming the task it is about');

-- ===========================================================================
-- Comments and status changes reach the other side, not the person acting.
-- ===========================================================================
truncate net.captured;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mensah')::text, true);
insert into public.task_events (task_id, actor_id, event_type, metadata)
values ('11111111-1111-1111-1111-111111111111', :'mensah', 'comment',
        '{"body": "On it this afternoon"}'::jsonb);
commit;
select test.sees('select 1 from net.captured', 1,
  'a comment notifies the other participant');
select test.ok(
  (select body ->> 'userId' from net.captured order by id desc limit 1) = :'afia',
  'the person who commented is not told about their own comment');
select test.ok(
  (select body ->> 'category' from net.captured order by id desc limit 1) = 'comments',
  'on the comments channel');
select test.ok(
  (select body ->> 'body' from net.captured order by id desc limit 1) = 'Send the Ecobank document',
  'the comment text is never put in the payload — only the task it belongs to');

truncate net.captured;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mensah')::text, true);
insert into public.task_events (task_id, actor_id, event_type)
values ('11111111-1111-1111-1111-111111111111', :'mensah', 'completed');
commit;
select test.ok(
  (select body ->> 'title' from net.captured order by id desc limit 1) = 'Mensah completed a task',
  'completing a task tells the person who asked for it');
select test.ok(
  (select body ->> 'category' from net.captured order by id desc limit 1) = 'updates',
  'on the updates channel');

truncate net.captured;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.task_events (task_id, actor_id, event_type)
values ('11111111-1111-1111-1111-111111111111', :'afia', 'created');
commit;
select test.sees('select 1 from net.captured', 0,
  'a "created" event sends nothing — the task insert already did');

-- ===========================================================================
-- Group tasks reach every other member.
-- ===========================================================================
truncate net.captured;
insert into public.groups (id, name, created_by)
values ('22222222-2222-2222-2222-222222222222', 'Wedding Committee', :'afia');
insert into public.group_members (group_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', :'mensah', 'member'),
  ('22222222-2222-2222-2222-222222222222', :'nana', 'member');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (id, title, requester_id, group_id)
values ('33333333-3333-3333-3333-333333333333', 'Book the canopies', :'afia',
        '22222222-2222-2222-2222-222222222222');
commit;
select test.sees('select 1 from net.captured', 2,
  'a group task notifies the other two members');
select test.sees(format('select 1 from net.captured where body ->> ''userId'' = %L', :'afia'), 0,
  'and not the member who created it');
select test.ok(
  (select body -> 'data' ->> 'groupId' from net.captured limit 1)
    = '22222222-2222-2222-2222-222222222222',
  'the payload carries the group, so the tap opens the group');

-- ===========================================================================
-- Overdue tasks, which no row arrives to announce.
-- ===========================================================================
truncate net.captured;
update public.tasks set due_date = now() - interval '2 days', status = 'active'
where id = '11111111-1111-1111-1111-111111111111';

select test.ok(public.notify_overdue_tasks() = 1, 'the overdue sweep notifies one task');
select test.ok(
  (select body ->> 'title' from net.captured order by id desc limit 1)
    = 'Overdue: Afia is still waiting',
  'it tells the assignee who is waiting');
select test.ok(public.notify_overdue_tasks() = 0,
  'and does not notify the same task again the next morning');

truncate net.captured;
update public.tasks set status = 'completed', overdue_notified_at = null
where id = '11111111-1111-1111-1111-111111111111';
select test.ok(public.notify_overdue_tasks() = 0,
  'a completed task is never overdue');

-- ===========================================================================
-- With no configuration, every trigger is a no-op rather than an error.
-- ===========================================================================
truncate net.captured;
delete from vault.decrypted_secrets;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
select test.allows(
  format('insert into public.tasks (title, requester_id, assignee_id) values (%L, %L, %L)',
         'Unconfigured', :'afia', :'mensah'),
  'a task can still be created on a database with no push secrets');
commit;
select test.sees('select 1 from net.captured', 0,
  'and nothing is sent');
