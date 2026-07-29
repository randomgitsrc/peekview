import { test, expect, type Page, type Request } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const SHOT_DIR = '/tmp/e2e-results'

async function waitForContent(page: Page, timeout = 30000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.entry-card, .entry-list-row, .empty, .loading')
    return el !== null
  }, { timeout }).catch(() => true)
}

async function seedEntry(
  request: Request,
  opts: { summary: string; tags: string[]; token?: string },
) {
  const resp = await request.post('/api/v1/entries', {
    data: {
      summary: opts.summary,
      is_public: true,
      tags: opts.tags,
      files: [{ filename: 'readme.md', content: `# ${opts.summary}` }],
    },
    headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
  })
  expect(resp.status()).toBe(201)
  return resp.json()
}

async function textDecoration(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().evaluate((el) => {
    const s = window.getComputedStyle(el as HTMLElement)
    return `${s.textDecorationLine} ${s.textDecoration}`
  })
}

async function cursorOf(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().evaluate((el) => {
    return window.getComputedStyle(el as HTMLElement).cursor
  })
}

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
// BDD 01-06: Card interaction semantics (grid view)
// ============================================================
test.describe('BDD 01-06: card interaction semantics', () => {
  test('BDD-01: hovering title underlines only the title', async ({ page, request }) => {
    const ts = Date.now()
    await seedEntry(request, { summary: `underline title ${ts}`, tags: [`t076a${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator('.entry-card .card-title').first().hover()
    const titleDeco = await textDecoration(page, '.entry-card .card-title')
    expect(titleDeco).toContain('underline')

    const timeDeco = await textDecoration(page, '.entry-card .meta-time')
    expect(timeDeco).not.toContain('underline')
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd01-title-underline.png` })
  })

  test('BDD-02: clicking title navigates to entry detail (SPA)', async ({ page, request }) => {
    const ts = Date.now()
    const entry = await seedEntry(request, { summary: `nav detail ${ts}`, tags: [`t076b${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator('.entry-card .card-title').first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/${entry.slug}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd02-title-nav.png` })
  })

  test('BDD-03: clicking username navigates to user page', async ({ page, request }) => {
    const ts = Date.now()
    const username = `t076u${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    expect(regResp.status()).toBe(201)
    const { access_token: token } = await regResp.json()
    await seedEntry(request, { summary: `user nav ${ts}`, tags: [`t076c${ts}`], token })

    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)
    await page.locator(`.entry-card .meta-username:has-text("@${username}")`).first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/users/${username}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd03-username-nav.png` })
  })

  test('BDD-04: title exposes a real href for native copy-link', async ({ page, request }) => {
    const ts = Date.now()
    const entry = await seedEntry(request, { summary: `copy entry url ${ts}`, tags: [`t076d${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const href = await page.locator('.entry-card .card-title').first().getAttribute('href')
    expect(href).toContain(`/${entry.slug}`)
  })

  test('BDD-05: username exposes a real href for native copy-link', async ({ page, request }) => {
    const ts = Date.now()
    const username = `t076v${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    const { access_token: token } = await regResp.json()
    await seedEntry(request, { summary: `copy user url ${ts}`, tags: [`t076e${ts}`], token })

    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)
    const href = await page.locator(`.entry-card .meta-username:has-text("@${username}")`).first().getAttribute('href')
    expect(href).toContain(`/users/${username}`)
  })

  test('BDD-06: hovering non-link area shows no underline and default cursor', async ({ page, request }) => {
    const ts = Date.now()
    await seedEntry(request, { summary: `nonlink area ${ts}`, tags: [`t076f${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator('.entry-card .meta-time').first().hover()
    const deco = await textDecoration(page, '.entry-card .meta-time')
    expect(deco).not.toContain('underline')
    const cursor = await cursorOf(page, '.entry-card .meta-time')
    expect(cursor).toBe('default')
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd06-nonlink.png` })
  })
})

// ============================================================
// BDD 07-10: Tag interaction
// ============================================================
test.describe('BDD 07-10: tag interaction', () => {
  test('BDD-07: clicking a tag navigates to tag filter page', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `t076g${ts}`
    await seedEntry(request, { summary: `tag nav ${ts}`, tags: [tag] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    await page.locator(`.entry-card .base-tag:has-text("${tag}")`).first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/explore\\?tags=${tag}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd07-tag-nav.png` })
  })

  test('BDD-08: hovering a tag underlines it with pointer cursor', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `t076h${ts}`
    await seedEntry(request, { summary: `tag hover ${ts}`, tags: [tag] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const tagLoc = page.locator(`.entry-card .base-tag:has-text("${tag}")`).first()
    await tagLoc.hover()
    const deco = await textDecoration(page, `.entry-card .base-tag:has-text("${tag}")`)
    expect(deco).toContain('underline')
    const cursor = await cursorOf(page, `.entry-card .base-tag:has-text("${tag}")`)
    expect(cursor).toBe('pointer')
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd08-tag-hover.png` })
  })

  test('BDD-09: hovering tag-overflow shows all tags tooltip', async ({ page, request }) => {
    const ts = Date.now()
    const tags = [`p${ts}`, `q${ts}`, `r${ts}`, `s${ts}`, `t${ts}`]
    await seedEntry(request, { summary: `overflow tooltip ${ts}`, tags })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const overflow = page.locator('.entry-card .tag-overflow').first()
    await expect(overflow).toHaveText('+2')
    await overflow.hover()
    const content = await overflow.evaluate((el) => {
      return window.getComputedStyle(el as HTMLElement, '::after').content
    })
    expect(content).toContain(`p${ts}`)
    expect(content).toContain(`t${ts}`)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd09-overflow-tooltip.png` })
  })

  test('BDD-10: tapping tag-overflow reveals tooltip (mobile/touch)', async ({ page, request }) => {
    const ts = Date.now()
    const tags = [`m${ts}`, `n${ts}`, `o${ts}`, `x${ts}`, `y${ts}`]
    await seedEntry(request, { summary: `overflow tap ${ts}`, tags })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const overflow = page.locator('.entry-card .tag-overflow').first()
    await overflow.tap().catch(() => overflow.click())
    const focused = await overflow.evaluate((el) => document.activeElement === el)
    expect(focused).toBe(true)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd10-overflow-tap.png` })
  })
})

// ============================================================
// BDD 11-15: Explore page tag filtering
// ============================================================
test.describe('BDD 11-15: explore tag filtering', () => {
  test('BDD-11: URL ?tags= filters the list by tag', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `flt${ts}`
    await seedEntry(request, { summary: `filtered in ${ts}`, tags: [tag] })
    await seedEntry(request, { summary: `filtered out ${ts}`, tags: [`other${ts}`] })

    await page.goto(`${BASE_URL}/explore?tags=${tag}`)
    await waitForContent(page)

    await expect(page.locator(`.entry-card .base-tag:has-text("${tag}")`).first()).toBeVisible()
    await expect(page.locator(`.entry-card .base-tag:has-text("other${ts}")`)).toHaveCount(0)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd11-url-filter.png` })
  })

  test('BDD-12: tag filter shows a removable chip', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `chip${ts}`
    await seedEntry(request, { summary: `chip entry ${ts}`, tags: [tag] })

    await page.goto(`${BASE_URL}/explore?tags=${tag}`)
    await waitForContent(page)

    const chip = page.locator(`.filter-chip:has-text("${tag}")`)
    await expect(chip.first()).toBeVisible()
    await chip.first().locator('.filter-chip-dismiss').click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(/\/explore(?!\?tags=)/)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd12-chip-remove.png` })
  })

  test('BDD-13: multi-tag filter requires all tags', async ({ page, request }) => {
    const ts = Date.now()
    const tagA = `ma${ts}`
    const tagB = `mb${ts}`
    await seedEntry(request, { summary: `both tags ${ts}`, tags: [tagA, tagB] })
    await seedEntry(request, { summary: `only a ${ts}`, tags: [tagA] })

    await page.goto(`${BASE_URL}/explore?tags=${tagA},${tagB}`)
    await waitForContent(page)

    const cards = page.locator('.entry-card')
    const count = await cards.count()
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      await expect(card.locator(`.base-tag:has-text("${tagA}")`)).toHaveCount(1)
      await expect(card.locator(`.base-tag:has-text("${tagB}")`)).toHaveCount(1)
    }
    await expect(page.locator(`.entry-card:has-text("both tags ${ts}")`).first()).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd13-multi-tag.png` })
  })

  test('BDD-14: tag filter combines with search q', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `combo${ts}`
    const term = `zebra${ts}`
    await seedEntry(request, { summary: `${term} match`, tags: [tag] })
    await seedEntry(request, { summary: `${term} nomatch`, tags: [`no${ts}`] })

    await page.goto(`${BASE_URL}/explore?tags=${tag}&q=${term}`)
    await waitForContent(page)

    await expect(page.locator(`.entry-card:has-text("${term} match")`).first()).toBeVisible()
    await expect(page.locator(`.entry-card:has-text("${term} nomatch")`)).toHaveCount(0)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd14-tag-plus-q.png` })
  })

  test('BDD-15: tag filter survives page refresh', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `keep${ts}`
    await seedEntry(request, { summary: `persist filter ${ts}`, tags: [tag] })

    await page.goto(`${BASE_URL}/explore?tags=${tag}`)
    await waitForContent(page)
    await page.reload()
    await waitForContent(page)

    await expect(page).toHaveURL(new RegExp(`/explore\\?tags=${tag}`))
    await expect(page.locator(`.entry-card .base-tag:has-text("${tag}")`).first()).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd15-refresh.png` })
  })
})

// ============================================================
// BDD 16-19: EntryListRow (list view) parity
// ============================================================
test.describe('BDD 16-19: list view parity', () => {
  async function goToListView(page: Page) {
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)
    await page.locator('.view-toggle-btn', { hasText: /list/i }).last().click()
    await page.waitForTimeout(400)
  }

  test('BDD-16: list title click navigates to detail', async ({ page, request }) => {
    const ts = Date.now()
    const entry = await seedEntry(request, { summary: `list nav ${ts}`, tags: [`la${ts}`] })
    await goToListView(page)

    await page.locator('.entry-list-row .entry-title').first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/${entry.slug}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd16-list-title.png` })
  })

  test('BDD-17: list tag click navigates to filter page', async ({ page, request }) => {
    const ts = Date.now()
    const tag = `lb${ts}`
    await seedEntry(request, { summary: `list tag ${ts}`, tags: [tag] })
    await goToListView(page)

    await page.locator(`.entry-list-row .base-tag:has-text("${tag}")`).first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/explore\\?tags=${tag}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd17-list-tag.png` })
  })

  test('BDD-18: list username click navigates to user page', async ({ page, request }) => {
    const ts = Date.now()
    const username = `t076w${ts}`
    const regResp = await request.post('/api/v1/auth/register', {
      data: { username, password: 'pass12345' },
    })
    const { access_token: token } = await regResp.json()
    await seedEntry(request, { summary: `list user ${ts}`, tags: [`lc${ts}`], token })
    await goToListView(page)

    await page.locator(`.entry-list-row .meta-username:has-text("@${username}")`).first().click()
    await page.waitForTimeout(600)
    await expect(page).toHaveURL(new RegExp(`/users/${username}`))
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd18-list-user.png` })
  })

  test('BDD-19: list hover semantics match grid', async ({ page, request }) => {
    const ts = Date.now()
    await seedEntry(request, { summary: `list hover ${ts}`, tags: [`ld${ts}`] })
    await goToListView(page)

    await page.locator('.entry-list-row .meta-time').first().hover()
    const timeDeco = await textDecoration(page, '.entry-list-row .meta-time')
    expect(timeDeco).not.toContain('underline')

    await page.locator('.entry-list-row .entry-title').first().hover()
    const titleDeco = await textDecoration(page, '.entry-list-row .entry-title')
    expect(titleDeco).toContain('underline')
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd19-list-hover.png` })
  })
})

// ============================================================
// BDD 20-21: Accessibility + card hover highlight
// ============================================================
test.describe('BDD 20-21: a11y and card hover', () => {
  test('BDD-20: Tab focuses title/username/tag links with visible focus', async ({ page, request }) => {
    const ts = Date.now()
    await seedEntry(request, { summary: `focus targets ${ts}`, tags: [`fa${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const focusedTags: string[] = []
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return null
        return {
          tag: el.tagName.toLowerCase(),
          cls: el.className || '',
        }
      })
      if (info && info.tag === 'a' && /card-title|meta-username|base-tag/.test(info.cls)) {
        focusedTags.push(info.cls)
      }
    }
    expect(focusedTags.some((c) => c.includes('card-title'))).toBe(true)
    expect(focusedTags.some((c) => c.includes('meta-username'))).toBe(true)
    expect(focusedTags.some((c) => c.includes('base-tag'))).toBe(true)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd20-tab-focus.png` })
  })

  test('BDD-21: hovering the card highlights its border', async ({ page, request }) => {
    const ts = Date.now()
    await seedEntry(request, { summary: `card highlight ${ts}`, tags: [`ga${ts}`] })
    await page.goto(`${BASE_URL}/explore`)
    await waitForContent(page)

    const card = page.locator('.entry-card').first()
    const before = await card.evaluate((el) => window.getComputedStyle(el as HTMLElement).borderColor)
    await card.hover()
    const after = await card.evaluate((el) => window.getComputedStyle(el as HTMLElement).borderColor)
    expect(after).not.toBe(before)
    await page.screenshot({ path: `${SHOT_DIR}/t076-bdd21-card-hover.png` })
  })
})
