import { supabase } from '@/lib/supabase'
import type { ContactRow } from './types'

// Adding and classifying the people you owe things to. Every function assumes a
// live session; callers only reach them in live mode (see ./hooks).

function db() {
  if (!supabase) throw new Error('Not connected to the server')
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

/**
 * Connecting is a request, not an act.
 *
 * Adding someone used to be unilateral — find a number, and they are in your
 * list. That is wrong for a product where a contact can then send you
 * obligations, so the other person accepts or declines. The contact rows on
 * both sides are written by the database when they accept (migration 0009),
 * because neither party can write the other's row and a connection that exists
 * in one direction only would show one of them a stranger.
 */
export type ContactRequestState =
  | 'open' // nothing between us yet
  | 'sent' // I have asked, and am waiting
  | 'incoming' // they asked me
  | 'connected'
  | 'declined' // I asked, and they said no
  | 'unavailable' // blocked, in one direction or the other — deliberately vague
  | 'self'

export interface ContactRequest {
  id: string
  from_user: string
  to_user: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  /** The other person, joined for display. Null if their profile is hidden. */
  profile: { id: string; display_name: string; photo_url: string | null } | null
}

/** Where things stand with this person, decided by the database. */
export async function contactRequestState(target: string): Promise<ContactRequestState> {
  const { data, error } = await db().rpc('contact_request_state', { target })
  if (error) throw error
  return (data as ContactRequestState) ?? 'open'
}

/** Ask to connect. The policy decides whether the row may exist at all. */
export async function requestContact(target: string): Promise<void> {
  const me = await myId()
  const { error } = await db().from('contact_requests').insert({ from_user: me, to_user: target })
  if (error) throw error
}

/** Requests waiting for me to answer. */
export async function listIncomingRequests(): Promise<ContactRequest[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('contact_requests')
    .select('*, profile:profiles!contact_requests_from_user_fkey(id,display_name,photo_url)')
    .eq('to_user', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContactRequest[]
}

/** Requests I have sent and not had answered. */
export async function listOutgoingRequests(): Promise<ContactRequest[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('contact_requests')
    .select('*, profile:profiles!contact_requests_to_user_fkey(id,display_name,photo_url)')
    .eq('from_user', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContactRequest[]
}

/**
 * Answer one. A trigger does the rest: accepting writes both contact rows and
 * tells the person who asked; declining is deliberately silent, because
 * telling someone they were refused only invites another attempt.
 */
export async function respondToContactRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await db()
    .from('contact_requests')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', id)
  if (error) throw error
}

/** Take back a request I sent, while it is still unanswered. */
export async function withdrawContactRequest(id: string): Promise<void> {
  const { error } = await db().from('contact_requests').delete().eq('id', id)
  if (error) throw error
}

/**
 * Invite someone who is not on TaskTally by text message.
 *
 * The send, the limits and the record all live server-side: a client that
 * could write its own invitation rows could also hide its own rate limiting.
 * Nothing in the answer says whether that number is registered.
 */
export async function sendSmsInvitation(phone: string): Promise<void> {
  const { data, error } = await db().functions.invoke('send-invite', { body: { phone } })
  if (error) {
    // The function's own message is the useful one — it explains which limit
    // was reached — so prefer it over the transport's.
    const detail = (data as { error?: string } | null)?.error
    throw new Error(detail || 'We could not send that invitation. Please try again later.')
  }
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
