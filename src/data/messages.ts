import { supabase } from '@/lib/supabase'
import { myId } from './session'

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

export interface MessageRow {
  id: string
  sender_id: string
  recipient_id: string | null
  group_id: string | null
  body: string
  read_at: string | null
  created_at: string
}

/**
 * Who a conversation is with. A group is the same `groups` row that carries a
 * shared task list — one group, one membership, one set of rules about who
 * belongs.
 */
export interface Target {
  kind: 'person' | 'group'
  id: string
}

export interface Conversation {
  kind: 'person' | 'group'
  id: string
  display_name: string
  photo_url: string | null
  last_body: string
  last_at: string
  last_mine: boolean
  unread: number
  /** How many people are in it. Null for a person. */
  members: number | null
}

export interface Receipt {
  user_id: string
  display_name: string
  read_at: string | null
}

export const conversationsKey = ['conversations'] as const
export const threadKey = (target: Target) => ['thread', target.kind, target.id] as const

/** One row per person or group you have actually exchanged messages with. */
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

export async function listThread(target: Target, before?: string): Promise<MessageRow[]> {
  const me = await myId()
  let query = db().from('messages').select('*')

  if (target.kind === 'group') {
    query = query.eq('group_id', target.id)
  } else {
    query = query.or(
      `and(sender_id.eq.${me},recipient_id.eq.${target.id}),` +
        `and(sender_id.eq.${target.id},recipient_id.eq.${me})`,
    )
  }

  query = query.order('created_at', { ascending: false }).limit(THREAD_PAGE)

  // Keyset rather than offset: a conversation grows at the end while you read
  // it, and an offset would show the same message twice or skip one.
  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as MessageRow[]).reverse()
}

export async function sendMessage(target: Target, body: string): Promise<void> {
  const me = await myId()
  const trimmed = body.trim()
  if (!trimmed) return
  const { error } = await db()
    .from('messages')
    .insert(messageRow(me, target, trimmed))
  if (error) throw error
}

/**
 * A message goes to a person or to a group — the check constraint in 0013
 * allows exactly one, so both keys are always present and one is null.
 */
export interface NewMessage {
  sender_id: string
  recipient_id: string | null
  group_id: string | null
  body: string
}

export function messageRow(me: string, target: Target, body: string): NewMessage {
  return {
    sender_id: me,
    recipient_id: target.kind === 'person' ? target.id : null,
    group_id: target.kind === 'group' ? target.id : null,
    body,
  }
}

/**
 * Mark everything they sent me as read.
 *
 * Scoped by `read_at is null` rather than by the ids on screen, so a message
 * that arrived while the thread was open is not left unread behind the user.
 */
export async function markRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return
  const me = await myId()
  // One row per person per message: the receipt is a fact about a reader, and
  // in a group it is the only way to say who has seen something. Conflicts are
  // ignored because reading something twice is not an event.
  const { error } = await db()
    .from('message_reads')
    .upsert(
      messageIds.map((id) => ({ message_id: id, user_id: me })),
      { onConflict: 'message_id,user_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/** Who has read a message, and who has not. The sender's view. */
export async function listReceipts(messageId: string): Promise<Receipt[]> {
  const { data, error } = await db().rpc('message_receipts', { mid: messageId })
  if (error) throw error
  return (data ?? []) as Receipt[]
}

export interface SearchHit {
  id: string
  sender_id: string
  recipient_id: string | null
  group_id: string | null
  body: string
  created_at: string
}

/**
 * Search what was said.
 *
 * The work happens in Postgres against a GIN index, and the function runs as
 * the caller — so a search can only ever return messages the searcher is
 * already allowed to read. Nothing is downloaded to the device to be searched
 * there.
 */
export async function searchMessages(
  query: string,
  scope?: Target,
  limit = 30,
): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await db().rpc('search_messages', {
    q,
    in_group: scope?.kind === 'group' ? scope.id : null,
    with_contact: scope?.kind === 'person' ? scope.id : null,
    max_results: limit,
  })
  if (error) throw error
  return (data ?? []) as SearchHit[]
}
