import { useState } from 'react'
import { looksDiallable, toE164 } from '@/lib/phone'
import { Avatar } from './Avatar'
import { CloseIcon, PlusIcon, SearchIcon } from './icons'
import { useAddContact } from '@/data/hooks'
import type { ContactRequestState } from '@/data/contacts'
import { initialsFrom, colorFor } from '@/data/mappers'
import { COUNTRIES } from '@/lib/config'

type Stage =
  | { step: 'entry' }
  | { step: 'found'; id: string; name: string; state: ContactRequestState }
  | { step: 'missing'; phone: string }
  | { step: 'invited'; phone: string }

/**
 * Find someone by phone number, ask to connect, or invite them if they are not
 * here yet.
 *
 * "Not found" covers two cases the server deliberately does not distinguish:
 * nobody has that number, or the person holding it has blocked you. Both land
 * on the invitation step, which is the only honest thing to show — and the
 * invitation itself reveals nothing either way.
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
  const { find, state, request, invite } = useAddContact()

  // The same rule sign-in uses, so a number that can sign in can be found.
  const phone = toE164(dial, digits)
  const canSearch = looksDiallable(digits)

  function search() {
    if (!canSearch) return
    find.mutate(phone, {
      onSuccess: (profile) => {
        if (!profile) {
          setStage({ step: 'missing', phone })
          return
        }
        // What may be offered is the server's decision, not this sheet's.
        state.mutate(profile.id, {
          onSuccess: (current) =>
            setStage({
              step: 'found',
              id: profile.id,
              name: profile.display_name,
              state: current,
            }),
        })
      },
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
                    {c.code} {c.dial}
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

            {request.isError && (
              <p className="mt-3 text-[13px] font-medium text-overdue-ink">
                We couldn&rsquo;t send that request. Please try again.
              </p>
            )}

            {stage.state === 'open' && (
              <button
                onClick={() =>
                  request.mutate(stage.id, {
                    onSuccess: () => setStage({ ...stage, state: 'sent' }),
                  })
                }
                disabled={request.isPending}
                className="btn-primary mt-4 w-full"
              >
                <PlusIcon width={18} height={18} />
                {request.isPending ? 'Asking…' : `Ask ${stage.name.split(' ')[0]} to connect`}
              </button>
            )}

            {stage.state === 'sent' && (
              <p className="mt-4 rounded-2xl bg-violet/[0.06] px-3 py-3 text-[14px] text-ink-soft">
                Asked. {stage.name.split(' ')[0]} decides whether to accept — you&rsquo;ll see them
                in your contacts if they do.
              </p>
            )}

            {stage.state === 'incoming' && (
              <p className="mt-4 rounded-2xl bg-violet/[0.06] px-3 py-3 text-[14px] text-ink-soft">
                {stage.name.split(' ')[0]} has already asked to connect with you. The request is
                waiting on your Contacts screen.
              </p>
            )}

            {stage.state === 'connected' && (
              <button onClick={() => onAdded(stage.id)} className="btn-primary mt-4 w-full">
                Open {stage.name.split(' ')[0]}
              </button>
            )}

            {(stage.state === 'declined' || stage.state === 'unavailable') && (
              <p className="mt-4 rounded-2xl bg-wash px-3 py-3 text-[14px] text-ink-soft">
                You can&rsquo;t connect with {stage.name.split(' ')[0]} right now.
              </p>
            )}

            <button onClick={() => setStage({ step: 'entry' })} className="btn-ghost mt-2 w-full">
              Search again
            </button>
          </>
        )}

        {stage.step === 'missing' && (
          <>
            <p className="text-[15px] text-ink">
              This number isn&rsquo;t registered on TaskTally yet.
            </p>
            <p className="nums mt-1 text-[13.5px] font-semibold text-ink-soft">{stage.phone}</p>
            <p className="mt-3 text-[13.5px] text-ink-soft">
              Send them one text with a link to install it. We won&rsquo;t tell you whether they
              sign up — they can send you a request once they have.
            </p>

            {invite.isError && (
              <p className="mt-3 text-[13px] font-medium text-overdue-ink">
                {invite.error instanceof Error
                  ? invite.error.message
                  : 'We could not send that invitation.'}
              </p>
            )}

            <button
              onClick={() =>
                invite.mutate(stage.phone, {
                  onSuccess: () => setStage({ step: 'invited', phone: stage.phone }),
                })
              }
              disabled={invite.isPending}
              className="btn-primary mt-4 w-full"
            >
              {invite.isPending ? 'Sending…' : 'Invite by SMS'}
            </button>
            <button onClick={() => setStage({ step: 'entry' })} className="btn-ghost mt-2 w-full">
              Try another number
            </button>
          </>
        )}

        {stage.step === 'invited' && (
          <>
            <p className="text-[15px] text-ink">Invitation sent.</p>
            <p className="mt-2 text-[13.5px] text-ink-soft">
              We texted <span className="nums font-semibold">{stage.phone}</span> a link to
              TaskTally. When they join, either of you can ask to connect.
            </p>
            <button onClick={() => setStage({ step: 'entry' })} className="btn-ghost mt-4 w-full">
              Invite someone else
            </button>
          </>
        )}
      </div>
    </div>
  )
}
