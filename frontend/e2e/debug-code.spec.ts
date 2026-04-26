import { test } from '@playwright/test'

test('debug code HTML', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/lu4prg')
  await page.waitForTimeout(3000)
  
  const html = await page.locator('.code-content pre').innerHTML()
  console.log('=== HTML ===')
  console.log(html.substring(0, 800))
  
  const styles = await page.evaluate(() => {
    const spans = document.querySelectorAll('.code-content pre span')
    return Array.from(spans).slice(0, 5).map(span => ({
      text: span.textContent?.substring(0, 20),
      style: (span as HTMLElement).style.cssText,
      computed: window.getComputedStyle(span).color
    }))
  })
  
  console.log('\n=== Styles ===')
  styles.forEach(s => console.log(JSON.stringify(s)))
})
