import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T091-mobile-detail-visual-polish/evidences'

// Test entries — all pre-seeded via `make debug-quick` (scripts/seed-data/), see
// P2-design.md §4. Not created here; this file only reads existing entries.
const MARKDOWN_ENTRY = 'markdown-test'
// markdown-test has 2 files (architecture.svg id=17, rich-markdown.md id=18); the
// entry's files[0] is the SVG, so the default page load (no ?firstFileId=) renders
// ImageViewer, not MarkdownViewer. BDD-3/BDD-12 need the markdown file specifically,
// so they navigate with ?firstFileId= (a route.query mechanism EntryDetailView.vue
// already reads at L203, not a workaround).
const MARKDOWN_FILE_ID = 18
const CODE_ENTRY = 'python-entry-service' // canWrap:true, non-markdown/non-html (BDD-7/8)
const CSV_ENTRY = 'csv-employees'
const TSV_ENTRY = 'tsv-server-metrics'
const JSON_ENTRY = 'json-api-config'
const YAML_ENTRY = 'yaml-docker-compose'
const XML_ENTRY = 'xml-maven-pom'
const SVG_ENTRY = 'svg-standalone' // ImageViewer exception, BDD-10 (see P2-design.md §2 minimal_validation)
const MERMAID_ENTRY = 'mermaid-charts'
const PLANTUML_ENTRY = 'plantuml-arch'
const HTML_ENTRY = 'html-csp-test' // HtmlViewer exception, BDD-11

// Threshold calibrated specifically for markdown-test's own tag count (P1-requirements
// BDD-2: 89px measured with T091 CSS injected via addStyleTag, 71px = 89 * 0.8 floor).
// Not a general-purpose value for other entries — see P2-design.md §1 risk #3.
const META_BAR_MIN_HEIGHT_PX_MARKDOWN_TEST = 71

const MARKDOWN_BODY_PADDING_PX = 16 // var(--space-4), mobile .markdown-body padding (BDD-3)
const CONTENT_AREA_HORIZONTAL_PADDING_PX = 8 // .content-area mobile horizontal padding (unchanged)
const MARKDOWN_TOTAL_INSET_PX = MARKDOWN_BODY_PADDING_PX + CONTENT_AREA_HORIZONTAL_PADDING_PX // 24
const DESKTOP_MARKDOWN_PADDING_PX = 24 // var(--space-5), unchanged (BDD-12)
const TOUCH_TARGET_MIN_PX = 44 // DESIGN.md L265 (BDD-6/8)
const BOTTOM_BAR_BASE_PADDING_PX = 4 // var(--space-1) (BDD-4); env(safe-area-inset-bottom) is 0 in this test env

const VIEWER_ENTRIES: { slug: string; label: string }[] = [
  { slug: MARKDOWN_ENTRY, label: 'markdown' },
  { slug: CODE_ENTRY, label: 'code' },
  { slug: CSV_ENTRY, label: 'csv' },
  { slug: TSV_ENTRY, label: 'tsv' },
  { slug: JSON_ENTRY, label: 'json' },
  { slug: YAML_ENTRY, label: 'yaml' },
  { slug: XML_ENTRY, label: 'xml' },
  { slug: SVG_ENTRY, label: 'svg' },
  { slug: MERMAID_ENTRY, label: 'mermaid' },
  { slug: PLANTUML_ENTRY, label: 'plantuml' },
]

test.describe('T091 Mobile Detail Visual Polish', () => {
  // -----------------------------------------------------------------------
  // Mobile viewport (390x844)
  // -----------------------------------------------------------------------
  test.describe('Mobile viewport (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('test_bdd_1_meta_tags_bar_wraps_no_horizontal_scroll', async ({ page }) => {
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const metaBar = page.locator('[data-testid="meta-tags-bar"]')
      await expect(metaBar).toBeVisible()

      const { scrollWidth, clientWidth } = await metaBar.evaluate((el) => ({
        scrollWidth: (el as HTMLElement).scrollWidth,
        clientWidth: (el as HTMLElement).clientWidth,
      }))
      // scrollWidth<=clientWidth fully determines "no horizontal scroll exists" —
      // this is the sole judgment basis per P1 BDD-1, not a screenshot-assisted one.
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd1.png` })
    })

    test('test_bdd_2_meta_tags_bar_breathing_room', async ({ page }) => {
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const metaBar = page.locator('[data-testid="meta-tags-bar"]')
      const height = await metaBar.evaluate((el) => (el as HTMLElement).offsetHeight)
      // DOM-assist half of BDD-2 (a). Applies to markdown-test only — see constant comment.
      expect(height).toBeGreaterThanOrEqual(META_BAR_MIN_HEIGHT_PX_MARKDOWN_TEST)

      // Evidence for the parallel vision-engine breathing-room judgment (BDD-2 (b)).
      // Not scripted as a Playwright assertion: it requires comparing against a
      // pre-fix screenshot, which is a P6 verification-time activity (see t090 spec's
      // equivalent pattern — screenshots are evidence, not inline visual assertions).
      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd2.png` })
    })

    test('test_bdd_3_markdown_body_16px_padding_24px_total_inset', async ({ page }) => {
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}?firstFileId=${MARKDOWN_FILE_ID}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const md = page.locator('[data-testid="markdown-body"]')
      await expect(md).toBeVisible()

      const padding = await md.evaluate((el) => getComputedStyle(el).padding)
      expect(padding).toBe(`${MARKDOWN_BODY_PADDING_PX}px`)

      // .markdown-body's own boundingBox().x sits at content-area's padding
      // edge regardless of .markdown-body's own padding (CSS box model);
      // measure the first child instead. See P3-test-cases.md P4 note.
      const firstChild = md.locator('> *').first()
      const mdBox = await firstChild.boundingBox()
      expect(mdBox).not.toBeNull()
      // Total left inset = .content-area's 8px + .markdown-body's 16px = 24px.
      expect(mdBox!.x).toBeGreaterThanOrEqual(MARKDOWN_TOTAL_INSET_PX - 2)
      expect(mdBox!.x).toBeLessThanOrEqual(MARKDOWN_TOTAL_INSET_PX + 2)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd3.png` })
    })

    test('test_bdd_4_bottom_bar_padding_top_bottom_symmetric', async ({ page }) => {
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const bar = page.locator('[data-testid="mobile-bottom-bar"]')
      await expect(bar).toBeVisible()

      const { paddingTop, paddingBottom } = await bar.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom }
      })
      // This CDP/Playwright test environment has no safe-area inset, so
      // env(safe-area-inset-bottom) resolves to 0 — matching BDD-4's Given clause
      // ("设备/浏览器不提供安全区高度").
      expect(paddingTop).toBe(`${BOTTOM_BAR_BASE_PADDING_PX}px`)
      expect(paddingBottom).toBe(`${BOTTOM_BAR_BASE_PADDING_PX}px`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd4.png` })
    })

    test('test_bdd_5_copy_button_icon_only_no_accent_fill', async ({ page }) => {
      await page.goto(`${BASE_URL}/${CODE_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const copyBtn = page.locator('[data-testid="mobile-bar-copy-btn"]')
      await expect(copyBtn).toBeVisible()

      const text = (await copyBtn.evaluate((el) => el.textContent?.trim() ?? '')) || ''
      expect(text).not.toContain('Copy')

      const bg = await copyBtn.evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(bg)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd5_mobile_copy.png` })

      // Desktop reference screenshot for vision-engine side-by-side comparison
      // against EntryDetailHeader.vue's .icon-btn Copy button (no stable
      // data-testid on the desktop header; aria-label is the accessible,
      // implementation-detail-free selector — not a class selector).
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(300)
      const desktopCopyBtn = page.getByRole('button', { name: 'Copy' })
      await expect(desktopCopyBtn).toBeVisible()
      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd5_desktop_copy.png` })
    })

    test('test_bdd_6_copy_button_44px_hit_area', async ({ page }) => {
      await page.goto(`${BASE_URL}/${CODE_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const copyBtn = page.locator('[data-testid="mobile-bar-copy-btn"]')
      const box = await copyBtn.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX)
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX)
    })

    test('test_bdd_7_wrap_button_toggle_states_distinguishable', async ({ page }) => {
      await page.goto(`${BASE_URL}/${CODE_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const wrapBtn = page.locator('[data-testid="mobile-bar-wrap-btn"]')
      await expect(wrapBtn).toBeVisible()

      // aria-pressed must exist and toggle — P2 requires this to be added
      // (accessibility regression fix, aligned with the source-toggle button's
      // existing pattern), not just a visual affordance.
      await expect(wrapBtn).toHaveAttribute('aria-pressed', 'false')
      const classBefore = (await wrapBtn.getAttribute('class')) || ''
      expect(classBefore).not.toContain('active')
      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd7_off.png` })

      await wrapBtn.click()
      await page.waitForTimeout(200)

      await expect(wrapBtn).toHaveAttribute('aria-pressed', 'true')
      const classAfter = (await wrapBtn.getAttribute('class')) || ''
      expect(classAfter).toContain('active')
      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd7_on.png` })
    })

    test('test_bdd_8_wrap_button_44px_hit_area', async ({ page }) => {
      await page.goto(`${BASE_URL}/${CODE_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const wrapBtn = page.locator('[data-testid="mobile-bar-wrap-btn"]')
      const box = await wrapBtn.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX)
      expect(box!.height).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN_PX)
    })

    test('test_bdd_9_ten_viewers_visual_consistency', async ({ page }) => {
      for (const { slug, label } of VIEWER_ENTRIES) {
        await page.goto(`${BASE_URL}/${slug}`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        const metaBar = page.locator('[data-testid="meta-tags-bar"]')
        await expect(metaBar).toBeVisible()
        await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toBeVisible()

        // DOM-assist checks tying BDD-9 to BDD-1 (no horizontal scroll) and BDD-5
        // (icon-only Copy) across all 10 viewers, per P1 BDD-9's Then clause
        // ("对应 BDD-1/BDD-2"..."对应 BDD-5/BDD-7"), not just screenshot evidence.
        const { scrollWidth, clientWidth } = await metaBar.evaluate((el) => ({
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
        }))
        expect(scrollWidth, `meta-tags-bar overflow on ${label}`).toBeLessThanOrEqual(clientWidth)

        const copyBtn = page.locator('[data-testid="mobile-bar-copy-btn"]')
        if (await copyBtn.count()) {
          const copyText = (await copyBtn.evaluate((el) => el.textContent?.trim() ?? '')) || ''
          expect(copyText, `Copy button still has text label on ${label}`).not.toContain('Copy')
        }

        await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd9_${label}.png` })
      }
    })

    test('test_bdd_10_image_viewer_exception_no_occlusion', async ({ page }) => {
      await page.goto(`${BASE_URL}/${SVG_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const metaBar = page.locator('[data-testid="meta-tags-bar"]')
      await expect(metaBar).toBeVisible()
      const imageViewer = page.locator('[data-testid="image-viewer"]')
      await expect(imageViewer).toBeVisible()

      // DOM-assist "首屏完整性" + "可用尺寸" check: ImageViewer's top edge should sit
      // exactly at meta-tags-bar's bottom edge (no overlap = no occlusion, no gap =
      // no unexplained compression). Mirrors the exact methodology P2-design.md §2
      // minimal_validation used (viewerTop === metaBottom), not a height-subtraction
      // heuristic.
      const metaBottom = await metaBar.evaluate((el) => el.getBoundingClientRect().bottom)
      const viewerTop = await imageViewer.evaluate((el) => el.getBoundingClientRect().top)
      expect(Math.abs(viewerTop - metaBottom)).toBeLessThanOrEqual(2)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd10_firstscreen.png` })

      // Vertical upward swipe (~250px) in the middle of the content area, per
      // P2-design.md §4 落地要求.
      const contentBox = await page.locator('[data-testid="content-area"]').boundingBox()
      expect(contentBox).not.toBeNull()
      const midX = contentBox!.x + contentBox!.width / 2
      const midY = contentBox!.y + contentBox!.height / 2
      await page.mouse.move(midX, midY)
      await page.mouse.down()
      await page.mouse.move(midX, midY - 250, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(300)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd10_afterswipe.png` })
    })

    test('test_bdd_11_html_viewer_exception_no_occlusion', async ({ page }) => {
      await page.goto(`${BASE_URL}/${HTML_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const metaBar = page.locator('[data-testid="meta-tags-bar"]')
      await expect(metaBar).toBeVisible()
      // HtmlViewer's root has no data-testid (unlike ImageViewer's); `.html-viewer`
      // is HtmlViewer.vue's own top-level structural class, not an implementation
      // artifact like the mobile bottom bar's `.bottom-btn`/`.toggle-btn` — scoped
      // to content-area to avoid ambiguity.
      const htmlViewer = page.locator('[data-testid="content-area"] .html-viewer')
      await expect(htmlViewer).toBeVisible()

      const metaBottom = await metaBar.evaluate((el) => el.getBoundingClientRect().bottom)
      const viewerTop = await htmlViewer.evaluate((el) => el.getBoundingClientRect().top)
      expect(Math.abs(viewerTop - metaBottom)).toBeLessThanOrEqual(2)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd11_firstscreen.png` })

      const contentBox = await page.locator('[data-testid="content-area"]').boundingBox()
      expect(contentBox).not.toBeNull()
      const midX = contentBox!.x + contentBox!.width / 2
      const midY = contentBox!.y + contentBox!.height / 2
      await page.mouse.move(midX, midY)
      await page.mouse.down()
      await page.mouse.move(midX, midY - 250, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(300)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd11_afterswipe.png` })
    })
  })

  // -----------------------------------------------------------------------
  // Desktop viewport (1280x800) — cross-platform non-regression
  // -----------------------------------------------------------------------
  test.describe('Desktop viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('test_bdd_12_desktop_markdown_padding_unchanged', async ({ page }) => {
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}?firstFileId=${MARKDOWN_FILE_ID}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const padding = await page
        .locator('[data-testid="markdown-body"]')
        .evaluate((el) => getComputedStyle(el).padding)
      expect(padding).toBe(`${DESKTOP_MARKDOWN_PADDING_PX}px`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd12.png` })
    })

    test('test_bdd_13_desktop_no_mobile_components', async ({ page }) => {
      // Positive companion check first: confirm both mobile-only elements really
      // render on mobile, so "count is 0 on desktop" isn't vacuously true before
      // either element is even implemented. See t090 spec's equivalent pattern
      // (test_bdd_12_desktop_no_mobile_bottom_bar).
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${BASE_URL}/${MARKDOWN_ENTRY}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toBeVisible()
      await expect(page.locator('[data-testid="meta-tags-bar"]')).toBeVisible()

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(300)
      await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="meta-tags-bar"]')).toHaveCount(0)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd13.png` })
    })
  })
})
