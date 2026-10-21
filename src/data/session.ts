import { supabase } from '@/lib/supabase'

/**
 * Who is signed in, answered locally and never slowly.
 *
 * Every query in this app starts by asking. It used to ask
 * `supabase.auth.getUser()`, which is a network round-trip, and on a Pixel
 * after a dropped connection that call never came back — leaving the contacts
 * screen spinning forever while the underlying queries were perfectly
 * healthy. An error a person can retry is recoverable; a spinner is not.
 *
 * So: read the session, which is held locally, and give up if even that stalls.
 * The id is only used to build filters. It is not a security boundary — the
 * database decides what the holder of this token may see, and lying to
 * yourself about your own id achieves nothing.
 */

const PATIENCE_MS = 5000

function db() {
  if (!supabase) throw new Error('Not connected to the server')
  return supabase
}

export async function myId(): Promise<string> {
  const session = await Promise.race([
    db()
      .auth.getSession()
      .then((r) => r.data.session),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PATIENCE_MS)),
  ])
  const id = session?.user?.id
  if (!id) throw new Error('Not signed in')
  return id
}
