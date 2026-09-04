import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { Avatar } from '@/components/Avatar'
import { TaskWallpaper } from '@/components/TaskWallpaper'
import { TaskRow, type Side } from '@/components/TaskRow'
import { useToast } from '@/components/Toast'
import { buzz } from '@/lib/haptics'
import { daysAgo } from '@/lib/time'
import { BackIcon, ChevronRightIcon, ChevronUpIcon } from '@/components/icons'
import { TASK_TITLE_MAX } from '@/lib/config'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'
import { getDemoTasks } from '@/lib/demoStore'

/**
 * The two-sided task space: what I owe them down the left in green, what they
 * owe me down the right in white, on the shared task wallpaper. Tapping a task
 * opens its comments; the composer only ever creates a task for them.
 */
export function ContactSpaceScreen() {
  const nav = useNavigate()
  useSwipeBack()
  const { id } = useParams()
  const contact = SAMPLE_CONTACTS.find((c) => c.id === id)
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [tasks, setTasks] = useState<SampleTask[]>(() =>
    contact ? [...contact.tasks, ...getDemoTasks(contact.id)] : [],
  )
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState<Record<Side, boolean>>({ owe: true, owed: true })

  const { owe, owed } = useMemo(
    () => ({
      owe: tasks.filter((t) => t.direction === 'i_owe_them'),
      owed: tasks.filter((t) => t.direction === 'they_owe_me'),
    }),
    [tasks],
  )

  if (!contact) {
    return (
      <div className="app-frame items-center justify-center px-8 text-center">
        <div>
          <p className="font-display text-lg font-semibold">We can&rsquo;t find that person</p>
          <button onClick={() => nav('/contacts')} className="btn-ghost mt-5">
            Back to Contacts
          </button>
        </div>
      </div>
    )
  }

  // Narrowed past the guard above, so the closures below can rely on it.
  const person = contact
  const firstName = person.name.split(' ')[0]

  function patch(taskId: string, next: Partial<SampleTask>) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...next } : t)))
  }

  function toggleDone(task: SampleTask) {
    buzz(15)
    patch(task.id, { status: task.status === 'completed' ? 'active' : 'completed' })
  }

  function accept(task: SampleTask) {
    buzz(15)
    patch(task.id, { status: 'active', receipt: 'accepted' })
    toast('Task accepted', 'success')
  }

  function send() {
    const title = draft.trim()
    if (!title) return
    buzz(12)
    setTasks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        title,
        direction: 'they_owe_me',
        status: 'pending_acceptance',
        priority: 'normal',
        expected: 'This Week',
        at: daysAgo(0),
        receipt: 'sent',
      },
    ])
    setDraft('')
    toast(`Sent to ${firstName}`, 'success')
    window.requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
    )
  }

  function renderSide(side: Side, rows: SampleTask[], total: number) {
    const open = rows.filter((t) => t.status !== 'completed')
    const done = rows.filter((t) => t.status === 'completed')
    const expanded = showDone[side]

    return (
      <>
        <div className={side === 'owe' ? 'flex' : 'flex justify-end'}>
          <span className="side-pill">
            {side === 'owe' ? `I Owe ${firstName}` : `${firstName} Owes Me`}
          </span>
        </div>

        {open.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            side={side}
            onOpen={() => nav(`/contacts/${person.id}/t/${t.id}`)}
            onToggle={() => toggleDone(t)}
            onAccept={() => accept(t)}
          />
        ))}

        {expanded &&
          done.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              side={side}
              onOpen={() => nav(`/contacts/${person.id}/t/${t.id}`)}
              onToggle={() => toggleDone(t)}
            />
          ))}

        <button
          onClick={() => setShowDone((s) => ({ ...s, [side]: !s[side] }))}
          className={`press flex items-center gap-1.5 py-0.5 text-[15px] font-medium text-ink ${
            side === 'owe' ? 'self-start' : 'flex-row-reverse self-end'
          }`}
          aria-expanded={expanded}
        >
          <ChevronRightIcon
            width={19}
            height={19}
            className={`transition-transform ${
              expanded ? 'rotate-90' : side === 'owe' ? 'rotate-180' : ''
            }`}
          />
          {total} Completed
        </button>
      </>
    )
  }

  const doneByMe = person.doneByMe ?? owe.filter((t) => t.status === 'completed').length
  const doneByThem = person.doneByThem ?? owed.filter((t) => t.status === 'completed').length

  return (
    <div className="app-frame">
      <header
        className="flex items-center gap-3 bg-bar px-3 pb-2.5"
        style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}
      >
        <button
          className="press grid h-9 w-7 place-items-center text-ink"
          onClick={() => nav('/contacts')}
          aria-label="Back to Contacts"
        >
          <BackIcon width={22} height={22} />
        </button>
        <Avatar initials={contact.initials} color={contact.color} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[19px] font-bold leading-tight">
            {contact.name}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Tasks
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="thread-surface min-h-0 flex-1 overflow-y-auto">
        <TaskWallpaper />
        <div className="relative flex flex-col gap-2.5 px-3 py-4">
          {renderSide('owe', owe, doneByMe)}
          <div className="h-3" />
          {renderSide('owed', owed, doneByThem)}
        </div>
      </div>

      <div
        className="bg-bar px-2.5 pt-2.5"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, TASK_TITLE_MAX))}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={`Enter task for ${firstName} to complete...`}
            className="h-12 min-w-0 flex-1 rounded-full bg-paper px-4 text-[15.5px] text-ink outline-none placeholder:text-ink-faint"
            aria-label={`New task for ${firstName}`}
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-40"
            aria-label="Send task"
          >
            <ChevronUpIcon width={24} height={24} />
          </button>
        </div>
      </div>
    </div>
  )
}
