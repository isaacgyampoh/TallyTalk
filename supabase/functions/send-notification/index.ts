// TaskTally — send-notification (Supabase Edge Function)
//
// Delivers one notification by standards-based Web Push: RFC 8291 for the
// encryption, RFC 8292 (VAPID) for proving who is sending. There is no
// Firebase project, service account or SDK here — the only thing the push
// service needs from us is a signature it can check against the public key the
// browser already holds from the subscription.
//
// Called by public.notify() through pg_net, with nothing but an id:
//   POST /functions/v1/send-notification
//   headers: { Authorization: 'Bearer <SEND_PUSH_SECRET>' }
//   body:    { "notificationId": "<uuid>" }
//
// Reading the row here rather than accepting its contents means a caller
// cannot put words in a notification, and a retry delivers exactly what the
// inbox already recorded.
//
// Secrets (server-side only):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SEND_PUSH_SECRET
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.)

import webpush from 'npm:web-push@3.6.7'

const SEND_PUSH_SECRET = Deno.env.get('SEND_PUSH_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@tasktally.app'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

interface NotificationRow {
  id: string
  user_id: string
  category: string
  title: string
  body: string | null
  task_id: string | null
  group_id: string | null
  actor_id: string | null
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  failures: number
}

Deno.serve(async (req) => {
  try {
    if (!SEND_PUSH_SECRET || !secretMatches(req.headers.get('Authorization') ?? '')) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!VAPID_PRIVATE || !VAPID_PUBLIC) {
      return json({ error: 'VAPID keys not configured' }, 500)
    }

    const { notificationId } = await req.json()
    if (typeof notificationId !== 'string' || !UUID.test(notificationId)) {
      return json({ error: 'notificationId must be a uuid' }, 400)
    }

    const note = await fetchOne<NotificationRow>(
      `notifications?id=eq.${notificationId}&select=id,user_id,category,title,body,task_id,group_id,actor_id`,
    )
    if (!note) return json({ error: 'No such notification' }, 404)

    const subs = await fetchMany<SubscriptionRow>(
      `push_subscriptions?user_id=eq.${note.user_id}&select=id,endpoint,p256dh,auth,failures`,
    )
    if (subs.length === 0) return json({ sent: 0, note: 'No subscriptions' }, 200)

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

    // Ids and the title the user typed — never a comment body, and nothing
    // that would tell a push service more than it needs to route a tap.
    const payload = JSON.stringify({
      id: note.id,
      title: note.title,
      body: note.body ?? '',
      category: note.category,
      taskId: note.task_id,
      groupId: note.group_id,
      contactId: note.actor_id,
    })

    const results = await Promise.all(subs.map((s) => sendTo(s, payload)))
    const sent = results.filter((r) => r.ok).length
    const gone = results.filter((r) => r.gone).map((r) => r.id)
    if (gone.length > 0) await forgetSubscriptions(gone)

    return json({ sent, total: subs.length, forgotten: gone.length }, 200)
  } catch (err) {
    // Never the notification's contents: this lands in the platform log.
    console.error('send-notification failed', err instanceof Error ? err.message : err)
    return json({ error: 'Failed to send' }, 500)
  }
})

async function sendTo(sub: SubscriptionRow, payload: string) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: 60 * 60 * 24 },
    )
    return { id: sub.id, ok: true, gone: false }
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 0
    // 404/410 mean the browser threw the subscription away — the only case
    // where deleting it is right. A 429 or a 500 from the push service is
    // temporary, and dropping a live subscription over one would silence
    // someone until they re-enabled notifications by hand.
    const gone = status === 404 || status === 410
    console.error('push failed', sub.id, status, gone ? '(subscription gone)' : '')
    return { id: sub.id, ok: false, gone }
  }
}

async function fetchOne<T>(query: string): Promise<T | null> {
  const rows = await fetchMany<T>(query)
  return rows[0] ?? null
}

async function fetchMany<T>(query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  })
  if (!res.ok) {
    console.error('read failed', res.status, await res.text())
    return []
  }
  return (await res.json()) as T[]
}

async function forgetSubscriptions(ids: string[]): Promise<void> {
  const list = ids.map((i) => `"${i}"`).join(',')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${encodeURIComponent(list)})`,
    {
      method: 'DELETE',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    },
  )
  if (!res.ok) console.error('could not forget subscriptions', res.status, await res.text())
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
