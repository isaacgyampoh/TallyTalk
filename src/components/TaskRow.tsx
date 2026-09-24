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
      return <EyeIcon width={15} height={15} className="text-thread-meta" aria-hidden="true" />
    case 'accepted':
      return <DoubleCheckIcon width={16} height={16} className="text-tick" aria-hidden="true" />
    case 'approved':
      return (
        <ThumbUpIcon
          width={14}
          height={14}
          className="text-done"
          fill="currentColor"
          aria-hidden="true"
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

  // Read aloud, the visible text runs together as "The files2 DAYS AGO" and the
  // inline glyphs are silent. Spell the row out instead, in the order it reads.
  const stamp = agoLabel(task.at ?? new Date().toISOString())
  const spoken = [
    task.title,
    done ? 'done' : null,
    flagged && !done ? (task.priority === 'urgent' ? 'urgent' : 'high priority') : null,
    task.attachments ? 'has an attachment' : null,
    task.note ? 'has a brief' : null,
    stamp,
    !done && task.receipt && task.receipt !== 'sent' ? task.receipt : null,
    task.comments ? `${task.comments} comments` : null,
  ]
    .filter(Boolean)
    .join('. ')

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
        {/* The bubble is a plain container. The checkbox and the title are
            sibling buttons — nesting one control inside another breaks both
            keyboard navigation and screen readers. */}
        <div className={`bubble animate-rise-in ${skin}`}>
          <div className="flex items-start gap-2">
            <button
              onClick={onToggle}
              className="press mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border-[1.6px] border-ink/40"
              aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
              aria-pressed={done}
            >
              {done && <CheckIcon width={12} height={12} className="text-ink" />}
            </button>

            <button
              onClick={onOpen}
              aria-label={spoken}
              className={`min-w-0 flex-1 cursor-pointer text-left text-[15.5px] leading-[1.35] ${done ? 'text-ink/65 line-through' : 'text-ink'}`}
            >
              {task.title}
              {flagged && !done && (
                <UrgentIcon
                  width={17}
                  height={17}
                  className="mx-1 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-hidden="true"
                />
              )}
              {!!task.attachments && (
                <PaperclipIcon
                  width={15}
                  height={15}
                  className="mx-0.5 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-hidden="true"
                />
              )}
              {task.note && (
                <NoteLinesIcon
                  width={15}
                  height={15}
                  className="mx-0.5 inline-block shrink-0 -translate-y-px text-ink/70"
                  aria-hidden="true"
                />
              )}
              <span
                aria-hidden="true"
                className="stamp ml-1.5 inline-flex items-center gap-1 align-baseline"
              >
                {stamp}
                <ReceiptMark task={task} />
              </span>
            </button>
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
