import { beforeEach, describe, expect, it } from 'vitest'
import { LANGUAGES, getLanguage, hasChosenLanguage, setLanguage } from './language'

beforeEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
})

describe('LANGUAGES', () => {
  it('leads with English and covers the launch market', () => {
    expect(LANGUAGES[0].code).toBe('en')
    const codes = LANGUAGES.map((l) => l.code)
    expect(codes).toContain('tw')
    expect(codes).toContain('gaa')
  })

  it('has no duplicate codes, which would make the radio group ambiguous', () => {
    const codes = LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('names every language in its own language as well as English', () => {
    for (const l of LANGUAGES) {
      expect(l.name.length).toBeGreaterThan(0)
      expect(l.english.length).toBeGreaterThan(0)
    }
  })
})

describe('getLanguage / setLanguage', () => {
  it('defaults to English before anything is chosen', () => {
    expect(getLanguage()).toBe('en')
    expect(hasChosenLanguage()).toBe(false)
  })

  it('remembers a choice', () => {
    setLanguage('tw')
    expect(getLanguage()).toBe('tw')
    expect(hasChosenLanguage()).toBe(true)
  })

  it('ignores a stored value that is not a language we offer', () => {
    // A code removed in a later release must not leave the picker stuck.
    localStorage.setItem('tt.language', 'klingon')
    expect(getLanguage()).toBe('en')
  })
})
