import { test, expect } from '@playwright/test'

test.describe('Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('TC-50: BDD-01 — press f to enter zen mode', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-multi',
        summary: 'E2E Zen Multi',
        files: [
          { filename: 'index.md', content: '# Hello\n\n## Section 1\n\nSome content\n\n## Section 2\n\nMore content' },
          { filename: 'app.py', content: 'print("hello")' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-multi')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    await page.keyboard.press('f')

    await expect(page.locator('.detail-header')).not.toBeVisible()
    await expect(page.locator('.file-sidebar')).not.toBeVisible()
    await expect(page.locator('.toc-sidebar')).not.toBeVisible()
    await expect(page.locator('.content-area')).toBeVisible()

    await page.screenshot({ path: 'test-results/zen-tc50-enter-zen-desktop_1280x800.png' })
  })

  test('TC-51: BDD-02 — press Esc to exit zen mode', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-esc',
        summary: 'E2E Zen Esc',
        files: [
          { filename: 'index.md', content: '# Hello\n\nContent' },
          { filename: 'app.py', content: 'print("hello")' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-esc')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    await page.keyboard.press('f')
    await expect(page.locator('.detail-header')).not.toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.locator('.detail-header')).toBeVisible()
    await expect(page.locator('.file-sidebar')).toBeVisible()
    await expect(page.locator('.toc-sidebar')).toBeVisible()

    await page.screenshot({ path: 'test-results/zen-tc51-esc-exit-desktop_1280x800.png' })
  })

  test('TC-52: BDD-03 — press f again to toggle off zen', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-toggle',
        summary: 'E2E Zen Toggle',
        files: [
          { filename: 'index.md', content: '# Hello\n\nContent' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-toggle')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    await page.keyboard.press('f')
    await expect(page.locator('.detail-header')).not.toBeVisible()

    await page.keyboard.press('f')
    await expect(page.locator('.detail-header')).toBeVisible()

    await page.screenshot({ path: 'test-results/zen-tc52-toggle-off-desktop_1280x800.png' })
  })

  test('TC-53: BDD-04 — f key in input does not trigger zen', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-input',
        summary: 'E2E Zen Input',
        files: [
          { filename: 'readme.md', content: '# Test' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-input')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    const input = page.locator('input').first()
    if (await input.count() > 0) {
      await input.focus()
      await page.keyboard.press('f')
      await expect(page.locator('.detail-header')).toBeVisible()
    }
  })

  test('TC-54: BDD-05 — state preserved after zen exit', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-state',
        summary: 'E2E Zen State',
        files: [
          { filename: 'index.md', content: '# Hello\n\n## A\n\n## B\n\n## C\n\nContent here' },
          { filename: 'src/app.py', content: 'print("a")' },
          { filename: 'src/utils.py', content: 'def helper(): pass' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-state')
    await page.waitForSelector('.file-sidebar', { timeout: 10000 })

    const expandDir = page.locator('.dir-item').first()
    if (await expandDir.count() > 0) {
      await expandDir.click()
      await page.waitForTimeout(200)
    }

    const tocBefore = await page.locator('.toc-nav .toc-item').count()

    await page.keyboard.press('f')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    const tocAfter = await page.locator('.toc-nav .toc-item').count()
    expect(tocAfter).toBe(tocBefore)
    await expect(page.locator('.file-sidebar')).toBeVisible()
  })

  test('TC-55: BDD-06 — content-area scrollTop preserved', async ({ page }) => {
    const longContent = Array.from({ length: 50 }, (_, i) => `## Section ${i + 1}\n\nLorem ipsum `.repeat(5)).join('\n\n')
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-scroll',
        summary: 'E2E Zen Scroll',
        files: [
          { filename: 'long.md', content: longContent },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-scroll')
    await page.waitForSelector('.markdown-body', { timeout: 10000 })
    await page.waitForTimeout(500)

    const scrollContainer = page.locator('.markdown-viewer').first()
    await scrollContainer.evaluate((el: HTMLElement) => { el.scrollTop = 200 })
    await page.waitForTimeout(100)

    const scrollTopBefore = await scrollContainer.evaluate((el: HTMLElement) => el.scrollTop)

    await page.keyboard.press('f')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    const scrollTopAfter = await scrollContainer.evaluate((el: HTMLElement) => el.scrollTop)
    expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThanOrEqual(2)
  })

  test('TC-56: BDD-07 — HtmlViewer iframe not reloaded', async ({ page }) => {
    const htmlContent = '<!DOCTYPE html><html><body><h1>Test</h1><script>window.loadCount = (window.loadCount||0)+1;</script></body></html>'
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-iframe',
        summary: 'E2E Zen Iframe',
        files: [
          { filename: 'page.html', content: htmlContent },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-iframe')
    await page.waitForSelector('iframe', { timeout: 10000 })
    await page.waitForTimeout(1000)

    const loadCountBefore = await page.locator('iframe').evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      try { return (iframe.contentWindow as any).loadCount } catch { return -1 }
    })

    await page.keyboard.press('f')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    const loadCountAfter = await page.locator('iframe').evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      try { return (iframe.contentWindow as any).loadCount } catch { return -1 }
    })

    expect(loadCountAfter).toBe(loadCountBefore)
  })

  test('TC-57: BDD-08 — f key on list page has no effect', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    await page.keyboard.press('f')
    await page.waitForTimeout(200)

    const zenClass = await page.locator('.zen-mode').count()
    expect(zenClass).toBe(0)
  })

  test('TC-59: BDD-10 — f key with ConfirmDialog open does not trigger zen', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-confirm',
        summary: 'E2E Zen Confirm',
        is_public: true,
        files: [
          { filename: 'readme.md', content: '# Test' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-confirm')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    const deleteBtn = page.locator('button:has-text("Delete"), .btn-delete').first()
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 })

      await page.keyboard.press('f')
      await page.waitForTimeout(200)

      await expect(page.locator('.detail-header')).toBeVisible()
    }
  })

  test('TC-60: BDD-11 — single file entry enters zen without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-single',
        summary: 'E2E Zen Single',
        files: [
          { filename: 'main.py', content: 'print("hello")' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-single')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    await page.keyboard.press('f')
    await page.waitForTimeout(200)

    await expect(page.locator('.detail-header')).not.toBeVisible()
    await expect(page.locator('.content-area')).toBeVisible()
    expect(errors).toHaveLength(0)

    await page.screenshot({ path: 'test-results/zen-tc60-single-file-desktop_1280x800.png' })
  })

  test('TC-61: B1 — focus redirected when entering zen from header button', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-focus',
        summary: 'E2E Zen Focus',
        files: [
          { filename: 'readme.md', content: '# Test' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-focus')
    await page.waitForSelector('.detail-header', { timeout: 10000 })

    const headerBtn = page.locator('.detail-header button').first()
    if (await headerBtn.count() > 0) {
      await headerBtn.focus()
      await page.keyboard.press('f')
      await page.waitForTimeout(200)

      const activeElement = await page.evaluate(() => document.activeElement?.className || '')
      expect(activeElement).toContain('content-area')
    }
  })

  test('TC-62: B2 — aria-live region announces zen state', async ({ page }) => {
    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-aria',
        summary: 'E2E Zen Aria',
        files: [
          { filename: 'readme.md', content: '# Test' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-aria')
    await page.waitForSelector('.content-area', { timeout: 10000 })

    await page.keyboard.press('f')
    await page.waitForTimeout(200)

    const ariaText = await page.locator('[aria-live="polite"]').textContent()
    expect(ariaText).toContain('Zen mode on')

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    const ariaTextAfter = await page.locator('[aria-live="polite"]').textContent()
    expect(ariaTextAfter).toContain('Zen mode off')
  })
})

test.describe('Zen Mode — Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('TC-63: mobile viewport — no JS errors on detail page', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const res = await page.request.post('/api/v1/entries', {
      data: {
        slug: 'e2e-zen-mobile',
        summary: 'E2E Zen Mobile',
        files: [
          { filename: 'readme.md', content: '# Test' },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/#/entry/e2e-zen-mobile')
    await page.waitForSelector('.content-area', { timeout: 10000 })
    await page.waitForTimeout(500)

    expect(errors).toHaveLength(0)

    await page.screenshot({ path: 'test-results/zen-tc63-mobile_390x844.png' })
  })
})
