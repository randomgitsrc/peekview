import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

test.describe('Mermaid Diagram Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/entries/test-mermaid-2`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
  })

  test('SVG fills container properly', async ({ page }) => {
    const diagramMode = page.locator('.mermaid-content[data-mode="diagram"]').first()
    await expect(diagramMode).toBeVisible()

    const containerBox = await diagramMode.boundingBox()
    console.log(`Container size: ${containerBox?.width}x${containerBox?.height}`)

    expect(containerBox?.height).toBeGreaterThan(200)

    const svg = diagramMode.locator('svg').first()
    await expect(svg).toBeVisible()

    const svgBox = await svg.boundingBox()
    console.log(`SVG size: ${svgBox?.width}x${svgBox?.height}`)
    expect(svgBox?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/mermaid-test-1-initial.png', fullPage: true })
  })

  test('Code/Diagram toggle works', async ({ page }) => {
    const block = page.locator('.diagram-block').first()
    const toggleBtn = block.locator('.diagram-view-toggle')
    const diagramMode = block.locator('.mermaid-content[data-mode="diagram"]')
    const codeMode = block.locator('.mermaid-content[data-mode="code"]')

    await toggleBtn.click()
    await page.waitForTimeout(500)
    await expect(codeMode).toBeVisible()
    await expect(diagramMode).toBeHidden()
    await page.screenshot({ path: '/tmp/mermaid-test-2-code.png', fullPage: true })

    await toggleBtn.click()
    await page.waitForTimeout(1500)
    await expect(diagramMode).toBeVisible()
    await expect(codeMode).toBeHidden()

    const svg = diagramMode.locator('svg')
    await expect(svg).toBeVisible()
    const svgBox = await svg.boundingBox()
    expect(svgBox?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/mermaid-test-3-after-toggle.png', fullPage: true })
  })

  test('Fullscreen fills window', async ({ page }) => {
    const fullscreenBtn = page.locator('.mermaid-action-btn[title="Fullscreen"]').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    const modal = page.locator('.diagram-modal-overlay')
    await expect(modal).toBeVisible()

    const modalBox = await modal.boundingBox()
    console.log(`Modal size: ${modalBox?.width}x${modalBox?.height}`)
    expect(modalBox?.height).toBeGreaterThan(500)

    const modalSvg = modal.locator('svg')
    await expect(modalSvg).toBeVisible()

    await page.screenshot({ path: '/tmp/mermaid-test-4-fullscreen.png' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
})
