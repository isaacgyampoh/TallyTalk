import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isAppMode } from '@/lib/platform'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { BackIcon, CheckIcon, PhoneIcon, PlusIcon } from '@/components/icons'
import { PREDEFINED_CHECKLISTS } from '@/lib/config'
import { SAMPLE_CHECKLIST_ITEMS, type ChecklistItem } from '@/lib/sampleData'
import { getCustomList } from '@/lib/demoStore'
import { OfflineBar } from '@/components/OfflineBar'
import {
  needsDailyReset,
  useChecklistItems,
  useChecklistMutations,
  useChecklists,
  useIsLive,
  useResetChecklist,
} from '@/data/hooks'

const listColor = (key: string) => {
  const i = PREDEFINED_CHECKLISTS.findIndex((l) => l.key === key)
  return ['#6600FF', '#0E7C86', '#B4530A', '#8A3BFF', '#2B7A3B', '#B02A6F'][(i < 0 ? 0 : i) % 6]
}

export function ChecklistDetailScreen() {
  const nav = useNavigate()
  useSwipeBack()
  const { key = '' } = useParams()
  const live = useIsLive()
  const { data: lists } = useChecklists()
  const liveList = live ? lists?.find((l) => l.id === key) : undefined
  const itemsQuery = useChecklistItems(key)
  const { toggle: toggleItem, add: addItem } = useChecklistMutations(key)
  const resetList = useResetChecklist(key)

  const meta = PREDEFINED_CHECKLISTS.find((l) => l.key === key)
  const custom = meta || live ? undefined : getCustomList(key)
  const title = liveList?.title ?? meta?.title ?? custom?.title ?? 'Checklist'
  const behavior = liveList?.behavior ?? meta?.behavior ?? 'normal'
  const color = listColor(key)

  // Preview keeps its rows in state; live reads them from the database and maps
  // the row shape onto the one this screen already renders.
  const [previewItems, setPreviewItems] = useState<ChecklistItem[]>(
    () => SAMPLE_CHECKLIST_ITEMS[key]?.map((i) => ({ ...i })) ?? [],
  )
  const items: ChecklistItem[] = useMemo(
    () =>
      live
        ? (itemsQuery.data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            done: r.is_completed,
            phone: r.phone_number ?? undefined,
          }))
        : previewItems,
    [live, itemsQuery.data, previewItems],
  )
  const [draft, setDraft] = useState('')

  // A daily list clears itself the first time it is opened on a new day. Guarded
  // by a ref as well as the stamp so a re-render cannot fire it twice while the
  // first write is still in flight.
  const resetFired = useRef(false)
  useEffect(() => {
    if (!live || !liveList || resetFired.current) return
    if (!needsDailyReset(liveList)) return
    resetFired.current = true
    resetList.mutate()
  }, [live, liveList, resetList])

  const { open, done } = useMemo(
    () => ({ open: items.filter((i) => !i.done).length, done: items.filter((i) => i.done).length }),
    [items],
  )

  function toggle(id: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (!live) {
      setPreviewItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
      return
    }
    toggleItem.mutate({ itemId: id, isCompleted: !item.done })
  }

  function add() {
    const t = draft.trim()
    if (!t) return
    if (!live) {
      setPreviewItems((prev) => [...prev, { id: `n-${Date.now()}`, title: t, done: false }])
      setDraft('')
      return
    }
    addItem.mutate(t, { onSuccess: () => setDraft('') })
  }

  function resetAll() {
    if (!live) {
      setPreviewItems((prev) => prev.map((i) => ({ ...i, done: false })))
      return
    }
    resetList.mutate()
  }

  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done))

  const loading = live && itemsQuery.isPending
  const failed = live && itemsQuery.isError

  return (
    <div className="app-frame">
      <OfflineBar />
      <header
        className="flex items-center gap-3 border-b border-line px-4 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        {!isAppMode && (
          <button
            className="press grid h-9 w-9 place-items-center rounded-full text-ink-soft"
            onClick={() => nav(-1)}
            aria-label="Back"
          >
            <BackIcon />
          </button>
        )}
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-[17px] font-bold text-white"
          style={{ background: color }}
        >
          {title[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[18px] font-bold leading-tight">{title}</p>
          <p className="nums text-[12.5px] text-ink-faint">
            {open} to do{done > 0 && ` · ${done} done`}
          </p>
        </div>
        {(behavior === 'manual_reset' || behavior === 'daily_reset') && done > 0 && (
          <button
            onClick={resetAll}
            className="press rounded-full bg-wash px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft"
          >
            Reset
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <p className="px-3 py-8 text-center text-[15px] text-ink-soft">Loading this list…</p>
        )}

        {failed && (
          <div className="px-3 py-8 text-center">
            <p className="text-[15px] text-ink">We couldn&rsquo;t load this list.</p>
            <button onClick={() => itemsQuery.refetch()} className="btn-ghost mt-3">
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !failed &&
          sorted.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <button
                onClick={() => toggle(item.id)}
                className={`press grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                  item.done ? 'border-done bg-done text-white' : 'border-ink-faint text-transparent'
                }`}
                aria-label={item.done ? 'Mark not done' : 'Mark done'}
              >
                <CheckIcon width={15} height={15} />
              </button>
              <span
                className={`flex-1 text-[15px] ${item.done ? 'text-ink-faint line-through' : 'text-ink'}`}
              >
                {item.title}
              </span>
              {behavior === 'call' && item.phone && !item.done && (
                <a
                  href={`tel:${item.phone}`}
                  className="press grid h-9 w-9 place-items-center rounded-full bg-violet-tint text-violet-ink"
                  aria-label={`Call ${item.title}`}
                >
                  <PhoneIcon width={17} height={17} />
                </a>
              )}
            </div>
          ))}

        {!loading && !failed && items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">Nothing here yet</p>
            <p className="mt-1 text-[14px] text-ink-soft">Add your first item below.</p>
          </div>
        )}
      </div>

      <div
        className="border-t border-line px-3 pt-2"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 10px)' }}
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={`Add to ${title}…`}
            className="field flex-1"
            aria-label="New checklist item"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-white shadow-float disabled:opacity-40 disabled:shadow-none"
            aria-label="Add item"
          >
            <PlusIcon width={22} height={22} />
          </button>
        </div>
      </div>
    </div>
  )
}
