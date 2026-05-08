import { test, expect } from '@playwright/test'
import fs from 'fs'

test('verify png download', async ({ page }) => {
  // Go to test page
  await page.goto('http://127.0.0.1:8888/png-test-2')
  await page.waitForTimeout(3000)

  console.log('Page loaded')
  await page.screenshot({ path: '/tmp/verify-page.png', fullPage: true })

  // Click fullscreen
  const fsBtn = page.locator('[title="Fullscreen"]').first()
  await fsBtn.click()
  await page.waitForTimeout(1000)

  console.log('Fullscreen opened')
  await page.screenshot({ path: '/tmp/verify-modal.png' })

  // Download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.toolbar-btn[title="Download PNG"]')
  ])

  const path = '/tmp/verify-download.png'
  await download.saveAs(path)

  // Check file
  const stats = fs.statSync(path)
  console.log(`File size: ${stats.size} bytes`)

  // Check PNG dimensions from IHDR
  const buf = fs.readFileSync(path)
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  console.log(`Dimensions: ${w}x${h}`)

  // Expect reasonable size
  expect(stats.size).toBeGreaterThan(5000)
  expect(w).toBeGreaterThan(200)
  expect(h).toBeGreaterThan(200)
})
