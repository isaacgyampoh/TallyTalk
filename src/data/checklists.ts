import { supabase } from '@/lib/supabase'
import { PREDEFINED_CHECKLISTS } from '@/lib/config'
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

/**
 * Give this user one of each predefined list, once.
 *
 * `checklists` has a unique (owner_id, predefined_key), so this upserts and is
 * safe to call on every launch — a second run changes nothing. Titles and
 * behaviours come from PREDEFINED_CHECKLISTS so the seed cannot drift from what
 * the UI expects.
 */
export async function seedPredefinedChecklists(): Promise<void> {
  const me = await myId()
  const rows = PREDEFINED_CHECKLISTS.map((l) => ({
    owner_id: me,
    predefined_key: l.key,
    title: l.title,
    behavior: l.behavior,
    kind: 'predefined' as const,
  }))
  const { error } = await db()
    .from('checklists')
    .upsert(rows, { onConflict: 'owner_id,predefined_key', ignoreDuplicates: true })
  if (error) throw error
}

/** Rename or delete are not offered yet; removing an item is. */
export async function removeChecklistItem(itemId: string): Promise<void> {
  const { error } = await db().from('checklist_items').delete().eq('id', itemId)
  if (error) throw error
}

/**
 * True when a daily list has not been cleared since before today began.
 *
 * Compared against local midnight, not a rolling 24 hours: "clear each morning"
 * is what people mean, so a list ticked at 11pm is clear at 7am rather than at
 * 11pm the following night.
 */
export function needsDailyReset(list: Pick<ChecklistRow, 'behavior' | 'last_reset_at'>): boolean {
  if (list.behavior !== 'daily_reset') return false
  if (!list.last_reset_at) return true
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  return new Date(list.last_reset_at).getTime() < midnight.getTime()
}

/** Untick everything on a list and record when that happened. */
export async function resetChecklist(checklistId: string): Promise<void> {
  const { error: itemsError } = await db()
    .from('checklist_items')
    .update({ is_completed: false, completed_at: null })
    .eq('checklist_id', checklistId)
    .eq('is_completed', true)
  if (itemsError) throw itemsError

  const { error } = await db()
    .from('checklists')
    .update({ last_reset_at: new Date().toISOString() })
    .eq('id', checklistId)
  if (error) throw error
}

// --- group invitations ---

export interface InvitationRow {
  id: string
  group_id: string
  invited_user: string
  invited_by: string | null
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  group?: { id: string; name: string }
}

/** Invitations waiting on me. */
export async function listMyInvitations(): Promise<InvitationRow[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('group_invitations')
    .select('*, group:groups(id,name)')
    .eq('invited_user', me)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []) as InvitationRow[]
}

/**
 * Invite someone to a group.
 *
 * Only administrators may do this — `group_invitations_admin_create` enforces
 * it, so there is no client-side role check to duplicate here and get wrong.
 * Re-inviting is not an error: unique (group_id, invited_user) means the upsert
 * simply leaves the existing invitation alone.
 */
export async function inviteToGroup(groupId: string, userId: string): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('group_invitations')
    .upsert(
      { group_id: groupId, invited_user: userId, invited_by: me },
      { onConflict: 'group_id,invited_user', ignoreDuplicates: true },
    )
  if (error) throw error
}

/**
 * Answer an invitation addressed to me.
 *
 * Accepting does not add the membership row — the `on_invitation_accepted`
 * trigger from 0003 does that, and it has to, because group_members only
 * admits existing admins. Writing it here as well would be PB-002 all over
 * again.
 */
export async function respondToInvitation(
  invitationId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('group_invitations')
    .update({ status })
    .eq('id', invitationId)
    .eq('invited_user', me)
  if (error) throw error
}
