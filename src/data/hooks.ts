import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SAMPLE_CONTACTS } from '@/lib/sampleData'
import { listContacts, listSpaceTasks } from './tasks'
import { listChecklists, listMyGroups } from './checklists'

/**
 * Live when there's a real Supabase session; preview (sample data) otherwise.
 * Screens can adopt these hooks incrementally; in preview they behave exactly
 * like today's demo.
 */
export function useIsLive(): boolean {
  const { session } = useAuth()
  return !!(supabase && session)
}

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
    queryKey: ['space', contactId, live],
    enabled: live, // in preview, screens use their own seeded sample tasks
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
