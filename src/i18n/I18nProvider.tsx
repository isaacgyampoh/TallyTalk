import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGUAGE_EVENT, getLanguage, setLanguage } from '@/lib/language'
import { translate } from './index'
import { I18nContext, type I18n } from './i18nState'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(getLanguage)

  const setLang = useCallback((code: string) => {
    setLanguage(code) // dispatches, which the effect below picks up
  }, [])

  // A change can come from somewhere that has no access to this context — the
  // account's own preference, adopted on a new device, for one.
  useEffect(() => {
    const follow = () => setLangState(getLanguage())
    window.addEventListener(LANGUAGE_EVENT, follow)
    return () => window.removeEventListener(LANGUAGE_EVENT, follow)
  }, [])

  const value = useMemo<I18n>(
    () => ({
      lang,
      // Bound to the current language, so changing it re-renders every caller.
      t: (key, vars) => translate(lang, key, vars),
      setLang,
    }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
