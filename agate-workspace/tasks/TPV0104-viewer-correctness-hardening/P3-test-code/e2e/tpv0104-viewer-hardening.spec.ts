// TPV0104 Viewer 正确性与资源边界加固 —— E2E（54 条 BDD 的浏览器可验面）
//
// 运行：E2E_SPEC=e2e/tpv0104-viewer-hardening.spec.ts make debug-test
// 前置：debug backend :8888 在线（`make debug-seed` 已灌 seed）；严禁 :8080。
//
// 环境隔离：[PROD_NOT_TOUCHED] —— 全部请求走 BASE_URL（默认 :8888 debug backend）。
//   现造 entry 一律 `e2e-tpv0104-` 前缀，afterEach 无条件 DELETE（用 slug，不用 id）；
//   删除接受 200/204/404 为已清理。创建即注册（createdSlugs 队列）。
//
// ⚠️ TOC 展开态的幂等表述（P1 §3 全文统一，勿改成「点开 TOC」）：
//   桌面（>640px）默认**已展开**、移动端**默认不渲染**且按钮无 `aria-expanded`。
//   本 spec 一律钉定桌面 1280×800；读 `aria-expanded`，为 `"true"` 不点、`"false"` 点一次、
//   `null` 说明不是桌面视口（不得解释为「已展开」或「需点击」）。
//
// ⚠️ 双 viewport（P3 卡强制）：desktop_1280x800.png / mobile_390x844.png 存 evidences/。

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'agate-workspace/tasks/TPV0104-viewer-correctness-hardening/evidences'

const K8S_SLUG = 'k8s-deployment'
const UNICODE_SLUG = 'unicode-filenames'
const SINGLE_FILE_SLUG = 'dsh-architecture'

const CONTENT_AREA = '[data-testid="content-area"]'
const MARKDOWN_BODY = '[data-testid="markdown-body"]'
const DESKTOP_FULLSCREEN = '[data-testid="detail-fullscreen-btn"]'
const MOBILE_FULLSCREEN = '[data-testid="mobile-bar-fullscreen-btn"]'
const MOBILE_BOTTOM_BAR = '[data-testid="mobile-bottom-bar"]'

/** 现造 entry 的清理队列（创建即注册） */
const createdSlugs: string[] = []

async function trackCreate(request: APIRequestContext, payload: unknown): Promise<{ slug: string; files: any[] }> {
  const res = await request.post(`${BASE_URL}/api/v1/entries`, { data: payload as object })
  expect(res.status(), `现造 entry 须成功（HTTP ${res.status()}）`).toBe(201)
  const body = await res.json()
  createdSlugs.push(body.slug)
  return { slug: body.slug, files: body.files }
}

async function swampCleanup(request: APIRequestContext): Promise<void> {
  while (createdSlugs.length > 0) {
    const slug = createdSlugs.pop()!
    // 不因响应非 2xx 中止删除；200/204/404 均视为已清理
    await request.delete(`${BASE_URL}/api/v1/entries/${slug}`).catch(() => undefined)
  }
}

async function readEntry(request: APIRequestContext, slug: string): Promise<any | null> {
  const res = await request.get(`${BASE_URL}/api/v1/entries/${slug}`)
  if (!res.ok()) return null
  return res.json()
}

async function fileIdOf(request: APIRequestContext, slug: string, filename: string): Promise<number> {
  const entry = await readEntry(request, slug)
  expect(entry, `${slug} 须可匿名读取`).toBeTruthy()
  const target = (entry.files as Array<{ id: number; filename: string }>).find(f => f.filename === filename)
  expect(target, `${slug} 内须存在文件 ${filename}`).toBeTruthy()
  return target!.id
}

/** 幂等展开 TOC（见文件头表述）；返回 false 表示当前视口不适用本条 */
async function ensureTocExpanded(page: Page): Promise<boolean> {
  const expanded = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Table of Contents"]')
    return btn ? btn.getAttribute('aria-expanded') : null
  })
  if (expanded === null) return false
  if (expanded === 'false') {
    await page.locator('[aria-label="Table of Contents"]').first().click()
  }
  await page.waitForSelector('.toc-sidebar', { timeout: 20000 }).catch(() => undefined)
  await page.waitForSelector('.toc-list', { timeout: 20000 }).catch(() => undefined)
  return true
}

async function waitDetailReady(page: Page): Promise<void> {
  await page.waitForSelector(`${CONTENT_AREA}, .empty-state, .error-state`, { timeout: 20000 })
  await page.waitForTimeout(1200)
}

async function activeFileName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.querySelector('.file-tree .tree-node.active, .file-tree .active')
    const fromTree = active ? (active.textContent || '').trim() : ''
    const body = document.querySelector('[data-testid="markdown-body"]')
    return fromTree || (body ? 'markdown-body' : '')
  })
}

// ============================================================================
// 桌面 1280×800
// ============================================================================
test.describe('TPV0104 desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.afterEach(async ({ request }) => {
    await swampCleanup(request)
  })

  // ── BDD-01 ~ BDD-05：标题与目录（DOM 级）─────────────────────────────────

  test('test_bdd_01_duplicate_headings_get_distinct_ids', async ({ page, request }) => {
    const probe = [
      '## 中文标题', '', '正文一', '',
      '## 中文标题', '', '正文二', '',
      '## 中文标题', '',
    ].join('\n')
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd01',
      files: [{ path: 'probe.md', filename: 'probe.md', content: probe }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-01 钉定桌面视口').toBe(true)

    const ids = await page.evaluate((sel) => {
      const body = document.querySelector(sel)
      if (!body) return [] as string[]
      return Array.from(body.querySelectorAll('h2')).map(h => h.id)
    }, MARKDOWN_BODY)
    expect(ids).toHaveLength(3)
    ids.forEach(id => expect(id.length).toBeGreaterThan(0))
    expect(new Set(ids).size).toBe(3)

    // TOC 的 3 条 href 目标各自在正文中恰好命中 1 个元素
    const tocHrefs = await page.evaluate(() => Array.from(document.querySelectorAll('.toc-list a')).map(a => (a.getAttribute('href') || '').slice(1)))
    expect(tocHrefs).toHaveLength(3)
    for (const href of tocHrefs) {
      const hits = await page.evaluate((id) => document.querySelectorAll(`[id="${id}"]`).length, href)
      expect(hits).toBe(1)
    }

    await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800.png` })
  })

  test('test_bdd_02_fenced_heading_excluded_from_toc', async ({ page, request }) => {
    const probe = ['## 真实标题', '', '```md', '## 示例', '```'].join('\n')
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd02',
      files: [{ path: 'probe.md', filename: 'probe.md', content: probe }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-02 钉定桌面视口').toBe(true)

    const tocText = (await page.locator('.toc-list').textContent()) ?? ''
    expect(tocText).not.toContain('示例')
    expect(tocText).toContain('真实标题')
  })

  test('test_bdd_03_setext_h1_has_anchor_both_sides', async ({ page, request }) => {
    const probe = ['Setext 标题', '===', '', '正文段落'].join('\n')
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd03',
      files: [{ path: 'probe.md', filename: 'probe.md', content: probe }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-03 钉定桌面视口').toBe(true)

    const h1Id = await page.evaluate((sel) => {
      const h1 = document.querySelector(`${sel} h1`)
      return h1 ? h1.id : null
    }, MARKDOWN_BODY)
    expect(h1Id).toBeTruthy()
    expect((h1Id as string).length).toBeGreaterThan(0)

    const tocHit = await page.evaluate((id) => {
      const link = Array.from(document.querySelectorAll('.toc-list a')).find(a => (a.getAttribute('href') || '') === `#${id}`)
      return link ? document.querySelectorAll(`[id="${id}"]`).length : 0
    }, h1Id)
    expect(tocHit).toBe(1)
  })

  test('test_bdd_04_toc_covers_h1_to_h4_excludes_h5', async ({ page, request }) => {
    const probe = ['# 一级', '', '## 二级', '', '### 三级', '', '#### 四级', '', '##### 五级', ''].join('\n')
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd04',
      files: [{ path: 'probe.md', filename: 'probe.md', content: probe }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-04 钉定桌面视口').toBe(true)

    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.toc-list .toc-item')).map(li => ({
        level: Number((li.className.match(/toc-level-(\d)/) || [])[1]),
        text: (li.textContent || '').trim(),
      })),
    )
    expect(items).toHaveLength(4)
    expect(items.map(i => i.level)).toEqual([1, 2, 3, 4])
    expect(items.some(i => i.text.includes('五级'))).toBe(false)
  })

  test('test_bdd_05_toc_text_strips_markup_and_matches_body', async ({ page, request }) => {
    // path 与 filename 必须同时给（只给 path → language=null → 正文退化 CodeViewer、.toc-list 为空）
    const probe = '## **粗体**与[链接](other.md)\n'
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd05',
      files: [{ path: 'README.md', filename: 'README.md', content: probe }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-05 钉定桌面视口').toBe(true)

    const pair = await page.evaluate((sel) => {
      const link = document.querySelector('.toc-list a') as HTMLAnchorElement | null
      const h2 = document.querySelector(`${sel} h2`) as HTMLElement | null
      return {
        tocText: link ? (link.textContent || '').trim() : null,
        tocHref: link ? (link.getAttribute('href') || '').slice(1) : null,
        h2Text: h2 ? (h2.textContent || '').trim() : null,
        h2Id: h2 ? h2.id : null,
      }
    }, MARKDOWN_BODY)

    // Then① 两侧 id 相等（现状即通过，仅前置）
    expect(pair.tocHref).toBeTruthy()
    expect(pair.tocHref).toBe(pair.h2Id)
    expect((pair.tocHref as string)).not.toContain(' ')

    // Then② 区分力所在：TOC 可见文本必须已剥离 markdown 标记（现状原样输出 → FAIL）
    const tocText = pair.tocText as string
    expect(tocText).not.toContain('**')
    expect(tocText).not.toContain('[')
    expect(tocText).not.toContain('](')
    expect(tocText.replace(/\s+/g, '')).toBe((pair.h2Text as string).replace(/\s+/g, ''))
  })

  // ── BDD-06：点 TOC 条目目标进视口（回归兼容）───────────────────────────

  test('test_bdd_06_click_toc_item_scrolls_target_into_viewport', async ({ page, request }) => {
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd06',
      files: [{
        path: 'README.md',
        filename: 'README.md',
        content: ['# 头', '', '## 第一章', '', 'x'.repeat(400), '', '## 第二章', '', 'y'.repeat(400)].join('\n'),
      }],
    })

    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-06 钉定桌面视口').toBe(true)

    const second = page.locator('.toc-list a').nth(1)
    await second.click()
    await page.waitForTimeout(2000)

    const top = await page.evaluate(() => {
      const links = document.querySelectorAll('.toc-list a')
      const id = (links[1]?.getAttribute('href') || '').slice(1)
      const target = document.getElementById(id)
      return target ? target.getBoundingClientRect().top : 99999
    })
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBeLessThanOrEqual(200)
  })

  // ── BDD-08 ~ BDD-12：默认入口 resolver（现造 entry，无例外）─────────────

  test('test_bdd_08_root_readme_beats_lexicographically_first', async ({ page, request }) => {
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd08',
      files: [
        { filename: 'AAA.txt', content: 'AAA CONTENT' },
        { filename: 'README.md', path: 'README.md', content: '# README 优先\n\nREADME MARKER\n' },
      ],
    })
    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('README MARKER')
    expect(text).not.toContain('AAA CONTENT')
  })

  test('test_bdd_09_root_index_when_no_readme', async ({ page, request }) => {
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd09',
      files: [
        { filename: 'aaa.md', content: 'AAA MD MARKER' },
        { filename: 'index.md', path: 'index.md', content: '# Index\n\nINDEX MARKER\n' },
      ],
    })
    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('INDEX MARKER')
    expect(text).not.toContain('AAA MD MARKER')
  })

  test('test_bdd_10_falls_back_to_stable_sorted_first', async ({ page, request }) => {
    // 构造序 bbb 在前；改后应为字典序首个 aaa.txt
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd10',
      files: [
        { filename: 'bbb.txt', content: 'BBB MARKER' },
        { filename: 'aaa.txt', content: 'AAA MARKER' },
      ],
    })
    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('AAA MARKER')
    expect(text).not.toContain('BBB MARKER')
  })

  test('test_bdd_11_subdirectory_readme_not_selected', async ({ page, request }) => {
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd11',
      files: [
        { path: 'sub', filename: 'README.md', content: 'SUB README MARKER' },
        { filename: 'aaa.md', content: 'AAA MD FALLBACK MARKER' },
      ],
    })
    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('AAA MD FALLBACK MARKER')
    expect(text).not.toContain('SUB README MARKER')
  })

  test('test_bdd_12_readme_match_is_case_insensitive', async ({ page, request }) => {
    // 构造序 AAA.txt 在前；改后应选 readme.md（全小写）
    const { slug } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd12',
      files: [
        { filename: 'AAA.txt', content: 'AAA UPPER MARKER' },
        { path: 'readme.md', filename: 'readme.md', content: '# lowercase readme\n\nLOWERCASE README MARKER\n' },
      ],
    })
    await page.goto(`${BASE_URL}/${slug}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('LOWERCASE README MARKER')
    expect(text).not.toContain('AAA UPPER MARKER')
  })

  // ── BDD-14 ~ BDD-22：`?file=` 深链与 URL 状态一致性 ──────────────────────

  test('test_bdd_14_file_query_opens_file_and_survives_load', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)

    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('kind: Deployment')
    expect(new URL(page.url()).search).toContain(`file=${fid}`)
  })

  test('test_bdd_15_fullscreen_with_file_query', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'service.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f?file=${fid}`)
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      zen: !!document.querySelector('.entry-detail.zen-mode'),
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
      search: location.search,
    }))
    expect(state.zen).toBe(true)
    expect(state.body).toContain('kind: Service')
    expect(state.search).toContain(`file=${fid}`)
  })

  test('test_bdd_16_unknown_file_id_falls_back_paired', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')

    // ① 前置校验：有效 id 必须真的切换（不成立即整条 FAIL）
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)
    const validText = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(validText).toContain('kind: Deployment')

    // ② 无效 id → 回退默认入口 README.md，无错误横幅、不白屏
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=999999`)
    await waitDetailReady(page)
    const invalidText = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(invalidText).toContain('K8s 部署清单')
    expect(await page.locator('.error-state').count()).toBe(0)
    expect(await page.locator('.parse-error-banner').count()).toBe(0)

    // ③ 两侧活跃文件不同
    expect(validText).not.toBe(invalidText)
  })

  test('test_bdd_17_cross_entry_file_id_rejected_paired', async ({ page, request }) => {
    const markerB = 'BDD17-MARKER-B'
    const a = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd17 A',
      files: [
        { path: 'README.md', filename: 'README.md', content: '# A default\n\nA-DEFAULT-MARKER\n' },
        { filename: 'extra.txt', content: 'A-EXTRA-MARKER' },
      ],
    })
    const b = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd17 B',
      files: [{ filename: 'b.txt', content: markerB }],
    })
    const bFileId = b.files[0].id
    const aNonDefault = a.files.find(f => f.filename === 'extra.txt')!.id

    // ① 前置校验：A 自己的非默认文件 id 确实切换
    await page.goto(`${BASE_URL}/${a.slug}?file=${aNonDefault}`)
    await waitDetailReady(page)
    expect((await page.locator(CONTENT_AREA).textContent()) ?? '').toContain('A-EXTRA-MARKER')

    // ② 跨 entry id → 回退 A 的默认入口，正文不含 B 的独有串
    await page.goto(`${BASE_URL}/${a.slug}?file=${bFileId}`)
    await waitDetailReady(page)
    const text = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(text).toContain('A-DEFAULT-MARKER')
    expect(text).not.toContain(markerB)
    expect(await page.locator('.error-state').count()).toBe(0)
  })

  test('test_bdd_18_non_numeric_file_param_falls_back_paired', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')

    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)
    expect((await page.locator(CONTENT_AREA).textContent()) ?? '').toContain('kind: Deployment')

    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=abc`)
    await waitDetailReady(page)
    expect((await page.locator(CONTENT_AREA).textContent()) ?? '').toContain('K8s 部署清单')
    expect(await page.locator('.error-state').count()).toBe(0)
  })

  test('test_bdd_19_in_page_switch_syncs_url_without_history', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)

    // 文件树可见（桌面多文件 entry 默认展开）
    await page.waitForSelector('.file-sidebar', { timeout: 20000 })
    const historyBefore = await page.evaluate(() => window.history.length)

    await page.locator('.file-sidebar').getByText('deployment.yaml', { exact: false }).first().click()
    await page.waitForTimeout(1500)

    const after = await page.evaluate(() => ({
      search: location.search,
      history: window.history.length,
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
    }))
    expect(after.search).toContain(`file=${fid}`)
    expect(after.body).toContain('kind: Deployment')
    expect(after.history).toBe(historyBefore)
  })

  test('test_bdd_20_switch_back_to_default_removes_file_param', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)
    await page.waitForSelector('.file-sidebar', { timeout: 20000 })

    await page.locator('.file-sidebar').getByText('README.md', { exact: false }).first().click()
    await page.waitForTimeout(1500)

    expect(new URL(page.url()).search).not.toContain('file=')
  })

  test('test_bdd_21_reload_keeps_url_specified_file', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)

    await page.reload()
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      search: location.search,
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
    }))
    expect(state.body).toContain('kind: Deployment')
    expect(state.search).toContain(`file=${fid}`)
  })

  test('test_bdd_22_file_and_share_coexist_and_survive_cleanup', async ({ page, request }) => {
    // 私有 entry + 有效 share token + 非默认 file id
    const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'alice', password: 'testpass123' },
    })
    expect(res.ok()).toBeTruthy()
    const token = (await res.json()).access_token as string

    const created = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'e2e tpv0104 bdd22',
        is_public: false,
        files: [
          { path: 'README.md', filename: 'README.md', content: '# default\n\nSHARE-DEFAULT-MARKER\n' },
          { filename: 'secret.txt', content: 'SHARE-FILE-MARKER' },
        ],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(created.status()).toBe(201)
    const entry = await created.json()
    createdSlugs.push(entry.slug)
    const nonDefault = entry.files.find((f: any) => f.filename === 'secret.txt').id

    const share = await request.post(`${BASE_URL}/api/v1/entries/${entry.slug}/shares`, {
      data: { expires_in: '7d' },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(share.status()).toBe(201)
    const shareToken = (await share.json()).token as string

    await page.goto(`${BASE_URL}/${entry.slug}?share=${shareToken}&file=${nonDefault}`)
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      search: location.search,
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
      error: !!document.querySelector('.error-state'),
    }))
    // ① 分享凭证生效 ② 展示文件为 F ③ 两个参数都未被清理掉
    expect(state.error).toBe(false)
    expect(state.body).toContain('SHARE-FILE-MARKER')
    expect(state.search).toContain('share=')
    expect(state.search).toContain(`file=${nonDefault}`)
  })

  // ── BDD-23 / BDD-31：全屏入口（桌面）────────────────────────────────────

  test('test_bdd_23_desktop_fullscreen_entry_discoverable_in_actions_area', async ({ page }) => {
    // Given：文件树收起 且 正文不含图表块（排除 DiagramBlock 的 title="Fullscreen"）
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)

    const found = await page.evaluate(() => {
      const area = document.querySelector('.actions-area')
      if (!area) return { count: 0, inside: false, visible: false }
      const candidates = Array.from(area.querySelectorAll('button, a'))
      const matches = candidates.filter((el) => {
        const name = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).toLowerCase()
        return name.includes('全屏') || name.includes('fullscreen')
      })
      const rect = area.getBoundingClientRect()
      const target = matches[0] as HTMLElement | undefined
      const tr = target ? target.getBoundingClientRect() : null
      return {
        count: matches.length,
        inside: !!tr && tr.left >= rect.left - 1 && tr.right <= rect.right + 1,
        visible: !!target && target.offsetParent !== null,
      }
    })
    expect(found.count).toBe(1)
    expect(found.visible).toBe(true)
    expect(found.inside).toBe(true)

    await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_fullscreen_entry.png` })
  })

  test('test_bdd_31_no_per_file_fullscreen_button_and_page_level_count_one', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)
    await page.waitForSelector('.file-sidebar', { timeout: 20000 })

    const audit = await page.evaluate(() => {
      const nameOf = (el: Element) =>
        ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).toLowerCase()
      const matchesFullscreen = (el: Element) => /fullscreen|全屏/.test(nameOf(el))

      const perFile = Array.from(document.querySelectorAll('.file-sidebar button, .file-sidebar a'))
        .filter(matchesFullscreen).length
      const whole = Array.from(document.querySelectorAll('button, a')).filter(matchesFullscreen).length
      return { perFile, whole }
    })
    expect(audit.perFile).toBe(0)
    expect(audit.whole).toBe(1)
  })

  // ── BDD-25 / BDD-26：点击全屏入口 ───────────────────────────────────────

  test('test_bdd_25_click_fullscreen_on_default_file_omits_file_param', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)

    await page.locator(DESKTOP_FULLSCREEN).click()
    await page.waitForTimeout(1500)

    const state = await page.evaluate(() => ({ pathname: location.pathname, search: location.search }))
    expect(state.pathname).toBe(`/${K8S_SLUG}/f`)
    expect(state.search).not.toContain('file=')
  })

  test('test_bdd_26_click_fullscreen_on_non_default_file_keeps_file_param', async ({ page, request }) => {
    const fid = await fileIdOf(request, K8S_SLUG, 'deployment.yaml')
    await page.goto(`${BASE_URL}/${K8S_SLUG}?file=${fid}`)
    await waitDetailReady(page)

    await page.locator(DESKTOP_FULLSCREEN).click()
    await page.waitForTimeout(1500)

    const state = await page.evaluate(() => ({
      pathname: location.pathname,
      search: location.search,
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
    }))
    expect(state.pathname).toBe(`/${K8S_SLUG}/f`)
    expect(state.search).toContain(`file=${fid}`)
    expect(state.body).toContain('kind: Deployment')
  })

  // ── BDD-27 ~ BDD-30：`/f` 全屏态 ────────────────────────────────────────

  test('test_bdd_27_manual_f_enters_fullscreen_with_default_file', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f`)
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      zen: !!document.querySelector('.entry-detail.zen-mode'),
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
    }))
    expect(state.zen).toBe(true)
    expect(state.body).toContain('K8s 部署清单')
  })

  test('test_bdd_28_fullscreen_has_no_file_sidebar_in_dom', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f`)
    // 等待 ≥2s 避开 EntryDetailView 的异步自动展开
    await page.waitForTimeout(2500)

    const counts = await page.evaluate(() => ({
      fileSidebar: document.querySelectorAll('.file-sidebar').length,
      tocSidebar: document.querySelectorAll('.toc-sidebar').length,
    }))
    expect(counts.fileSidebar).toBe(0)
  })

  test('test_bdd_29_fullscreen_has_no_exit_entry_and_keys_are_noop', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f`)
    await waitDetailReady(page)
    const before = await page.evaluate(() => ({ pathname: location.pathname, cls: document.querySelector('.entry-detail')?.className || '' }))

    const exitEntries = await page.evaluate(() => {
      const words = /退出|返回|关闭全屏|exit|close fullscreen/i
      return Array.from(document.querySelectorAll('button, a')).filter((el) => {
        const name = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '')
        return words.test(name)
      }).length
    })
    expect(exitEntries).toBe(0)

    await page.keyboard.press('f')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)

    const after = await page.evaluate(() => ({ pathname: location.pathname, cls: document.querySelector('.entry-detail')?.className || '' }))
    expect(after.cls).toContain('zen-mode')
    expect(after.pathname).toBe(before.pathname)
  })

  test('test_bdd_30_f_key_in_normal_mode_toggles_zen_without_url_change', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)
    const before = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, cls: document.querySelector('.entry-detail')?.className || '' }))
    expect(before.cls).not.toContain('zen-mode')

    await page.keyboard.press('f')
    await page.waitForTimeout(800)

    const after = await page.evaluate(() => ({ pathname: location.pathname, search: location.search, cls: document.querySelector('.entry-detail')?.className || '' }))
    expect(after.cls).toContain('zen-mode')
    expect(after.pathname).toBe(before.pathname)
    expect(after.search).toBe(before.search)
  })

  // ── BDD-42 / BDD-44：真实字节数（E2E 层走真实 file.size）────────────────

  test('test_bdd_42_large_chinese_html_not_auto_rendered', async ({ request, page }) => {
    const chars = 700_084
    const html = `<html><body><p>${'中'.repeat(chars - 22)}</p></body></html>`
    const { slug, files } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd42',
      files: [{ filename: 'big.html', content: html }],
    })
    // 经 API 核实真实字节数 >= 2MB，且 content.length < 2MB
    const entry = await readEntry(request, slug)
    const size = entry.files[0].size as number
    expect(size).toBeGreaterThanOrEqual(2 * 1024 * 1024)
    expect(html.length).toBeLessThan(2 * 1024 * 1024)

    await page.goto(`${BASE_URL}/${slug}?file=${files[0].id}`)
    await waitDetailReady(page)
    expect(await page.locator('iframe').count()).toBe(0)
    expect(await page.locator('[data-testid="manual-render-btn"]').count()).toBe(1)
  })

  test('test_bdd_44_tree_view_uses_real_bytes', async ({ request, page }) => {
    const repeat = 350_000
    const json = JSON.stringify({ note: '中'.repeat(repeat) })
    expect(json.length).toBeLessThan(2 * 1024 * 1024)
    const { slug, files } = await trackCreate(request, {
      summary: 'e2e tpv0104 bdd44',
      files: [{ filename: 'big.json', content: json }],
    })
    const entry = await readEntry(request, slug)
    expect(entry.files[0].size as number).toBeGreaterThanOrEqual(2 * 1024 * 1024)

    await page.goto(`${BASE_URL}/${slug}?file=${files[0].id}`)
    await waitDetailReady(page)
    expect(await page.locator('.truncation-banner').count()).toBe(1)
  })

  // ── BDD-45：安全边界文档（代码/文档 grep，非浏览器）在 vitest 层 → 见 P3-test-cases.md
  // ── BDD-46：CSP 与 sandbox（pytest 层）→ 见 test_tpv0104_inject_budget.py

  // ── BDD-48 / BDD-49 / BDD-51 ~ BDD-54：回归与旧链接 ─────────────────────

  test('test_bdd_48_single_file_entry_unchanged', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SINGLE_FILE_SLUG}`)
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      fileSidebar: document.querySelectorAll('.file-sidebar').length,
      search: location.search,
      hasBody: !!document.querySelector('[data-testid="content-area"]'),
    }))
    expect(state.fileSidebar).toBe(0)
    expect(state.search).not.toContain('file=')
    expect(state.hasBody).toBe(true)
  })

  test('test_bdd_49_share_link_permissions_unchanged', async ({ request, page }) => {
    const res = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'alice', password: 'testpass123' },
    })
    const token = (await res.json()).access_token as string

    const created = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'e2e tpv0104 bdd49',
        is_public: false,
        files: [{ path: 'README.md', filename: 'README.md', content: 'PRIVATE-SHARE-MARKER' }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })
    const entry = await created.json()
    createdSlugs.push(entry.slug)

    const share = await request.post(`${BASE_URL}/api/v1/entries/${entry.slug}/shares`, {
      data: { expires_in: '7d' },
      headers: { Authorization: `Bearer ${token}` },
    })
    const shareToken = (await share.json()).token as string

    await page.goto(`${BASE_URL}/${entry.slug}?share=${shareToken}`)
    await waitDetailReady(page)
    expect((await page.locator(CONTENT_AREA).textContent()) ?? '').toContain('PRIVATE-SHARE-MARKER')

    // 无 token 的匿名访问仍返回 404（私有 entry 不泄露存在性）
    const anon = await request.get(`${BASE_URL}/api/v1/entries/${entry.slug}`)
    expect(anon.status()).toBe(404)
  })

  test('test_bdd_51_legacy_firstFileId_falls_back_to_default', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}?firstFileId=15`)
    await waitDetailReady(page)

    const state = await page.evaluate(() => ({
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
      error: !!document.querySelector('.error-state'),
      search: location.search,
    }))
    // 展示默认入口 README.md（不是 service.yaml），无错误横幅、无白屏
    expect(state.body).toContain('K8s 部署清单')
    expect(state.body).not.toContain('kind: Service')
    expect(state.error).toBe(false)
    // 被忽略而非被支持：不做 302/路由重写
    expect(new URL(page.url()).pathname).toBe(`/${K8S_SLUG}`)
  })

  test('test_bdd_52_manual_experience_seed_entry_has_content_and_toc4', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)
    expect(await ensureTocExpanded(page), 'BDD-52 钉定桌面视口').toBe(true)

    const body = (await page.locator(CONTENT_AREA).textContent()) ?? ''
    expect(body).toContain('K8s 部署清单')

    // 该文件含 1 个 h1 + 3 个 h2；决策 B 生效后 h1 也入目录 → 4
    const tocCount = await page.locator('.toc-list .toc-item').count()
    expect(tocCount).toBe(4)
  })

  test('test_bdd_53_fullscreen_is_pure_content', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f`)
    await page.waitForTimeout(2500)

    const metrics = await page.evaluate(() => {
      const visible = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) return 0
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 ? 1 : 0
      }
      const content = document.querySelector('[data-testid="content-area"]') as HTMLElement | null
      return {
        header: visible('.detail-header'),
        mobileSticky: visible('.mobile-sticky-header'),
        mobileBar: visible('[data-testid="mobile-bottom-bar"]'),
        metaTags: visible('.meta-tags-bar'),
        contentWidthRatio: content ? content.getBoundingClientRect().width / window.innerWidth : 0,
        fileSidebarDom: document.querySelectorAll('.file-sidebar').length,
        tocSidebarDom: document.querySelectorAll('.toc-sidebar').length,
      }
    })
    // ① 可视计数均为 0（回归守护）
    expect(metrics.header).toBe(0)
    expect(metrics.mobileSticky).toBe(0)
    expect(metrics.mobileBar).toBe(0)
    expect(metrics.metaTags).toBe(0)
    // ② 内容区可见且宽度 >= 0.95 视口
    expect(metrics.contentWidthRatio).toBeGreaterThanOrEqual(0.95)
    // ③ 侧栏 DOM 计数为 0（新增需求）
    expect(metrics.fileSidebarDom).toBe(0)
    expect(metrics.tocSidebarDom).toBe(0)

    await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800.png` })
  })

  test('test_bdd_54_fullscreen_body_file_link_switches_and_syncs_url', async ({ page }) => {
    // unicode-filenames 是 seed 中唯一正文含跨文件相对路径链接的多文件 entry
    await page.goto(`${BASE_URL}/${UNICODE_SLUG}/f`)
    await waitDetailReady(page)

    const link = page.locator(`${MARKDOWN_BODY} a`).filter({ hasText: 'English attachment' }).first()
    await expect(link).toHaveCount(1)
    await link.click()
    await page.waitForTimeout(1800)

    const state = await page.evaluate(() => ({
      body: (document.querySelector('[data-testid="content-area"]')?.textContent) || '',
      search: location.search,
      zen: !!document.querySelector('.entry-detail.zen-mode'),
    }))
    expect(state.body).toContain('English attachment placeholder')
    expect(state.search).toMatch(/file=\d+/)
    expect(state.zen).toBe(true)
  })
})

// ============================================================================
// 移动 390×844
// ============================================================================
test.describe('TPV0104 mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.afterEach(async ({ request }) => {
    await swampCleanup(request)
  })

  test('test_bdd_24_mobile_entry_in_bottom_bar_without_obscuring_content', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)

    const bar = page.locator(MOBILE_BOTTOM_BAR)
    await expect(bar).toHaveCount(1)

    const metrics = await page.evaluate((sel) => {
      const barEl = document.querySelector(sel) as HTMLElement | null
      const btn = document.querySelector('[data-testid="mobile-bar-fullscreen-btn"]') as HTMLElement | null
      const ca = document.querySelector('[data-testid="content-area"]') as HTMLElement | null
      const br = barEl ? barEl.getBoundingClientRect() : null
      const tr = btn ? btn.getBoundingClientRect() : null
      let lastBottom = 0
      if (ca) {
        const children = Array.from(ca.querySelectorAll('*')) as HTMLElement[]
        for (const child of children) {
          const r = child.getBoundingClientRect()
          if (r.height > 0 && r.bottom > lastBottom) lastBottom = r.bottom
        }
      }
      return {
        inside: !!br && !!tr && tr.left >= br.left - 1 && tr.right <= br.right + 1,
        barHeight: br ? br.height : -1,
        barTop: br ? br.top : -1,
        lastBottom,
      }
    }, MOBILE_BOTTOM_BAR)

    // ① 入口热区完全落在底栏矩形内
    expect(metrics.inside).toBe(true)
    // ② 底栏高度 <= 64px（不因新增入口增高）
    expect(metrics.barHeight).toBeLessThanOrEqual(64)
    // ③ 正文末元素底 <= 操作栏顶（不重叠）
    expect(metrics.lastBottom).toBeLessThanOrEqual(metrics.barTop + 1)

    await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844.png` })
  })

  test('test_bdd_25_mobile_click_fullscreen_navigates_to_f', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}`)
    await waitDetailReady(page)
    await page.locator(MOBILE_FULLSCREEN).click()
    await page.waitForTimeout(1500)

    const state = await page.evaluate(() => ({ pathname: location.pathname, search: location.search }))
    expect(state.pathname).toBe(`/${K8S_SLUG}/f`)
  })

  test('test_bdd_28_mobile_fullscreen_has_no_file_sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/${K8S_SLUG}/f`)
    await page.waitForTimeout(2500)
    expect(await page.locator('.file-sidebar').count()).toBe(0)
  })
})
