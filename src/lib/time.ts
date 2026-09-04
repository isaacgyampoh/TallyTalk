// Timestamps for task threads. Rows carry a coarse "2 days ago" stamp; comments
// inside a task carry a clock time, the way a chat does.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** An ISO timestamp n days back — keeps seeded threads reading the same over time. */
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString()
}

/** An ISO timestamp n minutes back. */
export function minutesAgo(n: number): string {
  return new Date(Date.now() - n * MINUTE).toISOString()
}

/** "2 days ago" — task rows render it uppercase. */
export function agoLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  }
  const d = Math.floor(diff / DAY)
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** "7:56 AM" — the stamp on a comment. */
export function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
