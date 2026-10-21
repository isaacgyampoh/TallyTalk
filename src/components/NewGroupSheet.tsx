import { useState } from 'react'
import { Avatar } from './Avatar'
import { CheckIcon, CloseIcon } from './icons'
import { useContacts, useCreateGroup, useAddGroupMembers } from '@/data/hooks'

/**
 * Making a group: a name, and the people in it.
 *
 * Only accepted contacts can be chosen. That is not a convenience — adding
 * someone to a group lets them see everything said there, so it has to be
 * someone who already agreed to be connected to you.
 */
export function NewGroupSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (groupId: string) => void
}) {
  const { data: contacts } = useContacts()
  const create = useCreateGroup()
  const addMembers = useAddGroupMembers()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const people = contacts ?? []

  function toggle(id: string) {
    setPicked((held) => (held.includes(id) ? held.filter((x) => x !== id) : [...held, id]))
  }

  async function submit() {
    if (!name.trim() || busy) return
    setBusy(true)
    setFailed(false)
    try {
      const groupId = await create.mutateAsync(name.trim())
      // Adding members is a second step by necessity: the group has to exist,
      // and the trigger has to have seated its administrator, before anyone
      // else can be put in it.
      if (picked.length > 0) await addMembers.mutateAsync({ groupId, userIds: picked })
      onCreated(groupId)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[19px] font-bold">New group</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wedding Committee"
          aria-label="Group name"
          className="field"
        />

        <p className="eyebrow mb-2 mt-4">
          Who is in it{picked.length > 0 && ` · ${picked.length} chosen`}
        </p>

        {people.length === 0 && (
          <p className="rounded-2xl bg-wash px-3 py-3 text-[13.5px] text-ink-soft">
            You have no contacts yet. A group is made from people you are already connected to.
          </p>
        )}

        <ul className="max-h-[38vh] overflow-y-auto">
          {people.map((c) => {
            const on = picked.includes(c.id)
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-wash"
                >
                  <Avatar initials={c.initials} color={c.color} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                    {c.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                      on ? 'border-violet bg-violet text-white' : 'border-line'
                    }`}
                  >
                    {on && <CheckIcon width={14} height={14} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {failed && (
          <p className="mt-3 text-[13px] font-medium text-overdue-ink">
            We couldn&rsquo;t finish making that group. Please try again.
          </p>
        )}

        <button
          onClick={() => void submit()}
          disabled={!name.trim() || busy}
          className="btn-primary mt-4 w-full disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </div>
  )
}
