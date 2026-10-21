import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OfflineBar } from '@/components/OfflineBar'
import { Avatar } from '@/components/Avatar'
import { BackIcon, CheckIcon, DoubleCheckIcon } from '@/components/icons'
import { useContacts, useSendMessage, useThread, useThreadRealtime } from '@/data/hooks'
import { useToast } from '@/components/toastContext'
import { buzz } from '@/lib/haptics'
import { agoLabel } from '@/lib/time'

/**
 * One conversation.
 *
 * History loads a page at a time from the end, because a conversation is read
 * from its newest message and the oldest ones are rarely wanted. Everything
 * shown here is in the database — nothing is held only in a notification.
 */
export function ChatScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { data: contacts } = useContacts()
  const contact = (contacts ?? []).find((c) => c.id === id)

  const { messages, isPending, isError, refetch, older, reachedStart, loadingOlder, markRead } =
    useThread(id)
  const send = useSendMessage(id)
  useThreadRealtime(id)

  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)

  // Anything they sent is read once it is on screen.
  useEffect(() => {
    if (messages.some((m) => m.recipient_id !== m.sender_id && !m.read_at)) markRead()
  }, [messages, markRead])

  // Stay at the newest message, unless the person has scrolled up to read.
  useEffect(() => {
    if (atBottom.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length])

  function onScroll() {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 60 && !reachedStart && !loadingOlder) void older()
  }

  function submit() {
    const body = draft.trim()
    // A second tap while the first is in flight would send it twice.
    if (!body || send.isPending) return
    buzz(10)
    send.mutate(body, {
      onSuccess: () => {
        setDraft('')
        atBottom.current = true
      },
      // The draft stays exactly where it is, so nothing typed is lost.
      onError: () => toast('Could not send that — try again', 'error'),
    })
  }

  const name = contact?.name ?? 'Conversation'

  return (
    <div className="app-frame">
      <OfflineBar />
      <header
        className="flex items-center gap-3 border-b border-line bg-paper px-3 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <button
          onClick={() => nav(`/contacts/${id}`)}
          aria-label="Back"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft"
        >
          <BackIcon width={20} height={20} />
        </button>
        {contact && <Avatar initials={contact.initials} color={contact.color} size={36} />}
        <h1 className="min-w-0 flex-1 truncate font-display text-[18px] font-bold">{name}</h1>
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loadingOlder && (
          <p className="py-2 text-center text-[12.5px] text-ink-faint">Loading earlier messages…</p>
        )}
        {reachedStart && messages.length > 0 && (
          <p className="py-2 text-center text-[12.5px] text-ink-faint">
            This is the start of your conversation.
          </p>
        )}
        {isPending && <p className="py-6 text-center text-[15px] text-ink-soft">Loading…</p>}
        {isError && (
          <div className="py-6 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load this conversation.</p>
            <button onClick={() => refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </div>
        )}
        {!isPending && !isError && messages.length === 0 && (
          <p className="py-10 text-center text-[14.5px] text-ink-soft">
            Nothing here yet. Say something to {name.split(' ')[0]}.
          </p>
        )}

        <ul className="space-y-1.5">
          {messages.map((m) => {
            const mine = m.sender_id !== id
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-bubble px-3 py-2 ${
                    mine ? 'bg-violet text-white' : 'bg-paper text-ink shadow-soft'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                    {m.body}
                  </p>
                  <span
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${
                      mine ? 'text-white/70' : 'text-ink-faint'
                    }`}
                  >
                    {agoLabel(m.created_at)}
                    {mine &&
                      (m.read_at ? (
                        <DoubleCheckIcon width={14} height={14} />
                      ) : (
                        <CheckIcon width={12} height={12} />
                      ))}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div
        className="flex items-end gap-2 border-t border-line bg-paper px-3 pt-2"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder={`Message ${name.split(' ')[0]}`}
          aria-label="Message"
          className="field max-h-28 min-h-11 flex-1 resize-none py-2.5"
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || send.isPending}
          aria-label="Send"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-40"
        >
          <CheckIcon width={20} height={20} />
        </button>
      </div>
    </div>
  )
}
