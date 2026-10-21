import { useEffect, useState } from 'react'
import { isOnline, subscribeToConnection } from '@/lib/connection'

/**
 * Whether the device believes it has a connection.
 *
 * `navigator.onLine` is a weak signal — it reports the network interface, not
 * whether anything is reachable — so this is used to explain a failure the user
 * is already seeing, never to decide whether to attempt a request. Requests are
 * always attempted; the query's own error state remains the source of truth.
 *
 * It is also not merely weak but wrong on Android: in the WebView it stays
 * true with the radios off. So this combines it with what requests actually
 * did — see lib/connection.ts.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline)

  useEffect(() => {
    // Re-read on mount: an `offline` event that fires between the first render
    // and this listener being attached is gone for good, and the bar would
    // never appear for the rest of the session.
    const sync = () => setOnline(isOnline())
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    const unsubscribe = subscribeToConnection(sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      unsubscribe()
    }
  }, [])

  return online
}
