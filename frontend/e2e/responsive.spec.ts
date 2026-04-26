import { test, expect } from '@playwright/test'

/**
 * Responsive Layout E2E Tests (ER1-ER5)
 * Tests responsive behavior between desktop and mobile viewports
 */

test.describe('Responsive Layout', () => {
  test('ER1: desktop shows three-column layout with file tree', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/multi-file-entry')

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Verify main layout elements exist
    // Left sidebar exists for multi-file entries
    await expect(page.locator('.sidebar-left')).toBeVisible()
    await expect(page.locator('.file-display')).toBeVisible()

    // Verify desktop header with action buttons (header-right contains ActionBar)
    await expect(page.locator('.header-right')).toBeVisible()

    // Mobile bottom bar should be hidden on desktop
    await expect(page.locator('.mobile-bottom-bar')).not.toBeVisible()

    // File tree should be visible in left sidebar
    await expect(page.locator('.file-tree')).toBeVisible()
  })

  test('ER2: mobile shows single column with bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/multi-file-entry')

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Verify sidebars are hidden on mobile
    const leftSidebar = page.locator('.sidebar-left')
    const rightSidebar = page.locator('.sidebar-right')

    await expect(leftSidebar).not.toBeVisible()
    await expect(rightSidebar).not.toBeVisible()

    // Verify mobile bottom bar is visible
    await expect(page.locator('.mobile-bottom-bar')).toBeVisible()

    // Main content area should still be visible
    await expect(page.locator('.file-display')).toBeVisible()
  })

  test('ER3: wrap button works on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/code-entry')

    // Wait for content to load
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    // Find and click Wrap button in header (look for action-btn with Wrap text)
    const wrapBtn = page.locator('.header-right .action-btn').filter({ hasText: /Wrap/ })
    await expect(wrapBtn).toBeVisible()

    await wrapBtn.click()

    // Verify code area has wrap class
    await expect(page.locator('.code-content')).toHaveClass(/wrap/)

    // Click again to disable wrap - find button again since text may have changed
    const wrapBtnAgain = page.locator('.header-right .action-btn').filter({ hasText: /No wrap|Wrap/ })
    await wrapBtnAgain.click()
    await expect(page.locator('.code-content')).not.toHaveClass(/wrap/)
  })

  test('ER4: buttons work on mobile bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/code-entry')

    // Wait for content
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    // Find mobile bottom bar
    const mobileBar = page.locator('.mobile-bottom-bar')
    await expect(mobileBar).toBeVisible()

    // Find action buttons in mobile bottom bar
    const actionButtons = mobileBar.locator('.action-btn')
    const buttonCount = await actionButtons.count()

    // Should have at least one action button
    expect(buttonCount).toBeGreaterThanOrEqual(1)

    // Verify action buttons are visible (Copy and Wrap for code files)
    await expect(actionButtons.first()).toBeVisible()
  })

  test('ER5: responsive breakpoint at 768px', async ({ page }) => {
    // Start at desktop size (above breakpoint)
    await page.setViewportSize({ width: 1024, height: 800 })
    await page.goto('/multi-file-entry')
    await page.waitForTimeout(2000)

    // Should show desktop layout at 1024px
    // Left sidebar should be visible for multi-file entry
    await expect(page.locator('.sidebar-left')).toBeVisible()
    await expect(page.locator('.mobile-bottom-bar')).not.toBeVisible()

    // Resize to below breakpoint (768px and below is mobile)
    await page.setViewportSize({ width: 768, height: 800 })
    await page.waitForTimeout(300) // Wait for transition

    // Sidebars should be hidden
    await expect(page.locator('.sidebar-left')).not.toBeVisible()

    // Mobile bottom bar should appear
    await expect(page.locator('.mobile-bottom-bar')).toBeVisible()

    // Main content should still be visible
    await expect(page.locator('.file-display')).toBeVisible()
  })
})
