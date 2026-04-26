import { test } from '@playwright/test'

test('inspect code HTML', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/lu4prg')
  await page.waitForTimeout(3000)
  
  const html = await page.locator('.code-content').innerHTML()
  console.log('=== Code HTML ===')
  console.log(html)
})
