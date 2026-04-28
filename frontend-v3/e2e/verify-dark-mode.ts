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

    // Set dark mode directly
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('peekview-theme', 'dark')
    })
    await page.waitForTimeout(500)

    // Check if data-theme is dark
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    console.log('Current theme:', theme)

    // Check markdown body background
    const markdownBg = await page.evaluate(() => {
      const el = document.querySelector('.markdown-body')
      if (el) {
        return window.getComputedStyle(el).backgroundColor
      }
      return null
    })
    console.log('Markdown body background:', markdownBg)

    // Check markdown text color
    const textColor = await page.evaluate(() => {
      const el = document.querySelector('.markdown-body h1, .markdown-body p')
      if (el) {
        return window.getComputedStyle(el).color
      }
      return null
    })
    console.log('Markdown text color:', textColor)

    // Take screenshot
    await page.screenshot({ path: '/tmp/markdown-dark-mode.png', fullPage: true })
    console.log('Screenshot saved')

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await browser.close()
  }
}

verify()
