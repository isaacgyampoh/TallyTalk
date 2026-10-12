import { describe, expect, it } from 'vitest'
import { CHANNELS, categoryEnabled, routeForNotification } from './notifications'

describe('notification channels', () => {
  it('covers only events the product actually emits', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['assignments', 'updates', 'comments', 'pokes'])
  })

  it('gives every channel a name and description, which system settings show', () => {
    for (const c of CHANNELS) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.description.length).toBeGreaterThan(0)
    }
  })

  it('reserves heads-up importance for things needing a person, not status changes', () => {
    const byId = Object.fromEntries(CHANNELS.map((c) => [c.id, c]))
    expect(byId.assignments.importance).toBe(4)
    expect(byId.pokes.importance).toBe(4)
    expect(byId.updates.importance).toBe(3)
  })
})

describe('routeForNotification', () => {
  it('opens the task itself when the payload names one', () => {
    expect(routeForNotification({ contactId: 'c1', taskId: 't1' })).toBe('/contacts/c1/t/t1')
  })

  it('falls back to the space when only a contact is named', () => {
    expect(routeForNotification({ contactId: 'c1' })).toBe('/contacts/c1')
  })

  it('opens a group when that is what the payload names', () => {
    expect(routeForNotification({ groupId: 'g1' })).toBe('/groups/g1')
  })

  it('returns null rather than bouncing the user to an arbitrary screen', () => {
    expect(routeForNotification(undefined)).toBeNull()
    expect(routeForNotification({})).toBeNull()
    expect(routeForNotification({ category: 'updates' })).toBeNull()
  })

  it('needs a contact for a task route — a task id alone is not addressable', () => {
    expect(routeForNotification({ taskId: 't1' })).toBeNull()
  })
})

describe('categoryEnabled', () => {
  it('defaults to on when the user has expressed no preference', () => {
    expect(categoryEnabled(null, 'assignments')).toBe(true)
    expect(categoryEnabled({}, 'assignments')).toBe(true)
  })

  it('respects an explicit off', () => {
    expect(categoryEnabled({ assignments: false }, 'assignments')).toBe(false)
  })

  it('leaves other categories alone', () => {
    expect(categoryEnabled({ assignments: false }, 'pokes')).toBe(true)
  })

  it('never silently drops a category it does not recognise', () => {
    // A sender newer than the client must not be muted by accident.
    expect(categoryEnabled({ assignments: false }, 'something-new')).toBe(true)
  })
})
