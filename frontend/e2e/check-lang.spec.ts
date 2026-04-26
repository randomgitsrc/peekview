import { test } from '@playwright/test'

test('check file language', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/lu4prg')
  await page.waitForTimeout(3000)
  
  const lang = await page.evaluate(() => {
    // Access Vue component data
    const el = document.querySelector('.code-viewer')
    return (el as any).__vueParentComponent?.props?.language
  })
  console.log('Language prop:', lang)
  
  // Check console logs
  const logs: string[] = []
  page.on('console', msg => logs.push(msg.text()))
  
  await page.reload()
  await page.waitForTimeout(3000)
  
  console.log('\n=== Console ===')
  logs.filter(l => l.includes('Shiki') || l.includes('[CodeViewer]')).forEach(l => console.log(l))
})
