// TPV0099 全屏模式链接 `/{slug}/f` —— E2E（匿名可达组，16 条 BDD）
//
// 运行：E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test
// 前置：debug backend :8888 在线 + `make debug-seed` 已灌 seed（脚本数据目录 scripts/seed-data/）
// 覆盖（P2-design.md §6.1 映射表，事后不得改）：
//   BDD-1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18, 19
// 需登录组（BDD-9/10/15）在 tpv0099-fullscreen-link-auth.spec.ts（同目录）
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 硬约束 4（P2 §6.5 验证执行约束）：BDD-1 / BDD-2 / BDD-3 必须钉定
//    **非归档、非过期** seed = `dsh-architecture`（匿名 200，P1+P3 双轮实测）。
//    理由：BDD-3 的 Given 是 **entry 无关的**（只规定"桌面视口 1280×800，全屏视图已加载完成"，
//    未指定 slug）。若挑到 archived/expired entry（如 `legacy-deploy`），BDD-3 会在一个
//    **与本任务无关的既有条件**（`.archived-banner` 不在 zen 隐藏集 → 1280×49 满宽横条、
//    top=0）上判 FAIL，被误读成"TPV0099 实现错了"。
//    **禁止**用 `legacy-deploy` 或任何 status: archived / 已过期 entry 跑 BDD-1/2/3。
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 双视口钉定：playwright.config.ts 的两个 project 默认视口是
//    `devices['Desktop Chrome']`=1280×720 与 `devices['Pixel 5']`=393×727，
//    **两个都不是 BDD 要求的档位** → 必须显式 `test.use({ viewport })`：
//    桌面 1280×800（BDD-1/2/3 及大部分断言）、移动 390×844（BDD-14）。
//    范式先例：tpv0091-unicode-preview-download.spec.ts:66,132 / t084-scroll-architecture.spec.ts:68,221。
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

// ---------- seed 钉定（P1 §3.3 逐条实测的可达性结论，勿随意替换） ----------
/** BDD-1/2/3/13/16/19：非归档、非过期的公开 seed（匿名 200，P3 实测） */
const SLUG_ARCH = 'dsh-architecture'
/** BDD-7：匿名可见的表格 entry（表体 60 行） */
const SLUG_TSV = 'tsv-server-metrics'
/** BDD-8：匿名可见的多文件 entry，正文含同 entry 文件间链接 */
const SLUG_UNICODE = 'unicode-filenames'
/** BDD-17：匿名可见的独立 SVG 文件 entry（走 ImageViewer，无 fullscreen 按钮） */
const SLUG_SVG = 'svg-icons'

// ---------- chrome 8 项（P1 §4.2 隐藏集清单；桌面实际渲染其中 4 项） ----------
const CHROME_SELECTORS = [
  '.detail-header',
  '.file-sidebar',
  '.toc-sidebar',
  '.mobile-actions',
  '.mobile-sticky-header',
  '[data-testid="mobile-bottom-bar"]',
  '.meta-tags-bar',
  '.resize-handle',
] as const

// ---------- BDD-6 词表（闭集，逐字取自 P1 BDD-6） ----------
const EXIT_WORDS = ['退出', '返回', 'exit', '关闭全屏', '退出全屏', 'Exit fullscreen', 'Close fullscreen']
/** 退出的正向对照词表：非锁死 zen 的既有公告文本（P3 实测含 `Escape`）——用于证明词表判据非恒真 */
const EXIT_PHRASES = ['Press f or Escape to exit', '按 f 退出']

const CONTENT_AREA = '[data-testid="content-area"]'

// ============================================================================
// 共用的判定辅助（全部在浏览器内 evaluate，避免跨语言语义漂移）
// ============================================================================

/**
 * 是否「可见」——可见性前置条件逐字取自 BDD-3 的 Given 口径：
 * bounding box 宽高均 > 0、display ≠ none、visibility ≠ hidden、opacity ≠ 0。
 */
async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
    }
    return Array.from(document.querySelectorAll(sel)).some((el) => visible(el))
  }, selector)
}

/**
 * 打开全屏链接，等待应用挂载完成。
 *
 * ⚠️ 刻意**不做**「等 `.entry-detail` 出现」的硬等待：在 P3（路由未实现）时
 *    `/{slug}/f` 落 `/:pathMatch(.*)*` → NotFoundView，硬等待会以 **timeout 报错**
 *    而非**断言失败**收场——那会让红灯归因变得含混（分不清"判据不成立"与"页面没渲染"）。
 *    故此处只等应用实际挂载（`#app` 有子节点 + 任一终态标记出现），
 *    把"是否进入全屏视图"交给各 BDD 的断言判定。
 *
 * @param requireContentArea Given 为「全屏视图已加载完成」的 BDD（1/2/3/4/5/6/7/8/14/16/17）
 *   传 true：以 `expect(...).toHaveCount(1)` **断言**内容区存在——保证 P3 红灯是
 *   **断言失败**（B 类）而非 DOM 访问超时；BDD-13/18/19 的判据本身不要求全屏形态，传 false。
 */
async function openFullscreen(
  page: Page,
  slug: string,
  opts: { extraQuery?: string; requireContentArea?: boolean } = {},
): Promise<void> {
  const { extraQuery = '', requireContentArea = true } = opts
  await page.goto(`${BASE_URL}/${slug}/f${extraQuery}`)
  await page.waitForSelector('#app > *', { timeout: 20000 })
  // 渲染终态：详情视图已加载正文，或渲染了路由级 NotFoundView（P3 现状）——两者都放行，由断言判定
  await page.waitForSelector(
    '.entry-detail, .not-found, .error-state, .empty-state',
    { timeout: 20000 },
  ).catch(() => { /* 终态标记之一未出现 → 交给断言失败，不在此抛 timeout */ })
  await page.waitForTimeout(800)
  if (requireContentArea) {
    await expect(page.locator(CONTENT_AREA),
      `Given「全屏视图已加载完成」不成立：内容区 ${CONTENT_AREA} 不存在`).toHaveCount(1)
  }
}

/** 断言：全屏视图形态成立（chrome 全不可见 + URL 保留 /f 后缀）。 */
async function expectFullscreenShape(page: Page, slug: string): Promise<void> {
  const zen = await page.locator('.entry-detail.zen-mode').count()
  expect(zen, `全屏视图根节点须带 zen 类（.entry-detail.zen-mode）`).toBeGreaterThan(0)
  for (const sel of CHROME_SELECTORS) {
    const vis = await isVisible(page, sel)
    expect(vis, `全屏视图下 chrome「${sel}」必须不可见（bounding box 高/宽为 0 或不在渲染树）`).toBe(false)
  }
  expect(new URL(page.url()).pathname, '全屏视图下 URL 必须保留 /f 后缀').toBe(`/${slug}/f`)
}

/** 视图状态快照（BDD-4/BDD-5 的 Then：chrome 可见性 + 内容区位置尺寸 + URL）。 */
async function snapshotViewState(page: Page) {
  return page.evaluate(({ sels, caSel }) => {
    const chrome: Record<string, boolean> = {}
    for (const s of sels) {
      chrome[s] = Array.from(document.querySelectorAll(s)).some((el) => {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return false
        const cs = getComputedStyle(el)
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
      })
    }
    const ca = document.querySelector(caSel) as HTMLElement | null
    const r = ca?.getBoundingClientRect()
    return {
      chrome,
      zenClass: !!document.querySelector('.entry-detail.zen-mode'),
      rect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
      pathname: location.pathname,
      search: location.search,
      ariaText: (document.querySelector('.sr-only[aria-live]') as HTMLElement | null)?.textContent ?? null,
    }
  }, { sels: [...CHROME_SELECTORS], caSel: CONTENT_AREA })
}

// ============================================================================
// 桌面 1280×800
// ============================================================================
test.describe('TPV0099 Desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ---------------------------------------------------------------
  // BDD-1: 全屏视图形态：/{slug}/f 直入纯内容视图
  // ---------------------------------------------------------------
  test('test_bdd_1_fullscreen_link_enters_content_only_view', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    // Then 页面呈现该 entry 的主体内容（标题与正文文本可见）
    const caText = (await page.locator(CONTENT_AREA).innerText()).trim()
    expect(caText.length, 'BDD-1: 内容区正文文本必须非空').toBeGreaterThan(0)
    expect(caText, `BDD-1: 内容区须呈现 ${SLUG_ARCH} 的主体内容（特征串「总体架构」）`).toContain('总体架构')

    // Then chrome 均不可见（标题栏 / 作者与时间信息区 / 文件侧栏 / 目录侧栏 / 移动端顶部条 / 移动端底部条）
    await expectFullscreenShape(page, SLUG_ARCH)

    // 负向对照（证明上述可见性判据非恒真）：同一 spec 内 BDD-11 在非全屏态断言
    // `.detail-header` **可见**；此处若把断言写成恒真，BDD-11 会同时失败。
    // 另：BDD-12 证明 zen 态与全屏态几何一致，而退出后 header 恢复可见（P3 实测 flex/none/flex 三段）。
  })

  // ---------------------------------------------------------------
  // BDD-2: 布局结构：全屏视图下内容区占满视口可用区
  // ---------------------------------------------------------------
  test('test_bdd_2_content_area_fills_viewport', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    const m = await page.evaluate((caSel) => {
      const ca = document.querySelector(caSel) as HTMLElement
      const r = ca.getBoundingClientRect()
      return { top: r.top, height: r.height, innerHeight: window.innerHeight }
    }, CONTENT_AREA)

    // Then 顶边纵坐标与视口顶边之差 ≤ 1 px，且高度 ≥ 视口高度 − 1 px
    expect(Math.abs(m.top - 0), `BDD-2: 内容区 top=${m.top}，与视口顶边之差须 ≤ 1px`).toBeLessThanOrEqual(1)
    expect(m.height, `BDD-2: 内容区高度 ${m.height} 须 ≥ 视口高度 ${m.innerHeight} − 1`).toBeGreaterThanOrEqual(m.innerHeight - 1)
  })

  // ---------------------------------------------------------------
  // BDD-3: 视觉呈现：桌面端全屏视图无任何满宽顶部横条
  //
  // ⚠️ 硬约束 3（P2 §6.4）：A/B 两组排除规则**不可简化、不可互换、不可统一写成
  //    "祖先/后代"**。两组已逐字照抄 P1 BDD-3：
  //      A 组（结构链 html/body/#app/.entry-detail）→ 排除「自身 + 全部祖先」，**不含后代**
  //      B 组（内容流容器链）→ 排除「自身 + 全部后代」（整棵子树）
  //    为什么不能统一（P1 rev2 实测证伪）：候选元素含 `html`，若 A 组也取"后代"，
  //    `html` 的后代 = 整个文档 → 候选集恒为空 → Then 恒真、拦截力归零；
  //    且 `.detail-header`/`.title-row`/`.meta-row` 恰是 `.entry-detail` 的**后代**，
  //    真实横条会被一并排掉 → 同样恒真失效。
  //
  //    本实现的等价形态（P3 用 CDP 实测校准，三态命中数 0/3/1，与 P1 rev2 完全一致）：
  //      - A 组：对每个匹配元素向上遍历 parentElement 全链加入排除集 → 即「自身+祖先」
  //      - B 组：对每个匹配元素加入排除集后，再 querySelectorAll('*') 全量加入 → 即「自身+后代」
  //    负向对照（本节三角色，脚本化遍历可复现）：
  //      ① 正确实现（f 键 zen 控制组）→ 命中 0（PASS）
  //      ② 注入 `.detail-header{display:flex!important}` → 命中 3（header 1280×107 / title-row / meta-row）
  //      ③ 注入 #bespoke-bar（1280×40, top=0，未纳入隐藏集）→ 命中 1
  //    ⇒ 判据对正确实现放行、对两种失败态判 FAIL，非恒真。
  // ---------------------------------------------------------------
  test('test_bdd_3_no_full_width_top_bar', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    const result = await page.evaluate((caSel) => {
      const vw = window.innerWidth
      const visible = (el: Element): boolean => {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) return false
        const cs = getComputedStyle(el)
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
      }

      // ---- A 组（结构链）：逐元素排除其自身与其全部祖先，不含后代 ----
      const groupA = ['html', 'body', '#app', '.entry-detail']
      const excluded = new Set<Element>()
      for (const sel of groupA) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          let node: Element | null = el
          while (node) { excluded.add(node); node = node.parentElement }
        }
      }
      // ---- B 组（内容流容器链）：逐元素排除其自身与其全部后代（整棵子树） ----
      const groupB = [
        '.detail-content', '.content-area', '.markdown-viewer', '.code-viewer', '.table-view',
        '.image-viewer', '.html-viewer', '.empty-state', '.error-state', '.loading-state',
      ]
      for (const sel of groupB) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          excluded.add(el)
          for (const d of Array.from(el.querySelectorAll('*'))) excluded.add(d)
        }
      }

      const all = Array.from(document.querySelectorAll('*'))
      const candidates = all.filter((el) => !excluded.has(el) && visible(el))
      const hits = candidates
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width >= vw * 0.9 && r.height >= 8 && r.top < 100
        })
        .map((el) => {
          const r = el.getBoundingClientRect()
          return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }
        })

      const ca = document.querySelector(caSel) as HTMLElement
      const cr = ca.getBoundingClientRect()
      return { vw, candidateCount: candidates.length, hits, caLeft: cr.left, caRight: cr.right }
    }, CONTENT_AREA)

    // 判据有效性自证：候选集必须非空（否则排除规则退化为「排除整个文档」→ Then 恒真）
    expect(result.candidateCount, 'BDD-3 排除集不得吞掉全部可见元素（候选集非空是判据有效的前提）').toBeGreaterThan(0)

    // Then 候选集内不存在宽度 ≥ 视口宽度 90% 且高度 ≥ 8px 的可见横条，且位于视口顶边起 100px 区间内
    expect(result.hits, `BDD-3: 候选集中位于视口顶部 100px 内的满宽横条须为 0，实测 ${JSON.stringify(result.hits)}`).toEqual([])

    // Then 内容区左右边界与视口边界之差各 ≤ 1px
    expect(Math.abs(result.caLeft - 0), `BDD-3: 内容区左边与视口左边之差须 ≤ 1px（实测 ${result.caLeft}）`).toBeLessThanOrEqual(1)
    expect(Math.abs(result.caRight - result.vw), `BDD-3: 内容区右边与视口右边之差须 ≤ 1px（实测 ${result.caRight} vs ${result.vw}）`).toBeLessThanOrEqual(1)
  })

  // ---------------------------------------------------------------
  // BDD-4: 交互行为：全屏视图内按 f 不改变视图
  // ---------------------------------------------------------------
  test('test_bdd_4_f_key_does_not_change_view', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)
    const before = await snapshotViewState(page)

    // When 依次按 f、F、Ctrl+f（两次：F 须带 Shift，Ctrl+f 触发浏览器查找）
    await page.keyboard.press('f')
    await page.waitForTimeout(200)
    await page.keyboard.press('Shift+F')
    await page.waitForTimeout(200)
    await page.keyboard.press('Control+f')
    await page.waitForTimeout(400)

    const after = await snapshotViewState(page)

    // Then 视图状态不变——chrome 可见性、内容区位置尺寸、URL 三者均与按键前一致
    expect(after.zenClass, 'BDD-4: 按 f/F/Ctrl+f 后仍须处于全屏视图（zen 类不得消失）').toBe(before.zenClass)
    expect(after.chrome, 'BDD-4: chrome 可见性须与按键前逐项一致').toEqual(before.chrome)
    expect(after.rect, 'BDD-4: 内容区位置尺寸须与按键前一致').toEqual(before.rect)
    expect(after.pathname, 'BDD-4: pathname 不得变化').toBe(before.pathname)
    expect(after.search, 'BDD-4: query 不得变化').toBe(before.search)
    expect(after.ariaText, 'BDD-4: 公告文本不得变化').toBe(before.ariaText)
  })

  // ---------------------------------------------------------------
  // BDD-5: 交互行为：全屏视图内按 Escape 不改变视图
  // ---------------------------------------------------------------
  test('test_bdd_5_escape_does_not_change_view', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)
    const before = await snapshotViewState(page)

    // When 按 Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    const after = await snapshotViewState(page)

    // Then 视图状态不变（chrome 仍不可见、内容区位置尺寸与 URL 均不变）
    expect(after.zenClass, 'BDD-5: 按 Escape 后仍须处于全屏视图（无页内出口）').toBe(true)
    expect(after.chrome, 'BDD-5: chrome 可见性须与按键前逐项一致').toEqual(before.chrome)
    expect(after.rect, 'BDD-5: 内容区位置尺寸须与按键前一致').toEqual(before.rect)
    expect(after.pathname, 'BDD-5: URL 不得变化').toBe(before.pathname)
  })

  // ---------------------------------------------------------------
  // BDD-6: 交互行为：全屏视图不向用户宣告任何退出方式
  //
  // 作用域（P1 rev1 建议 10）：枚举范围 = 全屏视图**自身** chrome（根节点 .entry-detail 内、
  // 但**排除内容区及其后代**）。内容区内嵌组件自带弹层控件（如图表弹层的 `Close`）
  // 关闭的是组件自身弹层、不改变全屏视图状态，不属本条冲突面。
  // ---------------------------------------------------------------
  test('test_bdd_6_no_exit_route_announced', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    const r = await page.evaluate(({ caSel, words, phrases }) => {
      const aria = document.querySelector('.sr-only[aria-live]') as HTMLElement | null
      const ariaText = aria?.textContent ?? ''

      const root = document.querySelector('.entry-detail')
      const ca = document.querySelector(caSel)
      const sel = 'button, a[href], [tabindex]:not([tabindex="-1"])'
      const scoped = root
        ? Array.from(root.querySelectorAll(sel)).filter((el) => !(ca && ca.contains(el)))
        : []
      const focusables = scoped
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({
          tag: el.tagName,
          label: (el.textContent || '').trim(),
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.getAttribute('title') || '',
        }))

      // 退出词表命中：标签或标题（textContent / aria-label / title 三者任一）
      const wordHits = focusables
        .filter((f) => words.some((w) => f.label.includes(w) || f.ariaLabel.includes(w) || f.title.includes(w)))
        .map((f) => `${f.tag}[${f.label.slice(0, 30)}|${f.ariaLabel}|${f.title}]`)

      return {
        ariaText,
        phraseHits: phrases.filter((p) => ariaText.includes(p)),
        focusableCount: focusables.length,
        wordHits,
      }
    }, { caSel: CONTENT_AREA, words: EXIT_WORDS, phrases: EXIT_PHRASES })

    // Then 公告文本不包含退出提示词组「Press f or Escape to exit」「按 f 退出」中的任何一项
    expect(r.phraseHits, `BDD-6: 公告文本 "${r.ariaText}" 不得含退出提示词组 ${JSON.stringify(r.phraseHits)}`).toEqual([])
    // Then 也不包含子串 Escape 或 exit
    expect(r.ariaText.includes('Escape'), `BDD-6: 公告文本 "${r.ariaText}" 不得含子串 Escape`).toBe(false)
    expect(r.ariaText.toLowerCase().includes('exit'), `BDD-6: 公告文本 "${r.ariaText}" 不得含子串 exit`).toBe(false)
    // Then 该范围内不存在命中退出词表、且激活后能离开全屏视图的可聚焦控件
    expect(r.wordHits, `BDD-6: 全屏视图自身 chrome 范围内不得存在命中退出词表的可聚焦控件：${JSON.stringify(r.wordHits)}`).toEqual([])

    // ⚠️ 判据有效性说明（防恒真假绿）：本断言为"集合为空"型，其分母不是 0——
    //    P3 实测：非锁死态下同一作用域的可聚焦元素计数为 **24**（BDD-12 的对照），
    //    且公告文本含 `Escape`。故该断言并非「无对象可查」而恒真：
    //    若实现把锁死态公告文本留成既有文案，phraseHits 立即非空 → FAIL。
  })

  // ---------------------------------------------------------------
  // BDD-7: 交互行为：锁死不吞掉内容区内嵌组件的 Escape 行为
  // Given 通过 /{slug}/f 进入含表格的 entry 全屏视图（seed tsv-server-metrics，匿名可见）
  // ---------------------------------------------------------------
  test('test_bdd_7_locked_mode_does_not_swallow_embedded_escape', async ({ page }) => {
    await openFullscreen(page, SLUG_TSV)

    // Given 前置：表体已渲染、分页浮层触发控件存在且可见
    await expect(page.locator('.table-view')).toHaveCount(1)
    const rowCount = await page.locator('tbody tr').count()
    expect(rowCount, `BDD-7: ${SLUG_TSV} 表体须已渲染（实测 60 行）`).toBeGreaterThan(0)
    expect(await page.locator('.per-page-trigger').count(), 'BDD-7: 分页触发控件须存在').toBe(1)

    const before = await snapshotViewState(page)

    // When 打开内容区内的分页选择浮层后按 Escape
    // （注意：须让浮层内元素持有焦点，否则 Escape 落在 body 上——见下方 click 后 focus 处理）
    await page.click('.per-page-trigger')
    await expect(page.locator('.per-page-listbox'), 'BDD-7: 点击分页触发控件后浮层须出现').toBeVisible()
    await page.locator('.per-page-listbox [role="option"]').first().focus()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    // Then 该浮层关闭
    expect(await page.locator('.per-page-listbox').count(), 'BDD-7: 按 Escape 后浮层须关闭（锁死不得吞掉元素级 Escape 消费）').toBe(0)

    // Then 且全屏视图仍保持（chrome 仍不可见、URL 不变）
    const after = await snapshotViewState(page)
    expect(after.zenClass, 'BDD-7: 浮层关闭后仍须处于全屏视图').toBe(true)
    expect(after.chrome, 'BDD-7: 全屏视图 chrome 可见性须未变').toEqual(before.chrome)
    expect(after.pathname, 'BDD-7: URL 须不变（Escape 不得成为页内出口）').toBe(before.pathname)

    // ⚠️ 判据有效性说明（防恒真）：P3 实测**普通（非锁死）zen 态**下同一操作是
    //    「浮层关闭 **且 zen 退出**」——即浮层关闭一事在本任务前后都成立，
    //    真正被本条拦截的是 `after.zenClass === true`（zen **保持**）。
    //    若实现把锁死短路写成 document **capture** + stopPropagation（P2 §3.3 实测），
    //    浮层不会关闭 → 第 1 个断言立即 FAIL。
  })

  // ---------------------------------------------------------------
  // BDD-8: 多文件 entry 内切换文件保持全屏
  // ---------------------------------------------------------------
  test('test_bdd_8_file_switch_keeps_fullscreen', async ({ page }) => {
    await openFullscreen(page, SLUG_UNICODE)

    // Given 前置（切换动作**可达**）：内容区正文内含指向同 entry 其它文件的相对链接
    //   （全屏下 .file-sidebar 被隐藏、抽屉触发控件位于同样被隐藏的 header，故入口只能来自正文内链接）
    const linkCount = await page.locator(`${CONTENT_AREA} a[data-peekview-file-id]`).count()
    expect(linkCount, `BDD-8: ${SLUG_UNICODE} 全屏正文内须存在可点的文件间链接（实测 2 条）`).toBeGreaterThan(0)
    const before = await page.evaluate((caSel) => ({
      text: (document.querySelector(caSel) as HTMLElement).innerText.trim(),
      pathname: location.pathname,
    }), CONTENT_AREA)
    expect(before.text.length, 'BDD-8: 切换前正文非空').toBeGreaterThan(0)

    // When 在内容区内点击该文件间链接（切换到另一个文件）
    await page.locator(`${CONTENT_AREA} a[data-peekview-file-id]`).first().click()
    await page.waitForTimeout(1200)

    // Then 全屏视图保持不变（chrome 仍不可见、URL 的 /f 后缀仍在），且正文已切换为新文件内容
    const after = await page.evaluate((caSel) => ({
      text: (document.querySelector(caSel) as HTMLElement).innerText.trim(),
      pathname: location.pathname,
      zen: !!document.querySelector('.entry-detail.zen-mode'),
    }), CONTENT_AREA)

    expect(after.pathname, 'BDD-8: 切换文件后 URL 的 /f 后缀须保留').toBe(`/${SLUG_UNICODE}/f`)
    expect(after.pathname, 'BDD-8: 切换前后 pathname 须一致').toBe(before.pathname)
    expect(after.zen, 'BDD-8: 切换文件后仍须处于全屏视图').toBe(true)
    expect(after.text, 'BDD-8: 内容区正文文本须已切换为新文件内容').not.toBe(before.text)
    expect(after.text, 'BDD-8: 切换后正文须为非空').not.toBe('')
    for (const sel of CHROME_SELECTORS) {
      expect(await isVisible(page, sel), `BDD-8: 切换后 chrome「${sel}」仍须不可见`).toBe(false)
    }
  })

  // ---------------------------------------------------------------
  // BDD-11: 回归：/{slug}（无 f）现有行为不变
  // ---------------------------------------------------------------
  test('test_bdd_11_plain_slug_page_unchanged', async ({ page }) => {
    // Given 一份公开 markdown entry
    // When 访问 /{slug}（无 f）
    const resp = await page.goto(`${BASE_URL}/${SLUG_ARCH}`)
    await page.waitForSelector('.entry-detail', { timeout: 20000 })
    await page.waitForTimeout(1200)

    // Then 完整页面形态成立——**主体判据**：标题栏与内容区在桌面视口下同时可见，且 chrome 未隐藏
    expect(await isVisible(page, '.detail-header'), 'BDD-11: 非全屏态标题栏 .detail-header 必须可见').toBe(true)
    expect(await isVisible(page, CONTENT_AREA), 'BDD-11: 非全屏态内容区必须可见').toBe(true)
    expect(await page.locator('.entry-detail.zen-mode').count(), 'BDD-11: 非全屏态不得带 zen 类').toBe(0)

    // 内容区顶边纵坐标 ≠ 全屏视图下的 0（证明两种形态可区分，即 BDD-1 的断言非恒真）
    const top = await page.evaluate((caSel) => (document.querySelector(caSel) as HTMLElement).getBoundingClientRect().top, CONTENT_AREA)
    expect(top, 'BDD-11: 非全屏态内容区 top 须 > 0（全屏态为 0，两者可区分）').toBeGreaterThan(0)

    // 辅助证据（rev1 建议 12，**不单独构成判定**）：响应头仍带 raw 的 alternate Link
    const link = resp?.headers()['link'] ?? ''
    expect(link, `BDD-11 辅助证据: 响应头 Link 须含 /api/v1/entries/${SLUG_ARCH}/raw（实测存在）`).toContain(`/api/v1/entries/${SLUG_ARCH}/raw`)
    expect(link, 'BDD-11 辅助证据: Link 须为 alternate 类型').toContain('rel="alternate"')
  })

  // ---------------------------------------------------------------
  // BDD-12: 回归：既有 f 键 zen 视图外观与语义不变
  // ---------------------------------------------------------------
  test('test_bdd_12_existing_f_key_zen_unchanged', async ({ page }) => {
    // Given 打开 /{slug}（无 f）
    await page.goto(`${BASE_URL}/${SLUG_ARCH}`)
    await page.waitForSelector('.entry-detail', { timeout: 20000 })
    await page.waitForTimeout(1200)

    const fullPage = await snapshotViewState(page)
    expect(fullPage.zenClass, 'BDD-12: 初始须为非 zen 态').toBe(false)
    expect(fullPage.chrome['.detail-header'], 'BDD-12: 初始标题栏可见').toBe(true)
    const ariaBefore = fullPage.ariaText

    // When 按 f 进入 zen
    await page.keyboard.press('f')
    await page.waitForTimeout(500)
    const zen = await snapshotViewState(page)

    // Then 进入后 chrome 与元信息条的可见性、内容区位置尺寸与 /{slug}/f 全屏视图一致
    expect(zen.zenClass, 'BDD-12: 按 f 后须进入 zen 态').toBe(true)
    expect(zen.chrome, 'BDD-12: f 键 zen 下 chrome 可见性须全为不可见（与全屏视图一致）')
      .toEqual(Object.fromEntries(CHROME_SELECTORS.map((s) => [s, false])))
    expect(Math.abs((zen.rect?.top ?? -1) - 0), 'BDD-12: f 键 zen 下内容区 top 须为 0（与全屏视图一致）').toBeLessThanOrEqual(1)
    const innerHeight = await page.evaluate(() => window.innerHeight)
    expect(zen.rect?.height ?? 0, 'BDD-12: f 键 zen 下内容区须占满视口（与全屏视图一致）').toBeGreaterThanOrEqual(innerHeight - 1)

    // Then 公告文本在进入时仍宣告可用 f 或 Escape 退出（**本任务不得改动既有 zen 的 Escape 退出能力**）
    expect(zen.ariaText, 'BDD-12: 既有 zen 公告文本仍须宣告 f/Escape 退出').toContain('Escape')
    expect(EXIT_PHRASES.some((p) => (zen.ariaText || '').includes(p)),
      `BDD-12: 既有 zen 公告文本须命中退出提示词组之一（实测 "${zen.ariaText}"）`).toBe(true)
    expect(zen.ariaText, 'BDD-12: 进入 zen 后公告文本须发生变化').not.toBe(ariaBefore)

    // When 再按 Escape 退出
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const restored = await snapshotViewState(page)

    // Then 退出可正常恢复完整页面
    expect(restored.zenClass, 'BDD-12: 按 Escape 后须退出 zen').toBe(false)
    expect(restored.chrome['.detail-header'], 'BDD-12: 退出后标题栏须恢复可见').toBe(true)
    expect(restored.pathname, 'BDD-12: f 键 zen 全程不得改变 URL').toBe(`/${SLUG_ARCH}`)
  })

  // ---------------------------------------------------------------
  // BDD-13: 回归：/{slug}/f 不再静默渲染路由级 NotFoundView
  // ---------------------------------------------------------------
  test('test_bdd_13_existing_slug_fullscreen_not_route_notfound', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    // Then 页面不出现路由级 NotFoundView 的 "Page not found" 文案，而是进入全屏内容视图（BDD-1 的形态）
    expect(await page.locator('.not-found').count(), 'BDD-13: 路由级 NotFoundView 根节点 .not-found 计数须为 0').toBe(0)
    const body = await page.locator('body').innerText()
    expect(/Page not found/.test(body), 'BDD-13: 页面文本不得含 "Page not found"').toBe(false)
    await expectFullscreenShape(page, SLUG_ARCH)

    // ⚠️ 判据有效性说明（防恒真）：P3 实测**实现前** `/dsh-architecture/f` 命中
    //    `.not-found`=1 且文本含 `Page not found`（走 /:pathMatch(.*)*），
    //    即本条在 P3 时点为 FAIL、实现后转 PASS → 判据随实现翻转，非恒真。
  })

  // ---------------------------------------------------------------
  // BDD-16: 人工体验路径：按文档 seed 后全屏链接页面有内容
  // （P1 强制节：真实 seed + 截图，不得以 fixture/单测替代）
  // ---------------------------------------------------------------
  test('test_bdd_16_seeded_fullscreen_link_has_content', async ({ page }) => {
    await openFullscreen(page, SLUG_ARCH)

    // Then 页面在无需额外构造数据的前提下即呈现该 entry 的正文内容
    const text = (await page.locator(CONTENT_AREA).innerText()).trim()
    expect(text.length, 'BDD-16: 内容区正文文本长度须 > 0').toBeGreaterThan(0)
    expect(text, 'BDD-16: 须呈现 seed entry 的正文内容').toContain('总体架构')
    await expectFullscreenShape(page, SLUG_ARCH)

    // Then 全屏形态成立 + 留证截图（desktop_1280x800，供 P6 视觉验收）
    await page.screenshot({ path: 'test-results/tpv0099-bdd16-desktop_1280x800.png', fullPage: false })
  })

  // ---------------------------------------------------------------
  // BDD-17: 图表类 entry（独立 SVG 文件）全屏下图片正常渲染
  // ---------------------------------------------------------------
  test('test_bdd_17_standalone_svg_renders_in_fullscreen', async ({ page }) => {
    await openFullscreen(page, SLUG_SVG)

    // Then 内容区出现该 SVG 以 img 元素渲染的图片，且 bounding box 宽高均 > 0
    const img = page.locator('[data-testid="image-content"]')
    await expect(img, 'BDD-17: 内容区须以 img 渲染该独立 SVG').toHaveCount(1)
    expect(await page.locator('[data-testid="image-error"]').count(), 'BDD-17: 不得出现图片错误态').toBe(0)

    const box = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="image-content"]') as HTMLImageElement
      const r = el.getBoundingClientRect()
      return { w: r.width, h: r.height, naturalWidth: el.naturalWidth }
    })
    expect(box.w, 'BDD-17: 图片 bounding box 宽须 > 0').toBeGreaterThan(0)
    expect(box.h, 'BDD-17: 图片 bounding box 高须 > 0').toBeGreaterThan(0)
    expect(box.naturalWidth, 'BDD-17: 图片须已解码（naturalWidth > 0）').toBeGreaterThan(0)

    // 本条不要求全屏按钮/弹层：P3 实测 svg-icons 走 ImageViewer 路径，.fullscreen-btn 计数 = 0
    // （该能力属图表渲染组件路径，由 BDD-15 覆盖）→ 此处显式断言其不存在，避免与 BDD-15 混同
    expect(await page.locator('.fullscreen-btn').count(), 'BDD-17: 独立 SVG 走 ImageViewer，不应有 fullscreen 按钮').toBe(0)

    // Then 同时全屏形态成立（chrome 不可见、URL 的 /f 后缀保留）
    await expectFullscreenShape(page, SLUG_SVG)
  })

  // ---------------------------------------------------------------
  // BDD-18: 边界：不存在的 slug + /f 不落路由级 NotFoundView
  // ---------------------------------------------------------------
  test('test_bdd_18_nonexistent_slug_fullscreen_not_route_notfound', async ({ page, request }) => {
    const MISSING = 'nonexistent-slug-xyz'

    // 对照基线（判据依据：/{slug}/f 须与既有 /{slug} 在同一不存在 slug 上语义一致）
    const ctl = await request.get(`${BASE_URL}/${MISSING}`)
    expect(ctl.status(), 'BDD-18 对照基线: 单段不存在 slug 返回 200（走详情视图错误态）').toBe(200)

    // When 访问 /{slug}/f
    await page.goto(`${BASE_URL}/${MISSING}/f`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(1500)

    // Then **不**呈现路由级 NotFoundView
    expect(await page.locator('.not-found').count(), 'BDD-18: 根节点 .not-found 计数须为 0').toBe(0)
    expect(/Page not found/.test(await page.locator('body').innerText()), 'BDD-18: 页面文本不得含 "Page not found"').toBe(false)

    // Then 而是呈现详情视图的条目缺失/错误态（.entry-detail 与内容区均存在）
    // 判据边界（P1 明确不裁定）：empty 态还是 error 态取决于 P2 如何让 /f 路由自处，
    // 现状走 error 态即符合 → 本条只要求「不落路由级 NotFoundView + 详情骨架存在」。
    expect(await page.locator('.entry-detail').count(), 'BDD-18: 详情视图根节点 .entry-detail 须存在').toBe(1)
    expect(await page.locator(CONTENT_AREA).count(), 'BDD-18: 内容区须存在').toBe(1)

    // ⚠️ 判据有效性说明（防恒真）：P3 实测实现前 `/nonexistent-slug-xyz/f` → HTTP 200 +
    //    `.not-found`=1 + `Page not found`（FAIL）；而单段 `/nonexistent-slug-xyz` →
    //    `.not-found`=0 + `.entry-detail`=1 + `.error-state`=1（PASS）。
    //    同一判据在两条路径上给出**不同**结论 ⇒ 非恒真。
  })

  // ---------------------------------------------------------------
  // BDD-19: 边界：中段路径不误匹配并渲染 entry 内容
  // ---------------------------------------------------------------
  test('test_bdd_19_mid_path_segment_not_matching_entry', async ({ page }) => {
    // Given 一份存在的公开 entry（dsh-architecture）
    // When 访问其中段路径 /{slug}/f/<未知段>
    // （判据本身不要求全屏形态 → requireContentArea: false，让断言直接判定"是否误渲染 entry"）
    await page.goto(`${BASE_URL}/${SLUG_ARCH}/f/xyz`)
    await page.waitForSelector('#app > *', { timeout: 20000 })
    await page.waitForTimeout(1500)

    // Then 页面不渲染该 entry 的详情内容
    const body = await page.locator('body').innerText()
    expect(body, 'BDD-19: 页面不得出现该 entry 的正文特征串「总体架构」').not.toContain('总体架构')
    expect(await page.locator('.entry-detail').count(), 'BDD-19: .entry-detail 详情骨架不得成立').toBe(0)

    // Then 页面为 NotFoundView 或错误态（本条不要求改成真 404——那属后端行为变更、超出本任务范围）
    const notFound = await page.locator('.not-found').count()
    const errorState = await page.locator('.error-state').count()
    expect(notFound + errorState, 'BDD-19: 须呈现 NotFoundView 或错误态之一').toBeGreaterThan(0)

    // ⚠️ 判据有效性说明（防恒真）：本条拦的是「把 /:slug/f 写成带通配/前缀匹配导致中段路径
    //    误命中」。P2 §4 V2 实测 vue-router 对 /{slug}/f/xyz 命中 not-found（段数严格），
    //    而 /{slug}/f 命中 detail-zen-locked ⇒ 两者 resolve 结果不同，判据随路由定义翻转。
    //    负向对照：同 spec 的 BDD-13 在 /{slug}/f 上断言 .entry-detail 存在 → 两条判据互斥成立。
  })
})

// ============================================================================
// 移动端 390×844 —— BDD-14
// ============================================================================
test.describe('TPV0099 Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // ---------------------------------------------------------------
  // BDD-14: 移动端全屏视图无移动端 chrome 且内容区占满视口
  // ---------------------------------------------------------------
  test('test_bdd_14_mobile_fullscreen_no_chrome_and_fills_viewport', async ({ page }) => {
    // 负向对照前置（证明判据非恒真）：同一 seed 在**非全屏**态下三类 chrome 均可见
    await page.goto(`${BASE_URL}/${SLUG_ARCH}`)
    await page.waitForSelector('.entry-detail', { timeout: 20000 })
    await page.waitForTimeout(1500)
    const nonZen = await page.evaluate((caSel) => {
      const h = (s: string) => {
        const el = document.querySelector(s)
        return el ? Math.round(el.getBoundingClientRect().height) : -1
      }
      return {
        sticky: h('.mobile-sticky-header'),
        bottomBar: h('[data-testid="mobile-bottom-bar"]'),
        metaTags: h('.meta-tags-bar'),
        caTop: Math.round((document.querySelector(caSel) as HTMLElement).getBoundingClientRect().top),
      }
    }, CONTENT_AREA)
    expect(nonZen.sticky, 'BDD-14 负向对照: 非全屏态移动端顶部条须可见（实测 56px）').toBeGreaterThan(0)
    expect(nonZen.bottomBar, 'BDD-14 负向对照: 非全屏态移动端底部条须可见（实测 64px）').toBeGreaterThan(0)
    expect(nonZen.metaTags, 'BDD-14 负向对照: 非全屏态元信息条须可见（实测 89px）').toBeGreaterThan(0)

    // When 访问 /{slug}/f
    await openFullscreen(page, SLUG_ARCH)

    // Then 移动端顶部条、移动端底部条、元信息条均不可见
    for (const sel of ['.mobile-sticky-header', '[data-testid="mobile-bottom-bar"]', '.meta-tags-bar']) {
      expect(await isVisible(page, sel), `BDD-14: 移动端 chrome「${sel}」必须不可见`).toBe(false)
    }

    // Then 内容区顶边与视口顶边之差 ≤ 1px、高度 ≥ 视口高度 − 1px
    const geo = await page.evaluate((caSel) => {
      const ca = document.querySelector(caSel) as HTMLElement
      const r = ca.getBoundingClientRect()
      return {
        top: r.top, height: r.height, width: r.width,
        innerHeight: window.innerHeight, innerWidth: window.innerWidth,
        scrollHeight: ca.scrollHeight, clientHeight: ca.clientHeight,
        overflowY: getComputedStyle(ca).overflowY,
      }
    }, CONTENT_AREA)
    expect(Math.abs(geo.top - 0), `BDD-14: 内容区 top=${geo.top}，与视口顶边之差须 ≤ 1px`).toBeLessThanOrEqual(1)
    expect(geo.height, `BDD-14: 内容区高度 ${geo.height} 须 ≥ 视口高度 ${geo.innerHeight} − 1`).toBeGreaterThanOrEqual(geo.innerHeight - 1)

    // Then 页面在内容超出时仍可纵向滚动到正文末尾
    // （滚动发生在 .content-area 自身，window.scrollY 恒为 0 —— P1 实测）
    expect(geo.scrollHeight, 'BDD-14: 正文须超出内容区（可滚动的前提，实测 5227 > 844）').toBeGreaterThan(geo.clientHeight)
    const scroll = await page.evaluate((caSel) => {
      const ca = document.querySelector(caSel) as HTMLElement
      ca.scrollTop = ca.scrollHeight
      const tail = ca.innerText.trim().slice(-40)
      return { scrollTop: ca.scrollTop, tail, windowScrollY: window.scrollY }
    }, CONTENT_AREA)
    expect(scroll.scrollTop, 'BDD-14: 须能滚动到正文末尾（scrollTop > 0）').toBeGreaterThan(0)
    expect(scroll.tail.length, 'BDD-14: 滚动到底后末段正文文本须可见（非空）').toBeGreaterThan(0)
    expect(scroll.windowScrollY, 'BDD-14: 滚动发生在 .content-area 内，window.scrollY 应恒为 0').toBe(0)
  })
})
