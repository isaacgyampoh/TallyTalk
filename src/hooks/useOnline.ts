import { useEffect, useState } from 'react'

/**
 * Whether the device believes it has a connection.
 *
 * `navigator.onLine` is a weak signal — it reports the network interface, not
 * whether anything is reachable — so this is used to explain a failure the user
 * is already seeing, never to decide whether to attempt a request. Requests are
 * always attempted; the query's own error state remains the source of truth.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
