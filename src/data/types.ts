// Row shapes that mirror supabase/migrations/0001_init.sql. These are the live
// database types; the UI's sample shapes live in lib/sampleData.ts. Mappers in
// ./mappers convert between them.

export type TaskStatus = 'pending_acceptance' | 'active' | 'completed' | 'declined' | 'deleted'
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low'
export type ExpectedPeriod = 'today' | 'this_week' | 'next_week' | 'this_month'
export type ChecklistBehavior = 'normal' | 'daily_reset' | 'manual_reset' | 'call'
export type GroupRole = 'administrator' | 'member'

export interface ProfileRow {
  id: string
  phone: string
  display_name: string
  photo_url: string | null
  description: string | null
  theme: 'system' | 'light' | 'dark'
}

export interface ContactRow {
  id: string
  owner_id: string
  contact_id: string
  is_work: boolean
  is_favorite: boolean
  is_archived: boolean
  is_blocked: boolean
  contact: ProfileRow // joined profile of contact_id
}

export interface TaskRow {
  id: string
  title: string
  note: string | null
  status: TaskStatus
  priority: TaskPriority
  expected_period: ExpectedPeriod | null
  due_date: string | null
  requester_id: string
  assignee_id: string | null
  group_id: string | null
  created_at: string
}

export interface ChecklistRow {
  id: string
  owner_id: string
  title: string
  kind: 'predefined' | 'custom'
  predefined_key: string | null
  behavior: ChecklistBehavior
  icon_color: string | null
}

export interface ChecklistItemRow {
  id: string
  checklist_id: string
  title: string
  is_completed: boolean
  phone_number: string | null
  sort_order: number
}

export interface GroupRow {
  id: string
  name: string
  photo_url: string | null
  description: string | null
  created_by: string | null
}

export interface GroupMemberRow {
  id: string
  group_id: string
  user_id: string
  role: GroupRole
  member: ProfileRow // joined profile
}
