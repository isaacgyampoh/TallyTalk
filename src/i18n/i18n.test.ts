import { describe, expect, it } from 'vitest'
import { CATALOGUES, coverage, en, isTranslated, translate } from './index'

describe('translate', () => {
  it('returns the English string', () => {
    expect(translate('en', 'auth.phone.send')).toBe('Send code')
  })

  it('falls back to English for a language with no catalogue', () => {
    expect(translate('tw', 'auth.phone.send')).toBe('Send code')
  })

  it('falls back per key, so a partial catalogue is useful immediately', () => {
    CATALOGUES.test = { 'auth.phone.send': 'Soma koodu' }
    expect(translate('test', 'auth.phone.send')).toBe('Soma koodu')
    expect(translate('test', 'auth.phone.label')).toBe('Mobile number')
    delete CATALOGUES.test
  })

  it('never shows a key to a user', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(translate('tw', key), `${key} fell through to the key`).not.toBe(key)
    }
  })

  it('substitutes placeholders', () => {
    expect(translate('en', 'auth.code.body', { phone: '+233241234567' })).toBe(
      'We texted a code to +233241234567.',
    )
  })

  it('leaves an unknown placeholder alone rather than printing "undefined"', () => {
    expect(translate('en', 'auth.code.body', { wrong: 'x' })).toContain('{phone}')
  })
})

describe('the catalogues we ship', () => {
  it('has a complete English catalogue', () => {
    expect(coverage('en')).toBe(1)
  })

  it('ships no catalogue with keys English does not have', () => {
    // A stale key means a string was renamed and a translator's work is now
    // orphaned — silently, since the fallback hides it.
    const english = new Set(Object.keys(en))
    for (const [lang, catalogue] of Object.entries(CATALOGUES)) {
      for (const key of Object.keys(catalogue)) {
        expect(english.has(key), `${lang} has an unknown key "${key}"`).toBe(true)
      }
    }
  })

  it('ships no machine-translated catalogue', () => {
    // The rule in src/i18n/README.md: a catalogue goes in when a speaker has
    // written it. Today that is English only, and this test is how the rule
    // becomes visible when someone adds one.
    expect(Object.keys(CATALOGUES)).toEqual(['en'])
  })

  it('reports an untranslated language as untranslated', () => {
    expect(isTranslated('tw')).toBe(false)
    expect(isTranslated('en')).toBe(true)
  })

  it('has no placeholder that cannot be filled', () => {
    // Every {placeholder} must be one a caller actually passes; a typo here
    // shows as literal braces on screen.
    const allowed = new Set(['app', 'phone', 'terms', 'privacy', 'name', 'count'])
    for (const [key, value] of Object.entries(en)) {
      for (const [, name] of value.matchAll(/\{(\w+)\}/g)) {
        expect(allowed.has(name), `${key} uses an unexpected placeholder {${name}}`).toBe(true)
      }
    }
  })
})
