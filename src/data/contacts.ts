import { supabase } from '@/lib/supabase'
import type { ContactRow } from './types'

// Adding and classifying the people you owe things to. Every function assumes a
// live session; callers only reach them in live mode (see ./hooks).

function db() {
  if (!supabase) throw new Error('Supabase client unavailable (running in preview mode)')
  return supabase
}

async function myId(): Promise<string> {
  const {
    data: { user },
  } = await db().auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user.id
}

export interface FoundProfile {
  id: string
  display_name: string
  photo_url: string | null
}

/**
 * Look someone up by phone number.
 *
 * Goes through the `find_profile_by_phone` RPC rather than querying `profiles`
 * directly: the table's own policy only exposes people you are already
 * connected to, so discovery has to run SECURITY DEFINER. The function honours
 * `searchable_by_number`, hides a photo set to `nobody`, and returns nothing if
 * that person has blocked you — so "not found" and "has blocked you" are
 * deliberately indistinguishable to the caller.
 *
 * Returns null when there is no such reachable person.
 */
export async function findProfileByPhone(phone: string): Promise<FoundProfile | null> {
  const { data, error } = await db().rpc('find_profile_by_phone', { phone_number: phone })
  if (error) throw error
  const rows = (data ?? []) as FoundProfile[]
  return rows[0] ?? null
}

/** Add someone to my contacts. Idempotent: adding twice is not an error. */
export async function addContact(contactId: string): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('contacts')
    .upsert({ owner_id: me, contact_id: contactId }, { onConflict: 'owner_id,contact_id' })
  if (error) throw error
}

export type ContactFlags = Pick<
  ContactRow,
  'is_work' | 'is_favorite' | 'is_archived' | 'is_blocked'
>

/** Reclassify a contact. Only the flags I own — the other side classifies me separately. */
export async function setContactFlags(
  contactId: string,
  patch: Partial<ContactFlags>,
): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('contacts')
    .update(patch)
    .eq('owner_id', me)
    .eq('contact_id', contactId)
  if (error) throw error
}
