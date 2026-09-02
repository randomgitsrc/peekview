/**
 * TPV0095 P6 — BDD-42 成员退出确认流截图（bob ∈ proj-a → 点退出 → alertdialog → 确认 → joined 消失）
 * Playwright CDP :18800 → debug :8888；桌面 1280×800。
 */
const { chromium } = require('playwright')
const fs = require('fs')
const HARD = 90000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)
const BASE = 'http://127.0.0.1:8888'
const SHOT_DIR = __dirname + '/screenshots'
function log(...a) { console.log(a.join(' ')) }

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  try {
    await ctx.clearCookies()
    lastStep = 'login bob'
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const authBtn = page.locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")').first()
    await authBtn.waitFor({ state: 'visible', timeout: 15000 })
    await authBtn.click()
    await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('#login-username').fill('bob')
    await page.locator('#login-password').fill('testpass123')
    await page.locator('.login__submit').click()
    await page.waitForURL('**/explore', { timeout: 15000 })
    await page.waitForFunction(() => !!document.querySelector('.user-menu-trigger'), { timeout: 10000 })
    log('login bob ok')

    lastStep = 'goto /teams'
    await page.goto(`${BASE}/teams`, { timeout: 15000, waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="teams-joined"]', { timeout: 15000 })
    await page.waitForTimeout(800)
    const joinedBefore = await page.locator('[data-testid="teams-joined"]').textContent()
    log('joined section contains proj-a:', (joinedBefore || '').includes('proj-a') || (joinedBefore || '').includes('Proj A'))

    const leaveBtn = page.locator('[data-testid="teams-joined"] [data-testid^="team-leave-"]').first()
    const cnt = await leaveBtn.count()
    log('leave button count in joined:', cnt)
    if (cnt > 0) {
      await leaveBtn.click()
      const dialog = page.locator('[role="alertdialog"]')
      await dialog.waitFor({ state: 'visible', timeout: 5000 })
      await page.waitForTimeout(600)
      const dlgText = await dialog.textContent()
      log('leave dialog text:', JSON.stringify((dlgText || '').trim()))
      await page.screenshot({ path: `${SHOT_DIR}/bdd42-leave-confirm-desktop.png` })
      await dialog.locator('button:has-text("确认"), button:has-text("Confirm")').first().click()
      await page.waitForTimeout(1200)
      const joinedAfter = await page.locator('[data-testid="teams-joined"]').textContent()
      const stillThere = ((joinedAfter || '').includes('proj-a') || (joinedAfter || '').includes('Proj A'))
      log('after confirm, joined still has proj-a:', stillThere)
      await page.screenshot({ path: `${SHOT_DIR}/bdd42-after-leave-desktop.png` })
      log('LEAVE_FLOW_OK:', !stillThere)
    } else {
      log('LEAVE_FLOW_OK: false (no leave button — fixture missing)')
    }
  } finally { await page.close() }
  clearTimeout(hardTimer)
  process.exit(0)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
