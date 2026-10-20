import { expect, test } from '@playwright/test'

/**
 * There is no demo any more. Without a session the app is a marketing page,
 * a sign-in screen and the legal pages — so that is what these cover.
 *
 * Everything behind authentication is deliberately untested here rather than
 * faked: it needs a working backend, which is PB-036 / PB-007 / PB-008.
 */

test.describe('the marketing page', () => {
  test('loads and explains the product', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Keep everyone')).toBeVisible()
  })

  test('shows the current app, not a retired one', async ({ page }) => {
    await page.goto('/')
    const src = await page.locator('img').first().getAttribute('src')
    expect(src).toMatch(/shot-(contacts|space)/)
  })

  test('offers no way into fabricated data', async ({ page }) => {
    // The demo was removed deliberately; a route back into it would undo that.
    await page.goto('/')
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/sample data|live demo/i)
  })
})

test.describe('without a session', () => {
  for (const path of ['/contacts', '/personal', '/groups', '/profile', '/contacts/felicia']) {
    test(`${path} does not show app content`, async ({ page }) => {
      await page.goto(path)
      // Signed out, every in-app route falls back to the public entry point.
      const body = await page.locator('body').innerText()
      expect(body).not.toMatch(/I Owe|Owes Me/)
    })
  }

  test('no fabricated person appears anywhere', async ({ page }) => {
    for (const path of ['/', '/signin', '/contacts']) {
      await page.goto(path)
      const body = await page.locator('body').innerText()
      expect(body, `${path} still shows invented data`).not.toMatch(
        /Felicia Hammond|Ben Owusu|Ama Serwaa|Kwame Mensah/,
      )
    }
  })
})
