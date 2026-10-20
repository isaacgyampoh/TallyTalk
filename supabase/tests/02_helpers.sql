-- ============================================================================
-- A very small assertion vocabulary, so a test file reads as statements of
-- fact and a failure says which fact broke.
--
-- Every helper raises on failure, and the runner stops on the first error.
-- Passes print `ok — <label>`, which is what the runner counts.
-- ============================================================================
create schema if not exists test;

-- The assertions run as `authenticated` and `anon`, so those roles need to be
-- able to call them.
grant usage on schema test to anon, authenticated, service_role;

create or replace function test.ok(condition boolean, label text) returns void
language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAIL — %', label;
  end if;
  raise notice 'ok — %', label;
end
$$;

/** The number of rows the current role can see from `query`. */
create or replace function test.visible(query text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute format('select count(*) from (%s) q', query) into n;
  return n;
end
$$;

create or replace function test.sees(query text, expected bigint, label text) returns void
language plpgsql as $$
declare
  n bigint := test.visible(query);
begin
  if n <> expected then
    raise exception 'FAIL — % (saw % row(s), expected %)', label, n, expected;
  end if;
  raise notice 'ok — %', label;
end
$$;

/**
 * `statement` must be refused. Row-level security, a CHECK, or a trigger all
 * count — what matters is that the database, not the client, says no.
 */
create or replace function test.refuses(statement text, label text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception
    when others then
      raise notice 'ok — % (%)', label, substr(replace(sqlerrm, E'\n', ' '), 1, 70);
      return;
  end;
  raise exception 'FAIL — % was allowed', label;
end
$$;

/**
 * `statement` must run but change nothing.
 *
 * This is the shape most RLS denials actually take: a row excluded by a USING
 * clause is not visible to the UPDATE or DELETE, so the statement succeeds
 * against zero rows rather than raising. A test that expected an error here
 * would pass for the wrong reason the day the policy disappeared.
 */
create or replace function test.ignores(statement text, label text) returns void
language plpgsql as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL — % (changed % row(s))', label, n;
  end if;
  raise notice 'ok — %', label;
end
$$;

/** `statement` must be accepted. Catches a policy that is too tight. */
create or replace function test.allows(statement text, label text) returns void
language plpgsql as $$
begin
  execute statement;
  raise notice 'ok — %', label;
end
$$;

/**
 * Sign up a user the way GoTrue does, returning the id. The profile row
 * arrives via on_auth_user_created, which is itself worth asserting.
 */
create or replace function test.signup(phone text, display_name text) returns uuid
language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, phone, raw_user_meta_data)
  values (uid, phone, jsonb_build_object('display_name', display_name));
  return uid;
end
$$;

grant execute on all functions in schema test to anon, authenticated, service_role;
