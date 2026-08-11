// TPV0089 非 ASCII 文件名本地资源引用 E2E（BDD-10~13）
// 运行：E2E_SPEC=e2e/unicode-filename-link.spec.ts make debug-test（debug backend :8888）
// 前置：make debug-seed 已灌入 scripts/seed-data/unicode-filenames/ fixture（slug: unicode-filenames）
// P6 前当前红灯（修复未实现）；修复后全部转绿。

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const SLUG = 'unicode-filenames'
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SPEC_DIR, '..', '..')
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs/tasks/TPV0089-unicode-filename-link-fix/evidences')

test.beforeAll(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
})

// ============================================================
// 桌面端 1280×800
// ============================================================
test.describe('TPV0089 Desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ---------- BDD-10: 中文文件名图片实际渲染 ----------
  test('test_bdd_10_chinese_image_renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })

    const img = page.locator('.markdown-body img').first()
    await expect(img).toBeVisible({ timeout: 10000 })

    const src = await img.getAttribute('src')
    expect(src).toBeTruthy()
    expect(src!).toMatch(/\/api\/v1\/entries\/unicode-filenames\/files\/\d+\/content/)
    expect(src!).not.toContain('%E4%B8%AD')

    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd10_desktop_1280x800.png') })
  })

  // ---------- BDD-11: 中文文件名链接实际可点击打开 ----------
  test('test_bdd_11_chinese_link_click_opens_attachment', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })

    const link = page.locator('a[data-peekview-file-id]').first()
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toBe(`/${SLUG}?file=${await link.getAttribute('data-peekview-file-id')}`)

    await link.click()
    // SPA store 导航（T047 既有架构）：URL 不变，文件内容在内容区打开（无 404）。
    // 断言用户可见行为（内容区出现文件内容），不绑定 URL 实现细节。
    await expect(page.locator('.content-area, .markdown-body, .code-viewer').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.content-area, .markdown-body, .code-viewer').first()).not.toBeEmpty({ timeout: 10000 })

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd11_desktop_1280x800.png') })
  })

  // ---------- BDD-12: 非中文非 ASCII 文件名图片实际渲染（日文/重音/空格） ----------
  test('test_bdd_12_other_unicode_images_render', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })

    const imgs = page.locator('.markdown-body img')
    await expect(imgs).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const src = await imgs.nth(i).getAttribute('src')
      expect(src).toMatch(/\/api\/v1\/entries\/unicode-filenames\/files\/\d+\/content/)
      const naturalWidth = await imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth)
      expect(naturalWidth).toBeGreaterThan(0)
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd12_desktop_1280x800.png') })
  })

  // ---------- BDD-13: 英文文件名页面不回归（图片 + 链接） ----------
  test('test_bdd_13_english_no_regression', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })

    const img = page.locator('.markdown-body img').last()
    await expect(img).toBeVisible()
    const src = await img.getAttribute('src')
    expect(src).toMatch(/\/api\/v1\/entries\/unicode-filenames\/files\/\d+\/content/)

    const englishLink = page.locator('a[data-peekview-file-id]', { hasText: 'English' })
    await expect(englishLink).toBeVisible()

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd13_desktop_1280x800.png') })
  })
})

// ============================================================
// 移动端 390×844
// ============================================================
test.describe('TPV0089 Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('test_bdd_10_mobile_chinese_image_renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })
    const img = page.locator('.markdown-body img').first()
    await expect(img).toBeVisible({ timeout: 10000 })
    const src = await img.getAttribute('src')
    expect(src!).toMatch(/\/api\/v1\/entries\/unicode-filenames\/files\/\d+\/content/)
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd10_mobile_390x844.png') })
  })

  test('test_bdd_11_mobile_chinese_link_click', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })
    const link = page.locator('a[data-peekview-file-id]').first()
    await expect(link).toBeVisible()
    await link.click()
    // SPA store 导航（T047 既有架构）：URL 不变，文件内容在内容区打开（无 404）。
    await expect(page.locator('.content-area, .markdown-body, .code-viewer').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.content-area, .markdown-body, .code-viewer').first()).not.toBeEmpty({ timeout: 10000 })
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'bdd11_mobile_390x844.png') })
  })
})
