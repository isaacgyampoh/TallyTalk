import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { NameSheet } from '@/components/NameSheet'
import { PlusIcon } from '@/components/icons'
import { SAMPLE_GROUPS } from '@/lib/sampleData'
import { addCustomGroup, getCustomGroups } from '@/lib/demoStore'

export function GroupsScreen() {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const groups = [...getCustomGroups(), ...SAMPLE_GROUPS]

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Groups" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">Shared checklists your team works from.</p>

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {groups.map((g) => (
          <li key={g.id}>
            <button
              onClick={() => nav(`/groups/${g.id}`)}
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
            >
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
      </ul>

      <button
        onClick={() => setCreating(true)}
        className="press absolute bottom-5 right-5 inline-flex h-12 items-center gap-1.5 rounded-full bg-violet px-5 text-[14px] font-semibold text-white shadow-float"
        aria-label="New group"
      >
        <PlusIcon width={20} height={20} /> New group
      </button>

      {creating && (
        <NameSheet
          title="New group"
          placeholder="e.g. Wedding Committee"
          cta="Create group"
          onClose={() => setCreating(false)}
          onCreate={(name) => {
            const g = addCustomGroup(name)
            setCreating(false)
            nav(`/groups/${g.id}`)
          }}
        />
      )}
    </div>
  )
}
