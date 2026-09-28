import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { NameSheet } from '@/components/NameSheet'
import { PlusIcon } from '@/components/icons'
import { SAMPLE_GROUPS } from '@/lib/sampleData'
import { addCustomGroup, getCustomGroups } from '@/lib/demoStore'
import {
  useCreateGroup,
  useGroups,
  useInvitations,
  useIsLive,
  useMyInvitations,
} from '@/data/hooks'

export function GroupsScreen() {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const live = useIsLive()
  const { data: liveGroups, isPending, isError, refetch } = useGroups()
  const createGroupMutation = useCreateGroup()
  const { data: invitations } = useMyInvitations()
  const { respond } = useInvitations()

  // Live groups carry no tallies yet — counting open tasks per group would be a
  // query per row, so the counts stay a preview affordance for now.
  const groups = live
    ? (liveGroups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        color: '#6600FF',
        members: 0,
        open: 0,
        done: 0,
      }))
    : [...getCustomGroups(), ...SAMPLE_GROUPS]

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Groups" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">Shared checklists your team works from.</p>

      {live && !!invitations?.length && (
        <section className="px-3 pb-2">
          <h2 className="eyebrow mb-2 px-1">Invitations</h2>
          <ul className="overflow-hidden rounded-card border border-line">
            {invitations.map((inv, i) => (
              <li key={inv.id} className={i > 0 ? 'border-t border-line' : ''}>
                <div className="flex items-center gap-3 px-3 py-3">
                  <p className="min-w-0 flex-1 text-[15px] text-ink">
                    You were invited to{' '}
                    <span className="font-semibold">{inv.group?.name ?? 'a group'}</span>
                  </p>
                  <button
                    onClick={() => respond.mutate({ invitationId: inv.id, status: 'declined' })}
                    disabled={respond.isPending}
                    className="press rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respond.mutate({ invitationId: inv.id, status: 'accepted' })}
                    disabled={respond.isPending}
                    className="press rounded-full bg-violet px-3.5 py-1.5 text-[13px] font-semibold text-white"
                  >
                    Join
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="flex-1 overflow-y-auto px-3 pb-24">
        {live && isPending && (
          <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading your groups…</li>
        )}
        {live && isError && (
          <li className="px-3 py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load your groups.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </li>
        )}
        {live && !isPending && !isError && groups.length === 0 && (
          <li className="px-6 py-8 text-center text-[15px] text-ink-soft">
            No groups yet. Create one to share a list with a team.
          </li>
        )}
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
            if (!live) {
              const g = addCustomGroup(name)
              setCreating(false)
              nav(`/groups/${g.id}`)
              return
            }
            createGroupMutation.mutate(name, {
              onSuccess: (id) => {
                setCreating(false)
                nav(`/groups/${id}`)
              },
            })
          }}
        />
      )}
    </div>
  )
}
