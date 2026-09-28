import { useOnline } from '@/hooks/useOnline'

/**
 * One connection notice for the whole app, rather than an offline branch on
 * every screen. It explains why things are failing; it does not block the UI,
 * because cached data stays readable and a request may well still succeed.
 */
export function OfflineBar() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-overdue px-4 py-1.5 text-[12.5px] font-semibold text-white"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white" />
      No connection — showing what was last loaded
    </div>
  )
}
