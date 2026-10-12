import { useNavigate, useParams } from 'react-router-dom'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { BackIcon } from '@/components/icons'
import { PRIVACY, TERMS, type LegalDoc } from '@/content/legal'

const DOCS: Record<string, LegalDoc> = { privacy: PRIVACY, terms: TERMS }

/**
 * Reachable both from the app's Welcome screen and as a public page, since an
 * app store reviewer and a prospective user both need to read it without an
 * account.
 */
export function LegalScreen() {
  const nav = useNavigate()
  useSwipeBack()
  const { doc = 'privacy' } = useParams()
  const content = DOCS[doc]

  if (!content) {
    return (
      <div className="app-frame items-center justify-center px-8 text-center">
        <div>
          <p className="font-display text-lg font-semibold">That page doesn&rsquo;t exist</p>
          <button onClick={() => nav(-1)} className="btn-ghost mt-5">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-frame">
      <header
        className="flex items-center gap-2 border-b border-line px-3 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          className="press grid h-9 w-9 place-items-center rounded-full text-ink"
        >
          <BackIcon width={22} height={22} />
        </button>
        <h1 className="font-display text-[18px] font-bold text-ink">{content.title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <p className="text-[12.5px] uppercase tracking-[0.08em] text-ink-faint">
          Last updated {content.updated}
        </p>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink">{content.intro}</p>

        {content.sections.map((s) => (
          <section key={s.heading} className="mt-7">
            <h2 className="font-display text-[17px] font-bold text-ink">{s.heading}</h2>
            <ul className="mt-2 space-y-2">
              {s.body.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 text-[13px] text-ink-faint">
          {content.title === 'Privacy Policy' ? (
            <>
              Read the{' '}
              <a href="/legal/terms" className="font-semibold text-violet-ink">
                Terms of Service
              </a>
              .
            </>
          ) : (
            <>
              Read the{' '}
              <a href="/legal/privacy" className="font-semibold text-violet-ink">
                Privacy Policy
              </a>
              .
            </>
          )}
        </p>
      </div>
    </div>
  )
}
