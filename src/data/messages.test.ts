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

const { listConversations, listThread, markThreadRead, sendMessage, unreadMessageCount } =
  await import('./messages')

const message = {
  id: 'm1',
  sender_id: THEM,
  recipient_id: ME,
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
    await listThread(THEM)
    const filter = client.calls.messages.find((c) => c.method === 'or')?.args[0] as string
    expect(filter).toContain(`sender_id.eq.${ME},recipient_id.eq.${THEM}`)
    expect(filter).toContain(`sender_id.eq.${THEM},recipient_id.eq.${ME}`)
  })

  it('takes a bounded page, newest first', async () => {
    await listThread(THEM)
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
    const page = await listThread(THEM)
    expect(page.map((m) => m.id)).toEqual(['older', 'newer'])
  })

  it('pages by timestamp, not offset', async () => {
    // A conversation grows at the end while it is read; an offset would repeat
    // a message or skip one.
    await listThread(THEM, '2026-10-21T09:00:00Z')
    expect(client.calls.messages.find((c) => c.method === 'lt')?.args).toEqual([
      'created_at',
      '2026-10-21T09:00:00Z',
    ])
  })
})

describe('sendMessage', () => {
  it('sends as me, to them', async () => {
    client = makeSupabaseMock({ results: { messages: { error: null } } })
    await sendMessage(THEM, 'On it')
    expect(client.argFor('messages', 'insert')).toEqual({
      sender_id: ME,
      recipient_id: THEM,
      body: 'On it',
    })
  })

  it('trims what was typed, and refuses to send nothing', async () => {
    client = makeSupabaseMock({ results: { messages: { error: null } } })
    await sendMessage(THEM, '   ')
    expect(client.calls.messages).toBeUndefined()
    await sendMessage(THEM, '  hello  ')
    expect((client.argFor('messages', 'insert') as { body: string }).body).toBe('hello')
  })

  it('throws when the write is refused, so the draft is kept', async () => {
    client = makeSupabaseMock({ results: { messages: { error: { message: 'blocked' } } } })
    await expect(sendMessage(THEM, 'hi')).rejects.toMatchObject({ message: 'blocked' })
  })
})

describe('markThreadRead', () => {
  it('marks what they sent me, and only what is still unread', async () => {
    // Scoped by read_at rather than by the ids on screen, so a message that
    // arrived while the thread was open is not left unread behind the user.
    client = makeSupabaseMock({ results: { messages: { error: null } } })
    await markThreadRead(THEM)
    const eqs = client.calls.messages.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqs).toEqual([
      ['recipient_id', ME],
      ['sender_id', THEM],
    ])
    expect(client.calls.messages.find((c) => c.method === 'is')?.args).toEqual(['read_at', null])
    expect(Object.keys(client.argFor('messages', 'update') as object)).toEqual(['read_at'])
  })
})

describe('unreadMessageCount', () => {
  it('asks the database to count, not the client', async () => {
    client = makeSupabaseMock({ rpcResults: { unread_message_count: { data: 3, error: null } } })
    expect(await unreadMessageCount()).toBe(3)
  })
})
