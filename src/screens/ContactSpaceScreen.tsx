import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { BackIcon, CheckIcon, PlusIcon, WandIcon } from '@/components/icons'
import { TASK_TITLE_MAX } from '@/lib/config'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'

export function ContactSpaceScreen() {
  const nav = useNavigate()
  const { id } = useParams()
  const contact = SAMPLE_CONTACTS.find((c) => c.id === id) ?? SAMPLE_CONTACTS[0]

  const [tasks, setTasks] = useState<SampleTask[]>(contact.tasks)
  const [draft, setDraft] = useState('')

  const firstName = contact.name.split(' ')[0]

  const timeline = useMemo(
    () => tasks.filter((t) => t.status !== 'completed'),
    [tasks],
  )

  function sendRequest() {
    const title = draft.trim()
    if (!title) return
    setTasks((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        title,
        direction: 'they_owe_me',
        status: 'pending_acceptance',
        priority: 'normal',
        expected: 'This Week',
      },
    ])
    setDraft('')
  }

  function toggleComplete(taskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'completed' ? 'active' : 'completed' }
          : t,
      ),
    )
  }

  return (
    <div className="app-frame">
      {/* Header */}
      <header
        className="flex items-center gap-3 border-b border-line px-4 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <button
          className="press grid h-9 w-9 place-items-center rounded-full text-ink-soft"
          onClick={() => nav(-1)}
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <Avatar initials={contact.initials} color={contact.color} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-bold leading-tight">{contact.name}</p>
          <p className="nums text-[12.5px] text-ink-faint">
            {contact.forThem} for {firstName} · {contact.forYou} for you
          </p>
        </div>
      </header>

      {/* Column legend */}
      <div className="flex items-center justify-between px-5 py-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className="text-violet">{firstName} owes me</span>
        <span className="text-ink-faint">I owe {firstName}</span>
      </div>

      {/* Timeline */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {timeline.map((t) => (
          <TaskBubble key={t.id} task={t} onToggle={() => toggleComplete(t.id)} peer={firstName} />
        ))}
        {timeline.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">All clear with {firstName}</p>
            <p className="mt-1 text-[14px] text-ink-soft">Send a request below to get started.</p>
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className="border-t border-line px-3 pt-2"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-bubble border border-line bg-wash px-3 py-2 focus-within:border-violet focus-within:bg-paper">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, TASK_TITLE_MAX))}
              onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
              placeholder={`Ask ${firstName} to…`}
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
              aria-label="New task request"
            />
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[11px] text-ink-faint">Swipe a task to set priority &amp; due date</span>
              <span className="nums text-[11px] text-ink-faint">
                {draft.length}/{TASK_TITLE_MAX}
              </span>
            </div>
          </div>
          <button
            className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-white shadow-float disabled:opacity-40 disabled:shadow-none"
            onClick={sendRequest}
            disabled={!draft.trim()}
            aria-label="Send request"
          >
            <PlusIcon width={22} height={22} />
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskBubble({
  task,
  onToggle,
  peer,
}: {
  task: SampleTask
  onToggle: () => void
  peer: string
}) {
  const mine = task.direction === 'they_owe_me' // I requested it → left, violet
  const done = task.status === 'completed'
  const pending = task.status === 'pending_acceptance'

  return (
    <div className={`flex ${mine ? 'justify-start' : 'justify-end'} animate-rise-in`}>
      <div
        className={`max-w-[82%] rounded-bubble px-3.5 py-3 shadow-card ${
          mine ? 'bg-violet-tint' : 'border border-line bg-paper'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <button
            onClick={onToggle}
            className={`press mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
              done ? 'border-done bg-done text-white' : 'border-ink-faint text-transparent'
            }`}
            aria-label={done ? 'Mark active' : 'Mark complete'}
          >
            <CheckIcon width={14} height={14} />
          </button>
          <div className="min-w-0">
            <p className={`text-[15px] leading-snug ${done ? 'text-ink-faint line-through' : 'text-ink'}`}>
              {task.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {pending && <Chip>Pending {mine ? peer : 'your'} acceptance</Chip>}
              {task.priority === 'urgent' && <Chip tone="urgent">Urgent</Chip>}
              {task.priority === 'high' && <Chip tone="high">High</Chip>}
              <Chip tone="muted">{task.expected}</Chip>
              {task.overdue && <Chip tone="overdue">Overdue</Chip>}
              {mine && !done && (
                <button className="press ml-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet">
                  <WandIcon width={13} height={13} /> Poke
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'urgent' | 'high' | 'overdue'
}) {
  const map = {
    muted: 'bg-white/70 text-ink-soft',
    urgent: 'bg-urgent/12 text-urgent',
    high: 'bg-violet/10 text-violet-ink',
    overdue: 'bg-overdue/12 text-overdue',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  )
}
