import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const EVIDENCE_DIR = 'docs/tasks/T090-mobile-detail-ux-polish/evidences'

// T091 target: mobile markdown single-side inset, per T091 P1-requirements BDD-8/
// P2-design.md §4. content-area(8px horizontal padding) + markdown-body
// padding(16px, var(--space-4)) = 24px. Supersedes the T090-era baseline/ratio
// constants (T090 targeted shrinking this inset toward 0; T091 restores it).
const MARKDOWN_MOBILE_TARGET_INSET_PX = 24

const LONG_MARKDOWN = Array.from(
  { length: 60 },
  (_, i) =>
    `## Heading ${i + 1}\n\nParagraph ${i + 1} content lorem ipsum dolor sit amet consectetur adipiscing elit. `.repeat(
      4
    )
).join('\n\n')

const LONG_PYTHON = Array.from(
  { length: 150 },
  (_, i) =>
    `# line ${i + 1}\nvalue_${i} = ${i * 7}  # trailing comment to make this line reasonably wide for wrap testing ${i}`
).join('\n')

test.describe('T090 Mobile Detail UX Polish', () => {
  test.beforeAll(async ({ request }) => {
    await request
      .post(`${BASE_URL}/api/v1/entries`, {
        data: {
          slug: 't090-long-markdown',
          summary: 'T090 long markdown',
          is_public: true,
          files: [{ filename: 'README.md', content: LONG_MARKDOWN }],
        },
      })
      .catch(() => {})

    await request
      .post(`${BASE_URL}/api/v1/entries`, {
        data: {
          slug: 't090-long-code',
          summary: 'T090 long code',
          is_public: true,
          files: [{ filename: 'main.py', content: LONG_PYTHON }],
        },
      })
      .catch(() => {})

    await request
      .post(`${BASE_URL}/api/v1/entries`, {
        data: {
          slug: 't090-md-multifile',
          summary: 'T090 multi-file markdown',
          is_public: true,
          files: [
            { filename: 'index.md', content: LONG_MARKDOWN, language: 'markdown' },
            { filename: 'notes.md', content: '# Notes\n\nSecond file.', language: 'markdown' },
          ],
        },
      })
      .catch(() => {})

    await request
      .post(`${BASE_URL}/api/v1/entries`, {
        data: {
          slug: 't090-py-multifile',
          summary: 'T090 multi-file python',
          is_public: true,
          files: [
            { filename: 'main.py', content: LONG_PYTHON, language: 'python' },
            { filename: 'utils.py', content: 'def helper():\n    return 42\n', language: 'python' },
          ],
        },
      })
      .catch(() => {})
  })

  // ---------------------------------------------------------------------
  // Mobile viewport (390x844) — problem 1 (scroll jump) + problem 2 (bottom bar) + problem 3 (margin)
  // ---------------------------------------------------------------------
  test.describe('Mobile viewport (390x844)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('test_bdd_1_markdown_mobile_scroll_no_jump', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const contentArea = page.locator('[data-testid="content-area"]')
      const sentinel = page.locator('[data-testid="meta-tags-bar"]')

      const steps = [0, 60, 120, 180, 240, 300]
      const positions: number[] = []
      for (const s of steps) {
        await contentArea.evaluate((el, v) => {
          ;(el as HTMLElement).scrollTop = v
        }, s)
        await page.waitForTimeout(80)
        positions.push(await sentinel.evaluate((el) => el.getBoundingClientRect().top))
      }

      // Continuous position change proportional to scrollTop delta = no one-off jump.
      for (let i = 1; i < positions.length; i++) {
        const scrollDelta = steps[i] - steps[i - 1]
        const posDelta = positions[i - 1] - positions[i]
        expect(Math.abs(posDelta - scrollDelta)).toBeLessThanOrEqual(2)
      }

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd1.png` })
    })

    test('test_bdd_2_code_mobile_scroll_no_jump', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-code`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const contentArea = page.locator('[data-testid="content-area"]')
      const sentinel = page.locator('[data-testid="meta-tags-bar"]')

      const steps = [0, 60, 120, 180, 240, 300]
      const positions: number[] = []
      for (const s of steps) {
        await contentArea.evaluate((el, v) => {
          ;(el as HTMLElement).scrollTop = v
        }, s)
        await page.waitForTimeout(80)
        positions.push(await sentinel.evaluate((el) => el.getBoundingClientRect().top))
      }

      for (let i = 1; i < positions.length; i++) {
        const scrollDelta = steps[i] - steps[i - 1]
        const posDelta = positions[i - 1] - positions[i]
        expect(Math.abs(posDelta - scrollDelta)).toBeLessThanOrEqual(2)
      }

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd2.png` })
    })

    test('test_bdd_3_meta_bar_visibility_position_driven_not_direction_driven', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const contentArea = page.locator('[data-testid="content-area"]')
      const metaBar = page.locator('[data-testid="meta-tags-bar"]')

      const readState = () =>
        metaBar.evaluate((el) => ({
          className: el.className,
          display: getComputedStyle(el).display,
          opacity: getComputedStyle(el).opacity,
          maxHeight: getComputedStyle(el).maxHeight,
        }))

      // Arrive at scrollTop=300 by scrolling straight down from 0.
      await contentArea.evaluate((el) => {
        ;(el as HTMLElement).scrollTop = 300
      })
      await page.waitForTimeout(200)
      const stateViaDown = await readState()

      // Arrive at the SAME scrollTop=300, but via scrolling further down then back up.
      await contentArea.evaluate((el) => {
        ;(el as HTMLElement).scrollTop = 700
      })
      await page.waitForTimeout(200)
      await contentArea.evaluate((el) => {
        ;(el as HTMLElement).scrollTop = 300
      })
      await page.waitForTimeout(200)
      const stateViaUp = await readState()

      // Same document position -> identical visual state, regardless of arrival direction.
      expect(stateViaDown).toEqual(stateViaUp)
      expect(stateViaDown.className).not.toMatch(/hidden/)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd3.png` })
    })

    test('test_bdd_4_bottom_bar_fixed_across_scroll_positions', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const contentArea = page.locator('[data-testid="content-area"]')
      const bottomBar = page.locator('[data-testid="mobile-bottom-bar"]')

      const maxScroll = await contentArea.evaluate(
        (el) => (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight
      )
      const scrollPositions = [0, Math.floor(maxScroll / 2), maxScroll]

      const boxes: ({ x: number; y: number; width: number; height: number } | null)[] = []
      for (const pos of scrollPositions) {
        await contentArea.evaluate((el, v) => {
          ;(el as HTMLElement).scrollTop = v
        }, pos)
        await page.waitForTimeout(150)
        boxes.push(await bottomBar.boundingBox())
      }

      for (const box of boxes) {
        expect(box).not.toBeNull()
      }
      const [b0, b1, b2] = boxes as { x: number; y: number; width: number; height: number }[]
      expect(b1.y).toBe(b0.y)
      expect(b2.y).toBe(b0.y)
      expect(b1.x).toBe(b0.x)
      expect(b2.x).toBe(b0.x)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd4.png` })
    })

    test('test_bdd_5_bottom_bar_not_occluded_two_viewport_heights', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const bottomBar = page.locator('[data-testid="mobile-bottom-bar"]')

      // Height A: address bar collapsed (larger visible viewport).
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(200)
      const boxA = await bottomBar.boundingBox()
      expect(boxA).not.toBeNull()
      expect(boxA!.y).toBeGreaterThanOrEqual(0)
      expect(boxA!.y + boxA!.height).toBeLessThanOrEqual(844)

      // Height B: address bar expanded (smaller visible viewport).
      await page.setViewportSize({ width: 390, height: 700 })
      await page.waitForTimeout(200)
      const boxB = await bottomBar.boundingBox()
      expect(boxB).not.toBeNull()
      expect(boxB!.y).toBeGreaterThanOrEqual(0)
      expect(boxB!.y + boxB!.height).toBeLessThanOrEqual(700)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd5.png` })
    })

    test('test_bdd_6_bottom_bar_markdown_buttons_functional', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await page.goto(`${BASE_URL}/t090-md-multifile`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // file-tree drawer (drawer-left, occupies x:0-280 of the 390px viewport;
      // click the overlay on the opposite side to avoid the drawer intercepting the click)
      await page.locator('[data-testid="mobile-bar-filetree-btn"]').click()
      await expect(page.locator('.drawer-header').getByText(/^Files ·/)).toBeVisible()
      await page.locator('.drawer-overlay').click({ position: { x: 350, y: 400 } })
      await page.waitForTimeout(200)

      // toc drawer (drawer-right, occupies x:110-390 of the 390px viewport;
      // click the overlay on the opposite side to avoid the drawer intercepting the click)
      await page.locator('[data-testid="mobile-bar-toc-btn"]').click()
      await expect(page.getByText(/^Table of Contents ·/)).toBeVisible()
      await page.locator('.drawer-overlay').click({ position: { x: 40, y: 400 } })
      await page.waitForTimeout(200)

      // source-toggle
      const sourceBtn = page.locator('[data-testid="mobile-bar-source-toggle-btn"]')
      await expect(sourceBtn).toHaveAttribute('aria-pressed', 'false')
      await sourceBtn.click()
      await expect(sourceBtn).toHaveAttribute('aria-pressed', 'true')
      await sourceBtn.click()
      await expect(sourceBtn).toHaveAttribute('aria-pressed', 'false')

      // copy (no toast/visual feedback in current implementation — verify the
      // actual clipboard content instead of waiting for a role="status" toast;
      // see P4-gate-diagnosis.md "追加诊断" for why)
      await page.locator('[data-testid="mobile-bar-copy-btn"]').click()
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toContain('Heading 1')

      // overflow (more actions)
      const overflowTrigger = page.locator('[data-testid="overflow-menu-trigger"]')
      await overflowTrigger.click()
      await expect(overflowTrigger).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByRole('menu')).toBeVisible()

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd6.png` })
    })

    test('test_bdd_7_wrap_button_toggles_non_markdown_non_html', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-py-multifile`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const wrapBtn = page.locator('[data-testid="mobile-bar-wrap-btn"]')
      await expect(wrapBtn).toBeVisible()

      const classBefore = (await wrapBtn.getAttribute('class')) || ''
      expect(classBefore).not.toContain('active')

      await wrapBtn.click()
      await page.waitForTimeout(200)

      const classAfter = (await wrapBtn.getAttribute('class')) || ''
      expect(classAfter).toContain('active')

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd7.png` })
    })

    test('test_bdd_8_markdown_mobile_inset_symmetric_24px', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const md = page.locator('[data-testid="markdown-body"]')
      const mdBox = await md.boundingBox()
      expect(mdBox).not.toBeNull()

      const viewportWidth = 390
      const leftInset = mdBox!.x
      const rightInset = viewportWidth - (mdBox!.x + mdBox!.width)
      // T091 restores mobile .markdown-body padding (0 -> var(--space-4)=16px),
      // stacking with .content-area's 8px horizontal padding for a total 24px
      // inset per side. This is the opposite direction from T090's "smaller is
      // better" reduction-ratio framing, so the assertion is rewritten (not just
      // re-thresholded) to check left/right symmetry plus an exact 24px target.
      // See P2-design.md §4 / P1-requirements.md BDD-8.
      expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(2)
      expect(leftInset).toBeGreaterThanOrEqual(MARKDOWN_MOBILE_TARGET_INSET_PX - 2)
      expect(leftInset).toBeLessThanOrEqual(MARKDOWN_MOBILE_TARGET_INSET_PX + 2)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_390x844_bdd8.png` })
    })
  })

  // ---------------------------------------------------------------------
  // Extra-small viewport (375 width) — problem 3 boundary
  // ---------------------------------------------------------------------
  test.describe('Extra-small viewport (375x812)', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('test_bdd_9_375px_no_horizontal_overflow_no_text_clip', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(375)

      const md = page.locator('[data-testid="markdown-body"]')
      const mdBox = await md.boundingBox()
      expect(mdBox).not.toBeNull()
      expect(mdBox!.x).toBeGreaterThanOrEqual(0)
      expect(mdBox!.x + mdBox!.width).toBeLessThanOrEqual(375)

      await page.screenshot({ path: `${EVIDENCE_DIR}/mobile_375x812_bdd9.png` })
    })
  })

  // ---------------------------------------------------------------------
  // Desktop viewport (1280x800) — cross-platform non-regression
  // ---------------------------------------------------------------------
  test.describe('Desktop viewport (1280x800)', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('test_bdd_10_desktop_meta_bar_scroll_behavior_unchanged', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Desktop never renders the mobile meta-tags-bar at all.
      await expect(page.locator('[data-testid="meta-tags-bar"]')).toHaveCount(0)

      const contentArea = page.locator('[data-testid="content-area"]')
      const sentinel = page.locator('[data-testid="markdown-body"]')

      const steps = [0, 100, 200]
      const positions: number[] = []
      for (const s of steps) {
        await contentArea.evaluate((el, v) => {
          ;(el as HTMLElement).scrollTop = v
        }, s)
        await page.waitForTimeout(80)
        positions.push(await sentinel.evaluate((el) => el.getBoundingClientRect().top))
      }
      for (let i = 1; i < positions.length; i++) {
        const scrollDelta = steps[i] - steps[i - 1]
        const posDelta = positions[i - 1] - positions[i]
        expect(Math.abs(posDelta - scrollDelta)).toBeLessThanOrEqual(2)
      }

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd10.png` })
    })

    test('test_bdd_11_desktop_markdown_padding_unchanged', async ({ page }) => {
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const padding = await page
        .locator('[data-testid="markdown-body"]')
        .evaluate((el) => getComputedStyle(el).padding)
      expect(padding).toBe('24px')

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd11.png` })
    })

    test('test_bdd_12_desktop_no_mobile_bottom_bar', async ({ page }) => {
      // Positive companion check first: confirm the bar genuinely renders on mobile.
      // Without this, "toHaveCount(0)" alone would vacuously pass before the bar's
      // data-testid is ever implemented, producing a false green instead of a red.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${BASE_URL}/t090-long-markdown`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toBeVisible()

      // Now switch to desktop viewport and confirm the mobile-only bar is absent.
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(300)
      await expect(page.locator('[data-testid="mobile-bottom-bar"]')).toHaveCount(0)

      await page.screenshot({ path: `${EVIDENCE_DIR}/desktop_1280x800_bdd12.png` })
    })
  })
})
