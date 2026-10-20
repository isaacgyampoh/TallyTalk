// TallyTalk — send-push (Supabase Edge Function)
//
// Sends a push notification to every device a user has registered. Uses Firebase
// Cloud Messaging (FCM) HTTP v1, which delivers to Android directly and to iOS
// via an APNs key uploaded to your Firebase project.
//
// Call it from your app/backend (e.g. after a Poke or when a task goes overdue):
//   POST /functions/v1/send-push
//   headers: { Authorization: 'Bearer <SEND_PUSH_SECRET>' }
//   body: { "userId": "...", "title": "You've been poked", "body": "Ben nudged: Send the report", "data": { "url": "/contacts/ben" } }
//
// Secrets (server-side only):
//   supabase secrets set FCM_SERVICE_ACCOUNT='<the full service-account JSON>'
//   supabase secrets set SEND_PUSH_SECRET='<a long random string>'
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform)
//
// STATUS: Firebase project task-tally-77b90 is configured and the app ships with
// FCM enabled. This function is ready to deploy — set the two secrets below and
// run `supabase functions deploy send-push`. Push delivers once a real user is
// signed in (so their device token is stored in push_tokens).

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

const SEND_PUSH_SECRET = Deno.env.get('SEND_PUSH_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/** Length-independent compare, so a wrong secret leaks nothing through timing. */
function secretMatches(presented: string): boolean {
  const expected = `Bearer ${SEND_PUSH_SECRET}`
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!SEND_PUSH_SECRET || !secretMatches(auth)) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { userId, title, body, data, category } = await req.json()
    if (!userId || !title) return json({ error: 'userId and title are required' }, 400)
    // userId lands in a PostgREST query string below; only ever accept a uuid.
    if (typeof userId !== 'string' || !UUID.test(userId)) {
      return json({ error: 'userId must be a uuid' }, 400)
    }

    const account = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}') as ServiceAccount
    if (!account.private_key) return json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, 500)

    // A muted category is not an error: the send simply does not happen.
    if (category && !(await categoryWanted(userId, category))) {
      return json({ sent: 0, note: `User has muted "${category}"` }, 200)
    }

    const tokens = await getTokens(userId)
    if (tokens.length === 0) return json({ sent: 0, note: 'No devices registered' }, 200)

    const accessToken = await getAccessToken(account)
    const results = await Promise.all(
      tokens.map((t) =>
        sendToToken(account.project_id, accessToken, t, title, body ?? '', data, category),
      ),
    )
    const sent = results.filter((r) => r.ok).length

    // A device that has been wiped, or had the app removed, keeps its row
    // forever otherwise — and every later send pays for it. FCM tells us which
    // tokens are dead; drop exactly those, and never a token that failed for
    // some other reason.
    const dead = results.filter((r) => r.stale).map((r) => r.token)
    if (dead.length > 0) await forgetTokens(userId, dead)

    return json({ sent, total: tokens.length, forgotten: dead.length }, 200)
  } catch (err) {
    console.error('send-push error', err)
    return json({ error: 'Failed to send' }, 500)
  }
})

async function getTokens(userId: string): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}&select=token`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  )
  if (!res.ok) return []
  const rows = (await res.json()) as { token: string }[]
  return rows.map((r) => r.token)
}

/** Does this user still want this category? Absent prefs means yes. */
async function categoryWanted(userId: string, category: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=notification_prefs`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  )
  if (!res.ok) return true // never swallow a notification because a lookup failed
  const rows = (await res.json()) as { notification_prefs: Record<string, boolean> | null }[]
  const prefs = rows[0]?.notification_prefs
  return !prefs || prefs[category] !== false
}

interface SendResult {
  token: string
  ok: boolean
  /** The token is gone for good — the app was uninstalled, or the device wiped. */
  stale: boolean
}

async function sendToToken(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  category?: string,
): Promise<SendResult> {
  // The data payload carries ids only — never content. It is what the app reads
  // to open the right screen, and notification payloads are not a safe place
  // for anything protected.
  const payload = { ...(data ?? {}), ...(category ? { category } : {}) }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: payload,
        // The channel must match one created by the client, or Android 8+
        // drops the notification silently.
        android: category ? { notification: { channel_id: category } } : undefined,
      },
    }),
  })
  if (res.ok) return { token, ok: true, stale: false }

  const detail = await res.text()
  console.error('FCM send failed', res.status, detail)
  return { token, ok: false, stale: isGone(res.status, detail) }
}

/**
 * Is this failure the token's fault, permanently?
 *
 * Only UNREGISTERED (404) and an explicitly invalid registration token count.
 * A 400 for a malformed message, a 401 for a bad service account or a 503 from
 * FCM are our problems, and deleting a live token over one would silence a user
 * until they reinstalled the app.
 */
function isGone(status: number, detail: string): boolean {
  if (status === 404) return true
  if (status !== 400) return false
  return /UNREGISTERED|not a valid FCM registration token|registration-token-not-registered/i.test(
    detail,
  )
}

async function forgetTokens(userId: string, tokens: string[]): Promise<void> {
  const list = tokens.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(userId)}` +
      `&token=in.(${encodeURIComponent(list)})`,
    {
      method: 'DELETE',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    },
  )
  if (!res.ok) console.error('Could not forget stale tokens', res.status, await res.text())
}

// --- Google service-account OAuth (RS256 JWT -> access token) ---
async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))
  const unsigned = `${enc(header)}.${enc(claim)}`
  const key = await importPrivateKey(account.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tok = (await res.json()) as { access_token?: string }
  if (!tok.access_token) throw new Error('Failed to obtain Google access token')
  return tok.access_token
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
