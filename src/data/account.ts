import { supabase } from '@/lib/supabase'
import { reportEdgeFailure } from '@/lib/telemetry'
import { myId } from './session'

/**
 * Leaving: taking your data with you, and closing the account.
 *
 * Export runs entirely in the client. RLS already limits every one of these
 * tables to your own rows, so a plain read is the export — there is nothing to
 * add server-side and nothing that could return somebody else's data.
 */

function db() {
  if (!supabase) throw new Error('Not connected to the server')
  return supabase
}

export interface DataExport {
  exported_at: string
  profile: unknown
  contacts: unknown[]
  tasks: unknown[]
  checklists: unknown[]
  checklist_items: unknown[]
}

export async function exportMyData(): Promise<DataExport> {
  const client = db()
  const me = await myId()

  const [profile, contacts, tasks, checklists, items] = await Promise.all([
    client.from('profiles').select('*').eq('id', me).single(),
    client.from('contacts').select('*').eq('owner_id', me),
    client.from('tasks').select('*').or(`requester_id.eq.${me},assignee_id.eq.${me}`),
    client.from('checklists').select('*').eq('owner_id', me),
    client.from('checklist_items').select('*'),
  ])

  return {
    exported_at: new Date().toISOString(),
    profile: profile.data ?? null,
    contacts: contacts.data ?? [],
    tasks: tasks.data ?? [],
    checklists: checklists.data ?? [],
    checklist_items: items.data ?? [],
  }
}

/**
 * Close the account for good.
 *
 * Calls the `delete-account` edge function with the caller's own access token.
 * The client cannot do this directly: removing a row from auth.users needs the
 * service role, and the function deletes whoever the token belongs to rather
 * than any id it is handed.
 */
export async function deleteMyAccount(): Promise<void> {
  const client = db()
  const {
    data: { session },
  } = await client.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const { error } = await client.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    // A deletion that fails quietly is the one failure here with legal weight,
    // so it is reported as well as raised.
    await reportEdgeFailure('delete-account', error.message)
    throw error
  }
}
