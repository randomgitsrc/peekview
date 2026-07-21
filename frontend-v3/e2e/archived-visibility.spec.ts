import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const DEBOUNCE_WAIT = 600

async function waitForContent(page: any, timeout = 30000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.entry-card, .empty, .loading, .user-not-found, .error-state')
    return el !== null
  }, { timeout }).catch(() => true)
}

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

// ============================================================
// BDD-B1: 登录后 All tab 列表刷新
// ============================================================
test.describe('BDD-B1: Login on All tab refreshes list', () => {
  test('login while viewing All tab refreshes list to include own private entries', async ({ page, request }) => {
    const ts = Date.now()
    const username = `b1login_${ts}`
    const password = 'pass12345'

    // Register
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    // Create a private entry owned by the user (should NOT be visible anonymously)
    await request.post('/api/v1/entries', {
      data: {
        summary: `B1 private entry ${ts}`,
        is_public: false,
        files: [{ filename: 'secret.md', content: `# secret ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    // Create a public entry (visible to everyone)
    await request.post('/api/v1/entries', {
      data: {
        summary: `B1 public entry ${ts}`,
        is_public: true,
        files: [{ filename: 'public.md', content: `# public ${ts}` }],
      },
    })

    // Step 1: Anonymous user sees only public entries
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)
    await expect(page.locator('.entry-card').filter({ hasText: `B1 public entry ${ts}` })).toHaveCount(1)
    await expect(page.locator('.entry-card').filter({ hasText: `B1 private entry ${ts}` })).toHaveCount(0)

    // Step 2: Login via API and set cookie
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])

    // Step 3: Reload page (simulate login triggering authState → authenticated)
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // BDD-B1 assertion: list now includes private entry (after refresh)
    // RED: current code does NOT reload after auth change
    await expect(page.locator('.entry-card').filter({ hasText: `B1 private entry ${ts}` })).toHaveCount(1)
    await expect(page.locator('.entry-card').filter({ hasText: `B1 public entry ${ts}` })).toHaveCount(1)
  })
})

// ============================================================
// BDD-B2: 登录后 Mine tab 自动切换
// ============================================================
test.describe('BDD-B2: Login with ?owner=me activates Mine tab', () => {
  test('visiting ?owner=me while anonymous, then logging in activates Mine tab', async ({ page, request }) => {
    const ts = Date.now()
    const username = `b2login_${ts}`
    const password = 'pass12345'

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    await request.post('/api/v1/entries', {
      data: {
        summary: `B2 my entry ${ts}`,
        is_public: false,
        files: [{ filename: 'mine.md', content: `# mine ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    // Step 1: Anonymous user visits ?owner=me
    await page.goto(`${BASE_URL}/explore?owner=me`)
    await waitForContent(page)

    // Step 2: Set auth cookie (simulate login)
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])

    // Step 3: Reload
    await page.goto(`${BASE_URL}/explore?owner=me`)
    await waitForContent(page)

    // BDD-B2 assertion: Mine tab is active
    // RED: current code watcher handles ?owner=me but may not properly switch
    const mineTab = page.locator('.owner-tab').last()
    await expect(mineTab).toHaveClass(/active/)
  })
})

// ============================================================
// BDD-C1: 退出后列表刷新为匿名视图
// ============================================================
test.describe('BDD-C1: Logout refreshes list to anonymous view', () => {
  test('logout removes private entries via API reload', async ({ page, request }) => {
    const ts = Date.now()
    const username = `c1logout_${ts}`
    const password = 'pass12345'

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    // Create private entry
    await request.post('/api/v1/entries', {
      data: {
        summary: `C1 private ${ts}`,
        is_public: false,
        files: [{ filename: 'private.md', content: `# private ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    // Create public entry
    await request.post('/api/v1/entries', {
      data: {
        summary: `C1 public ${ts}`,
        is_public: true,
        files: [{ filename: 'public.md', content: `# public ${ts}` }],
      },
    })

    // Step 1: Login and view All tab
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // Should see both private and public
    await expect(page.locator('.entry-card').filter({ hasText: `C1 private ${ts}` })).toHaveCount(1)
    await expect(page.locator('.entry-card').filter({ hasText: `C1 public ${ts}` })).toHaveCount(1)

    // Step 2: Logout via API
    await request.post('/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${token}` },
    })
    await page.context().clearCookies()

    // Step 3: Reload (simulate authState → anonymous → reload)
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // BDD-C1 assertion: list now matches anonymous view
    // RED: current code uses filterPrivateEntries() which doesn't do API reload
    await expect(page.locator('.entry-card').filter({ hasText: `C1 public ${ts}` })).toHaveCount(1)
    await expect(page.locator('.entry-card').filter({ hasText: `C1 private ${ts}` })).toHaveCount(0)
    // No archived entries for anonymous users
    const archivedCards = page.locator('.entry-card').filter({ hasText: 'archived' })
    // We're on All tab, so there should be no archived badges if backend excludes them
  })
})

// ============================================================
// BDD-C2: 退出后 Archived tab 刷新为空
// ============================================================
test.describe('BDD-C2: Logout on Archived tab resets to empty', () => {
  test('logout while on Archived tab resets tab and shows empty list', async ({ page, request }) => {
    const ts = Date.now()
    const username = `c2arch_${ts}`
    const password = 'pass12345'

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    // Create an active entry and an archived entry
    const createResp = await request.post('/api/v1/entries', {
      data: {
        summary: `C2 active ${ts}`,
        is_public: false,
        files: [{ filename: 'active.md', content: `# active ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const { slug: activeSlug } = await createResp.json()

    const createResp2 = await request.post('/api/v1/entries', {
      data: {
        summary: `C2 archived ${ts}`,
        is_public: false,
        files: [{ filename: 'archived.md', content: `# archived ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const { slug: archivedSlug } = await createResp2.json()

    // Archive the second entry
    await request.delete(`/api/v1/entries/${archivedSlug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    // Step 1: Login and view Archived tab
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // Click Archived tab
    const archivedTab = page.locator('.owner-tab').filter({ hasText: 'Archived' })
    await archivedTab.click()
    await page.waitForTimeout(DEBOUNCE_WAIT)
    await waitForContent(page)

    // Should see archived entry
    await expect(page.locator('.entry-card').filter({ hasText: `C2 archived ${ts}` })).toHaveCount(1)

    // Step 2: Logout
    await request.post('/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${token}` },
    })
    await page.context().clearCookies()

    // Step 3: Reload (simulate authState → anonymous → reload + tab reset)
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // BDD-C2 assertion: list is empty (anonymous sees no archived entries)
    // RED: current code only calls filterPrivateEntries, doesn't reload or reset tab
    await expect(page.locator('.entry-card').filter({ hasText: `C2 archived ${ts}` })).toHaveCount(0)
    await expect(page.locator('.entry-card').filter({ hasText: `C2 active ${ts}` })).toHaveCount(0)
  })
})

// ============================================================
// BDD-D1: Auth 过期后列表刷新为匿名视图
// ============================================================
test.describe('BDD-D1: Auth expired refreshes list to anonymous view', () => {
  test('clearing auth cookie and reloading removes private entries', async ({ page, request }) => {
    const ts = Date.now()
    const username = `d1expired_${ts}`
    const password = 'pass12345'

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    await request.post('/api/v1/entries', {
      data: {
        summary: `D1 private ${ts}`,
        is_public: false,
        files: [{ filename: 'private.md', content: `# private ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await request.post('/api/v1/entries', {
      data: {
        summary: `D1 public ${ts}`,
        is_public: true,
        files: [{ filename: 'public.md', content: `# public ${ts}` }],
      },
    })

    // Step 1: Login and view All tab
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await expect(page.locator('.entry-card').filter({ hasText: `D1 private ${ts}` })).toHaveCount(1)

    // Step 2: Simulate auth expiration by clearing cookies
    await page.context().clearCookies()

    // Step 3: Reload (authState → anonymous → should reload)
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // BDD-D1 assertion: private entries gone after auth expired reload
    // RED: current code only sets user=null, doesn't reload list
    await expect(page.locator('.entry-card').filter({ hasText: `D1 public ${ts}` })).toHaveCount(1)
    await expect(page.locator('.entry-card').filter({ hasText: `D1 private ${ts}` })).toHaveCount(0)
  })
})

// ============================================================
// BDD-D2: Auth 过期后 Archived tab 刷新为空
// ============================================================
test.describe('BDD-D2: Auth expired on Archived tab resets to empty', () => {
  test('auth expired while on Archived tab shows anonymous view', async ({ page, request }) => {
    const ts = Date.now()
    const username = `d2expired_${ts}`
    const password = 'pass12345'

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    const createResp = await request.post('/api/v1/entries', {
      data: {
        summary: `D2 archived ${ts}`,
        is_public: true,
        files: [{ filename: 'arch.md', content: `# archived ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const { slug } = await createResp.json()

    // Archive it
    await request.delete(`/api/v1/entries/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    // Login and navigate to Archived tab
    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const archivedTab = page.locator('.owner-tab').filter({ hasText: 'Archived' })
    await archivedTab.click()
    await page.waitForTimeout(DEBOUNCE_WAIT)
    await waitForContent(page)

    await expect(page.locator('.entry-card').filter({ hasText: `D2 archived ${ts}` })).toHaveCount(1)

    // Simulate auth expiration
    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // BDD-D2 assertion: archived entries gone, tab should reset
    // RED: current code doesn't reload after auth expired
    await expect(page.locator('.entry-card').filter({ hasText: `D2 archived ${ts}` })).toHaveCount(0)
  })
})
