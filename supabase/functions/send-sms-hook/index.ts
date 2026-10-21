// TaskTally — Send SMS Hook (Supabase Auth Hook)
//
// Supabase Auth generates and verifies the OTP itself. This hook only handles
// *delivery*: Supabase POSTs the phone number plus the generated code here, and
// we hand it to Arkesel. Because Supabase still owns verification and session
// issuance, the client keeps using the standard
// supabase.auth.signInWithOtp({ phone }) / verifyOtp(...) calls, and there is
// no second authentication system to secure.
//
// Deploy:
//   supabase functions deploy send-sms-hook --no-verify-jwt
// Secrets (server-side only — never in the frontend .env):
//   supabase secrets set ARKESEL_API_KEY=xxxxx
//   supabase secrets set ARKESEL_SENDER_ID=Cambridge     (must be approved)
//   supabase secrets set SEND_SMS_HOOK_SECRET=v1,whsec_...  (from the hook config)
// Then in Dashboard → Authentication → Hooks, enable "Send SMS" and point it at
// this Edge Function; copy the generated secret into SEND_SMS_HOOK_SECRET.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import {
  configProblem,
  confirmSent,
  inBackground,
  readArkeselConfig,
  sendSms,
} from '../_shared/arkesel.ts'

const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_NAME = 'TaskTally'

interface HookPayload {
  user: { phone?: string }
  sms: { otp: string }
}

Deno.serve(async (req) => {
  try {
    const config = readArkeselConfig()
    const problem = configProblem(config)
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

    // The app's name, not the sender ID: a sender ID may be a short code, or
    // another brand entirely while TaskTally's own awaits approval.
    const message =
      `Your ${APP_NAME} code is ${sms.otp}. It expires in 10 minutes. Do not share it.`

    const result = await sendSms(config, phone, message)
    if (!result.accepted) {
      console.error('Arkesel send failed', result.status)
      recordFailure(`arkesel ${result.status}: ${result.detail}`)
      // Returning a non-2xx tells Supabase the OTP could not be delivered.
      return json({ error: { message: 'SMS provider rejected the request' } }, 502)
    }

    // Accepted is not the same as sent: an unapproved sender ID is taken with
    // a 200 and then held forever. Follow it up after answering — this is how
    // a real sign-in failed silently while every check we had said success.
    if (result.id) {
      inBackground(
        confirmSent(config, result.id).then((problem) =>
          problem ? recordFailure(problem) : undefined,
        ),
      )
    }

    return json({}, 200)
  } catch (err) {
    // Only the message. The error object can carry the request payload, and
    // that payload contains the one-time code.
    console.error('send-sms-hook error:', err instanceof Error ? err.message : 'unknown')
    return json({ error: { message: 'Hook failed to process request' } }, 500)
  }
})

/**
 * Record why a code could not be sent, where it can actually be read.
 *
 * Edge function logs need dashboard access, and on the free plan they are not
 * reachable through the Management API at all — so a failed sign-in was
 * invisible unless someone was watching the screen:
 *
 *   select created_at, message from public.client_errors
 *   where build_id = 'send-sms-hook' order by created_at desc;
 *
 * No phone number and no code: the recipient is a personal identifier and the
 * OTP is a credential. Only the provider's verdict. Never awaited on the
 * request path — GoTrue gives a hook a few seconds before `hook_timeout`, and
 * awaiting one more round trip turned an honest 502 into a timeout.
 */
function recordFailure(detail: string): void {
  if (!SUPABASE_URL || !SERVICE_ROLE) return
  inBackground(
    fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
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
    }),
  )
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
