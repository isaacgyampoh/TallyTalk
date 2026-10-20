import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True only when both public Supabase env vars are present. When false there is
 * no client at all: the app can show its public pages, and anything that needs
 * an account reports that the server is unreachable rather than inventing data.
 */
export const isSupabaseConfigured = Boolean(url && anon)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
