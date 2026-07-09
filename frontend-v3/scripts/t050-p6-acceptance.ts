/**
 * T050 P6 acceptance: verify that real-world error diagrams render
 * successfully in the debug backend with sanitize enabled.
 *
 * Uses Playwright CDP to connect to local Chrome (:18800) and load
 * each test entry page. Asserts that the diagram block does NOT show
 * the error UI ("Failed to render ...").
 *
 * Run from frontend-v3/:
 *   NODE_PATH=$(npm root -g) npx tsx scripts/t050-p6-acceptance.ts
 */

import { chromium, devices } from 'playwright-core'

const BASE = 'http://127.0.0.1:8888'
const CDP_URL = 'http://127.0.0.1:18800'

const slugs = [
  't050-p6-gitgraph',
  't050-p6-tbsubgraph',
  't050-p6-fullwidth',
  't050-p6-arrows',
  't050-p6-seq-fullwidth',
]

async function run() {
  const browser = await chromium.connectOverCDP(CDP_URL)
  // Use a fresh incognito context to avoid Chrome cache from previous runs
  const context = await browser.newContext({ bypassCSP: true })

  let pass = 0
  let fail = 0
  const failures: Array<{slug: string, reason: string, screenshot?: string}> = []

  for (const slug of slugs) {
    const page = await context.newPage()
    try {
      await page.setViewportSize({ width: 1200, height: 800 })
      await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle', timeout: 30000 })

      // Wait for mermaid to attempt rendering
      await page.waitForTimeout(2000)

      const errorVisible = await page.locator('.diagram-error').count()
      const diagramVisible = await page.locator('.diagram-viewer svg, .diagram-viewer .mermaid svg').count()

      const verdict = errorVisible === 0 && diagramVisible > 0 ? 'PASS' : 'FAIL'
      if (verdict === 'PASS') {
        pass++
        console.log(`PASS ${slug}: errors=${errorVisible}, diagram=${diagramVisible}`)
      } else {
        fail++
        const reason = `errors=${errorVisible}, diagrams=${diagramVisible}`
        const screenshot = `/tmp/t050-${slug}.png`
        await page.screenshot({ path: screenshot, fullPage: true })
        failures.push({ slug, reason, screenshot })
        console.log(`FAIL ${slug}: ${reason}`)
      }
    } catch (e) {
      fail++
      const reason = String(e).substring(0, 100)
      failures.push({ slug, reason })
      console.log(`FAIL ${slug}: ${reason}`)
    } finally {
      await page.close()
    }
  }

  // Mobile test: verify header wrap layout on a single entry
  const mobilePage = await context.newPage()
  try {
    await mobilePage.setViewportSize({ width: 390, height: 844 })
    await mobilePage.goto(`${BASE}/t050-p6-tbsubgraph`, { waitUntil: 'networkidle' })
    await mobilePage.waitForTimeout(1000)
    await mobilePage.screenshot({ path: '/tmp/t050-mobile-header.png', fullPage: false })
    const headerTagsHeight = await mobilePage.evaluate(() => {
      const el = document.querySelector('.header-tags') as HTMLElement | null
      return el ? el.getBoundingClientRect().width : 0
    })
    const titleGroupWidth = await mobilePage.evaluate(() => {
      const el = document.querySelector('.title-group') as HTMLElement | null
      return el ? el.getBoundingClientRect().width : 0
    })
    console.log(`Mobile header-tags width: ${headerTagsHeight}, title-group width: ${titleGroupWidth}`)
    if (titleGroupWidth > 200) {
      console.log(`PASS mobile layout: title-group has decent width`)
    } else {
      console.log(`WARN mobile layout: title-group too narrow`)
    }
  } catch (e) {
    console.log('FAIL mobile test:', String(e).substring(0, 100))
  } finally {
    await mobilePage.close()
  }

  await browser.close()

  console.log(`\n=== Result: ${pass} PASS, ${fail} FAIL ===`)
  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const f of failures) {
      console.log(`  ${f.slug}: ${f.reason}${f.screenshot ? ' screenshot=' + f.screenshot : ''}`)
    }
  }
  process.exit(fail === 0 ? 0 : 1)
}

run().catch(e => { console.error(e); process.exit(1) })