import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { enterDemo } from './helpers'

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

  for (const [name, path] of [
    ['contacts', '/contacts'],
    ['personal', '/personal'],
    ['groups', '/groups'],
    ['profile', '/profile'],
    ['task space', '/contacts/felicia'],
  ] as const) {
    test(`${name} has no violations`, async ({ page }) => {
      await enterDemo(page)
      await page.goto(path)
      const r = await scan(page)
      expect(report(r)).toBe('')
    })
  }

  test('the task space is navigable by keyboard, with focus always visible', async ({ page }) => {
    await enterDemo(page)
    await page.goto('/contacts/felicia')
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const ok = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return true
        const cs = getComputedStyle(el)
        return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
      })
      expect(ok, `tab stop ${i + 1} has no visible focus ring`).toBe(true)
    }
  })
})
