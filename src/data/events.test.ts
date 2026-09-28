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

const { listTaskEvents, recordTaskEvent, addTaskComment } = await import('./events')

beforeEach(() => {
  client = makeSupabaseMock({ results: { task_events: { data: [], error: null } } })
})

describe('listTaskEvents', () => {
  it('reads one task, oldest first — the order a conversation reads in', async () => {
    await listTaskEvents('t1')
    expect(client.calls.task_events.find((c) => c.method === 'eq')?.args).toEqual(['task_id', 't1'])
    const order = client.calls.task_events.find((c) => c.method === 'order')
    expect(order?.args[0]).toBe('created_at')
    expect(order?.args[1]).toEqual({ ascending: true })
  })
})

describe('recordTaskEvent', () => {
  it('records me as the actor — the RLS policy requires actor_id = auth.uid()', async () => {
    await recordTaskEvent('t1', 'accepted')
    expect(client.argFor('task_events', 'insert')).toEqual({
      task_id: 't1',
      actor_id: ME,
      event_type: 'accepted',
      metadata: {},
    })
  })

  it('carries metadata when given', async () => {
    await recordTaskEvent('t1', 'poked', { note: 'gently' })
    expect(client.argFor('task_events', 'insert')).toMatchObject({
      event_type: 'poked',
      metadata: { note: 'gently' },
    })
  })

  it('throws when the insert is refused', async () => {
    client = makeSupabaseMock({ results: { task_events: { error: { message: 'rls' } } } })
    await expect(recordTaskEvent('t1', 'completed')).rejects.toMatchObject({ message: 'rls' })
  })

  it('refuses when nobody is signed in', async () => {
    client = makeSupabaseMock({ userId: null })
    await expect(recordTaskEvent('t1', 'completed')).rejects.toThrow(/not signed in/i)
  })
})

describe('addTaskComment', () => {
  it('is an event carrying a body, so participants-only RLS already covers it', async () => {
    await addTaskComment('t1', 'How do I proceed with this?')
    expect(client.argFor('task_events', 'insert')).toEqual({
      task_id: 't1',
      actor_id: ME,
      event_type: 'comment',
      metadata: { body: 'How do I proceed with this?' },
    })
  })

  it('keeps the body verbatim, including punctuation the UI shows', async () => {
    await addTaskComment('t1', 'Just manage and do something for me.')
    const row = client.argFor('task_events', 'insert') as { metadata: { body: string } }
    expect(row.metadata.body).toBe('Just manage and do something for me.')
  })
})
