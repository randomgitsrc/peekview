import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const EVID = '/home/kity/oclab/peekview/agate-workspace/tasks/TPV0094-treeview-default-expand/P6-evidence'
const SHOTS = path.join(EVID, 'screenshots')
const LOG = path.join(EVID, 'test-output.log')
fs.mkdirSync(SHOTS, { recursive: true })

const BASE = 'http://127.0.0.1:8888'
const HARD = 180_000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)

const out: string[] = []
function log(...args: unknown[]) {
  const line = args.map(String).join(' ')
  out.push(line)
  console.log(line)
}

// 9-node small JSON, tree-node total = 9, branch nodes = 2 (tags[], meta{})
const SMALL_TOTAL = 9
const SMALL_BRANCH = 2

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  try {
    lastStep = 'setViewport'
    await page.setViewportSize({ width: 1280, height: 800 })

    // ---------- BDD-1: small JSON all expanded ----------
    lastStep = 'bdd1 goto'
    await page.goto(`${BASE}/t094-p6-json`, { timeout: 20000 })
    await page.waitForSelector('.tree-view', { timeout: 15000 })
    await page.waitForFunction(() => document.querySelectorAll('.tree-node').length >= 1, { timeout: 15000 })
    await page.waitForTimeout(300)
    const b1 = await page.evaluate(() => ({
      treeNodes: document.querySelectorAll('.tree-node').length,
      expandedTrue: document.querySelectorAll('.expand-toggle[aria-expanded="true"]').length,
      expandedFalse: document.querySelectorAll('.expand-toggle[aria-expanded="false"]').length,
      banner: !!document.querySelector('[data-testid="tree-collapse-banner"]'),
    }))
    log(`BDD1 treeNodes=${b1.treeNodes} expandedTrue=${b1.expandedTrue} expandedFalse=${b1.expandedFalse} banner=${b1.banner}`)
    const bdd1 = b1.treeNodes === SMALL_TOTAL && b1.expandedTrue === SMALL_BRANCH && b1.expandedFalse === 0
    log(`BDD1 ${bdd1 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd1-small-json-expanded.png'), fullPage: false })

    // ---------- BDD-2: small YAML + XML all expanded ----------
    const yamlResults: Record<string, unknown> = {}
    for (const fmt of ['yaml', 'xml'] as const) {
      lastStep = `bdd2 ${fmt} goto`
      await page.goto(`${BASE}/t094-p6-${fmt}`, { timeout: 20000 })
      await page.waitForSelector('.tree-view', { timeout: 15000 })
      await page.waitForTimeout(400)
      const r = await page.evaluate(() => ({
        treeNodes: document.querySelectorAll('.tree-node').length,
        expandedTrue: document.querySelectorAll('.expand-toggle[aria-expanded="true"]').length,
        expandedFalse: document.querySelectorAll('.expand-toggle[aria-expanded="false"]').length,
      }))
      yamlResults[fmt] = r
      log(`BDD2 ${fmt} treeNodes=${r.treeNodes} expandedTrue=${r.expandedTrue} expandedFalse=${r.expandedFalse}`)
      if (fmt === 'yaml') await page.screenshot({ path: path.join(SHOTS, 'bdd2-yaml-expanded.png') })
      else await page.screenshot({ path: path.join(SHOTS, 'bdd2-xml-expanded.png') })
    }
    const bdd2 = (yamlResults.yaml as { expandedFalse: number }).expandedFalse === 0 &&
      (yamlResults.xml as { expandedFalse: number }).expandedFalse === 0 &&
      (yamlResults.yaml as { treeNodes: number }).treeNodes > 1 &&
      (yamlResults.xml as { treeNodes: number }).treeNodes > 1
    log(`BDD2 ${bdd2 ? 'PASS' : 'FAIL'}`)

    // ---------- BDD-3: large JSON collapsed + banner ----------
    lastStep = 'bdd3 goto'
    await page.goto(`${BASE}/t094-p6-large`, { timeout: 30000 })
    await page.waitForSelector('.tree-view', { timeout: 20000 })
    await page.waitForTimeout(500)
    const b3 = await page.evaluate(() => ({
      treeNodes: document.querySelectorAll('.tree-node').length,
      banner: !!document.querySelector('[data-testid="tree-collapse-banner"]'),
      bannerText: document.querySelector('[data-testid="tree-collapse-banner"]')?.textContent?.trim() ?? '',
      bannerVisible: (() => { const el = document.querySelector('[data-testid="tree-collapse-banner"]') as HTMLElement | null; return el ? el.offsetParent !== null : false })(),
      expandedFalse: document.querySelectorAll('.expand-toggle[aria-expanded="false"]').length,
    }))
    log(`BDD3 treeNodes=${b3.treeNodes} banner=${b3.banner} bannerVisible=${b3.bannerVisible} text="${b3.bannerText}"`)
    const bdd3 = b3.banner && b3.bannerVisible && b3.treeNodes < 10021 && b3.bannerText.includes('已折叠部分')
    log(`BDD3 ${bdd3 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd3-large-collapsed-banner.png') })

    // ---------- BDD-4: manual expand on large ----------
    const exactKeyToggle = (key: string) => {
      const keyEl = page.locator('.tree-node-key').filter({ hasText: new RegExp(`^${key}$`) }).first()
      const row = keyEl.locator('xpath=ancestor::div[contains(@class,"tree-node-row")]')
      return row.locator('.expand-toggle')
    }
    lastStep = 'bdd4 initial'
    const before = await page.evaluate(() => document.querySelectorAll('.tree-node').length)
    // root toggle (data)
    lastStep = 'bdd4 click root toggle'
    const rootToggle = exactKeyToggle('data')
    const rootToggleCount = await rootToggle.count()
    log(`BDD4 rootToggleCount=${rootToggleCount}`)
    await rootToggle.click({ timeout: 10000 })
    await page.waitForFunction(() => document.querySelectorAll('.tree-node').length === 21, { timeout: 10000 })
    const afterRoot = await page.evaluate(() => ({ nodes: document.querySelectorAll('.tree-node').length, subVisible: Array.from(document.querySelectorAll('.tree-node')).some(n => n.textContent?.includes('sub_0')) }))
    log(`BDD4 after root click nodes=${afterRoot.nodes} sub_0 visible=${afterRoot.subVisible}`)
    // click sub_0 toggle (exact key, avoids root ancestor)
    lastStep = 'bdd4 click sub_0 toggle'
    const subToggle = exactKeyToggle('sub_0')
    await subToggle.click({ timeout: 10000 })
    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('.tree-node')
      return Array.from(nodes).some(n => n.textContent?.includes('leaf_0_499'))
    }, { timeout: 15000 })
    const afterSub = await page.evaluate(() => ({
      nodes: document.querySelectorAll('.tree-node').length,
      leafVisible: Array.from(document.querySelectorAll('.tree-node')).some(n => n.textContent?.includes('leaf_0_499')),
    }))
    log(`BDD4 after sub click nodes=${afterSub.nodes} leaf_0_499 visible=${afterSub.leafVisible}`)
    const bdd4 = before === 1 && afterRoot.nodes === 21 && afterRoot.subVisible && afterSub.leafVisible
    log(`BDD4 ${bdd4 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd4-manual-expand.png') })

    // ---------- BDD-5: switch file resets ----------
    lastStep = 'bdd5 goto multi'
    await page.goto(`${BASE}/t094-p6-multi`, { timeout: 30000 })
    await page.waitForSelector('.tree-view', { timeout: 20000 })
    await page.waitForTimeout(500)
    // multi entry: 2 files. default selected file = large.json (collapsed)
    const b5large = await page.evaluate(() => ({
      treeNodes: document.querySelectorAll('.tree-node').length,
      banner: !!document.querySelector('[data-testid="tree-collapse-banner"]'),
    }))
    log(`BDD5 large file initial: treeNodes=${b5large.treeNodes} banner=${b5large.banner}`)
    // switch to small.json — need to find file selector. Let me inspect entry detail for file tabs.
    lastStep = 'bdd5 find file selector'
    const fileTabs = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[class*="file"], [class*="tab"], button'))
      return els.map(e => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 80), txt: (e.textContent || '').trim().slice(0, 40) }))
        .filter(x => x.txt.includes('json') || x.txt.includes('small') || x.txt.includes('large'))
    })
    log(`BDD5 file selector candidates: ${JSON.stringify(fileTabs)}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd5-multi-before-switch.png') })

    // Click file tab that contains small.json
    const smallTab = page.locator('.file-item').filter({ hasText: 'small.json' }).first()
    const smallTabCount = await smallTab.count()
    log(`BDD5 smallTab count=${smallTabCount}`)
    if (smallTabCount > 0) {
      await smallTab.click({ timeout: 10000 })
      await page.waitForFunction((total) => document.querySelectorAll('.tree-node').length === total, SMALL_TOTAL, { timeout: 10000 })
      await page.waitForTimeout(400)
    }
    const b5small = await page.evaluate(() => ({
      treeNodes: document.querySelectorAll('.tree-node').length,
      expandedTrue: document.querySelectorAll('.expand-toggle[aria-expanded="true"]').length,
      expandedFalse: document.querySelectorAll('.expand-toggle[aria-expanded="false"]').length,
      banner: !!document.querySelector('[data-testid="tree-collapse-banner"]'),
    }))
    log(`BDD5 after switch to small: treeNodes=${b5small.treeNodes} expTrue=${b5small.expandedTrue} expFalse=${b5small.expandedFalse} banner=${b5small.banner}`)
    const bdd5 = b5small.treeNodes === SMALL_TOTAL && b5small.expandedFalse === 0 && !b5small.banner
    log(`BDD5 ${bdd5 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd5-after-switch-small.png') })

    // ---------- BDD-6: toggle reversible (small JSON) ----------
    lastStep = 'bdd6 goto small'
    await page.goto(`${BASE}/t094-p6-json`, { timeout: 20000 })
    await page.waitForSelector('.tree-view', { timeout: 15000 })
    await page.waitForTimeout(400)
    // find 'tags' branch toggle
    lastStep = 'bdd6 find tags toggle'
    const exactKeyToggle2 = (key: string) => {
      const keyEl = page.locator('.tree-node-key').filter({ hasText: new RegExp(`^${key}$`) }).first()
      const row = keyEl.locator('xpath=ancestor::div[contains(@class,"tree-node-row")]')
      return row.locator('.expand-toggle')
    }
    const tagsToggle = exactKeyToggle2('tags')
    const state0 = await page.evaluate(() => Array.from(document.querySelectorAll('.tree-node')).find(n => n.textContent?.includes('tags'))?.querySelector('.expand-toggle')?.getAttribute('aria-expanded'))
    log(`BDD6 tags initial aria-expanded=${state0}`)
    await tagsToggle.click({ timeout: 10000 })
    await page.waitForTimeout(300)
    const state1 = await page.evaluate(() => Array.from(document.querySelectorAll('.tree-node')).find(n => n.textContent?.includes('tags'))?.querySelector('.expand-toggle')?.getAttribute('aria-expanded'))
    const childrenHidden = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.tree-node')).find(n => n.textContent?.includes('tags'))
      return !!el && el.textContent?.includes('a') === false
    })
    log(`BDD6 after click1 aria-expanded=${state1} children hidden=${childrenHidden}`)
    await tagsToggle.click({ timeout: 10000 })
    await page.waitForTimeout(300)
    const state2 = await page.evaluate(() => Array.from(document.querySelectorAll('.tree-node')).find(n => n.textContent?.includes('tags'))?.querySelector('.expand-toggle')?.getAttribute('aria-expanded'))
    const childrenVisible = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.tree-node')).find(n => n.textContent?.includes('tags'))
      return !!el && el.textContent?.includes('a')
    })
    log(`BDD6 after click2 aria-expanded=${state2} children visible=${childrenVisible}`)
    const bdd6 = state0 === 'true' && state1 === 'false' && !childrenHidden && state2 === 'true' && childrenVisible
    log(`BDD6 ${bdd6 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd6-toggle-reversible.png') })

    // ---------- BDD-7: search count in collapsed tree ----------
    lastStep = 'bdd7 goto large'
    await page.goto(`${BASE}/t094-p6-large`, { timeout: 30000 })
    await page.waitForSelector('.tree-view', { timeout: 20000 })
    await page.waitForTimeout(500)
    const bannerBefore = await page.evaluate(() => !!document.querySelector('[data-testid="tree-collapse-banner"]'))
    const searchInput = page.locator('input[aria-label="Search tree nodes"]')
    await searchInput.fill('leaf_3_250', { timeout: 10000 })
    await page.waitForTimeout(500)
    const matchText = await page.locator('.search-match-count').textContent({ timeout: 10000 })
    log(`BDD7 bannerBefore=${bannerBefore} search="leaf_3_250" matchText="${matchText}"`)
    const bdd7 = bannerBefore && !!matchText && /\d+/.test(matchText) && !matchText.startsWith('0') && !matchText.startsWith('No')
    log(`BDD7 ${bdd7 ? 'PASS' : 'FAIL'}`)
    await page.screenshot({ path: path.join(SHOTS, 'bdd7-search-collapsed.png') })

    fs.writeFileSync(LOG, out.join('\n') + '\n')
    log('ALL DONE')
  } finally {
    await page.close()
  }
  clearTimeout(hardTimer)
  process.exit(0)
}
main().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1) })
