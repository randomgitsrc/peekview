import { chromium, type Page } from 'playwright'

const BASE = 'http://127.0.0.1:8888'
const CDP_URL = 'http://localhost:18800'
const SCREENSHOT_DIR = '/home/kity/oclab/peekview/docs/tasks/T039-explore-ui-polish/P6-evidence/screenshots'

const hardTimer = setTimeout(() => {
  console.error('Hard timer: 120s exceeded, forcing exit')
  process.exit(1)
}, 120_000)

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL)
  const contexts = browser.contexts()
  const context = contexts[0] || await browser.newContext()
  const page = await context.newPage()

  try {
    // ── Setup: register + login + create test entries ──
    console.log('=== Setup: register user and create test entries ===')

    // Register a test user
    const regRes = await page.request.post(`${BASE}/api/v1/auth/register`, {
      data: { username: 't039owner', password: 'TestPass123!', display_name: 'T039 Owner' },
    })
    console.log(`Register status: ${regRes.status()}`)
    const regBody = await regRes.json()
    console.log(`User ID: ${regBody.user?.id}`)

    // Create public entry with 5 tags
    const pubRes = await page.request.post(`${BASE}/api/v1/entries`, {
      data: {
        summary: 'T039 Public Entry with 5 tags',
        is_public: true,
        tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        files: [{ filename: 'readme.md', content: '# Test public entry' }],
      },
    })
    console.log(`Create public entry status: ${pubRes.status()}`)
    const pubBody = await pubRes.json()
    const pubSlug = pubBody.slug
    console.log(`Public entry slug: ${pubSlug}`)

    // Create private entry with 5 tags
    const privRes = await page.request.post(`${BASE}/api/v1/entries`, {
      data: {
        summary: 'T039 Private Entry with 5 tags',
        is_public: false,
        tags: ['foo', 'bar', 'baz', 'qux', 'quux'],
        files: [{ filename: 'secret.md', content: '# Private content' }],
      },
    })
    console.log(`Create private entry status: ${privRes.status()}`)
    const privBody = await privRes.json()
    const privSlug = privBody.slug
    console.log(`Private entry slug: ${privSlug}`)

    // Create entry with 0 tags
    const noTagRes = await page.request.post(`${BASE}/api/v1/entries`, {
      data: {
        summary: 'T039 No Tags Entry',
        is_public: true,
        tags: [],
        files: [{ filename: 'empty.md', content: '# No tags' }],
      },
    })
    console.log(`Create no-tag entry status: ${noTagRes.status()}`)
    const noTagBody = await noTagRes.json()
    const noTagSlug = noTagBody.slug
    console.log(`No-tag entry slug: ${noTagSlug}`)

    // ── BDD R1.1: Owner sees badge on EntryCard ──
    console.log('\n=== BDD R1.1: Owner sees Public/Private badge on EntryCard ===')
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Ensure grid view (card mode)
    const gridBtn = page.locator('.view-toggle-btn[title="Grid view"]')
    if (await gridBtn.isVisible()) {
      await gridBtn.click()
      await page.waitForTimeout(500)
    }

    // Check badge exists on card for public entry (owner is logged in)
    const cardBadges = page.locator('.entry-card .card-footer .base-badge')
    const cardBadgeCount = await cardBadges.count()
    console.log(`R1.1: Card badge count (owner logged in): ${cardBadgeCount}`)
    const r11Pass = cardBadgeCount > 0
    console.log(`R1.1: ${r11Pass ? 'PASS' : 'FAIL'} — Owner sees badge on EntryCard`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R1.1-owner-card-badge.png`, fullPage: true })

    // ── BDD R1.2: Non-owner (anonymous) sees no badge on EntryCard ──
    console.log('\n=== BDD R1.2: Non-owner sees no badge on EntryCard ===')

    // Logout
    const logoutBtn = page.locator('.dropdown-item:has-text("Logout")')
    const userMenuTrigger = page.locator('.user-menu-trigger')
    if (await userMenuTrigger.isVisible()) {
      await userMenuTrigger.click()
      await page.waitForTimeout(300)
    }
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForTimeout(1000)
    }

    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Ensure grid view
    const gridBtn2 = page.locator('.view-toggle-btn[title="Grid view"]')
    if (await gridBtn2.isVisible()) {
      await gridBtn2.click()
      await page.waitForTimeout(500)
    }

    const anonCardBadges = page.locator('.entry-card .card-footer .base-badge')
    const anonCardBadgeCount = await anonCardBadges.count()
    console.log(`R1.2: Card badge count (anonymous): ${anonCardBadgeCount}`)
    const r12Pass = anonCardBadgeCount === 0
    console.log(`R1.2: ${r12Pass ? 'PASS' : 'FAIL'} — Non-owner sees no badge on EntryCard`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R1.2-anon-card-no-badge.png`, fullPage: true })

    // ── BDD R1.3: Owner sees badge on EntryListRow ──
    console.log('\n=== BDD R1.3: Owner sees badge on EntryListRow ===')

    // Re-login
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // Click Login button
    const loginBtn = page.locator('button:has-text("Login")')
    if (await loginBtn.isVisible()) {
      await loginBtn.click()
      await page.waitForTimeout(500)

      // Fill login form
      await page.locator('input[placeholder*="username" i], input[type="text"]').first().fill('t039owner')
      await page.locator('input[type="password"]').first().fill('TestPass123!')
      await page.locator('button[type="submit"]:has-text("Login"), button:has-text("Login")').last().click()
      await page.waitForTimeout(1500)
    }

    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Switch to list view
    const listBtn = page.locator('.view-toggle-btn[title="List view"]')
    if (await listBtn.isVisible()) {
      await listBtn.click()
      await page.waitForTimeout(500)
    }

    const listRowBadges = page.locator('.entry-list-row .base-badge')
    const listRowBadgeCount = await listRowBadges.count()
    console.log(`R1.3: ListRow badge count (owner logged in): ${listRowBadgeCount}`)
    const r13Pass = listRowBadgeCount > 0
    console.log(`R1.3: ${r13Pass ? 'PASS' : 'FAIL'} — Owner sees badge on EntryListRow`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R1.3-owner-listrow-badge.png`, fullPage: true })

    // ── BDD R1.4: Non-owner sees no badge on EntryListRow ──
    console.log('\n=== BDD R1.4: Non-owner sees no badge on EntryListRow ===')

    // Logout again
    const userMenuTrigger2 = page.locator('.user-menu-trigger')
    if (await userMenuTrigger2.isVisible()) {
      await userMenuTrigger2.click()
      await page.waitForTimeout(300)
      const logoutBtn2 = page.locator('.dropdown-item:has-text("Logout")')
      if (await logoutBtn2.isVisible()) {
        await logoutBtn2.click()
        await page.waitForTimeout(1000)
      }
    }

    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Switch to list view
    const listBtn2 = page.locator('.view-toggle-btn[title="List view"]')
    if (await listBtn2.isVisible()) {
      await listBtn2.click()
      await page.waitForTimeout(500)
    }

    const anonListRowBadges = page.locator('.entry-list-row .base-badge')
    const anonListRowBadgeCount = await anonListRowBadges.count()
    console.log(`R1.4: ListRow badge count (anonymous): ${anonListRowBadgeCount}`)
    const r14Pass = anonListRowBadgeCount === 0
    console.log(`R1.4: ${r14Pass ? 'PASS' : 'FAIL'} — Non-owner sees no badge on EntryListRow`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R1.4-anon-listrow-no-badge.png`, fullPage: true })

    // ── BDD R2.1: No .entry-summary element in list mode ──
    console.log('\n=== BDD R2.1: No .entry-summary element in list mode ===')

    // Already on explore in list view (anonymous)
    const summaryElements = page.locator('.entry-summary')
    const summaryCount = await summaryElements.count()
    console.log(`R2.1: .entry-summary element count: ${summaryCount}`)
    const r21Pass = summaryCount === 0
    console.log(`R2.1: ${r21Pass ? 'PASS' : 'FAIL'} — No .entry-summary element in list mode`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R2.1-no-summary-element.png`, fullPage: true })

    // ── BDD R2.2: Title row shows summary content ──
    console.log('\n=== BDD R2.2: Title row shows summary content ===')

    const titleElements = page.locator('.entry-list-row .entry-title')
    const titleCount = await titleElements.count()
    let r22Pass = false
    if (titleCount > 0) {
      const firstTitle = await titleElements.first().textContent()
      console.log(`R2.2: First list row title: "${firstTitle}"`)
      r22Pass = firstTitle !== null && firstTitle.trim().length > 0
    }
    console.log(`R2.2: ${r22Pass ? 'PASS' : 'FAIL'} — Title row shows summary content`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R2.2-title-shows-summary.png`, fullPage: true })

    // ── BDD R3.1: Card mode shows 3 tags + "+2" overflow ──
    console.log('\n=== BDD R3.1: Card mode shows 3 tags + "+2" overflow ===')

    // Switch to grid (card) view
    const gridBtn3 = page.locator('.view-toggle-btn[title="Grid view"]')
    if (await gridBtn3.isVisible()) {
      await gridBtn3.click()
      await page.waitForTimeout(500)
    }

    // Find the first card that has tags (the public entry with 5 tags)
    const cardTags = page.locator('.entry-card .card-tags')
    let r31Pass = false
    const cardTagCount = await cardTags.count()
    if (cardTagCount > 0) {
      // Count BaseTag elements and overflow in the first card with tags
      const firstCardWithTags = cardTags.first()
      const tagElements = firstCardWithTags.locator('.base-tag')
      const tagCount = await tagElements.count()
      const overflowEl = firstCardWithTags.locator('.tag-overflow')
      const overflowVisible = await overflowEl.isVisible()
      const overflowText = overflowVisible ? await overflowEl.textContent() : null
      console.log(`R3.1: Card tag count: ${tagCount}, overflow visible: ${overflowVisible}, text: "${overflowText}"`)
      r31Pass = tagCount === 3 && overflowVisible && overflowText === '+2'
    }
    console.log(`R3.1: ${r31Pass ? 'PASS' : 'FAIL'} — Card mode shows 3 tags + "+2"`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R3.1-card-3-tags-overflow.png`, fullPage: true })

    // ── BDD R3.2: List mode shows all 5 tags, no overflow ──
    console.log('\n=== BDD R3.2: List mode shows all 5 tags, no overflow ===')

    // Switch to list view
    const listBtn3 = page.locator('.view-toggle-btn[title="List view"]')
    if (await listBtn3.isVisible()) {
      await listBtn3.click()
      await page.waitForTimeout(500)
    }

    const listTagRows = page.locator('.entry-list-row .entry-tags-row')
    let r32Pass = false
    const listTagRowCount = await listTagRows.count()
    if (listTagRowCount > 0) {
      // Find the row for the public entry with 5 tags
      for (let i = 0; i < listTagRowCount; i++) {
        const row = listTagRows.nth(i)
        const tags = row.locator('.base-tag')
        const tagCount = await tags.count()
        const overflow = row.locator('.tag-overflow')
        const overflowVisible = await overflow.isVisible()
        if (tagCount >= 5) {
          console.log(`R3.2: List row ${i} tag count: ${tagCount}, overflow visible: ${overflowVisible}`)
          r32Pass = tagCount === 5 && !overflowVisible
          break
        }
      }
    }
    console.log(`R3.2: ${r32Pass ? 'PASS' : 'FAIL'} — List mode shows all 5 tags, no overflow`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R3.2-list-all-5-tags.png`, fullPage: true })

    // ── BDD R3.3: Detail page shows all 5 tags, no overflow ──
    console.log('\n=== BDD R3.3: Detail page shows all 5 tags, no overflow ===')

    // Navigate to the public entry detail page
    await page.goto(`${BASE}/${pubSlug}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    const headerTags = page.locator('.header-tags')
    let r33Pass = false
    if (await headerTags.isVisible()) {
      const detailTags = headerTags.locator('.base-tag')
      const detailTagCount = await detailTags.count()
      const detailOverflow = headerTags.locator('.tag-overflow')
      const detailOverflowVisible = await detailOverflow.isVisible()
      console.log(`R3.3: Detail page tag count: ${detailTagCount}, overflow visible: ${detailOverflowVisible}`)
      r33Pass = detailTagCount === 5 && !detailOverflowVisible
    }
    console.log(`R3.3: ${r33Pass ? 'PASS' : 'FAIL'} — Detail page shows all 5 tags, no overflow`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R3.3-detail-all-5-tags.png`, fullPage: true })

    // ── BDD R3.4: 0 tags → no tag area rendered ──
    console.log('\n=== BDD R3.4: 0 tags → no tag area rendered ===')

    // Navigate to the no-tag entry detail page
    await page.goto(`${BASE}/${noTagSlug}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    const noTagHeader = page.locator('.header-tags')
    const noTagHeaderVisible = await noTagHeader.isVisible()
    console.log(`R3.4: Detail page header-tags visible (0 tags): ${noTagHeaderVisible}`)

    // Also check on explore page in card mode
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Switch to grid view
    const gridBtn4 = page.locator('.view-toggle-btn[title="Grid view"]')
    if (await gridBtn4.isVisible()) {
      await gridBtn4.click()
      await page.waitForTimeout(500)
    }

    // Check that the no-tag entry card has no .card-tags
    const allCards = page.locator('.entry-card')
    let cardNoTagPass = true
    const cardCount = await allCards.count()
    for (let i = 0; i < cardCount; i++) {
      const card = allCards.nth(i)
      const cardTitle = await card.locator('.card-title').textContent()
      if (cardTitle?.includes('No Tags')) {
        const cardTagsEl = card.locator('.card-tags')
        const cardTagsVisible = await cardTagsEl.isVisible()
        console.log(`R3.4: No-tag card .card-tags visible: ${cardTagsVisible}`)
        cardNoTagPass = !cardTagsVisible
        break
      }
    }

    const r34Pass = !noTagHeaderVisible && cardNoTagPass
    console.log(`R3.4: ${r34Pass ? 'PASS' : 'FAIL'} — 0 tags → no tag area rendered`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/R3.4-no-tags-no-area.png`, fullPage: true })

    // ── Summary ──
    console.log('\n=== BDD Verification Summary ===')
    const results = [
      { id: 'R1.1', pass: r11Pass, desc: 'Owner sees badge on EntryCard' },
      { id: 'R1.2', pass: r12Pass, desc: 'Non-owner sees no badge on EntryCard' },
      { id: 'R1.3', pass: r13Pass, desc: 'Owner sees badge on EntryListRow' },
      { id: 'R1.4', pass: r14Pass, desc: 'Non-owner sees no badge on EntryListRow' },
      { id: 'R2.1', pass: r21Pass, desc: 'No .entry-summary element in list mode' },
      { id: 'R2.2', pass: r22Pass, desc: 'Title row shows summary content' },
      { id: 'R3.1', pass: r31Pass, desc: 'Card mode shows 3 tags + "+2" overflow' },
      { id: 'R3.2', pass: r32Pass, desc: 'List mode shows all 5 tags, no overflow' },
      { id: 'R3.3', pass: r33Pass, desc: 'Detail page shows all 5 tags, no overflow' },
      { id: 'R3.4', pass: r34Pass, desc: '0 tags → no tag area rendered' },
    ]

    for (const r of results) {
      console.log(`- ${r.pass ? 'PASS' : 'FAIL'} ${r.id}: ${r.desc}`)
    }

    const passCount = results.filter(r => r.pass).length
    console.log(`\nTotal: ${passCount}/${results.length} passed`)

  } finally {
    await page.close()
    clearTimeout(hardTimer)
    process.exit(0)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  clearTimeout(hardTimer)
  process.exit(1)
})
