import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemePref } from './themeState'
import { initNative, syncStatusBar } from '@/lib/platform'

const KEY = 'tt.theme'

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(
    () => (localStorage.getItem(KEY) as ThemePref) || 'system',
  )
  const [sysDark, setSysDark] = useState(systemDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved: 'light' | 'dark' = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme

  useEffect(() => {
    apply(resolved)
    syncStatusBar(resolved)
  }, [resolved])

  useEffect(() => {
    initNative(resolved)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = (t: ThemePref) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
  }

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
