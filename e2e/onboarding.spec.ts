import { expect, test } from '@playwright/test'
import { asInstalledApp } from './helpers'

test.describe('registration', () => {
  test('a first run asks for a language before anything else', async ({ page }) => {
    await asInstalledApp(page)
    await page.goto('/')
    await expect(page.getByText('Choose your language')).toBeVisible()
    await expect(page.getByText('Twi')).toBeVisible()
    await expect(page.getByText('Gã')).toBeVisible()
  })

  test('choosing a language records it and moves on', async ({ page }) => {
    await asInstalledApp(page)
    await page.goto('/')
    await page.getByText('Twi').first().click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Choose your language')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('tt.language'))).toBe('tw')
  })

  test('the number is confirmed before any code is sent', async ({ page }) => {
    // Sending first meant a mistyped digit cost an SMS and a wait.
    await page.goto('/signin')
    await page.locator('input[inputmode="tel"]').first().fill('241234567')
    await page.getByRole('button', { name: /send code/i }).click()
    await expect(page.getByText('You entered the phone number')).toBeVisible()
    await expect(page.getByText('+233241234567')).toBeVisible()
  })

  test('Edit returns to the form without sending', async ({ page }) => {
    await page.goto('/signin')
    await page.locator('input[inputmode="tel"]').first().fill('241234567')
    await page.getByRole('button', { name: /send code/i }).click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByText('You entered the phone number')).toHaveCount(0)
    await expect(page.locator('input[inputmode="tel"]').first()).toBeVisible()
  })

  test('the country picker uses codes, not flag emoji', async ({ page }) => {
    await page.goto('/signin')
    // Options inside a <select> are never "visible" to Playwright, so assert
    // on their text rather than their visibility.
    const options = await page.locator('select option').allTextContents()
    expect(options.join(' ')).toContain('GH +233')
    expect(options.join(' ')).not.toMatch(/\p{Regional_Indicator}/u)

    const body = await page.locator('body').innerText()
    expect(body, 'no flag emoji anywhere on the page').not.toMatch(/\p{Regional_Indicator}/u)
  })
})

test.describe('legal pages', () => {
  // A store reviewer has no account; these must open cold.
  for (const doc of ['privacy', 'terms']) {
    test(`${doc} opens without signing in`, async ({ page }) => {
      await page.goto(`/legal/${doc}`)
      await expect(page.getByText('Last updated')).toBeVisible()
      const text = await page.locator('body').innerText()
      expect(text.length).toBeGreaterThan(800)
    })
  }

  test('the privacy policy names the real third parties', async ({ page }) => {
    await page.goto('/legal/privacy')
    await expect(page.getByText('Arkesel')).toBeVisible()
    await expect(page.getByText(/We do not read your phone/)).toBeVisible()
  })

  test('sign-in links to them', async ({ page }) => {
    await page.goto('/signin')
    await page.getByRole('button', { name: 'Privacy Policy' }).click()
    await expect(page.getByText('Last updated')).toBeVisible()
  })
})

test.describe('losing the network', () => {
  test('says so, and clears when it returns', async ({ page, context }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /try the live demo/i }).click()
    await page.waitForURL(/\/contacts/)
    await context.setOffline(true)
    await expect(page.getByText('No connection')).toBeVisible()
    await context.setOffline(false)
    await expect(page.getByText('No connection')).toHaveCount(0)
  })
})
