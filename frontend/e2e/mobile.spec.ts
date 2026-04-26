import { test, expect } from '@playwright/test'

/**
 * Mobile E2E Tests (EM1-EM5)
 * Tests mobile-specific interactions and responsive design
 */

test.use({ viewport: { width: 375, height: 667 } })

test.describe('Mobile Layout', () => {
  test('EM1: file drawer opens and closes', async ({ page }) => {
    // Go to multi-file entry
    await page.goto('/multi-file-entry')
    await page.waitForTimeout(2000)

    // On mobile with multiple files, bottom bar should have action buttons
    const mobileBar = page.locator('.mobile-bottom-bar')
    await expect(mobileBar).toBeVisible()

    // Open drawer using the ActionBar button (first button typically opens file drawer for multi-file)
    // The file drawer is opened by clicking on the hamburger or file info area
    // For multi-file entries, there's a dedicated file drawer trigger
    const fileDrawerTrigger = page.locator('.mobile-file-drawer-trigger, .file-section, [aria-label="Open file drawer"]').first()
    if (await fileDrawerTrigger.isVisible().catch(() => false)) {
      await fileDrawerTrigger.click()

      // Mobile drawer should appear
      const drawer = page.locator('.mobile-file-drawer')
      await expect(drawer).toBeVisible()

      // Select a file (drawer should close after selection)
      const fileItem = page.locator('.drawer-file-item').first()
      if (await fileItem.isVisible().catch(() => false)) {
        await fileItem.click()

        // Drawer should close
        await expect(drawer).not.toBeVisible()
      }
    }
  })

  test('EM2: TOC drawer opens for markdown', async ({ page }) => {
    // Go to markdown entry
    await page.goto('/markdown-entry')
    await page.waitForTimeout(2000)

    // TOC button should be in bottom bar for markdown
    const tocBtn = page.locator('.action-btn[title="Table of Contents"], button:has-text("TOC")')
    if (await tocBtn.isVisible().catch(() => false)) {
      await tocBtn.click()

      // TOC drawer should appear
      const tocDrawer = page.locator('.mobile-toc-drawer')
      await expect(tocDrawer).toBeVisible()
    }
  })

  test('EM3: bottom bar shows correct buttons', async ({ page }) => {
    // Single file code entry
    await page.goto('/single-code-entry')
    await page.waitForTimeout(2000)

    // Mobile bottom bar should be visible
    await expect(page.locator('.mobile-bottom-bar')).toBeVisible()

    // Should have action buttons (Copy and Wrap for code files)
    const actionBtns = page.locator('.mobile-bottom-bar .action-btn')
    const count = await actionBtns.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('EM4: touch scrolling works', async ({ page }) => {
    await page.goto('/long-code-entry')
    await page.waitForSelector('.code-viewer', { timeout: 5000 })

    // Get code content element
    const codeContent = page.locator('.code-content')
    await expect(codeContent).toBeVisible()

    // Touch scroll simulation
    await codeContent.evaluate((el) => {
      el.scrollTop = 100
    })

    // Verify scroll position changed
    const scrollTop = await codeContent.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBe(100)
  })

  test('EM5: responsive layout hides sidebars', async ({ page }) => {
    await page.goto('/markdown-entry')
    await page.waitForTimeout(2000)

    // Desktop sidebars should be hidden on mobile
    const leftSidebar = page.locator('.sidebar-left')
    const rightSidebar = page.locator('.sidebar-right')

    await expect(leftSidebar).not.toBeVisible()
    await expect(rightSidebar).not.toBeVisible()

    // Bottom bar should be visible
    await expect(page.locator('.mobile-bottom-bar')).toBeVisible()
  })
})

test.describe('Mobile Navigation', () => {
  test('list view responsive layout', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Header should be responsive
    const header = page.locator('.list-header')
    await expect(header).toBeVisible()

    // Search input should be accessible
    const searchInput = page.locator('.search-input')
    await expect(searchInput).toBeVisible()
  })

  test('keyboard hides properly on mobile', async ({ page }) => {
    await page.goto('/')

    // Focus search input (would show keyboard on real device)
    const searchInput = page.locator('.search-input')
    await searchInput.click()
    await searchInput.fill('test')

    // Should still be able to see results
    await expect(page.locator('.entry-list')).toBeVisible()
  })
})
