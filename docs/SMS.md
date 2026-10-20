# Phone sign-in with Arkesel

_Status: configured and switched on. Every step is verified except delivery to
a real handset, which needs a phone. Last checked 20 October 2026._

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

## What is configured

| | |
| --- | --- |
| `ARKESEL_API_KEY` | Set, and **verified against Arkesel** with a read-only balance call: HTTP 200, account "Emmanuel Dzotsi", Ghana |
| `SEND_SMS_HOOK_SECRET` | Generated and set on both sides |
| Auth hook | `hook_send_sms_enabled = true`, pointed at `send-sms-hook` |
| `ARKESEL_SENDER_ID` | Set to `tasktally` |
| Phone provider | **On** |

Both gates were then checked against the deployed function, without sending
anything: with no sender ID it answers "SMS is not configured" before touching
Arkesel, and with one set an unsigned request is refused by the webhook
signature check. A placeholder sender ID was removed afterwards so the hook
stays fail-closed.

No secret is in a `VITE_` variable, the client bundle, git or a log — a `VITE_`
variable is compiled into the JavaScript every visitor downloads.

## What has been verified end to end

Requesting a code for an unroutable number (`+233000000000`) walks the whole
chain without any phone being able to receive anything:

1. GoTrue accepts the request — phone sign-in is on, no more
   `phone_provider_disabled`.
2. It generates the OTP and calls the hook.
3. The hook **verifies the webhook signature** — a 502 back means it got past
   that; an unsigned request gets 500 instead.
4. The hook reaches **Arkesel**, which refuses the invalid recipient.
5. The hook turns that into a 502, so a failed delivery is never reported as a
   sent code.
6. The app shows "We can't send codes by text right now. This is on our side,
   not yours", keeps the number typed in, and stays on the same step.

Unconfirmed user rows created by those attempts were deleted afterwards; the
database is empty again.

## What is still needed from you

**A phone you are holding.** Enter its number on
https://tally-talk-iota.vercel.app/signin and tell me what happens. That one
send answers the two questions nothing else can:

- whether `tasktally` is approved as a sender ID on the Arkesel account, and
- whether the account's SMS balance allows a send at all.

If the code arrives, phone sign-in is done. If it does not, the failure is now
legible: the hook logs Arkesel's exact refusal, and the user-facing message
stays honest either way.

## One thing to check on the account

The balance call answers:

```json
{"data":{"sms_balance":0,"main_balance":"GHS 1107.364"},"status":"success"}
```

The wallet has money in it, but the SMS balance reads **0** — and Arkesel's v1
endpoint agrees (`"balance":0`). Their public documentation does not explain
how the two relate, and third-party clients suggest the account can hold
separate balances for SMS and for OTP sends.

I have not guessed which applies here, because the only way to find out is a
real send. If the first attempt comes back refused for insufficient balance,
the fix is in the dashboard — buy SMS units with the money already there — and
not in this code. The hook already treats that case correctly: Arkesel answers
HTTP 200 with the refusal in the body, and the hook returns 502 so a failed
delivery is never reported as a sent code.

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
