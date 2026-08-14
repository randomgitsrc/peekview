import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const EVID = '/home/kity/oclab/peekview/agate-workspace/tasks/TPV0094-treeview-default-expand/P6-evidence'
const BASE = 'http://127.0.0.1:8888'
const HARD = 300_000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)

const SCALES = [100, 500, 1000, 2000, 5000]
const BUDGET_MS = 500
const WAIT_TIMEOUT = 10_000

const results: Record<string, unknown> = {}
const logLines: string[] = []
function log(...args: unknown[]) {
  const line = args.map(String).join(' ')
  logLines.push(line)
  console.log(line)
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.setViewportSize({ width: 1280, height: 800 })

    for (const N of SCALES) {
      lastStep = `goto perf-${N}`
      await page.goto(`${BASE}/t094-p6-perf-${N}`, { timeout: 30000 })
      await page.waitForSelector('.tree-view', { timeout: 20000 })
      await page.waitForTimeout(400)

      // collapse first if initial state already fully expanded (N <= threshold)
      let initialNodes = await page.evaluate(() => document.querySelectorAll('.tree-node').length)
      if (initialNodes > 1) {
        lastStep = `collapse root ${N}`
        const rootToggle = page.locator('.tree-node-key').filter({ hasText: /^data$/ }).first()
          .locator('xpath=ancestor::div[contains(@class,"tree-node-row")]').locator('.expand-toggle')
        await rootToggle.click({ timeout: 5000 })
        await page.waitForFunction(() => document.querySelectorAll('.tree-node').length === 1, { timeout: 5000 })
        await page.waitForTimeout(200)
        initialNodes = await page.evaluate(() => document.querySelectorAll('.tree-node').length)
      }

      lastStep = `measure ${N}`
      const t0 = await page.evaluate(() => performance.now())
      const rootToggle2 = page.locator('.tree-node-key').filter({ hasText: /^data$/ }).first()
        .locator('xpath=ancestor::div[contains(@class,"tree-node-row")]').locator('.expand-toggle')
      await rootToggle2.click({ timeout: 5000 })

      let t1: number | null = null
      let timedOut = false
      try {
        await page.waitForFunction(
          (n) => document.querySelectorAll('.tree-node').length === n,
          N,
          { timeout: WAIT_TIMEOUT },
        )
        t1 = await page.evaluate(() => performance.now())
      } catch {
        timedOut = true
        const reached = await page.evaluate(() => document.querySelectorAll('.tree-node').length)
        t1 = null
        log(`SCALE ${N}: TIMEOUT waiting for ${N} nodes (reached ${reached})`)
      }

      const renderMs = timedOut ? null : (t1 as number) - t0
      const whiteScreen = await page.evaluate(() => ({
        readyState: document.readyState,
        bodyVisible: (document.querySelector('.tree-view') as HTMLElement | null)?.offsetParent !== null,
        docVisible: document.visibilityState,
      }))
      log(`SCALE ${N}: initial=${initialNodes} renderMs=${renderMs ?? 'TIMEOUT'} whiteScreen=${JSON.stringify(whiteScreen)} timedOut=${timedOut}`)

      results[N] = {
        scale: N,
        initialNodes,
        renderMs: timedOut ? null : Math.round((renderMs as number) * 100) / 100,
        timedOut,
        whiteScreen: whiteScreen.docVisible === 'visible' && whiteScreen.bodyVisible === false,
        withinBudget: !timedOut && renderMs !== null && renderMs <= BUDGET_MS,
      }
    }

    // threshold decision per P2 §8
    const decision = (() => {
      const okScales = Object.entries(results)
        .filter(([, r]) => (r as { withinBudget: boolean }).withinBudget)
        .map(([k]) => Number(k))
        .sort((a, b) => a - b)
      const budgetBroken = Object.entries(results)
        .filter(([, r]) => !(r as { withinBudget: boolean }).withinBudget)
        .map(([k]) => Number(k))
        .sort((a, b) => a - b)
      const maxOk = okScales.length ? okScales[okScales.length - 1] : null
      // 2000 must satisfy budget; 5000 over → keep 2000
      const r2000 = results[2000] as { withinBudget: boolean; renderMs: number | null }
      const r5000 = results[5000] as { withinBudget: boolean; renderMs: number | null }
      let selected = null as number | null
      if (r2000.withinBudget && r5000 && !r5000.withinBudget) selected = 2000
      else if (r2000.withinBudget && r5000 && r5000.withinBudget) selected = 5000
      else if (r2000.withinBudget) selected = 2000
      else if (okScales.length) selected = Math.max(1000, maxOk ?? 1000)
      else selected = 100
      return { okScales, budgetBroken, maxOk, selected, current: 2000 }
    })()

    log(`DECISION: okScales=${JSON.stringify(decision.okScales)} budgetBroken=${JSON.stringify(decision.budgetBroken)} selected=${decision.selected} current=2000`)
    log(`BUDGET: ${BUDGET_MS}ms`)

    const summary = {
      budget_ms: BUDGET_MS,
      wait_timeout_ms: WAIT_TIMEOUT,
      scales: results,
      decision: {
        ...decision,
        keepCurrent: decision.selected === 2000,
        note: decision.selected === 2000
          ? '2000 满足预算且 5000 超预算 → 阈值保持 2000，BDD-8 PASS'
          : decision.selected === 5000
            ? '5000 也满足预算 → 阈值应更新为 5000（需回 P4 改常量，报告主 Agent）'
            : `2000 超预算 → 降档取 ${decision.selected}`,
      },
      measured_at: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(EVID, 'redline-results.json'), JSON.stringify(summary, null, 2))
    fs.writeFileSync(path.join(EVID, 'redline-test-output.log'), logLines.join('\n') + '\n')
    log('REDLINE DONE')
  } finally { await page.close() }
  clearTimeout(hardTimer)
  process.exit(0)
}
main().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1) })
