import { test, expect } from '@playwright/test'

// Helper: Wait for Shiki to load
async function waitForShiki(page) {
  await page.waitForFunction(() => {
    return document.querySelector('.code-body pre') !== null
  }, { timeout: 15000 })
}

// Helper: Get colored tokens
async function getColoredTokens(page) {
  return await page.locator('.code-body span[style*="color"]').count()
}

// Helper: Navigate to markdown-test with the markdown file as active file
// (files[0] is architecture.svg; markdown rendering/TOC only apply to rich-markdown.md)
async function openMarkdownFile(page) {
  const res = await page.request.get('/api/v1/entries/markdown-test')
  const entry = await res.json()
  const md = entry.files.find((f: any) => f.filename === 'rich-markdown.md')
  await page.goto(`/markdown-test?firstFileId=${md.id}`)
}

// ========================================
// Test Suite 1: Code Viewer
// ========================================

test.describe('Code Viewer', () => {
  test('TC-001: Python code syntax highlighting', async ({ page }) => {
    // 创建测试条目
    await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-test-code',
        summary: 'E2E Test Code',
        files: [{
          filename: 'test.py',
          content: 'def hello():\n    print("Hello World")\n    return 42'
        }]
      }
    })

    await page.goto('/e2e-test-code')
    await waitForShiki(page)

    // Check for colored tokens (Shiki generates spans with color styles)
    const coloredTokens = await getColoredTokens(page)
    expect(coloredTokens).toBeGreaterThan(0)

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/tc-001-code-highlight.png' })
  })

  test('TC-002: Line numbers displayed', async ({ page }) => {
    await page.goto('/e2e-test-code')
    await waitForShiki(page)

    // Shiki's output should have line structure
    const lines = await page.locator('.code-body .line').count()
    expect(lines).toBeGreaterThan(0)
  })

  test('TC-003: Wrap mode toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/e2e-test-code')
    await waitForShiki(page)

    // Initial state - no wrap
    await expect(page.locator('.code-body')).not.toHaveClass(/wrap-enabled/)

    // Click wrap button in mobile bottom bar
    await page.locator('[data-testid="mobile-bar-wrap-btn"]').click()

    // Check wrap enabled
    await expect(page.locator('.code-body')).toHaveClass(/wrap-enabled/)

    // Click again to toggle off
    await page.locator('[data-testid="mobile-bar-wrap-btn"]').click()
    await expect(page.locator('.code-body')).not.toHaveClass(/wrap-enabled/)
  })

  test('TC-004: Copy button copies code', async ({ page, context }) => {
    await page.goto('/python-entry-service')
    await waitForShiki(page)

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Click Copy
    await page.locator('[aria-label="Copy"]').click()

    // Verify clipboard has content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('def')
  })

  test('TC-005: File tree shows filename and copy button', async ({ page }) => {
    // File tree sidebar is desktop-only; force desktop viewport so it renders in both projects
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/python-entry-service')
    await waitForShiki(page)

    // Active file name rendered in file tree (python-entry-service has 2 files)
    await expect(page.locator('.file-item .file-name').filter({ hasText: 'entry_service.py' })).toHaveText('entry_service.py')

    // Copy button visible
    await expect(page.locator('[aria-label="Copy"]')).toBeVisible()
  })
})

// ========================================
// Test Suite 2: Markdown Rendering
// ========================================

test.describe('Markdown Viewer', () => {
  test('TC-010: Markdown basic rendering', async ({ page }) => {
    // Navigate to markdown entry with the markdown file active
    await openMarkdownFile(page)

    // Wait for content (headings render async after .markdown-body mounts)
    await page.waitForSelector('.markdown-body h1', { timeout: 10000 })

    // Check headings rendered
    const headings = await page.locator('.markdown-body h1, .markdown-body h2, .markdown-body h3').count()
    expect(headings).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/tc-010-markdown-render.png' })
  })

  test('TC-011: TOC sidebar displayed', async ({ page }) => {
    // .toc-nav sidebar is desktop-only; force desktop viewport so it renders in both projects
    await page.setViewportSize({ width: 1280, height: 800 })
    await openMarkdownFile(page)
    await page.waitForSelector('.toc-nav .toc-item', { timeout: 10000 })

    // Check TOC exists on desktop
    const tocItems = await page.locator('.toc-nav .toc-item').count()
    expect(tocItems).toBeGreaterThan(0)
  })

  test('TC-012: TOC navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openMarkdownFile(page)
    await page.waitForSelector('.toc-nav', { timeout: 5000 })

    // Click last TOC item (guaranteed to be below the fold)
    const lastTocLink = page.locator('.toc-nav .toc-item a').last()
    await lastTocLink.click()

    // Content area should scroll to the heading
    await expect.poll(() =>
      page.locator('[data-testid="content-area"]').evaluate((el: HTMLElement) => el.scrollTop)
    ).toBeGreaterThan(0)
  })

  test('TC-013: Mermaid diagram rendering', async ({ page }) => {
    // Navigate to mermaid entry
    await page.goto('/mermaid-charts')

    // Mermaid diagram container should render an SVG
    await expect(page.locator('.diagram-viewer svg').first()).toBeVisible({ timeout: 15000 })
  })
})

// ========================================
// Test Suite 3: Responsive Layout
// ========================================

test.describe('Responsive Layout', () => {
  test('TC-020: Desktop 3-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openMarkdownFile(page)

    // Check file sidebar visible on desktop
    await expect(page.locator('.file-sidebar')).toBeVisible()

    // Check TOC sidebar visible for markdown
    await expect(page.locator('.toc-sidebar')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-020-desktop-layout.png' })
  })

  test('TC-021: Mobile single column layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/markdown-test')

    // Sidebars should be hidden on mobile
    await expect(page.locator('.file-sidebar')).not.toBeVisible()
    await expect(page.locator('.toc-sidebar')).not.toBeVisible()

    // Mobile bottom bar should be visible
    await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-021-mobile-layout.png' })
  })

  test('TC-022: Mobile file drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/markdown-test')

    // Click file tree button in mobile bottom bar
    await page.locator('[data-testid="mobile-bar-filetree-btn"]').click()

    // Drawer should appear
    await expect(page.locator('.drawer-left')).toBeVisible()

    // Click overlay outside the drawer (280px wide) to close
    await page.locator('.drawer-overlay').click({ position: { x: 360, y: 400 } })
    await expect(page.locator('.drawer-left')).not.toBeVisible()
  })

  test('TC-023: Mobile TOC drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    // Default active file is architecture.svg (non-markdown), so the TOC button only
    // renders after selecting the markdown file via ?firstFileId=
    await openMarkdownFile(page)

    // Click TOC button in mobile bottom bar
    await page.locator('[data-testid="mobile-bar-toc-btn"]').click()

    // TOC drawer should appear
    await expect(page.locator('.drawer-right')).toBeVisible()
  })
})

// ========================================
// Test Suite 4: Theme Switching
// ========================================

test.describe('Theme Switching', () => {
  test('TC-030: Dark/light theme toggle', async ({ page }) => {
    // .detail-header (with theme-toggle) is desktop-only; force desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/python-entry-service')
    await waitForShiki(page)

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Click theme toggle in detail header
    await page.locator('.detail-header .theme-toggle').click()

    // Check theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(newTheme).not.toBe(initialTheme)

    // Take screenshot
    await page.screenshot({ path: `test-results/tc-030-theme-${newTheme}.png` })
  })

  test('TC-031: Theme persistence after reload', async ({ page }) => {
    await page.goto('/')

    // Toggle theme on landing
    await page.locator('.theme-toggle').click()
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
    // File tree is in the mobile drawer (closed by default); force desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/markdown-test')

    // Click second file in tree
    const files = page.locator('.file-item')
    await files.nth(1).click()

    // Check active class
    await expect(files.nth(1)).toHaveClass(/active/)
  })

  test('TC-041: Single file hides file tree', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/json-api-config')

    // Single file entry should not show file sidebar
    const fileSidebar = page.locator('.file-sidebar')
    const count = await fileSidebar.count()
    expect(count).toBe(0)
  })

  test('TC-042: Download button downloads file', async ({ page }) => {
    await page.goto('/python-entry-service')
    await waitForShiki(page)

    // Open overflow menu
    await page.locator('[data-testid="overflow-menu-trigger"]').click()

    // Trigger real download
    const downloadPromise = page.waitForEvent('download')
    await page.getByText('Download', { exact: true }).click()
    const download = await downloadPromise

    // Verify downloaded filename
    expect(download.suggestedFilename()).toContain('entry_service.py')
  })
})

// ========================================
// Test Suite 6: Entry List
// ========================================

test.describe('Entry List', () => {
  test('TC-050: Entry list displays correctly', async ({ page }) => {
    // .detail-header is desktop-only; force desktop viewport so navigation assertion works
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/explore')

    // Wait for entries to load
    await page.waitForSelector('.entry-card', { timeout: 10000 })

    // Check entries exist
    const entries = await page.locator('.entry-card').count()
    expect(entries).toBeGreaterThan(0)

    // Click first entry's title link (the .entry-card div itself has no navigation)
    await page.locator('.entry-card .card-title').first().click()

    // Should navigate to detail page (history mode URL: /{slug})
    await expect(page.locator('.detail-header')).toBeVisible()
    await expect(page).toHaveURL(/\/[^/]+$/)
  })
})
