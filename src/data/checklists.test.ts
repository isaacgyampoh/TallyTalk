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
  needsDailyReset,
  resetChecklist,
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

describe('needsDailyReset', () => {
  it('ignores lists that are not daily', () => {
    expect(needsDailyReset({ behavior: 'normal', last_reset_at: null })).toBe(false)
    expect(needsDailyReset({ behavior: 'manual_reset', last_reset_at: null })).toBe(false)
  })

  it('resets a daily list that has never been reset', () => {
    expect(needsDailyReset({ behavior: 'daily_reset', last_reset_at: null })).toBe(true)
  })

  it('does not reset again once cleared today', () => {
    const earlierToday = new Date()
    earlierToday.setHours(1, 0, 0, 0)
    expect(
      needsDailyReset({ behavior: 'daily_reset', last_reset_at: earlierToday.toISOString() }),
    ).toBe(false)
  })

  it('resets a list last cleared yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    expect(
      needsDailyReset({ behavior: 'daily_reset', last_reset_at: yesterday.toISOString() }),
    ).toBe(true)
  })

  it('measures from local midnight, not a rolling 24 hours', () => {
    // Ticked late last night, opened this morning: fewer than 24 hours have
    // passed, but it is a new day, so the list must be clear.
    const lastNight = new Date()
    lastNight.setDate(lastNight.getDate() - 1)
    lastNight.setHours(23, 30, 0, 0)
    expect(
      needsDailyReset({ behavior: 'daily_reset', last_reset_at: lastNight.toISOString() }),
    ).toBe(true)
  })
})

describe('resetChecklist', () => {
  it('unticks only the completed items, and stamps the list', async () => {
    client = makeSupabaseMock({
      results: { checklist_items: { error: null }, checklists: { error: null } },
    })
    await resetChecklist('list-1')
    const itemPatch = client.argFor('checklist_items', 'update') as Record<string, unknown>
    expect(itemPatch).toEqual({ is_completed: false, completed_at: null })
    const eqs = client.calls.checklist_items.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['checklist_id', 'list-1'])
    expect(eqs).toContainEqual(['is_completed', true])
    const listPatch = client.argFor('checklists', 'update') as Record<string, unknown>
    expect(typeof listPatch.last_reset_at).toBe('string')
  })

  it('does not stamp the list if the items could not be cleared', async () => {
    client = makeSupabaseMock({
      results: { checklist_items: { error: { message: 'rls' } }, checklists: { error: null } },
    })
    await expect(resetChecklist('list-1')).rejects.toMatchObject({ message: 'rls' })
    expect(client.calls.checklists).toBeUndefined()
  })
})
