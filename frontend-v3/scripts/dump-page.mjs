import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
const page = await browser.contexts()[0].newPage()
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text().substring(0, 300)))
page.on('pageerror', err => console.log('PAGEERROR:', err.message.substring(0, 300)))
await page.setViewportSize({ width: 1200, height: 800 })
await page.goto('http://127.0.0.1:8888/t050-p6-gitgraph', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => {
  const block = document.querySelector('.diagram-block')
  const error = document.querySelector('.diagram-error')
  const errorTitle = error ? error.querySelector('.diagram-error-title')?.textContent : null
  const errorDetails = error ? error.querySelector('.diagram-error-details')?.textContent : null
  const viewer = document.querySelector('.diagram-viewer')
  const svg = document.querySelector('.diagram-block svg')
  const lang = block ? block.getAttribute('data-type') : null
  return {
    hasBlock: !!block,
    hasError: !!error,
    errorTitle,
    errorDetails: errorDetails ? errorDetails.substring(0, 200) : null,
    hasViewer: !!viewer,
    hasSvg: !!svg,
    lang,
  }
})
console.log('---INFO---')
console.log(JSON.stringify(info, null, 2))

// Check the actual source code stored
const raw = await page.evaluate(async () => {
  const r = await fetch('/api/v1/entries/t050-p6-gitgraph/raw')
  const j = await r.json()
  return j.files?.[0]?.content?.substring(0, 200)
})
console.log('---RAW---')
console.log(raw)

await page.close()
await browser.close()