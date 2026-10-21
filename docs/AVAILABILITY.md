# Running on Supabase Free: what that actually means

_Checked against Supabase's docs on 20 October 2026._

## The limits we are inside

| | Free plan | Where we are |
| --- | --- | --- |
| Database | 500 MB | Empty (0 users) |
| File storage | 1 GB | Effectively empty |
| Monthly active users | 50,000 | 0 |
| Active projects | 2 per organisation | 1 is TaskTally |
| Daily backups / point-in-time recovery | None | — |
| Pausing | After about a week of low activity | Has happened twice |

No payment method is on file, which means no overage charges — and also that
hitting a limit stops the service rather than billing for it.

### What that means for files people send

Every bucket now has a server-side size and type limit, set in migration 0012,
so the storage service refuses an oversized or disallowed file before a byte
reaches a policy:

| Bucket | Limit | Accepts |
| --- | --- | --- |
| `message-files` | 10 MB | images, PDF, Word, Excel, CSV, plain text |
| `attachments` (task files) | 10 MB | the same, plus recorded audio |
| `avatars`, `group-photos` | 5 MB | images only |

10 MB a file is roughly a hundred documents inside the free plan's 1 GB, which
suits scanned invoices, receipts and photographs — and is deliberately too
small for video. Raising it is a plan decision, not a code one: the numbers
live in `0012` and in `src/data/messageFiles.ts`, which are kept in step.

## The pause, precisely

Supabase's docs say a Free project is flagged when it "does not receive
sufficient user database activity over the past week", that a few requests a
day is enough to avoid it, and that you get a warning email about a week
beforehand. A paused project keeps its data and configuration and comes back as
it was. The restore window is stated as **up to 1 year** in the body of the
current docs, though a heading on the same page still says 90 days — treat the
shorter figure as the safe one.

This has already happened to this project twice, for the reason the backlog card
describes: no users, because sign-in is not live yet; no activity, because no
users.

**We do not run synthetic keep-alive traffic.** Scheduled pings exist to
circumvent a pause policy rather than to serve anyone, and a project kept alive
that way still has no backups. The real answers are a paid plan before launch,
or real users after it.

## What a pause looks like from the app

The hostname stops resolving, so every request fails at the network layer. That
is the same failure as a phone with no signal, and the app treats it that way:

- The marketing page, sign-in and both legal pages are static and keep working.
- A connection notice appears, and clears by itself when the network returns.
- Asking for a sign-in code answers "We can't reach the server right now. Check
  your connection and try again", with the number still typed in.
- Nothing renders the error-boundary screen, and no screen goes blank.
- A screen still downloading when the connection drops retries and reloads
  rather than dying (`src/lib/retryImport.ts`).
- Anything typed — a comment, a quick-add sentence — stays on screen until the
  write actually succeeds.

Four end-to-end tests hold that behaviour in place, with every request to
Supabase aborted at the browser (`e2e/app.spec.ts`, "when the backend is
unreachable").

What does **not** work while paused: signing in, and anything behind it. There
is no offline write queue, and adding one would mean inventing conflict rules
for a shared ledger that two people can both change. The inbox and task history
come back intact when the project does, because they live in the database
rather than in a push that was never delivered.

## Recovering a paused project

1. supabase.com → the organisation → the project → **Resume**. It takes a few
   minutes and returns to its previous state.
2. Or, with a personal access token:

   ```bash
   curl -X POST "https://api.supabase.com/v1/projects/<ref>/restore" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" -d '{}'
   ```

   Then poll `GET /v1/projects/<ref>` until `status` is `ACTIVE_HEALTHY`
   (`COMING_UP` → `RESTORING` → `ACTIVE_HEALTHY`, about four minutes last time).

3. Check that nothing was missed while it was down:

   ```sql
   select * from cron.job;                     -- the overdue sweep is scheduled
   select name from vault.secrets;             -- project_url, send_push_secret
   select count(*) from net._http_response;    -- pg_net is processing again
   ```

   The overdue sweep is idempotent — `overdue_notified_at` plus the
   `dedupe_key` on each notification — so a missed run announces each task
   once, not again.

## What we promise users

The Terms say the service is provided as it is and that we do not promise it
will always be available. That is accurate on this plan, and should not be
softened while it stays on it.

## Before launch

Decide between a paid plan — which stops the pausing and brings daily backups,
worth having before the first real user arrives — and staying free with the
understanding that the project can pause and has no backups. That is a cost
decision, not an engineering one, which is why it is still open.
