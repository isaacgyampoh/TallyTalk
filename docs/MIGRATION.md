# Leaving Supabase, if and when

_Written 20 October 2026. Nothing here has been done; this is what it would
take, and what to avoid doing in the meantime._

## How tightly coupled are we, actually

Less than it looks. Thirteen files touch the Supabase client, and **none of them
is a screen or a component**:

| Where | Files | What they use |
| --- | --- | --- |
| `src/data/*` | 8 | Queries, mutations, Realtime subscriptions |
| `src/context/AuthContext.tsx` | 1 | Phone OTP, session, sign-out |
| `src/lib/{push,webpush,telemetry}.ts` | 3 | Subscriptions, crash rows |

Screens call hooks; hooks call `src/data`; `src/data` is the only place that
knows what a database is. That boundary is the single most valuable thing for a
future move, and it is worth defending in review.

The schema itself is **plain PostgreSQL**: 16 tables, 53 policies, 30
functions, 15 triggers. Row-Level Security is a Postgres feature, not a
Supabase one. It runs unchanged on Neon, RDS, Cloud SQL or a machine you rent.

## What is genuinely Supabase-shaped

| Feature | Used for | What replaces it |
| --- | --- | --- |
| **GoTrue** (`auth.users`, `auth.uid()`) | Phone OTP sign-in; every policy reads `auth.uid()` | Any auth service that can issue a JWT with `sub`. The policies keep working if the replacement sets `request.jwt.claims` the way PostgREST does — otherwise `auth.uid()` becomes a one-line shim over your own session mechanism |
| **PostgREST** | The client talks to the database directly over REST | Self-host PostgREST (same API, no rewrite), or put a small API service in front and change `src/data/*` only |
| **Realtime** | Live task spaces (`useTaskRealtime`, `useSpaceRealtime`) | Postgres `LISTEN/NOTIFY` plus a websocket, or polling. Two call sites |
| **pg_net** | Triggers calling `send-notification` | `LISTEN/NOTIFY` with a small worker, or an outbox table polled by a job. The trigger logic stays; only the last line changes |
| **pg_cron** | `overdue-sweep`, daily | Any scheduler — a GitHub Action calling an endpoint is enough |
| **Vault** | `project_url`, `send_push_secret` | Environment variables wherever the worker runs |
| **Storage** | `avatars`, `group-photos`, `attachments` buckets and their path-scoped policies | S3-compatible storage (R2, S3, MinIO) with signed URLs. `src/data/attachments.ts` and `profile.ts` are the only callers |
| **Edge Functions** | `send-notification`, `delete-account`, `send-sms-hook` | Any serverless or long-running Node/Deno service. They are three small HTTP handlers with no Supabase-specific code beyond reading rows over REST |

## What a move would look like

1. **Take the schema with you.** `supabase/migrations/*.sql` apply to any
   PostgreSQL once the `auth` and `storage` schemas exist. `supabase/tests/`
   already proves this: it creates both from scratch in `00_shim.sql` and runs
   the whole suite against a throwaway cluster. That harness is, in effect, a
   rehearsal of the migration.
2. **Decide about auth first.** It is the only piece that touches every policy.
   Keeping a JWT with a `sub` claim and a `request.jwt.claims` setting means the
   53 policies need no edits at all.
3. **Replace the API surface.** Self-hosting PostgREST is the smallest step:
   `src/data/*` keeps working with a different base URL. Writing your own API
   means rewriting those eight files — and nothing above them.
4. **Move the data.** `pg_dump` / `pg_restore`. Storage objects copy separately;
   paths are already structured (`avatars/<user id>/…`,
   `attachments/<task id>/…`), so a sync tool is enough.
5. **Re-point the side-effects:** the three functions, the cron job, the pg_net
   call, and the secrets they read.

## What not to do in the meantime

- **No ORM, no repository abstraction layer, no second service** added for a
  move that may not happen. The `src/data` boundary already gives the benefit
  an abstraction would, without the cost.
- **Don't let Supabase calls spread into screens.** That is the one change that
  would make this genuinely expensive later.
- **Keep business rules in SQL and in `src/data`, not in the client.** The
  database tests exercise them without a provider in sight.
- **Don't adopt Supabase-only conveniences lightly.** Declarative storage
  transforms, `supabase-js` auth helpers in components, or generated types tied
  to the hosted project would each add a thread to cut later.

## Rough effort

Assuming the schema moves unchanged and PostgREST is self-hosted rather than
replaced: the work is auth, storage, the three functions, the scheduler and the
Realtime call sites. It is a week of careful work, not a rewrite — and most of
it is infrastructure rather than application code. Doing anything now to
"prepare" would cost more than it saves.
