import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { smartParse, type Parsed } from '@/lib/smartParse'
import { addDemoTask } from '@/lib/demoStore'
import { SAMPLE_CONTACTS } from '@/lib/sampleData'
import { useToast } from '@/components/Toast'
import { buzz } from '@/lib/haptics'
import { WandIcon, CloseIcon } from '@/components/icons'
import { Avatar } from '@/components/Avatar'

export function SmartAdd() {
  const nav = useNavigate()
  const toast = useToast()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)

  function analyse() {
    if (!text.trim()) return
    setParsed(smartParse(text))
  }

  function create(contactId: string, contactName: string) {
    if (!parsed) return
    addDemoTask(contactId, {
      id: `sa-${Date.now()}`,
      title: parsed.title,
      direction: 'they_owe_me',
      status: 'pending_acceptance',
      priority: parsed.priority,
      expected: parsed.expected,
    })
    buzz([10, 30, 10])
    toast(`Task created for ${contactName.split(' ')[0]}`, 'success')
    setParsed(null)
    setText('')
    nav(`/contacts/${contactId}`)
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-bubble border border-line bg-wash px-3 py-2 focus-within:border-violet focus-within:bg-paper">
        <WandIcon width={18} height={18} className="shrink-0 text-violet-ink" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyse()}
          placeholder="Add anything — e.g. “ask Ben for the report by Friday”"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint"
          aria-label="Smart add a task"
        />
        <button
          onClick={analyse}
          disabled={!text.trim()}
          className="press shrink-0 rounded-full bg-violet px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {parsed && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setParsed(null)}
        >
          <div
            className="animate-rise-in w-full max-w-[460px] rounded-t-[24px] bg-paper p-5 shadow-card sm:rounded-[24px]"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-ink">
                <WandIcon width={15} height={15} /> Understood as
              </span>
              <button
                onClick={() => setParsed(null)}
                className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
                aria-label="Close"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <input
              value={parsed.title}
              onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
              className="field text-[16px] font-semibold"
              aria-label="Task title"
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-wash px-2.5 py-1 text-[12px] font-semibold text-ink-soft">
                Due {parsed.expected}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${
                  parsed.priority === 'urgent'
                    ? 'bg-urgent/15 text-urgent'
                    : parsed.priority === 'high'
                      ? 'bg-violet/10 text-violet-ink'
                      : 'bg-wash text-ink-soft'
                }`}
              >
                {parsed.priority} priority
              </span>
            </div>

            {parsed.contactId ? (
              <button
                onClick={() => create(parsed.contactId!, parsed.contactName!)}
                className="btn-primary mt-5 w-full"
              >
                Send to {parsed.contactName!.split(' ')[0]}
              </button>
            ) : (
              <>
                <p className="eyebrow mb-2 mt-5">Who is this for?</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_CONTACTS.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => create(c.id, c.name)}
                      className="press flex items-center gap-2 rounded-full border border-line py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold hover:bg-wash"
                    >
                      <Avatar initials={c.initials} color={c.color} size={26} />
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
