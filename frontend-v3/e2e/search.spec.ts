import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const DEBOUNCE_WAIT = 600

// -- helpers --

async function waitForContent(page: any, timeout = 30000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.entry-card, .empty, .loading, .user-not-found')
    return el !== null
  }, { timeout }).catch(() => true)
}

// -- safety --

test.beforeAll(async ({ request }) => {
  if (BASE_URL.includes(':8080') || BASE_URL.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${BASE_URL})`)
  }
  const resp = await request.get('/health')
  if (!resp.ok()) throw new Error(`Health check failed: ${resp.status()}`)
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

// ============================================================
// BDD 1-3: Basic search interactions
// ============================================================
test.describe('BDD 1-3: Basic search (debounce, Enter, Esc)', () => {

  test('BDD-1: debounce search updates URL after 300ms', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('/api/v1/entries', {
      data: {
        summary: `python web framework ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# python ${ts}` }],
      },
    })

    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator('.search-input').fill('python')
    await page.waitForTimeout(DEBOUNCE_WAIT)

    await expect(page).toHaveURL(/\/explore\?q=python/)
    await expect(page.locator('.search-input')).toHaveValue('python')
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd01-debounce.png' })
  })

  test('BDD-2: Enter triggers search immediately', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('/api/v1/entries', {
      data: {
        summary: `react hooks guide ${ts}`,
        is_public: true,
        files: [{ filename: 'guide.md', content: `# react ${ts}` }],
      },
    })

    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator('.search-input').fill('react')
    await page.locator('.search-input').press('Enter')

    await expect(page).toHaveURL(/\/explore\?q=react/)
    await expect(page.locator('.search-input')).toHaveValue('react')
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd02-enter.png' })
  })

  test('BDD-3: Esc clears search and removes ?q= from URL', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('/api/v1/entries', {
      data: {
        summary: `keyword match ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# keyword ${ts}` }],
      },
    })

    await page.goto(`${BASE_URL}/explore?q=keyword`)
    await waitForContent(page)
    await expect(page.locator('.search-input')).toHaveValue('keyword')

    await page.locator('.search-input').press('Escape')

    await expect(page.locator('.search-input')).toHaveValue('')
    await expect(page).toHaveURL(/\/explore$/)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd03-esc.png' })
  })
})

// ============================================================
// BDD 4-6: Search + Tab coexistence
// ============================================================
test.describe('BDD 4-6: Search + Tab coexistence', () => {

  test('BDD-4: search first, then click Mine tab preserves q', async ({ page, request }) => {
    const ts = Date.now()
    const username = `bdd4_${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    // user has an entry matching the search term
    await request.post('/api/v1/entries', {
      data: {
        summary: `flask tutorial ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# flask ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // search "flask"
    await page.locator('.search-input').fill('flask')
    await page.waitForTimeout(DEBOUNCE_WAIT)
    await expect(page).toHaveURL(/\/explore\?q=flask/)

    // click Mine tab
    await page.locator('.owner-tab').last().click()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/explore\?q=flask&owner=me/)
    await expect(page.locator('.search-input')).toHaveValue('flask')
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd04-search-then-mine.png' })
  })

  test('BDD-5: Mine tab first, then search retains owner', async ({ page, request }) => {
    const ts = Date.now()
    const username = `bdd5_${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    await request.post('/api/v1/entries', {
      data: {
        summary: `test config ${ts}`,
        is_public: true,
        files: [{ filename: 'cfg.md', content: `# test ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore?owner=me`)
    await waitForContent(page)
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)

    // search "test"
    await page.locator('.search-input').fill('test')
    await page.waitForTimeout(DEBOUNCE_WAIT)

    await expect(page).toHaveURL(/\/explore\?q=test&owner=me/)
    await expect(page.locator('.search-input')).toHaveValue('test')
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd05-mine-then-search.png' })
  })

  test('BDD-6: Esc clears search but retains owner tab', async ({ page, request }) => {
    const ts = Date.now()
    const username = `bdd6_${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    await request.post('/api/v1/entries', {
      data: {
        summary: `test cleanup ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# test ${ts}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore?q=test&owner=me`)
    await waitForContent(page)
    await expect(page.locator('.search-input')).toHaveValue('test')
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)

    await page.locator('.search-input').press('Escape')

    await expect(page.locator('.search-input')).toHaveValue('')
    await expect(page).toHaveURL(/\/explore\?owner=me$/)
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd06-esc-retains-owner.png' })
  })
})

// ============================================================
// BDD 7: Search + Pagination
// ============================================================
test.describe('BDD 7: Search + Pagination', () => {

  test('BDD-7: /explore?q=demo&page=2 loads correct page', async ({ page, request }) => {
    const uniqueTerm = `demop7x${Date.now()}`
    const count = 22

    for (let i = 0; i < count; i++) {
      await request.post('/api/v1/entries', {
        data: {
          summary: `${uniqueTerm} entry ${i}`,
          is_public: true,
          files: [{ filename: 'readme.md', content: `# ${uniqueTerm} ${i}` }],
        },
      })
    }

    await page.goto(`${BASE_URL}/explore?q=${uniqueTerm}&page=2`)
    await waitForContent(page)

    await expect(page.locator('.search-input')).toHaveValue(uniqueTerm)
    await expect(page).toHaveURL(new RegExp(`/explore\\?q=${uniqueTerm}&page=2`))
    await expect(page.locator('.entry-card').count()).toBeGreaterThanOrEqual(1)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd07-pagination.png' })
  })
})

// ============================================================
// BDD 8-10: URL-driven search and edge cases
// ============================================================
test.describe('BDD 8-10: URL-driven search', () => {

  test('BDD-8: direct /explore?q=hello auto-fills input and shows results', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('/api/v1/entries', {
      data: {
        summary: `hello world app ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# hello ${ts}` }],
      },
    })

    await page.goto(`${BASE_URL}/explore?q=hello`)
    await waitForContent(page)

    await expect(page.locator('.search-input')).toHaveValue('hello')
    await expect(page.locator('.entry-card').count()).toBeGreaterThanOrEqual(1)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd08-direct-url.png' })
  })

  test('BDD-9: /users/:username?q= searches user entries', async ({ page, request }) => {
    const ts = Date.now()
    const username = `alice_srch_${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    const uniqueTerm = `notesx9${ts}`
    await request.post('/api/v1/entries', {
      data: {
        summary: `${uniqueTerm} planning`,
        is_public: true,
        files: [{ filename: 'notes.md', content: `# ${uniqueTerm}` }],
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    await page.context().clearCookies()
    await page.goto(`${BASE_URL}/users/${username}?q=${uniqueTerm}`)
    await waitForContent(page)

    await expect(page.locator('.search-input')).toHaveValue(uniqueTerm)
    await expect(page.locator('.entry-card').count()).toBeGreaterThanOrEqual(1)
    await expect(page.locator('.banner-bar')).toBeVisible()
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd09-user-search.png' })
  })

  test('BDD-10: empty search results show "No entries found"', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore?q=NoResultsXYZZY987654`)
    await waitForContent(page)

    await expect(page.locator('.search-input')).toHaveValue('NoResultsXYZZY987654')
    await expect(page.locator('.empty')).toContainText('No entries found')
    await expect(page.locator('.entry-card')).toHaveCount(0)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd10-empty-results.png' })
  })
})

// ============================================================
// BDD 11: Browser back/forward
// ============================================================
test.describe('BDD 11: Browser back', () => {

  test('BDD-11: browser back returns to search state, not landing', async ({ page, request }) => {
    const ts = Date.now()
    const createResp = await request.post('/api/v1/entries', {
      data: {
        summary: `python browser back ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# python ${ts}` }],
      },
    })
    const entry = await createResp.json()

    // start at landing
    await page.goto(`${BASE_URL}/`)
    await page.waitForTimeout(300)

    // nav to explore
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    // search "python" (router.replace)
    await page.locator('.search-input').fill('python')
    await page.waitForTimeout(DEBOUNCE_WAIT)
    await expect(page).toHaveURL(/\/explore\?q=python/)

    // click entry → detail (router.push)
    await page.locator('.entry-card').first().click()
    await page.waitForTimeout(800)
    await expect(page).toHaveURL(new RegExp(`/${entry.slug}`))

    // browser back
    await page.goBack()
    await page.waitForTimeout(500)

    await expect(page).toHaveURL(/\/explore\?q=python/)
    await expect(page.locator('.search-input')).toHaveValue('python')
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd11-back.png' })
  })
})

// ============================================================
// BDD 12: Search change resets pagination
// ============================================================
test.describe('BDD 12: Search change resets pagination', () => {

  test('BDD-12: changing search word resets page to 1', async ({ page, request }) => {
    const uniqueTerm = `demox2r${Date.now()}`
    const otherTerm = `otherx2r${Date.now()}`
    const count = 42 // need 3 pages (perPage=20)

    for (let i = 0; i < count; i++) {
      await request.post('/api/v1/entries', {
        data: {
          summary: `${uniqueTerm} batch ${i}`,
          is_public: true,
          files: [{ filename: 'readme.md', content: `# ${uniqueTerm} ${i}` }],
        },
      })
    }
    // also create entries for the "other" term so search shows results
    for (let i = 0; i < 3; i++) {
      await request.post('/api/v1/entries', {
        data: {
          summary: `${otherTerm} entry ${i}`,
          is_public: true,
          files: [{ filename: 'readme.md', content: `# ${otherTerm} ${i}` }],
        },
      })
    }

    // navigate to page 3 of demo search
    await page.goto(`${BASE_URL}/explore?q=${uniqueTerm}&page=3`)
    await waitForContent(page)
    await expect(page).toHaveURL(new RegExp(`/explore\\?q=${uniqueTerm}&page=3`))

    // change search term
    await page.locator('.search-input').fill(otherTerm)
    await page.locator('.search-input').press('Enter')

    await expect(page).toHaveURL(new RegExp(`/explore\\?q=${otherTerm}$`))
    await expect(page.locator('.search-input')).toHaveValue(otherTerm)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd12-page-reset.png' })
  })
})

// ============================================================
// BDD 13: Empty input removes ?q=
// ============================================================
test.describe('BDD 13: Empty input cleanup', () => {

  test('BDD-13: clearing input removes ?q= from URL', async ({ page, request }) => {
    const ts = Date.now()
    await request.post('/api/v1/entries', {
      data: {
        summary: `python cleanup ${ts}`,
        is_public: true,
        files: [{ filename: 'readme.md', content: `# python ${ts}` }],
      },
    })

    await page.goto(`${BASE_URL}/explore?q=python`)
    await waitForContent(page)
    await expect(page.locator('.search-input')).toHaveValue('python')

    // clear input → triggers @input → debounce → flushSearch with empty q
    await page.locator('.search-input').fill('')
    await page.waitForTimeout(DEBOUNCE_WAIT)

    await expect(page.locator('.search-input')).toHaveValue('')
    await expect(page).toHaveURL(/\/explore$/)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd13-empty-cleanup.png' })
  })
})

// ============================================================
// BDD 14: q + owner + page three-param combo
// ============================================================
test.describe('BDD 14: Three-param combo', () => {

  test('BDD-14: /explore?q=code&owner=me&page=2 works correctly', async ({ page, request }) => {
    const ts = Date.now()
    const username = `bdd14_${ts}`
    const uniqueTerm = `codex9p${ts}`

    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()

    // create 22 entries owned by user matching uniqueTerm (need 2 pages)
    for (let i = 0; i < 22; i++) {
      await request.post('/api/v1/entries', {
        data: {
          summary: `${uniqueTerm} owned ${i}`,
          is_public: true,
          files: [{ filename: 'readme.md', content: `# ${uniqueTerm} ${i}` }],
        },
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    const url = new URL(BASE_URL)
    await page.context().addCookies([{
      name: 'peekview_token', value: token, domain: url.hostname,
      path: '/', httpOnly: true, sameSite: 'Lax' as const,
    }])
    await page.goto(`${BASE_URL}/explore?q=${uniqueTerm}&owner=me&page=2`)
    await waitForContent(page)

    await expect(page.locator('.search-input')).toHaveValue(uniqueTerm)
    await expect(page.locator('.owner-tab').last()).toHaveClass(/active/)
    await expect(page).toHaveURL(new RegExp(`/explore\\?q=${uniqueTerm}\\S*owner=me\\S*page=2`))
    await expect(page.locator('.entry-card').count()).toBeGreaterThanOrEqual(1)
    await page.screenshot({ path: '/tmp/e2e-results/t026-bdd14-combo.png' })
  })
})

// ============================================================
// Bonus: Accessibility (aria-label)
// ============================================================
test.describe('Accessibility', () => {

  test('search input has aria-label', async ({ page }) => {
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const input = page.locator('.search-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('aria-label', 'Search entries')
  })
})
