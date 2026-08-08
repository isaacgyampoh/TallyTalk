import { supabase } from '@/lib/supabase'
import type { Priority } from '@/lib/config'
import type { SampleContact, SampleTask } from '@/lib/sampleData'
import { contactRowToSample, taskRowToSample } from './mappers'
import type { ContactRow, TaskRow } from './types'

// Every function here assumes a live Supabase session. Callers only invoke them
// in live mode (see ./hooks). They throw if the client is missing so misuse is
// obvious rather than silent.

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

const CONTACT_SELECT =
  '*, contact:profiles!contacts_contact_id_fkey(id,phone,display_name,photo_url,description,theme)'

const EXPECTED_TO_PERIOD: Record<string, string> = {
  Today: 'today',
  'This Week': 'this_week',
  'Next Week': 'next_week',
  'This Month': 'this_month',
}

/** Contacts with per-contact "for them / for you" tallies. */
export async function listContacts(): Promise<SampleContact[]> {
  const me = await myId()
  const [{ data: contactRows, error: cErr }, { data: taskRows, error: tErr }] = await Promise.all([
    db().from('contacts').select(CONTACT_SELECT).eq('owner_id', me).eq('is_archived', false),
    db()
      .from('tasks')
      .select('*')
      .is('group_id', null)
      .in('status', ['pending_acceptance', 'active'])
      .or(`requester_id.eq.${me},assignee_id.eq.${me}`),
  ])
  if (cErr) throw cErr
  if (tErr) throw tErr

  const tasks = (taskRows ?? []) as TaskRow[]
  return ((contactRows ?? []) as ContactRow[]).map((c) => {
    const cid = c.contact_id
    const forThem = tasks.filter((t) => t.requester_id === me && t.assignee_id === cid)
    const forYou = tasks.filter((t) => t.requester_id === cid && t.assignee_id === me)
    const all = [...forThem, ...forYou]
    return contactRowToSample(c, {
      forThem: forThem.length,
      forYou: forYou.length,
      overdue: all.filter((t) => t.due_date && new Date(t.due_date).getTime() < Date.now()).length,
      urgent: all.filter((t) => t.priority === 'urgent').length,
    })
  })
}

/** The two-sided task space between me and one contact. */
export async function listSpaceTasks(contactId: string): Promise<SampleTask[]> {
  const me = await myId()
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .is('group_id', null)
    .not('status', 'in', '(declined,deleted)')
    .or(
      `and(requester_id.eq.${me},assignee_id.eq.${contactId}),and(requester_id.eq.${contactId},assignee_id.eq.${me})`,
    )
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as TaskRow[]).map((t) => taskRowToSample(t, me))
}

export async function createTask(input: {
  title: string
  assigneeId: string
  priority?: Priority
  expected?: string
}): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('tasks')
    .insert({
      title: input.title,
      requester_id: me,
      assignee_id: input.assigneeId,
      priority: input.priority ?? 'normal',
      expected_period: input.expected ? EXPECTED_TO_PERIOD[input.expected] : null,
      status: 'pending_acceptance',
    })
  if (error) throw error
}

export async function setTaskStatus(
  taskId: string,
  status: 'active' | 'completed' | 'declined',
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'active') patch.accepted_at = new Date().toISOString()
  if (status === 'completed') patch.completed_at = new Date().toISOString()
  const { error } = await db().from('tasks').update(patch).eq('id', taskId)
  if (error) throw error
}

export async function setTaskPriority(taskId: string, priority: Priority): Promise<void> {
  const { error } = await db().from('tasks').update({ priority }).eq('id', taskId)
  if (error) throw error
}

export async function setTaskExpected(taskId: string, expected: string): Promise<void> {
  const { error } = await db()
    .from('tasks')
    .update({ expected_period: EXPECTED_TO_PERIOD[expected] ?? null })
    .eq('id', taskId)
  if (error) throw error
}

/** The wand: record a poke for the assignee. */
export async function poke(toUserId: string, taskId: string): Promise<void> {
  const me = await myId()
  const { error } = await db()
    .from('pokes')
    .insert({ from_user: me, to_user: toUserId, task_id: taskId })
  if (error) throw error
}
