-- ============================================================================
-- TaskTally — somewhere for a crash to land
-- Run after 0005_notifications_have_a_caller.sql.
--
-- The app's error boundary showed a recovery screen and told nobody. A crash on
-- a handset in Accra was invisible here, which means the first report of any
-- bug is a user who gives up.
--
-- Reports go into this database rather than to a third-party service, for two
-- reasons: nothing new has to be disclosed to users as a separate processor
-- (the Privacy Policy says so), and no reporting SDK lands in a bundle that has
-- to download over a mobile connection. The client writes through a narrow,
-- insert-only table; `src/lib/telemetry.ts` owns what is allowed into it.
--
-- Read them with:
--   select created_at, build_id, platform, route, message, count(*)
--   from public.client_errors
--   group by 1,2,3,4,5 order by created_at desc;
-- ============================================================================

create table public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  -- Null for a crash before sign-in, which is when the worst ones happen.
  user_id     uuid references public.profiles (id) on delete set null,
  build_id    text not null check (char_length(build_id) <= 64),
  app_version text check (char_length(app_version) <= 32),
  platform    text check (platform in ('web', 'ios', 'android')),
  -- The in-app path, never a full URL: a URL can carry ids that belong to
  -- somebody else's screen.
  route       text check (char_length(route) <= 200),
  -- 'edge' is a server-side call that failed where the user was waiting for
  -- it: a silently failed account deletion is a legal problem, not a nuisance.
  kind        text not null check (kind in ('render', 'uncaught', 'rejection', 'edge')),
  message     text not null check (char_length(message) between 1 and 500),
  stack       text check (char_length(stack) <= 4000),
  created_at  timestamptz not null default now()
);

create index client_errors_recent_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Write-only, deliberately.
--
-- A crash report has to be sendable by a client that may not be signed in, so
-- `anon` can insert. Nothing can read the table back: there is no select
-- policy, so only the service role and the SQL editor see it. A signed-in
-- client may only attribute a report to itself, which keeps the column from
-- being used to blame another account.
create policy client_errors_insert on public.client_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- The column sizes above are the real guard against someone filling the table
-- with junk: a report is at most ~4.7 KB, and nothing here is readable, so
-- there is no information to be gained by writing to it.

-- ---------------------------------------------------------------------------
-- Retention. The Privacy Policy says a crash report is kept for up to 30 days
-- and then deleted, so that has to happen without anyone remembering to do it.
--
-- The purge runs on insert rather than on a schedule: reports arrive exactly
-- when there is something to clean up, and this way the promise holds on a
-- project with no pg_cron enabled. The index on created_at keeps it cheap.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_crash_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.client_errors where created_at < now() - interval '30 days';
  return null;
end
$$;

drop trigger if exists client_errors_purge on public.client_errors;
create trigger client_errors_purge
  after insert on public.client_errors
  for each statement execute function public.purge_old_crash_reports();

-- As a backstop, so a table that stops receiving reports still empties:
--   select cron.schedule('crash-purge', '30 3 * * *',
--     $$delete from public.client_errors where created_at < now() - interval '30 days'$$);
