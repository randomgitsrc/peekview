import { chromium } from '@playwright/test'

async function verify() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
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

    if (copyButtons.length > 0) {
      // Click first copy button
      await copyButtons[0].click()
      await page.waitForTimeout(500)

      // Check if button text changed to "Copied!"
      const btnText = await copyButtons[0].textContent()
      console.log('Button text after click:', btnText)

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      console.log('Clipboard content (first 100 chars):', clipboardText.substring(0, 100))
    }

    // Screenshot
    await page.screenshot({ path: '/tmp/code-copy-verify.png', fullPage: false })
    console.log('Screenshot saved to /tmp/code-copy-verify.png')

  } catch (e) {
    console.error('Error:', e)
    await page.screenshot({ path: '/tmp/code-copy-error.png' })
  } finally {
    await browser.close()
  }
}

verify()
