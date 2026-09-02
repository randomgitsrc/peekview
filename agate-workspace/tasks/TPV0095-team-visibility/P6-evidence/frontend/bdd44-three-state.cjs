/**
 * TPV0095 P6 BDD-44 — detail 页状态标签三态实测（Playwright CDP :18800 → debug :8888）
 * team entry → "仅团队可见 · {teamName}"；private → "Private"；public → "Public"
 * 桌面 1280×800 + 移动 390×844 双档截图；脚本仅 page.close + process.exit，不 browser.close。
 */
const { chromium } = require('playwright')
const fs = require('fs')

const HARD = 170000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)

const BASE = 'http://127.0.0.1:8888'
const SHOT_DIR = __dirname + '/screenshots'
const LOG = []
function log(...a) { const s = a.join(' '); LOG.push(s); console.log(s) }
const teamSlug = process.env.TEAM_SLUG || 'mq2sf9'
const teamName = process.env.TEAM_NAME || 'Proj A'
const privSlug = process.env.PRIV_SLUG || 'admin-private-config'
const pubSlug = process.env.PUB_SLUG || 'yaml-docker-compose'

async function setViewport(page, cdp, w, h, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 3 : 1, mobile, screenWidth: w, screenHeight: h })
  if (mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
}

async function login(page, username = 'alice') {
  lastStep = `login goto explore (${username})`
  await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  // 已登录（context 持 cookie）则跳过登录流程
  const loggedIn = await page.evaluate(() => {
    const trig = document.querySelector('.user-menu-trigger')
    if (trig) return true
    const btns = Array.from(document.querySelectorAll('.explore-actions button'))
    return !btns.some((b) => /Sign in|Login/i.test(b.textContent || ''))
  })
  if (loggedIn) { log('[login] already authenticated, skip'); return }
  const authBtn = page.locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")').first()
  await authBtn.waitFor({ state: 'visible', timeout: 15000 })
  await authBtn.click()
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill('testpass123')
  await page.locator('.login__submit').click()
  await page.waitForURL('**/explore', { timeout: 15000 })
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('.explore-actions button'))
    return !btns.some((b) => /Sign in|Login/i.test(b.textContent || ''))
  }, { timeout: 10000 })
}

async function statusTagOf(page) {
  // detail header .meta-row .status-tag（desktop）；mobile 走 EntryMetaTagsBar .status-tag
  return page.evaluate(() => {
    const tags = Array.from(document.querySelectorAll('.status-tag'))
    return tags.map((t) => (t.textContent || '').trim())
  })
}

async function check(opts) {
  const { tag, label, name, shotBase } = opts
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  try {
    await login(page, 'alice')
    // desktop
    await setViewport(page, cdp, 1280, 800, false)
    lastStep = `goto /${tag.slug} (desktop)`
    await page.goto(`${BASE}/${tag.slug}`, { timeout: 20000, waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.detail-header', { timeout: 15000 })
    await page.waitForTimeout(600)
    const dTexts = await statusTagOf(page)
    log(`[${label}] desktop .status-tag =`, JSON.stringify(dTexts))
    const dOk = dTexts.length > 0 && dTexts.some((t) => t === tag.expect)
    await page.screenshot({ path: `${SHOT_DIR}/${shotBase}-desktop.png` })
    // mobile
    await setViewport(page, cdp, 390, 844, true)
    await page.goto(`${BASE}/${tag.slug}`, { timeout: 20000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const mTexts = await statusTagOf(page)
    log(`[${label}] mobile .status-tag =`, JSON.stringify(mTexts))
    const mOk = mTexts.length > 0 && mTexts.some((t) => t === tag.expect)
    await page.screenshot({ path: `${SHOT_DIR}/${shotBase}-mobile.png` })
    log(`[${label}] RESULT desktop=${dOk ? 'OK' : 'FAIL'} mobile=${mOk ? 'OK' : 'FAIL'}`)
    return { dOk, mOk }
  } finally {
    await page.close()
  }
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true })
  const cases = [
    { slug: teamSlug, expect: `仅团队可见 · ${teamName}`, label: 'TEAM', shotBase: 'bdd44-team' },
    { slug: privSlug, expect: 'Private', label: 'PRIVATE', shotBase: 'bdd44-private' },
    { slug: pubSlug, expect: 'Public', label: 'PUBLIC', shotBase: 'bdd44-public' },
  ]
  const results = {}
  for (const c of cases) {
    const r = await check({ tag: { slug: c.slug, expect: c.expect }, label: c.label, shotBase: c.shotBase })
    results[c.label] = r
  }
  const allOk = Object.values(results).every((r) => r.dOk && r.mOk)
  log('SUMMARY: ' + JSON.stringify(results))
  log('ALL_OK: ' + allOk)
  clearTimeout(hardTimer)
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
