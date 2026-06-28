import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

async function waitForPageReady(page: any, timeout = 30000) {
  await page.waitForFunction(() => {
    const btnLogin = document.querySelector('.btn-login')
    const userMenu = document.querySelector('.user-menu-trigger')
    return btnLogin !== null || userMenu !== null
  }, { timeout })
}

async function setupAuth(page: any, token: string) {
  const url = new URL(BASE_URL)
  await page.context().addCookies([{
    name: 'peekview_token',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }])
  await page.goto(BASE_URL + '/explore')
  await waitForPageReady(page, 30000)
}

test.beforeAll(async ({ request }) => {
  const baseUrl = BASE_URL
  if (baseUrl.includes(':8080') || baseUrl.includes('peek.gsis.top') || baseUrl.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${baseUrl})`)
  }
  try {
    const response = await request.get('/health')
    if (!response.ok()) {
      throw new Error(`Debug server health check failed: ${response.status()}`)
    }
  } catch {
    throw new Error(`FATAL: Cannot connect to debug server at ${baseUrl}. Run 'make debug-start' first.`)
  }
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test.describe('T025 - User Page', () => {
  test('1. /users/:username page loads with banner', async ({ page }) => {
    const ts = Date.now()
    const username = `alice_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Alice public entry',
        is_public: true,
        files: [{ filename: 'readme.md', content: '# Hello' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/users/${username}`)
    await waitForPageReady(page)

    await expect(page.locator('.banner-bar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.banner-title')).toContainText(`@${username}`)
    await expect(page.locator('.banner-back')).toContainText('Back to Home')
    await expect(page.locator('.banner-back')).toHaveAttribute('href', /\/explore/)
    await expect(page.locator('.owner-tabs')).not.toBeVisible()
    await expect(page.locator('.entry-card')).toHaveCount(1, { timeout: 10000 })

    await page.screenshot({ path: '/tmp/e2e-results/t025-01-banner.png', fullPage: true })
  })

  test('2. /users/:username banner shows in authenticated state', async ({ page }) => {
    const ts = Date.now()
    const username = `bob_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const bobToken = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Bob log entry',
        is_public: true,
        files: [{ filename: 'log.txt', content: 'hello' }],
      },
      headers: { Authorization: `Bearer ${bobToken}` },
    })

    const charlieResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `charlie_${ts}`, password: 'pass12345' },
    })
    expect(charlieResp.status()).toBe(201)
    const charlieToken = charlieResp.data.access_token

    await setupAuth(page, charlieToken)
    await page.goto(`${BASE_URL}/users/${username}`)

    await expect(page.locator('.banner-bar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.banner-title')).toContainText(`@${username}`)
    await expect(page.locator('.owner-tabs')).not.toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/t025-02-auth-banner.png', fullPage: true })
  })

  test('3. /explore?owner=alice shows chip, no banner, tabs present but not highlighted', async ({ page }) => {
    const ts = Date.now()
    const username = `eve_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Eve entry',
        is_public: true,
        files: [{ filename: 'data.txt', content: 'test' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await setupAuth(page, token)
    await page.goto(`${BASE_URL}/explore?owner=${username}`)

    await expect(page.locator('.filter-chip')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.filter-chip')).toContainText(`@${username}`)
    await expect(page.locator('.banner-bar')).not.toBeVisible()
    await expect(page.locator('.owner-tabs')).toBeVisible()

    const allTab = page.locator('.owner-tab').first()
    const mineTab = page.locator('.owner-tab').last()
    await expect(allTab).not.toHaveClass(/active/)
    await expect(mineTab).not.toHaveClass(/active/)

    await page.screenshot({ path: '/tmp/e2e-results/t025-03-chip.png', fullPage: true })
  })

  test('4. chip dismiss clears filter and restores full list', async ({ page }) => {
    const ts = Date.now()
    const username = `frank_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Frank entry',
        is_public: true,
        files: [{ filename: 'f.txt', content: 'f' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Another public entry',
        is_public: true,
        files: [{ filename: 'a.txt', content: 'a' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await setupAuth(page, token)
    await page.goto(`${BASE_URL}/explore?owner=${username}`)

    await expect(page.locator('.filter-chip')).toBeVisible({ timeout: 10000 })
    const filteredCount = await page.locator('.entry-card').count()
    expect(filteredCount).toBeGreaterThanOrEqual(1)

    await page.locator('.filter-chip-dismiss').click()
    await page.waitForTimeout(1000)

    await expect(page.locator('.filter-chip')).not.toBeVisible()
    await expect(page).toHaveURL(/\/explore$/)

    const restoredCount = await page.locator('.entry-card').count()
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount)

    await page.screenshot({ path: '/tmp/e2e-results/t025-04-dismiss.png', fullPage: true })
  })

  test('5. card @username click navigates to /users/:username', async ({ page }) => {
    const ts = Date.now()
    const username = `grace_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Grace entry',
        is_public: true,
        files: [{ filename: 'g.txt', content: 'g' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/explore`)
    await waitForPageReady(page)

    await expect(page.locator('.entry-card')).toHaveCount(1, { timeout: 10000 })
    const usernameLink = page.locator('.username-link').first()
    await expect(usernameLink).toBeVisible()

    await usernameLink.click()
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(new RegExp(`/users/${username}$`))
    await expect(page.locator('.banner-bar')).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: '/tmp/e2e-results/t025-05-username-click.png', fullPage: true })
  })

  test('6. authenticated user clicks own @username → /explore?owner=me', async ({ page }) => {
    const ts = Date.now()
    const username = `hank_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'My own entry',
        is_public: false,
        files: [{ filename: 'private.txt', content: 'secret' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await setupAuth(page, token)
    await page.goto(`${BASE_URL}/explore`)

    await expect(page.locator('.entry-card')).toHaveCount(1, { timeout: 10000 })
    const ownUsernameLink = page.locator('.username-link').first()
    await expect(ownUsernameLink).toContainText(username)

    const href = await ownUsernameLink.getAttribute('href')
    expect(href).toMatch(/\/explore\?owner=me/)

    await ownUsernameLink.click()
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(/\/explore\?owner=me/)
    await expect(page.locator('.owner-tab.active')).toContainText('Mine')

    await page.screenshot({ path: '/tmp/e2e-results/t025-06-own-username.png', fullPage: true })
  })

  test('7. tab All/Mine switch syncs URL via replace (no history pollution)', async ({ page }) => {
    const ts = Date.now()
    const username = `ivan_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Ivan entry',
        is_public: true,
        files: [{ filename: 'i.txt', content: 'i' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await setupAuth(page, token)
    await page.goto(`${BASE_URL}/explore`)

    await expect(page.locator('.owner-tab').first()).toHaveClass(/active/)

    const mineTab = page.locator('.owner-tab').last()
    await mineTab.click()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/explore\?owner=me/)
    await expect(mineTab).toHaveClass(/active/)

    const allTab = page.locator('.owner-tab').first()
    await allTab.click()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/explore$/)
    await expect(allTab).toHaveClass(/active/)

    await page.screenshot({ path: '/tmp/e2e-results/t025-07-tab-sync.png', fullPage: true })
  })

  test('8. direct /explore?owner=me access highlights Mine tab', async ({ page }) => {
    const ts = Date.now()
    const username = `julia_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Julia entry',
        is_public: true,
        files: [{ filename: 'j.txt', content: 'j' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await setupAuth(page, token)
    await page.goto(`${BASE_URL}/explore?owner=me`)

    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/, { timeout: 10000 })
    await expect(page.locator('.owner-tab').first()).not.toHaveClass(/active/)

    await page.screenshot({ path: '/tmp/e2e-results/t025-08-direct-mine.png', fullPage: true })
  })

  test('9. /users/nonexistent shows "User not found" without banner', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/users/definitely_does_not_exist_999`)

    await expect(page.locator('.user-not-found')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.user-not-found')).toContainText('User')
    await expect(page.locator('.user-not-found')).toContainText('definitely_does_not_exist_999')
    await expect(page.locator('.banner-bar')).not.toBeVisible()
    await expect(page.locator('.entry-card')).not.toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/t025-09-not-found.png', fullPage: true })
  })

  test('10. card body click navigates to entry detail', async ({ page }) => {
    const ts = Date.now()
    const username = `karl_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    const createResp = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Karl detail entry',
        is_public: true,
        files: [{ filename: 'k.txt', content: 'k' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const entry = await createResp.json()
    const slug = entry.slug

    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/explore`)
    await waitForPageReady(page)

    await expect(page.locator('.entry-card')).toHaveCount(1, { timeout: 10000 })
    await page.locator('.card-body').first().click()
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(new RegExp(`/${slug}$`))

    await page.screenshot({ path: '/tmp/e2e-results/t025-10-card-navigate.png', fullPage: true })
  })

  test('11. mobile banner displays correctly (column layout at ≤480px)', async ({ page }) => {
    const ts = Date.now()
    const username = `lisa_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Lisa entry',
        is_public: true,
        files: [{ filename: 'l.txt', content: 'l' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/users/${username}`)
    await waitForPageReady(page)

    await expect(page.locator('.banner-bar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.banner-title')).toContainText(`@${username}`)
    await expect(page.locator('.banner-back')).toBeVisible()

    const bannerFlexDirection = await page.locator('.banner-bar').evaluate((el) => {
      return window.getComputedStyle(el).flexDirection
    })
    expect(bannerFlexDirection).toBe('column')

    await page.screenshot({ path: '/tmp/e2e-results/t025-11-mobile-banner.png', fullPage: true })
  })

  test('12. card div[role="link"] is keyboard accessible (Tab + Enter)', async ({ page }) => {
    const ts = Date.now()
    const username = `mike_${ts}`

    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const regData = await regResp.json()
    const token = regData.access_token

    const createResp = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Keyboard accessible entry',
        is_public: true,
        files: [{ filename: 'ka.txt', content: 'ka' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const entry = await createResp.json()
    const slug = entry.slug

    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/explore`)
    await waitForPageReady(page)

    await expect(page.locator('.card-body').first()).toHaveAttribute('role', 'link')
    await expect(page.locator('.card-body').first()).toHaveAttribute('tabindex', '0')

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)

    const isFocused = await page.locator('.card-body').first().evaluate((el) => {
      return document.activeElement === el
    })
    expect(isFocused).toBe(true)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    await expect(page).toHaveURL(new RegExp(`/${slug}$`))

    await page.screenshot({ path: '/tmp/e2e-results/t025-12-keyboard.png', fullPage: true })
  })
})
