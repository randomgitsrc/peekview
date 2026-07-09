import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
const page = await browser.contexts()[0].newPage()
page.on('request', req => {
  const url = req.url()
  if (url.endsWith('.js') || url.endsWith('.mjs')) console.log('JS:', url.replace('http://127.0.0.1:8888', ''))
})
await page.goto('http://127.0.0.1:8888/t050-p6-gitgraph', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.close()
await browser.close()