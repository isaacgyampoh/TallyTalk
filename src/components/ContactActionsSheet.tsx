import { CloseIcon } from './icons'
import { useContactFlags } from '@/data/hooks'
import type { SampleContact } from '@/lib/sampleData'

interface Action {
  key: 'is_work' | 'is_favorite' | 'is_archived' | 'is_blocked'
  label: string
  on: string
  hint?: string
  danger?: boolean
}

const ACTIONS: Action[] = [
  { key: 'is_work', label: 'Work contact', on: 'In Work' },
  { key: 'is_favorite', label: 'Favourite', on: 'Favourited' },
  { key: 'is_archived', label: 'Archive', on: 'Archived', hint: 'Hidden from your main list.' },
  {
    key: 'is_blocked',
    label: 'Block',
    on: 'Blocked',
    hint: 'They cannot send you tasks, messages or pokes.',
    danger: true,
  },
]

/**
 * How I classify this person. These flags are one-sided: the other person
 * classifies me in their own row, and never sees this.
 */
export function ContactActionsSheet({
  contact,
  onClose,
  onError,
}: {
  contact: SampleContact
  onClose: () => void
  onError: (message: string) => void
}) {
  const flags = useContactFlags()

  const current: Record<Action['key'], boolean> = {
    is_work: !!contact.work,
    is_favorite: !!contact.favorite,
    is_archived: false, // archived contacts are filtered out of the list already
    is_blocked: false, // likewise; blocking is set here, never read back here
  }

  function toggle(a: Action) {
    flags.mutate(
      { contactId: contact.id, patch: { [a.key]: !current[a.key] } },
      { onError: () => onError(`Could not update ${contact.name.split(' ')[0]}`) },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-rise-in w-full max-w-[460px] rounded-t-[24px] bg-paper p-5 shadow-card sm:rounded-[24px]"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-[19px] font-bold">{contact.name}</h2>
          <button
            onClick={onClose}
            className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
            aria-label="Close"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <p className="mb-3 text-[13px] text-ink-soft">Only you see how you classify someone.</p>

        <div className="flex flex-col">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => toggle(a)}
              disabled={flags.isPending}
              aria-pressed={current[a.key]}
              className="press flex items-center justify-between rounded-2xl px-3 py-3 text-left hover:bg-wash disabled:opacity-50"
            >
              <span className="min-w-0">
                <span
                  className={`block text-[15px] font-semibold ${a.danger ? 'text-overdue-ink' : 'text-ink'}`}
                >
                  {a.label}
                </span>
                {a.hint && <span className="block text-[12.5px] text-ink-soft">{a.hint}</span>}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  current[a.key] ? 'bg-violet-tint text-violet-ink' : 'bg-wash text-ink-faint'
                }`}
              >
                {current[a.key] ? a.on : 'Off'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
