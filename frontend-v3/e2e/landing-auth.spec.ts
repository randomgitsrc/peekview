import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.beforeAll(async ({ request }) => {
  if (BASE_URL.includes(':8080') || BASE_URL.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${BASE_URL})`)
  }
  const resp = await request.get('/health')
  if (!resp.ok()) throw new Error(`Health check failed: ${resp.status()}`)
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test.describe('T065: Landing page auth state bugs', () => {

  test('BDD-1: authenticated user full-page load / → redirected to /explore', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore`)
    await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    const loginBtn = page.locator('.explore-actions button:has-text("Login")')
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.locator('.login-dialog').waitFor({ state: 'visible' })
      await page.locator('#login-username').fill('alice')
      await page.locator('#login-password').fill('testpass123')
      await page.locator('.login__submit').click()
      await page.waitForURL('**/explore', { timeout: 10000 })
    }

    await page.goto(`${BASE_URL}/`)
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/explore/)
  })

  test('BDD-2: anonymous user sees Sign in button on landing', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const signInBtn = page.locator('.nav-cta button:has-text("Sign in")')
    await expect(signInBtn).toBeVisible()
  })

  test('BDD-3: authenticated user does NOT see Sign in on landing', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore`)
    await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    const loginBtn = page.locator('.explore-actions button:has-text("Login")')
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.locator('.login-dialog').waitFor({ state: 'visible' })
      await page.locator('#login-username').fill('alice')
      await page.locator('#login-password').fill('testpass123')
      await page.locator('.login__submit').click()
      await page.waitForURL('**/explore', { timeout: 10000 })
    }

    await page.goto(`${BASE_URL}/`)
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/explore/)

    await page.goBack()
    await page.waitForTimeout(2000)

    const signInBtn = page.locator('.nav-cta button:has-text("Sign in")')
    await expect(signInBtn).not.toBeVisible()
  })

  test('BDD-5: anonymous user login from landing → redirects to /explore', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const signInBtn = page.locator('.nav-cta button:has-text("Sign in")')
    await signInBtn.click()

    await page.locator('.login-dialog').waitFor({ state: 'visible' })
    await page.locator('#login-username').fill('alice')
    await page.locator('#login-password').fill('testpass123')
    await page.locator('.login__submit').click()

    await page.waitForURL('**/explore', { timeout: 10000 })
    await expect(page).toHaveURL(/\/explore/)
  })

  test('BDD-4: authenticated user sees username on landing nav', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore`)
    await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    const loginBtn = page.locator('.explore-actions button:has-text("Login")')
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.locator('.login-dialog').waitFor({ state: 'visible' })
      await page.locator('#login-username').fill('alice')
      await page.locator('#login-password').fill('testpass123')
      await page.locator('.login__submit').click()
      await page.waitForURL('**/explore', { timeout: 10000 })
    }

    await page.goto(`${BASE_URL}/`)
    await page.waitForTimeout(2000)

    await expect(page).toHaveURL(/\/explore/)

    await page.goBack()
    await page.waitForTimeout(2000)

    const userMenuTrigger = page.locator('.user-menu-trigger')
    await expect(userMenuTrigger).toBeVisible()
    await expect(page.locator('.user-name')).toContainText('alice')
  })
})
