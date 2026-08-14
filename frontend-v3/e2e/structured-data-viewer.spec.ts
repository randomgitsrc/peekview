import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// T075 结构化数据查看器 E2E（BDD-12~53）
// 运行：E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test（debug backend :8888）
// 当前红灯：页面无 TableView/TreeView/切换按钮 → 断言失败

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T075-structured-data-viewer/evidences'

const CSV_120 = `name,age,city\n${Array.from({ length: 120 }, (_, i) => `user${i},${20 + (i % 60)},city${i % 10}`).join('\n')}`
const CSV_300 = `name,age,city\n${Array.from({ length: 300 }, (_, i) => `user${i},${20 + (i % 60)},city${i % 10}`).join('\n')}`
const CSV_QUOTED = `a,b\n"hello, world",x\n"line1\nline2",y\n"say ""hi""",z`
const TSV_CONTENT = 'name\tage\tcity\nalice\t30\tbeijing\nbob\t25\tshanghai'
const JSON_CONTENT = JSON.stringify({ name: 'alice', age: 30, admin: true, notes: null, tags: ['a', 'b'], meta: { level: 3 } }, null, 2)
const YAML_CONTENT = 'name: alice\nage: 30\nadmin: true\nnotes: null\ntags:\n  - a\n  - b\nmeta:\n  level: 3'
const XML_CONTENT = '<root><item id="1">text</item><item id="2">more</item></root>'
const MARKDOWN_CONTENT = '# T075 Markdown\n\n## Heading Two\n\nSome **bold** content.\n\n## Another Heading\n\nMore text.'
const CSV_BROKEN = 'a,b\n"unclosed'
const JSON_BROKEN = '{"name": "broken", '
const CSV_HUGE = `v,i\n${Array.from({ length: 50001 }, (_, i) => `val,${i}`).join('\n')}`
const CSV_WIDE = `${Array.from({ length: 30 }, (_, i) => `col${i}`).join(',')}\n${Array.from({ length: 30 }, (_, i) => `v${i}`).join(',')}`
const BIG_JSON = 'x'.repeat(2 * 1024 * 1024 + 100)
const BIG_YAML = 'x'.repeat(2 * 1024 * 1024 + 100)
const BIG_XML = 'x'.repeat(2 * 1024 * 1024 + 100)

// TPV0094 fixture：镜像 jsonToTreeData 计数语义（根容器不计数）
function countNodeValue(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1
  const entries = Array.isArray(value) ? value : Object.values(value)
  return 1 + entries.reduce((sum, v) => sum + countNodeValue(v), 0)
}
function totalRenderedNodes(content: string): number {
  const data = JSON.parse(content)
  if (data === null || typeof data !== 'object') return 1
  const entries = Array.isArray(data) ? data : Object.values(data)
  return entries.reduce((sum, v) => sum + countNodeValue(v), 0)
}
// 根 data → 20 子树 × 500 叶子 = 10021 节点（BDD-3/4 分支结构，单次点击渲染受控）
function buildLargeBranchJson(): string {
  const root: Record<string, unknown> = { data: {} }
  const subs = root.data as Record<string, Record<string, number>>
  for (let s = 0; s < 20; s++) {
    const sub: Record<string, number> = {}
    for (let i = 0; i < 500; i++) sub[`leaf_${s}_${i}`] = i
    subs[`sub_${s}`] = sub
  }
  return JSON.stringify(root)
}
const LARGE_JSON = buildLargeBranchJson()
const LARGE_TOTAL = totalRenderedNodes(LARGE_JSON)
const SMALL_JSON = JSON_CONTENT
const SMALL_TOTAL = totalRenderedNodes(SMALL_JSON)

async function createEntry(request: APIRequestContext, slug: string, summary: string, files: { filename: string; content: string }[]) {
  await request.post(`${BASE_URL}/api/v1/entries`, {
    data: { summary, slug, is_public: true, files },
  }).catch(() => {})
}

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  await createEntry(request, 't075-csv', 'T075 CSV', [{ filename: 'data.csv', content: CSV_120 }])
  await createEntry(request, 't075-csv-300', 'T075 CSV 300', [{ filename: 'data300.csv', content: CSV_300 }])
  await createEntry(request, 't075-csv-quoted', 'T075 CSV quoted', [{ filename: 'quoted.csv', content: CSV_QUOTED }])
  await createEntry(request, 't075-tsv', 'T075 TSV', [{ filename: 'data.tsv', content: TSV_CONTENT }])
  await createEntry(request, 't075-json', 'T075 JSON', [{ filename: 'data.json', content: JSON_CONTENT }])
  await createEntry(request, 't075-yaml', 'T075 YAML', [{ filename: 'data.yaml', content: YAML_CONTENT }])
  await createEntry(request, 't075-xml', 'T075 XML', [{ filename: 'data.xml', content: XML_CONTENT }])
  await createEntry(request, 't075-markdown', 'T075 Markdown', [{ filename: 'readme.md', content: MARKDOWN_CONTENT }])
  await createEntry(request, 't075-multi', 'T075 Multi file', [
    { filename: 'data.csv', content: CSV_120 },
    { filename: 'data.json', content: JSON_CONTENT },
    { filename: 'readme.md', content: MARKDOWN_CONTENT },
  ])
  await createEntry(request, 't075-csv-broken', 'T075 broken CSV', [{ filename: 'broken.csv', content: CSV_BROKEN }])
  await createEntry(request, 't075-json-broken', 'T075 broken JSON', [{ filename: 'broken.json', content: JSON_BROKEN }])
  await createEntry(request, 't075-big', 'T075 big files', [
    { filename: 'big.json', content: BIG_JSON },
    { filename: 'big.yaml', content: BIG_YAML },
    { filename: 'big.xml', content: BIG_XML },
  ])
  await createEntry(request, 't075-json-empty', 'T075 empty JSON', [{ filename: 'empty.json', content: '{}' }])
  await createEntry(request, 't075-csv-huge', 'T075 huge CSV', [{ filename: 'huge.csv', content: CSV_HUGE }])
  await createEntry(request, 't075-csv-wide', 'T075 wide CSV', [{ filename: 'wide.csv', content: CSV_WIDE }])
  await createEntry(request, 't075-csv-empty', 'T075 empty CSV', [{ filename: 'empty.csv', content: '' }])
  await createEntry(request, 't094-large', 'T094 large JSON', [{ filename: 'large.json', content: LARGE_JSON }])
  await createEntry(request, 't094-multi', 'T094 multi small+large', [
    { filename: 'large.json', content: LARGE_JSON },
    { filename: 'small.json', content: SMALL_JSON },
  ])
})

async function gotoEntry(page: Page, slug: string) {
  await page.goto(`${BASE_URL}/${slug}`)
}

// ============================================================
// 桌面端（1280×800）
// ============================================================
test.describe('T075 Desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('test_bdd_12_csv_renders_table', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('thead th').first()).toBeVisible()
    expect(await page.locator('thead th').count()).toBe(3)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'desktop_1280x800.png') })
  })

  test('test_bdd_13_tsv_renders_table', async ({ page }) => {
    await gotoEntry(page, 't075-tsv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('thead th').first()).toHaveText('name')
    expect(await page.locator('thead th').count()).toBe(3)
    await expect(page.locator('tbody tr').first()).toContainText('alice')
  })

  test('test_bdd_14_quoted_comma_single_cell', async ({ page }) => {
    await gotoEntry(page, 't075-csv-quoted')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tbody tr td').first()).toHaveText('hello, world')
  })

  test('test_bdd_15_quoted_newline_single_cell', async ({ page }) => {
    await gotoEntry(page, 't075-csv-quoted')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    const cells = page.locator('tbody tr')
    expect(await cells.count()).toBe(3)
    await expect(cells.nth(1).locator('td').first()).toContainText('line1')
    await expect(cells.nth(1).locator('td').first()).toContainText('line2')
  })

  test('test_bdd_16_escaped_quotes_rendered', async ({ page }) => {
    await gotoEntry(page, 't075-csv-quoted')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('tbody tr').nth(2).locator('td').first()).toHaveText('say "hi"')
  })

  test('test_bdd_17_sort_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    const ageHeader = page.locator('thead th').nth(1)
    const ageSortBtn = ageHeader.locator('.th-sort-btn')

    await ageSortBtn.click()
    await expect(ageHeader).toHaveAttribute('aria-sort', 'ascending')
    await expect(page.locator('tbody tr').first()).toContainText('user0')

    await ageSortBtn.click()
    await expect(ageHeader).toHaveAttribute('aria-sort', 'descending')

    await ageSortBtn.click()
    await expect(ageHeader).not.toHaveAttribute('aria-sort', /ascending|descending/)
  })

  test('test_bdd_18_filter_contains', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    const filter = page.locator('input[aria-label="Filter name"]')
    await expect(filter).toBeVisible()
    await filter.fill('user5')
    const rows = page.locator('tbody tr')
    expect(await rows.count()).toBe(11)
    for (let i = 0; i < 11; i++) {
      await expect(rows.nth(i)).toContainText('user5')
    }
  })

  test('test_bdd_19_default_per_page_100', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('tbody tr').count()).toBe(100)
    await expect(page.locator('.pagination')).toBeVisible()
    const trigger = page.locator('button.per-page-trigger')
    await expect(trigger).toBeVisible()
    await expect(trigger).toContainText('100')
  })

  test('test_bdd_20_per_page_switch_page_one', async ({ page }) => {
    await gotoEntry(page, 't075-csv-300')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('.page-num', { hasText: '3' }).first().click()
    await expect(page.locator('tbody tr').first()).toContainText('user200')
    const trigger = page.locator('button.per-page-trigger')
    await trigger.click()
    await page.waitForTimeout(200)
    const option50 = page.locator('[role="option"][data-value="50"]')
    await expect(option50).toBeVisible()
    await option50.click()
    await page.waitForTimeout(300)
    await expect(page.locator('tbody tr')).toHaveCount(50)
    await expect(page.locator('.page-num.active')).toHaveText('1')
  })

  test('test_bdd_21_horizontal_scroll', async ({ page }) => {
    await gotoEntry(page, 't075-csv-wide')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    const scrollable = await page.locator('.table-scroll').evaluate((el) => {
      const e = el as HTMLElement
      return e.scrollWidth > e.clientWidth
    })
    expect(scrollable).toBe(true)
  })

  test('test_bdd_22_truncation_banner_download', async ({ page }) => {
    await gotoEntry(page, 't075-csv-huge')
    await expect(page.locator('.truncation-banner')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.truncation-banner')).toContainText('50,000')
    expect(await page.locator('tbody tr').count()).toBe(50000)
    await expect(page.locator('.truncation-banner button')).toBeVisible()
  })

  test('test_bdd_23_empty_csv_no_crash', async ({ page }) => {
    await gotoEntry(page, 't075-csv-empty')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
  })

  test('test_bdd_24_json_tree', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.tree-node').count()).toBeGreaterThan(0)
  })

  test('test_bdd_25_yaml_tree', async ({ page }) => {
    await gotoEntry(page, 't075-yaml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tree-node-label').first()).toContainText('name')
  })

  test('test_bdd_26_xml_tree', async ({ page }) => {
    await gotoEntry(page, 't075-xml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tree-node-label').first()).toContainText('root')
  })

  test('test_bdd_27_expand_node', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    // TPV0094 默认展开语义：小 JSON（≤阈值）初始即全展开，无需点击
    const metaNode = page.locator('.tree-node').filter({ hasText: 'meta' }).first()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(metaNode).toContainText('level')
  })

  test('test_bdd_28_collapse_node', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    // TPV0094：小 JSON 初始全展开，点击一次折叠 → 子节点隐藏
    const metaNode = page.locator('.tree-node').filter({ hasText: 'meta' }).first()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await metaNode.locator('.expand-toggle').click()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(metaNode).not.toContainText('level')
  })

  test('test_bdd_29_type_tags', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    for (const type of ['string', 'number', 'boolean', 'null', 'array', 'object']) {
      await expect(page.locator(`.type-tag:has-text("${type}")`).first()).toBeVisible()
    }
  })

  test('test_bdd_30_search_highlight', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    const search = page.locator('input[aria-label="Search tree nodes"]')
    await expect(search).toBeVisible()
    await search.fill('alice')
    expect(await page.locator('.search-highlight').count()).toBeGreaterThan(0)
    await expect(page.locator('.search-match-count')).toContainText(/\d+/)
  })

  test('test_bdd_31_click_copy_value', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    const ageNode = page.locator('.tree-node').filter({ hasText: 'age' }).first()
    await ageNode.locator('.tree-node-label').click()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('30')
  })

  test('test_bdd_32_yaml_unsafe_error', async ({ page }) => {
    await gotoEntry(page, 't075-yaml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await page.request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T075 unsafe yaml',
        slug: 't075-yaml-unsafe',
        is_public: true,
        files: [{ filename: 'unsafe.yaml', content: 'a: !!python/object:os.system ["ls"]' }],
      },
    }).catch(() => {})
    await gotoEntry(page, 't075-yaml-unsafe')
    await expect(page.locator('[role="alert"], .parse-error-banner')).toBeVisible({ timeout: 10000 })
  })

  test('test_bdd_33_json_2mb_truncation', async ({ page }) => {
    await gotoEntry(page, 't075-big')
    await expect(page.locator('.tree-view, .truncation-banner').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.truncation-banner')).toContainText('2MB')
    await expect(page.locator('.truncation-banner button')).toBeVisible()
  })

  test('test_bdd_34_yaml_2mb_truncation', async ({ page }) => {
    await gotoEntry(page, 't075-big')
    await expect(page.locator('.file-item').first()).toBeVisible({ timeout: 10000 })
    await page.locator('.file-item').filter({ hasText: 'big.yaml' }).click()
    await expect(page.locator('.truncation-banner')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.truncation-banner')).toContainText('2MB')
  })

  test('test_bdd_35_xml_2mb_truncation', async ({ page }) => {
    await gotoEntry(page, 't075-big')
    await expect(page.locator('.file-item').first()).toBeVisible({ timeout: 10000 })
    await page.locator('.file-item').filter({ hasText: 'big.xml' }).click()
    await expect(page.locator('.truncation-banner')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.truncation-banner')).toContainText('2MB')
  })

  test('test_bdd_36_empty_json_no_crash', async ({ page }) => {
    await gotoEntry(page, 't075-json-empty')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
  })

  // ---------- 源码/渲染切换 ----------

  test('test_bdd_37_default_render_view', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.code-viewer')).toHaveCount(0)
  })

  test('test_bdd_38_switch_to_source', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 't075-source-view.png') })
  })

  test('test_bdd_39_switch_back_to_render', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.table-view')).toBeVisible()
  })

  test('test_bdd_40_markdown_switch_source', async ({ page }) => {
    await gotoEntry(page, 't075-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
  })

  test('test_bdd_41_markdown_back_toc_restored', async ({ page }) => {
    await gotoEntry(page, 't075-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.markdown-body')).toBeVisible()
    await expect(page.locator('.toc-sidebar, .toc-nav').first()).toBeVisible()
  })

  test('test_bdd_42_file_switch_resets_render', async ({ page }) => {
    await gotoEntry(page, 't075-multi')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('.file-item').filter({ hasText: 'data.json' }).click()
    await expect(page.locator('.tree-view')).toBeVisible()
  })

  test('test_bdd_43_csv_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.table-view')).toBeVisible()
  })

  test('test_bdd_44_tsv_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-tsv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.table-view')).toBeVisible()
  })

  test('test_bdd_45_json_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.tree-view')).toBeVisible()
  })

  test('test_bdd_46_yaml_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-yaml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.tree-view')).toBeVisible()
  })

  test('test_bdd_47_xml_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-xml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.tree-view')).toBeVisible()
  })

  test('test_bdd_48_markdown_toggle_cycle', async ({ page }) => {
    await gotoEntry(page, 't075-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })
    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()
    await page.locator('button[aria-label="Show rendered view"]').click()
    await expect(page.locator('.markdown-body')).toBeVisible()
  })

  // ---------- 异常处理 ----------

  test('test_bdd_49_broken_csv_downgrade_source', async ({ page }) => {
    await gotoEntry(page, 't075-csv-broken')
    await expect(page.locator('[role="alert"], .parse-error-banner').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.code-viewer')).toBeVisible()
  })

  test('test_bdd_50_broken_json_error_banner', async ({ page }) => {
    await gotoEntry(page, 't075-json-broken')
    await expect(page.locator('[role="alert"], .parse-error-banner').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.code-viewer')).toBeVisible()
  })

  // ---------- 主题 ----------

  test('test_bdd_51_theme_both_dark_light', async ({ page }) => {
    await gotoEntry(page, 't075-csv')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    const themeBtn = page.locator('.theme-toggle')
    await expect(themeBtn).toBeVisible()

    const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    await themeBtn.click()
    const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(themeAfter).not.toBe(themeBefore)
    await expect(page.locator('.table-view')).toBeVisible()
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `t075-theme-${themeAfter}.png`) })

    await themeBtn.click()
    await expect(page.locator('.table-view')).toBeVisible()
  })
})

// ============================================================
// TPV0094 默认展开（桌面端 1280×800）
// ============================================================
test.describe('TPV0094 默认展开', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('test_bdd_1_small_json_default_expanded', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.tree-node').count()).toBe(SMALL_TOTAL)
    expect(await page.locator('.expand-toggle[aria-expanded="false"]').count()).toBe(0)
  })

  test('test_bdd_2_small_yaml_xml_default_expanded', async ({ page }) => {
    await gotoEntry(page, 't075-yaml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.expand-toggle[aria-expanded="false"]').count()).toBe(0)
    await expect(page.locator('.tree-node').filter({ hasText: 'level' }).first()).toBeVisible()

    await gotoEntry(page, 't075-xml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.expand-toggle[aria-expanded="false"]').count()).toBe(0)
    await expect(page.locator('.tree-node').filter({ hasText: 'more' }).first()).toBeVisible()
  })

  test('test_bdd_3_large_json_collapsed_banner', async ({ page }) => {
    await gotoEntry(page, 't094-large')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="tree-collapse-banner"]')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.tree-node').count()).toBeLessThan(LARGE_TOTAL)
    await expect(page.locator('.truncation-banner')).toHaveCount(0)
  })

  test('test_bdd_4_large_manual_expand', async ({ page }) => {
    await gotoEntry(page, 't094-large')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="tree-collapse-banner"]')).toBeVisible({ timeout: 10000 })

    const dataNode = page.locator('.tree-node').filter({ hasText: 'data' }).first()
    await expect(dataNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'false')
    await dataNode.locator('.expand-toggle').click()
    await expect(dataNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.tree-node').filter({ hasText: 'sub_0' }).first()).toBeVisible()

    const sub0 = page.locator('.tree-node').filter({ hasText: 'sub_0' }).first()
    await expect(sub0.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'false')
    await sub0.locator('.expand-toggle').click()
    await expect(sub0.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.tree-node').filter({ hasText: 'leaf_0_499' }).first()).toBeVisible()
  })

  test('test_bdd_5_switch_file_resets_expansion', async ({ page }) => {
    await gotoEntry(page, 't094-multi')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="tree-collapse-banner"]')).toBeVisible({ timeout: 10000 })

    await page.locator('.file-item').filter({ hasText: 'small.json' }).click()
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    expect(await page.locator('.tree-node').count()).toBe(SMALL_TOTAL)
    expect(await page.locator('.expand-toggle[aria-expanded="false"]').count()).toBe(0)
    await expect(page.locator('[data-testid="tree-collapse-banner"]')).toHaveCount(0)
  })

  test('test_bdd_6_toggle_reversible', async ({ page }) => {
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    const metaNode = page.locator('.tree-node').filter({ hasText: 'meta' }).first()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(metaNode).toContainText('level')

    await metaNode.locator('.expand-toggle').click()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(metaNode).not.toContainText('level')

    await metaNode.locator('.expand-toggle').click()
    await expect(metaNode.locator('.expand-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(metaNode).toContainText('level')
  })

  test('test_bdd_7_search_count_in_collapsed', async ({ page }) => {
    await gotoEntry(page, 't094-large')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="tree-collapse-banner"]')).toBeVisible({ timeout: 10000 })

    const search = page.locator('input[aria-label="Search tree nodes"]')
    await expect(search).toBeVisible()
    await search.fill('leaf_19_499')
    await expect(page.locator('[aria-live="polite"]')).toContainText(/\d+/)
  })
})

// ============================================================
// 移动端（390×844）
// ============================================================
test.describe('T075 Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('test_bdd_52_mobile_responsive', async ({ page }) => {
    await gotoEntry(page, 't075-csv-wide')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    // 表格可横向滚动
    const scrollable = await page.locator('.table-scroll').evaluate((el) => {
      const e = el as HTMLElement
      return e.scrollWidth > e.clientWidth
    })
    expect(scrollable).toBe(true)

    // 源码/渲染切换按钮移动端可见
    await expect(page.locator('button[aria-label="Show source code"]').first()).toBeVisible()

    // 树节点展开/折叠触摸目标 ≥44px
    await gotoEntry(page, 't075-json')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    const toggleSize = await page.locator('.expand-toggle').first().evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      return Math.min(r.width, r.height)
    })
    expect(toggleSize).toBeGreaterThanOrEqual(44)

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'mobile_390x844.png') })
  })
})

// ============================================================
// 端到端（后端 language 值驱动渲染器）
// ============================================================
test.describe('T075 端到端', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('test_bdd_53_backend_tsv_drives_tsv_branch', async ({ page }) => {
    await gotoEntry(page, 't075-tsv')
    // 后端对 .tsv 返回 language='tsv'，前端应进入 TSV 表格分支（而非 CSV 分支或 CodeViewer）
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.code-viewer')).toHaveCount(0)
    // tab 分隔被正确解析为列
    await expect(page.locator('thead th').first()).toHaveText('name')
    expect(await page.locator('thead th').count()).toBe(3)
  })
})
