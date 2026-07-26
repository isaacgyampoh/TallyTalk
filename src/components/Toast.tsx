import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { WandIcon, CheckIcon } from './icons'

type ToastKind = 'poke' | 'success' | 'info'
interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, kind }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2" style={{ bottom: 'calc(var(--safe-bottom) + 84px)' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise-in flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper shadow-card"
          >
            <span className={t.kind === 'poke' ? 'text-violet-glow' : 'text-done'}>
              {t.kind === 'poke' ? <WandIcon width={16} height={16} /> : <CheckIcon width={16} height={16} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
