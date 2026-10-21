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

const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  routeForNotificationRow,
} = await import('./notifications')

const row = {
  id: 'n1',
  user_id: ME,
  category: 'assignments' as const,
  title: 'Ama sent you a task',
  body: 'Send the Ecobank document',
  task_id: 'task-1',
  group_id: null,
  actor_id: 'ama-uuid',
  read_at: null,
  created_at: '2026-10-20T10:00:00Z',
}

beforeEach(() => {
  client = makeSupabaseMock({ results: { notifications: { data: [row], error: null } } })
})

describe('listNotifications', () => {
  it('reads newest first, which is the order an inbox is read in', async () => {
    await listNotifications()
    const order = client.calls.notifications.find((c) => c.method === 'order')
    expect(order?.args).toEqual(['created_at', { ascending: false }])
  })

  it('asks for a bounded page rather than everything ever sent', async () => {
    await listNotifications()
    expect(client.calls.notifications.find((c) => c.method === 'limit')?.args).toEqual([50])
  })

  it('does not filter by user — RLS does that, and doing it here would hide a policy bug', async () => {
    await listNotifications()
    expect(client.calls.notifications.find((c) => c.method === 'eq')).toBeUndefined()
  })

  it('throws when the read fails, so the screen can offer a retry', async () => {
    client = makeSupabaseMock({ results: { notifications: { error: { message: 'offline' } } } })
    await expect(listNotifications()).rejects.toMatchObject({ message: 'offline' })
  })
})

describe('marking as read', () => {
  it('sets read_at for the ids given', async () => {
    client = makeSupabaseMock({ results: { notifications: { error: null } } })
    await markNotificationsRead(['n1', 'n2'])
    expect(client.argFor('notifications', 'in')).toBe('id')
    expect(client.calls.notifications.find((c) => c.method === 'in')?.args[1]).toEqual(['n1', 'n2'])
    expect(Object.keys(client.argFor('notifications', 'update') as object)).toEqual(['read_at'])
  })

  it('does nothing at all for an empty list', async () => {
    client = makeSupabaseMock({ results: { notifications: { error: null } } })
    await markNotificationsRead([])
    expect(client.calls.notifications).toBeUndefined()
  })

  it('marks all by what is unread, not by the ids on screen', async () => {
    // Something may arrive between the list being drawn and the button being
    // pressed; scoping by read_at keeps that one unread rather than skipping it.
    client = makeSupabaseMock({ results: { notifications: { error: null } } })
    await markAllNotificationsRead()
    expect(client.calls.notifications.find((c) => c.method === 'is')?.args).toEqual([
      'read_at',
      null,
    ])
  })

  it('throws when the update fails', async () => {
    client = makeSupabaseMock({ results: { notifications: { error: { message: 'rls' } } } })
    await expect(markNotificationsRead(['n1'])).rejects.toMatchObject({ message: 'rls' })
  })
})

describe('routeForNotificationRow', () => {
  it('opens the task inside the other person’s space', () => {
    expect(routeForNotificationRow(row)).toBe('/contacts/ama-uuid/t/task-1')
  })

  it('opens the space when there is no task', () => {
    expect(routeForNotificationRow({ ...row, task_id: null })).toBe('/contacts/ama-uuid')
  })

  it('opens the group for a group task', () => {
    expect(routeForNotificationRow({ ...row, actor_id: null, group_id: 'g1' })).toBe('/groups/g1')
  })

  // A real group notification names its sender too. Checking the sender first
  // sent every one of them to that person's profile instead of to the group.
  it('opens the group, not the sender, when a notification names both', () => {
    expect(
      routeForNotificationRow({ ...row, task_id: null, actor_id: 'ama-uuid', group_id: 'g1' }),
    ).toBe('/groups/g1')
  })

  it('opens the conversation for a message, where the message can be read', () => {
    expect(
      routeForNotificationRow({ ...row, category: 'messages', task_id: null, group_id: null }),
    ).toBe('/contacts/ama-uuid/chat')
  })

  it('opens the group conversation for a group message', () => {
    expect(
      routeForNotificationRow({
        ...row,
        category: 'messages',
        task_id: null,
        group_id: 'g1',
      }),
    ).toBe('/groups/g1/chat')
  })

  it('still opens a task a message-less notification names', () => {
    expect(routeForNotificationRow({ ...row, group_id: 'g1' })).toBe('/contacts/ama-uuid/t/task-1')
  })

  it('returns null rather than guessing when nothing is named', () => {
    expect(routeForNotificationRow({ ...row, task_id: null, actor_id: null })).toBeNull()
  })
})
