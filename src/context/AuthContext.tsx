import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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

/** sessionStorage throws in some privacy modes; never let that break boot. */
function readPreviewFlag(): boolean {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

function writePreviewFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(PREVIEW_KEY, '1')
    else sessionStorage.removeItem(PREVIEW_KEY)
  } catch {
    /* private mode — the flag just won't survive the reload */
  }
}

const UNREACHABLE =
  "We can't reach the server right now. Check your connection, or explore with sample data."

/** supabase-js reports a dead host or no network as a bare fetch failure. */
function readableAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message)
    ? UNREACHABLE
    : message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isSupabaseConfigured ? 'live' : 'preview'
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  // Only an explicit "explore with sample data" tap sets this, so honour it in
  // both modes — reading it only when Supabase is unconfigured meant a reload
  // dropped the demo on any build that does have a backend configured.
  const [previewSignedIn, setPreviewSignedIn] = useState(readPreviewFlag)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {
        /* transient failure — fall through to the sign-in screen rather than hang */
      })
      .finally(() => setReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(() => {
    const signedIn = Boolean(session) || previewSignedIn

    return {
      mode,
      ready,
      session,
      previewSignedIn,
      signedIn,

      async sendCode(phone: string) {
        if (!supabase) return {}
        try {
          const { error } = await supabase.auth.signInWithOtp({ phone })
          return error ? { error: readableAuthError(error) } : {}
        } catch (err) {
          return { error: readableAuthError(err) }
        }
      },

      async verifyCode(phone: string, code: string) {
        if (!supabase) return {}
        try {
          const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
          return error ? { error: readableAuthError(error) } : {}
        } catch (err) {
          return { error: readableAuthError(err) }
        }
      },

      enterPreview() {
        writePreviewFlag(true)
        setPreviewSignedIn(true)
      },

      async signOut() {
        if (supabase) await supabase.auth.signOut().catch(() => {})
        writePreviewFlag(false)
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
