import { chromium } from '@playwright/test'

async function verify() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 }
  })
  const page = await context.newPage()

  try {
    // Navigate to the entry
    await page.goto('http://localhost:8080/tlihue', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Set dark mode directly
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('peekview-theme', 'dark')
    })
    await page.waitForTimeout(500)

    // Scroll to first code block
    await page.evaluate(() => {
      const codeBlock = document.querySelector('.code-block-wrapper')
      if (codeBlock) {
        codeBlock.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    })
    await page.waitForTimeout(500)

    // Check code block styles
    const codeBlockStyles = await page.evaluate(() => {
      const pre = document.querySelector('.code-block-wrapper pre')
      const code = document.querySelector('.code-block-wrapper pre code')
      const spans = document.querySelectorAll('.code-block-wrapper pre span')

      const preBg = pre ? window.getComputedStyle(pre).backgroundColor : null
      const codeBg = code ? window.getComputedStyle(code).backgroundColor : null
      const firstSpanBg = spans[0] ? window.getComputedStyle(spans[0]).backgroundColor : null

      return { preBg, codeBg, firstSpanBg, spanCount: spans.length }
    })
    console.log('Code block styles:', codeBlockStyles)

    // Take screenshot focused on code block
    await page.screenshot({ path: '/tmp/code-block-dark.png' })
    console.log('Screenshot saved')

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await browser.close()
  }
}

verify()
