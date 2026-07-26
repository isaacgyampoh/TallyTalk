import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { VoiceNote } from '@/components/VoiceNote'
import {
  BackIcon, CheckIcon, PlusIcon, WandIcon, MicIcon, PaperclipIcon,
  ImageIcon, DocIcon, StopIcon, CloseIcon,
} from '@/components/icons'
import { TASK_TITLE_MAX } from '@/lib/config'
import { SAMPLE_CONTACTS, type SampleTask } from '@/lib/sampleData'

type Item =
  | ({ kind: 'task' } & SampleTask & { mine: boolean })
  | { kind: 'voice'; id: string; mine: boolean; duration: number }
  | { kind: 'image'; id: string; mine: boolean; caption: string }
  | { kind: 'file'; id: string; mine: boolean; name: string; size: string }

export function ContactSpaceScreen() {
  const nav = useNavigate()
  const { id } = useParams()
  const contact = SAMPLE_CONTACTS.find((c) => c.id === id) ?? SAMPLE_CONTACTS[0]
  const firstName = contact.name.split(' ')[0]

  const seed: Item[] = [
    ...contact.tasks
      .filter((t) => t.status !== 'completed')
      .map((t) => ({ kind: 'task' as const, ...t, mine: t.direction === 'they_owe_me' })),
  ]
  if (contact.id === 'ben') {
    seed.splice(1, 0, { kind: 'voice', id: 'v-seed', mine: false, duration: 8 })
    seed.splice(3, 0, { kind: 'file', id: 'f-seed', mine: true, name: 'Ecobank-agreement.pdf', size: '240 KB' })
  }

  const [items, setItems] = useState<Item[]>(seed)
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [items.length])

  function push(item: Item) {
    setItems((prev) => [...prev, item])
  }

  function sendTask() {
    const title = draft.trim()
    if (!title) return
    push({ kind: 'task', id: `t-${Date.now()}`, title, direction: 'they_owe_me', status: 'pending_acceptance', priority: 'normal', expected: 'This Week', mine: true })
    setDraft('')
  }

  function toggleComplete(id: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === 'task' && it.id === id
          ? { ...it, status: it.status === 'completed' ? 'active' : 'completed' }
          : it,
      ),
    )
  }

  function addImage() {
    push({ kind: 'image', id: `img-${Date.now()}`, mine: true, caption: 'Photo attached' })
    setSheet(false)
  }
  function addFile() {
    push({ kind: 'file', id: `file-${Date.now()}`, mine: true, name: 'Document.pdf', size: '180 KB' })
    setSheet(false)
  }

  function startRec() {
    setRecording(true)
    setElapsed(0)
    recRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
  }
  function stopRec(send: boolean) {
    if (recRef.current) window.clearInterval(recRef.current)
    const dur = Math.max(1, elapsed)
    setRecording(false)
    setElapsed(0)
    if (send) push({ kind: 'voice', id: `v-${Date.now()}`, mine: true, duration: dur })
  }

  return (
    <div className="app-frame">
      <header className="flex items-center gap-3 border-b border-line px-4 pb-3" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <button className="press grid h-9 w-9 place-items-center rounded-full text-ink-soft" onClick={() => nav(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <Avatar initials={contact.initials} color={contact.color} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-bold leading-tight">{contact.name}</p>
          <p className="nums text-[12.5px] text-ink-faint">{contact.forThem} for {firstName} · {contact.forYou} for you</p>
        </div>
      </header>

      <div className="flex items-center justify-between px-5 py-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className="text-violet">{firstName} owes me</span>
        <span className="text-ink-faint">I owe {firstName}</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {items.map((it) => (
          <Bubble key={it.id} item={it} peer={firstName} onToggle={() => it.kind === 'task' && toggleComplete(it.id)} />
        ))}
        {items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">All clear with {firstName}</p>
            <p className="mt-1 text-[14px] text-ink-soft">Send a request below to get started.</p>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-line px-3 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}>
        {recording ? (
          <div className="flex items-center gap-3 rounded-bubble bg-overdue/10 px-4 py-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-overdue" />
            <span className="nums flex-1 text-[14px] font-semibold text-overdue">
              Recording… 0:{String(elapsed).padStart(2, '0')}
            </span>
            <button onClick={() => stopRec(false)} className="press grid h-9 w-9 place-items-center rounded-full bg-wash text-ink-soft" aria-label="Cancel">
              <CloseIcon width={18} height={18} />
            </button>
            <button onClick={() => stopRec(true)} className="press grid h-10 w-10 place-items-center rounded-full bg-violet text-white shadow-float" aria-label="Send voice note">
              <StopIcon width={18} height={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button onClick={() => setSheet((s) => !s)} className="press mb-0.5 grid h-11 w-10 shrink-0 place-items-center rounded-full text-ink-soft" aria-label="Attach">
              <PaperclipIcon width={22} height={22} />
            </button>
            <div className="flex-1 rounded-bubble border border-line bg-wash px-3 py-2 focus-within:border-violet focus-within:bg-paper">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, TASK_TITLE_MAX))}
                onKeyDown={(e) => e.key === 'Enter' && sendTask()}
                placeholder={`Ask ${firstName} to…`}
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
                aria-label="New task request"
              />
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-[11px] text-ink-faint">Task · attach a file · or hold to talk</span>
                <span className="nums text-[11px] text-ink-faint">{draft.length}/{TASK_TITLE_MAX}</span>
              </div>
            </div>
            {draft.trim() ? (
              <button onClick={sendTask} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-white shadow-float" aria-label="Send request">
                <PlusIcon width={22} height={22} />
              </button>
            ) : (
              <button onClick={startRec} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-white shadow-float" aria-label="Record voice note">
                <MicIcon width={21} height={21} />
              </button>
            )}
          </div>
        )}

        {sheet && !recording && (
          <div className="mt-2 flex gap-2">
            <button onClick={addImage} className="press flex flex-1 items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-tint text-violet"><ImageIcon width={18} height={18} /></span>
              Photo
            </button>
            <button onClick={addFile} className="press flex flex-1 items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-tint text-violet"><DocIcon width={18} height={18} /></span>
              Document
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Bubble({ item, peer, onToggle }: { item: Item; peer: string; onToggle: () => void }) {
  const mine = item.mine
  const wrap = `flex ${mine ? 'justify-start' : 'justify-end'} animate-rise-in`
  const shell = `max-w-[82%] rounded-bubble shadow-card ${mine ? 'bg-violet-tint' : 'border border-line bg-paper'}`

  if (item.kind === 'voice') {
    return (
      <div className={wrap}>
        <div className={`${mine ? 'bg-violet' : 'border border-line bg-paper'} max-w-[82%] rounded-bubble px-3.5 py-3 shadow-card`}>
          <VoiceNote duration={item.duration} mine={mine} />
        </div>
      </div>
    )
  }

  if (item.kind === 'image') {
    return (
      <div className={wrap}>
        <div className={`${shell} overflow-hidden p-1.5`}>
          <div className="grid h-40 w-56 place-items-center rounded-[14px] bg-gradient-to-br from-violet/20 to-violet/5 text-violet">
            <ImageIcon width={34} height={34} />
          </div>
          <p className="px-2 py-1.5 text-[12.5px] text-ink-soft">{item.caption}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'file') {
    return (
      <div className={wrap}>
        <div className={`${shell} flex items-center gap-3 px-3 py-3`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet text-white"><DocIcon width={20} height={20} /></span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{item.name}</p>
            <p className="nums text-[12px] text-ink-faint">{item.size} · PDF</p>
          </div>
        </div>
      </div>
    )
  }

  // task
  const done = item.status === 'completed'
  const pending = item.status === 'pending_acceptance'
  return (
    <div className={wrap}>
      <div className={`${shell} px-3.5 py-3`}>
        <div className="flex items-start gap-2.5">
          <button
            onClick={onToggle}
            className={`press mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${done ? 'border-done bg-done text-white' : 'border-ink-faint text-transparent'}`}
            aria-label={done ? 'Mark active' : 'Mark complete'}
          >
            <CheckIcon width={14} height={14} />
          </button>
          <div className="min-w-0">
            <p className={`text-[15px] leading-snug ${done ? 'text-ink-faint line-through' : 'text-ink'}`}>{item.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {pending && <Chip>Pending {mine ? peer : 'your'} acceptance</Chip>}
              {item.priority === 'urgent' && <Chip tone="urgent">Urgent</Chip>}
              {item.priority === 'high' && <Chip tone="high">High</Chip>}
              <Chip tone="muted">{item.expected}</Chip>
              {item.overdue && <Chip tone="overdue">Overdue</Chip>}
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

function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'urgent' | 'high' | 'overdue' }) {
  const map = {
    muted: 'bg-white/70 text-ink-soft',
    urgent: 'bg-urgent/12 text-urgent',
    high: 'bg-violet/10 text-violet-ink',
    overdue: 'bg-overdue/12 text-overdue',
  }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>
}
