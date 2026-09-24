import { describe, expect, it } from 'vitest'
import { smartParse } from './smartParse'
import { SAMPLE_CONTACTS } from './sampleData'

describe('smartParse — priority', () => {
  it('reads urgency words as urgent', () => {
    for (const word of ['urgent', 'asap', 'immediately', 'right away', 'critical']) {
      expect(smartParse(`send the report ${word}`).priority).toBe('urgent')
    }
  })

  it('reads importance as high', () => {
    expect(smartParse('important: sign the lease').priority).toBe('high')
    expect(smartParse('high priority review').priority).toBe('high')
  })

  it('reads slack words as low', () => {
    for (const word of ['whenever', 'sometime', 'no rush', 'eventually']) {
      expect(smartParse(`tidy the store ${word}`).priority).toBe('low')
    }
  })

  it('defaults to normal when nothing signals urgency', () => {
    expect(smartParse('collect the parcel').priority).toBe('normal')
  })

  it('prefers urgent over high when both appear', () => {
    expect(smartParse('urgent and important').priority).toBe('urgent')
  })
})

describe('smartParse — expected period', () => {
  it('defaults to this week', () => {
    expect(smartParse('call the bank').expected).toBe('This Week')
  })

  it('picks up today and tonight', () => {
    expect(smartParse('pay the bill today').expected).toBe('Today')
    expect(smartParse('lock up tonight').expected).toBe('Today')
  })

  it('picks up next week and this month', () => {
    expect(smartParse('send it next week').expected).toBe('Next Week')
    expect(smartParse('file taxes this month').expected).toBe('This Month')
    expect(smartParse('settle by end of the month').expected).toBe('This Month')
  })

  it('treats tomorrow and named days as this week', () => {
    expect(smartParse('deliver tomorrow').expected).toBe('This Week')
    expect(smartParse('meet on friday').expected).toBe('This Week')
  })
})

describe('smartParse — contact matching', () => {
  const felicia = SAMPLE_CONTACTS.find((c) => c.id === 'felicia')!

  it('matches a known contact by first name', () => {
    const p = smartParse('ask Felicia to send the files')
    expect(p.contactId).toBe('felicia')
    expect(p.contactName).toBe(felicia.name)
  })

  it('matches on the full name too', () => {
    expect(smartParse(`remind ${felicia.name} about the meeting`).contactId).toBe('felicia')
  })

  it('leaves the contact unset when nobody is named', () => {
    const p = smartParse('buy milk')
    expect(p.contactId).toBeUndefined()
    expect(p.contactName).toBeUndefined()
  })

  it('does not match a name embedded in a longer word', () => {
    // "Ben" must not match inside "bench" — the regex is word-bounded.
    expect(smartParse('fix the bench').contactId).toBeUndefined()
  })
})

describe('smartParse — title cleanup', () => {
  it('strips the leading instruction and the contact name', () => {
    const p = smartParse('ask Felicia to send the files today')
    expect(p.title.toLowerCase()).toContain('send the files')
    expect(p.title.toLowerCase()).not.toContain('felicia')
    expect(p.title.toLowerCase()).not.toContain('today')
  })

  it('removes priority words from the title', () => {
    expect(smartParse('urgent: clean the washroom').title.toLowerCase()).not.toContain('urgent')
  })

  it('capitalises the first letter', () => {
    expect(smartParse('collect the parcel').title).toBe('Collect the parcel')
  })

  it('never returns an empty title, even if every word was stripped', () => {
    const p = smartParse('urgent today')
    expect(p.title.length).toBeGreaterThan(0)
  })

  it('collapses the double spaces left behind by stripping', () => {
    expect(smartParse('ask Felicia to send  the files')?.title).not.toMatch(/\s{2,}/)
  })

  it('handles an empty input without throwing', () => {
    expect(() => smartParse('')).not.toThrow()
    expect(() => smartParse('   ')).not.toThrow()
  })
})
