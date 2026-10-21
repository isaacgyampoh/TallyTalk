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

const {
  findProfileByPhone,
  requestContact,
  respondToContactRequest,
  sendSmsInvitation,
  setContactFlags,
  withdrawContactRequest,
} = await import('./contacts')

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

describe('requestContact', () => {
  it('asks on my own behalf — the policy refuses anything else', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await requestContact(THEM)
    expect(client.argFor('contact_requests', 'insert')).toEqual({
      from_user: ME,
      to_user: THEM,
    })
  })

  it('does not add a contact directly, because connecting is theirs to accept', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await requestContact(THEM)
    expect(client.calls.contacts).toBeUndefined()
  })

  it('throws when the request is refused — blocked, or already asked', async () => {
    client = makeSupabaseMock({
      results: { contact_requests: { error: { message: 'duplicate key' } } },
    })
    await expect(requestContact(THEM)).rejects.toMatchObject({ message: 'duplicate key' })
  })
})

describe('respondToContactRequest', () => {
  it('accepts by setting the status, and nothing else', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await respondToContactRequest('req-1', true)
    expect(client.argFor('contact_requests', 'update')).toEqual({ status: 'accepted' })
    expect(client.calls.contact_requests.find((c) => c.method === 'eq')?.args).toEqual([
      'id',
      'req-1',
    ])
  })

  it('declines the same way', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await respondToContactRequest('req-1', false)
    expect(client.argFor('contact_requests', 'update')).toEqual({ status: 'declined' })
  })

  it('never writes the contact rows itself — the database does that', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await respondToContactRequest('req-1', true)
    expect(client.calls.contacts).toBeUndefined()
  })
})

describe('withdrawContactRequest', () => {
  it('deletes the one request', async () => {
    client = makeSupabaseMock({ results: { contact_requests: { error: null } } })
    await withdrawContactRequest('req-1')
    expect(client.calls.contact_requests.find((c) => c.method === 'delete')).toBeDefined()
    expect(client.calls.contact_requests.find((c) => c.method === 'eq')?.args).toEqual([
      'id',
      'req-1',
    ])
  })
})

describe('sendSmsInvitation', () => {
  it('goes through the edge function, never straight to the provider', async () => {
    client = makeSupabaseMock({})
    await sendSmsInvitation('+233244123456')
    expect(client.invocations[0].name).toBe('send-invite')
    expect(JSON.stringify(client.invocations[0].opts)).toContain('+233244123456')
  })

  it('surfaces the reason the server gave, since that is the useful one', async () => {
    // "You already invited this number today" helps; "Edge Function returned a
    // non-2xx status code" does not.
    client = makeSupabaseMock({ invokeError: { message: 'non-2xx' } })
    await expect(sendSmsInvitation('+233244123456')).rejects.toThrow(/could not send/i)
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
  it('refuses to ask anyone to connect', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(requestContact(THEM)).rejects.toThrow(/not signed in/i)
  })
})
