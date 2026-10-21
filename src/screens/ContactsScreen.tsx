import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { SearchIcon, PlusIcon, BellIcon, CommentIcon } from '@/components/icons'
import { type Contact } from '@/data/viewTypes'
import {
  useContacts,
  useContactRequests,
  useNotifications,
  useRespondToContactRequest,
  useUnreadMessages,
} from '@/data/hooks'
import { initialsFrom, colorFor } from '@/data/mappers'
import { AddContactSheet } from '@/components/AddContactSheet'

const FILTERS = ['All', 'Unread', 'Work', 'Favorites', 'Urgent', 'Overdue', 'Newest'] as const
type Filter = (typeof FILTERS)[number]

function applyFilter(contacts: Contact[], filter: Filter, q: string): Contact[] {
  let list = contacts
  switch (filter) {
    case 'Unread':
      list = list.filter((c) => c.unread)
      break
    case 'Work':
      list = list.filter((c) => c.work)
      break
    case 'Favorites':
      list = list.filter((c) => c.favorite)
      break
    case 'Urgent':
      list = list.filter((c) => c.urgent > 0)
      break
    case 'Overdue':
      list = list.filter((c) => c.overdue > 0)
      break
    default:
      break
  }
  if (q.trim()) {
    const needle = q.toLowerCase()
    list = list.filter((c) => c.name.toLowerCase().includes(needle))
  }
  return list
}

export function ContactsScreen() {
  const nav = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')
  const [q, setQ] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [picking, setPicking] = useState(false)

  const { data: contacts, isPending, isError, refetch } = useContacts()
  const { data: notifications } = useNotifications()
  const unread = (notifications ?? []).filter((n) => !n.read_at).length
  const { data: unreadMessages } = useUnreadMessages()
  const { incoming } = useContactRequests()
  const { respond } = useRespondToContactRequest()
  const waiting = incoming.data ?? []
  const all = useMemo(() => contacts ?? [], [contacts])
  const rows = useMemo(() => applyFilter(all, filter, q), [all, filter, q])

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader
        title="Contacts"
        right={
          <div className="flex items-center gap-0.5">
            <button
              className="press relative grid h-10 w-10 place-items-center rounded-full text-ink-soft"
              aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : 'Messages'}
              onClick={() => nav('/messages')}
            >
              <CommentIcon width={21} height={21} />
              {!!unreadMessages && (
                <span className="nums absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
            <button
              className="press relative grid h-10 w-10 place-items-center rounded-full text-ink-soft"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              onClick={() => nav('/notifications')}
            >
              <BellIcon width={21} height={21} />
              {unread > 0 && (
                <span className="nums absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button
              className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft"
              aria-label="Search"
              onClick={() => setShowSearch((s) => !s)}
            >
              <SearchIcon width={22} height={22} />
            </button>
          </div>
        }
      />

      {showSearch && (
        <div className="px-5 pb-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            className="field"
          />
        </div>
      )}

      {/* Filter chips — each also hints at counts in the spec; kept quiet here. */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`press whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              filter === f ? 'bg-carbon text-white' : 'bg-wash text-ink-soft'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {waiting.length > 0 && (
        <section className="px-3 pb-3">
          <h2 className="eyebrow mb-2 px-1">Wants to connect</h2>
          <ul className="overflow-hidden rounded-card border border-line">
            {waiting.map((r, i) => {
              const name = r.profile?.display_name ?? 'Someone'
              return (
                <li key={r.id} className={i > 0 ? 'border-t border-line' : ''}>
                  <div className="flex items-center gap-3 px-3 py-3">
                    <Avatar initials={initialsFrom(name)} color={colorFor(r.from_user)} size={36} />
                    <p className="min-w-0 flex-1 truncate text-[15px] text-ink">
                      <span className="font-semibold">{name}</span>
                    </p>
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: false })}
                      disabled={respond.isPending}
                      className="press rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => respond.mutate({ id: r.id, accept: true })}
                      disabled={respond.isPending}
                      className="press rounded-full bg-violet px-3.5 py-1.5 text-[13px] font-semibold text-white"
                    >
                      Accept
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {isPending && (
        <div className="flex-1 px-5 pt-10 text-center">
          <p className="text-[15px] text-ink-soft">Loading your contacts…</p>
        </div>
      )}

      {isError && (
        <div className="flex-1 px-8 pt-10 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">
            We couldn&rsquo;t load your contacts
          </p>
          <p className="mt-2 text-[14px] text-ink-soft">Check your connection and try again.</p>
          <button onClick={() => refetch()} className="btn-ghost mt-5">
            Try again
          </button>
        </div>
      )}

      <ul className={`flex-1 overflow-y-auto px-2 pb-24 ${isPending || isError ? 'hidden' : ''}`}>
        {rows.map((c, i) => (
          <li
            key={c.id}
            className="animate-rise-in"
            style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
          >
            <button
              onClick={() => nav(`/contacts/${c.id}`)}
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
            >
              <div className="relative">
                <Avatar initials={c.initials} color={c.color} />
                {c.unread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-paper bg-violet" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold text-ink">{c.name}</span>
                  <OweLedger contact={c} />
                </div>
                <p className="mt-0.5 truncate text-[13.5px] text-ink-faint">{c.lastActivity}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.overdue > 0 && <Tag tone="overdue">{c.overdue} overdue</Tag>}
                  {c.urgent > 0 && <Tag tone="urgent">{c.urgent} urgent</Tag>}
                </div>
              </div>
            </button>
          </li>
        ))}

        {rows.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">Nobody here yet</p>
            <p className="mt-1 text-[14px] text-ink-soft">
              No contacts match “{filter}”. Try another filter, or start a request.
            </p>
          </div>
        )}
      </ul>

      {/* Floating add — context-sensitive per section (spec). Contacts = new request. */}
      <button
        className="press absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-violet text-white shadow-float"
        aria-label="New request"
        onClick={() => setPicking(true)}
      >
        <PlusIcon width={26} height={26} />
      </button>

      {picking && (
        <AddContactSheet
          onClose={() => setPicking(false)}
          onAdded={(contactId) => {
            setPicking(false)
            nav(`/contacts/${contactId}`)
          }}
        />
      )}
    </div>
  )
}

/** "3 for Ben · 2 for you" — the signature ledger. */
function OweLedger({ contact }: { contact: Contact }) {
  return (
    <span className="nums shrink-0 text-[12.5px] font-semibold">
      {contact.forThem > 0 && <span className="text-violet-ink">{contact.forThem} for them</span>}
      {contact.forThem > 0 && contact.forYou > 0 && <span className="text-ink-faint"> · </span>}
      {contact.forYou > 0 && <span className="text-ink-soft">{contact.forYou} for you</span>}
      {contact.forThem === 0 && contact.forYou === 0 && (
        <span className="text-ink-faint">all clear</span>
      )}
    </span>
  )
}

function Tag({ tone, children }: { tone: 'overdue' | 'urgent'; children: React.ReactNode }) {
  const cls = tone === 'overdue' ? 'bg-overdue/10 text-overdue-ink' : 'bg-urgent/10 text-urgent-ink'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
  )
}
