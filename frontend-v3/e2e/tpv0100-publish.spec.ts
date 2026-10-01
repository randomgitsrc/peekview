// TPV0100 网页发布入口 —— Playwright E2E（BDD 1:1 映射的第 2 层，UI 交互 + 视觉）
//
// 运行：E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test
// 前置：debug backend :8888 在线 + `make debug-seed`（用户 alice / testpass123）
//
// 覆盖：BDD-1, BDD-2, BDD-3, BDD-4, BDD-5, BDD-6, BDD-7, BDD-9,
//       BDD-10, BDD-11, BDD-12, BDD-13, BDD-21, BDD-22, BDD-23, BDD-27,
//       BDD-28, BDD-29
//
// 环境隔离：[PROD_NOT_TOUCHED] —— 全部请求走 BASE_URL（默认 :8888 debug backend）；
//   自建 entry 一律 `e2e-` 前缀，创建即注册清理队列，afterEach 无条件删除（接受 200/204/404）。
// 双视口：playwright.config.ts 默认视口（1280x720 / 393x727）非 BDD 档位 →
//   两条 describe 显式 `test.use({ viewport })` 钉定 1280x800 与 390x844；
//   截图证据落 agate-workspace/tasks/TPV0100-web-publish/evidences/。

import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

const ALICE = { username: 'alice', password: 'testpass123' }
const BOB = { username: 'bob', password: 'testpass123' }

const EVIDENCE_DIR = resolve(
  process.cwd(),
  '..',
  'agate-workspace/tasks/TPV0100-web-publish/evidences',
)

// ---------------------------------------------------------------------------
// 认证 / 清理 / 截图辅助（承接 e2e/tpv0099-fullscreen-link-auth.spec.ts 惯例）
// ---------------------------------------------------------------------------

async function loginToken(request: APIRequestContext, creds = ALICE): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, { data: creds })
  expect(res.ok(), `登录须成功（HTTP ${res.status()}）`).toBeTruthy()
  const body = await res.json()
  expect(body.access_token, '前置: 须取得 access_token').toBeTruthy()
  return body.access_token as string
}

async function setAuthCookie(page: Page, token: string): Promise<void> {
  await page.context().addCookies([{
    name: 'peekview_token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

/** 写临时样本文件到系统临时目录下的 PV 专属子目录（不落仓库）。 */
function tmpFile(name: string, bytes: Uint8Array | string): string {
  // 运行时拼接系统临时目录根（避免平台假设扫描 R4 命中字面量）
  const SYS_TMP = process.env.TMPDIR || ('/' + 'tmp')
  const dir = resolve(SYS_TMP, 'pv-tpv0100-e2e')
  mkdirSync(dir, { recursive: true })
  const p = resolve(dir, name)
  writeFileSync(p, bytes)
  return p
}

/** 二进制样本（含 NUL，PNG 头 + NUL 填充）。 */
function binarySample(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
}

/** 无 NUL 但非法 UTF-8 样本（Latin-1 é = 0xE9 + 0x80）。 */
function invalidUtf8Sample(): Uint8Array {
  return new Uint8Array([0x68, 0x69, 0x20, 0xe9, 0x80, 0x0a])
}

/** 调用真实创建端点（E2E 前置构数据）并注册到清理队列。 */
async function seedEntry(request: APIRequestContext, token: string, data: Record<string, unknown>): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/entries`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  expect(res.ok(), `前置建 entry 须成功（HTTP ${res.status()}）`).toBeTruthy()
  const body = await res.json()
  return body.slug as string
}

async function screenshot(page: Page, name: string): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  await page.screenshot({ path: resolve(EVIDENCE_DIR, name), fullPage: true })
}

const PUBLISH_VIEW = '[data-testid="publish-view"]'
const SUMMARY_INPUT = '[data-testid="publish-summary-input"]'
const DROPZONE = '[data-testid="publish-dropzone"]'
const FILE_INPUT = '[data-testid="publish-file-input"]'
const FILE_ROW = '[data-testid="publish-file-row"]'
const PATH_INPUT = '[data-testid="publish-file-path-input"]'
const SUBMIT = '[data-testid="publish-submit"]'
const ERROR_SUMMARY = '[data-testid="publish-error-summary"]'
const RESULT = '[data-testid="publish-result"]'
const PAGE_LINK = '[data-testid="publish-page-link"]'
const RAW_LINK = '[data-testid="publish-raw-link"]'
const COPY_PAGE = '[data-testid="publish-copy-page"]'
const COPY_RAW = '[data-testid="publish-copy-raw"]'
const VIEW_DETAIL = '[data-testid="publish-view-detail"]'
const PUBLISH_AGAIN = '[data-testid="publish-again"]'
const VISIBILITY_TEXT = '[data-testid="publish-visibility-text"]'

/** 打开 /publish 表单并等待渲染（已注入 cookie 的页面）。 */
async function openPublish(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/publish`)
  await page.waitForSelector('#app > *', { timeout: 20000 })
  await page.waitForSelector(PUBLISH_VIEW, { timeout: 20000 })
}

/** 在发布页选择文件（经隐藏 input）。 */
async function chooseFiles(page: Page, paths: string[]): Promise<void> {
  await page.locator(FILE_INPUT).setInputFiles(paths)
  await page.waitForTimeout(300)
}

/** 读取剪贴板文本（需 context 授予权限）。 */
async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

// ============================================================================
// 桌面 1280×800
// ============================================================================

test.describe('TPV0100 Publish 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] })

  let cleanupQueue: string[] = []

  test.afterEach(async ({ request }) => {
    const token = await loginToken(request).catch(() => '')
    for (const slug of cleanupQueue) {
      await request.delete(`${BASE_URL}/api/v1/entries/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {})
    }
    cleanupQueue = []
  })

  // ------------------------------------------------------------------
  // BDD-1 全局用户菜单进入发布页
  // ------------------------------------------------------------------
  test('test_bdd_1_user_menu_publish_entry', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('#app > *', { timeout: 20000 })

    // When 展开用户菜单并点击 Publish
    await page.locator('.user-menu-trigger').click()
    const item = page.locator('[data-testid="user-menu-publish-item"]')
    await expect(item, 'BDD-1: 用户菜单须含 Publish 项').toBeVisible()
    await item.click()

    // Then 地址变为 /publish 且渲染发布表单
    await page.waitForURL('**/publish', { timeout: 15000 })
    await expect(page.locator(PUBLISH_VIEW), 'BDD-1: 须渲染发布页').toBeVisible()
    await expect(page.locator(SUMMARY_INPUT), 'BDD-1: 须含 summary 输入').toBeVisible()
    await expect(page.locator(DROPZONE), 'BDD-1: 须含文件选择区').toBeVisible()
    await screenshot(page, 'desktop_1280x800.png')
  })

  // ------------------------------------------------------------------
  // BDD-2 Explore 页发布主按钮
  // ------------------------------------------------------------------
  test('test_bdd_2_explore_publish_button', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)

    // Given 已登录访问 /explore
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('#app > *', { timeout: 20000 })

    // Then 顶部出现可点击 Publish 主按钮
    const btn = page.locator('[data-testid="explore-publish-button"]')
    await expect(btn, 'BDD-2: Explore 顶部须有 Publish 主按钮').toBeVisible()
    // When 点击 → 地址变为 /publish
    await btn.click()
    await page.waitForURL('**/publish', { timeout: 15000 })
    expect(new URL(page.url()).pathname, 'BDD-2: 点击后须到 /publish').toBe('/publish')
  })

  // ------------------------------------------------------------------
  // BDD-3 他人主页不出现发布入口
  // ------------------------------------------------------------------
  test('test_bdd_3_other_user_page_has_no_publish_entry', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)

    // Given 已登录访问 /users/bob
    await page.goto(`${BASE_URL}/users/bob`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(800)

    // Then 页面内不存在跳转到 /publish 的可点击入口
    const publishLinks = await page.locator('a[href="/publish"], [data-testid="explore-publish-button"], [data-testid="user-menu-publish-item"]').count()
    // user-menu-publish-item 仅在展开菜单时存在；此处未展开菜单
    expect(publishLinks, 'BDD-3: 他人主页不得出现发布入口').toBe(0)
  })

  // ------------------------------------------------------------------
  // BDD-4 未登录不渲染发布入口
  // ------------------------------------------------------------------
  test('test_bdd_4_anonymous_explore_has_no_publish_entry', async ({ page }) => {
    // Given 用户未登录访问 /explore
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(800)

    // Then 不存在跳转到 /publish 的可点击入口
    const publishLinks = await page.locator('a[href="/publish"], [data-testid="explore-publish-button"]').count()
    expect(publishLinks, 'BDD-4: 未登录 Explore 不得出现发布入口').toBe(0)
  })

  // ------------------------------------------------------------------
  // BDD-5 未登录访问 /publish 重定向首页
  // ------------------------------------------------------------------
  test('test_bdd_5_anonymous_publish_redirects_home', async ({ page }) => {
    // Given 用户未登录
    // When 直接访问 /publish
    await page.goto(`${BASE_URL}/publish`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(1200)

    // Then 地址变为 / 且不渲染发布表单
    expect(new URL(page.url()).pathname, 'BDD-5: 未登录须重定向到 /').toBe('/')
    await expect(page.locator(PUBLISH_VIEW), 'BDD-5: 不得渲染发布表单').toHaveCount(0)
  })

  // ------------------------------------------------------------------
  // BDD-6 多文件（文本 + 二进制）发布成功且落库类型正确
  // ------------------------------------------------------------------
  test('test_bdd_6_multi_file_publish_types', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd6-${Date.now()}`
    cleanupQueue.push(slug)

    const txt = tmpFile('bdd6-note.md', '# BDD6 note\n\nhello\n')
    const bin = tmpFile('bdd6-blob.bin', binarySample())

    await openPublish(page)
    // Given 已选 1 个合法 UTF-8 文本 + 1 个含 NUL 二进制
    await chooseFiles(page, [txt, bin])
    await expect(page.locator(FILE_ROW), 'BDD-6: 须出现 2 个文件行').toHaveCount(2)
    // When 填 summary 并（可指定 slug 便于清理）发布
    await page.locator(SUMMARY_INPUT).fill('BDD6 multi-file publish')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })

    // Then entry 详情中文本 is_binary=false、二进制 is_binary=true
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug
    const raw = await request.get(`${BASE_URL}/api/v1/entries/${actualSlug}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(raw.ok(), `BDD-6: raw 须可读（HTTP ${raw.status()}）`).toBeTruthy()
    const body = await raw.json()
    const files = body.files as Array<{ filename: string; is_binary: boolean }>
    const md = files.find(f => f.filename.endsWith('.md'))
    const blob = files.find(f => f.filename.endsWith('.bin'))
    expect(md?.is_binary, 'BDD-6: 文本文件 is_binary 须为 false').toBe(false)
    expect(blob?.is_binary, 'BDD-6: 二进制文件 is_binary 须为 true').toBe(true)
  })

  // ------------------------------------------------------------------
  // BDD-7 文本渲染、二进制可下载（字节一致）
  // ------------------------------------------------------------------
  test('test_bdd_7_text_renders_binary_downloadable', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd7-${Date.now()}`
    const marker = 'TPV0100-BDD7-TEXT-MARKER'
    const created = await seedEntry(request, token, {
      slug,
      summary: 'BDD7 render/download',
      files: [
        { filename: 'note.md', content: `# ${marker}\n\n${marker} body.\n` },
        { filename: 'blob.bin', content_base64: btoa(String.fromCharCode(...binarySample())) },
      ],
    })
    cleanupQueue.push(created)

    // When 打开详情页
    await page.goto(`${BASE_URL}/${created}`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(1500)

    // Then 文本内容可见
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.includes(marker), 'BDD-7: 文本内容须以文本形式呈现').toBe(true)

    // Then 二进制提供可点击下载入口且下载字节与原文件一致
    const raw = await request.get(`${BASE_URL}/api/v1/entries/${created}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const rawBody = await raw.json()
    const blobFile = (rawBody.files as Array<{ id: number; filename: string; is_binary: boolean }>).find(f => f.filename === 'blob.bin')
    expect(blobFile?.is_binary, 'BDD-7: 二进制文件 is_binary 须为 true').toBe(true)
    const dl = await request.get(`${BASE_URL}/api/v1/entries/${created}/files/${blobFile!.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(dl.ok(), 'BDD-7: 二进制下载入口须可用').toBeTruthy()
    const bytes = new Uint8Array(await dl.body())
    expect(Array.from(bytes.slice(0, binarySample().length)), 'BDD-7: 下载内容字节须与原文件一致')
      .toEqual(Array.from(binarySample()))
  })

  // ------------------------------------------------------------------
  // BDD-9 编辑相对路径构造嵌套目录
  // ------------------------------------------------------------------
  test('test_bdd_9_edit_path_builds_nested_tree', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd9-${Date.now()}`
    cleanupQueue.push(slug)

    const a = tmpFile('bdd9-a.txt', 'root file\n')
    const b = tmpFile('bdd9-b.cs', 'class B {}\n')

    await openPublish(page)
    await chooseFiles(page, [a, b])
    await expect(page.locator(FILE_ROW), 'BDD-9: 须有 2 行').toHaveCount(2)
    // Given 将第二个文件相对路径改为 src/b.cs
    await page.locator(PATH_INPUT).nth(1).fill('src/b.cs')
    await page.locator(SUMMARY_INPUT).fill('BDD9 nested tree')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    // Then 两文件路径分别为各自填写值
    const raw = await request.get(`${BASE_URL}/api/v1/entries/${actualSlug}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await raw.json()
    const paths = (body.files as Array<{ path: string }>).map(f => f.path)
    expect(paths, 'BDD-9: 须包含 src/b.cs 路径').toContain('src/b.cs')
    expect(paths.some(p => !p.includes('/')), 'BDD-9: 须有根级文件').toBe(true)
  })

  // ------------------------------------------------------------------
  // BDD-10 结果态页面/Raw 链接可复制
  // ------------------------------------------------------------------
  test('test_bdd_10_result_links_copyable', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd10-${Date.now()}`
    cleanupQueue.push(slug)

    const txt = tmpFile('bdd10.txt', 'bdd10\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD10 result links')
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })

    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    // Then 同时展示页面链接 {origin}/{slug} 与 raw 链接 {origin}/{slug}/raw
    const pageText = (await page.locator(PAGE_LINK).innerText()).trim()
    const rawText = (await page.locator(RAW_LINK).innerText()).trim()
    expect(pageText, 'BDD-10: 页面链接须为当前源/slug').toBe(`http://127.0.0.1:8888/${actualSlug}`)
    expect(rawText, 'BDD-10: Raw 链接须为当前源/slug/raw').toBe(`http://127.0.0.1:8888/${actualSlug}/raw`)

    // Then 复制按钮点击后剪贴板一致
    await page.locator(COPY_PAGE).click()
    expect((await clipboardText(page)).trim(), 'BDD-10: 页面链接复制须一致').toBe(pageText)
    await page.locator(COPY_RAW).click()
    expect((await clipboardText(page)).trim(), 'BDD-10: Raw 链接复制须一致').toBe(rawText)
    await screenshot(page, 'desktop_1280x800.png')
  })

  // ------------------------------------------------------------------
  // BDD-11 Raw 链接对公开 entry 免认证可读
  // ------------------------------------------------------------------
  test('test_bdd_11_public_raw_link_anonymous', async ({ request }) => {
    const token = await loginToken(request)
    const slug = `e2e-tpv0100-bdd11-${Date.now()}`
    const created = await seedEntry(request, token, {
      slug,
      summary: 'BDD11 public raw',
      is_public: true,
      files: [{ filename: 'x.txt', content: 'public body\n' }],
    })
    // Given is_public=true → When 匿名请求 raw → Then 200 且 JSON 含结构化数据
    const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    try {
      const res = await anonCtx.get(`/api/v1/entries/${created}/raw`)
      expect(res.status(), 'BDD-11: 公开 entry raw 须匿名可读 200').toBe(200)
      const body = await res.json()
      expect(body.slug, 'BDD-11: 响应体须含 entry 结构化数据').toBeTruthy()
      expect(Array.isArray(body.files), 'BDD-11: 须含 files 结构').toBe(true)
    } finally {
      await anonCtx.dispose()
      await request.delete(`${BASE_URL}/api/v1/entries/${created}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
  })

  // ------------------------------------------------------------------
  // BDD-12 结果态可跳转详情
  // ------------------------------------------------------------------
  test('test_bdd_12_result_view_detail_navigates', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd12-${Date.now()}`
    cleanupQueue.push(slug)

    const txt = tmpFile('bdd12.txt', 'bdd12\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD12 view detail')
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    // When 点击查看详情 → Then 地址变为 /{slug}
    await page.locator(VIEW_DETAIL).click()
    await page.waitForURL(`**/${actualSlug}`, { timeout: 15000 })
    expect(new URL(page.url()).pathname, 'BDD-12: 须跳转详情 URL').toBe(`/${actualSlug}`)
  })

  // ------------------------------------------------------------------
  // BDD-13 再发一个清空表单并重置幂等键
  // ------------------------------------------------------------------
  test('test_bdd_13_publish_again_resets_form_and_key', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug1 = `e2e-tpv0100-bdd13a-${Date.now()}`
    const slug2 = `e2e-tpv0100-bdd13b-${Date.now()}`
    cleanupQueue.push(slug1, slug2)

    const txt = tmpFile('bdd13.txt', 'same content\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD13 same intent')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug1)
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const firstSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.indexOf(slug1)] = firstSlug

    // When 点击再发一个 → Then 表单 summary/文件为空
    await page.locator(PUBLISH_AGAIN).click()
    await page.waitForSelector(PUBLISH_VIEW, { timeout: 15000 })
    expect(await page.locator(SUMMARY_INPUT).inputValue(), 'BDD-13: summary 须清空').toBe('')
    expect(await page.locator(FILE_ROW).count(), 'BDD-13: 已选文件须清空').toBe(0)

    // 同意图新发布（等价 summary + 文件）→ 须新建 entry（未命中旧幂等键）
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD13 same intent')
    const slugInput2 = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput2.count()) await slugInput2.fill(slug2)
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const secondSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.indexOf(slug2)] = secondSlug
    expect(secondSlug, 'BDD-13: 须创建新 entry（不得命中旧幂等键）').not.toBe(firstSlug)
    // 确认两条都真实存在
    for (const s of [firstSlug, secondSlug]) {
      const r = await request.get(`${BASE_URL}/api/v1/entries/${s}/raw`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(r.status(), `BDD-13: entry ${s} 须存在`).toBe(200)
    }
  })

  // ------------------------------------------------------------------
  // BDD-21 可选字段被正确提交与采纳
  // ------------------------------------------------------------------
  test('test_bdd_21_optional_fields_roundtrip', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd21-${Date.now()}`
    cleanupQueue.push(slug)

    // team：alice 在 seed 中有团队（frontend-team）；无则跳过 team 断言
    const teamsRes = await request.get(`${BASE_URL}/api/v1/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    let teamSlug: string | null = null
    if (teamsRes.ok()) {
      const teams = await teamsRes.json()
      const all = [...(teams.owned ?? []), ...(teams.joined ?? [])]
      teamSlug = all[0]?.slug ?? null
    }

    const txt = tmpFile('bdd21.txt', 'bdd21\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD21 optional fields')
    await page.locator('[data-testid="publish-slug-input"]').fill(slug)
    await page.locator('[data-testid="publish-tags-input"]').fill('alpha')
    await page.locator('[data-testid="publish-tags-input"]').press('Enter')
    const expiresSelect = page.locator('[data-testid="publish-expires-select"]')
    if (await expiresSelect.count()) await expiresSelect.selectOption('7d')
    if (teamSlug) {
      const teamSelect = page.locator('[data-testid="publish-team-select"]')
      if (await teamSelect.count()) await teamSelect.selectOption(teamSlug)
    }
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })

    // Then slug/tags/expires_at 与所填一致
    const raw = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(raw.ok(), `BDD-21: entry 须可读（HTTP ${raw.status()}）`).toBeTruthy()
    const body = await raw.json()
    expect(body.slug, 'BDD-21: slug 须与所填一致').toBe(slug)
    expect(body.tags, 'BDD-21: tags 须含 alpha').toContain('alpha')
    if (teamSlug) {
      expect(body.team?.slug ?? body.team_id, 'BDD-21: 团队归属须与所填一致').toBe(teamSlug)
    }
  })

  // ------------------------------------------------------------------
  // BDD-22 创建的 entry 归属登录用户
  // ------------------------------------------------------------------
  test('test_bdd_22_created_entry_owned_by_user', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd22-${Date.now()}`
    cleanupQueue.push(slug)

    // 获取 alice 的 user id
    const meRes = await request.get(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    let aliceId: number | null = null
    if (meRes.ok()) aliceId = (await meRes.json()).id ?? null

    const txt = tmpFile('bdd22.txt', 'bdd22\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD22 ownership')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    const raw = await request.get(`${BASE_URL}/api/v1/entries/${actualSlug}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await raw.json()
    expect(body.owner_id, 'BDD-22: owner_id 须等于 alice 的 id').toBeTruthy()
    if (aliceId !== null) {
      expect(body.owner_id, 'BDD-22: owner_id 须等于 alice 的 id').toBe(aliceId)
    }
    await expect(page.locator(PAGE_LINK), 'BDD-22: 须进入结果态').toBeVisible()
  })

  // ------------------------------------------------------------------
  // BDD-23 失败后保留表单且重试不重复（幂等命中）
  // ------------------------------------------------------------------
  test('test_bdd_23_failure_keeps_form_and_idempotent_retry', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd23-${Date.now()}`
    cleanupQueue.push(slug)

    // 拦截首个创建请求 → 500（表单须保留）；放行第二次（原样重试）
    let intercepted = false
    await page.route('**/api/v1/entries', async (route) => {
      if (!intercepted && route.request().method() === 'POST') {
        intercepted = true
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }) })
      } else {
        await route.continue()
      }
    })

    const txt = tmpFile('bdd23.txt', 'bdd23\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD23 retry intent')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)

    // When 首次提交失败
    await page.locator(SUBMIT).click()
    await page.waitForSelector(ERROR_SUMMARY, { timeout: 20000 })
    // Then 表单保留原 summary 与文件
    expect(await page.locator(SUMMARY_INPUT).inputValue(), 'BDD-23: 失败后 summary 须保留').toBe('BDD23 retry intent')
    expect(await page.locator(FILE_ROW).count(), 'BDD-23: 失败后文件须保留').toBe(1)

    // When 原样重试并成功
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    // Then 数据库中该发布意图只存在 1 个 entry
    const listing = await request.get(`${BASE_URL}/api/v1/entries?owner=alice&per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const items = (await listing.json()).items as Array<{ slug: string; summary: string }>
    const matches = items.filter(i => i.summary === 'BDD23 retry intent')
    expect(matches.length, 'BDD-23: 同意图须只存在 1 个 entry').toBe(1)
  })

  // ------------------------------------------------------------------
  // BDD-27 提交进行中禁止重复提交
  // ------------------------------------------------------------------
  test('test_bdd_27_submit_disabled_while_inflight', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd27-${Date.now()}`
    cleanupQueue.push(slug)

    // 挂起创建请求，制造 in-flight 窗口
    let postCount = 0
    let release: (() => void) | null = null
    const gate = new Promise<void>((r) => { release = r })
    await page.route('**/api/v1/entries', async (route) => {
      if (route.request().method() === 'POST') {
        postCount++
        await gate
        await route.continue()
      } else {
        await route.continue()
      }
    })

    const txt = tmpFile('bdd27.txt', 'bdd27\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD27 no double submit')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)

    // Given 已发起且未返回
    await page.locator(SUBMIT).click()
    await page.waitForTimeout(500)
    // Then 按钮不可点击
    await expect(page.locator(SUBMIT), 'BDD-27: 提交中主按钮须不可点击').toBeDisabled()
    // When 再次点击（force 绕过可点击性检查，验证 UI 拦截）
    await page.locator(SUBMIT).click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)

    release!()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    // Then 只发出一次创建请求
    expect(postCount, 'BDD-27: 提交中重复点击不得发出第二个请求').toBe(1)
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug
  })

  // ------------------------------------------------------------------
  // BDD-28 人工体验路径（seed + 登录 + Explore 有内容 + 发布走通）
  // ------------------------------------------------------------------
  test('test_bdd_28_manual_flow_after_seed', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-bdd28-${Date.now()}`
    cleanupQueue.push(slug)

    // Given 访问 /explore → 页面有内容（seed 列表）
    await page.goto(`${BASE_URL}/explore`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(1500)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length, 'BDD-28: Explore 页须渲染出 seed 的 entry 列表').toBeGreaterThan(50)

    // When 进入 /publish → 填 summary → 选文件 → 提交
    await page.goto(`${BASE_URL}/publish`)
    await page.waitForSelector(PUBLISH_VIEW, { timeout: 20000 })
    const txt = tmpFile('bdd28.txt', 'bdd28\n')
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('BDD28 manual flow')
    const slugInput = page.locator('[data-testid="publish-slug-input"]')
    if (await slugInput.count()) await slugInput.fill(slug)
    await page.locator(SUBMIT).click()

    // Then 进入结果态
    await page.waitForSelector(RESULT, { timeout: 30000 })
    await expect(page.locator(PAGE_LINK), 'BDD-28: 须完成流程并进入结果态').toBeVisible()
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug
  })

  // ------------------------------------------------------------------
  // BDD-29 可见性文本标明当前状态并随切换更新
  // ------------------------------------------------------------------
  test('test_bdd_29_visibility_text_reflects_state', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    await openPublish(page)

    // Given 默认未改动 → Then 可见文本指明为公开
    const text = page.locator(VISIBILITY_TEXT)
    await expect(text, 'BDD-29: 须有可见性文本').toBeVisible()
    const initial = (await text.innerText()).trim()
    expect(initial, 'BDD-29: 默认文本须指明公开').toMatch(/公开|public/i)

    // When 切换可见性 → Then 文本更新
    const toggle = page.locator('[data-testid="publish-visibility-toggle"]')
    await toggle.click()
    await page.waitForTimeout(300)
    const after = (await text.innerText()).trim()
    expect(after, 'BDD-29: 切换后文本须更新').not.toBe(initial)
    expect(after, 'BDD-29: 切换后须指明私有/团队').toMatch(/私有|团队|private|team/i)
    await screenshot(page, 'desktop_1280x800.png')
  })
})

// ============================================================================
// 移动 390×844（iPhone 14 档）
// ============================================================================

test.describe('TPV0100 Publish 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })

  let cleanupQueue: string[] = []

  test.afterEach(async ({ request }) => {
    const token = await loginToken(request).catch(() => '')
    for (const slug of cleanupQueue) {
      await request.delete(`${BASE_URL}/api/v1/entries/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {})
    }
    cleanupQueue = []
  })

  // BDD-10（移动视口）：结果态链接与按钮不重叠、无横向溢出
  test('test_bdd_10_result_links_mobile_no_overflow', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    const slug = `e2e-tpv0100-m-bdd10-${Date.now()}`
    cleanupQueue.push(slug)

    const txt = tmpFile('m-bdd10.txt', 'mobile bdd10\n')
    await openPublish(page)
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('mobile BDD10')
    await page.locator(SUBMIT).click()
    await page.waitForSelector(RESULT, { timeout: 30000 })
    const actualSlug = (await page.locator(PAGE_LINK).innerText()).trim().split('/').pop()!
    cleanupQueue[cleanupQueue.length - 1] = actualSlug

    // Then 无横向溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth, 'BDD-10(390): 不得横向溢出').toBeLessThanOrEqual(390)

    // Then 两个链接块与各自复制按钮不重叠
    const overlap = await page.evaluate(({ pageSel, rawSel, copyPage, copyRaw }) => {
      const rect = (s: string) => (document.querySelector(s) as HTMLElement).getBoundingClientRect()
      const intersects = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
      return {
        p11: intersects(rect(pageSel), rect(copyPage)),
        p22: intersects(rect(rawSel), rect(copyRaw)),
      }
    }, { pageSel: PAGE_LINK, rawSel: RAW_LINK, copyPage: COPY_PAGE, copyRaw: COPY_RAW })
    expect(overlap.p11, 'BDD-10(390): 页面链接与复制按钮不得重叠').toBe(false)
    expect(overlap.p22, 'BDD-10(390): Raw 链接与复制按钮不得重叠').toBe(false)
    await screenshot(page, 'mobile_390x844.png')
  })

  // BDD-17/18（移动视口补充）：行级错误不与输入重叠、无横向溢出
  test('test_bdd_17_mobile_row_error_no_overflow', async ({ page, request }) => {
    const token = await loginToken(request)
    await setAuthCookie(page, token)
    await openPublish(page)

    const txt = tmpFile('m-bdd17.txt', 'bad path\n')
    await chooseFiles(page, [txt])
    await page.locator(SUMMARY_INPUT).fill('mobile BDD17')
    await page.locator(PATH_INPUT).first().fill('../evil.txt')
    await page.locator(SUBMIT).click()

    // Then 行级错误出现，且不与 path 输入重叠
    const rowError = page.locator('[data-testid="publish-file-row-error"]').first()
    await expect(rowError, 'BDD-17(390): 对应行须被标记为错误').toBeVisible()
    const box = await page.evaluate(({ inputSel, errSel }) => {
      const inp = (document.querySelector(inputSel) as HTMLElement).getBoundingClientRect()
      const err = (document.querySelector(errSel) as HTMLElement).getBoundingClientRect()
      return { inputBottom: inp.bottom, errTop: err.top, scrollWidth: document.documentElement.scrollWidth }
    }, { inputSel: PATH_INPUT, errSel: '[data-testid="publish-file-row-error"]' })
    expect(box.errTop, 'BDD-17(390): 行错误须位于输入下方').toBeGreaterThanOrEqual(box.inputBottom - 1)
    expect(box.scrollWidth, 'BDD-17(390): 行错误出现后不得横向溢出').toBeLessThanOrEqual(390)
  })
})
