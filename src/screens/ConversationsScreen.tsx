import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { OfflineBar } from '@/components/OfflineBar'
import { Avatar } from '@/components/Avatar'
import { useState } from 'react'
import { BackIcon, CloseIcon, CommentIcon, SearchIcon } from '@/components/icons'
import { useConversations, useMessageSearch } from '@/data/hooks'
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
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  // Across every conversation, and only ever the ones this person may read:
  // search_messages runs as the caller, so RLS decides what can match.
  const hits = useMessageSearch(query)
  const searchingNow = query.trim().length >= 2

  return (
    <div className="app-frame">
      <OfflineBar />
      <ScreenHeader
        title="Messages"
        right={
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                setSearching((s) => !s)
                setQuery('')
              }}
              aria-label={searching ? 'Close search' : 'Search messages'}
              className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft"
            >
              {searching ? (
                <CloseIcon width={19} height={19} />
              ) : (
                <SearchIcon width={20} height={20} />
              )}
            </button>
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

      {searching && (
        <div className="px-4 pb-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all messages"
            aria-label="Search all messages"
            className="field h-10"
          />
        </div>
      )}

      {searchingNow && (
        <ul className="flex-1 overflow-y-auto px-3 pb-8">
          {hits.isPending && (
            <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Searching…</li>
          )}
          {!hits.isPending && (hits.data ?? []).length === 0 && (
            <li className="px-6 py-10 text-center text-[15px] text-ink-soft">
              Nothing matches that.
            </li>
          )}
          {(hits.data ?? []).map((h) => (
            <li key={h.id}>
              <button
                onClick={() =>
                  nav(h.group_id ? `/groups/${h.group_id}/chat` : `/contacts/${h.sender_id}/chat`)
                }
                className="press w-full rounded-2xl px-3 py-3 text-left hover:bg-wash"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-violet-ink">
                    {h.group_id ? 'In a group' : 'Conversation'}
                  </span>
                  <span className="stamp shrink-0">{agoLabel(h.created_at)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[14.5px] text-ink">{h.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
          <li key={`${c.kind}:${c.id}`}>
            <button
              onClick={() =>
                nav(c.kind === 'group' ? `/groups/${c.id}/chat` : `/contacts/${c.id}/chat`)
              }
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
            >
              <Avatar
                initials={
                  c.kind === 'group' ? c.display_name.slice(0, 2) : initialsFrom(c.display_name)
                }
                color={c.kind === 'group' ? '#6600FF' : colorFor(c.id)}
                size={44}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                    {c.display_name}
                    {c.kind === 'group' && c.members !== null && (
                      <span className="ml-1.5 text-[12px] font-normal text-ink-faint">
                        {c.members} members
                      </span>
                    )}
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
