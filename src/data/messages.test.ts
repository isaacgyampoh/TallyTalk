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

const { listConversations, listThread, markRead, searchMessages, sendMessage, unreadMessageCount } =
  await import('./messages')

const PERSON = { kind: 'person' as const, id: THEM }
const GROUP = { kind: 'group' as const, id: 'group-uuid' }

const message = {
  id: 'm1',
  sender_id: THEM,
  recipient_id: ME,
  group_id: null,
  body: 'Did the invoice go out?',
  read_at: null,
  created_at: '2026-10-21T09:00:00Z',
}

beforeEach(() => {
  client = makeSupabaseMock({ results: { messages: { data: [message], error: null } } })
})

describe('listConversations', () => {
  it('asks the database to aggregate, rather than a query per contact', async () => {
    client = makeSupabaseMock({ rpcResults: { list_conversations: { data: [], error: null } } })
    await listConversations()
    expect(client.rpcCalls[0].fn).toBe('list_conversations')
    expect(client.calls.messages).toBeUndefined()
  })
})

describe('listThread', () => {
  it('reads both directions of the conversation', async () => {
    await listThread(PERSON)
    const filter = client.calls.messages.find((c) => c.method === 'or')?.args[0] as string
    expect(filter).toContain(`sender_id.eq.${ME},recipient_id.eq.${THEM}`)
    expect(filter).toContain(`sender_id.eq.${THEM},recipient_id.eq.${ME}`)
  })

  it('takes a bounded page, newest first', async () => {
    await listThread(PERSON)
    expect(client.calls.messages.find((c) => c.method === 'order')?.args).toEqual([
      'created_at',
      { ascending: false },
    ])
    expect(client.calls.messages.find((c) => c.method === 'limit')?.args).toEqual([30])
  })

  it('returns them oldest-first, which is how a conversation reads', async () => {
    client = makeSupabaseMock({
      results: {
        messages: {
          data: [
            { ...message, id: 'newer', created_at: '2026-10-21T10:00:00Z' },
            { ...message, id: 'older', created_at: '2026-10-21T09:00:00Z' },
          ],
          error: null,
        },
      },
    })
    const page = await listThread(PERSON)
    expect(page.map((m) => m.id)).toEqual(['older', 'newer'])
  })

  it('pages by timestamp, not offset', async () => {
    // A conversation grows at the end while it is read; an offset would repeat
    // a message or skip one.
    await listThread(PERSON, '2026-10-21T09:00:00Z')
    expect(client.calls.messages.find((c) => c.method === 'lt')?.args).toEqual([
      'created_at',
      '2026-10-21T09:00:00Z',
    ])
  })
})

describe('sendMessage', () => {
  it('sends as me, to them', async () => {
    client = makeSupabaseMock({ results: { messages: { error: null } } })
    await sendMessage(PERSON, 'On it')
    expect(client.argFor('messages', 'insert')).toEqual({
      sender_id: ME,
      recipient_id: THEM,
      group_id: null,
      body: 'On it',
    })
  })

  it('trims what was typed, and refuses to send nothing', async () => {
    client = makeSupabaseMock({ results: { messages: { error: null } } })
    await sendMessage(PERSON, '   ')
    expect(client.calls.messages).toBeUndefined()
    await sendMessage(PERSON, '  hello  ')
    expect((client.argFor('messages', 'insert') as { body: string }).body).toBe('hello')
  })

  it('throws when the write is refused, so the draft is kept', async () => {
    client = makeSupabaseMock({ results: { messages: { error: { message: 'blocked' } } } })
    await expect(sendMessage(PERSON, 'hi')).rejects.toMatchObject({ message: 'blocked' })
  })
})

describe('markRead', () => {
  it('records one receipt per message, as me', async () => {
    client = makeSupabaseMock({ results: { message_reads: { error: null } } })
    await markRead(['m1', 'm2'])
    expect(client.argFor('message_reads', 'upsert')).toEqual([
      { message_id: 'm1', user_id: ME },
      { message_id: 'm2', user_id: ME },
    ])
  })

  it('ignores a message already read, since reading twice is not an event', async () => {
    client = makeSupabaseMock({ results: { message_reads: { error: null } } })
    await markRead(['m1'])
    expect(client.calls.message_reads.find((c) => c.method === 'upsert')?.args[1]).toEqual({
      onConflict: 'message_id,user_id',
      ignoreDuplicates: true,
    })
  })

  it('does nothing at all for an empty list', async () => {
    client = makeSupabaseMock({})
    await markRead([])
    expect(client.calls.message_reads).toBeUndefined()
  })
})

describe('searchMessages', () => {
  it('asks the database, scoped to a conversation when given one', async () => {
    client = makeSupabaseMock({ rpcResults: { search_messages: { data: [], error: null } } })
    await searchMessages('invoice', GROUP)
    expect(client.rpcCalls[0].fn).toBe('search_messages')
    expect(client.rpcCalls[0].args).toMatchObject({
      q: 'invoice',
      in_group: 'group-uuid',
      with_contact: null,
    })
  })

  it('scopes to a person the other way round', async () => {
    client = makeSupabaseMock({ rpcResults: { search_messages: { data: [], error: null } } })
    await searchMessages('invoice', PERSON)
    expect(client.rpcCalls[0].args).toMatchObject({ in_group: null, with_contact: THEM })
  })

  it('does not search for one letter', async () => {
    client = makeSupabaseMock({})
    expect(await searchMessages('a')).toEqual([])
    expect(client.rpcCalls).toHaveLength(0)
  })

  it('never downloads messages to search them on the device', async () => {
    client = makeSupabaseMock({ rpcResults: { search_messages: { data: [], error: null } } })
    await searchMessages('invoice')
    expect(client.calls.messages).toBeUndefined()
  })
})

describe('unreadMessageCount', () => {
  it('asks the database to count, not the client', async () => {
    client = makeSupabaseMock({ rpcResults: { unread_message_count: { data: 3, error: null } } })
    expect(await unreadMessageCount()).toBe(3)
  })
})
