/**
 * A dynamic `import()` that survives a flaky network.
 *
 * Screens are code-split, so opening one fetches a chunk. If that fetch is cut
 * off — a phone handing over between cells, a tunnel, a dropped hotspot — the
 * promise rejects, React.lazy caches the rejection permanently, and the whole
 * app drops into the error boundary telling the user to reinstall it. That is
 * the wrong answer to a two-second outage on a mobile network.
 *
 * Retrying the same `import()` is not enough on its own: browsers remember a
 * module that failed to load and refuse the second import without going near
 * the network. So this waits for the connection to come back and then reloads
 * the page, which keeps the URL and lands the user on the screen they asked
 * for. Reloads are rationed, so a chunk that is genuinely missing (a stale
 * deploy, say) surfaces as an error instead of a reload loop.
 */

const ATTEMPTS = 3
const BACKOFF_MS = 500
const RELOAD_MARK = 'tt.chunk-reload'
const RELOAD_EVERY_MS = 60_000

export interface RetryOptions {
  attempts?: number
  /** Overridden in tests; jsdom cannot navigate. */
  reload?: () => void
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function whenOnline(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('online', done)
      resolve()
    }
    window.addEventListener('online', done)
  })
}

/** True if we have not already reloaded for this reason very recently. */
function mayReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0)
    if (Date.now() - last < RELOAD_EVERY_MS) return false
    sessionStorage.setItem(RELOAD_MARK, String(Date.now()))
    return true
  } catch {
    // Private mode, or storage disabled: one reload is still better than a
    // dead app, and the lack of a mark only risks a second one.
    return true
  }
}

export function retryImport<T>(load: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = ATTEMPTS, reload = () => window.location.reload() } = options

  const giveUp = (err: unknown): Promise<T> => {
    if (!mayReload()) throw err
    reload()
    // The page is on its way out; never resolve, so no screen renders meanwhile.
    return new Promise<T>(() => {})
  }

  const attempt = (left: number): Promise<T> =>
    load().catch((err: unknown) => {
      if (offline()) return whenOnline().then(() => giveUp(err))
      if (left <= 1) return giveUp(err)
      return delay(BACKOFF_MS * (attempts - left + 1)).then(() => attempt(left - 1))
    })

  return attempt(attempts)
}
