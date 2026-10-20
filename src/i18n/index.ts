import { en, type TranslationKey } from './en'

/**
 * Translation, with English as the floor.
 *
 * Hand-rolled rather than react-i18next: this needs a keyed lookup, a fallback
 * and `{placeholder}` interpolation, which is sixty lines — against a library
 * that would add tens of kilobytes to a bundle downloaded over a mobile
 * connection in the launch market.
 *
 * THERE IS DELIBERATELY NO MACHINE-TRANSLATED CATALOGUE HERE. This is an
 * accountability product: the wording carries obligation ("owes you", "agree",
 * "poke"), and a plausible-but-wrong translation of that is worse than English,
 * which people in the launch market can at least recognise as not their own
 * language. A catalogue goes in when a speaker has written it. See
 * src/i18n/README.md.
 */

export type Catalogue = Partial<Record<TranslationKey, string>>

/**
 * Every catalogue we ship. English is complete by definition; the others are
 * added as they are written, and may be partial — each missing key falls back.
 */
export const CATALOGUES: Record<string, Catalogue> = { en }

export type Vars = Record<string, string | number>

const warned = new Set<string>()

function fill(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

/** The string for `key` in `lang`, falling back to English. */
export function translate(lang: string, key: TranslationKey, vars?: Vars): string {
  const value = CATALOGUES[lang]?.[key] ?? en[key]
  if (value === undefined) {
    // Unreachable through the typed API; possible if a key is built at runtime.
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key)
      console.warn(`[i18n] no string for "${key}"`)
    }
    return key
  }
  return fill(value, vars)
}

/** How much of the interface a language actually covers, 0–1. */
export function coverage(lang: string): number {
  const keys = Object.keys(en) as TranslationKey[]
  const catalogue = CATALOGUES[lang]
  if (!catalogue) return 0
  const have = keys.filter((k) => typeof catalogue[k] === 'string').length
  return have / keys.length
}

/** Whether the interface is actually translated into this language yet. */
export function isTranslated(lang: string): boolean {
  return coverage(lang) > 0.9
}

export type { TranslationKey }
export { en }
