import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { Avatar } from '@/components/Avatar'
import { TaskWallpaper } from '@/components/TaskWallpaper'
import { TaskRow } from '@/components/TaskRow'
import { VoiceNote } from '@/components/VoiceNote'
import { useToast } from '@/components/toastContext'
import { buzz } from '@/lib/haptics'
import { agoLabel, clockLabel } from '@/lib/time'
import {
  BackIcon,
  ChevronUpIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  MicIcon,
  NoteLinesIcon,
  PlusIcon,
  StopIcon,
  UrgentIcon,
  WandIcon,
} from '@/components/icons'
import {
  useAddComment,
  useContacts,
  useIsLive,
  usePoke,
  useTaskAttachments,
  useTaskEvents,
  useTaskRealtime,
  useUploadAttachment,
} from '@/data/hooks'
import { RecorderUnavailable, recordingFileName, startRecording } from '@/lib/recorder'
import type { ActiveRecording } from '@/lib/recorder'
import { OfflineBar } from '@/components/OfflineBar'
import {
  SAMPLE_CONTACTS,
  SAMPLE_TASK_COMMENTS,
  SAMPLE_TASK_FILES,
  type SampleTask,
  type TaskComment,
  type TaskFile,
} from '@/lib/sampleData'

/** How each logged event reads in the timeline. */
const HISTORY_LABEL: Record<string, string> = {
  created: 'Task sent',
  accepted: 'Accepted',
  completed: 'Marked done',
  reopened: 'Reopened',
  declined: 'Declined',
  poked: 'Poked',
}

const KIND_SKIN: Record<TaskFile['kind'], string> = {
  pdf: 'bg-badge-pdf',
  doc: 'bg-badge-doc',
  image: 'bg-badge-image',
  audio: 'bg-violet',
}

/** The brief, the files, and the conversation — everything about one task. */
export function TaskCommentsScreen() {
  const nav = useNavigate()
  useSwipeBack()
  const { id, taskId } = useParams()
  const toast = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  const live = useIsLive()
  const { data: contacts } = useContacts()
  const contact = (live ? contacts : SAMPLE_CONTACTS)?.find((c) => c.id === id)
  const seed = contact?.tasks.find((t) => t.id === taskId)

  const events = useTaskEvents(taskId ?? '')
  const addComment = useAddComment(taskId ?? '')
  const pokeThem = usePoke(taskId ?? '')
  const liveFiles = useTaskAttachments(taskId ?? '')
  const uploadFile = useUploadAttachment(taskId ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const recordingRef = useRef<ActiveRecording | null>(null)
  useTaskRealtime(taskId ?? '')

  const [task, setTask] = useState<SampleTask | undefined>(seed)
  const [previewComments, setPreviewComments] = useState<TaskComment[]>(
    () => SAMPLE_TASK_COMMENTS[taskId ?? ''] ?? [],
  )

  // Live comments are task_events carrying a body; the rest of the timeline is
  // the task's own history, rendered as quiet system lines.
  const comments: TaskComment[] = live
    ? (events.data ?? [])
        .filter((e) => e.event_type === 'comment' && e.metadata?.body)
        .map((e) => ({
          id: e.id,
          body: e.metadata!.body!,
          mine: e.actor_id === contact?.id ? false : true,
          at: e.created_at,
        }))
    : previewComments

  const history = live ? (events.data ?? []).filter((e) => e.event_type !== 'comment') : []
  const [draft, setDraft] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recRef = useRef<number | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [])

  // Never leave the recording timer running behind us.
  useEffect(() => {
    return () => {
      if (recRef.current) window.clearInterval(recRef.current)
    }
  }, [])

  if (!contact || !task) {
    return (
      <div className="app-frame items-center justify-center px-8 text-center">
        <div>
          <p className="font-display text-lg font-semibold">We can&rsquo;t find that task</p>
          <button onClick={() => nav(`/contacts/${id ?? ''}`)} className="btn-ghost mt-5">
            Back to the task space
          </button>
        </div>
      </div>
    )
  }

  const firstName = contact.name.split(' ')[0]
  const side = task.direction === 'i_owe_them' ? 'owe' : 'owed'
  const files: TaskFile[] = live
    ? (liveFiles.data ?? []).map((a) => ({
        id: a.id,
        name: a.file_name ?? 'Attachment',
        kind:
          a.attachment_type === 'image'
            ? 'image'
            : a.attachment_type === 'audio'
              ? 'audio'
              : a.file_name?.toLowerCase().endsWith('.pdf')
                ? 'pdf'
                : 'doc',
        size: a.file_size ? `${Math.max(1, Math.round(a.file_size / 1024))} KB` : '',
        at: a.created_at,
      }))
    : (SAMPLE_TASK_FILES[task.id] ?? [])
  const flagged = task.priority === 'urgent' || task.priority === 'high'

  function toBottom(smooth = true) {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  function post(comment: TaskComment) {
    setPreviewComments((prev) => [...prev, comment])
    window.requestAnimationFrame(() => toBottom())
  }

  function send() {
    const body = draft.trim()
    if (!body) return
    buzz(12)
    if (!live) {
      post({ id: `c-${Date.now()}`, body, mine: true, at: new Date().toISOString() })
      setDraft('')
      return
    }
    addComment.mutate(body, {
      onSuccess: () => {
        setDraft('')
        window.requestAnimationFrame(() => toBottom())
      },
      onError: () => toast('Could not post that comment', 'error'),
    })
  }

  async function startRec() {
    if (!live) {
      // Preview has nowhere to upload to; keep the existing mimed recorder.
      setRecording(true)
      setElapsed(0)
      recRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
      return
    }
    try {
      recordingRef.current = await startRecording()
      setRecording(true)
      setElapsed(0)
      recRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch (err) {
      const reason = err instanceof RecorderUnavailable ? err.reason : 'failed'
      toast(
        reason === 'denied'
          ? 'Microphone access is off. Turn it on in settings to send a voice note.'
          : reason === 'unsupported'
            ? 'This device cannot record audio.'
            : 'Could not start recording.',
        'error',
      )
    }
  }

  async function stopRec(keep: boolean) {
    if (recRef.current) window.clearInterval(recRef.current)
    const seconds = Math.max(1, elapsed)
    setRecording(false)
    setElapsed(0)

    const active = recordingRef.current
    recordingRef.current = null

    if (!live) {
      if (keep) {
        buzz(12)
        post({
          id: `v-${Date.now()}`,
          body: 'Voice note',
          mine: true,
          at: new Date().toISOString(),
          voice: seconds,
        })
      }
      return
    }

    const blob = await active?.stop(keep)
    if (!keep || !blob) return
    buzz(12)
    const file = new File([blob], recordingFileName(blob.type), { type: blob.type })
    uploadFile.mutate(file, {
      onError: () => toast('Could not send that voice note', 'error'),
    })
  }

  return (
    <div className="app-frame">
      <OfflineBar />
      <header
        className="flex items-center gap-3 bg-bar px-3 pb-2.5"
        style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}
      >
        <button
          className="press grid h-9 w-7 place-items-center text-ink"
          onClick={() => nav(`/contacts/${contact.id}`)}
          aria-label="Back to the task space"
        >
          <BackIcon width={22} height={22} />
        </button>
        <Avatar initials={contact.initials} color={contact.color} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[19px] font-bold leading-tight">
            {contact.name}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Comments
          </p>
        </div>
      </header>

      {/* The task itself, pinned above its conversation. */}
      <div className="border-b border-line bg-paper px-3 py-2.5">
        {live && side === 'owed' && task.status !== 'completed' && contact && (
          <button
            onClick={() =>
              pokeThem.mutate(contact.id, {
                onSuccess: () => {
                  buzz(18)
                  toast(`You poked ${firstName}`, 'poke')
                },
                onError: () => toast('Could not send that poke', 'error'),
              })
            }
            disabled={pokeThem.isPending}
            className="press mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-tint px-3 py-1.5 text-[13px] font-semibold text-violet-ink disabled:opacity-50"
          >
            <WandIcon width={15} height={15} />
            {pokeThem.isPending ? 'Poking…' : `Poke ${firstName}`}
          </button>
        )}
        <TaskRow
          task={task}
          side={side}
          showComments={false}
          onToggle={() =>
            setTask((t) =>
              t ? { ...t, status: t.status === 'completed' ? 'active' : 'completed' } : t,
            )
          }
          onAccept={() => {
            buzz(15)
            setTask((t) => (t ? { ...t, status: 'active', receipt: 'accepted' } : t))
            toast('Task accepted', 'success')
          }}
        />
      </div>

      <div ref={scrollRef} className="thread-surface relative min-h-0 flex-1 overflow-y-auto">
        <TaskWallpaper />
        <div className="relative flex flex-col gap-2.5 px-3 py-4">
          {flagged && (
            <span className="animate-rise-in inline-flex w-fit items-center gap-1.5 rounded-[10px] bg-flag px-3 py-2 text-[15.5px] font-medium text-ink">
              <UrgentIcon width={18} height={18} />
              {task.priority === 'urgent' ? 'Urgent!' : 'High priority'}
            </span>
          )}

          {task.note && (
            <div className="bubble animate-rise-in w-fit max-w-[88%] bg-brief">
              <p className="text-[15.5px] leading-[1.4] text-ink">
                <NoteLinesIcon
                  width={16}
                  height={16}
                  className="mr-1.5 inline-block -translate-y-px text-ink/70"
                />
                {task.note}
                <span className="stamp ml-1.5 inline-flex items-center gap-1 align-baseline">
                  {agoLabel(task.at ?? new Date().toISOString())}
                  <EyeIcon width={15} height={15} className="text-thread-meta" />
                </span>
              </p>
            </div>
          )}

          {files.map((f) => (
            <div key={f.id} className="bubble animate-rise-in w-full max-w-[88%] bg-owed">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-9 shrink-0 place-items-center rounded-[6px] text-[9px] font-bold uppercase tracking-wide text-white ${KIND_SKIN[f.kind]}`}
                >
                  {f.kind}
                </span>
                <p className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{f.name}</p>
                <button
                  className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft"
                  aria-label={`Download ${f.name}`}
                  onClick={() => toast('Downloads arrive with the live backend', 'info')}
                >
                  <DownloadIcon width={20} height={20} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                <span className="stamp">
                  {f.kind} {f.size}
                </span>
                <span className="stamp inline-flex items-center gap-1">
                  {agoLabel(f.at)}
                  <EyeIcon width={15} height={15} className="text-thread-meta" />
                </span>
              </div>
            </div>
          ))}

          {history.map((e) => (
            <p key={e.id} className="stamp mx-auto rounded-full bg-paper/70 px-3 py-1 text-center">
              {HISTORY_LABEL[e.event_type] ?? e.event_type} · {agoLabel(e.created_at)}
            </p>
          ))}

          {comments.map((c) => (
            <div key={c.id} className={`flex ${c.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`bubble animate-rise-in max-w-[80%] ${
                  c.mine ? 'bg-owed border border-line' : 'bg-owe'
                }`}
              >
                {c.voice ? (
                  <div className="py-0.5">
                    <VoiceNote duration={c.voice} mine={false} />
                  </div>
                ) : (
                  <p className="text-[15.5px] leading-[1.4] text-ink">
                    {c.body}
                    <span className="stamp ml-2 align-baseline">{clockLabel(c.at)}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="relative bg-bar px-2.5 pt-2.5"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        {/* Jump back up to the brief. */}
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="press absolute -top-14 right-3 grid h-11 w-11 place-items-center rounded-full border border-line bg-paper text-ink shadow-card"
          aria-label="Back to the top of the task"
        >
          <ChevronUpIcon width={22} height={22} />
        </button>

        {recording ? (
          <div className="flex items-center gap-3 rounded-full bg-paper px-4 py-2.5">
            <span className="h-3 w-3 animate-pulse rounded-full bg-overdue" />
            <span className="nums flex-1 text-[14px] font-semibold text-overdue">
              Recording… 0:{String(elapsed).padStart(2, '0')}
            </span>
            <button
              onClick={() => stopRec(false)}
              className="press grid h-9 w-9 place-items-center rounded-full bg-wash text-ink-soft"
              aria-label="Cancel recording"
            >
              <CloseIcon width={18} height={18} />
            </button>
            <button
              onClick={() => stopRec(true)}
              className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper"
              aria-label="Send voice note"
            >
              <StopIcon width={17} height={17} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="press grid h-10 w-8 shrink-0 place-items-center text-ink"
              aria-label="Attach to this task"
              onClick={() =>
                live
                  ? fileRef.current?.click()
                  : toast('Attachments arrive with the live backend', 'info')
              }
            >
              <PlusIcon width={26} height={26} />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                uploadFile.mutate(f, {
                  onError: () => toast('Could not attach that file', 'error'),
                })
                e.target.value = ''
              }}
            />
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-paper px-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={`Chat with ${firstName} about task...`}
                className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
                aria-label={`Comment on ${task.title}`}
              />
              <button
                onClick={startRec}
                className="press shrink-0 text-ink-soft"
                aria-label="Record a voice note"
              >
                <MicIcon width={20} height={20} />
              </button>
            </div>
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-40"
              aria-label="Send comment"
            >
              <ChevronUpIcon width={24} height={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
