import { test, expect } from '@playwright/test'

test('mermaid rendered and visible', async ({ page }) => {
  await page.goto('http://127.0.0.1:8888/entries/playwright-test')
  await page.waitForTimeout(5000)
  
  // 截图看实际效果
  await page.screenshot({ path: '/tmp/mermaid-screenshot.png', fullPage: true })
  console.log('截图已保存: /tmp/mermaid-screenshot.png')
  
  // 检查mermaid-block是否存在
  const count = await page.locator('.diagram-block').count()
  console.log(`找到 ${count} 个 mermaid-block`)
  expect(count).toBeGreaterThan(0)
  
  if (count > 0) {
    // 检查容器高度
    const box = await page.locator('.diagram-viewer').first().boundingBox()
    console.log(`容器高度: ${box?.height}px`)
    expect(box?.height).toBeGreaterThan(200)
    
    // 检查SVG
    const svgBox = await page.locator('.diagram-viewer svg').first().boundingBox()
    console.log(`SVG高度: ${svgBox?.height}px`)
    expect(svgBox?.height).toBeGreaterThan(100)
  }
})
