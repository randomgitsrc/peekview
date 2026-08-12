/**
 * T052 Entry Detail Header Redesign — Playwright E2E tests
 *
 * RED TESTS: All tests fail with current implementation because:
 * - .title-row / .meta-row elements don't exist (uses .header-meta-row / .header-actions-row)
 * - .icon-btn class not used (uses BaseButton with text labels)
 * - .mobile-sticky-header doesn't exist
 * - .mobile-bottom-bar doesn't exist (uses .mobile-actions)
 * - OverflowMenu has no variant prop
 * - Toggle buttons with active class don't exist
 * - Bottom sheet not implemented
 * - Emoji icons present instead of Lucide SVGs
 *
 * Viewports: desktop=1280×800, mobile=390×844 (iPhone 14)
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('T052 Entry Detail Header Redesign — Desktop', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('T-B01-E2E: Desktop header height ≤ 80px', async ({ page }) => {
    // Create an entry to test with
    await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-header-test',
        summary: 'E2E Header Test Entry',
        files: [
          { filename: 'test.md', content: '# Heading 1\n\nSome content\n\n## Heading 2\n' },
          { filename: 'test.py', content: 'def foo(): pass\n' },
        ],
      },
    })

    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // New design: header height ≤ 80px
    const headerBox = await page.locator('.detail-header').boundingBox()
    expect(headerBox).not.toBeNull()
    expect(headerBox!.height).toBeLessThanOrEqual(80)

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B01-E2E-desktop-header-height.png' })
  })

  test('T-B01-E2E-02: Desktop header has title-row and meta-row', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // New design: .title-row and .meta-row as direct children of .detail-header
    await expect(page.locator('.detail-header .title-row')).toBeVisible()
    await expect(page.locator('.detail-header .meta-row')).toBeVisible()

    // Old .header-right should not exist in new design
    await expect(page.locator('.detail-header .header-right')).toHaveCount(0)
  })

  test('T-B05-E2E: Desktop Files/TOC toggle buttons open/close sidebar', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Files toggle button should exist (multi-file entry)
    const filesToggle = page.locator('.title-row button.icon-btn[title*="Files"]')
    await expect(filesToggle).toBeVisible()

    // Click Files toggle — sidebar should open
    await filesToggle.click()
    await expect(page.locator('.file-sidebar')).toBeVisible()

    // Toggle button should have active class
    await expect(filesToggle).toHaveClass(/active/)

    // Click again — sidebar should close
    await filesToggle.click()
    await expect(page.locator('.file-sidebar')).not.toBeVisible()

    // TOC toggle should exist (markdown file with headings)
    const tocToggle = page.locator('.title-row button.icon-btn[title*="TOC"]')
    await expect(tocToggle).toBeVisible()

    // Click TOC toggle
    await tocToggle.click()
    await expect(page.locator('.toc-sidebar')).toBeVisible()
    await expect(tocToggle).toHaveClass(/active/)

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B05-E2E-toggle-open.png' })
  })

  test('T-B07-E2E: More▾ dropdown shows correct items (owner)', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Click More▾ button in title-row
    const moreButton = page.locator('.title-row .overflow-trigger')
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    // Dropdown should appear
    const dropdown = page.locator('.overflow-dropdown')
    await expect(dropdown).toBeVisible()

    // Owner items should include Make Private/Share/Delete
    await expect(dropdown.locator('text=Make Private')).toBeVisible()
    await expect(dropdown.locator('text=Share')).toBeVisible()
    await expect(dropdown.locator('text=Delete entry')).toBeVisible()

    // Each item should have hint text
    await expect(dropdown.locator('text=Currently Public')).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B07-E2E-dropdown.png' })
  })
})

test.describe('T052 Entry Detail Header Redesign — Mobile', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('T-B08-E2E: Mobile bottom bar 48px with correct layout', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Mobile bottom bar should exist (not .mobile-actions)
    const bottomBar = page.locator('.mobile-bottom-bar')
    await expect(bottomBar).toBeVisible()

    // Height should be 48px
    const barBox = await bottomBar.boundingBox()
    expect(barBox).not.toBeNull()
    expect(barBox!.height).toBe(48)

    // Files button in bottom bar
    const filesBtn = bottomBar.locator('.files-btn')
    await expect(filesBtn).toBeVisible()
    await expect(filesBtn.locator('.badge')).toContainText('2')

    // TOC button for markdown
    const tocBtn = bottomBar.locator('button:has-text("TOC")')
    await expect(tocBtn).toBeVisible()

    // No Wrap/Copy buttons for markdown
    await expect(bottomBar.locator('button:has-text("Wrap")')).toHaveCount(0)
    await expect(bottomBar.locator('button:has-text("Copy")')).toHaveCount(0)

    // Overflow [...] button exists
    const overflowTrigger = bottomBar.locator('.overflow-trigger')
    await expect(overflowTrigger).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B08-E2E-mobile-bottom-bar.png' })
  })

  test('T-B09-E2E: Bottom bar changes by file type', async ({ page }) => {
    // Create binary entry
    await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-binary-test',
        summary: 'Binary test',
        files: [{ filename: 'image.png', isBinary: true, content: '' }],
      },
    })
    // Create code entry
    await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-code-test',
        summary: 'Code test',
        files: [{ filename: 'test.py', content: 'def foo(): pass' }],
      },
    })

    // Test markdown bottom bar
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })
    await expect(page.locator('.mobile-bottom-bar button:has-text("TOC")')).toBeVisible()

    // Test code bottom bar — should show Wrap + Copy
    await page.goto(`/#/entry/e2e-code-test`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })
    await expect(page.locator('.mobile-bottom-bar button:has-text("Wrap")')).toBeVisible()
    await expect(page.locator('.mobile-bottom-bar button:has-text("Copy")')).toBeVisible()

    // Test binary bottom bar — only [...] button
    await page.goto(`/#/entry/e2e-binary-test`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })
    await expect(page.locator('.mobile-bottom-bar button:has-text("TOC")')).toHaveCount(0)
    await expect(page.locator('.mobile-bottom-bar button:has-text("Wrap")')).toHaveCount(0)
    await expect(page.locator('.mobile-bottom-bar button:has-text("Copy")')).toHaveCount(0)
    await expect(page.locator('.mobile-bottom-bar .overflow-trigger')).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B09-E2E-binary-bottom-bar.png' })
  })

  test('T-B10-E2E: Mobile sticky header 52px', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Sticky header should exist at top
    const stickyHeader = page.locator('.mobile-sticky-header')
    await expect(stickyHeader).toBeVisible()

    // Height 52px
    const headerBox = await stickyHeader.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(headerBox!.height).toBe(52)

    // Has back button (chevron-left icon or link)
    await expect(stickyHeader.locator('a, button').first()).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B10-E2E-mobile-sticky-header.png' })
  })

  test('T-B12-E2E: Mobile overflow bottom sheet with theme toggle', async ({ page }) => {
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Click [...] overflow button in bottom bar
    const overflowTrigger = page.locator('.mobile-bottom-bar .overflow-trigger')
    await expect(overflowTrigger).toBeVisible()
    await overflowTrigger.click()

    // Bottom sheet should appear (variant="sheet")
    const bottomSheet = page.locator('.overflow-sheet, .overflow-dropdown')
    await expect(bottomSheet).toBeVisible()

    // First item should be Dark theme toggle with Lucide icon
    const firstGroupLabel = bottomSheet.locator('text=Dark theme')
    await expect(firstGroupLabel).toBeVisible()

    // No emoji should be visible
    const pageContent = await page.locator('.overflow-sheet, .overflow-dropdown').innerHTML()
    expect(pageContent).not.toContain('🌙')
    expect(pageContent).not.toContain('☀️')

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B12-E2E-mobile-bottom-sheet.png' })
  })
})

test.describe('T052 Entry Detail Header Redesign — Cross-cutting', () => {
  test('T-B15-E2E: No emoji icons rendered in header area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/#/entry/e2e-header-test`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Check no emoji in header
    const headerHtml = await page.locator('.detail-header').innerHTML()
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]/u
    expect(headerHtml).not.toMatch(emojiPattern)

    await page.screenshot({ path: 'docs/tasks/T052-entry-detail-header-redesign/P3-test-code/evidences/T-B15-E2E-no-emoji-header.png' })
  })
})
