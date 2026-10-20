# Phone sign-in with Arkesel

_Status: prepared and deployed, waiting on credentials. Last checked 20 October 2026._

Supabase Auth (GoTrue) generates and verifies the one-time code itself. The
only thing we provide is delivery: Supabase signs a webhook to
`send-sms-hook`, and that function hands the message to Arkesel. Verification
and session issuance stay with Supabase, so the client keeps using the ordinary
`signInWithOtp({ phone })` and `verifyOtp(...)` calls and there is no parallel
authentication system to secure.

## What is already done

- `send-sms-hook` is deployed and ACTIVE.
- It posts to `https://sms.arkesel.com/api/v2/sms/send` with the `api-key`
  header and `{ sender, message, recipients }`, with the recipient in
  international format and no leading `+`, which is what Arkesel expects.
- It verifies the Supabase webhook signature before doing anything, so an
  unsigned request cannot make us send an SMS.
- It treats Arkesel's answer properly: Arkesel returns HTTP 200 even when it
  refuses a message — bad sender ID, no credit, bad recipient — and puts the
  real outcome in the body. The hook checks `status === "success"` and returns
  502 otherwise, so an undelivered code is never reported as sent.
- It fails closed when unconfigured: without an API key it answers
  "SMS is not configured" and sends nothing.
- It refuses a sender ID longer than 11 characters, which Arkesel rejects, and
  says so in the log rather than letting the send fail silently.
- **Nothing logs the code.** The error path logs only an error's message, never
  the payload, because the payload contains the OTP. The API key is never
  logged at all.
- The message names the app rather than the sender ID, since a sender ID may be
  a short code that reads nothing like the product.

## Settings corrected along the way

| Setting | Was | Now | Why |
| --- | --- | --- | --- |
| `sms_otp_exp` | 60s | 600s | A code that expires in a minute is unusable when delivery takes twenty seconds on a Ghanaian network, and the user then has to type it |
| `sms_max_frequency` | 5s | 60s | Every request costs money; five seconds between resends invites both abuse and accidental spend |

`sms_otp_length` stays at 6, and the project-wide cap `rate_limit_sms_sent`
stays at 30 per hour — low enough to bound the bill during a first launch, and
worth raising deliberately once real traffic justifies it.

## What is still needed from you

Two values, from the Arkesel dashboard:

1. **`ARKESEL_API_KEY`** — the account's API key.
2. **`ARKESEL_SENDER_ID`** — an approved sender ID, **11 characters or fewer**.
   An unapproved one is the usual reason Arkesel answers 200 and sends nothing.

Both are server-side only:

```bash
supabase secrets set ARKESEL_API_KEY='…' ARKESEL_SENDER_ID='…'
```

They must never appear in a `VITE_` variable, the client bundle, git, browser
storage or a log — a `VITE_` variable is compiled into the JavaScript every
visitor downloads.

Then, in the dashboard: **Authentication → Hooks → Send SMS**, enabled and
pointed at the `send-sms-hook` function. Copy the secret that screen generates
into `SEND_SMS_HOOK_SECRET`. Finally, **Authentication → Providers → Phone**,
enabled.

Until phone sign-in is switched on, the app answers "We can't send codes by
text right now. This is on our side, not yours" — deliberately, because a
half-enabled provider turns a clear failure into a vague one and starts
creating unconfirmed user rows for anyone who tries.

## The test plan for the day the keys arrive

Each of these is a real send to a real handset; none can be faked here.

1. **Delivery** — request a code on the live site, confirm it arrives, and
   confirm the sender ID shown on the phone is the approved one.
2. **Correct code** — sign in; confirm a profile row is created by the
   `on_auth_user_created` trigger with the phone number from the verified
   sign-in.
3. **Wrong code** — confirm the error says the code is wrong, and no session is
   issued.
4. **Expired code** — wait past ten minutes; confirm it is refused.
5. **Resend** — confirm the 60-second minimum is enforced and the message says
   how long to wait.
6. **Duplicate requests** — two taps in quick succession must not send two
   messages or charge twice.
7. **Provider failure** — temporarily set a bad sender ID; confirm the user
   sees our friendly message, the hook logs the Arkesel body, and no session is
   issued.
8. **Privacy** — read the function logs afterwards and confirm no code and no
   key appears in any of them.
9. **Sign out and back in** — confirm the device's push subscription is removed
   on sign-out and re-registered after the next sign-in.
