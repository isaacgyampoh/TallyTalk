import { supabase } from '@/lib/supabase'

/**
 * The notification inbox.
 *
 * Every notification-worthy event is a row here, written by the database
 * triggers in migration 0007. Push delivery is a separate, best-effort thing
 * on top: it can be muted, unsubscribed or simply unavailable, and none of
 * that loses the record. This is what makes the app usable with no push
 * provider at all, and what a person comes back to after being offline.
 */

function db() {
  if (!supabase) throw new Error('Not connected to the server')
  return supabase
}

export type NotificationCategory = 'assignments' | 'updates' | 'comments' | 'pokes'

export interface NotificationRow {
  id: string
  user_id: string
  category: NotificationCategory
  title: string
  body: string | null
  task_id: string | null
  group_id: string | null
  actor_id: string | null
  read_at: string | null
  created_at: string
}

export const notificationsKey = ['notifications'] as const

/** Newest first. RLS limits this to the caller's own rows. */
export async function listNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await db()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await db()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

/**
 * Mark everything unread as read.
 *
 * Scoped by `read_at is null` rather than by id so it stays correct if
 * something arrived between the list being drawn and the button being pressed.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

/** Where a notification sends you. Ids only, exactly as the payload carries. */
export function routeForNotificationRow(n: NotificationRow): string | null {
  if (n.task_id && n.actor_id) return `/contacts/${n.actor_id}/t/${n.task_id}`
  if (n.actor_id) return `/contacts/${n.actor_id}`
  if (n.group_id) return `/groups/${n.group_id}`
  return null
}
