import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'
const THEM = 'them-uuid'

let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const { findProfileByPhone, addContact, setContactFlags } = await import('./contacts')

beforeEach(() => {
  client = makeSupabaseMock({})
})

describe('findProfileByPhone', () => {
  it('goes through the RPC, not the profiles table', async () => {
    client = makeSupabaseMock({
      rpcResults: { find_profile_by_phone: { data: [], error: null } },
    })
    await findProfileByPhone('+233241234567')
    expect(client.rpcCalls).toEqual([
      { fn: 'find_profile_by_phone', args: { phone_number: '+233241234567' } },
    ])
    // Querying profiles directly would return nothing for a stranger.
    expect(client.calls.profiles).toBeUndefined()
  })

  it('returns the one person found', async () => {
    client = makeSupabaseMock({
      rpcResults: {
        find_profile_by_phone: {
          data: [{ id: THEM, display_name: 'Felicia Hammond', photo_url: null }],
          error: null,
        },
      },
    })
    const found = await findProfileByPhone('+233241234567')
    expect(found).toEqual({ id: THEM, display_name: 'Felicia Hammond', photo_url: null })
  })

  it('returns null when nobody reachable has that number', async () => {
    client = makeSupabaseMock({
      rpcResults: { find_profile_by_phone: { data: [], error: null } },
    })
    expect(await findProfileByPhone('+233200000000')).toBeNull()
  })

  it('treats someone who has blocked me exactly like not found', async () => {
    // The RPC filters blocked callers out server-side, so it returns no rows.
    // The client must not be able to tell the two apart.
    client = makeSupabaseMock({
      rpcResults: { find_profile_by_phone: { data: [], error: null } },
    })
    expect(await findProfileByPhone('+233241234567')).toBeNull()
  })

  it('throws when the lookup itself fails, rather than reporting "not found"', async () => {
    client = makeSupabaseMock({
      rpcResults: { find_profile_by_phone: { data: null, error: { message: 'network' } } },
    })
    await expect(findProfileByPhone('+233241234567')).rejects.toMatchObject({ message: 'network' })
  })
})

describe('addContact', () => {
  it('records me as the owner', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: null } } })
    await addContact(THEM)
    expect(client.argFor('contacts', 'upsert')).toEqual({ owner_id: ME, contact_id: THEM })
  })

  it('upserts on the owner/contact pair, so adding twice is not an error', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: null } } })
    await addContact(THEM)
    const call = client.calls.contacts.find((c) => c.method === 'upsert')
    expect(call?.args[1]).toEqual({ onConflict: 'owner_id,contact_id' })
  })

  it('throws when the insert is refused', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: { message: 'denied' } } } })
    await expect(addContact(THEM)).rejects.toMatchObject({ message: 'denied' })
  })
})

describe('setContactFlags', () => {
  it('updates only the flags passed', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: null } } })
    await setContactFlags(THEM, { is_blocked: true })
    expect(client.argFor('contacts', 'update')).toEqual({ is_blocked: true })
  })

  it('scopes the update to my own row, never the other direction', async () => {
    // contacts rows are directional; without both filters this could rewrite
    // how they classify me.
    client = makeSupabaseMock({ results: { contacts: { error: null } } })
    await setContactFlags(THEM, { is_favorite: true })
    const eqs = client.calls.contacts.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['owner_id', ME])
    expect(eqs).toContainEqual(['contact_id', THEM])
  })

  it('carries several flags at once', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: null } } })
    await setContactFlags(THEM, { is_work: true, is_archived: false })
    expect(client.argFor('contacts', 'update')).toEqual({ is_work: true, is_archived: false })
  })

  it('throws when the update is refused', async () => {
    client = makeSupabaseMock({ results: { contacts: { error: { message: 'rls' } } } })
    await expect(setContactFlags(THEM, { is_blocked: true })).rejects.toMatchObject({
      message: 'rls',
    })
  })
})

describe('when nobody is signed in', () => {
  it('refuses to add a contact', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(addContact(THEM)).rejects.toThrow(/not signed in/i)
  })
})
