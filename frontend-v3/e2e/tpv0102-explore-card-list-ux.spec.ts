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
const RELATIVE_SHAPE = /just now|\d+(m|h|d|w|mo|y) ago|in \d+(m|h|d|w|mo|y)/
const ANY_FILE_COUNT = /\d+ files?/

/** 「多文件但未选中」通用空态文案，与 `EntryDetailContent.vue` 的 `empty-select-file` 分支同源。
 *  该分支对「有文件的 entry」不可达（`loadEntry` 恒自动选中 `files[0]`），故按常量对照而非 DOM。 */
const EMPTY_SELECT_FILE_TEXT = 'Select a file to view'

const SEL = {
  timeDisplay: '[data-testid="time-display"]',
  // 断言「主显」必须落在 .time-display__main：根节点 textContent 含内部 tooltip
  // （tooltip 本就含 `just now · …`，见 BDD-02），会把 `not /ago|just now/` 打成假红。
  timeDisplayMain: '[data-testid="time-display-main"]',
  timeTooltip: '[data-testid="time-tooltip"]',
  visibilityToggle: '[data-testid="visibility-toggle"]',
  visibilityMenu: '[data-testid="visibility-menu"]',
  itemPublic: '[data-testid="visibility-item-public"]',
  itemPrivate: '[data-testid="visibility-item-private"]',
  itemTeam: '[data-testid="visibility-item-team"]',
  teamSubmenu: '[data-testid="visibility-team-submenu"]',
  emptyNoFiles: '[data-testid="empty-no-files"]',
  contentArea: '[data-testid="content-area"]',
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

  // submit 按钮的 disabled 条件是 `loading || !formValid || (captchaEnabled && !captchaToken)`
  // （`LoginDialog.vue:88`）。`captchaEnabled` 由打开弹窗后的异步 `/api/v1/config/captcha`
  // 决定，formValid 又依赖 v-model 的下一轮更新 —— 填值后立刻 click 会与这两者竞态。
  // 照既有先例（`e2e/captcha-disabled.spec.ts:24-25`）先等按钮真正 enabled 再点。
  const submit = page.locator('.login__submit')
  await expect(submit).toBeEnabled({ timeout: 15000 })
  await submit.click()

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
  test('bdd01_card_and_list_show_absolute_time_without_offset', async ({ page }) => {
    await login(page)
    await gotoExplore(page)

    // 主显：绝对时间、不含时区偏移、不含秒（TPV0103 反转 TPV0102 的「必须含 GMT±N」）
    const assertMainline = (text: string) => {
      expect(text).not.toMatch(GMT_OFFSET)
      expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}/)
      expect(text).toMatch(/\d{2}:\d{2}/)
      expect(text).not.toMatch(/ago|just now/)
    }

    // 卡片模式（断言限定在主显节点，不含内部 tooltip —— 见 SEL.timeDisplayMain 注释）
    const cardTime = page.locator(`.entry-card ${SEL.timeDisplayMain}`).first()
    await expect(cardTime).toBeVisible({ timeout: 20000 })
    assertMainline((await cardTime.textContent())?.trim() ?? '')

    // 列表模式
    await switchToListView(page)
    const rowTime = page.locator(`.entry-list-row ${SEL.timeDisplayMain}`).first()
    await expect(rowTime).toBeVisible({ timeout: 15000 })
    assertMainline((await rowTime.textContent())?.trim() ?? '')
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
    // 锚定同一条 entry：现造一条，页面按 summary 定位它的卡片，created_at 从该 slug 的 API 取。
    // （原写法「页面第一张卡 vs 列表 API 第一条」是两个独立请求，默认排序在并发 seed 下
    //  可能指向不同 entry，实测出现过差 1 秒的假红。）
    const token = await apiLoginToken(request)
    const summary = `bdd04 tz ${Date.now()}`
    const { slug } = await createEntry(request, token, { summary, fileCount: 2 })

    await login(page)
    await gotoExplore(page)

    const card = entryLocator(page, summary)
    await expect(card).toBeVisible({ timeout: 20000 })
    const time = card.locator(SEL.timeDisplay).first()
    await expect(time).toBeVisible({ timeout: 20000 })

    // 主显：无时区偏移、无秒；墙上时间 = 该 entry 的 UTC 时刻 + 8h（Asia/Shanghai 无夏令时）
    const mainText = (await time.locator('.time-display__main').textContent())?.trim() ?? ''
    expect(mainText).not.toContain('GMT+8')
    expect(mainText).not.toMatch(/\d{2}:\d{2}:\d{2}/)

    const entryJson = await getEntryJson(request, token, slug)
    const iso = entryJson.created_at as string | undefined
    expect(iso, '该 entry 未返回 created_at').toBeTruthy()

    const expected = await page.evaluate((raw: string) => {
      // 在浏览器内（context 已固定为 Asia/Shanghai）求 UTC 时刻的 +8h 墙上时间 HH:MM
      const date = new Date(raw.replace(' ', 'T').replace(/Z?$/, 'Z'))
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date)
      const pick = (type: string) => parts.find(p => p.type === type)?.value ?? ''
      return `${pick('hour')}:${pick('minute')}`
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
    // 主显断言必须限定在 .time-display__main：根节点 textContent 含内部 tooltip，而 tooltip 本就含 GMT+08:00
    const mainText = (await detailTime.locator(SEL.timeDisplayMain).textContent())?.trim() ?? ''
    expect(mainText).not.toMatch(GMT_OFFSET)
    expect(mainText).not.toMatch(/\d{2}:\d{2}:\d{2}/)

    // 悬停提示同时含相对时间与绝对时间
    await detailTime.hover()
    const tooltipText = (await detailTime.locator(SEL.timeTooltip).textContent()) ?? ''
    expect(tooltipText).toMatch(RELATIVE_SHAPE)
    expect(tooltipText).toMatch(FULL_OFFSET)

    // 三处规则一致：Explore 列表侧的主显形态相同（无偏移、无秒）
    await gotoExplore(page)
    const listTime = page.locator(SEL.timeDisplayMain).first()
    await expect(listTime).toBeVisible({ timeout: 20000 })
    const listText = (await listTime.textContent())?.trim() ?? ''
    expect(listText).not.toMatch(GMT_OFFSET)
    expect(listText).not.toMatch(/\d{2}:\d{2}:\d{2}/)
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

    // 专用空态文案 ≠ 「多文件未选中」的通用提示文案（`EntryDetailContent.vue` 的
    // `empty-select-file` 常量文案）。取常量的原因见下：该分支在真实路径上不可达。
    expect(noFilesText).not.toBe(EMPTY_SELECT_FILE_TEXT)

    // 对照：有文件的 entry 绝不落 0 文件空态（两分支互斥的正向验证）
    const withFilesSummary = `bdd25 with files ${Date.now()}`
    const withFiles = await createEntry(request, token, { summary: withFilesSummary, fileCount: 3 })
    await page.goto(`${BASE_URL}/${withFiles.slug}`)
    await expect(page.locator(SEL.contentArea)).toBeVisible({ timeout: 25000 })
    await expect(page.locator(SEL.emptyNoFiles)).toHaveCount(0)

    // ⚠️ 原断言「有文件 entry 显示 empty-select-file」已撤除：该状态**不可达**。
    // `entryDetail.loadEntry` 在 `files.length > 0` 时恒把 `activeFile` 置为 `files[0]`
    // （`stores/entryDetail.ts:49-53`），`selectFile` 也不会置空 ⇒ `v-else` 的
    // `empty-select-file` 分支对「有文件的 entry」永不渲染（实测 3 文件 entry 该 testid count=0）。
    // 因此「两种空态可区分」只能按文案常量对照断言，不能按 DOM 可达性断言。
    // BDD-25 的 Then 语义（专用提示 + 与通用提示不同）由上面两条断言保留，未放宽。
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

    // 每张卡片的主显时间：绝对时间、不含 ago、不含时区偏移、不含秒（TPV0103）
    // （断言限定在主显节点：根节点 textContent 含 tooltip，而 tooltip 本就含 `just now`）
    const timeTexts = await page.locator(`.entry-card ${SEL.timeDisplayMain}`).allTextContents()
    expect(timeTexts.length).toBeGreaterThan(1)
    for (const text of timeTexts) {
      expect(text).not.toMatch(GMT_OFFSET)
      expect(text).not.toMatch(/\d{2}:\d{2}:\d{2}/)
      expect(text).toMatch(/\d{2}:\d{2}/)
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
      // 元信息行是 flex-wrap 容器（VC-3 要求不溢出）：可用宽 246px 时，
      // `@username` + 点 + 主显时间（en-US 实测 207px）一行放不下 ⇒ 时间整体折到第 2 flex 行。
      // 「基线对齐」只对**同一视觉行**内的两段文本有意义；跨行时断言的是行高而非基线。
      const sameRow = Math.abs(userBox.y + userBox.height - (timeBox.y + timeBox.height)) <= 2
      const wrappedToOwnRow = timeBox.y >= userBox.y + userBox.height - 1
      expect(
        sameRow || wrappedToOwnRow,
        `时间与 @username 既不共基线也未整体折行（userBottom=${userBox.y + userBox.height}, timeBottom=${timeBox.y + timeBox.height}）`,
      ).toBe(true)

      // 折行时仍不得溢出卡片右边界（与 VC-3 同源，防「折行但越界」）
      const meta = card.locator('.card-meta-text').first()
      const metrics = await meta.evaluate(el => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
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
      // 「不重叠」是二维语义：矩形不相交即可。桌面两列（1fr auto）→ 横向分离；
      // 移动单列（grid-template-columns:1fr，actions 落到下一行）→ 纵向分离。
      // 原先只比 `x`，等价于「必须横向分离」，在单列布局下必然假红（实测移动端
      // title y=72..96 与 actions y=157.5..201.5 无纵向交集，本就不重叠）。
      const overlapX = Math.min(titleBox.x + titleBox.width, actionsBox.x + actionsBox.width)
        - Math.max(titleBox.x, actionsBox.x)
      const overlapY = Math.min(titleBox.y + titleBox.height, actionsBox.y + actionsBox.height)
        - Math.max(titleBox.y, actionsBox.y)
      expect(
        overlapX <= 0 || overlapY <= 0,
        `标题与动作区矩形相交（overlapX=${overlapX}, overlapY=${overlapY}）`,
      ).toBe(true)

      // 桌面两列布局下额外要求横向分离（保留原断言的强度）
      const isTwoColumn = await row.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length > 1)
      if (isTwoColumn) {
        expect(actionsBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width - 1)
      }
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

// ============================================================
// VC-8（P4 rev1 补）：列表最后一行浮层不被容器/视口裁剪
// ============================================================
// F-1 缺口：`vc02` 只断言浮层上边界不遮触发按钮，**下边界无人测**——`.entry-panel`
// 曾有 `overflow:hidden`，列表最后一行开菜单时浮层被裁到容器底边（实测仅 17% 可见），
// 而 vc02 仍恒绿。本用例断言三件事：① 浮层不与任何裁剪祖先共存；② 浮层超出容器底边的
// 部分仍可命中；③ 浮层整体落在视口内且每个菜单项 elementFromPoint 命中自身。
test.describe('TPV0102 视觉契约 VC-8（rev1）', () => {
  test('vc08_last_row_menu_not_clipped_by_container', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'VC-8 只断言桌面列表（移动端走底部 sheet，不涉及容器裁剪）')
    const token = await apiLoginToken(request)
    const summary = `vc08 ${Date.now()}`
    await createEntry(request, token, { summary, fileCount: 2 })

    await login(page)
    await gotoExplore(page)
    await switchToListView(page)

    const rows = page.locator('.entry-list-row')
    const lastRow = rows.last()
    await lastRow.scrollIntoViewIfNeeded()
    const trigger = lastRow.locator(SEL.visibilityToggle).first()
    await expect(trigger).toBeVisible({ timeout: 15000 })
    await trigger.click()

    const menu = page.locator(SEL.visibilityMenu).first()
    await expect(menu).toBeVisible({ timeout: 10000 })

    // ① 浮层到 documentElement 之间不得存在裁剪祖先（overflow != visible）
    const clippers = await menu.evaluate(el => {
      const out: string[] = []
      for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const cs = window.getComputedStyle(node)
        if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          out.push(`${(node.className || node.tagName).toString().split(' ')[0]}:${cs.overflow}`)
        }
      }
      return out
    })
    expect(clippers, `浮层存在裁剪祖先：${clippers.join(', ')}`).toEqual([])

    // ② 滚到文档底部使浮层完全可见，再断言整体在视口内 + 逐项命中
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(200)

    const measured = await menu.evaluate(el => {
      const box = el.getBoundingClientRect()
      const items = Array.from(el.querySelectorAll<HTMLElement>('.visibility-item'))
      return {
        box: { top: box.top, bottom: box.bottom, height: box.height },
        height: window.innerHeight,
        items: items.map(item => {
          const r = item.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return {
            label: (item.textContent ?? '').trim().split('\n')[0],
            top: r.top,
            bottom: r.bottom,
            hitSelf: !!hit && item.contains(hit),
          }
        }),
      }
    })

    expect(measured.box.top).toBeGreaterThanOrEqual(-1)
    expect(measured.box.bottom).toBeLessThanOrEqual(measured.height + 1)
    expect(measured.items.length).toBeGreaterThan(0)
    for (const item of measured.items) {
      expect(item.hitSelf, `菜单项「${item.label}」在 (top=${Math.round(item.top)}) 处不可命中`).toBe(true)
    }
  })
})
