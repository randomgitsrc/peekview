import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Helper: Wait for Shiki to load
async function waitForShiki(page) {
  await page.waitForFunction(() => {
    return document.querySelector('.code-body pre') !== null
  }, { timeout: 5000 })
}

// Helper: Get colored tokens
async function getColoredTokens(page) {
  return await page.locator('.code-body span[style*="color"]').count()
}

// ========================================
// Test Suite 1: Code Viewer
// ========================================

test.describe('Code Viewer', () => {
  test('TC-001: Python code syntax highlighting', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Check for colored tokens (Shiki generates spans with color styles)
    const coloredTokens = await getColoredTokens(page)
    expect(coloredTokens).toBeGreaterThan(0)

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/tc-001-code-highlight.png' })
  })

  test('TC-002: Line numbers displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Shiki's output should have line structure
    const lines = await page.locator('.code-body .line').count()
    expect(lines).toBeGreaterThan(0)
  })

  test('TC-003: Wrap mode toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Initial state - no wrap
    await expect(page.locator('.code-body')).not.toHaveClass(/wrap-enabled/)

    // Click Wrap button
    await page.click('button:has-text("Wrap")')

    // Check wrap enabled
    await expect(page.locator('.code-body')).toHaveClass(/wrap-enabled/)

    // Click again to toggle off
    await page.click('button:has-text("Wrap")')
    await expect(page.locator('.code-body')).not.toHaveClass(/wrap-enabled/)
  })

  test('TC-004: Copy button copies code', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Click Copy
    await page.click('button:has-text("Copy")')

    // Verify clipboard has content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('def')
  })

  test('TC-005: Code block header displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Check header elements
    await expect(page.locator('.code-header .filename')).toContainText('test.py')
    await expect(page.locator('.code-header .lang')).toContainText('PYTHON')
    await expect(page.locator('.code-header button:has-text("Copy")')).toBeVisible()
    await expect(page.locator('.code-header button:has-text("Wrap")')).toBeVisible()
  })
})

// ========================================
// Test Suite 2: Markdown Rendering
// ========================================

test.describe('Markdown Viewer', () => {
  test('TC-010: Markdown basic rendering', async ({ page }) => {
    // Navigate to markdown entry
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Wait for content
    await page.waitForSelector('.markdown-body', { timeout: 5000 })

    // Check headings rendered
    const headings = await page.locator('.markdown-body h1, .markdown-body h2, .markdown-body h3').count()
    expect(headings).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/tc-010-markdown-render.png' })
  })

  test('TC-011: TOC sidebar displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/ngajri`)
    await page.waitForSelector('.markdown-body', { timeout: 5000 })

    // Check TOC exists on desktop
    const tocItems = await page.locator('.toc-nav .toc-item').count()
    expect(tocItems).toBeGreaterThan(0)
  })

  test('TC-012: TOC navigation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/ngajri`)
    await page.waitForSelector('.toc-nav', { timeout: 5000 })

    // Click first TOC item
    const firstTocLink = page.locator('.toc-nav .toc-item a').first()
    const href = await firstTocLink.getAttribute('href')
    await firstTocLink.click()

    // Verify URL has hash
    await expect(page).toHaveURL(new RegExp(`.*${href}$`))
  })

  test('TC-013: Mermaid diagram rendering', async ({ page }) => {
    // This test requires an entry with mermaid diagram
    await page.goto(`${BASE_URL}/#/entry/ngajri`)
    await page.waitForTimeout(3000)

    // Check for mermaid container or SVG
    const mermaidExists = await page.locator('.mermaid, .language-mermaid').count() > 0
    if (mermaidExists) {
      await expect(page.locator('.mermaid')).toBeVisible({ timeout: 5000 })
    }
  })
})

// ========================================
// Test Suite 3: Responsive Layout
// ========================================

test.describe('Responsive Layout', () => {
  test('TC-020: Desktop 3-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Check file sidebar visible on desktop
    await expect(page.locator('.file-sidebar')).toBeVisible()

    // Check TOC sidebar visible for markdown
    await expect(page.locator('.toc-sidebar')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-020-desktop-layout.png' })
  })

  test('TC-021: Mobile single column layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Sidebars should be hidden on mobile
    await expect(page.locator('.file-sidebar')).not.toBeVisible()
    await expect(page.locator('.toc-sidebar')).not.toBeVisible()

    // Mobile actions should be visible
    await expect(page.locator('.mobile-actions')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-021-mobile-layout.png' })
  })

  test('TC-022: Mobile file drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Click menu button
    await page.click('.mobile-actions .menu-btn')

    // Drawer should appear
    await expect(page.locator('.drawer-left')).toBeVisible()

    // Click overlay to close
    await page.click('.drawer-overlay')
    await expect(page.locator('.drawer-left')).not.toBeVisible()
  })

  test('TC-023: Mobile TOC drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Click TOC button in header
    await page.click('.toc-btn')

    // TOC drawer should appear
    await expect(page.locator('.drawer-right')).toBeVisible()
  })
})

// ========================================
// Test Suite 4: Theme Switching
// ========================================

test.describe('Theme Switching', () => {
  test('TC-030: Dark/light theme toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Click theme toggle
    await page.click('.list-header .btn-icon, .detail-header .btn-icon')

    // Check theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(newTheme).not.toBe(initialTheme)

    // Take screenshot
    await page.screenshot({ path: `test-results/tc-030-theme-${newTheme}.png` })
  })

  test('TC-031: Theme persistence after reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)

    // Toggle theme
    await page.click('.list-header .btn-icon')
    const themeBeforeReload = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Reload page
    await page.reload()

    // Check theme persisted
    const themeAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(themeAfterReload).toBe(themeBeforeReload)
  })
})

// ========================================
// Test Suite 5: File Operations
// ========================================

test.describe('File Operations', () => {
  test('TC-040: File selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/ngajri`)

    // Click second file in tree
    const files = page.locator('.file-item')
    await files.nth(1).click()

    // Check active class
    await expect(files.nth(1)).toHaveClass(/active/)
  })

  test('TC-041: Single file hides file tree', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)

    // Single file entry should not show file sidebar
    const fileSidebar = page.locator('.file-sidebar')
    const count = await fileSidebar.count()
    expect(count).toBe(0)
  })

  test('TC-042: Download button exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/entry/lu4prg`)
    await waitForShiki(page)

    // Check download link exists
    const downloadLink = page.locator('a[download]')
    await expect(downloadLink).toBeVisible()
  })
})

// ========================================
// Test Suite 6: Entry List
// ========================================

test.describe('Entry List', () => {
  test('TC-050: Entry list displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)

    // Wait for entries to load
    await page.waitForSelector('.entry-card', { timeout: 10000 })

    // Check entries exist
    const entries = await page.locator('.entry-card').count()
    expect(entries).toBeGreaterThan(0)

    // Click first entry
    await page.click('.entry-card')

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/entry\//)
  })
})
