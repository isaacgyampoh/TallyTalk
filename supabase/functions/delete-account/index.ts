// TaskTally — delete-account (Supabase Edge Function)
//
// Deleting your own account cannot be done from the browser: removing a row
// from auth.users needs the service role, and handing that key to a client
// would let anyone delete anyone. So the client calls this with its own access
// token, the function verifies who that token belongs to, and deletes exactly
// that user — never a user id supplied in the request body.
//
// Everything in public.* cascades from profiles.id -> auth.users.id, so one
// delete removes the profile, contacts, tasks, checklists, pokes and device
// tokens with it.
//
// Deploy:
//   supabase functions deploy delete-account
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, 401)

  try {
    // Who is this token for? Asking the auth server is the only trustworthy
    // answer — the body is not consulted at any point.
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE },
    })
    if (!who.ok) return json({ error: 'Unauthorized' }, 401)

    const user = (await who.json()) as { id?: string }
    if (!user.id) return json({ error: 'Unauthorized' }, 401)

    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    })
    if (!del.ok) {
      console.error('delete-account failed', del.status, await del.text())
      return json({ error: 'Could not delete the account' }, 500)
    }

    return json({ deleted: true }, 200)
  } catch (err) {
    console.error('delete-account error', err)
    return json({ error: 'Could not delete the account' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
