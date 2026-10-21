// TaskTally — send-invite (Supabase Edge Function)
//
// One SMS inviting someone who is not on TaskTally yet. Called by the signed-in
// person who chose to send it, never automatically.
//
//   POST /functions/v1/send-invite
//   headers: { Authorization: 'Bearer <the caller's own access token>' }
//   body:    { "phone": "+233244123456" }
//
// What this deliberately does not do: tell the sender anything about the
// number. Not whether it is registered, not whether the invitation was read,
// not whether that person later signed up. Any of those would turn an
// invitation into a lookup tool for a stranger's phone number.
//
// The limits live in the database (public.may_invite) rather than here, so the
// client cannot move them and a second caller cannot bypass them.

import {
  configProblem,
  confirmSent,
  inBackground,
  readArkeselConfig,
  sendSms,
} from '../_shared/arkesel.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INVITE_URL = Deno.env.get('INVITE_URL') ?? 'https://tally-talk-iota.vercel.app'

/** What the sender is told. Each is true, and none reveals the recipient. */
const REFUSALS: Record<string, string> = {
  invalid: "That doesn't look like a phone number.",
  local: 'Include the country code, for example +233.',
  'daily-limit': "You've sent as many invitations as we allow in a day. Try again tomorrow.",
  'already-invited': 'You already invited this number today.',
  'number-limit': 'That number has had enough invitations for today.',
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

    // Who is asking? The token, never the body.
    const auth = req.headers.get('Authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE },
    })
    if (!who.ok) return json({ error: 'Unauthorized' }, 401)
    const user = (await who.json()) as { id?: string }
    if (!user.id) return json({ error: 'Unauthorized' }, 401)

    const { phone } = await req.json()
    if (typeof phone !== 'string') return json({ error: 'A phone number is required' }, 400)

    // Normalised here as well as on the client: the client's idea of a phone
    // number is a suggestion, and the limits below are counted per number.
    //
    // A local number — 0533547740 — is ambiguous without knowing the country,
    // and accepting it would file the same person under two different keys,
    // which is exactly how the per-number limit was first stepped over. The
    // app always sends a dial code; anything else is refused rather than
    // guessed at.
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('0')) {
      return json({ error: REFUSALS.local, reason: 'local' }, 400)
    }
    if (digits.length < 9 || digits.length > 15) {
      return json({ error: REFUSALS.invalid, reason: 'invalid' }, 400)
    }

    const verdict = await rpc<string>('may_invite', { who: user.id, digits })
    if (verdict !== 'ok') {
      return json({ error: REFUSALS[verdict ?? ''] ?? 'Not right now.', reason: verdict }, 429)
    }

    const config = readArkeselConfig()
    const problem = configProblem(config)
    if (problem) {
      console.error('send-invite is not configured:', problem)
      return json({ error: 'Invitations are unavailable right now.' }, 500)
    }

    const inviter = await rpc<string>('inviter_display_name', { who: user.id })
    // Kept inside one SMS segment, and it says what it is before the link.
    const message =
      `${inviter || 'Someone'} invited you to TaskTally — agree who owes what, ` +
      `and keep track. ${INVITE_URL}`

    const result = await sendSms(config, digits, message)
    if (!result.accepted) {
      console.error('Arkesel refused an invitation', result.status)
      await record(user.id, digits, false)
      await recordFailure(`invite: arkesel ${result.status}: ${result.detail}`)
      return json({ error: 'We could not send that invitation. Please try again later.' }, 502)
    }

    // `delivered` stays null until the provider says what became of it:
    // accepted is not sent, and a column that says "true" the moment Arkesel
    // takes the message would repeat the mistake that hid PENDING APPROVAL.
    const invitationId = await record(user.id, digits, null)

    if (result.id) {
      inBackground(
        confirmSent(config, result.id).then(async (problem) => {
          if (problem) {
            await recordFailure(`invite: ${problem}`)
            await markDelivered(invitationId, false)
          } else {
            await markDelivered(invitationId, true)
          }
        }),
      )
    }

    return json({ sent: true }, 200)
  } catch (err) {
    console.error('send-invite error:', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'Something went wrong sending that invitation.' }, 500)
  }
})

/** The invitation itself is the record — and what the rate limits count. */
async function record(
  inviter: string,
  digits: string,
  delivered: boolean | null,
): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sms_invitations`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ inviter, phone_digits: digits, delivered }),
    })
    if (!res.ok) return null
    return ((await res.json()) as { id?: string }[])[0]?.id ?? null
  } catch {
    // The send already happened; losing the record must not fail the request.
    return null
  }
}

/** What the provider eventually said, written back to the invitation. */
async function markDelivered(id: string | null, delivered: boolean): Promise<void> {
  if (!id) return
  await fetch(`${SUPABASE_URL}/rest/v1/sms_invitations?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ delivered }),
  }).catch(() => {})
}

/** Provider trouble, where the owner can read it (see send-sms-hook). */
async function recordFailure(detail: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      build_id: 'send-invite',
      kind: 'edge',
      platform: 'web',
      message: detail.slice(0, 500),
    }),
  }).catch(() => {})
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    console.error('rpc failed', fn, res.status, await res.text())
    return null
  }
  return (await res.json()) as T
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
