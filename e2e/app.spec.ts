import { expect, test } from '@playwright/test'
import { enterDemo } from './helpers'

test.describe('the demo a visitor actually sees', () => {
  test('the marketing page loads and offers the demo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Keep everyone')).toBeVisible()
    await expect(page.getByRole('button', { name: /try the live demo/i })).toBeVisible()
  })

  test('the marketing hero shows the current app, not a retired one', async ({ page }) => {
    // The hero screenshots went stale once Today was removed, and nothing
    // caught it. The nav in the shot must match the nav that ships.
    await page.goto('/')
    const src = await page.locator('img').first().getAttribute('src')
    expect(src).toMatch(/shot-(contacts|space)/)
    expect(src).not.toMatch(/shot-today|shot-chat/)
  })

  test('every tab reaches its screen', async ({ page }) => {
    await enterDemo(page)
    for (const [label, path] of [
      ['Personal', 'personal'],
      ['Contacts', 'contacts'],
      ['Groups', 'groups'],
      ['Profile', 'profile'],
    ]) {
      await page.getByText(label, { exact: true }).first().click()
      await expect(page).toHaveURL(new RegExp(`/${path}$`))
    }
  })

  test('Today is gone from the navigation', async ({ page }) => {
    await enterDemo(page)
    await expect(page.locator('nav').getByText('Today')).toHaveCount(0)
  })

  test('a deep link survives a cold load and a reload', async ({ page }) => {
    // This broke in production once: the demo session was dropped on any
    // full page load, bouncing a deep link back to the landing page.
    await enterDemo(page)
    await page.goto('/contacts/felicia')
    await expect(page.getByText('I Owe Felicia')).toBeVisible()
    await page.reload()
    await expect(page.getByText('I Owe Felicia')).toBeVisible()
  })
})

test.describe('the task space', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemo(page)
    await page.goto('/contacts/felicia')
  })

  test('shows both sides of the ledger', async ({ page }) => {
    await expect(page.getByText('I Owe Felicia')).toBeVisible()
    await expect(page.getByText('Felicia Owes Me')).toBeVisible()
  })

  test('the composer adds a task and says so only once it has', async ({ page }) => {
    await page.locator('input').first().fill('Bring the generator key')
    await page.getByRole('button', { name: /send task/i }).click()
    await expect(page.getByText('Bring the generator key')).toBeVisible()
    await expect(page.getByText(/Sent to Felicia/)).toBeVisible()
  })

  test('a task row toggles done', async ({ page }) => {
    await page.getByRole('button', { name: /^Mark "Meet with Ecobank" done$/ }).click()
    await expect(
      page.getByRole('button', { name: /^Mark "Meet with Ecobank" not done$/ }),
    ).toBeVisible()
  })

  test('a task opens its comments', async ({ page }) => {
    await page.getByText('The files').first().click()
    await expect(page.getByText('Urgent!')).toBeVisible()
    await expect(page.getByText('How do I proceed with this?')).toBeVisible()
  })

  test('a comment posts', async ({ page }) => {
    await page.getByText('The files').first().click()
    await page.locator('input').last().fill('Understood, on it')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Understood, on it')).toBeVisible()
  })
})

test.describe('checklists', () => {
  test('the predefined lists are there and open', async ({ page }) => {
    await enterDemo(page)
    await page.getByText('Personal', { exact: true }).first().click()
    // "Daily" also appears inside the "resets daily" badge, so match the row.
    await expect(page.getByRole('button', { name: /^D Daily/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Travel Checklist/ })).toBeVisible()
    await page.getByRole('button', { name: /^B Buy/ }).click()
    await expect(page.getByText('Rice — 5kg')).toBeVisible()
  })

  test('an item can be added', async ({ page }) => {
    await enterDemo(page)
    await page.goto('/personal/buy')
    const input = page.locator('input').last()
    await input.fill('Palm oil')
    await input.press('Enter')
    await expect(page.getByText('Palm oil')).toBeVisible()
  })
})
