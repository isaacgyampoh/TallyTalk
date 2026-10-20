import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
)

interface AxeResult {
  violations: {
    id: string
    impact: string
    nodes: { target: string[]; failureSummary?: string }[]
  }[]
}

/**
 * WCAG 2.1 A/AA. This caught a critical unnamed control that review had
 * missed, so it fails the build rather than reporting.
 */
async function scan(page: Page) {
  // Entry animations fade content in from low opacity. Scanning mid-fade
  // reports contrast failures against a transient state, not the design. The
  // app already honours reduced motion by collapsing animations, so use its
  // own path rather than injecting test-only CSS.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(250)
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(
    async () =>
      await (
        window as unknown as { axe: { run: (d: Document, o: unknown) => Promise<AxeResult> } }
      ).axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      }),
  )
}

/** Name the offending elements: a violation you cannot locate is not actionable. */
function report(r: AxeResult) {
  return r.violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map((n) => `      ${n.target.join(' ')}`)
        .join('\n')
      const why = (v.nodes[0]?.failureSummary ?? '').split('\n').filter(Boolean).slice(1).join(' ')
      return `${v.impact} ${v.id} x${v.nodes.length}\n   ${why}\n${where}`
    })
    .join('\n\n')
}

test.describe('accessibility', () => {
  for (const [name, path] of [
    ['landing', '/'],
    ['sign in', '/signin'],
    ['privacy', '/legal/privacy'],
    ['terms', '/legal/terms'],
  ] as const) {
    test(`${name} has no violations`, async ({ page }) => {
      await page.goto(path)
      const r = await scan(page)
      expect(report(r)).toBe('')
    })
  }

  test('every keyboard stop on sign-in is marked focus-visible', async ({ page }) => {
    // Asserting a computed outline is unreliable across engines: WebKit reports
    // width 0 for the focus ring it draws itself. What the app controls is that
    // the element matches :focus-visible, which the stylesheet rule below
    // decorates — so check both halves separately.
    await page.goto('/signin')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let stops = 0
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const state = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body || el === document.documentElement) return 'none'
        return (el as HTMLElement).matches(':focus-visible') ? 'ring' : `bare:${el.tagName}`
      })
      if (state === 'none') continue
      stops++
      expect(state, `tab stop ${i + 1} takes focus without :focus-visible`).toBe('ring')
    }
    // WebKit only tabs through form controls by default, so the count differs
    // by engine; what matters is that tabbing reaches something at all.
    expect(stops, 'nothing on the sign-in screen is keyboard reachable').toBeGreaterThan(0)
  })

  test('the stylesheet draws a real ring for :focus-visible', async ({ page }) => {
    await page.goto('/signin')
    const ring = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue // cross-origin
        }
        for (const rule of Array.from(rules)) {
          const r = rule as CSSStyleRule
          if (!r.selectorText?.includes(':focus-visible')) continue
          const w = r.style.outlineWidth || r.style.outline
          if (w && !/^0(px)?$/.test(w) && !/\bnone\b/.test(r.style.outlineStyle || '')) return w
        }
      }
      return null
    })
    expect(ring, 'no :focus-visible rule with a non-zero outline is shipped').not.toBeNull()
  })
})
