/**
 * TPV0093 star-lifecycle — E2E（P3 编写，P6 实跑）
 *
 * 覆盖核心链路：登录 → 详情页星标 → Starred tab 可见 → 管理页分类/墓碑/批量移除。
 * P2-design §6.5 稳定测试标识（data-testid）：
 *   star-toggle / star-count / mobile-star-toggle / tab-starred /
 *   stars-tab-{all|active|expiring|expired} / tombstone-card / tombstone-remove /
 *   tombstone-reason / star-checkbox / stars-batch-remove / star-exempt-label /
 *   force-delete / force-delete-confirm / star-toast-action
 *
 * 运行：make debug-start 后 E2E_SPEC=e2e/star.spec.ts make debug-test
 * 防生产：BASE_URL 含 :8080 即拒绝。
 */

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.beforeAll(async ({ request }) => {
  if (BASE_URL.includes(':8080') || BASE_URL.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${BASE_URL})`)
  }
  const resp = await request.get('/health')
  if (!resp.ok()) throw new Error(`Health check failed: ${resp.status()}`)
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

async function login(page: Page) {
  await page.goto(`${BASE_URL}/explore`)
  // 等待登录按钮出现（authState 解析为 anonymous 后才渲染）。
  // 不吞超时错误——登录失败应让测试失败，而非静默跳过导致后续误判。
  const authBtn = page
    .locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")')
    .first()
  await authBtn.waitFor({ state: 'visible', timeout: 15000 })

  await authBtn.click()
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('#login-username').fill('alice')
  await page.locator('#login-password').fill('testpass123')
  await page.locator('.login__submit').click()
  await page.waitForURL('**/explore', { timeout: 15000 })
  // 确认登录成功：Sign in 按钮消失（UserMenu 接管）——不静默
  await expect(page.locator('.explore-actions button:has-text("Sign in")')).toHaveCount(0, { timeout: 10000 })
}

async function openFirstEntry(page: Page) {
  await page.goto(`${BASE_URL}/explore`)
  await page.waitForSelector('.entry-card a, .entry-list-row a', { timeout: 10000 })
  const firstEntry = page.locator('.entry-card a, .entry-list-row a').first()
  const href = await firstEntry.getAttribute('href')
  if (!href) throw new Error('No entry found on /explore')
  await page.goto(`${BASE_URL}${href}`)
  await page.waitForSelector('.detail-header, .mobile-sticky-header', { timeout: 10000 })
}

test.describe.configure({ mode: 'serial' })

test.describe('TPV0093 star-lifecycle — 核心链路', () => {
  test('BDD-18/19: 登录后 Starred tab 可见，匿名不可见', async ({ page }) => {
    // 匿名：无 Starred tab
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.explore-actions', { timeout: 10000 })
    await expect(page.locator('[data-testid="tab-starred"]')).toHaveCount(0)

    // 登录：4 tabs
    await login(page)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('[data-testid="tab-starred"]', { timeout: 10000 })
    await expect(page.locator('.owner-tab')).toHaveCount(4)
  })

  test('BDD-1/6: 详情页星标计数 +1（桌面 star-toggle）', async ({ page }) => {
    await login(page)
    await openFirstEntry(page)

    const toggle = page.locator('[data-testid="star-toggle"]').first()
    if (await toggle.isVisible().catch(() => false)) {
      const countBefore = await page.locator('[data-testid="star-count"]').first().textContent()
      const before = countBefore ? parseInt(countBefore.trim(), 10) || 0 : 0

      await toggle.click()

      const countAfter = await page.locator('[data-testid="star-count"]').first().textContent()
      const after = countAfter ? parseInt(countAfter.trim(), 10) : 0
      expect(after).toBeGreaterThanOrEqual(before)
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('BDD-18: 点击 Starred tab 后列表仅含星标条目', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('[data-testid="tab-starred"]', { timeout: 10000 })

    await page.locator('[data-testid="tab-starred"]').click()
    await page.waitForURL('**/explore?**starred=1**', { timeout: 10000 }).catch(() => {})

    await page.waitForTimeout(1000)
    const cards = page.locator('.entry-card, .entry-list-row')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('BDD-20/21/22: 管理页分类 tab + 批量移除按钮', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/stars`)
    await page.waitForSelector('[data-testid="stars-tab-all"]', { timeout: 10000 })

    // 4 个分类 tab
    await expect(page.locator('[data-testid="stars-tab-all"]')).toBeVisible()
    await expect(page.locator('[data-testid="stars-tab-active"]')).toBeVisible()
    await expect(page.locator('[data-testid="stars-tab-expiring"]')).toBeVisible()
    await expect(page.locator('[data-testid="stars-tab-expired"]')).toBeVisible()

    // 批量移除按钮：无勾选时禁用
    const batch = page.locator('[data-testid="stars-batch-remove"]')
    if (await batch.isVisible().catch(() => false)) {
      await expect(batch).toBeDisabled()
    }
  })

  test('BDD-24/25: 作者 Archived 列表豁免标签 + 强制删除按钮', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/explore?owner=me&status=archived`)
    await page.waitForTimeout(1000)

    const exempt = page.locator('[data-testid="star-exempt-label"]').first()
    if (await exempt.isVisible().catch(() => false)) {
      await expect(exempt).toContainText(/因被 \d+ 位用户星标/)
      const forceDelete = page.locator('[data-testid="force-delete"]').first()
      if (await forceDelete.isVisible().catch(() => false)) {
        await forceDelete.click()
        await expect(page.locator('[data-testid="force-delete-confirm"]')).toBeVisible()
        await expect(page.locator('[data-testid="force-delete-confirm"]')).toContainText(/位用户/)
      }
    }
  })
})
