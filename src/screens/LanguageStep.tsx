import { useState } from 'react'
import { APP_NAME } from '@/lib/config'
import { offeredLanguages, getLanguage } from '@/lib/language'
import { ChevronRightIcon } from '@/components/icons'
import { useT } from '@/i18n/useT'
import { isTranslated } from '@/i18n'

/**
 * First run, first screen: pick a language.
 *
 * Each option leads with the language's own name, because that is how a speaker
 * recognises it; the English name sits underneath for anyone who opened this by
 * mistake and cannot read the list.
 */
export function LanguageStep({ onDone }: { onDone: () => void }) {
  const { t, setLang } = useT()
  const [choice, setChoice] = useState(getLanguage)

  function confirm() {
    setLang(choice)
    onDone()
  }

  return (
    <div className="app-frame">
      <div className="px-6 pb-4" style={{ paddingTop: 'calc(var(--safe-top) + 40px)' }}>
        <h1 className="text-center font-display text-[26px] font-bold tracking-tight text-ink">
          {t('lang.title', { app: APP_NAME })}
        </h1>
        <p className="mt-1.5 text-center text-[14.5px] text-ink-soft">{t('lang.subtitle')}</p>
      </div>

      <ul
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-28"
        role="radiogroup"
        aria-label={t('lang.group')}
      >
        {offeredLanguages().map((l) => {
          const on = choice === l.code
          return (
            <li key={l.code}>
              <button
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(l.code)}
                className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-wash"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    on ? 'border-violet' : 'border-line'
                  }`}
                >
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-violet" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-medium text-ink">{l.name}</span>
                  {l.english !== l.name && (
                    <span className="block text-[13px] text-ink-soft">{l.english}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {!isTranslated(choice) && (
        <p
          className="absolute inset-x-0 bottom-0 px-6 pb-[calc(var(--safe-bottom)+92px)] text-[12.5px] leading-relaxed text-ink-soft"
          role="status"
        >
          {t('lang.englishOnly')}
        </p>
      )}

      <div
        className="absolute inset-x-0 bottom-0 flex justify-end px-6"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <button
          onClick={confirm}
          aria-label={t('lang.continue')}
          className="press grid h-14 w-14 place-items-center rounded-full bg-violet text-white shadow-float"
        >
          <ChevronRightIcon width={24} height={24} />
        </button>
      </div>
    </div>
  )
}
