/**
 * Whether the app can actually reach anything.
 *
 * `navigator.onLine` is the usual signal and it is not enough. In the Android
 * WebView it stays `true` with wifi and mobile data switched off — verified on
 * a Pixel 9 Pro XL: the flag said online while every request failed with
 * "Failed to fetch". A connection notice driven by that flag alone simply
 * never appears in the native app.
 *
 * So requests get a vote. The data layer reports what happened to them, and a
 * run of network failures counts as offline until something succeeds. That is
 * also closer to what a person means by "offline": not whether an interface is
 * up, but whether anything is getting through.
 */

// One is enough. isNetworkError already excludes the server answering — a
// policy refusal, a 404 — so what is left is the request never arriving. On
// the Pixel a single failing screen is exactly when someone wants to be told.
const FAILURES_BEFORE_OFFLINE = 1

let consecutiveFailures = 0
const listeners = new Set<() => void>()

function announce() {
  listeners.forEach((fn) => fn())
}

/** A request got through, or did not. Called by the data layer. */
export function reportReachable(reached: boolean): void {
  const wasOffline = consecutiveFailures >= FAILURES_BEFORE_OFFLINE
  consecutiveFailures = reached ? 0 : consecutiveFailures + 1
  const isOffline = consecutiveFailures >= FAILURES_BEFORE_OFFLINE
  if (wasOffline !== isOffline) announce()
}

/** True when the browser says so, or when requests keep failing. */
export function isOnline(): boolean {
  const flagged = typeof navigator === 'undefined' ? true : navigator.onLine
  return flagged && consecutiveFailures < FAILURES_BEFORE_OFFLINE
}

export function subscribeToConnection(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Does this error look like the network rather than the server?
 *
 * Reading `.message` off a plain object matters: supabase-js hands back an
 * error that is not an Error instance, so `String(err)` is "[object Object]"
 * and matched nothing. That is why the connection notice stayed hidden on the
 * Pixel even after the rest of this was in place.
 */
export function isNetworkError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: unknown }).message)
        : String(err)
  return /failed to fetch|networkerror|network request failed|load failed|err_internet/i.test(
    message,
  )
}

/** Exposed for tests: forget what has been seen. */
export function resetConnectionState(): void {
  consecutiveFailures = 0
}
