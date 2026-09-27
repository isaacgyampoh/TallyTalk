import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'
import { createTask, listContacts, listSpaceTasks, setTaskStatus } from './tasks'
import { listChecklists, listMyGroups } from './checklists'

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
    queryFn: () => listChecklists(),
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
    mutationFn: (v: { taskId: string; status: 'active' | 'completed' | 'declined' }) =>
      setTaskStatus(v.taskId, v.status),
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
