/**
 * TPV0102 — Explore 卡片/列表 UX（时间显示 / 文件数 / 可见性菜单）E2E。
 *
 * P3 编写，P5/P6 实跑。文件名**写死**：`P2-design.md §9` 的 `P5_e2e` 直接引用
 * `e2e/tpv0102-explore-card-list-ux.spec.ts`（缺文件 → Playwright `No tests found` + exit 1）。
 *
 * 覆盖 P1-requirements.md 的 30 条 BDD 中需要真实浏览器交互的部分：
 *   BDD-01/02/03  时间主显形态、悬停 tooltip 三段、详情/移动三处规则一致
 *   BDD-04        Asia/Shanghai + zh-CN 下 UTC+8 墙上时间
 *   BDD-05/06     无效时间不产生 NaN、未来时间方向
 *   BDD-13/14/15  文件数三态（1 不显示 / 0 不显示 / 3 显示 "3 files"）
 *   BDD-16/17/18  可见性菜单项排除当前态、无团队无 Team 入口、Team 子菜单排除当前团队
 *   BDD-19/20     升 Public 需二次确认、降级不弹确认
 *   BDD-21        切换失败状态回滚 + 失败提示
 *   BDD-22        非 owner 三处均无可见性入口
 *   BDD-23        详情页（桌面头部 + 移动元信息条）提供入口
 *   BDD-24        请求进行中不发出第二个 PATCH
 *   BDD-25        0 文件 entry 的专用空态
 *   BDD-26        seed 数据下 Explore 有内容且新规则生效
 *   BDD-27/28/29  Private→Team A / Team A→Team B / Team A→Private
 *   BDD-30        Escape 关闭菜单且焦点回触发入口
 *   另含 P2 UI 设计的视觉契约 VC-1~VC-7（DOM 度量）
 *
 * 纪律（P2 §6.3 + dispatch-context）：
 *   · BDD-01/02/03/26 **不得**硬编码 `GMT+8`——用 `/GMT[+-]\d/` + `/\d{4}/` 形态匹配
 *   · BDD-02 Then ③ 断言 IANA 名 **等于运行时** `Intl.DateTimeFormat().resolvedOptions().timeZone`
 *     （不写「形如 Area/City」——UTC 下该值为 `"UTC"`，不含斜杠）
 *   · tooltip 只按「自定义 DOM 元素 + `visibility` 切换 + `role="tooltip"`」断言
 *     （原生 `title` 与 CSS `::after` 的 `getByText` 命中均为 0；`opacity:0` 的 isVisible 仍为 true）
 *   · BDD-22 用 `toHaveCount(0)`（未渲染 ≠ 渲染后隐藏）
 *   · 创建型用例走清理队列：创建即 push、`afterEach` 无条件删除、接受 200/204/404
 *   · 0 文件 entry 必须现造（`POST /api/v1/entries` 空 `files`）；**禁** `peekview create`
 *     （`scripts/seed-debug.py` 对空文件目录 SKIP → `image-gallery` 不入库，不是 0 文件素材）
 *   · 双 viewport：既有 `chromium`（1280×800）与 `Mobile Chrome`（390×844）两个 project 天然覆盖
 *
 * 运行：`make debug-start` 后 `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`
 * 防生产：`BASE_URL` 含 `:8080` / `prod` 即抛错。
 */

import { test, expect, type Page, type Request, type APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

/** 形态判据（BDD-01/02/03/26 共用，不绑具体时区） */
const GMT_OFFSET = /GMT[+-]\d/
const FULL_OFFSET = /GMT[+-]\d{2}:\d{2}/
const FOUR_DIGIT_YEAR = /\d{4}/
const RELATIVE_SHAPE = /just now|\d+(m|h|d|w|mo|y) ago|in \d+(m|h|d|w|mo|y)/
const ANY_FILE_COUNT = /\d+ files?/

const SEL = {
  timeDisplay: '[data-testid="time-display"]',
  timeTooltip: '[data-testid="time-tooltip"]',
  visibilityToggle: '[data-testid="visibility-toggle"]',
  visibilityMenu: '[data-testid="visibility-menu"]',
  itemPublic: '[data-testid="visibility-item-public"]',
  itemPrivate: '[data-testid="visibility-item-private"]',
  itemTeam: '[data-testid="visibility-item-team"]',
  teamSubmenu: '[data-testid="visibility-team-submenu"]',
  emptyNoFiles: '[data-testid="empty-no-files"]',
  emptySelectFile: '[data-testid="empty-select-file"]',
  metaTagsBar: '[data-testid="meta-tags-bar"]',
  confirmDialog: '.confirm-dialog',
} as const

// ============================================================
// 清理队列：创建即注册，afterEach 无条件删除（不因响应非 2xx 中止）
// ============================================================
type Cleanup = { kind: 'entry'; slug: string; token: string } | { kind: 'team'; slug: string; token: string }

const cleanupQueue: Cleanup[] = []

function trackEntry(slug: string, token: string): void {
  cleanupQueue.push({ kind: 'entry', slug, token })
}

function trackTeam(slug: string, token: string): void {
  cleanupQueue.push({ kind: 'team', slug, token })
}

test.afterEach(async ({ request }) => {
  for (const item of cleanupQueue.splice(0)) {
    const path =
      item.kind === 'entry' ? `/api/v1/entries/${item.slug}` : `/api/v1/teams/${item.slug}`
    try {
      const resp = await request.delete(path, {
        headers: { Authorization: `Bearer ${item.token}` },
      })
      // 200/204 = 已删；404 = 本就无此资源 → 均视为已清理
      if (![200, 204, 404].includes(resp.status())) {
        console.error(`cleanup ${item.kind} ${item.slug} → unexpected ${resp.status()}`)
      }
    } catch (error) {
      console.error(`cleanup ${item.kind} ${item.slug} failed: ${String(error)}`)
    }
  }
})

// ============================================================
// 基础 helpers
// ============================================================

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

async function login(page: Page, username = 'alice'): Promise<void> {
  await page.goto(`${BASE_URL}/explore`)
  const authBtn = page
    .locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")')
    .first()
  await authBtn.waitFor({ state: 'visible', timeout: 20000 })
  await authBtn.click()
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill('testpass123')
  await page.locator('.login__submit').click()
  await page.waitForURL('**/explore**', { timeout: 20000 })
  await expect(
    page.locator('.explore-actions button:has-text("Sign in")'),
  ).toHaveCount(0, { timeout: 15000 })
}

async function apiLoginToken(request: APIRequestContext, username = 'alice'): Promise<string> {
  const resp = await request.post('/api/v1/auth/login', {
    data: { username, password: 'testpass123' },
  })
  expect(resp.status(), `login ${username} 失败`).toBe(200)
  const body = await resp.json()
  const token = body.access_token ?? body.accessToken
  expect(token).toBeTruthy()
  return token as string
}

/** 现造 entry（走 debug backend HTTP API，绝不用 CLI——铁律 6 / I-19） */
async function createEntry(
  request: APIRequestContext,
  token: string,
  opts: {
    summary: string
    fileCount?: number
    isPublic?: boolean
    teamSlug?: string | null
  },
): Promise<{ slug: string; id: number }> {
  const fileCount = opts.fileCount ?? 2
  const files = Array.from({ length: fileCount }, (_, i) => ({
    filename: `file-${i + 1}.md`,
    content: `# ${opts.summary} — file ${i + 1}\n`,
  }))
  const payload: Record<string, unknown> = {
    summary: opts.summary,
    is_public: opts.isPublic ?? true,
    files,
  }
  if (opts.teamSlug) payload.team_id = opts.teamSlug

  const resp = await request.post('/api/v1/entries', {
    data: payload,
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(resp.status(), `create entry 失败：${await resp.text()}`).toBe(201)
  const body = await resp.json()
  trackEntry(body.slug, token)
  return { slug: body.slug as string, id: body.id as number }
}

async function createTeam(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<string> {
  const resp = await request.post('/api/v1/teams', {
    data: { name },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(resp.status(), `create team 失败：${await resp.text()}`).toBe(201)
  const body = await resp.json()
  trackTeam(body.slug, token)
  return body.slug as string
}

async function getEntryJson(
  request: APIRequestContext,
  token: string,
  slug: string,
): Promise<Record<string, unknown>> {
  const resp = await request.get(`/api/v1/entries/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(resp.status()).toBe(200)
  return resp.json()
}

/** 卡片/列表行定位（两态共用同一个标题文本） */
function entryLocator(page: Page, summary: string) {
  return page.locator('.entry-card, .entry-list-row').filter({ hasText: summary }).first()
}

async function openMenu(page: Page, scope?: ReturnType<Page['locator']>): Promise<void> {
  const trigger = scope
    ? scope.locator(SEL.visibilityToggle).first()
    : page.locator(SEL.visibilityToggle).first()
  await expect(trigger).toBeVisible({ timeout: 15000 })
  await trigger.click()
  await expect(page.locator(SEL.visibilityMenu).first()).toBeVisible({ timeout: 10000 })
}

async function switchToListView(page: Page): Promise<void> {
  await page.locator('.view-toggle-btn[title="List view"]').first().click()
  await expect(page.locator('.entry-list-row').first()).toBeVisible({ timeout: 15000 })
}

async function gotoExplore(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/explore`)
  await page.waitForSelector('.entry-card, .entry-list-row, [data-testid="empty-all"]', {
    timeout: 25000,
  })
}

// ============================================================
// BDD-01 / BDD-02 / BDD-05 / BDD-06 — 时间显示（列表卡片，无 locale 约束）
// ============================================================

test.describe('TPV0102 时间显示基础形态（BDD-01/02）', () => {
  test('bdd01_card_and_list_show_absolute_time_with_offset', async ({ page }) => {
    await login(page)
    await gotoExplore(page)

    // 卡片模式
    const cardTime = page.locator(`.entry-card ${SEL.timeDisplay}`).first()
    await expect(cardTime).toBeVisible({ timeout: 20000 })
    const cardText = (await cardTime.textContent())?.trim() ?? ''
    expect(cardText).toMatch(GMT_OFFSET)
    expect(cardText).toMatch(FOUR_DIGIT_YEAR)
    expect(cardText).not.toMatch(/ago|just now/)

    // 列表模式
    await switchToListView(page)
    const rowTime = page.locator(`.entry-list-row ${SEL.timeDisplay}`).first()
    await expect(rowTime).toBeVisible({ timeout: 15000 })
    const rowText = (await rowTime.textContent())?.trim() ?? ''
    expect(rowText).toMatch(GMT_OFFSET)
    expect(rowText).toMatch(FOUR_DIGIT_YEAR)
    expect(rowText).not.toMatch(/ago|just now/)
  })

  test('bdd02_hover_tooltip_shows_relative_absolute_and_iana', async ({ page }) => {
    await login(page)
    await gotoExplore(page)

    const time = page.locator(SEL.timeDisplay).first()
    await expect(time).toBeVisible({ timeout: 20000 })

    const tooltip = time.locator(SEL.timeTooltip)
    // 悬停前不可见（visibility: hidden）——opacity:0 会让 isVisible 仍为 true，故此处是形态校验
    await expect(tooltip).toBeHidden()

    await time.hover()
    await expect(tooltip).toBeVisible({ timeout: 10000 })

    const text = (await tooltip.textContent()) ?? ''
    expect(text).not.toContain('NaN')
    const parts = text.split(' · ')
    expect(parts.length).toBe(3)
    expect(parts[0]).toMatch(RELATIVE_SHAPE)
    expect(parts[1]).toMatch(FULL_OFFSET)

    const runtimeTz = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(parts[2]).toBe(runtimeTz)

    // 移开后重新隐藏（BDD-02 的 Given/When 区分）
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden({ timeout: 10000 })
  })

  test('bdd05_invalid_time_no_nan_text', async ({ page }) => {
    await login(page)

    // API 造不出无法解析的 created_at → 用 route 注入一条坏数据
    await page.route('**/api/v1/entries?**', async route => {
      const response = await route.fetch()
      const body = await response.json()
      const items = Array.isArray(body.items) ? body.items : []
      if (items.length > 0) {
        items[0].created_at = 'not-a-date'
        items[0].updated_at = 'not-a-date'
      }
      await route.fulfill({ response, json: body })
    })

    await gotoExplore(page)
    const cardText = await page.locator('.entry-card, .entry-list-row').first().textContent()
    expect(cardText ?? '').not.toContain('NaN')

    const time = page.locator(SEL.timeDisplay).first()
    if ((await time.count()) > 0) {
      await time.hover()
      const tooltipText = await time.locator(SEL.timeTooltip).textContent()
      expect(tooltipText ?? '').not.toContain('NaN')
    }
  })

  test('bdd06_future_time_direction', async ({ page }) => {
    await login(page)

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await page.route('**/api/v1/entries?**', async route => {
      const response = await route.fetch()
      const body = await response.json()
      const items = Array.isArray(body.items) ? body.items : []
      if (items.length > 0) {
        items[0].created_at = future
        items[0].updated_at = future
      }
      await route.fulfill({ response, json: body })
    })

    await gotoExplore(page)
    const time = page.locator(SEL.timeDisplay).first()
    await expect(time).toBeVisible({ timeout: 20000 })
    await time.hover()

    const tooltipText = (await time.locator(SEL.timeTooltip).textContent()) ?? ''
    expect(tooltipText).not.toContain('NaN')
    expect(tooltipText).toMatch(/in \d+/)
    expect(tooltipText).not.toContain('just now')
  })
})

// ============================================================
// BDD-04 — 固定 locale/timezone（Asia/Shanghai + zh-CN）
// ============================================================

test.describe('TPV0102 时区固定（BDD-04）', () => {
  test.use({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })

  test('bdd04_shanghai_timezone_shows_plus8_wallclock', async ({ page, request }) => {
    await login(page)
    await gotoExplore(page)

    const time = page.locator(SEL.timeDisplay).first()
    await expect(time).toBeVisible({ timeout: 20000 })

    // 主显必须是 GMT+8（Asia/Shanghai 无夏令时）且墙上时间 = 该 entry 的 UTC 时刻 + 8h
    const mainText = (await time.locator('.time-display__main').textContent())?.trim() ?? ''
    expect(mainText).toContain('GMT+8')

    // 反查该卡片的 UTC 时刻：从 API 取 created_at（第一条），与该卡片同一数据源
    const apiResp = await request.get('/api/v1/entries?per_page=1', {
      headers: { Authorization: `Bearer ${await apiLoginToken(request)}` },
    })
    expect(apiResp.status()).toBe(200)
    const listBody = await apiResp.json()
    const iso = listBody.items?.[0]?.created_at as string | undefined
    expect(iso, '列表 API 未返回 created_at').toBeTruthy()

    const expected = await page.evaluate((raw: string) => {
      // 在浏览器内（context 已固定为 Asia/Shanghai）求 UTC 时刻的 +8h 墙上时间 HH:MM:SS
      const date = new Date(raw.replace(' ', 'T').replace(/Z?$/, 'Z'))
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date)
      const pick = (type: string) => parts.find(p => p.type === type)?.value ?? ''
      return `${pick('hour')}:${pick('minute')}:${pick('second')}`
    }, iso)

    expect(mainText).toContain(expected)
    expect(mainText).not.toContain('NaN')
  })
})

// ============================================================
// BDD-03 / BDD-23 / BDD-25 — 详情页
// ============================================================

test.describe('TPV0102 详情页（BDD-03/23/25）', () => {
  test('bdd03_detail_and_mobile_meta_time_rules_match', async ({ page, request, isMobile }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd03 detail ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2 })

    await login(page)
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForSelector(SEL.timeDisplay, { timeout: 25000 })

    // 详情页承载时间的位置：桌面 `.meta-row`，移动 `EntryMetaTagsBar`
    const scope = isMobile ? page.locator(SEL.metaTagsBar) : page.locator('.meta-row')
    const detailTime = scope.locator(SEL.timeDisplay).first()
    await expect(detailTime).toBeVisible({ timeout: 15000 })
    const text = (await detailTime.textContent())?.trim() ?? ''
    expect(text).toMatch(GMT_OFFSET)
    expect(text).toMatch(FOUR_DIGIT_YEAR)

    // 悬停提示同时含相对时间与绝对时间
    await detailTime.hover()
    const tooltipText = (await detailTime.locator(SEL.timeTooltip).textContent()) ?? ''
    expect(tooltipText).toMatch(RELATIVE_SHAPE)
    expect(tooltipText).toMatch(FULL_OFFSET)

    // 三处规则一致：Explore 列表侧的主显形态相同
    await gotoExplore(page)
    const listTime = page.locator(SEL.timeDisplay).first()
    await expect(listTime).toBeVisible({ timeout: 20000 })
    expect((await listTime.textContent()) ?? '').toMatch(GMT_OFFSET)
  })

  test('bdd23_detail_page_exposes_visibility_entry', async ({ page, request, isMobile }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd23 detail menu ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2 })

    await login(page)
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForSelector(SEL.timeDisplay, { timeout: 25000 })

    const scope = isMobile ? page.locator(SEL.metaTagsBar) : page.locator('.meta-row')
    await expect(scope.locator(SEL.visibilityToggle).first()).toBeVisible({ timeout: 15000 })
  })

  test('bdd25_zero_file_entry_shows_dedicated_empty_state', async ({ page, request }) => {
    // 0 文件 entry 必须现造（seed-data/image-gallery 因 `if not files: SKIP` 不入库）
    const token = await apiLoginToken(request)
    const summary = `bdd25 zero files ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 0 })

    await login(page)
    await page.goto(`${BASE_URL}/${slug}`)

    const noFiles = page.locator(SEL.emptyNoFiles)
    await expect(noFiles).toBeVisible({ timeout: 25000 })
    const noFilesText = ((await noFiles.textContent()) ?? '').trim()
    expect(noFilesText.length).toBeGreaterThan(0)

    // 与「多文件但未选中」的空态文本可区分
    const withFilesSummary = `bdd25 with files ${Date.now()}`
    const withFiles = await createEntry(request, token, { summary: withFilesSummary, fileCount: 3 })
    await page.goto(`${BASE_URL}/${withFiles.slug}`)
    const selectFile = page.locator(SEL.emptySelectFile)
    await expect(selectFile).toBeVisible({ timeout: 25000 })
    const selectFileText = ((await selectFile.textContent()) ?? '').trim()

    expect(selectFileText).not.toBe(noFilesText)
  })
})

// ============================================================
// BDD-13 / BDD-14 / BDD-15 — 文件数三态
// ============================================================

test.describe('TPV0102 文件数三态（BDD-13/14/15）', () => {
  test('bdd13_single_file_entry_hides_file_count', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd13 one file ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 1 })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    expect(await card.textContent()).not.toMatch(ANY_FILE_COUNT)

    await switchToListView(page)
    const row = entryLocator(page, summary)
    await expect(row).toBeVisible({ timeout: 15000 })
    expect(await row.textContent()).not.toMatch(ANY_FILE_COUNT)
  })

  test('bdd14_zero_file_entry_hides_file_count', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd14 zero files ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 0 })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    expect(await card.textContent()).not.toMatch(ANY_FILE_COUNT)

    await switchToListView(page)
    const row = entryLocator(page, summary)
    await expect(row).toBeVisible({ timeout: 15000 })
    expect(await row.textContent()).not.toMatch(ANY_FILE_COUNT)
  })

  test('bdd15_three_file_entry_shows_3_files', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd15 three files ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 3 })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    expect(await card.textContent()).toContain('3 files')

    await switchToListView(page)
    const row = entryLocator(page, summary)
    await expect(row).toBeVisible({ timeout: 15000 })
    expect(await row.textContent()).toContain('3 files')
  })
})

// ============================================================
// BDD-16 / BDD-17 / BDD-18 — 菜单项构造
// ============================================================

test.describe('TPV0102 可见性菜单项（BDD-16/17/18）', () => {
  test('bdd16_menu_excludes_current_state', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd16 public entry ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await expect(page.locator(SEL.itemPublic)).toHaveCount(0)
    await expect(page.locator(SEL.itemPrivate)).toHaveCount(1)
    await expect(page.locator(SEL.itemTeam)).toHaveCount(1)
  })

  test('bdd17_no_teams_hides_team_entry', async ({ page, request }) => {
    // BDD-17 的 Given 是「用户不属于任何团队」——须用真无团队用户，**不得**用请求失败构造
    // （P2 §3.5：加载失败按无团队降级，但该降级不满足 BDD-17 的 Given）
    const username = `noteam${Date.now()}`
    const register = await request.post('/api/v1/auth/register', {
      data: { username, password: 'testpass123' },
    })
    expect(register.status(), `register ${username}`).toBe(201)
    const token = await apiLoginToken(request, username)
    const summary = `bdd17 no team ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page, username)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await expect(page.locator(SEL.itemTeam)).toHaveCount(0)
    await expect(page.locator(SEL.itemPrivate)).toHaveCount(1)
  })

  test('bdd18_team_is_submenu_excluding_current_team', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const stamp = Date.now()
    const teamA = await createTeam(request, token, `E2E A ${stamp}`)
    const teamB = await createTeam(request, token, `E2E B ${stamp}`)
    const summary = `bdd18 team entry ${stamp}`
    const { slug } = await createEntry(request, token, {
      summary,
      fileCount: 2,
      teamSlug: teamA,
    })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    // Team 入口只展开子菜单，不直接切换
    const before = await getEntryJson(request, token, slug)
    await page.locator(SEL.itemTeam).first().click()
    await expect(page.locator(SEL.teamSubmenu).first()).toBeVisible({ timeout: 10000 })

    await expect(page.locator(`[data-testid="visibility-team-option-${teamA}"]`)).toHaveCount(0)
    await expect(page.locator(`[data-testid="visibility-team-option-${teamB}"]`)).toHaveCount(1)

    const after = await getEntryJson(request, token, slug)
    expect(after.team_id).toBe(before.team_id)
    expect(after.is_public).toBe(before.is_public)
  })
})

// ============================================================
// BDD-19 / BDD-20 / BDD-27 / BDD-28 / BDD-29 — 可见性转换
// ============================================================

test.describe('TPV0102 可见性转换（BDD-19/20/27/28/29）', () => {
  test('bdd19_public_requires_confirmation', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const stamp = Date.now()
    const teamA = await createTeam(request, token, `E2E Pub ${stamp}`)
    const summary = `bdd19 team to public ${stamp}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, teamSlug: teamA })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await page.locator(SEL.itemPublic).first().click()
    await expect(page.locator(SEL.confirmDialog)).toBeVisible({ timeout: 10000 })

    // 确认之前不得发出修改请求
    const beforeConfirm = await getEntryJson(request, token, slug)
    expect(beforeConfirm.is_public).toBe(false)

    await page.locator('.confirm__btn:not(.confirm__btn--cancel)').first().click()

    await expect
      .poll(async () => (await getEntryJson(request, token, slug)).is_public, { timeout: 20000 })
      .toBe(true)
    const after = await getEntryJson(request, token, slug)
    expect(after.team ?? null).toBeNull()
  })

  test('bdd20_downgrade_has_no_confirmation', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd20 public to private ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await page.locator(SEL.itemPrivate).first().click()
    await expect(page.locator(SEL.confirmDialog)).toHaveCount(0)

    await expect
      .poll(async () => (await getEntryJson(request, token, slug)).is_public, { timeout: 20000 })
      .toBe(false)
  })

  test('bdd27_private_to_team_a', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const stamp = Date.now()
    const teamA = await createTeam(request, token, `E2E privA ${stamp}`)
    const summary = `bdd27 private to team ${stamp}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, isPublic: false })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await page.locator(SEL.itemTeam).first().click()
    await page.locator(`[data-testid="visibility-team-option-${teamA}"]`).first().click()

    await expect
      .poll(async () => (await getEntryJson(request, token, slug)).team, { timeout: 20000 })
      .toBeTruthy()
    const after = await getEntryJson(request, token, slug)
    // 两字段都断言
    expect(after.is_public).toBe(false)
    expect((after.team as { slug: string }).slug).toBe(teamA)
  })

  test('bdd28_team_a_to_team_b', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const stamp = Date.now()
    const teamA = await createTeam(request, token, `E2E fromA ${stamp}`)
    const teamB = await createTeam(request, token, `E2E toB ${stamp}`)
    const summary = `bdd28 teamA to teamB ${stamp}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, teamSlug: teamA })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await page.locator(SEL.itemTeam).first().click()
    await page.locator(`[data-testid="visibility-team-option-${teamB}"]`).first().click()
    await expect(page.locator(SEL.confirmDialog)).toHaveCount(0)

    await expect
      .poll(
        async () => ((await getEntryJson(request, token, slug)).team as { slug: string })?.slug,
        { timeout: 20000 },
      )
      .toBe(teamB)
    const after = await getEntryJson(request, token, slug)
    expect(after.is_public).toBe(false)
    expect((after.team as { slug: string }).slug).not.toBe(teamA)
  })

  test('bdd29_team_a_to_private', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const stamp = Date.now()
    const teamA = await createTeam(request, token, `E2E clearA ${stamp}`)
    const summary = `bdd29 team to private ${stamp}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, teamSlug: teamA })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    await openMenu(page, card)

    await page.locator(SEL.itemPrivate).first().click()
    await expect(page.locator(SEL.confirmDialog)).toHaveCount(0)

    await expect
      .poll(async () => (await getEntryJson(request, token, slug)).team, { timeout: 20000 })
      .toBeNull()
    const after = await getEntryJson(request, token, slug)
    // 两字段都断言（防「团队清空但被误置 public」）
    expect(after.is_public).toBe(false)
    expect(after.team ?? null).toBeNull()
  })
})

// ============================================================
// BDD-21 / BDD-24 — 失败回滚与并发守卫
// ============================================================

test.describe('TPV0102 失败与并发（BDD-21/24）', () => {
  test('bdd21_failed_switch_rolls_back', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd21 fail rollback ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })

    // 让 PATCH 被拒绝（非 2xx）
    await page.route('**/api/v1/entries/*', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, body: JSON.stringify({ detail: 'boom' }) })
        return
      }
      await route.fallback()
    })

    await openMenu(page, card)
    await page.locator(SEL.itemPrivate).first().click()

    // 失败提示出现（toast 由视图层唯一发出）
    await expect(
      page.locator('.toast, [data-testid="toast"]').filter({ hasText: /fail|失败|error|错误/i }).first(),
    ).toBeVisible({ timeout: 20000 })

    // 状态保持原值（服务端未变更）
    const after = await getEntryJson(request, token, slug)
    expect(after.is_public).toBe(true)
    expect(after.team ?? null).toBeNull()
  })

  test('bdd24_no_double_trigger_while_in_flight', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd24 in flight ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })

    let patchCount = 0
    await page.route('**/api/v1/entries/*', async route => {
      if (route.request().method() === 'PATCH') {
        patchCount += 1
        await new Promise(resolve => setTimeout(resolve, 400))
        await route.fallback()
        return
      }
      await route.fallback()
    })

    await openMenu(page, card)
    const privateItem = page.locator(SEL.itemPrivate).first()
    await privateItem.click()
    // 请求未返回前再点一次（菜单可能已关闭 → catch 忽略）
    await privateItem.click({ timeout: 2000 }).catch(() => undefined)

    await page.waitForTimeout(1500)
    expect(patchCount).toBe(1)
  })
})

// ============================================================
// BDD-22 — 非 owner 三处无入口
// ============================================================

test.describe('TPV0102 非 owner 无入口（BDD-22）', () => {
  test('bdd22_non_owner_has_no_visibility_entry', async ({ page, request, isMobile }) => {
    const aliceToken = await apiLoginToken(request, 'alice')
    const summary = `bdd22 alice private ${Date.now()}`
    const { slug } = await createEntry(request, aliceToken, {
      summary,
      fileCount: 2,
      isPublic: true,
    })

    // bob 非 owner
    await login(page, 'bob')
    await gotoExplore(page)

    // ① Explore 卡片
    await expect(page.locator(`.entry-card:has-text("${summary}") ${SEL.visibilityToggle}`)).toHaveCount(0)
    // ② Explore 列表行
    await switchToListView(page)
    await expect(
      page.locator(`.entry-list-row:has-text("${summary}") ${SEL.visibilityToggle}`),
    ).toHaveCount(0)

    // ③ 详情页（桌面头部 / 移动元信息条）
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForSelector(SEL.timeDisplay, { timeout: 25000 })
    if (isMobile) {
      await expect(page.locator(`${SEL.metaTagsBar} ${SEL.visibilityToggle}`)).toHaveCount(0)
    } else {
      await expect(page.locator(`.meta-row ${SEL.visibilityToggle}`)).toHaveCount(0)
    }
    // 三处之外再兜一层：整页也不该出现入口
    await expect(page.locator(SEL.visibilityToggle)).toHaveCount(0)
  })
})

// ============================================================
// BDD-30 — Escape 关闭 + 焦点回归
// ============================================================

test.describe('TPV0102 键盘可关闭（BDD-30）', () => {
  test('bdd30_escape_closes_menu_and_returns_focus', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const summary = `bdd30 escape ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 2, isPublic: true })

    await login(page)
    await gotoExplore(page)
    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })

    const trigger = card.locator(SEL.visibilityToggle).first()
    await trigger.click()
    await expect(page.locator(SEL.visibilityMenu).first()).toBeVisible({ timeout: 10000 })

    await page.keyboard.press('Escape')

    await expect(page.locator(SEL.visibilityMenu)).toHaveCount(0)
    const focusedIsTrigger = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null
      return active?.getAttribute('data-testid') === 'visibility-toggle'
    })
    expect(focusedIsTrigger).toBe(true)
  })
})

// ============================================================
// BDD-26 — seed 数据人工体验路径
// ============================================================

test.describe('TPV0102 seed 数据体验路径（BDD-26）', () => {
  test('bdd26_seeded_explore_renders_new_rules', async ({ page }) => {
    await login(page) // seed 用户 alice
    await gotoExplore(page)

    const cards = page.locator('.entry-card')
    expect(await cards.count()).toBeGreaterThan(1)

    // 每张卡片的时间都不含 ago 且含 GMT±N
    const timeTexts = await page.locator(`.entry-card ${SEL.timeDisplay}`).allTextContents()
    expect(timeTexts.length).toBeGreaterThan(1)
    for (const text of timeTexts) {
      expect(text).toMatch(GMT_OFFSET)
      expect(text).not.toMatch(/ago|just now/)
    }

    // 多文件卡片显示 N files
    for (const slug of ['unicode-filenames', 'multi-format-demo']) {
      const card = page.locator(`.entry-card:has-text("${slug}")`).first()
      if ((await card.count()) === 0) continue // seed 未灌该数据时跳过（make debug 未 seed）
      expect(await card.textContent()).toMatch(ANY_FILE_COUNT)
    }

    // 单文件卡片不显示文件数
    const single = page.locator('.entry-card').filter({ hasText: 'yaml-docker-compose' }).first()
    if ((await single.count()) > 0) {
      expect(await single.textContent()).not.toMatch(ANY_FILE_COUNT)
    }
  })
})

// ============================================================
// 视觉契约（P2 UI 设计节 VC-1~VC-7，可量化 DOM 度量）
// ============================================================

test.describe('TPV0102 视觉契约 VC-1~VC-7', () => {
  test('vc01_tooltip_does_not_overflow_viewport', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc01 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)

    const time = page.locator(SEL.timeDisplay).first()
    await expect(time).toBeVisible({ timeout: 20000 })
    await time.hover()

    const viewport = page.viewportSize()
    const box = await time.locator(SEL.timeTooltip).boundingBox()
    expect(box).not.toBeNull()
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    }
  })

  test('vc02_menu_does_not_cover_trigger', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc02 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)
    const card = page.locator('.entry-card').first()
    await expect(card).toBeVisible({ timeout: 20000 })

    const trigger = card.locator(SEL.visibilityToggle).first()
    await trigger.click()
    const menu = page.locator(SEL.visibilityMenu).first()
    await expect(menu).toBeVisible({ timeout: 10000 })

    const triggerBox = await trigger.boundingBox()
    const menuBox = await menu.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()
    if (triggerBox && menuBox) {
      expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 1)
    }
  })

  test('vc03_card_meta_row_does_not_overflow', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc03 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)

    const meta = page.locator('.entry-card .card-meta-text').first()
    await expect(meta).toBeVisible({ timeout: 20000 })
    const metrics = await meta.evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  })

  test('vc04_mobile_trigger_touch_target_is_44', async ({ page, request, isMobile }) => {
    test.skip(!isMobile, 'VC-4 只断言移动端新增触发按钮（既有 28×28 按钮不断言）')
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc04 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)

    const trigger = page.locator(SEL.visibilityToggle).first()
    await expect(trigger).toBeVisible({ timeout: 20000 })
    const box = await trigger.boundingBox()
    expect(box).not.toBeNull()
    if (box) expect(box.height).toBeGreaterThanOrEqual(44)
  })

  test('vc05_time_and_username_baseline_aligned', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc05 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)

    const card = page.locator('.entry-card').filter({ has: page.locator('.card-meta-text') }).first()
    const username = card.locator('.meta-username').first()
    const time = card.locator(SEL.timeDisplay).first()
    if ((await username.count()) === 0) test.skip(true, '该卡片无 @username，跳过基线对齐断言')

    const userBox = await username.boundingBox()
    const timeBox = await time.boundingBox()
    expect(userBox).not.toBeNull()
    expect(timeBox).not.toBeNull()
    if (userBox && timeBox) {
      expect(Math.abs(userBox.y + userBox.height - (timeBox.y + timeBox.height))).toBeLessThanOrEqual(2)
    }
  })

  test('vc06_list_actions_do_not_overlap_title', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    await createEntry(request, token, { summary: `vc06 ${Date.now()}`, fileCount: 2 })

    await login(page)
    await gotoExplore(page)
    await switchToListView(page)

    const row = page.locator('.entry-list-row').first()
    const title = row.locator('.entry-title').first()
    const actions = row.locator('.entry-actions').first()
    const titleBox = await title.boundingBox()
    const actionsBox = await actions.boundingBox()
    expect(titleBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    if (titleBox && actionsBox) {
      expect(actionsBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width - 1)
    }
  })

  test('vc07_detail_meta_row_height_within_two_lines', async ({ page, request }) => {
    const token = await apiLoginToken(request)
    const { slug } = await createEntry(request, token, {
      summary: `vc07 ${Date.now()}`,
      fileCount: 3,
    })

    await login(page)
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForSelector(SEL.timeDisplay, { timeout: 25000 })

    const metaRow = page.locator('.meta-row').first()
    if ((await metaRow.count()) === 0) test.skip(true, '移动视口无 .meta-row（由 EntryMetaTagsBar 承载）')

    const metrics = await metaRow.evaluate(el => {
      const style = window.getComputedStyle(el as HTMLElement)
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5
      return { height: (el as HTMLElement).getBoundingClientRect().height, lineHeight }
    })
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 2 + 1)
  })
})
