import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
const page = await browser.contexts()[0].newPage()
page.on('console', msg => {
  const text = msg.text()
  if (text.includes('gitgraph') || text.includes('Diagram') || text.includes('sanitiz') || text.includes('error')) {
    console.log('CONSOLE:', msg.type(), text.substring(0, 400))
  }
})

await page.setViewportSize({ width: 1200, height: 800 })
await page.goto('http://127.0.0.1:8888/t050-p6-gitgraph', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

const debugInfo = await page.evaluate(() => {
  const blocks = document.querySelectorAll('.diagram-block')
  return Array.from(blocks).map(b => ({
    lang: b.getAttribute('data-type'),
    index: b.getAttribute('data-index'),
    html: b.innerHTML.substring(0, 500),
  }))
})
console.log('---DIAGRAM BLOCKS---')
console.log(JSON.stringify(debugInfo, null, 2))

await page.close()
await browser.close()