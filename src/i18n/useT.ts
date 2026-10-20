import { useContext } from 'react'
import { I18nContext, type I18n } from './i18nState'

/**
 * The interface language, and the function that reads it.
 *
 * Deliberately throws when there is no provider: a screen rendering raw keys
 * because nobody wrapped it is the failure this is meant to prevent.
 */
export function useT(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}
