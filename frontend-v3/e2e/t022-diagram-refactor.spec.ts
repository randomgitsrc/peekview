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
})
