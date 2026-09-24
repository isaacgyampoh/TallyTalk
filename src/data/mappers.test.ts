import { describe, expect, it } from 'vitest'
import {
  colorFor,
  contactRowToSample,
  expectedLabel,
  initialsFrom,
  isOverdue,
  taskRowToSample,
} from './mappers'
import type { ContactRow, TaskRow } from './types'

const ME = '11111111-1111-1111-1111-111111111111'
const THEM = '22222222-2222-2222-2222-222222222222'

function task(over: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 't1',
    title: 'Send the files',
    note: null,
    status: 'active',
    priority: 'normal',
    expected_period: 'this_week',
    due_date: null,
    requester_id: ME,
    assignee_id: THEM,
    group_id: null,
    created_at: '2026-09-20T10:00:00Z',
    ...over,
  }
}

describe('initialsFrom', () => {
  it('takes the first letter of the first two names', () => {
    expect(initialsFrom('Felicia Hammond')).toBe('FH')
    expect(initialsFrom('Ben Owusu')).toBe('BO')
  })

  it('falls back to the first two letters of a single name', () => {
    expect(initialsFrom('Prince')).toBe('PR')
  })

  it('ignores extra whitespace', () => {
    expect(initialsFrom('  Ama   Serwaa  ')).toBe('AS')
  })

  it('does not throw on an empty name', () => {
    expect(() => initialsFrom('')).not.toThrow()
  })
})

describe('colorFor', () => {
  it('is deterministic — the same person keeps their colour', () => {
    expect(colorFor('felicia')).toBe(colorFor('felicia'))
  })

  it('always returns a hex colour from the palette', () => {
    for (const id of ['felicia', 'ben', 'ama', 'kwame', 'x', '']) {
      expect(colorFor(id)).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})

describe('expectedLabel', () => {
  it('maps each period to its UI label', () => {
    expect(expectedLabel('today')).toBe('Today')
    expect(expectedLabel('this_week')).toBe('This Week')
    expect(expectedLabel('next_week')).toBe('Next Week')
    expect(expectedLabel('this_month')).toBe('This Month')
  })

  it('falls back to This Week when the period is null', () => {
    expect(expectedLabel(null)).toBe('This Week')
  })
})

describe('isOverdue', () => {
  it('is false without a due date', () => {
    expect(isOverdue(task({ due_date: null }))).toBe(false)
  })

  it('is true for a past due date on an open task', () => {
    expect(isOverdue(task({ due_date: '2020-01-01T00:00:00Z' }))).toBe(true)
  })

  it('is false for a future due date', () => {
    expect(isOverdue(task({ due_date: '2999-01-01T00:00:00Z' }))).toBe(false)
  })

  it('is never true for a completed task, however late it was', () => {
    expect(isOverdue(task({ due_date: '2020-01-01T00:00:00Z', status: 'completed' }))).toBe(false)
  })
})

describe('taskRowToSample — which side of the ledger', () => {
  it('is "they owe me" when I am the requester', () => {
    expect(taskRowToSample(task({ requester_id: ME }), ME).direction).toBe('they_owe_me')
  })

  it('is "i owe them" when someone else asked', () => {
    expect(taskRowToSample(task({ requester_id: THEM, assignee_id: ME }), ME).direction).toBe(
      'i_owe_them',
    )
  })

  it('collapses declined and deleted into active for display', () => {
    expect(taskRowToSample(task({ status: 'declined' }), ME).status).toBe('active')
  })

  it('preserves completed and pending_acceptance', () => {
    expect(taskRowToSample(task({ status: 'completed' }), ME).status).toBe('completed')
    expect(taskRowToSample(task({ status: 'pending_acceptance' }), ME).status).toBe(
      'pending_acceptance',
    )
  })

  it('carries the note through, using undefined rather than null', () => {
    expect(taskRowToSample(task({ note: null }), ME).note).toBeUndefined()
    expect(taskRowToSample(task({ note: 'The signed copy' }), ME).note).toBe('The signed copy')
  })
})

describe('contactRowToSample', () => {
  const row: ContactRow = {
    id: 'c1',
    owner_id: ME,
    contact_id: THEM,
    is_work: true,
    is_favorite: false,
    is_archived: false,
    is_blocked: false,
    contact: {
      id: THEM,
      phone: '+233241234567',
      display_name: 'Felicia Hammond',
      photo_url: null,
      description: null,
      theme: 'system',
    },
  }

  it('derives name, initials and a stable colour', () => {
    const c = contactRowToSample(row, { forThem: 2, forYou: 1, overdue: 0, urgent: 1 })
    expect(c.id).toBe(THEM)
    expect(c.name).toBe('Felicia Hammond')
    expect(c.initials).toBe('FH')
    expect(c.color).toBe(colorFor(THEM))
  })

  it('carries the tallies and the classification flags', () => {
    const c = contactRowToSample(row, { forThem: 2, forYou: 1, overdue: 0, urgent: 1 })
    expect([c.forThem, c.forYou, c.overdue, c.urgent]).toEqual([2, 1, 0, 1])
    expect(c.work).toBe(true)
    expect(c.favorite).toBe(false)
  })
})
