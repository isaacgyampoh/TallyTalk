import { supabase } from '@/lib/supabase'

/**
 * Private messages between two people who have agreed to connect.
 *
 * The message is the record: it is in the database the moment it is sent, so a
 * notification that never arrives costs nobody their words. Everything here
 * reads or writes that record — nothing depends on push, realtime or anything
 * else that can fail.
 */

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

export interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

export interface Conversation {
  contact_id: string
  display_name: string
  photo_url: string | null
  last_body: string
  last_at: string
  last_mine: boolean
  unread: number
}

export const conversationsKey = ['conversations'] as const
export const threadKey = (contactId: string) => ['thread', contactId] as const

/** One row per person you have actually exchanged messages with. */
export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await db().rpc('list_conversations')
  if (error) throw error
  return (data ?? []) as Conversation[]
}

/** How many messages are waiting, across everyone. */
export async function unreadMessageCount(): Promise<number> {
  const { data, error } = await db().rpc('unread_message_count')
  if (error) throw error
  return (data as number) ?? 0
}

/** One page of a conversation, oldest-first for reading. */
export const THREAD_PAGE = 30

export async function listThread(contactId: string, before?: string): Promise<MessageRow[]> {
  const me = await myId()
  let query = db()
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${me},recipient_id.eq.${contactId}),` +
        `and(sender_id.eq.${contactId},recipient_id.eq.${me})`,
    )
    .order('created_at', { ascending: false })
    .limit(THREAD_PAGE)

  // Keyset rather than offset: a conversation grows at the end while you read
  // it, and an offset would show the same message twice or skip one.
  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as MessageRow[]).reverse()
}

export async function sendMessage(contactId: string, body: string): Promise<void> {
  const me = await myId()
  const trimmed = body.trim()
  if (!trimmed) return
  const { error } = await db()
    .from('messages')
    .insert({ sender_id: me, recipient_id: contactId, body: trimmed })
  if (error) throw error
}

/**
 * Mark everything they sent me as read.
 *
 * Scoped by `read_at is null` rather than by the ids on screen, so a message
 * that arrived while the thread was open is not left unread behind the user.
 */
export async function markThreadRead(contactId: string): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me)
    .eq('sender_id', contactId)
    .is('read_at', null)
  if (error) throw error
}
