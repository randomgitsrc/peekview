// TPV0099 全屏模式链接 `/{slug}/f` —— E2E（需登录 / 自建私有 entry 组，3 条 BDD）
//
// 运行：E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test
// 前置：debug backend :8888 在线 + `make debug-seed` 已灌 seed
// 覆盖（P2-design.md §6.1 映射表，事后不得改）：BDD-9, BDD-10, BDD-15
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 切分轴 = **认证前提**（P2 §6.1）：三条 BDD 都需要登录态，
//    与主 spec（tpv0099-fullscreen-link.spec.ts，16 条匿名可达）分离。
//    混在一个 spec 里会让**登录态污染匿名用例**（cookie 在同一 browser context 内共享），
//    产生脆弱且难诊断的失败。
// ⚠️ BDD-9 前置（P1 §2.4 实测）：`markdown-test` 虽 `is_public: true` 但带
//    `team_id: frontend-team` → **匿名 404**，须 alice/bob 登录。
// ⚠️ BDD-15 前置（同上）：`mermaid-charts` 同样 team-scoped → 须登录。
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 双视口钉定（P2 §6.1）：playwright.config.ts 的两个 project 默认视口
//    1280×720 / 393×727 均非 BDD 档位 → 显式 `test.use({ viewport: { width: 1280, height: 800 } })`。
// ─────────────────────────────────────────────────────────────────────────────
// 环境隔离：[PROD_NOT_TOUCHED] —— 全部请求走 BASE_URL（默认 :8888 debug backend），
//    自建 entry 用 `e2e-` 前缀并在 afterEach 无条件删除。

import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

/** BDD-9：需登录的 team-scoped markdown seed（含正文内标题锚点链接） */
const SLUG_MD = 'markdown-test'
/** BDD-9 的目标文件（fileId 动态解析，勿硬编码——序号随 DB 重建失效） */
const MD_FILE = 'rich-markdown.md'
/** BDD-15：需登录的 team-scoped 图表 seed */
const SLUG_MERMAID = 'mermaid-charts'

/** BDD-10 自建 entry 的正文特征串（三态区分力的锚点） */
const MARKER = 'TPV0099-SHARE-MARKER'

const ALICE = { username: 'alice', password: 'testpass123' }

const CONTENT_AREA = '[data-testid="content-area"]'

// ============================================================================
// 认证与清理（P2 §6.1「认证配对」五步 + afterEach 清理队列）
// ============================================================================

async function aliceToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { username: ALICE.username, password: ALICE.password },
  })
  expect(res.ok(), `alice 登录须成功（HTTP ${res.status()}）`).toBeTruthy()
  const body = await res.json()
  expect(body.access_token, 'BDD-9/10/15 前置: 须取得 access_token').toBeTruthy()
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

/** 动态解析 seed 内某文件的 fileId（P2 §8 硬约束：勿硬编码 `?firstFileId=43`）。 */
async function resolveFileId(request: APIRequestContext, slug: string, filename: string, token?: string): Promise<number> {
  const res = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  expect(res.ok(), `${slug}/raw 须可读（HTTP ${res.status()}）`).toBeTruthy()
  const raw = await res.json()
  const file = (raw.files as Array<{ id: number; filename: string }>).find((f) => f.filename === filename)
  expect(file, `${slug} 内须存在文件 ${filename}`).toBeTruthy()
  return file!.id
}

/** 内容区是否可见目标文本（用 textContent 口径，避开 innerText 的可见性裁剪）。 */
async function contentAreaContainsMarker(page: Page, marker: string): Promise<boolean> {
  return page.evaluate(({ caSel, m }) => {
    const ca = document.querySelector(caSel)
    return !!ca && (ca.textContent || '').includes(m)
  }, { caSel: CONTENT_AREA, m: marker })
}

// ============================================================================
// 桌面 1280×800
// ============================================================================
test.describe('TPV0099 Auth 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ---------------------------------------------------------------
  // BDD-9: markdown entry 带目录时无目录侧栏且锚点滚动正常
  // ---------------------------------------------------------------
  test('test_bdd_9_toc_hidden_and_anchor_scroll_works', async ({ page, request }) => {
    const token = await aliceToken(request)
    await setAuthCookie(page, token)

    // Given 通过 /{slug}/f 打开含标题层级与正文内标题锚点链接的 markdown entry
    //   （须带 ?firstFileId；fileId 动态解析）
    const fileId = await resolveFileId(request, SLUG_MD, MD_FILE, token)
    await page.goto(`${BASE_URL}/${SLUG_MD}/f?firstFileId=${fileId}`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForSelector(`${CONTENT_AREA}, .not-found, .error-state`, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1500)

    await expect(page.locator(CONTENT_AREA),
      'BDD-9 Given「全屏视图已加载完成」不成立：内容区不存在').toHaveCount(1)

    // Given 前置：正文内确有待点的标题锚点链接（P1 实测 10 条）
    const anchorCount = await page.locator(`${CONTENT_AREA} a[href^="#"]`).count()
    expect(anchorCount, 'BDD-9 Given: 正文内须存在 `](#...)` 标题锚点链接（实测 10 条）').toBeGreaterThan(0)

    // 目录侧栏不可见 + 滚动容器限定为 .content-area（该页滚动发生在容器内，window.scrollY 恒为 0）
    const before = await page.evaluate((caSel) => {
      const ca = document.querySelector(caSel) as HTMLElement
      const toc = document.querySelector('.toc-sidebar') as HTMLElement | null
      return {
        scrollTop: ca.scrollTop,
        tocDisplay: toc ? getComputedStyle(toc).display : 'ABSENT',
        tocHeight: toc ? toc.getBoundingClientRect().height : -1,
        windowScrollY: window.scrollY,
      }
    }, CONTENT_AREA)

    // When 点击正文内的一条 `](#...)` 标题锚点链接（触发路径 = 浏览器默认的锚点跳转）
    await page.locator(`${CONTENT_AREA} a[href^="#"]`).last().click()
    await page.waitForTimeout(1500)

    const after = await page.evaluate((caSel) => {
      const ca = document.querySelector(caSel) as HTMLElement
      const toc = document.querySelector('.toc-sidebar') as HTMLElement | null
      return {
        scrollTop: ca.scrollTop,
        tocDisplay: toc ? getComputedStyle(toc).display : 'ABSENT',
        tocHeight: toc ? toc.getBoundingClientRect().height : -1,
        windowScrollY: window.scrollY,
        zen: !!document.querySelector('.entry-detail.zen-mode'),
        pathname: location.pathname,
      }
    }, CONTENT_AREA)

    // Then 目录侧栏不可见
    const tocInvisible = after.tocDisplay === 'none' || after.tocDisplay === 'ABSENT' || after.tocHeight <= 0
    expect(tocInvisible, `BDD-9: 目录侧栏须不可见（display=${after.tocDisplay}, height=${after.tocHeight}）`).toBe(true)

    // Then **滚动容器 .content-area 自身**的 scrollTop 在点击后增加 > 0
    expect(after.scrollTop, `BDD-9: .content-area.scrollTop 须由 ${before.scrollTop} 增加（实测 0 → 13691）`).toBeGreaterThan(before.scrollTop)

    // 附：锚点跳转不得破坏全屏视图
    expect(after.zen, 'BDD-9: 锚点跳转后仍须处于全屏视图').toBe(true)
    expect(after.pathname, 'BDD-9: 锚点跳转不得改变 pathname（须保持在 /f 全屏视图）').toBe(`/${SLUG_MD}/f`)
    // ⚠️ 负向对照（防恒真假绿）：P1 实测 `window.scrollY` **恒为 0**（滚动在容器内），
    //    故若把判据写成 window.scrollY，则正确实现与失败态都判 0 → 恒真失效。
    //    本条显式断言 window.scrollY 不参与判定，并把判据绑在 .content-area 上。
    expect(before.windowScrollY, 'BDD-9: window.scrollY 恒为 0（滚动容器是 .content-area，判据不得绑 window）').toBe(0)
  })

  // ---------------------------------------------------------------
  // BDD-15: 图表类 entry（mermaid）全屏下渲染与内置查看能力正常
  // ---------------------------------------------------------------
  test('test_bdd_15_mermaid_renders_and_builtin_viewer_works', async ({ page, request }) => {
    const token = await aliceToken(request)
    await setAuthCookie(page, token)

    // Given 通过 /{slug}/f 打开含 mermaid 代码块的 markdown entry
    await page.goto(`${BASE_URL}/${SLUG_MERMAID}/f`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForSelector('.diagram-block, .not-found, .error-state', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2500)

    await expect(page.locator(CONTENT_AREA),
      'BDD-15 Given「全屏视图已加载完成」不成立：内容区不存在').toHaveCount(1)

    // Then 图表 SVG 已渲染（画布尺寸大于 0）
    await expect(page.locator('.diagram-block').first(), 'BDD-15: .diagram-block 须存在').toBeVisible()
    const svgBox = await page.evaluate(() => {
      const svg = document.querySelector('.diagram-block svg')
      if (!svg) return null
      const r = svg.getBoundingClientRect()
      return { w: r.width, h: r.height }
    })
    expect(svgBox, 'BDD-15: 内联图表 SVG 须已渲染（实测 850×400）').not.toBeNull()
    expect(svgBox!.w, 'BDD-15: 图表 SVG 宽度须 > 0').toBeGreaterThan(0)
    expect(svgBox!.h, 'BDD-15: 图表 SVG 高度须 > 0').toBeGreaterThan(0)

    // 全屏形态成立（chrome 不可见、URL 保留 /f）
    expect(await page.locator('.entry-detail.zen-mode').count(), 'BDD-15: 须处于全屏视图').toBeGreaterThan(0)

    // When 点击图表工具栏的全屏按钮
    const fsBtn = page.locator('.fullscreen-btn').first()
    await expect(fsBtn, 'BDD-15: 图表工具栏全屏按钮须存在').toHaveCount(1)
    await expect(page.locator('.diagram-modal'), 'BDD-15: 点击前弹层须不可见').toHaveCount(0)
    await fsBtn.click()

    // Then 全屏弹层可见
    await expect(page.locator('.diagram-modal'), 'BDD-15: 点击全屏按钮后弹层须可见').toBeVisible()
    await expect(page.locator('.diagram-modal'), 'BDD-15: 弹层须唯一').toHaveCount(1)

    // When 点击弹层的关闭控件
    const closeBtn = page.locator('.diagram-modal .close-btn').first()
    await expect(closeBtn, 'BDD-15: 弹层关闭控件 .close-btn 须存在').toHaveCount(1)
    await closeBtn.click()
    await page.waitForTimeout(800)

    // Then 弹层关闭并回到内联视图
    await expect(page.locator('.diagram-modal'), 'BDD-15: 点关闭控件后弹层须消失').toHaveCount(0)
    await expect(page.locator('.diagram-block svg').first(), 'BDD-15: 关闭后内联 SVG 须恢复可见').toBeVisible()

    // Then 全屏视图未被弹层开合破坏（URL 仍保留 /f 后缀）
    expect(new URL(page.url()).pathname, 'BDD-15: 弹层开合不得改变 URL（须保留 /f）').toBe(`/${SLUG_MERMAID}/f`)
    expect(await page.locator('.entry-detail.zen-mode').count(), 'BDD-15: 弹层开合后仍须处于全屏视图').toBeGreaterThan(0)

    // 说明（P1 rev1 必修 5）：本条**不要求** Escape 关闭弹层（当前实现无此能力，
    // 且 t022 的 Escape 断言所依赖选择器已死）——只要求既有关闭路径可用。
    // 注：中文 BDD 原文写"弹层的关闭控件"，勿用已死的 `.mermaid-action-btn` / `.diagram-modal-overlay`。
  })

  // ---------------------------------------------------------------
  // BDD-10: 私有 entry + share token 组合可用
  //
  // ⚠️ 认证配对（P2 §6.1 形态唯一，五步）：alice 登录取 token
  //    → 同一 token 建**私有** entry（is_public:false，e2e- 前缀）
  //    → 同一 token 建 share 收 share_url/token
  //    → **匿名**带 ?share=<token> 访问 /{slug}/f（本条 Then）
  //    → 同一 token 删除 entry（清理）
  //    为什么不能"匿名创建 + 匿名删除"（三条服务端约束，P2 已实测）：
  //      ① 匿名建 entry 被强制改写 is_public=True（api/entries.py:135-139）→ 永不产生 share token
  //      ② share 端点全部 Depends(require_auth)（api/shares.py:18-23）→ 匿名 POST /shares = 401
  //      ③ 公开 entry 禁建 share（services/share_service.py:54-55）→ 400
  // ---------------------------------------------------------------
  test.describe('BDD-10 私有 entry + share token', () => {
    // afterEach 清理队列：存 {slug, share_id} 二元组（非仅 slug）
    //   —— share 记录随 entry 删除失效，故须同存 id 以便断言/兜底撤销
    let cleanupQueue: Array<{ slug: string; shareId: number | null }> = []

    test.afterEach(async ({ request }) => {
      const token = await aliceToken(request).catch(() => '')
      if (!token) { cleanupQueue = []; return }
      for (const item of cleanupQueue) {
        // 无条件删除（不因任何非 2xx 中止）；403/404 视为已清理
        await request.delete(`${BASE_URL}/api/v1/entries/${item.slug}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
        // 「无残留」判据落在**结果**上：删除后 alice 复查 raw 须为 404
        const check = await request.get(`${BASE_URL}/api/v1/entries/${item.slug}/raw`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        expect(check.status(), `清理钩子: entry ${item.slug} 删除后 alice 复查 raw 须为 404（实测 ${check.status()}）`).toBe(404)
      }
      cleanupQueue = []
    })

    test('test_bdd_10_private_entry_share_token_fullscreen', async ({ page, request }) => {
      // ---- 步骤 1：alice 登录 ----
      const token = await aliceToken(request)

      // ---- 步骤 2：同一 token 创建**私有** entry（e2e- 前缀） ----
      // ⚠️ 区分两个 slug（P3 修正轮 2 / DG-3）：
      //    requestSlug = 请求时想用的 slug；slug = **服务端实际返回的 slug**。
      //    后端 `entry_service._retry_with_slug_suffix` 在 slug 冲突（TOCTOU 保护）时
      //    **静默创建 `{requestSlug}-2` 并返回它**（本 spec 已实测复现）。
      //    而 `playwright.config.ts` 是 `fullyParallel: true` → chromium 与 Mobile Chrome
      //    并发跑同一用例，两者 `Date.now()` 毫秒级撞车 → 冲突是真实可发生的。
      //    故**清理队列与后续一切操作必须一律用服务端 slug**，否则：
      //      ① 真实资源 `X-2` 永不删除 → 残留
      //      ② afterEach 复查删错的 `X`（本不存在）→ 断言 `raw===404` 通过但事实相反 = **假绿**
      //      ③ `DELETE X` 可能误删兄弟 project 的 fixture
      //    先例：`e2e/t069-settings-refresh-guard.e2e.spec.ts` 一律用 `body.slug`。
      const requestSlug = `e2e-tpv0099-share-${Date.now()}`
      const createRes = await request.post(`${BASE_URL}/api/v1/entries`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          slug: requestSlug,
          summary: 'TPV0099 BDD-10 私有 share 全屏链接',
          is_public: false,
          files: [{ filename: 'marker.md', content: `# ${MARKER}\n\n${MARKER} 正文内容。\n` }],
        },
      })
      expect(createRes.ok(), `BDD-10 前置: 建私有 entry 须成功（HTTP ${createRes.status()}）`).toBeTruthy()
      const created = await createRes.json()
      const slug = created.slug as string
      // 防回归自证：清理队列登记的必须是**服务端** slug（冲突时后端会改后缀为 `-2`）。
      // 若此处退回登记 `requestSlug`，则上面①~③三重后果复现——本条让该缺陷可被测出。
      expect(slug, 'BDD-10 清理钩子: 必须登记服务端返回的 slug（防 -2 后缀残留）').toBeTruthy()
      // 注册清理（创建即注册，无论后续断言成败）
      cleanupQueue.push({ slug, shareId: null })
      // 登记值**活体校验**：登记对象须是 alice 可读的真实资源（200）。
      // 冲突场景下若退回登记请求 slug `X`，则真实资源在 `X-2`，`GET X/raw` 必为 404 → 本条 fail。
      // 这正是原缺陷「登记了 phantom slug → afterEach 复查通过但事实相反（假绿）」的反向断言。
      const registeredAlive = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(registeredAlive.status(),
        `BDD-10 清理钩子: 登记的 slug 须指向真实资源（请求 slug=${requestSlug} / 服务端 slug=${slug}）`).toBe(200)

      // ---- 步骤 3：同一 token 创建 share ----
      const shareRes = await request.post(`${BASE_URL}/api/v1/entries/${slug}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { expires_in: '1h' },
      })
      expect(shareRes.ok(), `BDD-10 前置: 建 share 须成功（HTTP ${shareRes.status()}）`).toBeTruthy()
      const shareBody = await shareRes.json()
      const shareToken = String(shareBody.share_url || '').split('share=')[1]
      expect(shareToken, `BDD-10 前置: share_url 须含 token（实测 ${shareBody.share_url}）`).toBeTruthy()
      cleanupQueue[0] = { slug, shareId: shareBody.id ?? null }

      // ---- 区分力判据前置（P2 §6.2 防恒真退化）：三态结果必须互不相同 ----
      // 以 API 层先确立基线（无 token / 伪 token 均不可读，真 token 可读）
      // ⚠️ 必须用**独立的匿名 APIRequestContext**：上面的 alice 登录取 token 时，
      //    `Set-Cookie: peekview_token=...` 会写入 fixture 的 `request` context，
      //    此后该 context 上任何不带 Authorization 的请求都会被自动以 alice 身份发出
      //    → 基线恒为 200，三态区分力失效（且失败发生在任何页面交互之前）。
      const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })
      try {
        const anonNoToken = await anonCtx.get(`/api/v1/entries/${slug}/raw`)
        const anonFakeToken = await anonCtx.get(`/api/v1/entries/${slug}/raw?share=faketoken000000`)
        const anonRealToken = await anonCtx.get(`/api/v1/entries/${slug}/raw?share=${shareToken}`)
        expect(anonNoToken.status(), 'BDD-10 基线: 匿名无 token 读私有 entry 须 404').toBe(404)
        expect(anonFakeToken.status(), 'BDD-10 基线: 匿名伪 token 须 404').toBe(404)
        expect(anonRealToken.status(), 'BDD-10 基线: 匿名真 token 须 200').toBe(200)
      } finally {
        await anonCtx.dispose()
      }

      // ---- 步骤 4：先测「无 token」态（匿名 context，三个结果互不相同的前提） ----
      await page.goto(`${BASE_URL}/${slug}/f`)
      await page.waitForSelector('#app > *', { timeout: 20000 })
      await page.waitForTimeout(1500)
      const noTokenVisible = await contentAreaContainsMarker(page, MARKER)
      expect(noTokenVisible, `BDD-10 区分力: 无 token 访问 /{slug}/f 时私有正文「${MARKER}」**不可见**`).toBe(false)

      // ---- 伪 token 态 ----
      await page.goto(`${BASE_URL}/${slug}/f?share=faketoken000000`)
      await page.waitForSelector('#app > *', { timeout: 20000 })
      await page.waitForTimeout(1500)
      const fakeTokenVisible = await contentAreaContainsMarker(page, MARKER)
      expect(fakeTokenVisible, `BDD-10 区分力: 伪 token 访问 /{slug}/f 时私有正文「${MARKER}」**不可见**`).toBe(false)

      // ---- When 匿名访问 /{slug}/f?share=<token> ----
      await page.goto(`${BASE_URL}/${slug}/f?share=${shareToken}`)
      await page.waitForSelector('#app > *', { timeout: 20000 })
      await page.waitForSelector(`${CONTENT_AREA}, .not-found, .error-state`, { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(1500)

      await expect(page.locator(CONTENT_AREA),
        'BDD-10 Given「全屏视图已加载完成」不成立：内容区不存在').toHaveCount(1)
      const realTokenVisible = await contentAreaContainsMarker(page, MARKER)

      // Then 私有内容主体文本可见（不出现鉴权失败或无权限提示）
      expect(realTokenVisible, `BDD-10: 带真实 share token 须可见私有正文「${MARKER}」`).toBe(true)
      const bodyText = await page.locator('body').innerText()
      expect(/无权|forbidden|Unauthorized|403|401/i.test(bodyText),
        'BDD-10: 不得出现鉴权失败 / 无权限提示').toBe(false)

      // Then 全屏视图成立（chrome 均不可见）
      expect(await page.locator('.entry-detail.zen-mode').count(), 'BDD-10: 须处于全屏视图（zen 类）').toBeGreaterThan(0)
      for (const sel of ['.detail-header', '.file-sidebar', '.toc-sidebar', '[data-testid="mobile-bottom-bar"]', '.meta-tags-bar']) {
        const vis = await page.evaluate((s) => {
          return Array.from(document.querySelectorAll(s)).some((el) => {
            const r = el.getBoundingClientRect()
            if (r.width <= 0 || r.height <= 0) return false
            const cs = getComputedStyle(el)
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
          })
        }, sel)
        expect(vis, `BDD-10: 全屏视图下 chrome「${sel}」须不可见`).toBe(false)
      }

      // ---- 区分力判据（P2 §6.2 硬约束）：三结果必须互不相同 ----
      // 真实 token 可见 / 无 token 与伪 token 均不可见；若三者相同则该用例退化为恒真假绿
      expect([noTokenVisible, fakeTokenVisible, realTokenVisible],
        'BDD-10 区分力: 三态结果必须互不相同（[无token, 伪token, 真token] 应为 [false,false,true]）')
        .toEqual([false, false, true])
    })
  })
})
