import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'
import type { ChecklistItemRow } from './types'
import { addTaskComment, eventsKey, listTaskEvents, recordTaskEvent } from './events'
import { poke } from './tasks'
import { getMyProfile, updateMyProfile, uploadAvatar, type ProfilePatch } from './profile'
import { attachmentsKey, listTaskAttachments, uploadTaskAttachment } from './attachments'
import { useEffect } from 'react'
import { createTask, listContacts, listSpaceTasks, setTaskStatus } from './tasks'
import { addContact, findProfileByPhone, setContactFlags, type ContactFlags } from './contacts'
import {
  addChecklistItem,
  createChecklist,
  listChecklistItems,
  listChecklists,
  createGroup,
  getGroupMembers,
  getGroupTasks,
  listMyGroups,
  removeChecklistItem,
  inviteToGroup,
  listMyInvitations,
  needsDailyReset,
  respondToInvitation,
  resetChecklist,
  seedPredefinedChecklists,
  toggleChecklistItem,
} from './checklists'

/**
 * Live when there's a real Supabase session; preview (sample data) otherwise.
 * Screens branch on this so the demo keeps working with no backend at all.
 */
export function useIsLive(): boolean {
  const { session } = useAuth()
  return !!(supabase && session)
}

/** One key builder, so the queries and the mutations cannot drift apart. */
export const spaceKey = (contactId: string, live: boolean) => ['space', contactId, live] as const

export function useContacts() {
  const live = useIsLive()
  return useQuery({
    queryKey: ['contacts', live],
    queryFn: () => (live ? listContacts() : Promise.resolve(SAMPLE_CONTACTS)),
  })
}

export function useSpaceTasks(contactId: string) {
  const live = useIsLive()
  return useQuery({
    queryKey: spaceKey(contactId, live),
    enabled: live && !!contactId, // in preview, screens use their own seeded tasks
    queryFn: () => listSpaceTasks(contactId),
  })
}

export function useChecklists() {
  const live = useIsLive()
  return useQuery({
    queryKey: ['checklists', live],
    enabled: live,
    queryFn: async () => {
      // Idempotent: unique (owner_id, predefined_key) means a repeat run is a
      // no-op, so a new account opens Personal with its fourteen lists ready.
      await seedPredefinedChecklists()
      return listChecklists()
    },
  })
}

export const itemsKey = (checklistId: string) => ['checklist-items', checklistId] as const

export function useChecklistItems(checklistId: string) {
  const live = useIsLive()
  return useQuery({
    queryKey: itemsKey(checklistId),
    enabled: live && !!checklistId,
    queryFn: () => listChecklistItems(checklistId),
  })
}

/** Ticking, adding and removing items on one list. */
export function useChecklistMutations(checklistId: string) {
  const qc = useQueryClient()
  const key = itemsKey(checklistId)
  const settle = { onSettled: () => qc.invalidateQueries({ queryKey: key }) }

  const toggle = useMutation({
    mutationFn: (v: { itemId: string; isCompleted: boolean }) =>
      toggleChecklistItem(v.itemId, v.isCompleted),
    onMutate: async ({ itemId, isCompleted }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ChecklistItemRow[]>(key)
      qc.setQueryData<ChecklistItemRow[]>(key, (old) =>
        old?.map((i) => (i.id === itemId ? { ...i, is_completed: isCompleted } : i)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    ...settle,
  })

  const add = useMutation({
    mutationFn: (title: string) => addChecklistItem(checklistId, title),
    ...settle,
  })

  const remove = useMutation({
    mutationFn: (itemId: string) => removeChecklistItem(itemId),
    ...settle,
  })

  return { toggle, add, remove }
}

export function useCreateChecklist() {
  const qc = useQueryClient()
  const live = useIsLive()
  return useMutation({
    mutationFn: (title: string) => createChecklist(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists', live] }),
  })
}

export function useGroups() {
  const live = useIsLive()
  return useQuery({
    queryKey: ['groups', live],
    enabled: live,
    queryFn: () => listMyGroups(),
  })
}

/**
 * Writes for one task space. Each applies to the cache immediately so the row
 * responds at once, and puts the previous rows back if the write is refused —
 * the screen should never end up showing a change the database rejected.
 */
export function useTaskSpaceMutations(contactId: string) {
  const qc = useQueryClient()
  const key = spaceKey(contactId, true)

  async function snapshot() {
    await qc.cancelQueries({ queryKey: key })
    return qc.getQueryData<SampleTask[]>(key)
  }

  function restore(prev: SampleTask[] | undefined) {
    if (prev) qc.setQueryData(key, prev)
  }

  const setStatus = useMutation({
    mutationFn: async (v: { taskId: string; status: 'active' | 'completed' | 'declined' }) => {
      await setTaskStatus(v.taskId, v.status)
      const type =
        v.status === 'active' ? 'accepted' : v.status === 'completed' ? 'completed' : 'declined'
      // Best effort: the status change is what matters; a missing log line
      // must not make a successful accept look like a failure.
      await recordTaskEvent(v.taskId, type).catch(() => {})
    },
    onMutate: async ({ taskId, status }) => {
      const prev = await snapshot()
      qc.setQueryData<SampleTask[]>(key, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status: status === 'declined' ? 'active' : status, receipt: 'accepted' }
            : t,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => restore(ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const create = useMutation({
    mutationFn: (title: string) => createTask({ title, assigneeId: contactId }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { setStatus, create }
}

/**
 * Finding someone by number and adding them. Kept separate from the contacts
 * query so a failed lookup never disturbs the list already on screen.
 */
export function useAddContact() {
  const qc = useQueryClient()
  const live = useIsLive()

  const find = useMutation({
    mutationFn: (phone: string) => findProfileByPhone(phone),
  })

  const add = useMutation({
    mutationFn: (profileId: string) => addContact(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', live] }),
  })

  return { find, add }
}

/** Work / favourite / archive / block, applied to my own side of the pair. */
export function useContactFlags() {
  const qc = useQueryClient()
  const live = useIsLive()
  return useMutation({
    mutationFn: (v: { contactId: string; patch: Partial<ContactFlags> }) =>
      setContactFlags(v.contactId, v.patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['contacts', live] }),
  })
}

export function useGroupDetail(groupId: string) {
  const live = useIsLive()
  const members = useQuery({
    queryKey: ['group-members', groupId],
    enabled: live && !!groupId,
    queryFn: () => getGroupMembers(groupId),
  })
  const tasks = useQuery({
    queryKey: ['group-tasks', groupId],
    enabled: live && !!groupId,
    queryFn: () => getGroupTasks(groupId),
  })
  return { members, tasks }
}

export function useCreateGroup() {
  const qc = useQueryClient()
  const live = useIsLive()
  return useMutation({
    // The on_group_created trigger seats me as administrator; see PB-002.
    mutationFn: (name: string) => createGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', live] }),
  })
}

/** The timeline on one task: its history and its comments, in one list. */
export function useTaskEvents(taskId: string) {
  const live = useIsLive()
  return useQuery({
    queryKey: eventsKey(taskId),
    enabled: live && !!taskId,
    queryFn: () => listTaskEvents(taskId),
  })
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => addTaskComment(taskId, body),
    onSettled: () => qc.invalidateQueries({ queryKey: eventsKey(taskId) }),
  })
}

/** The wand. Records the poke and logs it on the task. */
export function usePoke(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (toUserId: string) => {
      await poke(toUserId, taskId)
      await recordTaskEvent(taskId, 'poked').catch(() => {})
    },
    onSettled: () => qc.invalidateQueries({ queryKey: eventsKey(taskId) }),
  })
}

/** Clear a list and stamp last_reset_at — daily lists on open, others on demand. */
export function useResetChecklist(checklistId: string) {
  const qc = useQueryClient()
  const live = useIsLive()
  return useMutation({
    mutationFn: () => resetChecklist(checklistId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: itemsKey(checklistId) })
      qc.invalidateQueries({ queryKey: ['checklists', live] })
    },
  })
}

export { needsDailyReset }

export function useMyProfile() {
  const live = useIsLive()
  return useQuery({
    queryKey: ['my-profile', live],
    enabled: live,
    queryFn: () => getMyProfile(),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const live = useIsLive()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-profile', live] })
    qc.invalidateQueries({ queryKey: ['contacts', live] })
  }

  const save = useMutation({
    mutationFn: (patch: ProfilePatch) => updateMyProfile(patch),
    onSettled: invalidate,
  })

  const changePhoto = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadAvatar(file)
      await updateMyProfile({ photo_url: url })
      return url
    },
    onSettled: invalidate,
  })

  return { save, changePhoto }
}

export function useTaskAttachments(taskId: string) {
  const live = useIsLive()
  return useQuery({
    queryKey: attachmentsKey(taskId),
    enabled: live && !!taskId,
    queryFn: () => listTaskAttachments(taskId),
  })
}

export function useUploadAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadTaskAttachment(taskId, file),
    onSettled: () => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
  })
}

/**
 * Keep one task's timeline and files current while the screen is open.
 *
 * `task_events` and `task_attachments` are both in the realtime publication,
 * and both are gated by can_access_task, so a subscriber only ever hears about
 * rows it was already allowed to read. The channel is torn down on unmount —
 * leaving it open is how these turn into a slow leak across navigations.
 */
export function useTaskRealtime(taskId: string) {
  const qc = useQueryClient()
  const live = useIsLive()

  useEffect(() => {
    if (!live || !supabase || !taskId) return
    const channel = supabase
      .channel(`task:${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_events', filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: eventsKey(taskId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${taskId}` },
        () => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [live, taskId, qc])
}

/** Keep a contact's task space current while it is on screen. */
export function useSpaceRealtime(contactId: string) {
  const qc = useQueryClient()
  const live = useIsLive()

  useEffect(() => {
    if (!live || !supabase || !contactId) return
    const channel = supabase
      .channel(`space:${contactId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: spaceKey(contactId, true) })
        qc.invalidateQueries({ queryKey: ['contacts', true] })
      })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [live, contactId, qc])
}

export function useMyInvitations() {
  const live = useIsLive()
  return useQuery({
    queryKey: ['invitations', live],
    enabled: live,
    queryFn: () => listMyInvitations(),
  })
}

export function useInvitations(groupId?: string) {
  const qc = useQueryClient()
  const live = useIsLive()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invitations', live] })
    qc.invalidateQueries({ queryKey: ['groups', live] })
    if (groupId) qc.invalidateQueries({ queryKey: ['group-members', groupId] })
  }

  const invite = useMutation({
    mutationFn: (v: { groupId: string; userId: string }) => inviteToGroup(v.groupId, v.userId),
    onSettled: refresh,
  })

  const respond = useMutation({
    // The on_invitation_accepted trigger adds the membership; see PB-002.
    mutationFn: (v: { invitationId: string; status: 'accepted' | 'declined' }) =>
      respondToInvitation(v.invitationId, v.status),
    onSettled: refresh,
  })

  return { invite, respond }
}
