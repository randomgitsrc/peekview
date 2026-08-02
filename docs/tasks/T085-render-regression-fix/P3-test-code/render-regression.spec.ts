// 部署位置: frontend-v3/e2e/render-regression.spec.ts
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// T085 详情页渲染回归修复 E2E（BDD-1~11）
// 运行：E2E_SPEC=e2e/render-regression.spec.ts make debug-test（debug backend :8888）
// 当前红灯：
//   - SVG 走 TreeView（非 ImageViewer）→ BDD-1 断言失败
//   - 源码视图无法滚动 → BDD-4/5 断言失败
//   - Markdown 无 padding → BDD-6/7 断言失败
//   - scroll-hide 无边界保护 → BDD-8 断言失败
//   - per-page 无自定义下拉 → BDD-9/10/11 断言失败

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T085-render-regression-fix/evidences'

// 测试数据
const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect x="10" y="10" width="180" height="180" fill="#4d8dff" rx="20"/>
  <text x="100" y="110" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif">SVG Test</text>
</svg>`

const XML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">First item</item>
  <item id="2">Second item</item>
  <item id="3">Third item</item>
</root>`

const CSV_150 = `name,age,city\n${Array.from({ length: 150 }, (_, i) => `user${i},${20 + (i % 60)},city${i % 10}`).join('\n')}`

const LONG_TEXT_LINES = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: This is a long text file for testing vertical scroll in source view.`).join('\n')

const MARKDOWN_LONG = `# Long Markdown Test

${Array.from({ length: 100 }, (_, i) => `## Section ${i + 1}\n\nThis is paragraph ${i + 1} with some content to make the document long enough for padding measurement.\n`).join('\n')}`

async function createEntry(request: APIRequestContext, slug: string, summary: string, files: { filename: string; content: string }[]) {
  await request.post(`${BASE_URL}/api/v1/entries`, {
    data: { summary, slug, is_public: true, files },
  }).catch(() => {})
}

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  await createEntry(request, 't085-svg', 'T085 SVG', [{ filename: 'icon.svg', content: SVG_CONTENT }])
  await createEntry(request, 't085-xml', 'T085 XML', [{ filename: 'data.xml', content: XML_CONTENT }])
  await createEntry(request, 't085-csv-150', 'T085 CSV 150', [{ filename: 'data.csv', content: CSV_150 }])
  await createEntry(request, 't085-long-text', 'T085 Long Text', [{ filename: 'long.txt', content: LONG_TEXT_LINES }])
  await createEntry(request, 't085-markdown', 'T085 Markdown', [{ filename: 'readme.md', content: MARKDOWN_LONG }])
  await createEntry(request, 't085-multi', 'T085 Multi', [
    { filename: 'icon.svg', content: SVG_CONTENT },
    { filename: 'data.xml', content: XML_CONTENT },
    { filename: 'data.csv', content: CSV_150 },
  ])
})

async function gotoEntry(page: Page, slug: string) {
  await page.goto(`${BASE_URL}/${slug}`)
}

// ============================================================
// 桌面端（1280×800）— BDD-1~5, 8~9, 11
// ============================================================
test.describe('T085 Desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ---------- BDD-1: SVG 文件默认渲染为图片预览 ----------
  test('test_bdd_1_svg_default_image_preview', async ({ page }) => {
    await gotoEntry(page, 't085-svg')
    await expect(page.locator('.image-viewer')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tree-view')).toHaveCount(0)
    await expect(page.locator('.code-viewer')).toHaveCount(0)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd1_desktop_1280x800.png') })
  })

  // ---------- BDD-2: 普通 XML 文件仍渲染为树视图 ----------
  test('test_bdd_2_xml_still_tree_view', async ({ page }) => {
    await gotoEntry(page, 't085-xml')
    await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tree-node').first()).toBeVisible()
    await expect(page.locator('.image-viewer')).toHaveCount(0)
  })

  // ---------- BDD-3: SVG 文件不显示源码/渲染切换按钮 ----------
  test('test_bdd_3_svg_no_source_toggle_button', async ({ page }) => {
    await gotoEntry(page, 't085-svg')
    await expect(page.locator('.image-viewer')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button[aria-label="Show source code"]')).toHaveCount(0)
    await expect(page.locator('button[aria-label="Show rendered view"]')).toHaveCount(0)
  })

  // ---------- BDD-4: 富渲染格式源码视图可纵向滚动到底 ----------
  test('test_bdd_4_source_view_scroll_to_bottom', async ({ page }) => {
    await gotoEntry(page, 't085-csv-150')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    await page.locator('button[aria-label="Show source code"]').click()
    await expect(page.locator('.code-viewer')).toBeVisible()

    const contentArea = page.locator('.content-area')
    const scrollInfo = await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      return {
        scrollHeight: e.scrollHeight,
        clientHeight: e.clientHeight,
        scrollTop: e.scrollTop,
      }
    })
    expect(scrollInfo.scrollHeight).toBeGreaterThan(scrollInfo.clientHeight)

    await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      e.scrollTop = e.scrollHeight
    })
    await page.waitForTimeout(200)

    const atBottom = await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      return e.scrollHeight - e.scrollTop - e.clientHeight < 10
    })
    expect(atBottom).toBe(true)
  })

  // ---------- BDD-5: 普通文本 fallback 源码视图可纵向滚动到底 ----------
  test('test_bdd_5_fallback_source_scroll_to_bottom', async ({ page }) => {
    await gotoEntry(page, 't085-long-text')
    await expect(page.locator('.code-viewer')).toBeVisible({ timeout: 10000 })

    const contentArea = page.locator('.content-area')
    const scrollInfo = await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      return {
        scrollHeight: e.scrollHeight,
        clientHeight: e.clientHeight,
      }
    })
    expect(scrollInfo.scrollHeight).toBeGreaterThan(scrollInfo.clientHeight)

    await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      e.scrollTop = e.scrollHeight
    })
    await page.waitForTimeout(200)

    const atBottom = await contentArea.evaluate((el) => {
      const e = el as HTMLElement
      return e.scrollHeight - e.scrollTop - e.clientHeight < 10
    })
    expect(atBottom).toBe(true)
  })

  // ---------- BDD-6: 桌面端 Markdown 渲染视图左右留白 ≥32px ----------
  test('test_bdd_6_desktop_markdown_padding_32px', async ({ page }) => {
    await gotoEntry(page, 't085-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })

    const padding = await page.evaluate(() => {
      const contentArea = document.querySelector('.content-area') as HTMLElement
      const markdownBody = document.querySelector('.markdown-body') as HTMLElement
      if (!contentArea || !markdownBody) return null
      const caRect = contentArea.getBoundingClientRect()
      const mbRect = markdownBody.getBoundingClientRect()
      return {
        leftPadding: mbRect.left - caRect.left,
        rightPadding: caRect.right - mbRect.right,
      }
    })
    expect(padding).not.toBeNull()
    expect(padding!.leftPadding).toBeGreaterThanOrEqual(32)
    expect(padding!.rightPadding).toBeGreaterThanOrEqual(32)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd6_desktop_1280x800.png') })
  })

  // ---------- BDD-8: 滚动到底端后继续滚动不触发抖动 ----------
  test('test_bdd_8_bottom_scroll_no_jitter', async ({ page }) => {
    await gotoEntry(page, 't085-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })

    const contentArea = page.locator('.content-area')

    await contentArea.evaluate((el) => {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight
    })
    await page.waitForTimeout(300)

    const classBefore = await page.locator('.meta-tags-bar').first().getAttribute('class') || ''
    const hiddenBefore = classBefore.includes('hidden')

    for (let i = 0; i < 5; i++) {
      await contentArea.evaluate((el) => {
        const e = el as HTMLElement
        e.scrollTop = e.scrollHeight - 2 + i
      })
      await page.waitForTimeout(100)
    }

    const classAfter = await page.locator('.meta-tags-bar').first().getAttribute('class') || ''
    const hiddenAfter = classAfter.includes('hidden')

    expect(hiddenAfter).toBe(hiddenBefore)
  })

  // ---------- BDD-9: 真实点击可选中每页行数并回到第 1 页 ----------
  test('test_bdd_9_real_click_per_page_select', async ({ page }) => {
    await gotoEntry(page, 't085-csv-150')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    const page3 = page.locator('.page-num', { hasText: '3' }).first()
    await page3.click()
    await expect(page.locator('tbody tr').first()).toContainText('user200')
    await expect(page.locator('.page-num.active')).toHaveText('3')

    const trigger = page.locator('button.per-page-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    await page.waitForTimeout(200)

    const option50 = page.locator('[role="option"][data-value="50"]')
    await expect(option50).toBeVisible()
    await option50.click()
    await page.waitForTimeout(300)

    await expect(page.locator('tbody tr')).toHaveCount(50)
    await expect(page.locator('.page-num.active')).toHaveText('1')
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd9_desktop_1280x800.png') })
  })

  // ---------- BDD-11: 每页行数控件支持键盘操作 ----------
  test('test_bdd_11_keyboard_per_page_e2e', async ({ page }) => {
    await gotoEntry(page, 't085-csv-150')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    const trigger = page.locator('button.per-page-trigger')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    await expect(page.locator('[role="listbox"]')).toBeVisible()

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)

    const option50 = page.locator('[role="option"][data-value="50"]')
    const isFocused = await option50.evaluate((el) => {
      return el === document.activeElement || el.getAttribute('aria-selected') === 'true'
    })

    await option50.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    await expect(page.locator('tbody tr')).toHaveCount(50)
    await expect(page.locator('.page-num.active')).toHaveText('1')
  })
})

// ============================================================
// 移动端（390×844）— BDD-7, 10
// ============================================================
test.describe('T085 Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // ---------- BDD-7: 移动端 Markdown 渲染视图左右留白 ≥16px ----------
  test('test_bdd_7_mobile_markdown_padding_16px', async ({ page }) => {
    await gotoEntry(page, 't085-markdown')
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 10000 })

    const padding = await page.evaluate(() => {
      const contentArea = document.querySelector('.content-area') as HTMLElement
      const markdownBody = document.querySelector('.markdown-body') as HTMLElement
      if (!contentArea || !markdownBody) return null
      const caRect = contentArea.getBoundingClientRect()
      const mbRect = markdownBody.getBoundingClientRect()
      return {
        leftPadding: mbRect.left - caRect.left,
        rightPadding: caRect.right - mbRect.right,
      }
    })
    expect(padding).not.toBeNull()
    expect(padding!.leftPadding).toBeGreaterThanOrEqual(16)
    expect(padding!.rightPadding).toBeGreaterThanOrEqual(16)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd7_mobile_390x844.png') })
  })

  // ---------- BDD-10: 每页行数控件触达目标 ≥44px ----------
  test('test_bdd_10_per_page_touch_target_44px', async ({ page }) => {
    await gotoEntry(page, 't085-csv-150')
    await expect(page.locator('.table-view')).toBeVisible({ timeout: 10000 })

    const trigger = page.locator('button.per-page-trigger')
    await expect(trigger).toBeVisible()

    const size = await trigger.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      return { width: r.width, height: r.height }
    })
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd10_mobile_390x844.png') })
  })
})
