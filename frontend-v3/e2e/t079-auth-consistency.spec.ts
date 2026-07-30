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

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/explore`)
  await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

  const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
  const loginBtn = page.locator('.explore-actions button:has-text("Login")')
  const btn = (await signInBtn.count()) > 0 ? signInBtn : loginBtn

  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
    await page.locator('.login-dialog').waitFor({ state: 'visible' })
    await page.locator('#login-username').fill('alice')
    await page.locator('#login-password').fill('testpass123')
    await page.locator('.login__submit').click()
    await page.waitForURL('**/explore', { timeout: 10000 })
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('T079: Auth consistency — anonymous login button', () => {
  test('BDD-01: Landing anonymous shows primary "Sign in" button', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const signInBtn = page.locator('.nav-cta button:has-text("Sign in")')
    await expect(signInBtn).toBeVisible()
    await expect(signInBtn).toHaveClass(/btn-primary/)
  })

  test('BDD-02: Explore anonymous desktop shows secondary "Sign in" button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })

    const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
    await expect(signInBtn).toBeVisible()
    await expect(signInBtn).toHaveClass(/btn-secondary/)
  })

  test('BDD-03: Explore anonymous tablet shows secondary "Sign in" button', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })

    const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
    await expect(signInBtn).toBeVisible()
    await expect(signInBtn).toHaveClass(/btn-secondary/)
  })

  test('BDD-04: Explore anonymous mobile shows ghost "Sign in" button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })

    const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
    await expect(signInBtn).toBeVisible()
    await expect(signInBtn).toHaveClass(/btn-ghost/)
  })

  test('BDD-05: Detail anonymous desktop shows secondary "Sign in" button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const browseLink = page.locator('a:has-text("Browse public")')
    await browseLink.click()
    await page.waitForURL('**/explore', { timeout: 10000 })

    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    if (await firstEntry.isVisible().catch(() => false)) {
      const href = await firstEntry.getAttribute('href')
      if (href) {
        await page.goto(`${BASE_URL}${href}`)
        await page.waitForSelector('.detail-header', { timeout: 10000 })

        const signInBtn = page.locator('.detail-header button:has-text("Sign in")')
        await expect(signInBtn).toBeVisible()
        await expect(signInBtn).toHaveClass(/btn-secondary/)
      }
    }
  })

  test('BDD-06: Detail anonymous mobile shows ghost "Sign in" button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const browseLink = page.locator('a:has-text("Browse public")')
    await browseLink.click()
    await page.waitForURL('**/explore', { timeout: 10000 })

    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    if (await firstEntry.isVisible().catch(() => false)) {
      const href = await firstEntry.getAttribute('href')
      if (href) {
        await page.goto(`${BASE_URL}${href}`)
        await page.waitForSelector('.mobile-sticky-header', { timeout: 10000 })

        const signInBtn = page.locator('.mobile-sticky-header button:has-text("Sign in")')
        await expect(signInBtn).toBeVisible()
        await expect(signInBtn).toHaveClass(/btn-ghost/)
      }
    }
  })
})

test.describe('T079: Auth consistency — authenticated user menu', () => {
  test('BDD-08: Explore authenticated shows Settings + Logout menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })

    const trigger = page.locator('.explore-actions .user-menu-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()

    const dropdown = page.locator('.explore-actions .user-dropdown')
    await expect(dropdown).toBeVisible()

    const settings = page.locator('.explore-actions .dropdown-item:has-text("Settings")')
    const logout = page.locator('.explore-actions .dropdown-item:has-text("Logout")')
    await expect(settings).toBeVisible()
    await expect(logout).toBeVisible()
  })

  test('BDD-09: Detail desktop authenticated shows user menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.entry-card a, .entry-list-row a', { timeout: 10000 })
    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    const href = await firstEntry.getAttribute('href')
    if (!href) return

    await page.goto(`${BASE_URL}${href}`)
    await page.waitForSelector('.detail-header', { timeout: 10000 })

    const trigger = page.locator('.detail-header .user-menu-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()

    const settings = page.locator('.detail-header .dropdown-item:has-text("Settings")')
    const logout = page.locator('.detail-header .dropdown-item:has-text("Logout")')
    await expect(settings).toBeVisible()
    await expect(logout).toBeVisible()
  })

  test('BDD-10: Detail mobile authenticated shows user menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.entry-card a, .entry-list-row a', { timeout: 10000 })
    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    const href = await firstEntry.getAttribute('href')
    if (!href) return

    await page.goto(`${BASE_URL}${href}`)
    await page.waitForSelector('.mobile-sticky-header', { timeout: 10000 })

    const trigger = page.locator('.mobile-sticky-header .user-menu-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()

    const settings = page.locator('.mobile-sticky-header .dropdown-item:has-text("Settings")')
    const logout = page.locator('.mobile-sticky-header .dropdown-item:has-text("Logout")')
    await expect(settings).toBeVisible()
    await expect(logout).toBeVisible()
  })

  test('BDD-11: admin user shows admin badge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/explore`)
    await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
    const loginBtn = page.locator('.explore-actions button:has-text("Login")')
    const btn = (await signInBtn.count()) > 0 ? signInBtn : loginBtn

    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await page.locator('.login-dialog').waitFor({ state: 'visible' })
      await page.locator('#login-username').fill('admin1')
      await page.locator('#login-password').fill('testpass123')
      await page.locator('.login__submit').click()
      await page.waitForURL('**/explore', { timeout: 10000 })
    }

    const trigger = page.locator('.explore-actions .user-menu-trigger')
    const badge = trigger.locator('.admin-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('admin')
  })

  test('BDD-12: menu items consistent across pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)

    const expectedItems = ['Settings', 'Logout']

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })
    await page.locator('.explore-actions .user-menu-trigger').click()
    const exploreItems = await page.locator('.explore-actions .dropdown-item').allTextContents()
    expect(exploreItems).toEqual(expectedItems)

    await page.goto(`${BASE_URL}/`)
    await page.waitForTimeout(2000)
    if (await page.locator('.nav-cta .user-menu-trigger').isVisible().catch(() => false)) {
      await page.locator('.nav-cta .user-menu-trigger').click()
      const landingItems = await page.locator('.nav-cta .dropdown-item').allTextContents()
      expect(landingItems).toEqual(expectedItems)
    }
  })

  test('BDD-17: clicking Settings navigates to settings page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })
    await page.locator('.explore-actions .user-menu-trigger').click()

    await page.locator('.explore-actions .dropdown-item:has-text("Settings")').click()
    await page.waitForURL('**/settings**', { timeout: 10000 })
    expect(page.url()).toContain('/settings')
  })
})

test.describe('T079: Detail page — Explore button removal', () => {
  test('BDD-13: Detail desktop has no Explore button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('.nav-cta', { timeout: 10000 })

    const browseLink = page.locator('a:has-text("Browse public")')
    await browseLink.click()
    await page.waitForURL('**/explore', { timeout: 10000 })

    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    if (await firstEntry.isVisible().catch(() => false)) {
      const href = await firstEntry.getAttribute('href')
      if (href) {
        await page.goto(`${BASE_URL}${href}`)
        await page.waitForSelector('.detail-header', { timeout: 10000 })

        const exploreLink = page.locator('.detail-header a[title="Explore"]')
        await expect(exploreLink).toHaveCount(0)

        const exploreText = page.locator('.detail-header .actions-area').getByText('Explore')
        await expect(exploreText).toHaveCount(0)
      }
    }
  })
})

test.describe('T079: Detail page — tag clickable', () => {
  test('BDD-14: Detail desktop tag clicks navigate to /explore?tags=<tag>', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.entry-card a, .entry-list-row a', { timeout: 10000 })

    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    if (await firstEntry.isVisible().catch(() => false)) {
      const href = await firstEntry.getAttribute('href')
      if (href) {
        await page.goto(`${BASE_URL}${href}`)
        await page.waitForSelector('.meta-row', { timeout: 10000 })

        const tag = page.locator('.meta-row .base-tag').first()
        if (await tag.isVisible().catch(() => false)) {
          const tagText = await tag.textContent()
          await tag.click()
          await page.waitForURL('**/explore**', { timeout: 10000 })
          expect(page.url()).toContain('tags=')
        }
      }
    }
  })

  test('BDD-15: Detail mobile tag clicks navigate to /explore?tags=<tag>', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.entry-card a, .entry-list-row a', { timeout: 10000 })

    const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
    if (await firstEntry.isVisible().catch(() => false)) {
      const href = await firstEntry.getAttribute('href')
      if (href) {
        await page.goto(`${BASE_URL}${href}`)
        await page.waitForSelector('.meta-tags-bar', { timeout: 10000 })

        const tag = page.locator('.meta-tags-bar .base-tag').first()
        if (await tag.isVisible().catch(() => false)) {
          await tag.click()
          await page.waitForURL('**/explore**', { timeout: 10000 })
          expect(page.url()).toContain('tags=')
        }
      }
    }
  })
})
