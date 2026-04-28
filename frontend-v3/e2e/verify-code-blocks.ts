import { chromium } from '@playwright/test'

async function verify() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 2000 }
  })
  const page = await context.newPage()

  try {
    // Navigate to the entry
    await page.goto('http://localhost:8080/tlihue', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Check for code block wrappers
    const codeBlocks = await page.$$('.code-block-wrapper')
    console.log('Code blocks found:', codeBlocks.length)

    // Check for copy buttons
    const copyButtons = await page.$$('.code-copy-btn')
    console.log('Copy buttons found:', copyButtons.length)

    // Take screenshot of full page
    await page.screenshot({ path: '/tmp/code-blocks-full.png', fullPage: true })
    console.log('Screenshot saved')

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await browser.close()
  }
}

verify()
