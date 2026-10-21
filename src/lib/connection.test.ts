import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isNetworkError,
  isOnline,
  reportReachable,
  resetConnectionState,
  subscribeToConnection,
} from './connection'

function setFlag(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

beforeEach(() => {
  resetConnectionState()
  setFlag(true)
})

describe('isOnline', () => {
  it('believes the browser when it says offline', () => {
    setFlag(false)
    expect(isOnline()).toBe(false)
  })

  it('does not believe it when a request fails to reach anything', () => {
    // The case that matters: in the Android WebView navigator.onLine stays
    // true with wifi and mobile data off, while every request fails.
    setFlag(true)
    reportReachable(false)
    expect(isOnline()).toBe(false)
  })

  it('comes back as soon as something gets through', () => {
    reportReachable(false)
    expect(isOnline()).toBe(false)
    reportReachable(true)
    expect(isOnline()).toBe(true)
  })
})

describe('subscribers', () => {
  it('hear about a change, and only a change', () => {
    const heard = vi.fn()
    const stop = subscribeToConnection(heard)
    reportReachable(false)
    expect(heard).toHaveBeenCalledTimes(1)
    reportReachable(false)
    expect(heard).toHaveBeenCalledTimes(1) // no change, no noise
    reportReachable(true)
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
    reportReachable(false)
    expect(heard).toHaveBeenCalledTimes(2)
  })
})

describe('isNetworkError', () => {
  it('recognises the shapes a dead connection takes', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch'))).toBe(true)
    expect(isNetworkError(new Error('Load failed'))).toBe(true)
  })

  it('reads an error that is not an Error, which is what supabase-js returns', () => {
    // String({message: 'Failed to fetch'}) is "[object Object]", which matched
    // nothing — and kept the connection notice hidden on a real device.
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(isNetworkError({ message: 'Load failed', details: null })).toBe(true)
  })

  it('does not mistake a server refusal for a dead connection', () => {
    // A 403 is the server answering, which means the network is fine.
    expect(isNetworkError(new Error('new row violates row-level security policy'))).toBe(false)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
    expect(isNetworkError({ message: 'new row violates row-level security policy' })).toBe(false)
  })
})
