import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
const page = await browser.contexts()[0].newPage()
page.on('console', msg => {
  const text = msg.text()
  if (text.includes('sanitiz') || text.includes('diagram') || text.includes('gitgraph') || text.includes('Diagram') || text.includes('Mermaid')) {
    console.log('CONSOLE:', msg.type(), text.substring(0, 300))
  }
})
page.on('pageerror', err => console.log('PAGEERROR:', err.message.substring(0, 300)))

await page.setViewportSize({ width: 1200, height: 800 })
await page.goto('http://127.0.0.1:8888/t050-p6-gitgraph', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

// Check sanitize result on the page
const sanitizeResult = await page.evaluate(() => {
  // Find any sanitize-related state by checking the rendered HTML
  const errorEl = document.querySelector('.diagram-error-details')
  const viewer = document.querySelector('.diagram-viewer')
  const lang = document.querySelector('.diagram-block')?.getAttribute('data-type')
  return {
    lang,
    errorText: errorEl?.textContent?.substring(0, 100),
    viewerHTML: viewer?.innerHTML?.substring(0, 200),
  }
})
console.log('---SANITIZE RESULT---')
console.log(JSON.stringify(sanitizeResult, null, 2))

await page.close()
await browser.close()