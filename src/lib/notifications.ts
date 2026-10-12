/**
 * Notification categories, and where a notification sends you.
 *
 * Kept free of Capacitor imports so it can be unit-tested in Node and reused by
 * the sender. The categories map to events TaskTally actually emits — there is
 * deliberately no category for anything the product does not do.
 */

export type NotificationCategory = 'assignments' | 'updates' | 'comments' | 'pokes'

export interface ChannelSpec {
  id: NotificationCategory
  name: string
  description: string
  /** Android importance: 4 = heads-up with sound, 3 = sound, no heads-up. */
  importance: 3 | 4
  vibration: boolean
}

/**
 * One channel per category. Android exposes these in system settings, which is
 * where sound and vibration belong — the platform forbids an app overriding a
 * user's channel choice, and reimplementing it in-app would be worse anyway.
 */
export const CHANNELS: ChannelSpec[] = [
  {
    id: 'assignments',
    name: 'Task assignments',
    description: 'When someone asks you to do something.',
    importance: 4,
    vibration: true,
  },
  {
    id: 'updates',
    name: 'Task updates',
    description: 'When a task you are part of is accepted, completed or reopened.',
    importance: 3,
    vibration: false,
  },
  {
    id: 'comments',
    name: 'Comments',
    description: 'Replies on a task you are part of.',
    importance: 4,
    vibration: true,
  },
  {
    id: 'pokes',
    name: 'Nudges',
    description: 'When someone pokes you about something you owe them.',
    importance: 4,
    vibration: true,
  },
]

/** What the sender puts in a notification's data payload. */
export interface NotificationData {
  category?: string
  /** The contact whose space the item belongs to. */
  contactId?: string
  taskId?: string
  groupId?: string
}

/**
 * Where a tapped notification should land.
 *
 * Returns null when the payload names nothing openable, so the caller can leave
 * the user where they are rather than bouncing them to an arbitrary screen.
 * Only ids are read — a payload must never carry content, since notification
 * payloads are not a trusted channel for anything protected.
 */
export function routeForNotification(data: NotificationData | undefined): string | null {
  if (!data) return null

  if (data.taskId && data.contactId) return `/contacts/${data.contactId}/t/${data.taskId}`
  if (data.contactId) return `/contacts/${data.contactId}`
  if (data.groupId) return `/groups/${data.groupId}`
  return null
}

/** Which categories a user wants, defaulting to all of them. */
export type NotificationPrefs = Partial<Record<NotificationCategory, boolean>>

export function categoryEnabled(prefs: NotificationPrefs | null, c: string): boolean {
  if (!prefs) return true
  const known = CHANNELS.some((ch) => ch.id === c)
  if (!known) return true // an unrecognised category is never silently dropped
  return prefs[c as NotificationCategory] !== false
}
