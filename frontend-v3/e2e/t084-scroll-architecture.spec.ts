import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T084-detail-scroll-architecture/evidences'

const LONG_MARKDOWN = Array.from({ length: 80 }, (_, i) => `## Heading ${i + 1}\n\nParagraph ${i + 1} content here. `.repeat(3)).join('\n\n')

const LONG_CODE = Array.from({ length: 200 }, (_, i) => `// line ${i + 1}: const value_${i} = ${i * 100};`).join('\n')

const WIDE_CODE = `// This line is very long to test horizontal scrolling: const superLongVariableName = someFunction(argument1, argument2, argument3, argument4, argument5, argument6, argument7, argument8, argument9, argument10); // end of long line`

const HTML_CONTENT = '<!DOCTYPE html><html><body><h1>Test HTML</h1><p>Hello from HTML viewer.</p></body></html>'

test.describe('T084 Scroll Architecture', () => {
  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T084 long markdown',
        slug: 't084-long-markdown',
        is_public: true,
        content: LONG_MARKDOWN,
      },
    }).catch(() => {})

    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T084 long code',
        slug: 't084-long-code',
        is_public: true,
        content: '```python\n' + LONG_CODE + '\n```',
      },
    }).catch(() => {})

    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T084 wide code',
        slug: 't084-wide-code',
        is_public: true,
        content: '```javascript\n' + WIDE_CODE + '\n```',
      },
    }).catch(() => {})

    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T084 HTML viewer',
        slug: 't084-html-viewer',
        is_public: true,
        content: HTML_CONTENT,
      },
    }).catch(() => {})

    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T084 image viewer',
        slug: 't084-image-viewer',
        is_public: true,
        content: '',
        files: [{
          filename: 'test.png',
          content_type: 'image/png',
          content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        }],
      },
    }).catch(() => {})
  })

  test.describe('Desktop viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('test_bdd_01_markdown_content_area_scrolls', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const contentArea = page.locator('.content-area')
      const markdownViewer = page.locator('.markdown-viewer')

      const initialContentScrollTop = await contentArea.evaluate((el: HTMLElement) => el.scrollTop)

      await contentArea.evaluate((el: HTMLElement) => {
        el.scrollTop = 200
      })
      await page.waitForTimeout(500)

      const contentScrollTop = await contentArea.evaluate((el: HTMLElement) => el.scrollTop)
      const viewerScrollTop = await markdownViewer.evaluate((el: HTMLElement) => el.scrollTop)

      expect(contentScrollTop).toBeGreaterThan(initialContentScrollTop)
      expect(viewerScrollTop).toBe(0)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd01.png` })
    })

    test('test_bdd_02_code_content_area_scrolls', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-long-code`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const contentArea = page.locator('.content-area')
      const codeBody = page.locator('.code-body')

      const initialContentScrollTop = await contentArea.evaluate((el: HTMLElement) => el.scrollTop)

      await contentArea.evaluate((el: HTMLElement) => {
        el.scrollTop = 200
      })
      await page.waitForTimeout(500)

      const contentScrollTop = await contentArea.evaluate((el: HTMLElement) => el.scrollTop)
      const codeScrollTop = await codeBody.evaluate((el: HTMLElement) => el.scrollTop)

      expect(contentScrollTop).toBeGreaterThan(initialContentScrollTop)
      expect(codeScrollTop).toBe(0)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd02.png` })
    })

    test('test_bdd_03_code_horizontal_scroll_retained', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-wide-code`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const codeBody = page.locator('.code-body')
      const pre = codeBody.locator('pre').first()

      const initialScrollLeft = await codeBody.evaluate((el: HTMLElement) => el.scrollLeft)

      await codeBody.evaluate((el: HTMLElement) => {
        el.scrollLeft = 100
      })
      await page.waitForTimeout(300)

      const codeBodyScrollLeft = await codeBody.evaluate((el: HTMLElement) => el.scrollLeft)
      const preScrollLeft = await pre.evaluate((el: HTMLElement) => el.scrollLeft)

      expect(codeBodyScrollLeft).toBeGreaterThan(initialScrollLeft)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd03.png` })
    })

    test('test_bdd_07_toc_anchor_jump_correct_offset', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const tocToggle = page.locator('button[aria-label="Table of Contents"]')
      if (await tocToggle.isVisible()) {
        await tocToggle.click()
        await page.waitForTimeout(500)
      }

      const tocLinks = page.locator('.toc-sidebar a, .toc-sidebar [data-heading-id]')
      const linkCount = await tocLinks.count()

      if (linkCount > 5) {
        await tocLinks.nth(5).click()
      } else if (linkCount > 0) {
        await tocLinks.last().click()
      }
      await page.waitForTimeout(1000)

      const headingText = await tocLinks.nth(Math.min(5, linkCount - 1)).textContent()
      const offset = await page.evaluate((text) => {
        const contentArea = document.querySelector('.content-area') as HTMLElement
        if (!contentArea || !text) return -1
        const headings = Array.from(contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        for (const h of headings) {
          if (h.textContent?.includes(text.trim())) {
            const rect = h.getBoundingClientRect()
            const caRect = contentArea.getBoundingClientRect()
            return Math.round(rect.top - caRect.top)
          }
        }
        return -1
      }, headingText || '')

      expect(offset).toBeGreaterThanOrEqual(75)
      expect(offset).toBeLessThanOrEqual(85)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd07.png` })
    })

    test('test_bdd_09_htmlviewer_iframe_fills_content_area', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-html-viewer`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const iframe = page.locator('.content-area iframe').first()
      await expect(iframe).toBeVisible()

      const iframeHeight = await iframe.evaluate((el: HTMLElement) => el.clientHeight)
      const contentAreaHeight = await page.locator('.content-area').evaluate((el: HTMLElement) => el.clientHeight)

      expect(iframeHeight).toBeGreaterThan(0)
      expect(Math.abs(iframeHeight - contentAreaHeight)).toBeLessThan(5)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd09.png` })
    })

    test('test_bdd_10_imageviewer_image_displays_correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-image-viewer`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const img = page.locator('.content-area img').first()
      await expect(img).toBeVisible()

      const imgBox = await img.boundingBox()
      expect(imgBox).toBeTruthy()
      expect(imgBox!.height).toBeGreaterThan(0)

      const contentAreaBox = await page.locator('.content-area').boundingBox()
      expect(imgBox!.x).toBeGreaterThanOrEqual(contentAreaBox!.x)
      expect(imgBox!.x + imgBox!.width).toBeLessThanOrEqual(contentAreaBox!.x + contentAreaBox!.width)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd10.png` })
    })
  })

  test.describe('Mobile viewport (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('test_bdd_08_mobile_markdown_single_padding', async ({ page }) => {
      await page.goto(`${BASE_URL}/t084-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const markdownBodyPaddingTop = await page.locator('.markdown-body').evaluate(
        (el: HTMLElement) => getComputedStyle(el).paddingTop
      )

      expect(markdownBodyPaddingTop).toBe('0px')

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd08.png` })
    })
  })
})
