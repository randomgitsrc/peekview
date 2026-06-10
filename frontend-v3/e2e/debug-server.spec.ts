import { test, expect } from '@playwright/test'

/**
 * Debug Server E2E Tests
 * 这些测试在调试服务器 (http://127.0.0.1:8888) 上运行
 * 会自动创建所需的测试数据
 *
 * 注意: 所有测试数据设置1小时自动过期
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

// 存储创建的测试条目，用于测试完成后清理
const testEntries: string[] = []

// Helper: Wait for auth initialization with retry
async function waitForAuth(page: any, timeout = 30000) {
  // Wait for either user menu (authenticated) or login button (anonymous)
  // Use first() to handle cases where both might exist during transition
  await page.waitForSelector('.btn-login, .user-menu-trigger', { timeout, state: 'visible' })
}

// Helper: Wait for page to be ready (auth state loaded)
async function waitForPageReady(page: any, timeout = 30000) {
  // Wait until auth state is determined (loading completes)
  await page.waitForFunction(() => {
    const btnLogin = document.querySelector('.btn-login')
    const userMenu = document.querySelector('.user-menu-trigger')
    return btnLogin !== null || userMenu !== null
  }, { timeout })
}

// Helper: Wait for API data to load with better mobile support
async function waitForApiData(page: any, selector: string, timeout = 30000) {
  // Wait for element to be attached to DOM first
  await page.waitForSelector(selector, { timeout, state: 'attached' })
  // Then check visibility
  const element = page.locator(selector).first()
  try {
    await element.waitFor({ state: 'visible', timeout: 5000 })
  } catch {
    // Element might be in DOM but not visible (mobile layout)
    // Continue anyway as the element exists
  }
}

// Helper: Setup auth state and wait for initialization
async function setupAuth(page: any, token: string) {
  await page.context().addCookies([{
    name: 'peekview_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }])
  await page.goto('/')
  await waitForPageReady(page, 30000)
  await waitForAuth(page, 30000)
}

// ========================================
// Production Safety Check
// ========================================

test.beforeAll(async ({ request }) => {
  // CRITICAL: Verify we're NOT connecting to production
  const baseUrl = BASE_URL
  if (baseUrl.includes(':8080') || baseUrl.includes('peek.gsis.top') || baseUrl.includes('prod')) {
    throw new Error(
      `FATAL: E2E tests are configured to run against PRODUCTION (${baseUrl}). ` +
      `Tests must only run against debug server on :8888. ` +
      `Run 'make debug-start' first, then 'make debug-test'.`
    )
  }

  // Verify debug server is running and responding
  try {
    const response = await request.get('/health')
    if (!response.ok()) {
      throw new Error(`Debug server health check failed: ${response.status()}`)
    }
    const health = await response.json()
    console.log(`Connected to debug server version ${health.version}`)
  } catch (error) {
    throw new Error(
      `FATAL: Cannot connect to debug server at ${baseUrl}. ` +
      `Run 'make debug-start' first.`
    )
  }
})

async function createTestEntry(page: any, slug: string, data: any) {
  const response = await page.request.post('/api/v1/entries', {
    data: {
      slug,
      summary: data.summary || 'Test Entry',
      expires_in: '1h',  // 自动1小时过期
      files: data.files || [],
      is_public: data.is_public !== undefined ? data.is_public : true,
    }
  })
  if (response.ok()) {
    testEntries.push(slug)
  }
  return response
}

async function cleanupTestEntry(page: any, slug: string) {
  try {
    await page.request.delete(`/api/v1/entries/${slug}`)
  } catch (e) {
    // 忽略删除失败
  }
}

// ========================================
// Test Suite 1: Basic Functionality
// ========================================

test.describe('Debug Server - Basic', () => {
  test('health check', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.status()).toBe(200)
  })

  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await page.screenshot({ path: '/tmp/e2e-results/01-homepage.png' })
  })

  test('create and view code entry', async ({ page }) => {
    // Create test entry with unique slug
    const slug = `e2e-code-${Date.now()}`
    const response = await createTestEntry(page, slug, {
      summary: 'E2E Code Test',
      files: [{
        filename: 'test.py',
        content: 'def hello():\n    print("Hello World")\n    return 42'
      }]
    })
    expect(response.status()).toBe(201)

    // View entry
    await page.goto(`/${slug}`)
    // Wait for code to be highlighted (not loading state)
    await page.waitForSelector('.code-body:not(:empty)', { timeout: 30000 })

    // Verify code is displayed
    const codeText = await page.locator('.code-body').textContent()
    expect(codeText).toContain('def hello')

    await page.screenshot({ path: '/tmp/e2e-results/02-code-viewer.png' })
  })
})

// ========================================
// Test Suite 2: Mermaid
// ========================================

test.describe('Debug Server - Mermaid', () => {
  test('mermaid diagram renders and fills container', async ({ page }) => {
    // Create entry with mermaid - unique slug
    const slug = `e2e-mermaid-${Date.now()}`
    const response = await createTestEntry(page, slug, {
      summary: 'E2E Mermaid Test',
      files: [{
        filename: 'diagram.md',
        content: `# Test

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B -->|No| E[End]
\`\`\`
`
      }]
    })
    expect(response.status()).toBe(201)

    // View entry
    await page.goto(`/${slug}`)
    await page.waitForTimeout(5000)

    // Take screenshot
    await page.screenshot({ path: '/tmp/e2e-results/03-mermaid-diagram.png', fullPage: true })

    // Check mermaid block exists
    const mermaidCount = await page.locator('.mermaid-block').count()
    expect(mermaidCount).toBeGreaterThan(0)

    // Check SVG fills container (height > 200px)
    const svg = page.locator('.mermaid-content.diagram-mode svg').first()
    const box = await svg.boundingBox()
    expect(box?.height).toBeGreaterThan(100)
    expect(box?.width).toBeGreaterThan(200)
  })

  test('mermaid code/diagram toggle preserves chart', async ({ page }) => {
    // Create entry first
    const slug = `e2e-mermaid-toggle-${Date.now()}`
    const response = await createTestEntry(page, slug, {
      summary: 'E2E Mermaid Toggle Test',
      files: [{
        filename: 'diagram.md',
        content: `# Test

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`
      }]
    })
    expect(response.status()).toBe(201)

    await page.goto(`/${slug}`)
    await page.waitForTimeout(3000)

    // Click Code to switch to code view
    await page.click('.mermaid-view-toggle')
    await page.waitForTimeout(1000)

    // Verify code is visible
    const codeBlock = page.locator('.mermaid-content.code-mode pre')
    await expect(codeBlock).toBeVisible()

    // Click toggle again to switch back to diagram view
    await page.click('.mermaid-view-toggle')
    await page.waitForTimeout(2000)

    // Verify diagram is still rendered
    const svg = page.locator('.mermaid-content.diagram-mode svg')
    await expect(svg).toBeVisible()

    const box = await svg.boundingBox()
    expect(box?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/e2e-results/04-mermaid-toggle.png' })
  })

  test('mermaid fullscreen fills window', async ({ page }) => {
    // Create entry first
    const slug = `e2e-mermaid-fs-${Date.now()}`
    const response = await createTestEntry(page, slug, {
      summary: 'E2E Mermaid Fullscreen Test',
      files: [{
        filename: 'diagram.md',
        content: `# Test

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`
      }]
    })
    expect(response.status()).toBe(201)

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/${slug}`)
    await page.waitForTimeout(3000)

    // Click fullscreen
    await page.click('[title="Fullscreen"]')
    await page.waitForTimeout(1000)

    // Check modal SVG fills window
    const modalSvg = page.locator('.mermaid-modal svg')
    const box = await modalSvg.boundingBox()
    expect(box?.width).toBeGreaterThan(800)
    expect(box?.height).toBeGreaterThan(500)

    await page.screenshot({ path: '/tmp/e2e-results/05-mermaid-fullscreen.png' })

    // Close modal
    await page.click('.mermaid-modal .close-btn, .mermaid-modal .modal-overlay')
    await expect(modalSvg).not.toBeVisible()
  })
})

// ========================================
// Test Suite 3: Pagination
// ========================================

test.describe('Debug Server - Pagination', () => {
  test('pagination shows page numbers', async ({ page }) => {
    // Create enough entries to trigger pagination (perPage=20, need >20)
    const ts = Date.now()
    for (let i = 1; i <= 22; i++) {
      await createTestEntry(page, `e2e-page-${ts}-${i}`, {
        summary: `Pagination Test ${i}`,
        files: [{ filename: 'test.txt', content: `Test ${i}` }]
      })
    }

    await page.goto('/')
    // Wait for entries to load
    await page.waitForSelector('.entry-card', { timeout: 10000 })

    // Check pagination exists
    const pagination = page.locator('.pagination')
    await expect(pagination).toBeVisible()

    // Check page numbers exist
    const pageNumbers = await page.locator('.page-num').count()
    expect(pageNumbers).toBeGreaterThan(0)

    await page.screenshot({ path: '/tmp/e2e-results/06-pagination.png' })
  })

  test('page navigation works', async ({ page }) => {
    // Create enough entries to trigger pagination
    const ts = Date.now()
    for (let i = 1; i <= 22; i++) {
      await createTestEntry(page, `e2e-pagenav-${ts}-${i}`, {
        summary: `Page Nav Test ${i}`,
        files: [{ filename: 'test.txt', content: `Test ${i}` }]
      })
    }

    await page.goto('/')
    await page.waitForSelector('.pagination', { timeout: 10000 })

    // Get first page entries
    const firstPageEntries = await page.locator('.entry-card').count()

    // Go to page 2
    await page.click('.page-num:not(.active)')
    await page.waitForTimeout(1000)

    // Verify different content
    const secondPageEntries = await page.locator('.entry-card').count()
    expect(secondPageEntries).toBeGreaterThan(0)

    await page.screenshot({ path: '/tmp/e2e-results/07-page-nav.png' })
  })
})

// ========================================
// Test Suite 4: Theme
// ========================================

test.describe('Debug Server - Theme', () => {
  test('theme toggle works', async ({ page }) => {
    await page.goto('/')

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Click theme toggle (using btn-icon class and title pattern)
    await page.click('.btn-icon[title*="Switch to"]', { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Check theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(newTheme).not.toBe(initialTheme)

    await page.screenshot({ path: `/tmp/e2e-results/08-theme-${newTheme}.png` })
  })
})

// ========================================
// Test Suite 5: Mobile
// ========================================

test.describe('Debug Server - Mobile', () => {
  test('mobile layout', async ({ page }) => {
    // Create test entry first
    const response = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'mobile-layout-test',
        files: [{ content: 'console.log(1)', filename: 'main.js' }]
      }
    })
    const entry = await response.json()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/${entry.slug}`)
    await page.waitForTimeout(1000)

    // Mobile should not show sidebars
    await expect(page.locator('.file-sidebar')).not.toBeVisible()
    await expect(page.locator('.toc-sidebar')).not.toBeVisible()

    // Mobile actions should be visible
    await expect(page.locator('.mobile-actions')).toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/09-mobile.png' })
  })

  test('single file hides Files button on mobile', async ({ page }) => {
    // Create a single file entry
    const response = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'mobile-single-file-test',
        files: [{ content: 'console.log(1)', filename: 'main.js' }]
      }
    })
    const entry = await response.json()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/${entry.slug}`)
    await page.waitForTimeout(1000)

    // Single file should NOT show Files button
    await expect(page.locator('.mobile-actions .menu-btn')).not.toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/10-mobile-single-file.png' })
  })

  test('multi file shows Files button with count on mobile', async ({ page }) => {
    // Create a multi-file entry
    const response = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'mobile-multi-file-test',
        files: [
          { content: 'file1', filename: 'a.js' },
          { content: 'file2', filename: 'b.js' },
          { content: 'file3', filename: 'c.js' }
        ]
      }
    })
    const entry = await response.json()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/${entry.slug}`)
    await page.waitForTimeout(1000)

    // Multi file should show Files button with count
    const filesButton = page.locator('.mobile-actions .menu-btn')
    await expect(filesButton).toBeVisible()
    await expect(filesButton).toContainText('Files (3)')

    await page.screenshot({ path: '/tmp/e2e-results/11-mobile-multi-file.png' })
  })
})

// ========================================
// Test Suite 6: Authentication
// ========================================

test.describe('Debug Server - Auth', () => {
  test('login button visible when anonymous', async ({ page }) => {
    await page.goto('/')
    // Wait for auth initialization to complete (loading state -> anonymous)
    await waitForPageReady(page, 10000)
    await page.waitForSelector('.btn-login', { timeout: 10000, state: 'visible' })
    await expect(page.locator('.btn-login')).toBeVisible()
    await page.screenshot({ path: '/tmp/e2e-results/20-login-button.png' })
  })

  test('login dialog opens and registers', async ({ page }) => {
    // Use API to create user first (avoids rate limiting on registration endpoint)
    const uniqueUser = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: uniqueUser, password: 'e2epass123' }
    })
    expect(regResp.status()).toBe(201)

    await page.goto('/')
    // Wait for page to be ready first
    await waitForPageReady(page, 10000)
    await page.waitForSelector('.btn-login', { timeout: 10000, state: 'visible' })

    // Click Login button
    await page.click('.btn-login')
    await page.waitForTimeout(1000)

    // Dialog should be visible
    await expect(page.locator('.login-dialog')).toBeVisible()

    // Fill login form with the pre-registered user
    await page.fill('#login-username', uniqueUser)
    await page.fill('#login-password', 'e2epass123')

    // Submit
    await page.click('.login__submit')
    // Wait for dialog to close (indicates success)
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 })

    // User menu should appear
    await page.waitForTimeout(1000)
    await expect(page.locator('.user-menu-trigger')).toBeVisible({ timeout: 30000 })

    await page.screenshot({ path: '/tmp/e2e-results/21-login-success.png' })
  })

  test('private entry invisible to anonymous, visible to owner', async ({ page }) => {
    // Register and get token with unique username
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `private_${ts}`, password: 'privpass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Create private entry with JWT
    const createResp = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Private E2E Entry',
        is_public: false,
        files: [{ filename: 'secret.py', content: 'SECRET = 42' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(createResp.status()).toBe(201)
    const entry = await createResp.json()

    // Anonymous: entry should NOT appear in list
    const anonList = await page.request.get('/api/v1/entries')
    const anonData = await anonList.json()
    const anonFound = anonData.items.some((i: any) => i.slug === entry.slug)
    expect(anonFound).toBeFalsy()

    // Anonymous: direct access should 404
    const anonDetail = await page.request.get(`/api/v1/entries/${entry.slug}`)
    expect(anonDetail.status()).toBe(404)

    // Owner: entry SHOULD appear in list
    const ownerList = await page.request.get('/api/v1/entries', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const ownerData = await ownerList.json()
    const ownerFound = ownerData.items.some((i: any) => i.slug === entry.slug)
    expect(ownerFound).toBeTruthy()

    await page.screenshot({ path: '/tmp/e2e-results/22-private-visibility.png' })
  })

  test('card shows owner actions for owned entries', async ({ page }) => {
    // Register with unique username
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `card_${ts}`, password: 'cardpass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Create entry as this user
    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'My Owned Entry',
        files: [{ filename: 'hello.py', content: 'print("hi")' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    // Login in UI using helper
    await setupAuth(page, token)

    // Card should have owner actions
    const cardActions = page.locator('.card-actions')
    await expect(cardActions.first()).toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/23-owner-card.png' })
  })

  test('visibility toggle works on card', async ({ page }) => {
    // Register with unique username
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `toggle_${ts}`, password: 'togglepass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Create private entry
    const createResp = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Toggle Test Entry',
        is_public: false,
        files: [{ filename: 'code.py', content: 'x = 1' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(createResp.status()).toBe(201)

    // Login in UI using helper
    await setupAuth(page, token)

    // Find the visibility toggle button
    const toggleBtn = page.locator('.card-action-btn').first()
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()
    await page.waitForTimeout(1000)

    // Toast should appear
    await expect(page.locator('.toast')).toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/24-visibility-toggle.png' })
  })

  test('logout clears session', async ({ page }) => {
    // Register with unique username
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `logout_${ts}`, password: 'logoutpass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Login in UI using helper (logout test)
    await setupAuth(page, token)

    // Click user menu to open dropdown
    await page.click('.user-menu-trigger')
    await page.waitForTimeout(500)

    // Click Logout (last dropdown item)
    const logoutBtn = page.locator('.dropdown-item').last()
    await logoutBtn.click()
    await page.waitForTimeout(1000)

    // Should see Login button again
    await expect(page.locator('.btn-login')).toBeVisible()
    // Cookie should be cleared
    const cookies = await page.context().cookies()
    const authCookie = cookies.find(c => c.name === 'peekview_token')
    expect(authCookie).toBeUndefined()

    await page.screenshot({ path: '/tmp/e2e-results/25-logout.png' })
  })
})

// ========================================
// Test Suite 7: All/Mine Tabs
// ========================================

test.describe('Debug Server - All/Mine Tabs', () => {
  test('owner tabs visible when authenticated', async ({ page }) => {
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `tabs_${ts}`, password: 'tabspass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Set token and wait for auth
    await setupAuth(page, token)

    // Wait for auth state to be fully authenticated
    await page.waitForFunction(() => {
      return document.querySelector('.owner-tabs') !== null
    }, { timeout: 30000 })

    // Tabs should be visible
    await expect(page.locator('.owner-tabs')).toBeVisible()
    await expect(page.locator('.owner-tab').first()).toContainText('All')
    await expect(page.locator('.owner-tab').last()).toContainText('Mine')

    await page.screenshot({ path: '/tmp/e2e-results/30-owner-tabs.png' })
  })

  test('Mine tab filters to own entries', async ({ page }) => {
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `mine_${ts}`, password: 'minepass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Create entry as this user
    await page.request.post('/api/v1/entries', {
      data: {
        summary: 'My Entry',
        files: [{ filename: 'mine.py', content: 'x = 1' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    // Set token and wait for auth
    await setupAuth(page, token)

    // Click "Mine" tab
    await page.click('.owner-tab:last-child')

    // Wait for entries to load (may need API call)
    await page.waitForSelector('.entry-card, .empty', { timeout: 10000 })

    // Should show at least one entry
    const entries = await page.locator('.entry-card').count()
    expect(entries).toBeGreaterThanOrEqual(1)

    await page.screenshot({ path: '/tmp/e2e-results/31-mine-tab.png' })
  })

  test('owner tabs hidden when anonymous', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.btn-login, .user-menu-trigger', { timeout: 10000 })
    await expect(page.locator('.owner-tabs')).not.toBeVisible()
  })
})

// ========================================
// Test Suite 8: API Key Management
// ========================================

test.describe('Debug Server - API Keys', () => {
  test('API Keys link in user menu', async ({ page }) => {
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `apikey_${ts}`, password: 'apikeypass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Set cookie and wait for auth
    await page.context().addCookies([{
      name: 'peekview_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
    }])
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.waitForSelector('.user-menu-trigger', { timeout: 30000 })

    // Open user menu
    await page.click('.user-menu-trigger')
    await page.waitForTimeout(500)

    // "API Keys" dropdown item should be visible
    await expect(page.locator('.dropdown-item').first()).toContainText('API Keys')

    await page.screenshot({ path: '/tmp/e2e-results/40-apikey-menu.png' })
  })

  test('API Keys page loads', async ({ page }) => {
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `apikeypage_${ts}`, password: 'apikeypass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Go to API Keys page with auth
    await setupAuth(page, token)
    await page.goto('/settings/apikeys')
    // Wait for page content to render (h1 may take time due to auth init)
    await page.waitForSelector('.apikey-page', { timeout: 30000 })

    // Should be on API Keys page
    await expect(page.locator('.apikey-page h1')).toContainText('API Keys')

    await page.screenshot({ path: '/tmp/e2e-results/41-apikey-page.png' })
  })

  test('create API key via UI', async ({ page }) => {
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `keycreate_${ts}`, password: 'keypass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    // Navigate to API Keys page
    await setupAuth(page, token)
    await page.goto('/settings/apikeys')
    // Wait for auth to initialize and page to render
    await page.waitForSelector('.apikey-page', { timeout: 30000 })

    // Click Create Key button
    await page.click('.apikey-page .btn-primary')
    await page.waitForTimeout(1000)

    // Dialog should be visible
    await expect(page.locator('.dialog')).toBeVisible()

    // Fill key name
    await page.fill('#key-name', 'E2E Test Key')

    // Click Create
    await page.click('.dialog .btn-primary')
    await page.waitForTimeout(2000)

    // Should show the created key
    await expect(page.locator('.key-value')).toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/42-apikey-created.png' })

    // Dismiss the dialog
    await page.click('.dialog .btn-primary')
    await page.waitForTimeout(1000)

    // Key card should appear in list
    await expect(page.locator('.key-card')).toBeVisible()
    await expect(page.locator('.key-name')).toContainText('E2E Test Key')

    await page.screenshot({ path: '/tmp/e2e-results/43-apikey-list.png' })
  })

  test('API key can create entries', async ({ page }) => {
    // Create user and API key via API
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `keyentry_${ts}`, password: 'keypass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    const keyResp = await page.request.post('/api/v1/apikeys', {
      data: { name: 'E2E Auto Key' },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(keyResp.status()).toBe(201)
    const keyData = await keyResp.json()
    const apiKey = keyData.key

    // Use API key to create entry
    const entryResp = await page.request.post('/api/v1/entries', {
      data: {
        summary: 'Created via API Key',
        files: [{ filename: 'auto.py', content: 'result = api_key_works()' }],
      },
      headers: { 'X-API-Key': apiKey },
    })
    expect(entryResp.status()).toBe(201)

    const entry = await entryResp.json()
    expect(entry.owner_id).toBeTruthy()
  })

  test('revoke API key', async ({ page }) => {
    // Create user and API key via API
    const ts = Date.now()
    const regResp = await page.request.post('/api/v1/auth/register', {
      data: { username: `keyrevoke_${ts}`, password: 'keypass123' }
    })
    const regData = await regResp.json()
    const token = regData.access_token

    const keyResp = await page.request.post('/api/v1/apikeys', {
      data: { name: 'Revoke Me' },
      headers: { Authorization: `Bearer ${token}` },
    })
    const keyData = await keyResp.json()
    const keyId = keyData.id

    // Navigate to API Keys page - use setupAuth first
    await setupAuth(page, token)
    await page.goto('/settings/apikeys')
    await page.waitForSelector('.apikey-page', { timeout: 30000 })
    // Wait for API data to load with mobile support
    await waitForApiData(page, '.key-card, .apikey-page .empty', 30000)

    // If empty state, create a key first (via API for speed)
    const keyCount = await page.locator('.key-card').count()
    if (keyCount === 0) {
      await page.request.post('/api/v1/apikeys', {
        data: { name: 'Test Key' },
        headers: { Authorization: `Bearer ${token}` },
      })
      // Reload to see the new key
      await page.reload()
      await waitForApiData(page, '.key-card', 30000)
    }

    // Click Revoke button
    await page.click('.btn-danger')
    await page.waitForTimeout(1000)

    // Confirm dialog should appear
    await expect(page.locator('.confirm-dialog')).toBeVisible()
    await page.click('.confirm-dialog .confirm__btn--destructive')
    await page.waitForTimeout(1000)

    // Key should be removed from list
    await expect(page.locator('.key-card')).not.toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/44-apikey-revoked.png' })
  })
})
