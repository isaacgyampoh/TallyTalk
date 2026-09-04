import { agoLabel } from '@/lib/time'
import type { SampleTask } from '@/lib/sampleData'
import {
  CheckIcon,
  CommentIcon,
  DoubleCheckIcon,
  EyeIcon,
  NoteLinesIcon,
  PaperclipIcon,
  ThumbUpIcon,
  UrgentIcon,
} from './icons'

/** Which side of the ledger a task sits on. */
export type Side = 'owe' | 'owed'

/** How far the other person has got — the glyph after the timestamp. */
function ReceiptMark({ task }: { task: SampleTask }) {
  if (task.status === 'completed') return null
  switch (task.receipt) {
    case 'seen':
      return <EyeIcon width={15} height={15} className="text-thread-meta" aria-label="Seen" />
    case 'accepted':
      return <DoubleCheckIcon width={16} height={16} className="text-tick" aria-label="Accepted" />
    case 'approved':
      return (
        <ThumbUpIcon
          width={14}
          height={14}
          className="text-done"
          fill="currentColor"
          aria-label="Approved"
        />
      )
    default:
      return null
  }
}

/**
 * One task bubble. Green on the left is what I owe them; white on the right is
 * what they owe me — the same two sides the Contacts list tallies.
 */
export function TaskRow({
  task,
  side,
  onOpen,
  onToggle,
  onAccept,
  showComments = true,
}: {
  task: SampleTask
  side: Side
  onOpen?: () => void
  onToggle?: () => void
  onAccept?: () => void
  /** Off when the row is pinned above the comments it would link to. */
  showComments?: boolean
}) {
  const done = task.status === 'completed'
  const flagged = task.priority === 'urgent' || task.priority === 'high'
  // You accept what someone asked of you, never what you asked of them.
  const canAccept = side === 'owe' && task.status === 'pending_acceptance'

  const skin = done
    ? side === 'owe'
      ? 'bg-owe-done'
      : 'bg-owed-done border border-line'
    : side === 'owe'
      ? 'bg-owe'
      : 'bg-owed border border-line'

  return (
    <div className={`flex flex-col ${side === 'owe' ? 'items-start' : 'items-end'}`}>
      <div className="flex max-w-[86%] items-start gap-2">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen?.()
            }
          }}
          className={`bubble animate-rise-in cursor-pointer ${skin}`}
        >
          <div className="flex items-start gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle?.()
              }}
              className="press mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border-[1.6px] border-ink/40"
              aria-label={done ? 'Mark not done' : 'Mark done'}
              aria-pressed={done}
            >
              {done && <CheckIcon width={12} height={12} className="text-ink" />}
            </button>

            <p
              className={`text-[15.5px] leading-[1.35] ${done ? 'text-ink/65 line-through' : 'text-ink'}`}
            >
              {task.title}
              {flagged && !done && (
                <UrgentIcon
                  width={17}
                  height={17}
                  className="mx-1 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-label="Urgent"
                />
              )}
              {!!task.attachments && (
                <PaperclipIcon
                  width={15}
                  height={15}
                  className="mx-0.5 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-label="Has an attachment"
                />
              )}
              {task.note && (
                <NoteLinesIcon
                  width={15}
                  height={15}
                  className="mx-0.5 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-label="Has a brief"
                />
              )}
              <span className="stamp ml-1.5 inline-flex items-center gap-1 align-baseline">
                {agoLabel(task.at ?? new Date().toISOString())}
                <ReceiptMark task={task} />
              </span>
            </p>
          </div>
        </div>

        {canAccept && (
          <button
            onClick={onAccept}
            className="press mt-0.5 shrink-0 rounded-[9px] bg-accept px-3.5 py-2 text-[15px] font-semibold text-accept-ink"
          >
            Accept
          </button>
        )}
      </div>

      {showComments && !!task.comments && (
        <button
          onClick={onOpen}
          className={`press mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-soft ${
            side === 'owe' ? 'ml-3' : 'mr-3 flex-row-reverse'
          }`}
        >
          <span
            aria-hidden="true"
            className={`-mt-3 h-3.5 w-3.5 border-b border-thread-meta/60 ${
              side === 'owe' ? 'rounded-bl-[5px] border-l' : 'rounded-br-[5px] border-r'
            }`}
          />
          {task.comments} Comments
          <CommentIcon width={14} height={14} />
        </button>
      )}
    </div>
  )
}
