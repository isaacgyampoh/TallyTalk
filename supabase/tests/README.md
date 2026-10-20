# Database tests

```bash
npm run test:db            # all of them
npm run test:db -- 10_rls  # one file, by substring
```

Every security decision in this app lives in the database: Row-Level Security
decides who may read a task, and triggers make the writes the client is not
allowed to make itself. None of that can be verified from the client, and a
mocked Supabase client will agree with whatever the code expects — so these
tests apply the **real migrations** to a **real PostgreSQL** and then act as the
roles the app connects as.

`run.sh` creates a throwaway cluster in a temporary directory, listening on a
unix socket only. It never touches a Postgres you already run, it cannot reach
the hosted project, and it is deleted when the run ends.

## What is real, and what is not

Applied unchanged: `supabase/migrations/*.sql`, in order.

Faked, because they belong to the hosted platform rather than to us
(`00_shim.sql` says so in detail at each definition):

- `auth.users` — only the columns our migrations touch. Inserting a row is how
  a test simulates a sign-up, which is exactly what fires
  `on_auth_user_created`.
- `auth.uid()` / `auth.jwt()` / `auth.role()` — read `request.jwt.claims`, the
  same setting PostgREST sets per request.
- `storage.buckets`, `storage.objects`, `storage.foldername()` — enough of the
  Storage schema for its policies to mean what they say.
- the `anon`, `authenticated` and `service_role` roles, and the table grants a
  hosted project makes by default (`01_grants.sql`).
- an empty `supabase_realtime` publication for the migrations to add tables to.

Not covered here: PostgREST, GoTrue, the Storage API, Realtime, and the Edge
Functions. A passing run says the schema, the policies and the triggers behave
correctly — not that the deployed project is configured correctly.

## Writing a test

A file named `*.test.sql` is picked up automatically. Seed as the superuser
(RLS off), then take on an identity for each assertion:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'ama')::text, true);

select test.sees('select 1 from public.tasks', 1, 'the assignee can see the task');
rollback;
```

`set local role` has to be a top-level statement — a `SET` inside a function is
undone when the function returns — and `set_config(..., true)` keeps the
identity inside the transaction, so one block cannot leak into the next.

The vocabulary (`02_helpers.sql`):

| Helper | Asserts |
| --- | --- |
| `test.ok(cond, label)` | the condition holds |
| `test.sees(query, n, label)` | the current role can see exactly `n` rows |
| `test.allows(sql, label)` | the statement is accepted |
| `test.refuses(sql, label)` | the statement is rejected — by RLS, a CHECK or a trigger |
| `test.ignores(sql, label)` | the statement runs but changes nothing |
| `test.signup(phone, name)` | creates an `auth.users` row, returns its id |

`refuses` and `ignores` are not interchangeable. A row hidden by a `USING`
clause is invisible to an `UPDATE` or `DELETE`, so the statement succeeds
against zero rows instead of raising: asserting an error there would pass for
the wrong reason the day the policy vanished.

## What this has already caught

`0004_policies_can_see_what_they_check.sql` exists because of these tests. Two
policies read `public.contacts` with an inline sub-select, which runs as the
caller — so `contacts_all_own` hid the very rows being checked. Blocking did
nothing at all, and being added by someone did not let you see their name. The
mock-based tests passed throughout.
