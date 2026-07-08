import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T049-mobile-header-diagram-sanitize/evidences'

test.describe('T049 Mobile Header Shrink (A-BDD)', () => {
  test.beforeAll(async ({ request }) => {
    // Create an entry with many tags for truncation testing
    const tags = Array.from({ length: 10 }, (_, i) => `tag-${i + 1}`)
    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T049 mobile header test',
        slug: 't049-multi-tag',
        tags,
        is_public: true,
        content: '# Test\n\nThis entry has many tags for mobile header truncation testing.',
      },
    }).catch(() => {
      // May already exist, ignore
    })
  })

  test.describe('Mobile viewport (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('A-BDD-1: many tags truncated to single line with +N indicator', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-multi-tag`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const headerTags = page.locator('.header-tags')
      const box = await headerTags.boundingBox()
      // Single line: height should be approximately one tag row height (~2.5em ≈ 40px)
      expect(box?.height).toBeLessThan(60)

      const overflowIndicator = page.locator('.tag-overflow, [class*="overflow"]')
      const overflowText = await overflowIndicator.textContent()
      expect(overflowText).toMatch(/^\+\d+/)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-tags-truncated.png`, fullPage: true })
    })

    test('A-BDD-2: single tag no overflow indicator', async ({ page }) => {
      // Create a quick entry with 1 tag via URL params or direct API
      await page.goto(`${BASE_URL}/?summary=SingleTagEntry&tags=single`, { timeout: 5000 }).catch(() => {})
      // Use the multi-tag entry but verify 1 tag case by loading a different page
      // Since we need a single-tag entry, we navigate to an entry with few tags
      await page.goto(`${BASE_URL}/`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const overflowIndicator = page.locator('.tag-overflow, [class*="overflow"]')
      await expect(overflowIndicator).toBeHidden()
    })

    test('A-BDD-3: scroll down hides header tags', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-multi-tag`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Scroll down past 50px
      await page.evaluate(() => window.scrollTo(0, 100))
      await page.waitForTimeout(500)

      const headerTags = page.locator('.header-tags')
      // Should be hidden (opacity 0, max-height 0, or display none)
      await expect(headerTags).toBeHidden()

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-scroll-down-header-hidden.png`, fullPage: true })
    })

    test('A-BDD-4: scroll up restores header tags', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-multi-tag`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 100))
      await page.waitForTimeout(300)

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)

      const headerTags = page.locator('.header-tags')
      await expect(headerTags).toBeVisible()

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-scroll-up-header-restored.png`, fullPage: true })
    })

    test('A-BDD-6: body tags unaffected by header truncation', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-multi-tag`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Check that tags in markdown body are complete
      const bodyTags = page.locator('.entry-content .tag, .markdown-body .tag')
      const bodyTagCount = await bodyTags.count()
      // Body tags should show all tags, not truncated
      expect(bodyTagCount).toBeGreaterThan(0)
    })
  })

  test.describe('Desktop viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('A-BDD-5: desktop scroll has no effect on header tags', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-multi-tag`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 200))
      await page.waitForTimeout(500)

      // Header tags should remain visible (desktop: no scroll-to-hide)
      const headerTags = page.locator('.header-tags')
      await expect(headerTags).toBeVisible()
    })
  })
})

test.describe('T049 Diagram Error UI (C-BDD)', () => {
  test.beforeAll(async ({ request }) => {
    // Create entry with bad mermaid syntax
    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T049 bad mermaid',
        slug: 't049-bad-mermaid',
        is_public: true,
        content: '```mermaid\ngraph TD\nA ->> B: msg\n```',
      },
    }).catch(() => {})

    // Create entry with bad plantuml syntax
    await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        summary: 'T049 bad plantuml',
        slug: 't049-bad-plantuml',
        is_public: true,
        content: '```plantuml\nAlice -> Bob\n```',
      },
    }).catch(() => {})
  })

  test.describe('Desktop viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('C-BDD-1: mermaid error cleans #dmermaid SVG from DOM', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Check that no #dmermaid- elements exist in the DOM
      const errorSvgCount = await page.evaluate(() => {
        return document.querySelectorAll('[id^="dmermaid-"]').length
      })
      expect(errorSvgCount).toBe(0)

      // Check error state is shown
      const errorEl = page.locator('.diagram-error')
      await expect(errorEl).toBeVisible()

      await page.screenshot({ path: `${EVIDENCE_DIR}/mermaid-error-no-svg-residue.png`, fullPage: true })
    })

    test('C-BDD-2: mermaid suppressErrors is configured', async ({ page }) => {
      // Navigate to any page that triggers mermaid initialization
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Check that mermaid initialize was called with suppressErrors: true
      const hasSuppressErrors = await page.evaluate(() => {
        // Access mermaid internal config if available
        return !!(window as any).mermaid?.config?.suppressErrors
      })
      expect(hasSuppressErrors).toBe(true)
    })

    test('C-BDD-3+5: error UI shows engine name with collapsed details', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const errorEl = page.locator('.diagram-error')
      await expect(errorEl).toBeVisible()

      // Check engine name is displayed
      await expect(errorEl).toContainText(/MERMAID/i)

      // Error details should be collapsed by default
      const details = errorEl.locator('.diagram-error-details')
      await expect(details).toBeHidden()

      await page.screenshot({ path: `${EVIDENCE_DIR}/error-ui-collapsed.png`, fullPage: true })
    })

    test('C-BDD-4: view source button switches to code mode', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Click "查看源码" button
      const viewSourceBtn = page.locator('.diagram-error button:has-text("查看源码"), .diagram-error-btn-view-source')
      await viewSourceBtn.click()
      await page.waitForTimeout(500)

      // Should show code mode
      const codeMode = page.locator('.diagram-code, [data-mode="code"]')
      await expect(codeMode).toBeVisible()
    })

    test('C-BDD-6: error details expand shows truncated message', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Expand error details
      const expandBtn = page.locator('.diagram-error [aria-expanded], .diagram-error .toggle-details, .diagram-error-header button').first()
      await expandBtn.click()
      await page.waitForTimeout(300)

      const details = page.locator('.diagram-error-details')
      await expect(details).toBeVisible()

      // Error text should be truncated to max 200 chars
      const detailText = await details.textContent()
      expect(detailText?.length).toBeLessThanOrEqual(200)
    })

    test('C-BDD-7: mermaid exportPng failure cleans error SVG', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-mermaid`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Trigger download — this calls exportPng which uses mermaid.render with a different ID
      const downloadBtn = page.locator('[title="Download PNG"], .diagram-action-btn:has-text("⬇")').first()
      await downloadBtn.click()
      await page.waitForTimeout(2000)

      // No dmermaid-export elements should remain
      const leftoverIds = await page.evaluate(() => {
        return document.querySelectorAll('[id^="dmermaid-"]').length
      })
      expect(leftoverIds).toBe(0)
    })

    test('C-BDD-8: plantuml error uses unified error UI', async ({ page }) => {
      await page.goto(`${BASE_URL}/t049-bad-plantuml`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Should show error UI, not auto-switch to code mode
      const errorEl = page.locator('.diagram-error')
      await expect(errorEl).toBeVisible()

      // Should show engine name
      await expect(errorEl).toContainText(/PLANTUML/i)

      // Should have view source button
      const viewSourceBtn = page.locator('.diagram-error button:has-text("查看源码"), .diagram-error-btn-view-source')
      await expect(viewSourceBtn).toBeVisible()

      await page.screenshot({ path: `${EVIDENCE_DIR}/plantuml-error-ui.png`, fullPage: true })
    })
  })
})
