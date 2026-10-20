import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { OfflineBar } from '@/components/OfflineBar'
import {
  BackIcon,
  BellIcon,
  CheckIcon,
  CommentIcon,
  UrgentIcon,
  WandIcon,
} from '@/components/icons'
import { useMarkNotificationsRead, useNotifications } from '@/data/hooks'
import { routeForNotificationRow, type NotificationRow } from '@/data/notifications'
import { agoLabel } from '@/lib/time'

/**
 * Everything that happened while you were away.
 *
 * This is the record, not a mirror of push delivery: a notification lands here
 * whether or not a push reached the device, whether the category was muted,
 * and whether the person has ever granted notification permission. It is the
 * reason the app is still useful on a phone that cannot receive push at all.
 */
export function NotificationsScreen() {
  const nav = useNavigate()
  const { data, isPending, isError, refetch } = useNotifications()
  const { some, all } = useMarkNotificationsRead()

  const rows = data ?? []
  const unread = rows.filter((n) => !n.read_at)

  function open(n: NotificationRow) {
    if (!n.read_at) some.mutate([n.id])
    const route = routeForNotificationRow(n)
    if (route) nav(route)
  }

  return (
    <div className="app-frame">
      <OfflineBar />
      <ScreenHeader
        title="Notifications"
        right={
          <div className="flex items-center gap-1">
            {unread.length > 0 && (
              <button
                onClick={() => all.mutate()}
                disabled={all.isPending}
                className="press rounded-full px-3 py-1.5 text-[13px] font-semibold text-violet-ink"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => nav(-1)}
              aria-label="Back"
              className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft"
            >
              <BackIcon width={20} height={20} />
            </button>
          </div>
        }
      />

      <ul className="flex-1 overflow-y-auto px-3 pb-8">
        {isPending && <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading…</li>}
        {isError && (
          <li className="px-3 py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load your notifications.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </li>
        )}
        {!isPending && !isError && rows.length === 0 && (
          <li className="px-6 py-10 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-wash text-ink-faint">
              <BellIcon width={22} height={22} />
            </span>
            <p className="text-[15px] text-ink-soft">
              Nothing yet. Tasks, pokes and replies will appear here.
            </p>
          </li>
        )}
        {rows.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => open(n)}
              className={`press flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash ${
                n.read_at ? '' : 'bg-violet/[0.04]'
              }`}
            >
              <span
                className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONE[n.category]}`}
              >
                <Glyph category={n.category} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-[15px] ${
                      n.read_at ? 'text-ink-soft' : 'font-semibold text-ink'
                    }`}
                  >
                    {n.title}
                  </span>
                  <span className="stamp shrink-0">{agoLabel(n.created_at)}</span>
                </span>
                {n.body && (
                  <span className="mt-0.5 block truncate text-[13.5px] text-ink-soft">
                    {n.body}
                  </span>
                )}
              </span>
              {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TONE: Record<NotificationRow['category'], string> = {
  assignments: 'bg-violet/10 text-violet-ink',
  updates: 'bg-ink/5 text-ink-soft',
  comments: 'bg-owed text-ink-soft',
  pokes: 'bg-urgent/10 text-urgent-ink',
}

function Glyph({ category }: { category: NotificationRow['category'] }) {
  const size = { width: 17, height: 17 }
  if (category === 'pokes') return <WandIcon {...size} />
  if (category === 'comments') return <CommentIcon {...size} />
  if (category === 'updates') return <CheckIcon {...size} />
  return <UrgentIcon {...size} />
}
