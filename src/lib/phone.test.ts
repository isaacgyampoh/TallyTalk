import { describe, expect, it } from 'vitest'
import { digitsOnly, looksDiallable, sameNumber, toE164 } from './phone'

describe('toE164', () => {
  it('drops the domestic leading zero', () => {
    // 024 412 3456 in Ghana is +233 24 412 3456, not +233 024 412 3456.
    expect(toE164('+233', '0244123456')).toBe('+233244123456')
  })

  it('accepts a number typed without the zero', () => {
    expect(toE164('+233', '244123456')).toBe('+233244123456')
  })

  it('ignores spaces and punctuation people type', () => {
    expect(toE164('+233', '024 412 3456')).toBe('+233244123456')
    expect(toE164('+233', '(024) 412-3456')).toBe('+233244123456')
  })

  it('works for the other launch countries', () => {
    expect(toE164('+234', '08031234567')).toBe('+2348031234567')
    expect(toE164('+44', '07700900123')).toBe('+447700900123')
  })
})

describe('sameNumber', () => {
  it('matches the three forms of one number', () => {
    // What the app sends, what GoTrue stores, and what someone pastes.
    expect(sameNumber('+233244123456', '233244123456')).toBe(true)
    expect(sameNumber('+233 244 123 456', '233244123456')).toBe(true)
  })

  it('does not match two different numbers', () => {
    expect(sameNumber('+233244123456', '+233244123457')).toBe(false)
  })

  it('is false for nothing, rather than matching everything', () => {
    expect(sameNumber('', '')).toBe(false)
    expect(sameNumber('+++', 'abc')).toBe(false)
  })
})

describe('looksDiallable', () => {
  it('needs enough digits to be worth a lookup', () => {
    expect(looksDiallable('24412')).toBe(false)
    expect(looksDiallable('244123')).toBe(true)
  })

  it('does not count the leading zero towards that', () => {
    expect(looksDiallable('024412')).toBe(false)
  })
})

describe('digitsOnly', () => {
  it('strips everything that is not a digit', () => {
    expect(digitsOnly('+233 (24) 412-3456')).toBe('233244123456')
  })
})
