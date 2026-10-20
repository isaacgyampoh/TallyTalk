import { createContext } from 'react'
import type { TranslationKey, Vars } from './index'

/**
 * The context itself, kept apart from the provider component — the same split
 * as context/authState.ts, so a file either exports components or exports
 * state, and fast refresh keeps working.
 */
export interface I18n {
  lang: string
  /** Translate a key, with `{placeholder}` substitution. */
  t: (key: TranslationKey, vars?: Vars) => string
  /** Change the interface language. Persists locally; the profile follows. */
  setLang: (code: string) => void
}

export const I18nContext = createContext<I18n | null>(null)
