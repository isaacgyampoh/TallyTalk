import type { SampleTask } from '@/lib/sampleData'
import { PRIORITIES, EXPECTED_PERIODS, type Priority } from '@/lib/config'
import { WandIcon, CheckIcon, CloseIcon } from './icons'

export interface DetailTask extends SampleTask {
  mine: boolean
}

export function TaskDetail({
  task,
  peer,
  onClose,
  onAccept,
  onDecline,
  onComplete,
  onReopen,
  onCancel,
  onPoke,
  onSetPriority,
  onSetExpected,
}: {
  task: DetailTask
  peer: string
  onClose: () => void
  onAccept: () => void
  onDecline: () => void
  onComplete: () => void
  onReopen: () => void
  onCancel: () => void
  onPoke: () => void
  onSetPriority: (p: Priority) => void
  onSetExpected: (e: string) => void
}) {
  const pending = task.status === 'pending_acceptance'
  const active = task.status === 'active'
  const done = task.status === 'completed'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" onClick={onClose}>
      <div
        className="animate-rise-in w-full max-w-[460px] rounded-t-[24px] bg-paper p-5 shadow-card sm:rounded-[24px]"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            done ? 'bg-done/12 text-done' : pending ? 'bg-wash text-ink-soft' : 'bg-violet-tint text-violet-ink'
          }`}>
            {done ? 'Completed' : pending ? 'Pending acceptance' : 'Active'}
          </span>
          <button onClick={onClose} className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint" aria-label="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <h2 className="font-display text-[20px] font-bold leading-snug">{task.title}</h2>
        <p className="mt-1 text-[13.5px] text-ink-faint">
          {task.mine ? `You asked ${peer}` : `${peer} asked you`}
        </p>
        {task.note && (
          <p className="mt-3 rounded-2xl bg-wash px-3.5 py-3 text-[14px] text-ink-soft">{task.note}</p>
        )}

        {/* editable priority */}
        <p className="eyebrow mt-5 mb-2">Priority</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => onSetPriority(p.value)}
              className={`press rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                task.priority === p.value ? 'bg-ink text-white' : 'bg-wash text-ink-soft'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* editable expected */}
        <p className="eyebrow mt-4 mb-2">Expected by</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPECTED_PERIODS.map((e) => (
            <button
              key={e.value}
              onClick={() => onSetExpected(e.label)}
              className={`press rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                task.expected === e.label ? 'bg-ink text-white' : 'bg-wash text-ink-soft'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* actions */}
        <div className="mt-6 flex gap-2">
          {pending && !task.mine && (
            <>
              <button onClick={onAccept} className="btn-primary flex-1">Accept</button>
              <button onClick={onDecline} className="btn-ghost flex-1">Decline</button>
            </>
          )}
          {pending && task.mine && (
            <>
              <button onClick={onPoke} className="btn-primary flex-1 gap-2"><WandIcon width={18} height={18} /> Poke {peer}</button>
              <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
            </>
          )}
          {active && (
            <>
              <button onClick={onComplete} className="btn-primary flex-1 gap-2"><CheckIcon width={18} height={18} /> Mark done</button>
              {task.mine && <button onClick={onPoke} className="btn-ghost flex-1 gap-2"><WandIcon width={18} height={18} /> Poke</button>}
            </>
          )}
          {done && <button onClick={onReopen} className="btn-ghost w-full">Reopen task</button>}
        </div>
      </div>
    </div>
  )
}
