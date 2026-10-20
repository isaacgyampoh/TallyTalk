import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retryImport } from './retryImport'

/** Fails the first `failures` calls, then resolves. */
function flaky(failures: number) {
  let calls = 0
  const load = () => {
    calls++
    return calls <= failures
      ? Promise.reject(new Error('Failed to fetch dynamically imported module'))
      : Promise.resolve({ ok: true })
  }
  return { load, calls: () => calls }
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })
}

let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  setOnline(true)
  sessionStorage.clear()
  reload = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('retryImport', () => {
  it('returns the module when the first attempt works', async () => {
    const f = flaky(0)
    await expect(retryImport(f.load, { reload })).resolves.toEqual({ ok: true })
    expect(f.calls()).toBe(1)
    expect(reload).not.toHaveBeenCalled()
  })

  it('recovers from a chunk fetch that fails while the network is up', async () => {
    const f = flaky(2)
    const p = retryImport(f.load, { reload })
    await vi.runAllTimersAsync()
    await expect(p).resolves.toEqual({ ok: true })
    expect(f.calls()).toBe(3)
    expect(reload).not.toHaveBeenCalled()
  })

  it('backs off further each time, instead of hammering', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout')
    // It ends in a reload, so the promise is never meant to settle: advance the
    // clock and read the waits it asked for.
    retryImport(flaky(99).load, { reload })
    await vi.runAllTimersAsync()
    const waits = spy.mock.calls.map((c) => c[1] as number).filter((ms) => ms >= BACKOFF)
    expect(waits).toEqual([500, 1000])
    spy.mockRestore()
  })

  it('reloads rather than showing the error screen when retries run out', async () => {
    const f = flaky(99)
    retryImport(f.load, { reload })
    await vi.runAllTimersAsync()
    expect(f.calls()).toBe(3)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never resolves once it has decided to reload, so no screen renders', async () => {
    let settled = false
    retryImport(flaky(99).load, { reload }).then(
      () => (settled = true),
      () => (settled = true),
    )
    await vi.runAllTimersAsync()
    expect(reload).toHaveBeenCalled()
    expect(settled).toBe(false)
  })

  it('waits for the network instead of spending attempts while offline', async () => {
    setOnline(false)
    const f = flaky(99)
    retryImport(f.load, { reload })
    await vi.advanceTimersByTimeAsync(30_000)
    // No amount of time helps a phone with no signal, so nothing is retried.
    expect(f.calls()).toBe(1)
    expect(reload).not.toHaveBeenCalled()

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await vi.runAllTimersAsync()
    // The browser remembers the failed module, so coming back online means
    // reloading the page, not importing again.
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening once the network returns, so retries cannot stack up', async () => {
    setOnline(false)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    retryImport(flaky(99).load, { reload })
    await vi.advanceTimersByTimeAsync(10)
    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await vi.runAllTimersAsync()
    const added = add.mock.calls.filter(([e]) => e === 'online').length
    const removed = remove.mock.calls.filter(([e]) => e === 'online').length
    expect(added).toBeGreaterThan(0)
    expect(removed).toBe(added)
    add.mockRestore()
    remove.mockRestore()
  })

  it('surfaces the error rather than reloading twice in a row', async () => {
    // A chunk that is genuinely gone — a stale deploy — must not loop.
    retryImport(flaky(99).load, { reload })
    await vi.runAllTimersAsync()
    expect(reload).toHaveBeenCalledTimes(1)

    const second = retryImport(flaky(99).load, { reload }).catch((e: Error) => e.message)
    await vi.runAllTimersAsync()
    expect(await second).toMatch(/dynamically imported/)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

const BACKOFF = 500
