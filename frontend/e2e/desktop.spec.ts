import { test, expect } from '@playwright/test'

/**
 * Desktop E2E Tests (ED1-ED6)
 * Tests core user flows on desktop viewports
 */

test.describe('Desktop Navigation', () => {
  test('ED1: navigate from list to detail', async ({ page }) => {
    // Start at entry list
    await page.goto('/')

    // Wait for entries to load
    await page.waitForSelector('.entry-list', { timeout: 5000 })

    // Click first entry card
    const firstEntry = page.locator('.entry-card').first()
    await expect(firstEntry).toBeVisible()
    await firstEntry.click()

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/.+$/)
    await expect(page.locator('.detail-header h2')).toBeVisible()
  })

  test('ED2: back button returns to list', async ({ page }) => {
    // Go to detail page
    await page.goto('/test-entry')
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Click back button
    await page.locator('.back-link').click()

    // Should return to list
    await expect(page).toHaveURL('/')
    await expect(page.locator('.entry-list-view')).toBeVisible()
  })

  test('ED3: file tree navigation', async ({ page }) => {
    // Go to multi-file entry
    await page.goto('/multi-file-entry')
    await page.waitForSelector('.file-tree', { timeout: 5000 })

    // Click a file in the tree
    const fileNode = page.locator('.tree-node-row').first()
    await expect(fileNode).toBeVisible()
    await fileNode.click()

    // Should show file content
    await expect(page.locator('.code-content, .markdown-viewer')).toBeVisible()
  })

  test('ED4: search functionality', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.entry-list', { timeout: 5000 })

    // Type in search box
    const searchInput = page.locator('.search-input')
    await searchInput.fill('python')

    // Wait for debounce and results
    await page.waitForTimeout(500)

    // Results should be filtered
    await expect(page.locator('.entry-list')).toBeVisible()
  })

  test('ED5: pagination navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.entry-list', { timeout: 5000 })

    // Check if pagination exists
    const pagination = page.locator('.pagination')
    if (await pagination.isVisible().catch(() => false)) {
      // Click next page
      const nextBtn = page.locator('button[aria-label="Next page"]')
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(500)
        await expect(page.locator('.page-info')).toContainText('Page 2')
      }
    }
  })

  test('ED6: theme toggle', async ({ page }) => {
    await page.goto('/')

    // Find theme toggle
    const themeToggle = page.locator('.theme-toggle')
    await expect(themeToggle).toBeVisible()

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Toggle theme
    await themeToggle.click()

    // Theme should change
    await page.waitForTimeout(200)
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(newTheme).not.toBe(initialTheme)
  })
})

test.describe('Code Viewing', () => {
  test('ED7: code file displays with syntax highlighting', async ({ page }) => {
    await page.goto('/code-entry')
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    // Should show code content
    await expect(page.locator('.code-content')).toBeVisible()

    // Should show line count
    await expect(page.locator('.line-count')).toBeVisible()
  })

  test('ED8: markdown renders with TOC', async ({ page }) => {
    await page.goto('/markdown-entry')
    await page.waitForSelector('.markdown-viewer', { timeout: 5000 })

    // Should show rendered markdown
    await expect(page.locator('.markdown-viewer h1, .markdown-viewer h2')).toBeVisible()

    // TOC sidebar should be visible on desktop
    const toc = page.locator('.toc-sidebar')
    if (await toc.isVisible().catch(() => false)) {
      // Click TOC link
      const tocLink = page.locator('.toc-item a').first()
      await tocLink.click()
    }
  })

  test('ED9: copy code button', async ({ page }) => {
    await page.goto('/code-entry')
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    // Click copy button
    const copyBtn = page.locator('.copy-btn')
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    // Button should show copied state temporarily
    await expect(copyBtn).toContainText('✓')
  })

  test('ED10: wrap toggle', async ({ page }) => {
    await page.goto('/code-entry')
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    const wrapBtn = page.locator('.wrap-btn')
    await expect(wrapBtn).toBeVisible()

    // Toggle wrap mode
    await wrapBtn.click()

    // Code content should have wrap class
    const codeContent = page.locator('.code-content')
    await expect(codeContent).toHaveClass(/wrap/)
  })
})
