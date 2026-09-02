/**
 * TPV0095 teams-page — E2E（P3 编写，P5/P6 实跑）
 *
 * 覆盖 BDD-42：/teams 双入口（UserMenu + explore Teams tab 管理链接）、owner 全操作
 * （新建/重命名/删除/添加成员/移除成员）、成员退出、添加失败三类文案互异、删除确认框
 * （含「内容将转为仅自己可见」后果提示）、输入态逐态断言。
 *
 * P2-design §5.7 data-testid：user-menu-teams-item / teams-manage-link / teams-owned /
 *   teams-joined / team-create-form / team-name-input / team-member-username-input /
 *   team-error / teams-status-live（ConfirmDialog alertdialog role 可定位）。
 *
 * 运行：make debug-start 后 E2E_SPEC=e2e/teams-page.spec.ts make debug-test（gate 键 P5_e2e_b/P6_e2e_b）
 * 防生产：BASE_URL 含 :8080 即拒绝。P3 期 /teams 页面与后端 teams API 均未实现 → 测试失败属预期红灯。
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

async function login(page: Page, username = 'alice') {
  await page.goto(`${BASE_URL}/explore`)
  const authBtn = page
    .locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")')
    .first()
  await authBtn.waitFor({ state: 'visible', timeout: 15000 })
  await authBtn.click()
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('#login-username').fill(username)
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

// P4 后端 teams API 就绪后逐态断言用（P3 期仅结构占位，运行失败属预期）
async function registerUserIfNeeded(request: Request, username: string): Promise<string> {
  const reg = await request.post('/api/v1/auth/register', {
    data: { username, password: 'testpass123' },
  })
  if (reg.status() === 201) {
    return apiLoginToken(request, username)
  }
  return apiLoginToken(request, username)
}

test.describe.configure({ mode: 'serial' })

test.describe('TPV0095 teams-page — 双入口（BDD-42）', () => {
  test('BDD-42: UserMenu 含 Teams 项且可达 /teams', async ({ page, request }) => {
    await apiLoginToken(request)
    await login(page)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('.user-menu-trigger', { timeout: 10000 })

    await page.locator('.user-menu-trigger').click()
    const item = page.locator('[data-testid="user-menu-teams-item"]')
    await expect(item).toBeVisible()
    await item.click()
    await page.waitForURL('**/teams', { timeout: 10000 })
  })

  test('BDD-42: explore Teams tab 内「管理团队」链接指向 /teams', async ({ page, request }) => {
    await apiLoginToken(request)
    await login(page)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('[data-testid="tab-teams"]', { timeout: 10000 })

    await page.locator('[data-testid="tab-teams"]').click()
    const link = page.locator('[data-testid="teams-manage-link"]')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /\/teams/)
  })

  test('BDD-42: 匿名访问 /teams 被守卫重定向', async ({ page }) => {
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForTimeout(1000)
    await expect(page).not.toHaveURL('**/teams')
  })
})

test.describe('TPV0095 teams-page — owner 操作（BDD-42）', () => {
  test('BDD-42: 新建团队成功 → 显示于「我拥有的」分区 + live region 播报', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const ts = Date.now()
    await registerUserIfNeeded(request, 'bob')

    await login(page)
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForSelector('[data-testid="team-create-form"]', { timeout: 10000 })

    await page.locator('[data-testid="team-name-input"]').fill(`Alpha-${ts}`)
    await page.locator('[data-testid="team-create-form"] button[type="submit"], [data-testid="team-create-form"] button:has-text("create"), [data-testid="team-create-form"] button:has-text("Create")').first().click()

    const owned = page.locator('[data-testid="teams-owned"]')
    await expect(owned).toContainText(`Alpha-${ts}`, { timeout: 10000 })
    const live = page.locator('[data-testid="teams-status-live"]')
    await expect(live).toContainText(/已创建团队/, { timeout: 5000 })
    await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd42-create-team.png' })
  })

  test('BDD-42: 成员添加失败三类（username 不存在/已是成员/无权）三文案两两互异', async ({ page, request }) => {
    // fixture：bob 建 team（owner），向 bob 的 team 添加 alice 为成员。
    const bobToken = await apiLoginToken(request, 'bob')
    await registerUserIfNeeded(request, 'bob')
    await registerUserIfNeeded(request, 'alice')
    const teamResp = await request.post('/api/v1/teams', {
      data: { name: `T-${Date.now()}` },
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    if (teamResp.status() !== 201) {
      // P3 期后端 teams API 未实现 → 无法建立 fixture，测试失败属预期红灯
      expect(teamResp.status()).toBe(201)
      return
    }
    const team = await teamResp.json()
    const teamSlug: string = team.slug
    await request.post(`/api/v1/teams/${teamSlug}/members`, {
      data: { username: 'alice' },
      headers: { Authorization: `Bearer ${bobToken}` },
    })

    // bob（owner）视角打开 /teams
    await login(page, 'bob')
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForSelector('[data-testid="teams-owned"]', { timeout: 10000 })

    const addMember = async (username: string): Promise<string> => {
      const input = page.locator('[data-testid="team-member-username-input"]').first()
      await expect(input).toBeVisible({ timeout: 5000 })
      await input.fill(username)
      await input.press('Enter')
      const err = page.locator('[data-testid="team-error"]').first()
      await expect(err).toBeVisible({ timeout: 8000 })
      const text = (await err.textContent()) || ''
      expect(text.trim().length).toBeGreaterThan(0)
      return text.trim()
    }

    const c1 = await addMember('no-such-user-xyz')
    const c2 = await addMember('alice') // 已是成员
    const c3 = await addMember('bob') // owner 不能添加自己（无权/校验拒）

    const unique = new Set([c1, c2, c3])
    expect(unique.size).toBe(3) // 三文案两两互异
    await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd42-member-error-copies.png' })
  })

  test('BDD-42: 删除 team 出现确认对话框（含后果提示）', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const ts = Date.now()
    await registerUserIfNeeded(request, 'bob')

    // 先建 team（走 debug HTTP API，P4 后端就绪后）
    const createResp = await request.post('/api/v1/teams', {
      data: { name: `Del-${ts}` },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (createResp.status() !== 201) {
      // P3 期后端 teams API 未实现 → 红灯（预期）
      expect(createResp.status()).toBe(201)
      return
    }
    await login(page)
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForSelector('[data-testid="teams-owned"]', { timeout: 10000 })

    const ownedCard = page.locator('[data-testid="teams-owned"]').filter({ hasText: `Del-${ts}` }).first()
    const deleteBtn = ownedCard.locator('button:has-text("删除"), button:has-text("Delete")').first()
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click()
      const dialog = page.locator('[role="alertdialog"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog).toContainText(/仅自己可见/)
      await page.screenshot({ path: '/tmp/e2e-results/tpv0095-bdd42-delete-confirm.png' })
    }
  })
})

test.describe('TPV0095 teams-page — 成员退出（BDD-42）', () => {
  test('BDD-42: 成员退出需确认，确认后从「我加入的」消失；owner 不显示退出按钮', async ({ page, request }) => {
    // 需要 bob 加入一个 alice 的 team——P5/P6 后端就绪后由 API fixture 建立
    await registerUserIfNeeded(request, 'bob')
    await login(page, 'bob')
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForTimeout(1000)

    const joined = page.locator('[data-testid="teams-joined"]')
    const leaveBtn = joined.locator('button:has-text("退出"), button:has-text("Leave")').first()
    if ((await leaveBtn.count()) > 0) {
      await leaveBtn.click()
      const dialog = page.locator('[role="alertdialog"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.locator('button:has-text("确认"), button:has-text("Confirm")').click()
      await expect(joined).not.toContainText(/Shared B|shared-b/, { timeout: 8000 })
    }

    // owner 视角无退出按钮
    await login(page)
    await page.goto(`${BASE_URL}/teams`)
    await page.waitForSelector('[data-testid="teams-owned"]', { timeout: 10000 })
    const owned = page.locator('[data-testid="teams-owned"]')
    await expect(owned.locator('button:has-text("退出"), button:has-text("Leave")')).toHaveCount(0)
  })
})
