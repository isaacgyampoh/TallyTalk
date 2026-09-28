import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'
let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const { exportMyData, deleteMyAccount } = await import('./account')

beforeEach(() => {
  client = makeSupabaseMock({
    results: {
      profiles: { data: { id: ME }, error: null },
      contacts: { data: [], error: null },
      tasks: { data: [], error: null },
      checklists: { data: [], error: null },
      checklist_items: { data: [], error: null },
    },
  })
})

describe('exportMyData', () => {
  it('reads only my own rows — RLS is what makes this a safe export', async () => {
    await exportMyData()
    expect(client.calls.profiles.find((c) => c.method === 'eq')?.args).toEqual(['id', ME])
    expect(client.calls.contacts.find((c) => c.method === 'eq')?.args).toEqual(['owner_id', ME])
    expect(client.calls.checklists.find((c) => c.method === 'eq')?.args).toEqual(['owner_id', ME])
  })

  it('covers both sides of a task, not just the ones I raised', async () => {
    await exportMyData()
    const or = client.calls.tasks.find((c) => c.method === 'or')?.args[0] as string
    expect(or).toContain(`requester_id.eq.${ME}`)
    expect(or).toContain(`assignee_id.eq.${ME}`)
  })

  it('stamps when the export was taken', async () => {
    const out = await exportMyData()
    expect(typeof out.exported_at).toBe('string')
  })

  it('refuses when nobody is signed in', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(exportMyData()).rejects.toThrow(/not signed in/i)
  })
})

describe('deleteMyAccount', () => {
  it('calls the edge function with my own token and no user id', async () => {
    // The function derives the user from the token; passing an id would be a
    // way to ask it to delete somebody else.
    await deleteMyAccount()
    expect(client.invocations).toHaveLength(1)
    expect(client.invocations[0].name).toBe('delete-account')
    expect(JSON.stringify(client.invocations[0].opts)).toContain(`token-for-${ME}`)
    expect(JSON.stringify(client.invocations[0].opts)).not.toContain('"body"')
  })

  it('throws when the function refuses, so the UI does not claim success', async () => {
    client = makeSupabaseMock({ invokeError: { message: 'nope' } })
    await expect(deleteMyAccount()).rejects.toMatchObject({ message: 'nope' })
  })

  it('refuses when there is no session', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(deleteMyAccount()).rejects.toThrow(/not signed in/i)
  })
})
