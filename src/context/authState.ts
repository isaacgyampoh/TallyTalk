import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthMode = 'live' | 'preview'

export interface AuthState {
  mode: AuthMode
  ready: boolean
  session: Session | null
  /** true in preview mode after the user taps "Explore with sample data" */
  previewSignedIn: boolean
  signedIn: boolean
  sendCode: (phone: string) => Promise<{ error?: string }>
  verifyCode: (phone: string, code: string) => Promise<{ error?: string }>
  enterPreview: () => void
  signOut: () => Promise<void>
}

// Kept apart from the provider so that file exports only a component.
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
