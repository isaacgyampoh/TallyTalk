import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { OfflineBar } from '@/components/OfflineBar'
import { Avatar } from '@/components/Avatar'
import {
  BackIcon,
  CheckIcon,
  CloseIcon,
  DocIcon,
  DoubleCheckIcon,
  DownloadIcon,
  PaperclipIcon,
  SearchIcon,
} from '@/components/icons'
import {
  useContacts,
  useGroupMembers,
  useGroups,
  useMessageSearch,
  useReceipts,
  useSendFile,
  useSendMessage,
  useThread,
  useThreadAttachments,
  useThreadRealtime,
} from '@/data/hooks'
import { fileProblem, isImage, readableSize, signedFileUrl } from '@/data/messageFiles'
import type { MessageAttachment } from '@/data/messageFiles'
import type { MessageRow, Target } from '@/data/messages'
import { initialsFrom, colorFor } from '@/data/mappers'
import { useToast } from '@/components/toastContext'
import { buzz } from '@/lib/haptics'
import { agoLabel } from '@/lib/time'

/**
 * One conversation, with a person or with a group.
 *
 * Both are the same thing here: a list of messages and a composer. What
 * differs is who may read it, and that is settled in the database — this
 * screen never decides who belongs.
 *
 * History loads a page at a time from the newest end. Everything shown is in
 * the database; nothing is held only in a notification.
 */
export function ChatScreen() {
  const { id = '' } = useParams()
  const location = useLocation()
  const nav = useNavigate()
  const toast = useToast()

  const target: Target = useMemo(
    () => ({ kind: location.pathname.startsWith('/groups/') ? 'group' : 'person', id }),
    [location.pathname, id],
  )

  const { data: contacts } = useContacts()
  const { data: groups } = useGroups()
  const members = useGroupMembers(target.kind === 'group' ? id : '')
  const contact = (contacts ?? []).find((c) => c.id === id)
  const group = (groups ?? []).find((g) => g.id === id)
  const name =
    target.kind === 'group' ? (group?.name ?? 'Group') : (contact?.name ?? 'Conversation')

  const { messages, isPending, isError, refetch, older, reachedStart, loadingOlder, markSeen } =
    useThread(target)
  const send = useSendMessage(target)
  const sendFile = useSendFile(target)
  const files = useThreadAttachments(messages.map((m) => m.id))
  const byMessage = new Map<string, MessageAttachment>(
    (files.data ?? []).map((f) => [f.message_id, f]),
  )
  useThreadRealtime(target)

  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [receiptsFor, setReceiptsFor] = useState<string | null>(null)
  const hits = useMessageSearch(query, target)
  const receipts = useReceipts(receiptsFor)

  const scroller = useRef<HTMLDivElement>(null)
  const bottomMark = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const me = messages.find((m) => m.sender_id !== id)?.sender_id
  const unreadFromOthers = messages.filter((m) => m.sender_id !== me && !m.read_at).map((m) => m.id)

  /**
   * A receipt means someone saw the message, so it is recorded when the end of
   * the conversation is actually on screen in a visible window — not when a
   * background refetch happens to load it.
   */
  const seen = useRef(new Set<string>())
  const recordSeen = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    const fresh = unreadFromOthers.filter((mid) => !seen.current.has(mid))
    if (fresh.length === 0) return
    fresh.forEach((mid) => seen.current.add(mid))
    markSeen(fresh)
  }, [unreadFromOthers, markSeen])

  useEffect(() => {
    const mark = bottomMark.current
    if (!mark) return
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && recordSeen(),
      { threshold: 0.1 },
    )
    observer.observe(mark)
    document.addEventListener('visibilitychange', recordSeen)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', recordSeen)
    }
  }, [recordSeen])

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

  function choose(file: File | undefined) {
    if (!file) return
    // Checked here for a fast, clear message; the bucket enforces the same
    // limits itself, so a client that skipped this would simply be refused.
    const problem = fileProblem(file)
    if (problem) {
      toast(problem, 'error')
      return
    }
    sendFile.mutate(
      { file, note: draft.trim() },
      {
        onSuccess: () => {
          setDraft('')
          atBottom.current = true
        },
        onError: () => toast('Could not send that file — try again', 'error'),
      },
    )
  }

  async function open(path: string) {
    // The bucket is private: a link is signed for a few minutes, and nothing
    // in it is reachable by URL alone.
    const url = await signedFileUrl(path)
    if (!url) {
      toast('Could not open that file', 'error')
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  const shown = query.trim().length >= 2 ? (hits.data ?? []) : messages

  return (
    <div className="app-frame">
      <OfflineBar />
      <header
        className="flex items-center gap-3 border-b border-line bg-paper px-3 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <button
          onClick={() => nav(target.kind === 'group' ? `/groups/${id}` : `/contacts/${id}`)}
          aria-label="Back"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft"
        >
          <BackIcon width={20} height={20} />
        </button>
        <Avatar
          initials={target.kind === 'group' ? name.slice(0, 2) : (contact?.initials ?? '?')}
          color={target.kind === 'group' ? '#6600FF' : (contact?.color ?? '#6600FF')}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[18px] font-bold leading-tight">{name}</h1>
          {target.kind === 'group' && (
            <p className="truncate text-[12px] text-ink-soft">
              {members.data?.length ?? 0} member{(members.data?.length ?? 0) === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setSearching((s) => !s)
            setQuery('')
          }}
          aria-label={searching ? 'Close search' : 'Search this conversation'}
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft"
        >
          {searching ? <CloseIcon width={19} height={19} /> : <SearchIcon width={20} height={20} />}
        </button>
      </header>

      {searching && (
        <div className="border-b border-line bg-paper px-3 pb-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this conversation"
            aria-label="Search this conversation"
            className="field h-10"
          />
          {query.trim().length >= 2 && (
            <p className="px-1 pt-1.5 text-[12.5px] text-ink-soft">
              {hits.isPending
                ? 'Searching…'
                : `${hits.data?.length ?? 0} match${(hits.data?.length ?? 0) === 1 ? '' : 'es'}`}
            </p>
          )}
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!searching && loadingOlder && (
          <p className="py-2 text-center text-[12.5px] text-ink-faint">Loading earlier messages…</p>
        )}
        {!searching && reachedStart && messages.length > 0 && (
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
        {!isPending && !isError && shown.length === 0 && (
          <p className="py-10 text-center text-[14.5px] text-ink-soft">
            {query.trim().length >= 2
              ? 'Nothing matches that.'
              : `Nothing here yet. Say something to ${name.split(' ')[0]}.`}
          </p>
        )}

        <ul className="space-y-1.5">
          {shown.map((m) => (
            <Bubble
              key={m.id}
              message={m as MessageRow}
              mine={m.sender_id !== id && m.sender_id === me}
              group={target.kind === 'group'}
              senderName={
                target.kind === 'group'
                  ? (members.data?.find((x: { user_id: string }) => x.user_id === m.sender_id)
                      ?.member?.display_name ?? 'Someone')
                  : name
              }
              attachment={byMessage.get(m.id)}
              onOpen={open}
              onReceipts={() => setReceiptsFor(m.id)}
            />
          ))}
        </ul>
        <div ref={bottomMark} className="h-1" />
      </div>

      {sendFile.isPending && (
        <p className="border-t border-line bg-paper px-4 py-2 text-[12.5px] text-ink-soft">
          Sending file…
        </p>
      )}

      <div
        className="flex items-end gap-1.5 border-t border-line bg-paper px-3 pt-2"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
          onChange={(e) => {
            choose(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            choose(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={sendFile.isPending}
          aria-label="Attach a file"
          className="press grid h-11 w-10 shrink-0 place-items-center rounded-full text-ink-soft disabled:opacity-40"
        >
          <PaperclipIcon width={20} height={20} />
        </button>
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

      {receiptsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setReceiptsFor(null)}
        >
          <div
            className="animate-rise-in w-full max-w-[420px] rounded-t-[24px] bg-paper p-5 shadow-card sm:rounded-[24px]"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold">Read by</h2>
              <button
                onClick={() => setReceiptsFor(null)}
                aria-label="Close"
                className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            {receipts.isPending && <p className="text-[14px] text-ink-soft">Loading…</p>}
            <ul className="max-h-[50vh] overflow-y-auto">
              {(receipts.data ?? []).map((r) => (
                <li
                  key={r.user_id}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <Avatar
                    initials={initialsFrom(r.display_name)}
                    color={colorFor(r.user_id)}
                    size={32}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                    {r.display_name}
                  </span>
                  <span className="stamp shrink-0">
                    {r.read_at ? `Read ${agoLabel(r.read_at)}` : 'Not read yet'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              A message is marked read when it has been on screen, not when the app fetched it.
              TaskTally cannot tell whether a notification reached a device, so it does not claim
              delivery.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Bubble({
  message: m,
  mine,
  group,
  senderName,
  attachment,
  onOpen,
  onReceipts,
}: {
  message: MessageRow
  mine: boolean
  group: boolean
  senderName: string
  attachment?: MessageAttachment
  onOpen: (path: string) => void
  onReceipts: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const thumb = attachment?.thumbnail_path
    if (!thumb) return
    void signedFileUrl(thumb).then((url) => {
      if (alive) setPreview(url)
    })
    return () => {
      alive = false
    }
  }, [attachment?.thumbnail_path])

  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-bubble px-3 py-2 ${
          mine ? 'bg-violet text-white' : 'bg-paper text-ink shadow-soft'
        }`}
      >
        {group && !mine && (
          <p className="mb-0.5 text-[12px] font-semibold text-violet-ink">{senderName}</p>
        )}

        {attachment && isImage(attachment.mime_type) && preview && (
          <button
            onClick={() => onOpen(attachment.storage_path)}
            className="press mb-1.5 block overflow-hidden rounded-xl"
            aria-label={`Open ${attachment.file_name}`}
          >
            <img
              src={preview}
              alt={attachment.file_name}
              loading="lazy"
              className="max-h-64 w-full object-cover"
            />
          </button>
        )}

        {attachment && !(isImage(attachment.mime_type) && preview) && (
          <button
            onClick={() => onOpen(attachment.storage_path)}
            className={`press mb-1.5 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left ${
              mine ? 'bg-white/15' : 'bg-wash'
            }`}
          >
            <span
              className={`grid h-9 w-8 shrink-0 place-items-center rounded-[6px] ${
                mine ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink-soft'
              }`}
            >
              <DocIcon width={16} height={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">
                {attachment.file_name}
              </span>
              <span className={`block text-[11.5px] ${mine ? 'text-white/70' : 'text-ink-faint'}`}>
                {readableSize(attachment.file_size)}
              </span>
            </span>
            <DownloadIcon width={17} height={17} className="shrink-0" />
          </button>
        )}

        {m.body && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
        )}

        <span
          className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${
            mine ? 'text-white/70' : 'text-ink-faint'
          }`}
        >
          {agoLabel(m.created_at)}
          {mine &&
            (group ? (
              <button onClick={onReceipts} className="press underline underline-offset-2">
                Read by
              </button>
            ) : m.read_at ? (
              <span className="inline-flex items-center gap-0.5">
                <DoubleCheckIcon width={14} height={14} />
                <span className="sr-only">Read</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5">
                <CheckIcon width={12} height={12} />
                <span className="sr-only">Sent</span>
              </span>
            ))}
        </span>
      </div>
    </li>
  )
}
