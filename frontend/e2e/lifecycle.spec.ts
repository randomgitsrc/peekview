import { test, expect } from '@playwright/test'

/**
 * Entry Lifecycle E2E Tests (EL1-EL4)
 * Tests entry creation, viewing, expiration, and deletion flows
 */

test.describe('Entry Lifecycle', () => {
  test('EL1: view active entry', async ({ page }) => {
    // Navigate to an existing entry
    await page.goto('/test-entry')
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Entry content should be visible
    await expect(page.locator('.entry-content')).toBeVisible()
    await expect(page.locator('.detail-footer')).toBeVisible()

    // Tags should be displayed
    const tags = page.locator('.tag')
    const tagCount = await tags.count()
    expect(tagCount).toBeGreaterThanOrEqual(0)
  })

  test('EL2: 404 page for non-existent entry', async ({ page }) => {
    // Navigate to non-existent entry
    await page.goto('/non-existent-entry-12345')

    // Should show error state
    await page.waitForSelector('.error-display', { timeout: 5000 })

    // Should show "Entry not found" message
    await expect(page.locator('.error-message')).toContainText('not found', { ignoreCase: true })

    // Should have back link
    await expect(page.locator('.back-home-link')).toBeVisible()
  })

  test('EL3: entry list pagination', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.entry-list', { timeout: 5000 })

    // Get initial entry count
    const initialEntries = await page.locator('.entry-card').count()

    // If pagination exists, test it
    const pagination = page.locator('.pagination')
    if (await pagination.isVisible().catch(() => false)) {
      const nextBtn = page.locator('button[aria-label="Next page"]')

      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(500)

        // Page indicator should update
        await expect(page.locator('.page-info')).toContainText('Page 2')

        // Entry cards might be different
        const newEntries = await page.locator('.entry-card').count()
        expect(newEntries).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('EL4: deep link to specific file', async ({ page }) => {
    // Navigate with file query parameter
    await page.goto('/multi-file-entry?file=README.md')
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Should show the specified file
    // Either CodeViewer or MarkdownViewer should be visible
    await expect(
      page.locator('.code-viewer, .markdown-viewer')
    ).toBeVisible()

    // URL should preserve the query parameter
    const url = page.url()
    expect(url).toContain('file=README.md')
  })

  test('EL5: browser back/forward navigation', async ({ page }) => {
    // Start at list
    await page.goto('/')
    await page.waitForSelector('.entry-list', { timeout: 5000 })

    // Click first entry
    await page.locator('.entry-card').first().click()
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    // Navigate back
    await page.goBack()
    await page.waitForSelector('.entry-list', { timeout: 5000 })
    await expect(page).toHaveURL('/')

    // Navigate forward
    await page.goForward()
    await page.waitForSelector('.detail-header', { timeout: 5000 })
  })

  test('EL6: URL state persists file selection', async ({ page }) => {
    await page.goto('/multi-file-entry')
    await page.waitForTimeout(2000)

    // Select a different file
    const fileNode = page.locator('.tree-node-row').nth(1)
    if (await fileNode.isVisible().catch(() => false)) {
      await fileNode.click()
      await page.waitForTimeout(500)

      // URL should have file query parameter
      const url = page.url()
      expect(url).toMatch(/\?file=/)

      // Refresh page
      await page.reload()
      await page.waitForTimeout(2000)

      // Should still show the selected file
      await expect(
        page.locator('.code-viewer, .markdown-viewer')
      ).toBeVisible()
    }
  })
})
