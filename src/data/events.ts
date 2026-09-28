import { supabase } from '@/lib/supabase'

/**
 * The timeline on a task: what happened to it, and what people said about it.
 *
 * Both live in `task_events`. That table was designed as an append-only
 * activity log and already has what comments need — `can_access_task` RLS so
 * only participants can read or write, realtime enabled, and a jsonb column for
 * the body. `messages` was the alternative and does not fit: it is addressed
 * sender-to-recipient with no task reference, so it cannot express a comment on
 * a group task at all.
 *
 * The trade-off is that comments are append-only: no editing, no deleting.
 * That suits a shared accountability record, where quietly rewriting what you
 * said is the wrong affordance.
 */

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

export type EventType =
  'created' | 'accepted' | 'completed' | 'reopened' | 'declined' | 'poked' | 'comment'

export interface TaskEventRow {
  id: string
  task_id: string
  actor_id: string | null
  event_type: EventType
  metadata: { body?: string } | null
  created_at: string
}

export const eventsKey = (taskId: string) => ['task-events', taskId] as const

/** Oldest first, the order a conversation reads in. */
export async function listTaskEvents(taskId: string): Promise<TaskEventRow[]> {
  const { data, error } = await db()
    .from('task_events')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TaskEventRow[]
}

/** Record something that happened. `actor_id` must be me — the RLS policy checks it. */
export async function recordTaskEvent(
  taskId: string,
  eventType: EventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('task_events')
    .insert({ task_id: taskId, actor_id: me, event_type: eventType, metadata })
  if (error) throw error
}

/** A comment is an event carrying a body. */
export async function addTaskComment(taskId: string, body: string): Promise<void> {
  return recordTaskEvent(taskId, 'comment', { body })
}
