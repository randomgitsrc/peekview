// TPV0091 中文/日文文件名图片预览与下载 E2E（BDD-1/2/3/5/8）
// 运行：E2E_SPEC=e2e/tpv0091-unicode-preview-download.spec.ts make debug-test（debug backend :8888）
// 前置：make debug-seed 已灌入 scripts/seed-data/unicode-filenames/（slug: unicode-filenames，public）
// P4 前当前红灯（后端 header 未实现 → 中/日文 download 500；前端 URL 未改）；修复后全部转绿。
// BDD-7 注入净化由后端 test_security.py 现有用例覆盖（不在此 spec）。
// 命名用 tpv0091- 前缀（P2-review 观察③），避免与旧 t091- 任务 spec 混淆。

import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const SLUG = 'unicode-filenames'
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SPEC_DIR, '..', '..')
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agate-workspace/tasks/TPV0091-unicode-download-header-fix/P6-evidence/screenshots')

const CHINESE_IMAGE = '中文图片.png'
const JAPANESE_IMAGE = '概要図.png'
const LATIN1_IMAGE = 'café.png'
const SPACE_IMAGE = 'report final.png'
const ASCII_IMAGE = 'arch.png'

test.beforeAll(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
})

async function resolveFileId(request: APIRequestContext, filename: string): Promise<number> {
  const resp = await request.get(`${BASE_URL}/api/v1/entries/${SLUG}/raw`)
  expect(resp.ok()).toBeTruthy()
  const raw = await resp.json()
  const file = raw.files.find((f: { filename: string }) => f.filename === filename)
  expect(file, `file not found in seed: ${filename}`).toBeTruthy()
  return file.id as number
}

async function openFileTreeAndClick(page: Page, filename: string) {
  await page.goto(`${BASE_URL}/${SLUG}`)
  const viewport = page.viewportSize()
  const isDesktop = viewport && viewport.width >= 1024
  if (isDesktop) {
    // desktop：文件树是侧栏 .file-tree（等待可见后点击）
    await expect(page.locator('.file-tree')).toBeVisible({ timeout: 15000 })
    await page.locator('.file-tree .file-name', { hasText: filename }).click()
    return
  }
  // mobile（≤1023px）：文件树在 drawer，先点 mobile-bar-filetree-btn 打开 drawer 再点击
  await page.locator('[data-testid="mobile-bar-filetree-btn"]').click()
  await expect(page.locator('.drawer .file-tree')).toBeVisible({ timeout: 15000 })
  await page.locator('.drawer .file-tree .file-name', { hasText: filename }).click()
}

async function assertImageLoaded(page: Page, filename: string) {
  const img = page.locator('[data-testid="image-content"]')
  await expect(img).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="image-error"]')).toHaveCount(0)
  const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
  expect(naturalWidth, `image failed to decode: ${filename}`).toBeGreaterThan(0)
}

// ============================================================
// 桌面端 1280×800
// ============================================================
test.describe('TPV0091 Desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ---------- BDD-1: 中文文件名图片点击后正常显示 ----------
  test('test_bdd_1_chinese_image_preview_renders', async ({ page }) => {
    await openFileTreeAndClick(page, CHINESE_IMAGE)
    await assertImageLoaded(page, CHINESE_IMAGE)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'desktop_1280x800_bdd1.png') })
  })

  // ---------- BDD-2: 日文文件名图片点击后正常显示 ----------
  test('test_bdd_2_japanese_image_preview_renders', async ({ page }) => {
    await openFileTreeAndClick(page, JAPANESE_IMAGE)
    await assertImageLoaded(page, JAPANESE_IMAGE)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'desktop_1280x800_bdd2.png') })
  })

  // ---------- BDD-3: latin-1/空格/英文文件名图片不回归 ----------
  test('test_bdd_3_latin1_space_ascii_images_no_regression', async ({ page }) => {
    for (const filename of [LATIN1_IMAGE, SPACE_IMAGE, ASCII_IMAGE]) {
      await openFileTreeAndClick(page, filename)
      await assertImageLoaded(page, filename)
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'desktop_1280x800_bdd3.png') })
  })

  // ---------- BDD-5: 下载保存名 = 原始中文文件名（浏览器解析 RFC 6266 filename*） ----------
  test('test_bdd_5_unicode_download_suggested_filename', async ({ page, request }) => {
    const fileId = await resolveFileId(request, CHINESE_IMAGE)
    // page.goto 到 attachment 响应会抛 "Download is starting"——用临时 <a> 点击触发下载
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate((url) => {
        const a = document.createElement('a')
        a.href = url
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, `${BASE_URL}/api/v1/entries/${SLUG}/files/${fileId}`),
    ])
    expect(download.suggestedFilename()).toBe(CHINESE_IMAGE)
  })

  // ---------- BDD-8: markdown 内联 5 图正常（走 /content，不受影响） ----------
  test('test_bdd_8_markdown_inline_images_render', async ({ page }) => {
    await page.goto(`${BASE_URL}/${SLUG}`)
    await expect(page.locator('.markdown-body')).toBeVisible({ timeout: 15000 })

    const imgs = page.locator('.markdown-body img')
    await expect(imgs).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const src = await imgs.nth(i).getAttribute('src')
      expect(src).toMatch(/\/api\/v1\/entries\/unicode-filenames\/files\/\d+\/content/)
      // 图片解码有时序，naturalWidth 首次可能为 0——用 expect.poll 重试（P5 实测 flaky）
      await expect
        .poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10000 })
        .toBeGreaterThan(0)
    }

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'desktop_1280x800_bdd8.png') })
  })
})

// ============================================================
// 移动端 390×844（传输层变更对布局零影响，取关键失败路径中文图做移动端验证）
// ============================================================
test.describe('TPV0091 Mobile 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('test_bdd_1_mobile_chinese_image_preview_renders', async ({ page }) => {
    await openFileTreeAndClick(page, CHINESE_IMAGE)
    await assertImageLoaded(page, CHINESE_IMAGE)
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'mobile_390x844_bdd1.png') })
  })
})
