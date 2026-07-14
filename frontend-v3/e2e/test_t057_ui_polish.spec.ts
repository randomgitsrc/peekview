/**
 * T057 UI/UX Polish — Playwright E2E tests
 *
 * RED TESTS: All tests should fail with current implementation.
 *
 * Viewports: desktop=1280×800, mobile=390×844
 */

import { test, expect } from '@playwright/test'

test.describe('T057 UI/UX Polish', () => {
  test.beforeEach(async ({ page }) => {
    // Create an entry to test with
    await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-ui-polish-test',
        summary: 'E2E UI Polish Test Entry',
        files: [{ filename: 'test.md', content: '# Hello' }],
      },
    })
  })

  test.describe('Desktop (1280x800)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
    })

    test('TC01: OverflowMenu is opaque and aligned', async ({ page }) => {
      await page.goto('/#/entry/e2e-ui-polish-test')
      const trigger = page.locator('.overflow-trigger')
      await trigger.click()
      const menu = page.locator('.overflow-dropdown')
      await expect(menu).toBeVisible()

      // Verify opaque background
      const bgColor = await menu.evaluate((el) => getComputedStyle(el).backgroundColor)
      // Expect not transparent (rgba alpha != 0 or not 'transparent')
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(bgColor).not.toBe('transparent')

      await page.screenshot({ path: 'docs/tasks/T057-ui-ux-polish/evidences/desktop_1280x800.png' })
    })

    test('TC02: ShareManagementPanel popover interaction', async ({ page }) => {
      await page.goto('/#/entry/e2e-ui-polish-test')
      // Assuming Share button is in overflow or header
      await page.locator('.overflow-trigger').click()
      await page.locator('text=Share').click()

      const panel = page.locator('.share-panel')
      await expect(panel).toBeVisible()

      // Verify state: no link
      await expect(panel.locator('text=Generate Link')).toBeVisible()
      await panel.locator('text=Generate Link').click()

      // Verify state: has link
      await expect(panel.locator('.share-link-input')).toBeVisible()
      await panel.locator('text=Revoke').click()
      await expect(panel.locator('text=Generate Link')).toBeVisible()
    })
  })

  test.describe('Mobile (390x844)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
    })

    test('TC03: Mobile Teleport mask z-index', async ({ page }) => {
      await page.goto('/#/entry/e2e-ui-polish-test')
      // Open something that uses teleport + mask
      await page.locator('.overflow-trigger').click()
      
      const mask = page.locator('.teleport-mask')
      await expect(mask).toBeVisible()

      // Verify z-index is high
      const zIndex = await mask.evaluate((el) => getComputedStyle(el).zIndex)
      expect(parseInt(zIndex, 10)).toBeGreaterThan(100)

      await page.screenshot({ path: 'docs/tasks/T057-ui-ux-polish/evidences/mobile_390x844.png' })
    })
  })
})
