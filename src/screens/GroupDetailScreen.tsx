import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isAppMode } from '@/lib/platform'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { Avatar } from '@/components/Avatar'
import { BackIcon, CheckIcon, PlusIcon } from '@/components/icons'
import { SAMPLE_GROUPS, type GroupTask } from '@/lib/sampleData'
import { getCustomGroup } from '@/lib/demoStore'
import { useContacts, useGroupDetail, useGroups, useInvitations, useIsLive } from '@/data/hooks'

export function GroupDetailScreen() {
  const nav = useNavigate()
  useSwipeBack()
  const { id = '' } = useParams()
  const live = useIsLive()
  const { data: liveGroups } = useGroups()
  const detail = useGroupDetail(id)
  const { invite } = useInvitations(id)
  const { data: myContacts } = useContacts()
  const [inviting, setInviting] = useState(false)

  const sampleGroup =
    SAMPLE_GROUPS.find((g) => g.id === id) ??
    (live ? undefined : getCustomGroup(id)) ??
    SAMPLE_GROUPS[0]
  const liveGroup = live ? liveGroups?.find((g) => g.id === id) : undefined

  // One shape for the header and both tabs, whichever source is behind it.
  const group = live
    ? {
        id,
        name: liveGroup?.name ?? 'Group',
        description: liveGroup?.description ?? '',
        color: '#6600FF',
        members: (detail.members.data ?? []).length,
        memberList: (detail.members.data ?? []).map((m) => ({
          id: m.user_id,
          name: m.member.display_name,
          initials: m.member.display_name.slice(0, 2).toUpperCase(),
          color: '#6600FF',
          role: m.role,
        })),
        tasks: [] as GroupTask[],
      }
    : sampleGroup

  const [tab, setTab] = useState<'tasks' | 'members'>('tasks')
  const [previewTasks, setPreviewTasks] = useState<GroupTask[]>(sampleGroup.tasks)
  const tasks: GroupTask[] = live
    ? (detail.tasks.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        assignee: '',
        done: t.status === 'completed',
        priority: t.priority,
      }))
    : previewTasks
  const [draft, setDraft] = useState('')

  const { open, done } = useMemo(
    () => ({ open: tasks.filter((t) => !t.done).length, done: tasks.filter((t) => t.done).length }),
    [tasks],
  )

  function toggle(id: string) {
    // Group task writes land with PB-014/PB-023; preview toggles locally.
    if (live) return
    setPreviewTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }
  function add() {
    const t = draft.trim()
    if (!t) return
    // Creating a group task against the database lands with PB-014.
    if (live) return
    setPreviewTasks((prev) => [
      ...prev,
      { id: `n-${Date.now()}`, title: t, assignee: 'You', done: false, priority: 'normal' },
    ])
    setDraft('')
  }

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done))

  return (
    <div className="app-frame">
      <header
        className="flex items-center gap-3 border-b border-line px-4 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        {!isAppMode && (
          <button
            className="press grid h-9 w-9 place-items-center rounded-full text-ink-soft"
            onClick={() => nav(-1)}
            aria-label="Back"
          >
            <BackIcon />
          </button>
        )}
        <Avatar initials={group.name.slice(0, 2)} color={group.color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[18px] font-bold leading-tight">{group.name}</p>
          <p className="nums text-[12.5px] text-ink-faint">
            {group.members} members · {open} open · {done} done
          </p>
        </div>
      </header>

      <div className="px-5 pt-3">
        <p className="text-[14px] text-ink-soft">{group.description}</p>
      </div>

      {/* tabs */}
      <div className="flex gap-2 px-5 py-3">
        {(['tasks', 'members'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`press rounded-full px-3.5 py-1.5 text-[13px] font-semibold capitalize transition ${
              tab === t ? 'bg-carbon text-white' : 'bg-wash text-ink-soft'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {tab === 'tasks'
          ? sorted.map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-2xl px-3 py-2.5">
                <button
                  onClick={() => toggle(t.id)}
                  className={`press mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                    t.done ? 'border-done bg-done text-white' : 'border-ink-faint text-transparent'
                  }`}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                >
                  <CheckIcon width={15} height={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[15px] leading-snug ${t.done ? 'text-ink-faint line-through' : 'text-ink'}`}
                  >
                    {t.title}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                      {t.assignee}
                    </span>
                    {t.priority === 'urgent' && (
                      <span className="rounded-full bg-urgent/12 px-2 py-0.5 text-[11px] font-semibold text-urgent-ink">
                        Urgent
                      </span>
                    )}
                    {t.priority === 'high' && (
                      <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-violet-ink">
                        High
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          : group.memberList.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <Avatar initials={m.initials} color={m.color} size={42} />
                <div className="flex-1">
                  <span className="font-semibold text-ink">{m.name}</span>
                </div>
                {m.role === 'administrator' && (
                  <span className="rounded-full bg-violet-tint px-2.5 py-0.5 text-[11px] font-semibold text-violet-ink">
                    Admin
                  </span>
                )}
              </div>
            ))}
      </div>

      {tab === 'members' && live && (
        <div className="px-3 pb-4">
          <button
            onClick={() => setInviting((v) => !v)}
            className="press w-full rounded-2xl border border-dashed border-line px-3 py-3 text-[15px] font-semibold text-violet-ink"
          >
            {inviting ? 'Close' : 'Invite someone'}
          </button>
          {inviting && (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-line">
              {(myContacts ?? []).length === 0 && (
                <li className="px-3 py-3 text-[14px] text-ink-soft">
                  Add a contact first, then you can invite them.
                </li>
              )}
              {(myContacts ?? []).map((c) => (
                <li key={c.id} className="border-b border-line last:border-0">
                  <button
                    onClick={() =>
                      invite.mutate(
                        { groupId: id, userId: c.id },
                        { onSuccess: () => setInviting(false) },
                      )
                    }
                    disabled={invite.isPending}
                    className="press flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-wash"
                  >
                    <Avatar initials={c.initials} color={c.color} size={34} />
                    <span className="font-medium text-ink">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 px-1 text-[12.5px] text-ink-soft">
            Only administrators can invite. The invitation appears on their Groups screen.
          </p>
        </div>
      )}

      {tab === 'tasks' && (
        <div
          className="border-t border-line px-3 pt-2"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
        >
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Add a shared task…"
              className="field flex-1"
              aria-label="New group task"
            />
            <button
              onClick={add}
              disabled={!draft.trim()}
              className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-white shadow-float disabled:opacity-40 disabled:shadow-none"
              aria-label="Add task"
            >
              <PlusIcon width={22} height={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
