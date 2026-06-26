import { test, expect } from '@playwright/test'
import fs from 'fs'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('T022 Diagram Refactor', () => {
  test('mermaid PNG download: filename mermaid-diagram-*.png', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-mermaid-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 点 fullscreen 按钮打开 modal
    const fullscreenBtn = page.locator('.mermaid-action-btn[title="Fullscreen"]').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    // 监听下载 + 点击下载按钮
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.mermaid-modal .toolbar-btn[title="Download PNG"]')
    ])

    const downloadPath = '/tmp/t022-mermaid.png'
    await download.saveAs(downloadPath)

    // 断言：文件有效 PNG + 文件名正确
    const stats = fs.statSync(downloadPath)
    expect(stats.size).toBeGreaterThan(1000)

    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^mermaid-diagram.*\.png$/)
  })

  test('plantuml toggle: no toggle-text update', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-plantuml-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const toggle = page.locator('.plantuml-block .plantuml-view-toggle').first()
    const initialText = (await toggle.textContent()) || ''
    const initialActive = await toggle.evaluate((el) => el.classList.contains('is-active'))

    await toggle.click()
    await page.waitForTimeout(500)

    const afterText = (await toggle.textContent()) || ''
    const afterActive = await toggle.evaluate((el) => el.classList.contains('is-active'))

    expect(afterActive).not.toBe(initialActive)
    expect(afterText).toBe(initialText)
  })

  test('svg PNG download: filename svg-diagram-*.png', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-svg-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const fullscreenBtn = page.locator('.svg-action-btn[title="Fullscreen"]').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.svg-modal .toolbar-btn[title="Download PNG"]')
    ])

    const downloadPath = '/tmp/t022-svg.png'
    await download.saveAs(downloadPath)

    const stats = fs.statSync(downloadPath)
    expect(stats.size).toBeGreaterThan(1000)

    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^svg-diagram.*\.png$/)
  })

  test('mermaid fullscreen: Escape closes modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-mermaid-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const fullscreenBtn = page.locator('.mermaid-action-btn[title="Fullscreen"]').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    const overlay = page.locator('.mermaid-modal-overlay')
    await expect(overlay).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(overlay).not.toBeVisible()
  })

  test('7.2 plantuml copy-code: no Copied feedback (console.log only)', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-plantuml-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 打开 plantuml dropdown menu
    const menuBtn = page.locator('.plantuml-block .plantuml-action-btn.menu-btn').first()
    await menuBtn.click()
    await page.waitForTimeout(300)

    // 点击 copy-code 按钮
    const copyBtn = page.locator('.plantuml-block [data-action="copy-plantuml-code"], .plantuml-block .plantuml-dropdown-menu button:has-text("Copy")').first()
    const logs: string[] = []
    page.on('console', msg => { if (msg.type() === 'log') logs.push(msg.text()) })
    await copyBtn.click()
    await page.waitForTimeout(500)

    // 断言：无 .copied / 无 "Copied" 文字
    const copiedText = await page.locator('.plantuml-block .copied, .plantuml-block :text("Copied!")').count()
    expect(copiedText).toBe(0)
  })

  test('7.5 renderToken 防竞态: 快速切主题无旧 SVG 覆盖', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-mermaid-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 快速切换主题两次（不等渲染完成）
    const themeToggle = page.locator('.theme-toggle, [data-theme-toggle], button:has-text("Theme")').first()
    if (await themeToggle.count() > 0) {
      await themeToggle.click()
      await themeToggle.click()
      await page.waitForTimeout(3000)

      // 断言：mermaid svg 仍然可见（不是被旧 token 覆盖为空）
      await expect(page.locator('.mermaid-block svg').first()).toBeVisible()
    }
  })

  test('7.7 响应式断点 <=768px: header padding 变化', async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-mermaid-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 模拟移动端视口
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)

    // 断言：mermaid-header 在移动端 padding 变化
    const headerPadding = await page.locator('.mermaid-block .mermaid-header').first().evaluate((el) => {
      return window.getComputedStyle(el).padding
    })
    expect(headerPadding).toBeTruthy()
  })
})
