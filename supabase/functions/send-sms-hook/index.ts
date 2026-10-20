// TallyTalk — Send SMS Hook (Supabase Auth Hook)
//
// Supabase Auth generates and verifies the OTP itself. This hook only handles
// *delivery*: Supabase POSTs the phone number + generated code here, and we
// forward it to Arkesel's SMS API. Because Supabase still owns verification and
// session issuance, the client keeps using the standard
// supabase.auth.signInWithOtp({ phone }) / verifyOtp(...) calls.
//
// Deploy:
//   supabase functions deploy send-sms-hook --no-verify-jwt
// Secrets (server-side only — never in the frontend .env):
//   supabase secrets set ARKESEL_API_KEY=xxxxx
//   supabase secrets set ARKESEL_SENDER_ID=TallyTalk
//   supabase secrets set SEND_SMS_HOOK_SECRET=v1,whsec_...   (from the hook config)
// Then in Dashboard → Authentication → Hooks, enable "Send SMS" and point it at
// this Edge Function; copy the generated secret into SEND_SMS_HOOK_SECRET.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const ARKESEL_API_KEY = Deno.env.get('ARKESEL_API_KEY') ?? ''
const ARKESEL_SENDER_ID = Deno.env.get('ARKESEL_SENDER_ID') ?? ''
const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
const ARKESEL_SMS_URL = 'https://sms.arkesel.com/api/v2/sms/send'
const APP_NAME = 'TaskTally'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/**
 * Record why a code could not be sent, where it can actually be read.
 *
 * Edge function logs need dashboard access, and on the free plan they are not
 * reachable through the Management API at all — so a failed sign-in was
 * invisible unless someone was watching the screen. This puts the provider's
 * own words in `client_errors`, which is one SQL query away:
 *
 *   select created_at, message from public.client_errors
 *   where build_id = 'send-sms-hook' order by created_at desc;
 *
 * Deliberately no phone number and no code: the recipient is a personal
 * identifier and the OTP is a credential. Only the provider's verdict.
 *
 * Never awaited on the request path. GoTrue gives a hook a few seconds before
 * it gives up with `hook_timeout`, and this function has already spent some of
 * that talking to Arkesel — awaiting one more round trip turned an honest 502
 * into a timeout, which tells the user and the owner nothing.
 */
function recordFailure(detail: string): void {
  if (!SUPABASE_URL || !SERVICE_ROLE) return
  const write = fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      build_id: 'send-sms-hook',
      kind: 'edge',
      platform: 'web',
      message: detail.slice(0, 500),
    }),
  }).catch(() => {
    /* a failure to record a failure must not become a third failure */
  })

  // Keep the write alive after the response has gone back.
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime
  runtime?.waitUntil?.(write)
}

/**
 * Arkesel rejects a sender ID longer than 11 characters, and refuses one that
 * has not been approved for the account. Both fail the same way — a 200 with
 * a failure in the body — so catching it here turns a silent undelivered code
 * into a clear log line.
 */
function senderIdProblem(): string | null {
  if (!ARKESEL_API_KEY) return 'ARKESEL_API_KEY is not set'
  if (!ARKESEL_SENDER_ID) return 'ARKESEL_SENDER_ID is not set'
  if (ARKESEL_SENDER_ID.length > 11) {
    return `ARKESEL_SENDER_ID is ${ARKESEL_SENDER_ID.length} characters; Arkesel allows at most 11`
  }
  return null
}

interface HookPayload {
  user: { phone?: string }
  sms: { otp: string }
}

Deno.serve(async (req) => {
  try {
    const problem = senderIdProblem()
    if (problem) {
      console.error('send-sms-hook is not configured:', problem)
      recordFailure(`not configured: ${problem}`)
      return json({ error: { message: 'SMS is not configured' } }, 500)
    }

    const raw = await req.text()

    // Verify the request really came from Supabase Auth (signed webhook).
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(HOOK_SECRET)
    const { user, sms } = wh.verify(raw, headers) as HookPayload

    const phone = user.phone
    if (!phone) {
      return json({ error: { message: 'No phone number on user' } }, 400)
    }

    // The app's name, not the sender ID: a sender ID may be a short code or
    // something Arkesel approved that reads nothing like the product.
    const message = `Your ${APP_NAME} code is ${sms.otp}. It expires in 10 minutes. Do not share it.`

    const res = await fetch(ARKESEL_SMS_URL, {
      method: 'POST',
      headers: {
        'api-key': ARKESEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: ARKESEL_SENDER_ID,
        message,
        // Arkesel expects recipients without a leading "+".
        recipients: [phone.replace(/^\+/, '')],
      }),
    })

    // Arkesel answers 200 even when it refuses the message (bad sender ID, no
    // credit, invalid recipient) and puts the real outcome in the body, so a
    // status check alone would report undelivered codes as sent.
    const detail = await res.text()
    let accepted = res.ok
    if (accepted) {
      try {
        accepted = (JSON.parse(detail) as { status?: string }).status === 'success'
      } catch {
        accepted = false
      }
    }

    if (!accepted) {
      console.error('Arkesel send failed', res.status, detail)
      recordFailure(`arkesel ${res.status}: ${detail}`)
      // Returning a non-2xx tells Supabase the OTP could not be delivered.
      return json({ error: { message: 'SMS provider rejected the request' } }, 502)
    }

    return json({}, 200)
  } catch (err) {
    // Only the message. The error object can carry the request payload, and
    // that payload contains the one-time code.
    console.error('send-sms-hook error:', err instanceof Error ? err.message : 'unknown')
    return json({ error: { message: 'Hook failed to process request' } }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
