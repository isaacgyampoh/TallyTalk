import { describe, expect, it, vi } from 'vitest'
import { readableAuthError } from './authErrors'

/**
 * The live site showed a real person "Unsupported phone provider" when they
 * asked for a code. These pin what reaches the screen.
 */
describe('readableAuthError', () => {
  it('turns a server misconfiguration into something a person can act on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const shown = readableAuthError(new Error('Unsupported phone provider'))
    expect(shown).not.toMatch(/provider/i)
    expect(shown).toMatch(/can't send codes by text/i)
    expect(shown).toMatch(/on our side/i)
  })

  it('still logs the original, because that is for us', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    readableAuthError(new Error('Unsupported phone provider'))
    expect(spy.mock.calls[0].join(' ')).toContain('Unsupported phone provider')
  })

  it('covers the other ways the SMS path fails on the server', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const m of [
      'phone_provider_disabled',
      'Signups not allowed for otp',
      'Error sending confirmation sms',
    ]) {
      expect(readableAuthError(new Error(m)), m).toMatch(/can't send codes by text/i)
    }
  })

  it('explains a dead connection rather than showing "Failed to fetch"', () => {
    expect(readableAuthError(new TypeError('Failed to fetch'))).toMatch(/can't reach the server/i)
  })

  it('passes through a message the person can actually use', () => {
    const rate = 'For security purposes, you can only request this after 54 seconds.'
    expect(readableAuthError(new Error(rate))).toBe(rate)
    expect(readableAuthError(new Error('Token has expired or is invalid'))).toMatch(/expired/i)
  })
})
