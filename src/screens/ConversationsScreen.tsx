import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { OfflineBar } from '@/components/OfflineBar'
import { Avatar } from '@/components/Avatar'
import { BackIcon, CommentIcon } from '@/components/icons'
import { useConversations } from '@/data/hooks'
import { initialsFrom, colorFor } from '@/data/mappers'
import { agoLabel } from '@/lib/time'

/**
 * Everyone you have actually exchanged messages with.
 *
 * A contact you have never written to is not a conversation — this list is
 * what was said, not who could be said something.
 */
export function ConversationsScreen() {
  const nav = useNavigate()
  const { data, isPending, isError, refetch } = useConversations()
  const rows = data ?? []

  return (
    <div className="app-frame">
      <OfflineBar />
      <ScreenHeader
        title="Messages"
        right={
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft"
          >
            <BackIcon width={20} height={20} />
          </button>
        }
      />

      <ul className="flex-1 overflow-y-auto px-3 pb-8">
        {isPending && <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading…</li>}
        {isError && (
          <li className="px-3 py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load your messages.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </li>
        )}
        {!isPending && !isError && rows.length === 0 && (
          <li className="px-6 py-10 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-wash text-ink-faint">
              <CommentIcon width={22} height={22} />
            </span>
            <p className="text-[15px] text-ink-soft">
              No messages yet. Open a contact and say something.
            </p>
          </li>
        )}
        {rows.map((c) => (
          <li key={c.contact_id}>
            <button
              onClick={() => nav(`/contacts/${c.contact_id}/chat`)}
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
            >
              <Avatar
                initials={initialsFrom(c.display_name)}
                color={colorFor(c.contact_id)}
                size={44}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                    {c.display_name}
                  </span>
                  <span className="stamp shrink-0">{agoLabel(c.last_at)}</span>
                </span>
                <span
                  className={`mt-0.5 block truncate text-[13.5px] ${
                    c.unread > 0 ? 'font-medium text-ink' : 'text-ink-soft'
                  }`}
                >
                  {c.last_mine && <span className="text-ink-faint">You: </span>}
                  {c.last_body}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="nums grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-violet px-1.5 text-[11px] font-bold text-white">
                  {c.unread > 9 ? '9+' : c.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
