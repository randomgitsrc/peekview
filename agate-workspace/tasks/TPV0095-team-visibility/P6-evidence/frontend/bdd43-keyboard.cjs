/**
 * TPV0095 P6 — BDD-43 键盘导航实测：移动端 tablist 方向键移动激活（tablist 语义 + 焦点可达）
 * CDP :18800 → debug :8888，视口 390×844。
 */
const { chromium } = require('playwright')
const HARD = 80000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)
const BASE = 'http://127.0.0.1:8888'
function log(...a) { console.log(a.join(' ')) }

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  try {
    await ctx.clearCookies()
    lastStep = 'login'
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const authBtn = page.locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")').first()
    await authBtn.waitFor({ state: 'visible', timeout: 15000 })
    await authBtn.click()
    await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('#login-username').fill('alice')
    await page.locator('#login-password').fill('testpass123')
    await page.locator('.login__submit').click()
    await page.waitForURL('**/explore', { timeout: 15000 })
    await page.waitForFunction(() => !!document.querySelector('.user-menu-trigger'), { timeout: 10000 })

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    lastStep = 'goto explore mobile'
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role="tablist"]', { timeout: 15000 })
    await page.waitForTimeout(700)

    const activeBefore = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid'))
    log('active before:', activeBefore)
    // 焦点给 All tab，按 ArrowRight → 激活应移动到 Mine
    await page.locator('[data-testid="tab-all"]').focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    const afterRight = await page.evaluate(() => {
      const active = document.querySelector('[role="tab"][aria-selected="true"]')
      const focused = document.activeElement
      return { active: active?.getAttribute('data-testid'), activeText: active?.textContent.trim(),
               focusedTestid: focused?.getAttribute('data-testid'), focusedText: focused?.textContent.trim() }
    })
    log('after ArrowRight:', JSON.stringify(afterRight))
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const afterRight2 = await page.evaluate(() => {
      const active = document.querySelector('[role="tab"][aria-selected="true"]')
      return { active: active?.getAttribute('data-testid') }
    })
    log('after ArrowRight x2:', JSON.stringify(afterRight2))
    const ok = afterRight.active === 'tab-mine' && afterRight2.active === 'tab-teams'
    log('KEYBOARD_OK:', ok)
    clearTimeout(hardTimer)
    process.exit(ok ? 0 : 1)
  } finally { await page.close() }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
