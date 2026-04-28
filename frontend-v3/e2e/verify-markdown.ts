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

    // Check if github-markdown-css is loaded
    const hasGithubCss = await page.evaluate(() => {
      const stylesheets = Array.from(document.styleSheets)
      return stylesheets.some(sheet =>
        sheet.href?.includes('github-markdown')
      )
    })
    console.log('GitHub Markdown CSS loaded:', hasGithubCss)

    // Check if markdown-body has GitHub styles
    const markdownBody = await page.$('.markdown-body')
    if (markdownBody) {
      const styles = await markdownBody.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          color: computed.color
        }
      })
      console.log('Markdown body styles:', styles)
    }

    // Check headings have IDs for TOC navigation
    const headings = await page.$$('h1[id], h2[id], h3[id]')
    console.log('Headings with IDs:', headings.length)
    for (let i = 0; i < Math.min(3, headings.length); i++) {
      const text = await headings[i].textContent()
      const id = await headings[i].getAttribute('id')
      console.log(`  - ${text?.substring(0, 30)}: #${id}`)
    }

    // Test TOC navigation
    const tocLinks = await page.$$('a[href^="#"]')
    if (tocLinks.length > 0) {
      console.log('TOC links found:', tocLinks.length)

      // Click first TOC link and check scroll
      const firstTocHref = await tocLinks[0].getAttribute('href')
      console.log('First TOC link:', firstTocHref)

      await tocLinks[0].click()
      await page.waitForTimeout(500)

      // Check if scrolled to the heading
      const headingId = firstTocHref?.replace('#', '')
      const headingInView = await page.evaluate((id) => {
        const el = document.getElementById(id)
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.top >= 0 && rect.top < 200
      }, headingId)
      console.log('Scrolled to heading:', headingInView)
    }

    // Screenshot
    await page.screenshot({ path: '/tmp/markdown-verify.png' })
    console.log('Screenshot saved to /tmp/markdown-verify.png')

  } catch (e) {
    console.error('Error:', e)
    await page.screenshot({ path: '/tmp/markdown-error.png' })
  } finally {
    await browser.close()
  }
}

verify()
