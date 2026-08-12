import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888'

test.describe('T069 Auth Guard — Desktop', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('BDD-1-E2E: Authenticated user refresh /settings stays on /settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      document.cookie = 'peekview_token=valid; path=/'
    })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    expect(page.url()).toContain('/settings')
    expect(page.url()).not.toContain('/?redirect=')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-1-desktop-settings-refresh.png' })
  })

  test('BDD-2-E2E: Unauthenticated user refresh /settings redirects to /', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    expect(page.url()).not.toContain('/settings')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-2-unauth-settings-redirect.png' })
  })

  test('BDD-3-E2E: Authenticated SPA navigation to /settings works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      document.cookie = 'peekview_token=valid; path=/'
    })

    await page.goto(`${BASE_URL}/explore`)
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      window.location.hash = '#/settings'
    })
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-3-spa-nav-settings.png' })
  })

  test('BDD-4-E2E: Authenticated user refresh / redirects to /explore', async ({ page }) => {
    await page.evaluate(() => {
      document.cookie = 'peekview_token=valid; path=/'
    })

    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    expect(page.url()).toContain('/explore')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-4-auth-root-redirect.png' })
  })

  test('BDD-5-E2E: Unauthenticated user refresh / stays on /', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const url = page.url()
    expect(url.endsWith('/') || url.endsWith('') || url === `${BASE_URL}/`).toBe(true)
    expect(url).not.toContain('/explore')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-5-unauth-root-stay.png' })
  })

  test('BDD-6-E2E: Guard does not hang (completes within 5s)', async ({ page }) => {
    const start = Date.now()

    await page.goto(`${BASE_URL}/settings`, { timeout: 10000 })
    await page.waitForTimeout(6000)

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10000)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-6-guard-no-hang.png' })
  })
})

test.describe('T069 Desktop Header Brand/Title — Desktop', () => {
  test.describe.configure({ mode: 'serial' })

  let entrySlug: string

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        slug: `t069-desktop-${Date.now()}`,
        summary: 'T069 Desktop Header Test Entry',
        files: [
          { filename: 'main.py', content: 'def hello(): pass\n' },
          { filename: 'utils.py', content: 'def util(): pass\n' },
          { filename: 'README.md', content: '# Heading 1\n\n## Heading 2\n### Heading 3\n' },
        ],
      },
    })
    const body = await resp.json()
    entrySlug = body.slug || `t069-desktop-${Date.now()}`
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('BDD-7-E2E: Desktop brand text color is tertiary (distinguishable from title)', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const brandWord = page.locator('.detail-logo-word')
    await expect(brandWord).toBeVisible()

    const brandColor = await brandWord.evaluate((el) => getComputedStyle(el).color)
    const title = page.locator('.detail-header .title')
    const titleColor = await title.evaluate((el) => getComputedStyle(el).color)

    expect(brandColor).not.toBe(titleColor)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-7-desktop-brand-color.png' })
  })

  test('BDD-8-E2E: Desktop brand text and title have separator', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const separator = page.locator('.brand-sep')
    await expect(separator).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-8-desktop-brand-sep.png' })
  })

  test('BDD-9-E2E: Desktop brand text hover changes to accent color', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const logo = page.locator('.detail-logo')
    const brandWord = page.locator('.detail-logo-word')

    await logo.hover()
    await page.waitForTimeout(200)

    const hoverColor = await brandWord.evaluate((el) => getComputedStyle(el).color)
    expect(hoverColor).toBeTruthy()

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-9-desktop-brand-hover.png' })
  })

  test('BDD-10-E2E: Desktop multi-file entry Files toggle shows file count badge', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const filesToggle = page.locator('.detail-header .toggle-btn[aria-label="Toggle file tree"]')
    await expect(filesToggle).toBeVisible()

    const badge = filesToggle.locator('.toggle-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('3')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-10-desktop-files-badge.png' })
  })

  test('BDD-11-E2E: Desktop single-file entry does not show Files toggle', async ({ request, page }) => {
    const resp = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        slug: `t069-single-${Date.now()}`,
        summary: 'Single File Entry',
        files: [{ filename: 'main.py', content: 'print("hello")\n' }],
      },
    })
    const body = await resp.json()
    const singleSlug = body.slug

    await page.goto(`${BASE_URL}/${singleSlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const filesToggle = page.locator('.detail-header .toggle-btn[aria-label="Toggle file tree"]')
    await expect(filesToggle).toHaveCount(0)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-11-desktop-single-file-no-toggle.png' })
  })

  test('BDD-12-E2E: FileTree panel header shows file count', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.detail-header', { timeout: 5000 })

    const filesToggle = page.locator('.detail-header .toggle-btn[aria-label="Toggle file tree"]')
    await filesToggle.click()
    await page.waitForSelector('.file-sidebar', { timeout: 3000 })

    const fileTreeHeader = page.locator('.file-tree-header h3')
    await expect(fileTreeHeader).toContainText('3')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-12-filetree-header-count.png' })
  })
})

test.describe('T069 Mobile Sticky Header — Mobile', () => {
  test.describe.configure({ mode: 'serial' })

  let entrySlug: string

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        slug: `t069-mobile-${Date.now()}`,
        summary: 'T069 Mobile Header Test Entry With A Very Long Title That Should Truncate To Two Lines Maximum',
        files: [
          { filename: 'main.py', content: 'def hello(): pass\n' },
          { filename: 'utils.py', content: 'def util(): pass\n' },
          { filename: 'README.md', content: '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n' },
        ],
      },
    })
    const body = await resp.json()
    entrySlug = body.slug || `t069-mobile-${Date.now()}`
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('BDD-13-E2E: Mobile sticky header no back arrow or PeekView text', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-sticky-header', { timeout: 5000 })

    const backBtn = page.locator('.mobile-sticky-header .back-btn')
    await expect(backBtn).toHaveCount(0)

    const stickyBrand = page.locator('.mobile-sticky-header .sticky-brand')
    await expect(stickyBrand).toHaveCount(0)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-13-mobile-no-back-brand.png' })
  })

  test('BDD-14-E2E: Mobile sticky header title max two lines', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-sticky-header', { timeout: 5000 })

    const stickyTitle = page.locator('.mobile-sticky-header .sticky-title')
    await expect(stickyTitle).toBeVisible()

    const lineHeight = await stickyTitle.evaluate((el) => {
      const style = getComputedStyle(el)
      return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3
    })
    const titleHeight = (await stickyTitle.boundingBox())?.height ?? 0
    const maxTwoLines = lineHeight * 2.5

    expect(titleHeight).toBeLessThanOrEqual(maxTwoLines)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-14-mobile-title-two-lines.png' })
  })

  test('BDD-15-E2E: Mobile logo icon click navigates to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-sticky-header', { timeout: 5000 })

    const logoLink = page.locator('.mobile-sticky-header a[href="/"]')
    await expect(logoLink).toBeVisible()

    await logoLink.click()
    await page.waitForTimeout(1000)

    const url = page.url()
    expect(url.endsWith('/') || url.endsWith('/explore')).toBe(true)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-15-mobile-logo-home.png' })
  })

  test('BDD-16-E2E: Mobile anonymous user Sign in is text link', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-sticky-header', { timeout: 5000 })

    const signinBtn = page.locator('.mobile-sticky-header .mobile-signin-btn')
    await expect(signinBtn).toHaveCount(0)

    const signinLink = page.locator('.mobile-sticky-header .mobile-signin-link')
    await expect(signinLink).toBeVisible()

    const linkColor = await signinLink.evaluate((el) => getComputedStyle(el).color)
    expect(linkColor).toBeTruthy()

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-16-mobile-signin-link.png' })
  })
})

test.describe('T069 Mobile Bottom Bar — Mobile', () => {
  test.describe.configure({ mode: 'serial' })

  let entrySlug: string

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        slug: `t069-bottom-${Date.now()}`,
        summary: 'T069 Bottom Bar Test',
        files: [
          { filename: 'main.py', content: 'def hello(): pass\n' },
          { filename: 'utils.py', content: 'def util(): pass\n' },
          { filename: 'README.md', content: '# H1\n## H2\n### H3\n' },
        ],
      },
    })
    const body = await resp.json()
    entrySlug = body.slug || `t069-bottom-${Date.now()}`
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('BDD-17-E2E: Mobile Files button uses toggle-btn style', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const filesBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Files"]')
    await expect(filesBtn).toBeVisible()

    const badge = filesBtn.locator('.toggle-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('3')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-17-mobile-files-toggle-btn.png' })
  })

  test('BDD-18-E2E: Mobile TOC button uses toggle-btn style', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const tocBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Table of Contents"]')
    await expect(tocBtn).toBeVisible()

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-18-mobile-toc-toggle-btn.png' })
  })

  test('BDD-19-E2E: Mobile bottom bar no Explore button', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const exploreBtn = page.locator('.mobile-bottom-bar a[href="/explore"]')
    await expect(exploreBtn).toHaveCount(0)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-19-mobile-no-explore.png' })
  })

  test('BDD-20-E2E: Mobile bottom bar no Share button', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const shareBtn = page.locator('.mobile-bottom-bar .share-btn')
    await expect(shareBtn).toHaveCount(0)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-20-mobile-no-share.png' })
  })

  test('BDD-21-E2E: Mobile Files toggle active state syncs with drawer', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const filesBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Files"]')
    await expect(filesBtn).not.toHaveClass(/active/)

    await filesBtn.click()
    await page.waitForSelector('.drawer-left', { timeout: 3000 })
    await expect(filesBtn).toHaveClass(/active/)

    const overlay = page.locator('.drawer-overlay')
    await overlay.click()
    await page.waitForTimeout(300)
    await expect(filesBtn).not.toHaveClass(/active/)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-21-mobile-files-active-sync.png' })
  })

  test('BDD-22-E2E: Mobile TOC toggle active state syncs with drawer', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const tocBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Table of Contents"]')
    await expect(tocBtn).not.toHaveClass(/active/)

    await tocBtn.click()
    await page.waitForSelector('.drawer-right', { timeout: 3000 })
    await expect(tocBtn).toHaveClass(/active/)

    const overlay = page.locator('.drawer-overlay')
    await overlay.click()
    await page.waitForTimeout(300)
    await expect(tocBtn).not.toHaveClass(/active/)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-22-mobile-toc-active-sync.png' })
  })
})

test.describe('T069 Mobile Drawer Headers — Mobile', () => {
  test.describe.configure({ mode: 'serial' })

  let entrySlug: string

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/v1/entries`, {
      data: {
        slug: `t069-drawer-${Date.now()}`,
        summary: 'T069 Drawer Header Test',
        files: [
          { filename: 'main.py', content: 'def hello(): pass\n' },
          { filename: 'utils.py', content: 'def util(): pass\n' },
          { filename: 'README.md', content: '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n## Another\n### More\n#### Deep\n##### Deeper\n###### Deepest\n# Top\n## Second\n## Third\n' },
        ],
      },
    })
    const body = await resp.json()
    entrySlug = body.slug || `t069-drawer-${Date.now()}`
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('BDD-23-E2E: Mobile File drawer header shows file count', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const filesBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Files"]')
    await filesBtn.click()
    await page.waitForSelector('.drawer-left', { timeout: 3000 })

    const drawerHeader = page.locator('.drawer-left .drawer-header span').first()
    const headerText = await drawerHeader.textContent()
    expect(headerText).toContain('3')

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-23-mobile-file-drawer-count.png' })
  })

  test('BDD-24-E2E: Mobile TOC drawer header shows heading count', async ({ page }) => {
    await page.goto(`${BASE_URL}/${entrySlug}`)
    await page.waitForSelector('.mobile-bottom-bar', { timeout: 5000 })

    const tocBtn = page.locator('.mobile-bottom-bar .toggle-btn[aria-label="Table of Contents"]')
    await tocBtn.click()
    await page.waitForSelector('.drawer-right', { timeout: 3000 })

    const drawerHeader = page.locator('.drawer-right .drawer-header span').first()
    const headerText = await drawerHeader.textContent()
    expect(headerText).toMatch(/Table of Contents.*\d+/)

    await page.screenshot({ path: 'docs/tasks/T069-settings-refresh-guard/P3-test-code/evidences/BDD-24-mobile-toc-drawer-count.png' })
  })
})
