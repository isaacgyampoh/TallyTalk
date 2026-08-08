import type { Priority } from '@/lib/config'
import type { SampleContact, SampleTask } from '@/lib/sampleData'
import type { ContactRow, ExpectedPeriod, TaskRow } from './types'

const PALETTE = [
  '#6600FF',
  '#0E7C86',
  '#B4530A',
  '#8A3BFF',
  '#2B7A3B',
  '#B02A6F',
  '#1F6FEB',
  '#C2410C',
]

export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? ''
  return (a + b).toUpperCase()
}

export function expectedLabel(period: ExpectedPeriod | null): string {
  switch (period) {
    case 'today':
      return 'Today'
    case 'next_week':
      return 'Next Week'
    case 'this_month':
      return 'This Month'
    case 'this_week':
    default:
      return 'This Week'
  }
}

export function isOverdue(row: TaskRow): boolean {
  return (
    !!row.due_date && row.status !== 'completed' && new Date(row.due_date).getTime() < Date.now()
  )
}

/** DB task -> the UI SampleTask, relative to the current user. */
export function taskRowToSample(row: TaskRow, myId: string): SampleTask {
  const status: SampleTask['status'] =
    row.status === 'completed'
      ? 'completed'
      : row.status === 'pending_acceptance'
        ? 'pending_acceptance'
        : 'active'
  return {
    id: row.id,
    title: row.title,
    direction: row.requester_id === myId ? 'they_owe_me' : 'i_owe_them',
    status,
    priority: row.priority as Priority,
    expected: expectedLabel(row.expected_period),
    note: row.note ?? undefined,
    overdue: isOverdue(row),
  }
}

/** DB contact + aggregated task counts -> the UI SampleContact. */
export function contactRowToSample(
  row: ContactRow,
  counts: { forThem: number; forYou: number; overdue: number; urgent: number },
  tasks: SampleTask[] = [],
): SampleContact {
  const name = row.contact.display_name
  return {
    id: row.contact_id,
    name,
    initials: initialsFrom(name),
    color: colorFor(row.contact_id),
    forThem: counts.forThem,
    forYou: counts.forYou,
    overdue: counts.overdue,
    urgent: counts.urgent,
    unread: false,
    work: row.is_work,
    favorite: row.is_favorite,
    lastActivity: '',
    tasks,
  }
}
