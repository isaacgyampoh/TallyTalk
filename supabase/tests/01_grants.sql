-- ============================================================================
-- Table privileges, which a hosted Supabase project grants by default (the
-- `postgres` role's default privileges cover anon/authenticated/service_role).
-- Applied after the migrations so new tables are included.
--
-- These are privileges, not policies: RLS still decides every row. Granting
-- them here is what makes a denial in the tests a *policy* denial rather than
-- a missing GRANT.
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all tables    in schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on auth.users to service_role;
grant select on auth.users to authenticated;

-- The push triggers run as the user who wrote the row and call net.http_post
-- through a SECURITY DEFINER function; in a hosted project `net` is reachable
-- the same way.
grant usage on schema net, vault to authenticated, service_role;
grant select, insert on net.captured to authenticated, service_role;
grant usage, select on all sequences in schema net to authenticated, service_role;
