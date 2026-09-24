import { afterEach, describe, expect, it, vi } from 'vitest'
import { agoLabel, clockLabel, daysAgo, minutesAgo } from './time'

const AT = new Date('2026-09-24T12:00:00Z')

function freeze() {
  vi.useFakeTimers()
  vi.setSystemTime(AT)
}

afterEach(() => vi.useRealTimers())

describe('agoLabel', () => {
  it('reads "just now" under a minute', () => {
    freeze()
    expect(agoLabel(new Date(AT.getTime() - 30_000).toISOString())).toBe('just now')
  })

  it('singularises one minute and one hour', () => {
    freeze()
    expect(agoLabel(minutesAgo(1))).toBe('1 minute ago')
    expect(agoLabel(new Date(AT.getTime() - 3_600_000).toISOString())).toBe('1 hour ago')
  })

  it('pluralises beyond one', () => {
    freeze()
    expect(agoLabel(minutesAgo(5))).toBe('5 minutes ago')
    expect(agoLabel(new Date(AT.getTime() - 5 * 3_600_000).toISOString())).toBe('5 hours ago')
  })

  it('says "yesterday" for a single day rather than "1 days ago"', () => {
    freeze()
    expect(agoLabel(daysAgo(1))).toBe('yesterday')
  })

  it('counts whole days after that — the stamp the task rows show', () => {
    freeze()
    expect(agoLabel(daysAgo(2))).toBe('2 days ago')
    expect(agoLabel(daysAgo(11))).toBe('11 days ago')
  })

  it('rounds down rather than up, so 59 minutes is not "1 hour"', () => {
    freeze()
    expect(agoLabel(minutesAgo(59))).toBe('59 minutes ago')
  })
})

describe('clockLabel', () => {
  it('renders an hour and a zero-padded minute', () => {
    // Locale decides 12- vs 24-hour, so assert the shape, not the exact string.
    expect(clockLabel('2026-09-24T07:56:00Z')).toMatch(/^\d{1,2}:\d{2}(\s?[AP]M)?$/i)
  })
})

describe('daysAgo / minutesAgo', () => {
  it('produce ISO strings in the past', () => {
    freeze()
    expect(new Date(daysAgo(3)).getTime()).toBe(AT.getTime() - 3 * 86_400_000)
    expect(new Date(minutesAgo(7)).getTime()).toBe(AT.getTime() - 7 * 60_000)
  })

  it('daysAgo(0) is now, which new tasks use', () => {
    freeze()
    expect(new Date(daysAgo(0)).getTime()).toBe(AT.getTime())
  })
})
