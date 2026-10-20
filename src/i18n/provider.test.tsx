import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from './I18nProvider'
import { useT } from './useT'
import { Tx } from './Tx'
import { CATALOGUES } from './index'
import { setLanguage } from '@/lib/language'

/**
 * Rendered with createRoot directly rather than a testing library: this needs
 * a container, an act() and textContent, and the project carries no component
 * testing dependency for the sake of three tests.
 */
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // Stands in for a Twi catalogue. `getLanguage()` only accepts a code from
  // LANGUAGES, so a made-up one would silently fall back to English and these
  // tests would pass for the wrong reason.
  //
  // The two strings are placeholders for the shape of a translation, not a
  // claim that this is correct Twi — nothing here ships (see i18n/README.md).
  CATALOGUES.tw = {
    'auth.phone.send': '[tw] Send code',
    'auth.legal': '[tw] {terms} / {privacy}',
  }
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  delete CATALOGUES.tw
})

function Label() {
  const { t } = useT()
  return <span>{t('auth.phone.send')}</span>
}

function render(node: React.ReactNode) {
  act(() => root.render(<I18nProvider>{node}</I18nProvider>))
}

describe('I18nProvider', () => {
  it('renders the English string by default', () => {
    render(<Label />)
    expect(container.textContent).toBe('Send code')
  })

  it('renders the chosen language when one was stored', () => {
    localStorage.setItem('tt.language', 'tw')
    render(<Label />)
    expect(container.textContent).toBe('[tw] Send code')
  })

  it('re-renders the interface when the language changes', () => {
    render(<Label />)
    expect(container.textContent).toBe('Send code')
    act(() => setLanguage('tw'))
    expect(container.textContent).toBe('[tw] Send code')
  })

  it('follows a change made outside the component tree', () => {
    // This is the path the account's own preference takes on a new device:
    // the data layer adopts it, and the interface has to notice.
    render(<Label />)
    act(() => setLanguage('tw'))
    expect(container.textContent).toBe('[tw] Send code')
    act(() => setLanguage('en'))
    expect(container.textContent).toBe('Send code')
  })

  it('falls back to English for a key the catalogue lacks', () => {
    localStorage.setItem('tt.language', 'tw')
    function Two() {
      const { t } = useT()
      return <span>{t('auth.phone.label')}</span>
    }
    render(<Two />)
    expect(container.textContent).toBe('Mobile number')
  })
})

describe('Tx', () => {
  it('puts React nodes where the translation puts the placeholders', () => {
    localStorage.setItem('tt.language', 'tw')
    render(<Tx k="auth.legal" slots={{ terms: <b>Terms</b>, privacy: <i>Privacy</i> }} />)
    // The order and the surrounding words come from the catalogue, not the code.
    expect(container.textContent).toBe('[tw] Terms / Privacy')
    expect(container.querySelector('b')?.textContent).toBe('Terms')
  })

  it('leaves a placeholder with no slot as it is, rather than dropping the sentence', () => {
    render(<Tx k="auth.legal" slots={{}} />)
    expect(container.textContent).toContain('{terms}')
  })
})
