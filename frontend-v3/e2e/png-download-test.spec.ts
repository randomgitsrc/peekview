import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test('mermaid png download works', async ({ page }) => {
  // Create test entry via API
  const response = await page.request.post('http://127.0.0.1:8888/api/v1/entries', {
    data: {
      slug: 'png-test-' + Date.now(),
      summary: 'PNG Download Test',
      expires_in: '1h',
      files: [{
        filename: 'diagram.md',
        content: '```mermaid\ngraph TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[OK]\n    C --> D[Rethink]\n    D --> B\n    B -->|No| E[End]\n```'
      }]
    }
  })
  expect(response.status()).toBe(201)
  const entry = await response.json()
  const slug = entry.slug

  console.log(`Created entry: ${slug}`)

  // Navigate to entry
  await page.goto(`http://127.0.0.1:8888/${slug}`)
  await page.waitForTimeout(3000)

  // Take screenshot before fullscreen
  await page.screenshot({ path: '/tmp/01-before-fs.png' })
  console.log('Screenshot saved: /tmp/01-before-fs.png')

  // Click fullscreen button
  const fsBtn = page.locator('[title="Fullscreen"]').first()
  await fsBtn.click()
  await page.waitForTimeout(1000)

  // Take screenshot of modal
  await page.screenshot({ path: '/tmp/02-modal.png' })
  console.log('Screenshot saved: /tmp/02-modal.png')

  // Set up download handler and click download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.mermaid-modal .toolbar-btn[title="Download PNG"]')
  ])

  // Save download
  const downloadPath = '/tmp/03-downloaded.png'
  await download.saveAs(downloadPath)

  // Check file exists and size
  const stats = fs.statSync(downloadPath)
  console.log(`Downloaded file size: ${stats.size} bytes`)

  // Verify file is reasonable size (> 1KB)
  expect(stats.size).toBeGreaterThan(1000)

  // Check PNG header
  const fd = fs.openSync(downloadPath, 'r')
  const buffer = Buffer.alloc(8)
  fs.readSync(fd, buffer, 0, 8, 0)
  fs.closeSync(fd)

  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  console.log(`File header: ${buffer.toString('hex')}`)
  console.log(`Is PNG: ${buffer.equals(pngSignature)}`)

  expect(buffer.equals(pngSignature)).toBe(true)

  // Check dimensions using image-size library or file inspection
  // Read IHDR chunk for dimensions
  const fd2 = fs.openSync(downloadPath, 'r')
  const ihdrBuffer = Buffer.alloc(24)
  fs.readSync(fd2, ihdrBuffer, 0, 24, 0)
  fs.closeSync(fd2)

  // PNG dimensions are at offset 16 in IHDR
  const width = ihdrBuffer.readUInt32BE(16)
  const height = ihdrBuffer.readUInt32BE(20)
  console.log(`PNG dimensions: ${width}x${height}`)

  // Should have reasonable dimensions
  expect(width).toBeGreaterThan(100)
  expect(height).toBeGreaterThan(100)
})
