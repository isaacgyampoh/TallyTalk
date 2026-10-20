/**
 * The shapes screens render.
 *
 * These are view models, deliberately separate from the database row types in
 * ./types: a screen shows "what I owe you", which is a direction derived from
 * a row relative to the signed-in user, not a column.
 *
 * They were previously called Task, Contact and so on and lived
 * beside fabricated data. The data is gone; the prefix went with it.
 */

import type { Priority } from '@/lib/config'

export type Receipt = 'sent' | 'seen' | 'accepted' | 'approved'

export interface Task {
  id: string
  title: string
  direction: 'they_owe_me' | 'i_owe_them'
  status: 'pending_acceptance' | 'active' | 'completed'
  priority: Priority
  expected: string
  note?: string
  overdue?: boolean
  /** ISO. Drives the "2 DAYS AGO" stamp on the row. */
  at?: string
  attachments?: number
  comments?: number
  receipt?: Receipt
}

export interface Contact {
  id: string
  name: string
  initials: string
  color: string
  forThem: number
  forYou: number
  overdue: number
  urgent: number
  unread: boolean
  work?: boolean
  favorite?: boolean
  lastActivity: string
  tasks: Task[]
  /** Lifetime totals behind the "246 Completed" strips. */
  doneByMe?: number
  doneByThem?: number
}

export interface TaskComment {
  id: string
  body: string
  mine: boolean
  at: string
  /** Seconds — set when the comment is a voice note rather than text. */
  voice?: number
}

export interface TaskFile {
  id: string
  name: string
  kind: 'pdf' | 'image' | 'doc' | 'audio'
  size: string
  at: string
  /** Where it lives in the private attachments bucket, for signing a link. */
  path: string
}

export interface ChecklistItem {
  id: string
  title: string
  done: boolean
  phone?: string
}

export interface GroupMember {
  id: string
  name: string
  initials: string
  color: string
  role: 'administrator' | 'member'
}

export interface GroupTask {
  id: string
  title: string
  assignee: string
  done: boolean
  priority: Priority
}

export interface Group {
  id: string
  name: string
  members: number
  open: number
  done: number
  color: string
  description: string
  memberList: GroupMember[]
  tasks: GroupTask[]
}
