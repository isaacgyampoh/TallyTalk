import { createContext, useContext } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

export interface ThemeState {
  theme: ThemePref
  resolved: 'light' | 'dark'
  setTheme: (t: ThemePref) => void
}

// Kept apart from the provider so that file exports only a component, which is
// what Fast Refresh needs to reload it reliably.
export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
