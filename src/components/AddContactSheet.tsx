import { useState } from 'react'
import { Avatar } from './Avatar'
import { CloseIcon, PlusIcon, SearchIcon } from './icons'
import { useAddContact } from '@/data/hooks'
import { initialsFrom, colorFor } from '@/data/mappers'
import { COUNTRIES } from '@/lib/config'

type Stage =
  | { step: 'entry' }
  | { step: 'found'; id: string; name: string }
  | { step: 'missing'; phone: string }

/**
 * Find someone by phone number and add them.
 *
 * "Not found" covers two cases the server deliberately does not distinguish:
 * nobody has that number, or the person holding it has blocked you. Both land
 * here as an invite prompt, which is the only honest thing to show.
 */
export function AddContactSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (contactId: string) => void
}) {
  const [dial, setDial] = useState(COUNTRIES[0].dial)
  const [digits, setDigits] = useState('')
  const [stage, setStage] = useState<Stage>({ step: 'entry' })
  const { find, add } = useAddContact()

  const phone = `${dial}${digits.replace(/\D/g, '')}`
  const canSearch = digits.replace(/\D/g, '').length >= 6

  function search() {
    if (!canSearch) return
    find.mutate(phone, {
      onSuccess: (profile) =>
        setStage(
          profile
            ? { step: 'found', id: profile.id, name: profile.display_name }
            : { step: 'missing', phone },
        ),
    })
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
          <h2 className="font-display text-[19px] font-bold">Add someone</h2>
          <button
            onClick={onClose}
            className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
            aria-label="Close"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {stage.step === 'entry' && (
          <>
            <p className="mb-3 text-[13.5px] text-ink-soft">
              Enter their mobile number. They need a TaskTally account.
            </p>
            <div className="flex gap-2">
              <select
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                aria-label="Country code"
                className="field w-[104px] px-2"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <input
                value={digits}
                onChange={(e) => setDigits(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                inputMode="tel"
                placeholder="24 000 0000"
                aria-label="Mobile number"
                className="field flex-1"
              />
            </div>
            {find.isError && (
              <p className="mt-3 text-[13px] font-medium text-overdue-ink">
                We couldn&rsquo;t search just now. Check your connection.
              </p>
            )}
            <button
              onClick={search}
              disabled={!canSearch || find.isPending}
              className="btn-primary mt-4 w-full"
            >
              <SearchIcon width={18} height={18} />
              {find.isPending ? 'Searching…' : 'Find them'}
            </button>
          </>
        )}

        {stage.step === 'found' && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-wash px-3 py-3">
              <Avatar initials={initialsFrom(stage.name)} color={colorFor(stage.id)} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{stage.name}</p>
                <p className="nums text-[13px] text-ink-soft">{phone}</p>
              </div>
            </div>
            {add.isError && (
              <p className="mt-3 text-[13px] font-medium text-overdue-ink">
                We couldn&rsquo;t add them. Please try again.
              </p>
            )}
            <button
              onClick={() => add.mutate(stage.id, { onSuccess: () => onAdded(stage.id) })}
              disabled={add.isPending}
              className="btn-primary mt-4 w-full"
            >
              <PlusIcon width={18} height={18} />
              {add.isPending ? 'Adding…' : `Add ${stage.name.split(' ')[0]}`}
            </button>
            <button onClick={() => setStage({ step: 'entry' })} className="btn-ghost mt-2 w-full">
              Search again
            </button>
          </>
        )}

        {stage.step === 'missing' && (
          <>
            <p className="text-[15px] text-ink">
              Nobody on TaskTally is using <span className="nums font-semibold">{stage.phone}</span>
              .
            </p>
            <p className="mt-2 text-[13.5px] text-ink-soft">
              Invite them to install the app, then add them once they have signed up.
            </p>
            <button onClick={() => setStage({ step: 'entry' })} className="btn-ghost mt-4 w-full">
              Try another number
            </button>
          </>
        )}
      </div>
    </div>
  )
}
