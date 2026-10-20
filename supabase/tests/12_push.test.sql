-- ============================================================================
-- Notifications after Firebase (0007): what is recorded, and what is sent.
--
-- The two are deliberately separate. A notification is a row in the inbox
-- whether or not anything is delivered; delivery is a Web Push request, which
-- can be muted, unsubscribed or unconfigured. net.http_post is captured rather
-- than sent (00_shim.sql), so each delivery assertion is about the exact
-- request the database would make.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

insert into vault.decrypted_secrets (name, decrypted_secret)
values ('project_url', 'https://project.supabase.test'),
       ('send_push_secret', 'test-secret');

select test.signup('+233260000001', 'Afia')   as afia \gset afia_
select test.signup('+233260000002', 'Mensah') as men  \gset men_
select test.signup('+233260000003', 'Nana')   as nana \gset nana_
\set afia   :afia_afia
\set mensah :men_men
\set nana   :nana_nana

insert into public.contacts (owner_id, contact_id) values (:'afia', :'mensah');
insert into public.contacts (owner_id, contact_id) values (:'mensah', :'afia');

-- A browser subscription, which is what Web Push delivers to.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  (:'mensah', 'https://push.example.test/sub/mensah', 'p256dh-mensah', 'auth-mensah'),
  (:'nana',   'https://push.example.test/sub/nana',   'p256dh-nana',   'auth-nana');

-- ===========================================================================
-- A new task: recorded for the assignee, and delivered.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (id, title, requester_id, assignee_id)
values ('11111111-1111-1111-1111-111111111111', 'Send the Ecobank document', :'afia', :'mensah');
commit;

select test.sees(format('select 1 from public.notifications where user_id = %L', :'mensah'), 1,
  'a new task is recorded in the assignee''s inbox');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'afia'), 0,
  'and not in the requester''s');
select test.ok(
  (select title from public.notifications order by created_at desc limit 1) = 'Afia sent you a task',
  'the record names who asked');
select test.ok(
  (select body from public.notifications order by created_at desc limit 1) = 'Send the Ecobank document',
  'and what was asked for');
select test.ok(
  (select category from public.notifications order by created_at desc limit 1) = 'assignments',
  'under the assignments category');
select test.ok(
  (select task_id from public.notifications order by created_at desc limit 1)
    = '11111111-1111-1111-1111-111111111111',
  'carrying the task to open');
select test.ok(
  (select read_at from public.notifications order by created_at desc limit 1) is null,
  'and starts unread');

select test.sees('select 1 from net.captured', 1, 'one delivery is attempted');
select test.ok(
  (select url from net.captured order by id desc limit 1)
    = 'https://project.supabase.test/functions/v1/send-notification',
  'addressed to the Web Push function, not to anything of Google''s');
select test.ok(
  (select headers ->> 'Authorization' from net.captured order by id desc limit 1) = 'Bearer test-secret',
  'carrying the shared secret the function checks');
select test.ok(
  (select body ->> 'notificationId' from net.captured order by id desc limit 1)
    = (select id::text from public.notifications order by created_at desc limit 1),
  'and naming only the notification id — the function reads the row itself');
select test.ok(
  (select count(*) from jsonb_object_keys((select body from net.captured order by id desc limit 1)) k) = 1,
  'nothing else travels in the request body');

-- ===========================================================================
-- Muting silences the interruption, not the record.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
update public.profiles set notification_prefs = '{"assignments": false}'::jsonb where id = :'mensah';

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (title, requester_id, assignee_id)
values ('A muted task', :'afia', :'mensah');
commit;

select test.sees('select 1 from net.captured', 0, 'a muted category is not delivered');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'mensah'), 1,
  'but it is still recorded, so it can be found later');
update public.profiles set notification_prefs = '{}'::jsonb where id = :'mensah';

-- ===========================================================================
-- No subscription is not an error, and still leaves a record.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
delete from public.push_subscriptions where user_id = :'mensah';

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'afia')::text, true);
insert into public.tasks (title, requester_id, assignee_id)
values ('Nothing subscribed', :'afia', :'mensah');
commit;

select test.sees('select 1 from net.captured', 0, 'nothing is sent to someone with no subscription');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'mensah'), 1,
  'and the inbox still has it — the app works with no push at all');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (:'mensah', 'https://push.example.test/sub/mensah', 'p256dh-mensah', 'auth-mensah');

-- ===========================================================================
-- The same event twice interrupts once.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
select test.ok(
  public.notify(:'mensah', 'updates', 'Something happened', 'once', '{}'::jsonb, 'dedupe-me') is not null,
  'the first notification is recorded');
select test.ok(
  public.notify(:'mensah', 'updates', 'Something happened', 'once', '{}'::jsonb, 'dedupe-me') is null,
  'the second with the same key is not');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'mensah'), 1,
  'one record, not two');
select test.sees('select 1 from net.captured', 1, 'and one delivery, not two');

-- ===========================================================================
-- Comments and status changes reach the other side.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (:'afia', 'https://push.example.test/sub/afia', 'p256dh-afia', 'auth-afia');

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mensah')::text, true);
insert into public.task_events (task_id, actor_id, event_type, metadata)
values ('11111111-1111-1111-1111-111111111111', :'mensah', 'comment', '{"body": "On it"}'::jsonb);
commit;

select test.sees(format('select 1 from public.notifications where user_id = %L and category = ''comments''', :'afia'),
  1, 'a comment is recorded for the other participant');
select test.ok(
  (select body from public.notifications order by created_at desc limit 1) = 'Send the Ecobank document',
  'and the comment''s text never leaves the task it belongs to');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'mensah'), 0,
  'the person who commented hears nothing about their own comment');

truncate net.captured;
delete from public.notifications;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mensah')::text, true);
insert into public.task_events (task_id, actor_id, event_type)
values ('11111111-1111-1111-1111-111111111111', :'mensah', 'completed');
commit;
select test.ok(
  (select title from public.notifications order by created_at desc limit 1) = 'Mensah completed a task',
  'completing a task is recorded for the person who asked');

-- ===========================================================================
-- Group tasks reach every other member.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
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
select test.sees('select 1 from public.notifications', 2, 'a group task is recorded for the other two members');
select test.sees(format('select 1 from public.notifications where user_id = %L', :'afia'), 0,
  'and not for the member who created it');

-- ===========================================================================
-- Overdue: once per task, however often the sweep runs.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
update public.tasks set due_date = now() - interval '2 days', status = 'active'
where id = '11111111-1111-1111-1111-111111111111';

select test.ok(public.notify_overdue_tasks() = 1, 'the sweep finds one overdue task');
select test.sees('select 1 from public.notifications', 1, 'and records it once');
select test.ok(public.notify_overdue_tasks() = 0, 'a second run finds nothing');

-- Even with the stamp cleared, the dedupe key stops a repeat.
update public.tasks set overdue_notified_at = null where id = '11111111-1111-1111-1111-111111111111';
select test.ok(public.notify_overdue_tasks() = 1, 'the sweep runs again after the stamp is lost');
select test.sees('select 1 from public.notifications', 1,
  'but the same task is still only announced once (dedupe_key)');

-- ===========================================================================
-- The inbox belongs to its owner, and is a record rather than a notepad.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'mensah')::text, true);
select test.sees('select 1 from public.notifications', 1, 'I see my own notifications');
select test.allows(
  'update public.notifications set read_at = now() where read_at is null',
  'and can mark them read');
select test.refuses(
  'update public.notifications set title = ''Rewritten''',
  'but cannot rewrite what one says');
select test.refuses(
  format('insert into public.notifications (user_id, category, title) values (%L, ''pokes'', ''Fake'')', :'mensah'),
  'nor invent one for myself');
select test.refuses(
  format('insert into public.notifications (user_id, category, title) values (%L, ''pokes'', ''Fake'')', :'afia'),
  'nor for anybody else');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'nana')::text, true);
select test.sees('select 1 from public.notifications', 0, 'an unrelated user sees none of mine');
rollback;

-- ===========================================================================
-- Subscriptions are private, and cannot be pointed at someone else's events.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'nana')::text, true);
select test.sees('select 1 from public.push_subscriptions', 1, 'I see only my own subscription');
select test.refuses(
  format('insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (%L, ''https://push.example.test/steal'', ''k'', ''a'')', :'afia'),
  'I cannot subscribe a browser to someone else''s notifications');
select test.allows(
  'delete from public.push_subscriptions',
  'and I can revoke my own');
rollback;

-- ===========================================================================
-- With nothing configured, the record is still kept.
-- ===========================================================================
truncate net.captured;
delete from public.notifications;
delete from vault.decrypted_secrets;

select test.ok(
  public.notify(:'mensah', 'pokes', 'Unconfigured', 'still recorded') is not null,
  'a notification is recorded on a database with no push secrets');
select test.sees('select 1 from net.captured', 0, 'and nothing is sent');
