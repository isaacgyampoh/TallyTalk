import { useState } from 'react'
import { CloseIcon } from './icons'

export function NameSheet({
  title,
  placeholder,
  cta,
  onCreate,
  onClose,
}: {
  title: string
  placeholder: string
  cta: string
  onCreate: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
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
          <h2 className="font-display text-[19px] font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="press grid h-8 w-8 place-items-center rounded-full text-ink-faint"
            aria-label="Close"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim())}
          placeholder={placeholder}
          className="field text-[16px]"
          aria-label={title}
        />
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          disabled={!name.trim()}
          className="btn-primary mt-4 w-full"
        >
          {cta}
        </button>
      </div>
    </div>
  )
}
