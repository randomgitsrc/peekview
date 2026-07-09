import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
const page = await browser.contexts()[0].newPage()
page.on('console', msg => {
  const text = msg.text()
  console.log('CONSOLE:', msg.type(), text.substring(0, 400))
})

await page.setViewportSize({ width: 1200, height: 800 })
// Enable debug flag before any JS loads
await page.addInitScript(() => { window.__t050_debug = true })
await page.goto('http://127.0.0.1:8888/t050-p6-gitgraph', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)
await page.close()
await browser.close()