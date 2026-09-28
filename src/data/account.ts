import { supabase } from '@/lib/supabase'

/**
 * Leaving: taking your data with you, and closing the account.
 *
 * Export runs entirely in the client. RLS already limits every one of these
 * tables to your own rows, so a plain read is the export — there is nothing to
 * add server-side and nothing that could return somebody else's data.
 */

function db() {
  if (!supabase) throw new Error('Supabase client unavailable (running in preview mode)')
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
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const [profile, contacts, tasks, checklists, items] = await Promise.all([
    client.from('profiles').select('*').eq('id', user.id).single(),
    client.from('contacts').select('*').eq('owner_id', user.id),
    client.from('tasks').select('*').or(`requester_id.eq.${user.id},assignee_id.eq.${user.id}`),
    client.from('checklists').select('*').eq('owner_id', user.id),
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
  if (error) throw error
}
