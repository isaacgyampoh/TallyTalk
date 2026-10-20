import { describe, expect, it } from 'vitest'
import { smartParse } from './smartParse'
import type { Contact } from '@/data/viewTypes'

// A small fixture, local to this test — the app no longer ships sample people.
const CONTACTS = [
  { id: 'felicia', name: 'Felicia Hammond' },
  { id: 'ben', name: 'Ben Owusu' },
] as unknown as Contact[]

describe('smartParse — priority', () => {
  it('reads urgency words as urgent', () => {
    for (const word of ['urgent', 'asap', 'immediately', 'right away', 'critical']) {
      expect(smartParse(`send the report ${word}`, CONTACTS).priority).toBe('urgent')
    }
  })

  it('reads importance as high', () => {
    expect(smartParse('important: sign the lease', CONTACTS).priority).toBe('high')
    expect(smartParse('high priority review', CONTACTS).priority).toBe('high')
  })

  it('reads slack words as low', () => {
    for (const word of ['whenever', 'sometime', 'no rush', 'eventually']) {
      expect(smartParse(`tidy the store ${word}`, CONTACTS).priority).toBe('low')
    }
  })

  it('defaults to normal when nothing signals urgency', () => {
    expect(smartParse('collect the parcel', CONTACTS).priority).toBe('normal')
  })

  it('prefers urgent over high when both appear', () => {
    expect(smartParse('urgent and important', CONTACTS).priority).toBe('urgent')
  })
})

describe('smartParse — expected period', () => {
  it('defaults to this week', () => {
    expect(smartParse('call the bank', CONTACTS).expected).toBe('This Week')
  })

  it('picks up today and tonight', () => {
    expect(smartParse('pay the bill today', CONTACTS).expected).toBe('Today')
    expect(smartParse('lock up tonight', CONTACTS).expected).toBe('Today')
  })

  it('picks up next week and this month', () => {
    expect(smartParse('send it next week', CONTACTS).expected).toBe('Next Week')
    expect(smartParse('file taxes this month', CONTACTS).expected).toBe('This Month')
    expect(smartParse('settle by end of the month', CONTACTS).expected).toBe('This Month')
  })

  it('treats tomorrow and named days as this week', () => {
    expect(smartParse('deliver tomorrow', CONTACTS).expected).toBe('This Week')
    expect(smartParse('meet on friday', CONTACTS).expected).toBe('This Week')
  })
})

describe('smartParse — contact matching', () => {
  const felicia = CONTACTS[0]

  it('matches a known contact by first name', () => {
    const p = smartParse('ask Felicia to send the files', CONTACTS)
    expect(p.contactId).toBe('felicia')
    expect(p.contactName).toBe(felicia.name)
  })

  it('matches on the full name too', () => {
    expect(smartParse(`remind ${felicia.name} about the meeting`, CONTACTS).contactId).toBe(
      'felicia',
    )
  })

  it('leaves the contact unset when nobody is named', () => {
    const p = smartParse('buy milk', CONTACTS)
    expect(p.contactId).toBeUndefined()
    expect(p.contactName).toBeUndefined()
  })

  it('does not match a name embedded in a longer word', () => {
    // "Ben" must not match inside "bench" — the regex is word-bounded.
    expect(smartParse('fix the bench', CONTACTS).contactId).toBeUndefined()
  })
})

describe('smartParse — title cleanup', () => {
  it('strips the leading instruction and the contact name', () => {
    const p = smartParse('ask Felicia to send the files today', CONTACTS)
    expect(p.title.toLowerCase()).toContain('send the files')
    expect(p.title.toLowerCase()).not.toContain('felicia')
    expect(p.title.toLowerCase()).not.toContain('today')
  })

  it('removes priority words from the title', () => {
    expect(smartParse('urgent: clean the washroom', CONTACTS).title.toLowerCase()).not.toContain(
      'urgent',
    )
  })

  it('capitalises the first letter', () => {
    expect(smartParse('collect the parcel', CONTACTS).title).toBe('Collect the parcel')
  })

  it('never returns an empty title, even if every word was stripped', () => {
    const p = smartParse('urgent today', CONTACTS)
    expect(p.title.length).toBeGreaterThan(0)
  })

  it('collapses the double spaces left behind by stripping', () => {
    expect(smartParse('ask Felicia to send  the files', CONTACTS)?.title).not.toMatch(/\s{2,}/)
  })

  it('handles an empty input without throwing', () => {
    expect(() => smartParse('', CONTACTS)).not.toThrow()
    expect(() => smartParse('   ', CONTACTS)).not.toThrow()
  })
})
