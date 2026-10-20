import type { Page } from '@playwright/test'

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
