import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

type AuthMode = 'live' | 'preview'

interface AuthState {
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

const AuthContext = createContext<AuthState | null>(null)

const PREVIEW_KEY = 'tallytalk.preview'

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isSupabaseConfigured ? 'live' : 'preview'
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [previewSignedIn, setPreviewSignedIn] = useState(
    () => !isSupabaseConfigured && sessionStorage.getItem(PREVIEW_KEY) === '1',
  )

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(() => {
    const signedIn = mode === 'live' ? Boolean(session) : previewSignedIn

    return {
      mode,
      ready,
      session,
      previewSignedIn,
      signedIn,

      async sendCode(phone: string) {
        if (!supabase) return {}
        const { error } = await supabase.auth.signInWithOtp({ phone })
        return error ? { error: error.message } : {}
      },

      async verifyCode(phone: string, code: string) {
        if (!supabase) return {}
        const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
        return error ? { error: error.message } : {}
      },

      enterPreview() {
        sessionStorage.setItem(PREVIEW_KEY, '1')
        setPreviewSignedIn(true)
      },

      async signOut() {
        if (supabase) await supabase.auth.signOut()
        sessionStorage.removeItem(PREVIEW_KEY)
        setPreviewSignedIn(false)
      },
    }
  }, [mode, ready, session, previewSignedIn])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
