import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { NameSheet } from '@/components/NameSheet'
import { PlusIcon } from '@/components/icons'
import { useChecklists, useCreateChecklist } from '@/data/hooks'

const listColor = (i: number) =>
  ['#6600FF', '#0E7C86', '#B4530A', '#8A3BFF', '#2B7A3B', '#B02A6F'][i % 6]

/** One row on this screen, whichever source it came from. */
interface ListRow {
  id: string
  title: string
  behavior: string
  custom: boolean
}

export function PersonalScreen() {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const { data: liveLists, isPending, isError, refetch } = useChecklists()
  const createList = useCreateChecklist()

  // Rows come from the database and are navigated by id.
  const rows: ListRow[] = (liveLists ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    behavior: l.behavior,
    custom: l.kind === 'custom',
  }))

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Personal" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">
        Private checklists, only you can see these.
      </p>

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {isPending && (
          <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading your lists…</li>
        )}

        {isError && (
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
                <p className="nums mt-0.5 text-[13px] text-ink-faint">
                  open to see what&rsquo;s in it
                </p>
              </div>
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
