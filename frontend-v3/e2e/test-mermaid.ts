import { test, expect } from '@playwright/test'

test('mermaid container height', async ({ page }) => {
  await page.goto('http://127.0.0.1:8888/entries/e2e-test')
  await page.waitForTimeout(5000)
  
  await page.screenshot({ path: '/tmp/mermaid-test-1.png', fullPage: true })
  console.log('截图已保存')
  
  const count = await page.locator('.mermaid-block').count()
  console.log(`找到 ${count} 个 mermaid-block`)
  
  expect(count).toBeGreaterThan(0)
})
