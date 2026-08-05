import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

test.beforeAll(async ({ request }) => {
  if (BASE_URL.includes(':8080') || BASE_URL.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${BASE_URL})`)
  }
  const resp = await request.get(`${BASE_URL}/health`)
  if (!resp.ok()) throw new Error(`Health check failed: ${resp.status()}`)
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/explore`)
  await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

  const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
  const loginBtn = page.locator('.explore-actions button:has-text("Login")')
  const btn = (await signInBtn.count()) > 0 ? signInBtn : loginBtn

  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
    await page.locator('.login-dialog').waitFor({ state: 'visible' })
    await page.locator('#login-username').fill('alice')
    await page.locator('#login-password').fill('testpass123')
    await page.locator('.login__submit').click()
    await page.waitForURL('**/explore', { timeout: 10000 })
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('T080: Admin user management', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} viewport (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
      })

      test(`BDD-01: admin sees paginated user list on /admin [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-list, [data-testid="admin-user-list"]', { timeout: 10000 })

        const rows = page.locator('.admin-user-row, [data-testid="admin-user-row"]')
        await expect(rows.first()).toBeVisible({ timeout: 10000 })
        const count = await rows.count()
        expect(count).toBeGreaterThan(0)
        expect(count).toBeLessThanOrEqual(20)

        const pagination = page.locator('.pagination, [data-testid="pagination"]')
        await expect(pagination).toBeVisible()
      })

      test(`BDD-02: user list shows status badges [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-row, [data-testid="admin-user-row"]', { timeout: 10000 })

        const badges = page.locator('.badge, [data-testid="user-badge"]')
        await expect(badges.first()).toBeVisible({ timeout: 10000 })
        const badgeTexts = await badges.allTextContents()
        const joined = badgeTexts.join(' ').toLowerCase()
        expect(joined).toMatch(/active|disabled|admin/)
      })

      test(`BDD-06: admin cannot disable self [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-row, [data-testid="admin-user-row"]', { timeout: 10000 })

        const selfRow = page.locator('.admin-user-row:has-text("alice"), [data-testid="admin-user-row"]:has-text("alice")').first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const disableItem = page.locator('.overflow-menu-item:has-text("Disable"), [data-testid="menu-disable"]').first()
        if (await disableItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await disableItem.click()
          const confirmBtn = page.locator('[role="alertdialog"] button:has-text("Disable"), .confirm-dialog button:has-text("Disable")').first()
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click()
          }
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot/)
        }
      })

      test(`BDD-12: reset password dialog [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-row, [data-testid="admin-user-row"]', { timeout: 10000 })

        const targetRow = page.locator('.admin-user-row:has-text("bob"), [data-testid="admin-user-row"]:has-text("bob")').first()
        if (await targetRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          const menuTrigger = targetRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
          await menuTrigger.click()
          const resetItem = page.locator('.overflow-menu-item:has-text("Reset"), [data-testid="menu-reset-password"]').first()
          await resetItem.click()

          const dialog = page.locator('[role="alertdialog"]')
          await expect(dialog).toBeVisible({ timeout: 5000 })
          await expect(dialog).toHaveAttribute('aria-labelledby', /.+/)

          const pwdInput = dialog.locator('input[type="password"], input[autocomplete="new-password"]').first()
          await expect(pwdInput).toBeVisible()
          await pwdInput.focus()

          const confirmBtn = dialog.locator('button:has-text("Confirm"), button:has-text("确认")').first()
          await expect(confirmBtn).toBeDisabled()

          await pwdInput.fill('short')
          await expect(confirmBtn).toBeDisabled()

          await pwdInput.fill('newpass123')
          await expect(confirmBtn).toBeEnabled()
        }
      })

      test(`BDD-20: admin cannot demote self [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-row, [data-testid="admin-user-row"]', { timeout: 10000 })

        const selfRow = page.locator('.admin-user-row:has-text("alice"), [data-testid="admin-user-row"]:has-text("alice")').first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const demoteItem = page.locator('.overflow-menu-item:has-text("Demote"), [data-testid="menu-demote"]').first()
        if (await demoteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await demoteItem.click()
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot/)
        }
      })

      test(`BDD-21: admin cannot delete self [${vp.name}]`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/admin`)
        await page.waitForSelector('.admin-user-row, [data-testid="admin-user-row"]', { timeout: 10000 })

        const selfRow = page.locator('.admin-user-row:has-text("alice"), [data-testid="admin-user-row"]:has-text("alice")').first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const deleteItem = page.locator('.overflow-menu-item:has-text("Delete"), [data-testid="menu-delete"]').first()
        if (await deleteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deleteItem.click()
          const confirmBtn = page.locator('[role="alertdialog"] button:has-text("Delete"), .confirm-dialog button:has-text("Delete")').first()
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click()
          }
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot/)
        }
      })
    })
  }

  test('BDD-14: non-admin redirected from /admin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/explore`)
    await page.locator('.explore-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

    const signInBtn = page.locator('.explore-actions button:has-text("Sign in")')
    const loginBtn = page.locator('.explore-actions button:has-text("Login")')
    const btn = (await signInBtn.count()) > 0 ? signInBtn : loginBtn
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await page.locator('.login-dialog').waitFor({ state: 'visible' })
      await page.locator('#login-username').fill('bob')
      await page.locator('#login-password').fill('testpass123')
      await page.locator('.login__submit').click()
      await page.waitForURL('**/explore', { timeout: 10000 })
    }

    await page.goto(`${BASE_URL}/admin`)
    await page.waitForURL('**/explore', { timeout: 10000 })
    expect(page.url()).toContain('/explore')
  })

  test('BDD-15: unauthenticated redirected from /admin to /', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/admin`)
    await page.waitForURL('**/', { timeout: 10000 })
    expect(page.url()).toMatch(/\/$/)
  })
})
