import { chromium, Page, Browser } from 'playwright'

const BASE = 'http://127.0.0.1:8888'
const EVIDENCES = 'docs/tasks/T031-cold-open-performance/evidences'

let browser: Browser
let page: Page
let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  PASS: ${name}`)
    passed++
  } else {
    console.log(`  FAIL: ${name}`)
    failed++
  }
}

async function run() {
  browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const context = browser.contexts()[0] || await browser.newContext()
  page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })

  try {
    console.log('\n=== E2E-1: BDD-2 card title is <a> with href ===')
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.entry-card, .entry-list-row', { timeout: 10000 })
    const cardBodyTag = await page.$eval('.card-body', el => el.tagName.toLowerCase()).catch(() => 'NOT_FOUND')
    const cardHref = await page.$eval('.card-body', el => el.getAttribute('href')).catch(() => null)
    assert(cardBodyTag === 'a', `card-body is <a> (got: ${cardBodyTag})`)
    assert(!!cardHref && cardHref.startsWith('/'), `card-body has href (got: ${cardHref})`)

    console.log('\n=== E2E-2: BDD-2 right-click shows link context menu ===')
    const hasRoleButton = await page.$eval('.card-body', el => el.getAttribute('role')).catch(() => null)
    assert(hasRoleButton !== 'button', `card-body does NOT have role="button" (got: ${hasRoleButton})`)

    console.log('\n=== E2E-3: BDD-6 skeleton during loading ===')
    await page.goto(`${BASE}/explore`, { waitUntil: 'commit' })
    const hasSkeleton = await page.$('[class*="skeleton"]').catch(() => null)
    const hasLoadingText = await page.$eval('.loading-state', el => el.textContent).catch(() => null)
    assert(!!hasSkeleton, 'skeleton element exists during loading')
    assert(hasLoadingText === null || !hasLoadingText.includes('Loading...'), 'no "Loading..." text during loading')

    console.log('\n=== E2E-4: BDD-7 toggle button does not navigate ===')
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.entry-card', { timeout: 10000 })
    const urlBefore = page.url()
    const toggleBtn = await page.$('.card-action-btn')
    if (toggleBtn) {
      await toggleBtn.click()
      await page.waitForTimeout(500)
      const urlAfter = page.url()
      assert(urlBefore === urlAfter, `URL unchanged after toggle click (${urlBefore} === ${urlAfter})`)
    } else {
      console.log('  SKIP: no toggle button visible (not logged in as owner)')
    }

    console.log('\n=== E2E-5: BDD-1 parallel requests ===')
    const requests: string[] = []
    page.on('request', req => {
      if (req.url().includes('/api/v1/entries/')) requests.push(req.url())
    })
    const firstCard = await page.$('.card-body')
    if (firstCard) {
      const href = await firstCard.getAttribute('href')
      if (href) {
        requests.length = 0
        await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
        const entryReqs = requests.filter(u => !u.includes('/files/'))
        const fileReqs = requests.filter(u => u.includes('/files/'))
        assert(entryReqs.length >= 1 && fileReqs.length >= 1,
          `both entry and file requests made (entry: ${entryReqs.length}, file: ${fileReqs.length})`)
      }
    }

    console.log('\n=== E2E-6: BDD-3 separator rendering ===')
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.meta-sep', { timeout: 10000 })
    const sepFont = await page.$eval('.meta-sep', el => window.getComputedStyle(el).fontFamily).catch(() => '')
    const hasUiFont = sepFont.includes('Inter') || sepFont.includes('sans-serif') || sepFont.includes('system-ui')
    assert(hasUiFont, `meta-sep uses UI font (got: ${sepFont})`)
    await page.screenshot({ path: `${EVIDENCES}/t031-separator-desktop_1280x800.png` })

    console.log('\n=== E2E-7: BDD-4 search placeholder is English ===')
    const placeholder = await page.$eval('input[placeholder]', el => el.getAttribute('placeholder')).catch(() => '')
    assert(!placeholder.includes('搜索'), `placeholder is not Chinese (got: ${placeholder})`)
    assert(placeholder.toLowerCase().includes('search'), `placeholder contains "search" (got: ${placeholder})`)

    console.log('\n=== E2E-8: BDD-5 landing button text ===')
    await page.goto(BASE, { waitUntil: 'networkidle' })
    const btnTexts = await page.$$eval('a.btn-primary', els => els.map(el => el.textContent?.trim()))
    const hasExplore = btnTexts.some(t => t === 'Explore')
    const hasBrowsePublic = btnTexts.some(t => t === 'Browse public')
    assert(!hasExplore, `no button says "Explore" (got: ${JSON.stringify(btnTexts)})`)
    assert(hasBrowsePublic, `button says "Browse public" (got: ${JSON.stringify(btnTexts)})`)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE}/explore`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${EVIDENCES}/t031-explore-mobile_390x844.png` })

  } finally {
    await page.close()
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('E2E error:', err.message)
  process.exit(1)
})
