import { createContext, useContext } from 'react'

export type ToastKind = 'poke' | 'success' | 'info' | 'error'

// Kept apart from the provider so that file exports only a component.
export const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}
