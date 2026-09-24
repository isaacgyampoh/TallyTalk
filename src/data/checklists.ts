import { supabase } from '@/lib/supabase'
import type { ChecklistItemRow, ChecklistRow, GroupMemberRow, GroupRow, TaskRow } from './types'

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

// --- checklists (private to owner) ---
export async function listChecklists(): Promise<ChecklistRow[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('checklists')
    .select('*')
    .eq('owner_id', me)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChecklistRow[]
}

export async function listChecklistItems(checklistId: string): Promise<ChecklistItemRow[]> {
  const { data, error } = await db()
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChecklistItemRow[]
}

export async function createChecklist(title: string): Promise<string> {
  const me = await myId()
  const { data, error } = await db()
    .from('checklists')
    .insert({ owner_id: me, title, kind: 'custom' })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function addChecklistItem(checklistId: string, title: string): Promise<void> {
  const { error } = await db().from('checklist_items').insert({ checklist_id: checklistId, title })
  if (error) throw error
}

export async function toggleChecklistItem(itemId: string, isCompleted: boolean): Promise<void> {
  const { error } = await db()
    .from('checklist_items')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
  if (error) throw error
}

// --- groups (where I'm a member) ---
export async function listMyGroups(): Promise<GroupRow[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('group_members')
    .select('group:groups(id,name,photo_url,description,created_by)')
    .eq('user_id', me)
  if (error) throw error
  return ((data ?? []) as unknown as { group: GroupRow }[]).map((r) => r.group)
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const { data, error } = await db()
    .from('group_members')
    .select(
      '*, member:profiles!group_members_user_id_fkey(id,phone,display_name,photo_url,description,theme)',
    )
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []) as GroupMemberRow[]
}

export async function getGroupTasks(groupId: string): Promise<TaskRow[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('group_id', groupId)
    .not('status', 'in', '(declined,deleted)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TaskRow[]
}

/**
 * Create a group and return its id.
 *
 * Do not add a `group_members` insert here. The `on_group_created` trigger
 * (migration 0003) already seats the creator as administrator, and it has to:
 * `group_members_admin_manage` only admits existing admins, so a client-side
 * insert cannot add the very first member. Inserting again from here violates
 * `unique (group_id, user_id)` and throws after the group row already exists,
 * leaving an orphaned group.
 */
export async function createGroup(name: string): Promise<string> {
  const me = await myId()
  const { data, error } = await db()
    .from('groups')
    .insert({ name, created_by: me })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}
