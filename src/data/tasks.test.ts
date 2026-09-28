import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'
const THEM = 'them-uuid'

// The data layer reaches the client through this module, so the mock goes here.
let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const {
  listContacts,
  listSpaceTasks,
  createTask,
  createGroupTask,
  setTaskStatus,
  setTaskPriority,
  poke,
} = await import('./tasks')

function taskRow(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Send the files',
    note: null,
    status: 'active',
    priority: 'normal',
    expected_period: 'this_week',
    due_date: null,
    requester_id: ME,
    assignee_id: THEM,
    group_id: null,
    created_at: '2026-09-20T10:00:00Z',
    ...over,
  }
}

const contactRow = {
  id: 'c1',
  owner_id: ME,
  contact_id: THEM,
  is_work: true,
  is_favorite: false,
  is_archived: false,
  is_blocked: false,
  contact: {
    id: THEM,
    phone: '+233241234567',
    display_name: 'Felicia Hammond',
    photo_url: null,
    description: null,
    theme: 'system',
  },
}

beforeEach(() => {
  client = makeSupabaseMock({})
})

describe('listContacts', () => {
  it('tallies each side of the ledger from the open tasks', async () => {
    client = makeSupabaseMock({
      results: {
        contacts: { data: [contactRow], error: null },
        tasks: {
          data: [
            taskRow({ id: 'a', requester_id: ME, assignee_id: THEM }), // they owe me
            taskRow({ id: 'b', requester_id: ME, assignee_id: THEM }),
            taskRow({ id: 'c', requester_id: THEM, assignee_id: ME }), // I owe them
          ],
          error: null,
        },
      },
    })
    const [c] = await listContacts()
    expect(c.forThem).toBe(2)
    expect(c.forYou).toBe(1)
    expect(c.name).toBe('Felicia Hammond')
  })

  it('counts an overdue task and an urgent one', async () => {
    client = makeSupabaseMock({
      results: {
        contacts: { data: [contactRow], error: null },
        tasks: {
          data: [
            taskRow({ id: 'a', due_date: '2020-01-01T00:00:00Z' }),
            taskRow({ id: 'b', priority: 'urgent' }),
          ],
          error: null,
        },
      },
    })
    const [c] = await listContacts()
    expect(c.overdue).toBe(1)
    expect(c.urgent).toBe(1)
  })

  it('asks only for this user, and skips archived contacts', async () => {
    client = makeSupabaseMock({
      results: { contacts: { data: [], error: null }, tasks: { data: [], error: null } },
    })
    await listContacts()
    const eqs = client.calls.contacts.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['owner_id', ME])
    expect(eqs).toContainEqual(['is_archived', false])
  })

  it('asks only for open tasks, never group tasks', async () => {
    client = makeSupabaseMock({
      results: { contacts: { data: [], error: null }, tasks: { data: [], error: null } },
    })
    await listContacts()
    expect(client.argFor('tasks', 'is')).toBe('group_id')
    expect(client.calls.tasks.find((c) => c.method === 'in')?.args[1]).toEqual([
      'pending_acceptance',
      'active',
    ])
  })

  it('throws when the contacts query fails rather than returning half a list', async () => {
    client = makeSupabaseMock({
      results: {
        contacts: { data: null, error: { message: 'boom' } },
        tasks: { data: [], error: null },
      },
    })
    await expect(listContacts()).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('listSpaceTasks', () => {
  it('returns only the pair of us, in both directions', async () => {
    client = makeSupabaseMock({ results: { tasks: { data: [], error: null } } })
    await listSpaceTasks(THEM)
    const or = client.calls.tasks.find((c) => c.method === 'or')?.args[0] as string
    expect(or).toContain(`requester_id.eq.${ME},assignee_id.eq.${THEM}`)
    expect(or).toContain(`requester_id.eq.${THEM},assignee_id.eq.${ME}`)
  })

  it('maps rows relative to me, so direction is right on both sides', async () => {
    client = makeSupabaseMock({
      results: {
        tasks: {
          data: [
            taskRow({ id: 'mine', requester_id: ME, assignee_id: THEM }),
            taskRow({ id: 'theirs', requester_id: THEM, assignee_id: ME }),
          ],
          error: null,
        },
      },
    })
    const out = await listSpaceTasks(THEM)
    expect(out.find((t) => t.id === 'mine')?.direction).toBe('they_owe_me')
    expect(out.find((t) => t.id === 'theirs')?.direction).toBe('i_owe_them')
  })

  it('excludes declined and deleted tasks', async () => {
    client = makeSupabaseMock({ results: { tasks: { data: [], error: null } } })
    await listSpaceTasks(THEM)
    expect(client.calls.tasks.find((c) => c.method === 'not')?.args).toEqual([
      'status',
      'in',
      '(declined,deleted)',
    ])
  })
})

describe('createTask', () => {
  it('records me as requester and starts as pending acceptance', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await createTask({ title: 'Send the files', assigneeId: THEM })
    expect(client.argFor('tasks', 'insert')).toMatchObject({
      title: 'Send the files',
      requester_id: ME,
      assignee_id: THEM,
      status: 'pending_acceptance',
      priority: 'normal',
    })
  })

  it('translates the UI label into the database period', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await createTask({ title: 'x', assigneeId: THEM, expected: 'Next Week' })
    expect(client.argFor('tasks', 'insert')).toMatchObject({ expected_period: 'next_week' })
  })

  it('sends a null period rather than an invalid one when nothing was chosen', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await createTask({ title: 'x', assigneeId: THEM })
    expect(client.argFor('tasks', 'insert')).toMatchObject({ expected_period: null })
  })

  it('throws when the insert fails, so the caller cannot claim it was sent', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: { message: 'denied' } } } })
    await expect(createTask({ title: 'x', assigneeId: THEM })).rejects.toMatchObject({
      message: 'denied',
    })
  })
})

describe('setTaskStatus', () => {
  it('stamps accepted_at when a task is accepted', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await setTaskStatus('t1', 'active')
    const patch = client.argFor('tasks', 'update') as Record<string, unknown>
    expect(patch.status).toBe('active')
    expect(typeof patch.accepted_at).toBe('string')
    expect(patch.completed_at).toBeUndefined()
  })

  it('stamps completed_at when a task is completed', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await setTaskStatus('t1', 'completed')
    const patch = client.argFor('tasks', 'update') as Record<string, unknown>
    expect(patch.status).toBe('completed')
    expect(typeof patch.completed_at).toBe('string')
  })

  it('stamps neither when a task is declined', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await setTaskStatus('t1', 'declined')
    const patch = client.argFor('tasks', 'update') as Record<string, unknown>
    expect(patch).toEqual({ status: 'declined' })
  })

  it('targets exactly the one task', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await setTaskStatus('t1', 'completed')
    expect(client.calls.tasks.find((c) => c.method === 'eq')?.args).toEqual(['id', 't1'])
  })
})

describe('setTaskPriority and poke', () => {
  it('updates only the priority column', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await setTaskPriority('t1', 'urgent')
    expect(client.argFor('tasks', 'update')).toEqual({ priority: 'urgent' })
  })

  it('records a poke from me to them against the task', async () => {
    client = makeSupabaseMock({ results: { pokes: { error: null } } })
    await poke(THEM, 't1')
    expect(client.argFor('pokes', 'insert')).toEqual({
      from_user: ME,
      to_user: THEM,
      task_id: 't1',
    })
  })
})

describe('when nobody is signed in', () => {
  it('refuses rather than querying as an anonymous user', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(listContacts()).rejects.toThrow(/not signed in/i)
  })
})

describe('createGroupTask', () => {
  it('records me as requester and carries no assignee', async () => {
    // A group task is owed by the group; whoever picks it up ticks it.
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await createGroupTask({ title: 'Clear the site', groupId: 'g1' })
    const row = client.argFor('tasks', 'insert') as Record<string, unknown>
    expect(row).toMatchObject({ title: 'Clear the site', requester_id: ME, group_id: 'g1' })
    expect(row.assignee_id).toBeUndefined()
  })

  it('starts active — there is nobody specific to accept it', async () => {
    client = makeSupabaseMock({ results: { tasks: { error: null } } })
    await createGroupTask({ title: 'x', groupId: 'g1' })
    expect(client.argFor('tasks', 'insert')).toMatchObject({ status: 'active' })
  })

  it('throws when the insert is refused, which is how a non-member is stopped', async () => {
    // tasks_insert_requester requires membership of the group being written to.
    client = makeSupabaseMock({ results: { tasks: { error: { message: 'rls' } } } })
    await expect(createGroupTask({ title: 'x', groupId: 'g1' })).rejects.toMatchObject({
      message: 'rls',
    })
  })
})
