import { test, expect } from '@playwright/test'

test('mermaid renders correctly', async ({ page }) => {
  await page.goto('http://127.0.0.1:8888/entries/test-mermaid-2-2')
  await page.waitForTimeout(5000)
  
  await page.screenshot({ path: '/tmp/mermaid-test.png', fullPage: true })
  console.log('截图已保存')
  
  const count = await page.locator('.mermaid-block').count()
  console.log(`mermaid-block数量: ${count}`)
  expect(count).toBeGreaterThan(0)
  
  const box = await page.locator('.mermaid-content.diagram-mode').first().boundingBox()
  console.log(`容器高度: ${box?.height}px`)
  expect(box?.height).toBeGreaterThan(200)
  
  const svgBox = await page.locator('.mermaid-content.diagram-mode svg').first().boundingBox()
  console.log(`SVG高度: ${svgBox?.height}px`)
  expect(svgBox?.height).toBeGreaterThan(100)
})
