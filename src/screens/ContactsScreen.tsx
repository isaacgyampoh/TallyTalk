import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { SearchIcon, PlusIcon } from '@/components/icons'
import { SAMPLE_CONTACTS, type SampleContact } from '@/lib/sampleData'

const FILTERS = ['All', 'Unread', 'Work', 'Favorites', 'Urgent', 'Overdue', 'Newest'] as const
type Filter = (typeof FILTERS)[number]

function applyFilter(contacts: SampleContact[], filter: Filter, q: string): SampleContact[] {
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

  const rows = useMemo(() => applyFilter(SAMPLE_CONTACTS, filter, q), [filter, q])

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader
        title="Contacts"
        right={
          <button
            className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft"
            aria-label="Search"
            onClick={() => setShowSearch((s) => !s)}
          >
            <SearchIcon width={22} height={22} />
          </button>
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

      <ul className="flex-1 overflow-y-auto px-2 pb-24">
        {rows.map((c, i) => (
          <li key={c.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
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
        onClick={() => nav('/contacts/ben')}
      >
        <PlusIcon width={26} height={26} />
      </button>
    </div>
  )
}

/** "3 for Ben · 2 for you" — the signature ledger. */
function OweLedger({ contact }: { contact: SampleContact }) {
  return (
    <span className="nums shrink-0 text-[12.5px] font-semibold">
      {contact.forThem > 0 && (
        <span className="text-violet-ink">{contact.forThem} for them</span>
      )}
      {contact.forThem > 0 && contact.forYou > 0 && <span className="text-ink-faint"> · </span>}
      {contact.forYou > 0 && <span className="text-ink-soft">{contact.forYou} for you</span>}
      {contact.forThem === 0 && contact.forYou === 0 && (
        <span className="text-ink-faint">all clear</span>
      )}
    </span>
  )
}

function Tag({ tone, children }: { tone: 'overdue' | 'urgent'; children: React.ReactNode }) {
  const cls = tone === 'overdue' ? 'bg-overdue/10 text-overdue' : 'bg-urgent/10 text-urgent'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
  )
}
