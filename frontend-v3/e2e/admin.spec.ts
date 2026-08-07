import { test, expect } from '@playwright/test'

// T086: admin/settings 信息架构收敛
//
// 原 /admin 独立路由已删除，用户管理功能迁移为 /settings?tab=user-manager
// 的第 4 个 tab。本文件原地迁移原 8 个 test()：
//   BDD-01/02/06/12/20/21 → URL 换成 /settings?tab=user-manager，
//     内部 data-testid 不变（迁移基线：P2-design.md §3.5/§3.3）。
//   BDD-14/BDD-15 → 语义重写：/admin 不再重定向，一律 404
//     （BDD-14 ≈ T086 BDD-9，BDD-15 ≈ T086 BDD-10）。
// 新增（P2-design.md §3.5 + P1-requirements.md 入口发现/路由删除条款）：
//   T086 BDD-07（未登录访问 user-manager tab 复用既有 /settings 守卫）
//   T086 BDD-08（admin 访问 /admin 也是 404，路由对所有角色一律删除）
//   T086 BDD-11/12（UserMenu 入口，admin 落地 user-manager / 非 admin 无新增入口）
//
// 注意：新增的 T086 BDD-11/BDD-12 与本文件既有的 legacy "BDD-12: reset password
// dialog" 编号冲突（两套编号体系不同源：legacy 编号来自更早的 T080 任务目录，
// T086 BDD-11/12 来自本任务 P1-requirements.md 的入口发现小节）。为避免歧义，
// 新增用例一律加 "T086 BDD-NN" 前缀，legacy 用例保留原编号不变。
//
// P2-review.md Advisory Note #1：UserManagerTab 会在 SettingsView.vue 中被桌面
// tab-content（v-else-if）与移动端 mobile-stacked（v-if="isAdmin"）同时挂载两份，
// data-testid="admin-user-row" 等选择器会匹配到 2 倍数量的 DOM 节点。含
// count()/toHaveCount 的断言（至少 BDD-01）以及所有交互类选择器（行/菜单触发器/
// 列表容器）统一比照 raw-api.spec.ts:38 用 .desktop-only/.mobile-only 限定选择器。

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

async function nonAdminLogin(page: import('@playwright/test').Page) {
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
}

function scopeOf(vpName: string): '.desktop-only' | '.mobile-only' {
  return vpName === 'desktop' ? '.desktop-only' : '.mobile-only'
}

test.describe.configure({ mode: 'serial' })

test.describe('T086 (migrated from T080): Admin user management via /settings?tab=user-manager', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} viewport (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
      })

      test(`BDD-01: admin sees paginated user list on user-manager tab [${vp.name}] (T086 BDD-1)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-list, ${scope} [data-testid="admin-user-list"]`, { timeout: 10000 })

        const rows = page.locator(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`)
        await expect(rows.first()).toBeVisible({ timeout: 10000 })
        const count = await rows.count()
        expect(count).toBeGreaterThan(0)
        expect(count).toBeLessThanOrEqual(20)

        const pagination = page.locator(`${scope} .pagination, ${scope} [data-testid="pagination"]`)
        if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(pagination).toBeVisible()
        }
      })

      test(`BDD-02: user list shows status badges [${vp.name}] (T086 BDD-1)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`, { timeout: 10000 })

        const badges = page.locator(`${scope} .badge, ${scope} [data-testid="user-badge"]`)
        await expect(badges.first()).toBeVisible({ timeout: 10000 })
        const badgeTexts = await badges.allTextContents()
        const joined = badgeTexts.join(' ').toLowerCase()
        expect(joined).toMatch(/active|disabled|admin/)
      })

      test(`BDD-06: admin cannot disable self [${vp.name}] (T086 BDD-3)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`, { timeout: 10000 })

        const selfRow = page.locator(`${scope} .admin-user-row:has-text("alice"), ${scope} [data-testid="admin-user-row"]:has-text("alice")`).first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const disableItem = page.locator('[role="menuitem"]:has-text("禁用")').first()
        if (await disableItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await disableItem.click()
          const confirmBtn = page.locator('[role="alertdialog"] button:has-text("禁用")').first()
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click()
          }
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot|不能|无法|自己/)
        }
      })

      test(`BDD-12: reset password dialog [${vp.name}] (T086 BDD-2)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`, { timeout: 10000 })

        const targetRow = page.locator(`${scope} .admin-user-row:has-text("bob"), ${scope} [data-testid="admin-user-row"]:has-text("bob")`).first()
        if (await targetRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          const menuTrigger = targetRow.locator('[data-testid="overflow-menu-trigger"]').first()
          await menuTrigger.click()
          const resetItem = page.locator('[role="menuitem"]:has-text("重置密码")').first()
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

      test(`BDD-20: admin cannot demote self [${vp.name}] (T086 BDD-3)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`, { timeout: 10000 })

        const selfRow = page.locator(`${scope} .admin-user-row:has-text("alice"), ${scope} [data-testid="admin-user-row"]:has-text("alice")`).first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const demoteItem = page.locator('[role="menuitem"]:has-text("降级")').first()
        if (await demoteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await demoteItem.click()
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot|不能|无法|自己/)
        }
      })

      test(`BDD-21: admin cannot delete self [${vp.name}] (T086 BDD-3)`, async ({ page }) => {
        await adminLogin(page)
        await page.goto(`${BASE_URL}/settings?tab=user-manager`)
        const scope = scopeOf(vp.name)
        await page.waitForSelector(`${scope} .admin-user-row, ${scope} [data-testid="admin-user-row"]`, { timeout: 10000 })

        const selfRow = page.locator(`${scope} .admin-user-row:has-text("alice"), ${scope} [data-testid="admin-user-row"]:has-text("alice")`).first()
        await expect(selfRow).toBeVisible({ timeout: 10000 })

        const menuTrigger = selfRow.locator('.overflow-menu-trigger, [data-testid="overflow-menu-trigger"]').first()
        await menuTrigger.click()

        const deleteItem = page.locator('[role="menuitem"]:has-text("删除")').first()
        if (await deleteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deleteItem.click()
          const confirmBtn = page.locator('[role="alertdialog"] button:has-text("删除")').first()
          if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click()
          }
          const toast = page.locator('.toast, [role="status"]')
          await expect(toast.first()).toBeVisible({ timeout: 5000 })
          const toastText = (await toast.first().textContent())?.toLowerCase() || ''
          expect(toastText).toMatch(/self|yourself|error|cannot|不能|无法|自己/)
        }
      })
    })
  }

  test('BDD-14 (legacy label, rewritten → T086 BDD-9): non-admin visiting /admin gets 404, no redirect', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await nonAdminLogin(page)

    await page.goto(`${BASE_URL}/admin`)
    await page.waitForSelector('.not-found', { timeout: 10000 })
    expect(page.url()).toContain('/admin')
    await expect(page.locator('.not-found')).toBeVisible()
  })

  test('BDD-15 (legacy label, rewritten → T086 BDD-10): unauthenticated visiting /admin gets 404, no redirect', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/admin`)
    await page.waitForSelector('.not-found', { timeout: 10000 })
    expect(page.url()).toContain('/admin')
    await expect(page.locator('.not-found')).toBeVisible()
  })

  test('T086 BDD-08: admin visiting /admin also gets 404 (route removed for every role)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await adminLogin(page)

    await page.goto(`${BASE_URL}/admin`)
    await page.waitForSelector('.not-found', { timeout: 10000 })
    expect(page.url()).toContain('/admin')
    await expect(page.locator('.not-found')).toBeVisible()
  })

  test('T086 BDD-07: unauthenticated visiting /settings?tab=user-manager redirected to / (reuses existing /settings guard)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/settings?tab=user-manager`)
    await page.waitForURL('**/', { timeout: 10000 })
    expect(page.url()).toMatch(/\/$/)
  })

  test('T086 BDD-11: admin reaches user-manager via UserMenu Settings entry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await adminLogin(page)

    await page.locator('.user-menu-trigger').click()
    await page.locator('[data-testid="user-menu-settings-item"]').click()
    await page.waitForURL('**/settings?tab=user-manager', { timeout: 10000 })
    await expect(page.locator('.desktop-only [data-testid="user-manager-content"]')).toBeVisible({ timeout: 10000 })
  })

  test('T086 BDD-12: non-admin UserMenu Settings entry does not land on user-manager tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await nonAdminLogin(page)

    await page.locator('.user-menu-trigger').click()
    const dropdown = page.locator('.user-dropdown')
    await expect(dropdown).toBeVisible()
    const menuText = (await dropdown.textContent()) || ''
    expect(menuText).not.toMatch(/用户管理/)

    await page.locator('[data-testid="user-menu-settings-item"]').click()
    await page.waitForURL('**/settings?tab=apikeys', { timeout: 10000 })
    expect(page.url()).not.toContain('tab=user-manager')
  })
})
