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

  it('hides a failure from the SMS hook itself', () => {
    // What GoTrue actually said once Arkesel was wired up and refused a send.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const shown = readableAuthError(new Error('Unexpected status code returned from hook: 502'))
    expect(shown).not.toMatch(/hook|502/i)
    expect(shown).toMatch(/can't send codes by text/i)
  })

  it('covers the other ways the SMS path fails on the server', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const m of [
      'phone_provider_disabled',
      'Signups not allowed for otp',
      'Error sending confirmation sms',
      'unexpected_failure',
    ]) {
      expect(readableAuthError(new Error(m)), m).toMatch(/can't send codes by text/i)
    }
  })

  it('never shows a message with no words in it', () => {
    // supabase-js turns a 500 into AuthRetryableFetchError with message "{}",
    // which is exactly what the live site displayed to a user.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const retryable = Object.assign(new Error('{}'), {
      status: 500,
      name: 'AuthRetryableFetchError',
    })
    expect(readableAuthError(retryable, 'send')).toMatch(/can't send codes by text/i)
    expect(readableAuthError(retryable, 'send')).not.toContain('{}')
  })

  it('treats any 5xx as our problem, whatever it says', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = Object.assign(new Error('internal error'), { status: 503 })
    expect(readableAuthError(boom, 'send')).toMatch(/can't send codes by text/i)
  })

  it('does not blame SMS when the failure happened while checking a code', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = Object.assign(new Error('{}'), { status: 500 })
    const shown = readableAuthError(boom, 'verify')
    expect(shown).toMatch(/on our side/i)
    expect(shown).not.toMatch(/send codes by text/i)
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
