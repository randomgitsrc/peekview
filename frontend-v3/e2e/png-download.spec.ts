import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test('mermaid png download', async ({ page }) => {
  // Navigate to the test entry
  await page.goto('http://127.0.0.1:8888/png-test-2')

  // Wait for mermaid to render
  await page.waitForTimeout(3000)

  // Take screenshot to verify page loads
  await page.screenshot({ path: '/tmp/mermaid-page.png' })

  // Find and click fullscreen button
  const fullscreenBtn = await page.locator('[title="Fullscreen"]').first()
  await fullscreenBtn.click()

  // Wait for modal to open
  await page.waitForTimeout(1000)

  // Take screenshot of modal
  await page.screenshot({ path: '/tmp/mermaid-modal.png' })

  // Set up download listener
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.mermaid-modal .toolbar-btn[title="Download PNG"]')
  ])

  // Save the downloaded file
  const downloadPath = '/tmp/mermaid-test.png'
  await download.saveAs(downloadPath)

  // Check file size
  const stats = fs.statSync(downloadPath)
  console.log(`Downloaded PNG size: ${stats.size} bytes`)

  // Verify it's not empty (should be > 1KB)
  expect(stats.size).toBeGreaterThan(1000)

  // Verify it's a valid PNG (starts with PNG signature)
  const fd = fs.openSync(downloadPath, 'r')
  const buffer = Buffer.alloc(8)
  fs.readSync(fd, buffer, 0, 8, 0)
  fs.closeSync(fd)

  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const isPng = buffer.equals(pngSignature)
  console.log(`Is valid PNG: ${isPng}`)
  console.log(`First 8 bytes: ${buffer.toString('hex')}`)

  expect(isPng).toBe(true)
})
