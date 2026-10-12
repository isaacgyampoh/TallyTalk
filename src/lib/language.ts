/**
 * The language a person chooses before they have an account.
 *
 * `profiles.preferred_language` is where this belongs, but that row does not
 * exist until after sign-up, so the choice is held locally first and written to
 * the profile on the first signed-in load.
 *
 * IMPORTANT: choosing a language records the preference. It does not translate
 * the interface — there is no i18n layer in this project yet, and pretending
 * otherwise would be worse than the gap. See the card for translation.
 */

export interface Language {
  /** BCP-47-ish code stored in profiles.preferred_language. */
  code: string
  /** The language's own name, which is how a speaker recognises it. */
  name: string
  /** The English name, for people who landed here by accident. */
  english: string
}

/** Ghana first, since that is the launch market. */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'tw', name: 'Twi', english: 'Twi' },
  { code: 'gaa', name: 'Gã', english: 'Ga' },
  { code: 'ee', name: 'Eʋegbe', english: 'Ewe' },
  { code: 'ha', name: 'Hausa', english: 'Hausa' },
  { code: 'pcm', name: 'Pidgin', english: 'Ghanaian Pidgin' },
]

const KEY = 'tt.language'

export function getLanguage(): string {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored
  } catch {
    /* private mode */
  }
  return 'en'
}

export function setLanguage(code: string): void {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    /* private mode — the choice just will not survive a restart */
  }
}

/** Whether a language has been chosen at all, which decides if the step shows. */
export function hasChosenLanguage(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}
