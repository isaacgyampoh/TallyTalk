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

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!SEND_PUSH_SECRET || auth !== `Bearer ${SEND_PUSH_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { userId, title, body, data } = await req.json()
    if (!userId || !title) return json({ error: 'userId and title are required' }, 400)

    const account = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}') as ServiceAccount
    if (!account.private_key) return json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, 500)

    const tokens = await getTokens(userId)
    if (tokens.length === 0) return json({ sent: 0, note: 'No devices registered' }, 200)

    const accessToken = await getAccessToken(account)
    const results = await Promise.all(
      tokens.map((t) => sendToToken(account.project_id, accessToken, t, title, body ?? '', data)),
    )
    const sent = results.filter(Boolean).length
    return json({ sent, total: tokens.length }, 200)
  } catch (err) {
    console.error('send-push error', err)
    return json({ error: 'Failed to send' }, 500)
  }
})

async function getTokens(userId: string): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${userId}&select=token`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  )
  if (!res.ok) return []
  const rows = (await res.json()) as { token: string }[]
  return rows.map((r) => r.token)
}

async function sendToToken(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { token, notification: { title, body }, data: data ?? {} },
    }),
  })
  if (!res.ok) console.error('FCM send failed', res.status, await res.text())
  return res.ok
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
