# Notifications, and why there is no Firebase

_Decided 20 October 2026. Supersedes the FCM design in migration 0005._

## The shape of it

Two things that used to be one:

| | What it is | What happens when it fails |
| --- | --- | --- |
| **The record** | A row in `public.notifications`, written by database triggers | Nothing fails. The row is the point. |
| **The delivery** | A Web Push message to a browser that subscribed | The person reads it in the app instead |

Everything notification-worthy becomes a row first: a new task, a poke, a
comment, a status change, an overdue sweep. The inbox reads those rows, so the
app tells you what happened whether or not any push arrived, whether or not you
granted permission, and whether or not your phone was on. Delivery is an
attempt to interrupt you, layered on top.

That split is what makes dropping Firebase possible without losing the feature.

## What was ruled out, and why

### Firebase Cloud Messaging

Excluded by instruction, and the reasons hold on their own: it needs a Google
project and a service-account key in our server, it ties the Android build to
Play Services, and it made a core feature depend on an account we would rather
not keep.

### Option A — Web Push (chosen for the web)

The W3C Push API with VAPID. The browser's own push service does delivery; we
hold an endpoint and two encryption keys, and sign each message with a key pair
that never leaves the server.

Where it works, per MDN's compatibility data: Chrome, Edge and Firefox on
desktop and on Android, and Safari on iOS 16.4+ **only once the site is added to
the Home Screen**. It does **not** work in an Android WebView.

No account, no SDK, no per-message cost. Chrome's push service happens to run
on Google infrastructure, but that is Chrome's business: we have no Firebase
project, no credential and no code from them.

### Option B — native Android push without Firebase

Investigated and **not adopted**.

- **UnifiedPush / ntfy.** Standards-based and genuinely Google-free, but the
  user must install a separate distributor app first, and keep it exempt from
  battery optimisation. For a consumer task app in the launch market, that is
  not a realistic first-run experience.
- **A self-hosted gateway with a persistent socket.** Means a foreground
  service, a permanent notification, measurable battery use, and OEM task
  killers that are aggressive on exactly the mid-range Android phones this app
  targets. It also means running and paying for a server that must stay up.

Neither can be claimed to match FCM's reliability, and nothing here pretends
otherwise. **The Capacitor Android build therefore receives no background
push.** It is not broken: it opens to an inbox that has everything.

### Option C — in-app inbox (chosen, as the backbone)

Implemented for every platform. `notifications` is durable and ordered, the
screen marks rows read, and the list is refetched while open. This is the only
part of the design that cannot fail quietly.

## So, concretely

| Where | Background alert | Inbox |
| --- | --- | --- |
| Chrome/Edge/Firefox, desktop or Android | ✅ Web Push | ✅ |
| Safari on iOS/iPadOS 16.4+, added to Home Screen | ✅ Web Push | ✅ |
| Safari in a tab (not installed) | ❌ | ✅ |
| **Capacitor Android APK** | ❌ WebView has no Push API | ✅ |

**If background alerts on the Android app matter more than avoiding Google**,
the honest options are: ship the Android experience as an installable PWA
(Chrome then delivers Web Push with no Firebase project of ours), or accept FCM
for the native build. Distributing as a PWA is the cheaper of the two and keeps
this architecture intact.

## Security properties

- A notification row is written only by `SECURITY DEFINER` triggers. A client
  cannot insert one, for themselves or anyone else.
- A client may change `read_at` and nothing else: a trigger rejects any other
  field, so the inbox stays a record of what happened rather than a notepad.
- `push_subscriptions` is own-only in both directions, so one account cannot
  subscribe a browser to another account's events.
- `dedupe_key` makes the pipeline idempotent: the same event announced twice —
  a retried write, a re-fired trigger, a second sweep — records and delivers
  once.
- Muting suppresses delivery, never the record.
- Payloads carry ids plus the task title the person typed. A comment's text
  never leaves the task it belongs to.
- The VAPID private key lives in Supabase function secrets; only the public
  half ships in the client, which is what it is for.
- Signing out deletes the subscription server-side **and** unsubscribes the
  browser, so the next person to use that device gets nothing.
- Blocking, group membership and task access are enforced by the same RLS the
  rest of the app uses — a notification cannot reach someone who could not see
  the underlying row.

## The pieces

```
tasks / task_events / pokes          ← a row is written
  └─ trigger (SECURITY DEFINER)
       └─ public.notify()            ← records, then decides whether to deliver
            ├─ notifications         ← the record (always)
            └─ pg_net → send-notification  ← delivery (if subscribed + unmuted)
                 └─ web-push (VAPID) → the browser's push service
                      └─ public/sw.js → showNotification → tap → route
```

`notify_overdue_tasks()` runs daily from pg_cron (`overdue-sweep`, 07:00 UTC).

## Testing it

- `supabase/tests/12_push.test.sql` — 42 assertions against a real PostgreSQL:
  who is recorded, who is not, muting, dedupe, the read-only guard,
  subscription ownership, and the exact request that would be sent.
- `src/lib/webpush.test.ts` — subscribe, unsubscribe, refused permission,
  rotation, key encoding.
- `src/data/notifications.test.ts` — the inbox queries.
- Hosted checks are run by hand against the live project; the last run is
  recorded in README.

## If you later want the native app to alert in the background

In rough order of effort: distribute as a PWA (no code change); adopt FCM for
the Android build only, keeping this inbox and Web Push for the web; or run a
UnifiedPush gateway and accept that users must install a distributor. The first
two leave `notifications` and `notify()` exactly as they are — only the last
step of the chain changes.
