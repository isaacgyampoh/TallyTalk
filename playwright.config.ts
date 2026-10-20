import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a real production build, not the dev server —
 * the defects worth catching (a stale asset, a screen that only breaks when
 * code-split, a route that 404s) do not appear under `vite dev`.
 *
 * E2E_BASE_URL points the same suite at a deployed site instead, which is how
 * production is smoke-tested after a release:
 *
 *   E2E_BASE_URL=https://tally-talk-iota.vercel.app npm run e2e
 *
 * Nothing is built or served locally in that mode — the tests are read-only
 * against whatever is deployed there.
 */
const DEPLOYED = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  // Each spec drives a full journey; parallel workers make the ordering of
  // failures hard to read for little gain at this size.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: DEPLOYED ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    // WhatsApp-adjacent products live on iOS too, and WebKit is where the
    // safe-area and 100%-height assumptions actually break.
    { name: 'ios', use: { ...devices['iPhone 13'] } },
  ],

  // Against a deployed site there is nothing to start.
  webServer: DEPLOYED
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
