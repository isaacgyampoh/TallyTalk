import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { PlusIcon } from '@/components/icons'
import { PREDEFINED_CHECKLISTS } from '@/lib/config'

// Sample counts so the concept reads on first run.
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

export function PersonalScreen() {
  const nav = useNavigate()
  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Personal" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">
        Private checklists, only you can see these.
      </p>

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {PREDEFINED_CHECKLISTS.map((list, i) => {
          const counts = sampleCounts[list.key] ?? { open: 0, done: 0 }
          return (
            <li key={list.key}>
              <button onClick={() => nav(`/personal/${list.key}`)} className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[17px] font-bold text-white"
                  style={{ background: listColor(i) }}
                >
                  {list.title[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{list.title}</span>
                    {list.behavior === 'daily_reset' && <Meta>resets daily</Meta>}
                    {list.behavior === 'manual_reset' && <Meta>reset button</Meta>}
                    {list.behavior === 'call' && <Meta>tap to call</Meta>}
                  </div>
                  <p className="nums mt-0.5 text-[13px] text-ink-faint">
                    {counts.open > 0 ? `${counts.open} to do` : 'nothing pending'}
                    {counts.done > 0 && ` · ${counts.done} done`}
                  </p>
                </div>
                {counts.open > 0 && (
                  <span className="nums grid h-6 min-w-6 place-items-center rounded-full bg-violet px-2 text-[12px] font-bold text-white">
                    {counts.open}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        className="press absolute bottom-5 right-5 inline-flex h-12 items-center gap-1.5 rounded-full bg-violet px-5 text-[14px] font-semibold text-white shadow-float"
        aria-label="Add a custom list"
      >
        <PlusIcon width={20} height={20} /> Custom list
      </button>
    </div>
  )
}

const Meta = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-wash px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint">
    {children}
  </span>
)
