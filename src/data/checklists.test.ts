import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'
import { PREDEFINED_CHECKLISTS } from '@/lib/config'

const ME = 'me-uuid'

let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const {
  listChecklists,
  listChecklistItems,
  createChecklist,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  seedPredefinedChecklists,
  createGroup,
  listMyGroups,
  getGroupTasks,
} = await import('./checklists')

beforeEach(() => {
  client = makeSupabaseMock({})
})

describe('seedPredefinedChecklists', () => {
  it('seeds one row per predefined list, with the titles the UI expects', async () => {
    client = makeSupabaseMock({ results: { checklists: { error: null } } })
    await seedPredefinedChecklists()
    const rows = client.argFor('checklists', 'upsert') as Array<Record<string, unknown>>
    expect(rows).toHaveLength(PREDEFINED_CHECKLISTS.length)
    expect(rows.map((r) => r.predefined_key)).toEqual(PREDEFINED_CHECKLISTS.map((l) => l.key))
    expect(rows.map((r) => r.title)).toEqual(PREDEFINED_CHECKLISTS.map((l) => l.title))
    expect(rows.every((r) => r.owner_id === ME && r.kind === 'predefined')).toBe(true)
  })

  it('carries each list its declared behaviour, so daily lists can reset', async () => {
    client = makeSupabaseMock({ results: { checklists: { error: null } } })
    await seedPredefinedChecklists()
    const rows = client.argFor('checklists', 'upsert') as Array<Record<string, unknown>>
    expect(rows.find((r) => r.predefined_key === 'daily')?.behavior).toBe('daily_reset')
    expect(rows.find((r) => r.predefined_key === 'call')?.behavior).toBe('call')
    expect(rows.find((r) => r.predefined_key === 'travel')?.behavior).toBe('manual_reset')
  })

  it('is safe to run twice — upserts on the owner/key pair and ignores duplicates', async () => {
    client = makeSupabaseMock({ results: { checklists: { error: null } } })
    await seedPredefinedChecklists()
    expect(client.calls.checklists.find((c) => c.method === 'upsert')?.args[1]).toEqual({
      onConflict: 'owner_id,predefined_key',
      ignoreDuplicates: true,
    })
  })
})

describe('listChecklists', () => {
  it('asks only for my own visible lists', async () => {
    client = makeSupabaseMock({ results: { checklists: { data: [], error: null } } })
    await listChecklists()
    const eqs = client.calls.checklists.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['owner_id', ME])
    expect(eqs).toContainEqual(['is_hidden', false])
  })
})

describe('checklist items', () => {
  it('reads one list, ordered for display', async () => {
    client = makeSupabaseMock({ results: { checklist_items: { data: [], error: null } } })
    await listChecklistItems('list-1')
    expect(client.calls.checklist_items.find((c) => c.method === 'eq')?.args).toEqual([
      'checklist_id',
      'list-1',
    ])
    expect(client.calls.checklist_items.find((c) => c.method === 'order')?.args[0]).toBe(
      'sort_order',
    )
  })

  it('adds an item to the list it was typed into', async () => {
    client = makeSupabaseMock({ results: { checklist_items: { error: null } } })
    await addChecklistItem('list-1', 'Rice — 5kg')
    expect(client.argFor('checklist_items', 'insert')).toEqual({
      checklist_id: 'list-1',
      title: 'Rice — 5kg',
    })
  })

  it('stamps completed_at when ticked and clears it when unticked', async () => {
    client = makeSupabaseMock({ results: { checklist_items: { error: null } } })
    await toggleChecklistItem('i1', true)
    const ticked = client.argFor('checklist_items', 'update') as Record<string, unknown>
    expect(ticked.is_completed).toBe(true)
    expect(typeof ticked.completed_at).toBe('string')

    client = makeSupabaseMock({ results: { checklist_items: { error: null } } })
    await toggleChecklistItem('i1', false)
    const unticked = client.argFor('checklist_items', 'update') as Record<string, unknown>
    expect(unticked.is_completed).toBe(false)
    expect(unticked.completed_at).toBeNull()
  })

  it('removes exactly the one item', async () => {
    client = makeSupabaseMock({ results: { checklist_items: { error: null } } })
    await removeChecklistItem('i1')
    expect(client.calls.checklist_items.find((c) => c.method === 'eq')?.args).toEqual(['id', 'i1'])
  })

  it('throws when a tick is refused, so the row can be put back', async () => {
    client = makeSupabaseMock({ results: { checklist_items: { error: { message: 'rls' } } } })
    await expect(toggleChecklistItem('i1', true)).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('createChecklist', () => {
  it('creates a custom list owned by me and returns its id', async () => {
    client = makeSupabaseMock({ results: { checklists: { data: { id: 'new-1' }, error: null } } })
    const id = await createChecklist('Church rota')
    expect(id).toBe('new-1')
    expect(client.argFor('checklists', 'insert')).toEqual({
      owner_id: ME,
      title: 'Church rota',
      kind: 'custom',
    })
  })
})

describe('groups', () => {
  it('creates the group without inserting the member row itself', async () => {
    // The on_group_created trigger seats the creator as administrator; doing it
    // here too violates unique (group_id, user_id). This is PB-002 staying fixed.
    client = makeSupabaseMock({ results: { groups: { data: { id: 'g1' }, error: null } } })
    const id = await createGroup('Site team')
    expect(id).toBe('g1')
    expect(client.calls.group_members).toBeUndefined()
  })

  it('lists only the groups I am a member of', async () => {
    client = makeSupabaseMock({ results: { group_members: { data: [], error: null } } })
    await listMyGroups()
    expect(client.calls.group_members.find((c) => c.method === 'eq')?.args).toEqual(['user_id', ME])
  })

  it('reads a group’s open tasks in order', async () => {
    client = makeSupabaseMock({ results: { tasks: { data: [], error: null } } })
    await getGroupTasks('g1')
    expect(client.calls.tasks.find((c) => c.method === 'eq')?.args).toEqual(['group_id', 'g1'])
    expect(client.calls.tasks.find((c) => c.method === 'not')?.args).toEqual([
      'status',
      'in',
      '(declined,deleted)',
    ])
  })
})
