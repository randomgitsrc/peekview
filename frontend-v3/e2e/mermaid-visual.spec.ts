import { test, expect, chromium } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:8888'

test.describe('Mermaid Visual Tests', () => {
  test('check mermaid container height', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    // 访问页面
    await page.goto(`${BASE_URL}/entries/e2e-test`)
    await page.waitForTimeout(4000) // 等待Vue和Mermaid渲染

    // 截图
    await page.screenshot({ path: '/tmp/mermaid-full-page.png', fullPage: true })
    console.log('截图已保存: /tmp/mermaid-full-page.png')

    // 检查容器
    const diagram = page.locator('.mermaid-content[data-mode="diagram"]').first()
    const isVisible = await diagram.isVisible().catch(() => false)
    console.log(`Diagram visible: ${isVisible}`)

    if (isVisible) {
      const box = await diagram.boundingBox()
      console.log(`Container size: ${box?.width}x${box?.height}`)

      // 检查SVG
      const svg = diagram.locator('svg').first()
      const svgVisible = await svg.isVisible().catch(() => false)
      console.log(`SVG visible: ${svgVisible}`)

      if (svgVisible) {
        const svgBox = await svg.boundingBox()
        console.log(`SVG size: ${svgBox?.width}x${svgBox?.height}`)

        // 断言
        expect(box?.height).toBeGreaterThan(200)
        expect(svgBox?.height).toBeGreaterThan(100)
      }
    }

    await browser.close()
  })

  test('check toggle functionality', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/entries/e2e-test`)
    await page.waitForTimeout(3000)

    // 截图初始状态
    await page.screenshot({ path: '/tmp/mermaid-before-toggle.png', fullPage: true })

    // 点击Code按钮
    const toggleBtn = page.locator('.diagram-view-toggle').first()
    await toggleBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/mermaid-code-view.png', fullPage: true })

    // 点击Diagram按钮
    await toggleBtn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: '/tmp/mermaid-after-toggle.png', fullPage: true })

    // 检查SVG是否还在
    const svg = page.locator('.mermaid-content[data-mode="diagram"] svg').first()
    const svgVisible = await svg.isVisible().catch(() => false)
    expect(svgVisible).toBe(true)

    await browser.close()
  })

  test('check fullscreen', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/entries/e2e-test`)
    await page.waitForTimeout(3000)

    // 点击Fullscreen
    const fullscreenBtn = page.locator('.mermaid-action-btn[title="Fullscreen"]').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: '/tmp/mermaid-fullscreen.png' })

    // 检查modal
    const modal = page.locator('.diagram-modal-overlay').first()
    const modalVisible = await modal.isVisible().catch(() => false)
    expect(modalVisible).toBe(true)

    const box = await modal.boundingBox()
    expect(box?.height).toBeGreaterThan(500)

    await browser.close()
  })
})
