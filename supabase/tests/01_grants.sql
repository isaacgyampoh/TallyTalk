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
