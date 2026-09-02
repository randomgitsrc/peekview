/**
 * TPV0095 P6 — BDD-38/39/40/41/42/43 视觉捕获（Playwright CDP :18800 → debug :8888）
 * 确定性：每次切换用户先 clearCookies + 走完整登录表单。
 * 桌面 1280×800 + 移动 390×844。只 page.close + process.exit，不 browser.close。
 */
const { chromium } = require('playwright')
const fs = require('fs')
const HARD = 175000
let lastStep = 'init'
const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2) }, HARD)
const BASE = 'http://127.0.0.1:8888'
const SHOT_DIR = __dirname + '/screenshots'
const LOG = []
function log(...a) { const s = a.join(' '); LOG.push(s); console.log(s) }
const unique = Date.now()

async function setViewport(page, cdp, w, h, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 3 : 1, mobile, screenWidth: w, screenHeight: h })
  if (mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
}

async function loginAs(page, ctx, username) {
  await ctx.clearCookies()
  lastStep = `login ${username}`
  await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const authBtn = page.locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")').first()
  await authBtn.waitFor({ state: 'visible', timeout: 15000 })
  await authBtn.click()
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill('testpass123')
  await page.locator('.login__submit').click()
  await page.waitForURL('**/explore', { timeout: 15000 })
  await page.waitForFunction(() => !!document.querySelector('.user-menu-trigger'), { timeout: 10000 })
  log(`[login] ${username} ok`)
}

async function gotoUrl(page, url, sel) {
  lastStep = `goto ${url}`
  await page.goto(`${BASE}${url}`, { timeout: 15000, waitUntil: 'domcontentloaded' })
  if (sel) await page.waitForSelector(sel, { timeout: 15000 })
  await page.waitForTimeout(700)
}

async function token(username) {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'testpass123' }),
  })
  return (await r.json()).access_token
}

async function createTeamAndEntry(token, name, summary) {
  const teamResp = await fetch(`${BASE}/api/v1/teams`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  const team = await teamResp.json()
  const entryResp = await fetch(`${BASE}/api/v1/entries`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ summary, team_id: team.slug, files: [{ filename: 'readme.md', content: `# ${summary}` }] }),
  })
  const entry = await entryResp.json()
  return { team, entrySlug: entry.slug, entryStatus: entryResp.status }
}

async function main() {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true })
  const aliceTok = await token('alice')
  const bobTok = await token('bob')
  const teamName = `PV6-${unique}`
  const summary = `pv6 visual ${unique}`
  const fx = await createTeamAndEntry(aliceTok, teamName, summary)
  log('alice fixture team:', JSON.stringify({ name: teamName, slug: fx.team.slug, entrySlug: fx.entrySlug, entryStatus: fx.entryStatus }))
  const bobTeamName = `BobT-${unique}`
  const bfx = await createTeamAndEntry(bobTok, bobTeamName, 'x')
  log('bob fixture team slug:', bfx.team.slug)

  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0] ?? await browser.newContext()
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  try {
    await setViewport(page, cdp, 1280, 800, false)

    // ── BDD-38: Teams tab 激活互斥 + URL ?view=teams ──
    await loginAs(page, ctx, 'alice')
    await gotoUrl(page, '/explore', '[role="tablist"]')
    await page.locator('[data-testid="tab-teams"]').click()
    await page.waitForTimeout(800)
    const tabs38 = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map((t) => ({
      id: t.getAttribute('data-testid'), active: t.classList.contains('active'), sel: t.getAttribute('aria-selected'),
    })))
    const tabTeams = tabs38.find((t) => t && t.id === 'tab-teams')
    const tabAll = tabs38.find((t) => t && t.id === 'tab-all')
    const ok38 = tabTeams && tabTeams.active && tabAll && !tabAll.active
    log('BDD-38 tabs:', JSON.stringify(tabs38), 'exclusive=', ok38)
    await page.screenshot({ path: `${SHOT_DIR}/bdd38-teams-tab-desktop.png` })
    await gotoUrl(page, '/explore?view=teams', null)
    await page.waitForTimeout(700)
    log('BDD-38 URL view=teams:', page.url())
    await page.screenshot({ path: `${SHOT_DIR}/bdd38-teams-view-url-desktop.png` })

    // ── BDD-39 + BDD-40: 本 team 过滤（alice owner）grid card ──
    await gotoUrl(page, `/explore?team=${fx.team.slug}`, `.entry-card:has-text("${summary}"), .entry-list-row:has-text("${summary}")`)
    await page.waitForTimeout(500)
    const b3940 = await page.evaluate((s) => Array.from(document.querySelectorAll('.entry-card, .entry-list-row'))
      .filter((c) => (c.textContent || '').includes(s)).map((c) => ({
        cls: c.className,
        teamBadge: (c.querySelector('[data-testid="badge-team"]')?.textContent || '').trim(),
        privBadges: Array.from(c.querySelectorAll('.badge-private, [class*="badge-private"], [data-testid*="private"]')).length,
        hasToggle: !!c.querySelector('[data-testid="visibility-toggle"]'),
        hasDelete: !!c.querySelector('[data-action="delete"], .card-action-btn--danger, .force-delete, [data-testid="force-delete"]'),
      })), summary)
    const toggleTotal = await page.evaluate(() => document.querySelectorAll('[data-testid="visibility-toggle"]').length)
    log('BDD-39/40 card(s):', JSON.stringify(b3940), '| toggle count whole view=', toggleTotal)
    await page.screenshot({ path: `${SHOT_DIR}/bdd39-team-badge-grid-desktop.png` })

    // list 视图（行）badge 不叠加 private
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /list/i.test(b.getAttribute('aria-label') || '') || (b.title || '').toLowerCase().includes('list'))
      if (btn) btn.click()
    }).catch(() => {})
    await page.waitForTimeout(800)
    const rowBadge = await page.evaluate((s) => Array.from(document.querySelectorAll('.entry-list-row'))
      .filter((c) => (c.textContent || '').includes(s)).map((c) => ({
        teamBadge: (c.querySelector('[data-testid="badge-team"]')?.textContent || '').trim(),
        privBadges: Array.from(c.querySelectorAll('.badge-private, [class*="badge-private"]')).length,
        hasToggle: !!c.querySelector('[data-testid="visibility-toggle"]'),
      })), summary)
    log('BDD-39 row badge:', JSON.stringify(rowBadge))
    await page.screenshot({ path: `${SHOT_DIR}/bdd39-team-badge-list-desktop.png` })

    // ── BDD-41: 不可用态 ──
    await gotoUrl(page, `/explore?team=pv6-no-such-team-${unique}`, '[data-testid="team-unavailable"]')
    const clearVisible = await page.locator('[data-testid="team-unavailable-clear"]').isVisible()
    const unavText = await page.locator('[data-testid="team-unavailable"]').textContent()
    log('BDD-41 unav text:', JSON.stringify(unavText), 'clearVisible=', clearVisible)
    await page.screenshot({ path: `${SHOT_DIR}/bdd41-team-unavailable-desktop.png` })
    await page.locator('[data-testid="team-unavailable-clear"]').click()
    await page.waitForTimeout(700)
    const unavGone = (await page.locator('[data-testid="team-unavailable"]').count()) === 0
    log('BDD-41 URL after clear:', page.url(), '| gone=', unavGone)

    // ── BDD-42 /teams owner：owned 含新建 team；无退出按钮 ──
    await gotoUrl(page, '/teams', '[data-testid="teams-owned"]')
    const ownedText = await page.locator('[data-testid="teams-owned"]').textContent()
    const leaveInOwned = await page.locator('[data-testid="teams-owned"] [data-testid^="team-leave-"]').count()
    const hasNewTeam = (ownedText || '').includes(teamName)
    log('BDD-42 owned has fresh team:', hasNewTeam, '| leave buttons in owned:', leaveInOwned)
    await page.screenshot({ path: `${SHOT_DIR}/bdd42-teams-owned-desktop.png` })

    // ── BDD-42 添加成员错误三态（bob 视角，owner 自己的 team）──
    await loginAs(page, ctx, 'bob')
    await gotoUrl(page, '/teams', '[data-testid="teams-owned"]')
    await page.waitForTimeout(600)
    const errors = []
    const addErr = async (u) => {
      const card = page.locator('article').filter({ hasText: bobTeamName }).first()
      const input = card.locator('[data-testid="team-member-username-input"]')
      await input.waitFor({ state: 'visible', timeout: 5000 })
      await input.fill(u)
      await input.press('Enter')
      const err = card.locator('[data-testid="team-error"]').first()
      await err.waitFor({ state: 'visible', timeout: 8000 })
      const text = (await err.textContent() || '').trim()
      errors.push(text)
      log('  add-member', u, '=>', text)
    }
    await addErr('no-such-user-xyz-999')
    await page.screenshot({ path: `${SHOT_DIR}/bdd42-member-error-1-desktop.png` })
    await addErr('bob') // owner 添加自己 → 拒
    const inputA = page.locator('article').filter({ hasText: bobTeamName }).first().locator('[data-testid="team-member-username-input"]')
    await inputA.waitFor({ state: 'visible', timeout: 5000 })
    await inputA.fill('alice')
    await inputA.press('Enter')
    await page.waitForTimeout(1000)
    await addErr('alice') // 已是成员
    log('BDD-42 error texts:', JSON.stringify(errors), 'unique=', new Set(errors).size)
    await page.screenshot({ path: `${SHOT_DIR}/bdd42-member-errors-desktop.png` })

    // ── BDD-42 UserMenu Teams 项 ──
    await loginAs(page, ctx, 'alice')
    await gotoUrl(page, '/explore', '.user-menu-trigger')
    await page.locator('.user-menu-trigger').click()
    await page.waitForTimeout(500)
    const umVisible = await page.locator('[data-testid="user-menu-teams-item"]').isVisible()
    log('BDD-42 user-menu-teams-item visible:', umVisible)
    await page.screenshot({ path: `${SHOT_DIR}/bdd42-user-menu-teams.png` })

    // ── BDD-43: mobile tablist ──
    await loginAs(page, ctx, 'alice')
    await setViewport(page, cdp, 390, 844, true)
    await gotoUrl(page, '/explore', '[role="tablist"]')
    const m43 = await page.evaluate(() => {
      const tl = document.querySelector('[role="tablist"]')
      const cs = window.getComputedStyle(tl)
      const tabs = Array.from(tl.querySelectorAll('[role="tab"]'))
      return {
        overflowX: cs.overflowX,
        tabCount: tabs.length,
        heights: tabs.map((t) => t.getBoundingClientRect().height),
        allSelected: tabs.every((t) => t.getAttribute('aria-selected') !== null),
      }
    })
    log('BDD-43 mobile:', JSON.stringify(m43))
    await page.screenshot({ path: `${SHOT_DIR}/bdd43-mobile-tablist.png` })

    const summaryLine = {
      bdd38: ok38,
      bdd39: b3940.length > 0 && b3940[0].teamBadge.includes('仅团队可见') && b3940[0].privBadges === 0,
      bdd40: b3940.length > 0 && !b3940[0].hasToggle && b3940[0].hasDelete && toggleTotal === 0,
      bdd41: clearVisible && unavGone && (unavText || '').includes('团队不可用'),
      bdd42_owned: hasNewTeam && leaveInOwned === 0,
      bdd42_errors: errors.length >= 3 && new Set(errors).size >= 3,
      bdd42_um: umVisible,
      bdd43: !!m43.overflowX.match(/auto|scroll/) && m43.tabCount === 5 && m43.heights.every((h) => h >= 44) && m43.allSelected,
    }
    log('SUMMARY: ' + JSON.stringify(summaryLine))
    clearTimeout(hardTimer)
    process.exit(Object.values(summaryLine).every(Boolean) ? 0 : 1)
  } finally {
    await page.close()
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
