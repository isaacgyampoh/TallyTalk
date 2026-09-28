import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { NameSheet } from '@/components/NameSheet'
import { PlusIcon } from '@/components/icons'
import { PREDEFINED_CHECKLISTS } from '@/lib/config'
import { addCustomList, getCustomLists } from '@/lib/demoStore'
import { useChecklists, useCreateChecklist, useIsLive } from '@/data/hooks'

const sampleCounts: Record<string, { open: number; done: number }> = {
  daily: { open: 3, done: 5 },
  call: { open: 2, done: 0 },
  buy: { open: 4, done: 1 },
  pay: { open: 1, done: 2 },
  travel: { open: 0, done: 11 },
  follow_up: { open: 2, done: 0 },
}

const listColor = (i: number) =>
  ['#6600FF', '#0E7C86', '#B4530A', '#8A3BFF', '#2B7A3B', '#B02A6F'][i % 6]

/** One row on this screen, whichever source it came from. */
interface ListRow {
  id: string
  title: string
  behavior: string
  custom: boolean
  counts?: { open: number; done: number }
}

export function PersonalScreen() {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const live = useIsLive()
  const { data: liveLists, isPending, isError, refetch } = useChecklists()
  const createList = useCreateChecklist()

  // Live rows come from the database and are navigated by id; preview rows are
  // the predefined set plus anything added in this session.
  const rows: ListRow[] = live
    ? (liveLists ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        behavior: l.behavior,
        custom: l.kind === 'custom',
      }))
    : [
        ...getCustomLists().map((l) => ({
          id: l.id,
          title: l.title,
          behavior: 'normal',
          custom: true,
        })),
        ...PREDEFINED_CHECKLISTS.map((l) => ({
          id: l.key,
          title: l.title,
          behavior: l.behavior as string,
          custom: false,
          counts: sampleCounts[l.key] ?? { open: 0, done: 0 },
        })),
      ]

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Personal" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">
        Private checklists, only you can see these.
      </p>

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {live && isPending && (
          <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading your lists…</li>
        )}

        {live && isError && (
          <li className="px-3 py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load your checklists.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </li>
        )}

        {rows.map((list, i) => (
          <li key={list.id}>
            <button
              onClick={() => nav(`/personal/${list.id}`)}
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[17px] font-bold text-white"
                style={{ background: listColor(i) }}
              >
                {list.title[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{list.title}</span>
                  {list.custom && <Meta>custom</Meta>}
                  {list.behavior === 'daily_reset' && <Meta>resets daily</Meta>}
                  {list.behavior === 'manual_reset' && <Meta>reset button</Meta>}
                  {list.behavior === 'call' && <Meta>tap to call</Meta>}
                </div>
                {list.counts ? (
                  <p className="nums mt-0.5 text-[13px] text-ink-faint">
                    {list.counts.open > 0 ? `${list.counts.open} to do` : 'nothing pending'}
                    {list.counts.done > 0 && ` · ${list.counts.done} done`}
                  </p>
                ) : (
                  <p className="nums mt-0.5 text-[13px] text-ink-faint">
                    open to see what&rsquo;s in it
                  </p>
                )}
              </div>
              {list.counts && list.counts.open > 0 && (
                <span className="nums grid h-6 min-w-6 place-items-center rounded-full bg-violet px-2 text-[12px] font-bold text-white">
                  {list.counts.open}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setCreating(true)}
        className="press absolute bottom-5 right-5 inline-flex h-12 items-center gap-1.5 rounded-full bg-violet px-5 text-[14px] font-semibold text-white shadow-float"
        aria-label="Add a custom list"
      >
        <PlusIcon width={20} height={20} /> Custom list
      </button>

      {creating && (
        <NameSheet
          title="New checklist"
          placeholder="e.g. Weekend chores"
          cta="Create list"
          onClose={() => setCreating(false)}
          onCreate={(name) => {
            if (!live) {
              const id = addCustomList(name)
              setCreating(false)
              nav(`/personal/${id}`)
              return
            }
            createList.mutate(name, {
              onSuccess: (id) => {
                setCreating(false)
                nav(`/personal/${id}`)
              },
            })
          }}
        />
      )}
    </div>
  )
}

const Meta = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-wash px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint">
    {children}
  </span>
)
