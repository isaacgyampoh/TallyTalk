-- ============================================================================
-- Crash reports (0006): write-only, attributable only to yourself, and
-- self-purging, because the Privacy Policy promises all three.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233270000001', 'Akosua') as ak \gset ak_
select test.signup('+233270000002', 'Yoofi')  as yo \gset yo_
\set akosua :ak_ak
\set yoofi  :yo_yo

-- ===========================================================================
-- A crash before sign-in still reaches us — that is when the worst ones happen.
-- ===========================================================================
begin;
set local role anon;
select test.allows(
  $$insert into public.client_errors (build_id, kind, message, platform, route)
    values ('build-1', 'uncaught', 'Cannot read properties of undefined', 'android', '/signin')$$,
  'a signed-out client can report a crash');
select test.sees('select 1 from public.client_errors', 0,
  'and cannot read a single report back, including its own');
commit;

-- ===========================================================================
-- A signed-in client may only blame itself.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'akosua')::text, true);
select test.allows(
  format($$insert into public.client_errors (user_id, build_id, kind, message)
           values (%L, 'build-1', 'render', 'boom')$$, :'akosua'),
  'I can attribute my own crash to me');
select test.refuses(
  format($$insert into public.client_errors (user_id, build_id, kind, message)
           values (%L, 'build-1', 'render', 'not mine')$$, :'yoofi'),
  'I cannot file a crash against someone else''s account');
select test.sees('select 1 from public.client_errors', 0,
  'nobody can read the table, however signed in they are');
commit;

-- ===========================================================================
-- The column limits are the guard against the table being used as storage.
-- ===========================================================================
begin;
set local role anon;
select test.refuses(
  $$insert into public.client_errors (build_id, kind, message)
    values ('build-1', 'render', repeat('x', 501))$$,
  'an oversized message is refused');
select test.refuses(
  $$insert into public.client_errors (build_id, kind, message, stack)
    values ('build-1', 'render', 'boom', repeat('x', 4001))$$,
  'so is an oversized stack');
select test.refuses(
  $$insert into public.client_errors (build_id, kind, message)
    values ('build-1', 'nonsense', 'boom')$$,
  'and an unknown kind of report');
commit;

-- ===========================================================================
-- Retention, which the Privacy Policy promises happens by itself.
-- ===========================================================================
-- Seed an old report with the purge off, so there is something to purge. (With
-- it on, the insert cleans up its own row — correct, but it proves nothing.)
alter table public.client_errors disable trigger client_errors_purge;
insert into public.client_errors (build_id, kind, message, created_at)
values ('old-build', 'render', 'from last quarter', now() - interval '31 days');
alter table public.client_errors enable trigger client_errors_purge;

select test.ok(
  (select count(*) from public.client_errors where message = 'from last quarter') = 1,
  'an old report starts out present');

begin;
set local role anon;
insert into public.client_errors (build_id, kind, message)
values ('build-2', 'render', 'today''s crash');
commit;

select test.ok(
  (select count(*) from public.client_errors where message = 'from last quarter') = 0,
  'a new report purges anything past 30 days (client_errors_purge)');
select test.ok(
  (select count(*) from public.client_errors where message = 'today''s crash') = 1,
  'and keeps the recent ones');

-- ===========================================================================
-- Deleting an account unlinks its reports rather than deleting the evidence.
-- ===========================================================================
insert into public.client_errors (user_id, build_id, kind, message)
values (:'yoofi', 'build-3', 'render', 'before deletion');
delete from public.profiles where id = :'yoofi';
select test.ok(
  (select count(*) from public.client_errors where message = 'before deletion' and user_id is null) = 1,
  'the report survives the account, with nobody attached to it');
