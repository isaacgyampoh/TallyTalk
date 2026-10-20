import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { NameSheet } from '@/components/NameSheet'
import { PlusIcon } from '@/components/icons'
import { useCreateGroup, useGroups, useInvitations, useMyInvitations } from '@/data/hooks'

export function GroupsScreen() {
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const { data: liveGroups, isPending, isError, refetch } = useGroups()
  const createGroupMutation = useCreateGroup()
  const { data: invitations } = useMyInvitations()
  const { respond } = useInvitations()

  // No per-group tallies: counting open tasks would be a query per row, and
  // showing zeros instead would be a lie about every group that has members.
  const groups = liveGroups ?? []

  return (
    <div className="relative flex h-full flex-col">
      <ScreenHeader title="Groups" />
      <p className="px-5 pb-3 text-[14px] text-ink-soft">Shared checklists your team works from.</p>

      {!!invitations?.length && (
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
        {isPending && (
          <li className="px-3 py-6 text-center text-[15px] text-ink-soft">Loading your groups…</li>
        )}
        {isError && (
          <li className="px-3 py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load your groups.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </li>
        )}
        {!isPending && !isError && groups.length === 0 && (
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
              <Avatar initials={g.name.slice(0, 2)} color="#6600FF" />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{g.name}</span>
                {g.description && (
                  <p className="mt-0.5 truncate text-[13px] text-ink-faint">{g.description}</p>
                )}
              </div>
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
