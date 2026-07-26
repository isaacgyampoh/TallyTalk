import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
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
        rows.push({ ...t, contactId: c.id, contactName: c.name, initials: c.initials, color: c.color })
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

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Today" />
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <p className="-mt-1 mb-4 text-[13.5px] text-ink-faint">{today}</p>

        {/* running tally */}
        <div className="flex overflow-hidden rounded-[18px] border border-line">
          <div className="flex-1 bg-violet px-4 py-4 text-white" style={{ flexGrow: Math.max(1, totalThem) }}>
            <p className="nums font-display text-[28px] font-extrabold leading-none">{totalThem}</p>
            <p className="mt-1 text-[12px] font-semibold text-white/80">owed to you</p>
          </div>
          <div className="flex-1 bg-carbon px-4 py-4 text-white" style={{ flexGrow: Math.max(1, totalYou) }}>
            <p className="nums font-display text-[28px] font-extrabold leading-none">{totalYou}</p>
            <p className="mt-1 text-[12px] font-semibold text-white/70">you owe</p>
          </div>
        </div>

        <Section title="Overdue" tone="overdue" rows={overdue} nav={nav} empty="Nothing overdue — nice." />
        <Section title="Due today" tone="urgent" rows={dueToday} nav={nav} empty="Nothing due today." />
        <Section title="They owe you" tone="violet" rows={owedToYou} nav={nav} empty="You're not waiting on anyone." />
        <Section title="You owe" tone="ink" rows={youOwe} nav={nav} empty="You're all caught up." />
      </div>
    </div>
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
  const dot = { overdue: 'bg-overdue', urgent: 'bg-urgent', violet: 'bg-violet', ink: 'bg-ink' }[tone]
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
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => nav(`/contacts/${r.contactId}`)}
              className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-wash"
            >
              <Avatar initials={r.initials} color={r.color} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-ink">{r.title}</p>
                <p className="text-[12.5px] text-ink-faint">
                  {r.direction === 'they_owe_me' ? r.contactName : `for ${r.contactName.split(' ')[0]}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {r.priority === 'urgent' && <Tag tone="urgent">Urgent</Tag>}
                {r.overdue && <Tag tone="overdue">Overdue</Tag>}
                <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{r.expected}</span>
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
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
}
