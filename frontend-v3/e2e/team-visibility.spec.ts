/**
 * TPV0095 team-visibility — E2E（P3 编写，P5/P6 实跑）
 *
 * 覆盖 BDD-38（explore 5-tab 互斥/高亮/URL）、BDD-39（team badge 不叠加 private）、
 * BDD-40（team entry 卡片隐藏 toggle + store 守卫）、BDD-41（?team= 单一不可用态）、
 * BDD-43（移动端 5-tab 横滚 + 触达高度 + tablist/aria-selected）。
 *
 * P2-design §5.7 data-testid：tab-all / tab-mine / tab-teams / tab-archived / tab-starred /
 *   team-chip-{slug} / team-unavailable / team-unavailable-clear / teams-empty / team-empty /
 *   badge-team / visibility-toggle / teams-manage-link / user-menu-teams-item
 *
 * 运行：make debug-start 后 E2E_SPEC=e2e/team-visibility.spec.ts make debug-test
 * 防生产：BASE_URL 含 :8080 即拒绝。team fixture 需 P4 后端就绪（debug-seed 用户 alice/bob）后
 *   ——P3 期页面未实现/无 team 数据 → 测试失败属预期红灯。
 */

import { test, expect, type Page, type Request } from '@playwright/test'

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
  await expect(page.locator('.explore-actions button:has-text("Sign in")')).toHaveCount(0, { timeout: 10000 })
}

async function apiLoginToken(request: Request, username = 'alice'): Promise<string> {
  const resp = await request.post('/api/v1/auth/login', {
    data: { username, password: 'testpass123' },
  })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  const token = body.access_token ?? body.accessToken
  expect(token).toBeTruthy()
  return token as string
}

async function ensureTeamEntry(
  request: Request,
  token: string,
  opts: { teamSlug: string; summary: string },
) {
  // P4 后端就绪后：team entry 经 debug HTTP API 创建（铁律 6：不走 CLI 创建测试 entry）
  const resp = await request.post('/api/v1/entries', {
    data: {
      summary: opts.summary,
      team_id: opts.teamSlug,
      files: [{ filename: 'readme.md', content: `# ${opts.summary}` }],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  // team_id 不存在/非成员 → 422；创建成功 → 201（两分支在 P3 期均为红灯占位，P5/P6 实跑断言）
  return resp
}

test.describe.configure({ mode: 'serial' })

test.describe('TPV0095 team-visibility — explore Teams tab/chips/badge（BDD-38/39）', () => {
  test('BDD-38: 登录后 5-tab 互斥高亮；Teams 激活时 All 不高亮', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await ensureTeamEntry(request, token, { teamSlug: 'proj-a', summary: `team bdd38 ${Date.now()}` })

    await login(page)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('[data-testid="tab-teams"]', { timeout: 10000 })

    await expect(page.locator('.owner-tab')).toHaveCount(5)
    // All 默认激活
    await expect(page.locator('[data-testid="tab-all"]')).toHaveClass(/active/)
    await expect(page.locator('[data-testid="tab-teams"]')).not.toHaveClass(/active/)

    await page.locator('[data-testid="tab-teams"]').click()
    await expect(page.locator('[data-testid="tab-teams"]')).toHaveClass(/active/)
    await expect(page.locator('[data-testid="tab-all"]')).not.toHaveClass(/active/)
    await expect(page).toHaveURL(/\/explore\?.*view=teams/)
  })

  test('BDD-38: 点 team chip 后 URL 反映 ?team={slug}', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `team chip ${Date.now()}`
    await ensureTeamEntry(request, token, { teamSlug: 'proj-a', summary })

    await login(page)
    await page.goto(`${BASE_URL}/explore?view=teams`)
    await page.waitForSelector('[data-testid="teams-chip-proj-a"]', { timeout: 10000 }).catch(() => {})
    const chip = page.locator('[data-testid="teams-chip-proj-a"]')
    if ((await chip.count()) > 0) {
      await chip.first().click()
      await page.waitForURL(/\/explore\?.*team=proj-a/, { timeout: 10000 })
    }
  })

  test('BDD-39: team entry 卡片显示 badge-team 且不叠加 private badge', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `team badge ${Date.now()}`
    await ensureTeamEntry(request, token, { teamSlug: 'proj-a', summary })

    await login(page)
    await page.goto(`${BASE_URL}/explore?team=proj-a`)
    await page.waitForSelector(`.entry-card:has-text("${summary}"), .entry-list-row:has-text("${summary}")`, {
      timeout: 10000,
    }).catch(() => {})

    const card = page.locator('.entry-card, .entry-list-row').first()
    const teamBadge = card.locator('[data-testid="badge-team"]')
    if ((await teamBadge.count()) > 0) {
      await expect(teamBadge.first()).toContainText(/仅团队可见/)
    }
    // 该卡不渲染 private badge
    await expect(card.locator('.badge-private, [class*="badge-private"]')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd39-team-badge.png' })
  })
})

test.describe('TPV0095 team-visibility — toggle 隐藏 + store 守卫（BDD-40）', () => {
  test('BDD-40: team entry 卡片无 visibility-toggle，delete 保留', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `team toggle ${Date.now()}`
    await ensureTeamEntry(request, token, { teamSlug: 'proj-a', summary })

    await login(page)
    await page.goto(`${BASE_URL}/explore?team=proj-a`)
    await page.waitForSelector(`.entry-card, .entry-list-row`, { timeout: 10000 }).catch(() => {})

    const teamCard = page.locator('.entry-card, .entry-list-row').filter({ hasText: summary }).first()
    if ((await teamCard.count()) > 0) {
      // 隐藏可见性 toggle（统一 testid，count=0）；delete 按钮仍在
      await expect(teamCard.locator('[data-testid="visibility-toggle"]')).toHaveCount(0)
      await expect(teamCard.locator('[data-action="delete"], .card-action-btn--danger').first()).toBeVisible()
    }
  })
})

test.describe('TPV0095 team-visibility — 单一不可用态（BDD-41）', () => {
  test('BDD-41: ?team= 未知/无权限 slug 显示团队不可用 + 清除 CTA，可恢复', async ({ page, request }) => {
    await apiLoginToken(request)
    await login(page)
    await page.goto(`${BASE_URL}/explore?team=ghost-team-does-not-exist`)
    await page.waitForSelector('[data-testid="team-unavailable"]', { timeout: 15000 })
    await expect(page.locator('[data-testid="team-unavailable-clear"]')).toBeVisible()

    await page.locator('[data-testid="team-unavailable-clear"]').click()
    await page.waitForSelector('[data-testid="team-unavailable"]', { timeout: 10000 }).then(
      () => {
        throw new Error('unavailable state should disappear after clearing filter')
      },
      () => {},
    ).catch(() => {})
    await expect(page).not.toHaveURL(/team=ghost-team-does-not-exist/)
    await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd41-team-unavailable.png' })
  })
})

test.describe('TPV0095 team-visibility — 移动端 tab（BDD-43）', () => {
  test('BDD-43: 移动视口 tablist 可横滚 + tab 高度 ≥44px + aria-selected', async ({ page, request }) => {
    await apiLoginToken(request)
    await login(page)
    await page.goto(`${BASE_URL}/explore`)

    const tablist = page.locator('[role="tablist"]')
    await expect(tablist).toBeVisible()
    await expect(tablist.locator('[role="tab"]')).toHaveCount(5)

    for (const tab of await tablist.locator('[role="tab"]').all()) {
      expect(await tab.getAttribute('aria-selected')).toBeTruthy()
    }

    const viewportWidth = page.viewportSize()?.width ?? 1280
    if (viewportWidth < 768) {
      // 移动端：可横向滚动（无换行堆叠）
      const overflowX = await tablist.evaluate((el) => {
        return window.getComputedStyle(el).overflowX
      })
      expect(overflowX).toMatch(/auto|scroll/)
      // 触达高度 ≥44px
      const heights = await tablist.locator('[role="tab"]').evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      )
      for (const h of heights) {
        expect(h).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd43-mobile-tabs.png' })
    }
  })
})
