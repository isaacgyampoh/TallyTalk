import type { Page } from '@playwright/test'

/**
 * Enter the sample-data demo.
 *
 * Preview mode is the only signed-in state reachable without a backend, so it
 * is what these tests exercise. Anything behind real authentication cannot be
 * covered here, and deliberately is not faked.
 */
export async function enterDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /try the live demo/i }).click()
  await page.waitForURL(/\/contacts/)
}

/** Pretend to be an installed app, which is what shows the onboarding flow. */
export async function asInstalledApp(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', { get: () => true })
    const mm = window.matchMedia.bind(window)
    window.matchMedia = (q: string) =>
      q.includes('standalone')
        ? ({
            matches: true,
            media: q,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          } as MediaQueryList)
        : mm(q)
  })
}
