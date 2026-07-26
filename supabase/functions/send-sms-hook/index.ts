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
const ARKESEL_SENDER_ID = Deno.env.get('ARKESEL_SENDER_ID') ?? 'TallyTalk'
const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
const ARKESEL_SMS_URL = 'https://sms.arkesel.com/api/v2/sms/send'

interface HookPayload {
  user: { phone?: string }
  sms: { otp: string }
}

Deno.serve(async (req) => {
  try {
    const raw = await req.text()

    // Verify the request really came from Supabase Auth (signed webhook).
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(HOOK_SECRET)
    const { user, sms } = wh.verify(raw, headers) as HookPayload

    const phone = user.phone
    if (!phone) {
      return json({ error: { message: 'No phone number on user' } }, 400)
    }

    const message = `Your ${ARKESEL_SENDER_ID} code is ${sms.otp}. It expires in a few minutes. Do not share it.`

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

    if (!res.ok) {
      const detail = await res.text()
      console.error('Arkesel send failed', res.status, detail)
      // Returning a non-2xx tells Supabase the OTP could not be delivered.
      return json({ error: { message: 'SMS provider rejected the request' } }, 502)
    }

    return json({}, 200)
  } catch (err) {
    console.error('send-sms-hook error', err)
    return json({ error: { message: 'Hook failed to process request' } }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
