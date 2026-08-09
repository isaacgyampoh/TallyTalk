import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { SmartAdd } from '@/components/SmartAdd'
import { WandIcon, ContactsIcon, PersonalIcon, GroupsIcon } from '@/components/icons'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'

interface Row extends SampleTask {
  contactId: string
  contactName: string
  initials: string
  color: string
}

export function TodayScreen() {
  const nav = useNavigate()

  const { overdue, dueToday, owedToYou, youOwe, totalThem, totalYou } = useMemo(() => {
    const rows: Row[] = []
    for (const c of SAMPLE_CONTACTS) {
      for (const t of c.tasks) {
        if (t.status === 'completed') continue
        rows.push({
          ...t,
          contactId: c.id,
          contactName: c.name,
          initials: c.initials,
          color: c.color,
        })
      }
    }
    const overdue = rows.filter((r) => r.overdue)
    const dueToday = rows.filter((r) => r.expected === 'Today' && !r.overdue)
    const owedToYou = rows.filter((r) => r.direction === 'they_owe_me' && !r.overdue)
    const youOwe = rows.filter((r) => r.direction === 'i_owe_them' && !r.overdue)
    return {
      overdue,
      dueToday,
      owedToYou,
      youOwe,
      totalThem: rows.filter((r) => r.direction === 'they_owe_me').length,
      totalYou: rows.filter((r) => r.direction === 'i_owe_them').length,
    }
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex h-full flex-col">
      <div className="aura-bg flex-1 overflow-y-auto pb-24">
        {/* assistant greeting */}
        <div className="px-5" style={{ paddingTop: 'calc(var(--safe-top) + 22px)' }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet text-white shadow-float">
              <WandIcon width={22} height={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink-faint">{greeting}</p>
              <h1 className="font-display text-[23px] font-extrabold leading-tight tracking-tight">
                What needs tracking?
              </h1>
            </div>
          </div>
        </div>

        {/* assistant input */}
        <div className="mt-5 px-5">
          <SmartAdd />
        </div>

        {/* quick prompts */}
        <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [&::-webkit-scrollbar]:hidden">
          <Chip Icon={ContactsIcon} label="Send a request" onClick={() => nav('/contacts')} />
          <Chip Icon={WandIcon} label="Poke" onClick={() => nav('/contacts')} />
          <Chip Icon={PersonalIcon} label="Checklists" onClick={() => nav('/personal')} />
          <Chip Icon={GroupsIcon} label="Groups" onClick={() => nav('/groups')} />
        </div>

        <div className="px-5">
          {/* running tally */}
          <div className="mt-6 flex overflow-hidden rounded-card shadow-card">
            <div
              className="flex-1 bg-violet px-4 py-4 text-white"
              style={{ flexGrow: Math.max(1, totalThem) }}
            >
              <p className="nums font-display text-[28px] font-extrabold leading-none">
                {totalThem}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-white/80">owed to you</p>
            </div>
            <div
              className="flex-1 bg-carbon px-4 py-4 text-white"
              style={{ flexGrow: Math.max(1, totalYou) }}
            >
              <p className="nums font-display text-[28px] font-extrabold leading-none">
                {totalYou}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-white/70">you owe</p>
            </div>
          </div>

          <Section
            title="Overdue"
            tone="overdue"
            rows={overdue}
            nav={nav}
            empty="Nothing overdue — nice."
          />
          <Section
            title="Due today"
            tone="urgent"
            rows={dueToday}
            nav={nav}
            empty="Nothing due today."
          />
          <Section
            title="They owe you"
            tone="violet"
            rows={owedToYou}
            nav={nav}
            empty="You're not waiting on anyone."
          />
          <Section
            title="You owe"
            tone="ink"
            rows={youOwe}
            nav={nav}
            empty="You're all caught up."
          />
        </div>
      </div>
    </div>
  )
}

function Chip({
  Icon,
  label,
  onClick,
}: {
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="press flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper/70 px-3.5 py-2 text-[13px] font-semibold text-ink shadow-card backdrop-blur-sm"
    >
      <Icon width={16} height={16} className="text-violet-ink" />
      {label}
    </button>
  )
}

function Section({
  title,
  tone,
  rows,
  nav,
  empty,
}: {
  title: string
  tone: 'overdue' | 'urgent' | 'violet' | 'ink'
  rows: Row[]
  nav: ReturnType<typeof useNavigate>
  empty: string
}) {
  const dot = { overdue: 'bg-overdue', urgent: 'bg-urgent', violet: 'bg-violet', ink: 'bg-ink' }[
    tone
  ]
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
        <span className="nums text-[13px] font-semibold text-ink-faint">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-wash px-4 py-3 text-[13.5px] text-ink-faint">{empty}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r, i) => (
            <button
              key={r.id}
              onClick={() => nav(`/contacts/${r.contactId}`)}
              className="press animate-rise-in flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-wash"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <Avatar initials={r.initials} color={r.color} size={38} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14.5px] font-medium text-ink">{r.title}</p>
                <p className="text-[12.5px] text-ink-faint">
                  {r.direction === 'they_owe_me'
                    ? r.contactName
                    : `for ${r.contactName.split(' ')[0]}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {r.priority === 'urgent' && <Tag tone="urgent">Urgent</Tag>}
                {r.overdue && <Tag tone="overdue">Overdue</Tag>}
                <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  {r.expected}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Tag({ tone, children }: { tone: 'overdue' | 'urgent'; children: React.ReactNode }) {
  const cls = tone === 'overdue' ? 'bg-overdue/10 text-overdue' : 'bg-urgent/10 text-urgent'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
  )
}
