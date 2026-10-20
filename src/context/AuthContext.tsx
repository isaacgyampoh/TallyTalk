import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from './authState'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { unregisterPush } from '@/lib/push'
import { readableAuthError } from './authErrors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

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
    const signedIn = Boolean(session)

    return {
      ready,
      session,
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

      async signOut() {
        // Detach the device before the session goes: the delete needs it, and
        // leaving the token behind sends this account's notifications to
        // whoever uses the device next.
        await unregisterPush()
        if (supabase) await supabase.auth.signOut().catch(() => {})
      },
    }
  }, [ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
