import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { PlusIcon } from '@/components/icons'
import { SAMPLE_GROUPS } from '@/lib/sampleData'

export function GroupsScreen() {
  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Groups" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">Shared checklists your team works from.</p>

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {SAMPLE_GROUPS.map((g) => (
          <li key={g.id}>
            <button className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash">
              <Avatar initials={g.name.slice(0, 2)} color={g.color} />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{g.name}</span>
                <p className="nums mt-0.5 text-[13px] text-ink-faint">
                  {g.members} members · {g.open} open · {g.done} done
                </p>
              </div>
              {g.open > 0 && (
                <span className="nums grid h-6 min-w-6 place-items-center rounded-full bg-violet px-2 text-[12px] font-bold text-white">
                  {g.open}
                </span>
              )}
            </button>
          </li>
        ))}

        {SAMPLE_GROUPS.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">No groups yet</p>
            <p className="mt-1 text-[14px] text-ink-soft">Create one to share a checklist.</p>
          </div>
        )}
      </ul>

      <button
        className="press absolute bottom-5 right-5 inline-flex h-12 items-center gap-1.5 rounded-full bg-violet px-5 text-[14px] font-semibold text-white shadow-float"
        aria-label="New group"
      >
        <PlusIcon width={20} height={20} /> New group
      </button>
    </div>
  )
}
