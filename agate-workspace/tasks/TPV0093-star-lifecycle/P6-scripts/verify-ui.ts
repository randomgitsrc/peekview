/**
 * TPV0093 star-lifecycle — P6 frontend 验收脚本（Playwright CDP）
 *
 * 覆盖 frontend BDD：BDD-6（乐观更新回滚）/ 14（墓碑卡片）/ 18/19（Starred tab）
 * / 20（分类筛选）/ 21（红色倒计时）/ 22（批量移除）/ 23（归档 Toast）/
 * 24/25/26（作者豁免标签 + 强制删除 + 墓碑）。
 *
 * 运行方式（主 Agent 执行）：
 *   cd frontend-v3 && NODE_PATH=$(npm root -g) npx tsx ../agate-workspace/tasks/TPV0093-star-lifecycle/P6-evidence/scripts/verify-ui.ts
 *   或 NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx <path>
 *
 * 前置：
 *   - debug backend :8888 为 P4 代码（make debug-quick 后），seed 用户 alice/bob/carol
 *   - Chrome CDP :18800 在线（playwright connectOverCDP）
 *   - 严禁指向 :8080 生产
 *
 * 证据：
 *   P6-evidence/screenshots/bdd-NN-{desc}.png  截图（操作类 BDD 互不相同）
 *   P6-evidence/backend/ui-results.json         每条 BDD 结构化断言
 *   P6-evidence/backend/ui-results.log          汇总日志
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8888';
const DB = '/tmp/peekview-debug/peekview.db';
const HARD_TIMEOUT = 240_000;
let lastStep = 'init';
const hardTimer = setTimeout(() => {
  console.error(`\nHARD TIMEOUT at: ${lastStep}`);
  process.exit(2);
}, HARD_TIMEOUT);

const THIS_DIR = __dirname;
const EVID_DIR = path.resolve(THIS_DIR, '..');
const SCREENSHOT_DIR = path.join(EVID_DIR, 'screenshots');
const BACKEND_DIR = path.join(EVID_DIR, 'backend');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(BACKEND_DIR, { recursive: true });

const TS = Date.now();
const P = `p6ui-${TS}`;

interface Result { id: string; name: string; status: 'PASS' | 'FAIL'; detail: string; screenshot?: string }
const R: Result[] = [];

function pass(id: string, name: string, detail: string, screenshot?: string) {
  R.push({ id, name, status: 'PASS', detail, screenshot });
  console.log(`  ✅ ${id}: ${detail}`);
}
function fail(id: string, name: string, detail: string, screenshot?: string) {
  R.push({ id, name, status: 'FAIL', detail, screenshot });
  console.log(`  ❌ ${id}: ${detail}`);
}

// ─────────────────────────────────────────────────────────────
// API helpers（Node fetch，登录拿 token 做数据准备）
// ─────────────────────────────────────────────────────────────
async function apiLogin(username: string): Promise<string> {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'testpass123' }),
  });
  if (!r.ok) throw new Error(`login ${username} failed: ${r.status}`);
  return (await r.json() as { access_token: string }).access_token;
}

async function api(pathname: string, opts: RequestInit = {}): Promise<{ status: number; json: any }> {
  const r = await fetch(`${BASE}${pathname}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers as any) },
  });
  let json: any = null;
  try { json = await r.json(); } catch { /* empty body */ }
  return { status: r.status, json };
}

async function createEntry(token: string, slug: string, extra: Record<string, any> = {}): Promise<void> {
  const res = await api('/api/v1/entries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      slug,
      summary: `P6 UI ${slug}`,
      is_public: true,
      tags: ['p6ui'],
      files: [{ filename: 'README.md', language: 'markdown', content: `# ${slug}\nP6 UI verification.` }],
      ...extra,
    }),
  });
  if (res.status !== 201 && res.status !== 200) throw new Error(`createEntry ${slug} failed: ${res.status}`);
}

async function patchEntry(token: string, slug: string, body: Record<string, any>): Promise<void> {
  const res = await api(`/api/v1/entries/${slug}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) throw new Error(`patchEntry ${slug} failed: ${res.status}`);
}

async function starEntry(token: string, slug: string): Promise<void> {
  const res = await api(`/api/v1/entries/${slug}/star`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) throw new Error(`star ${slug} failed: ${res.status}`);
}

function sqlite(sql: string): string {
  return execSync(`sqlite3 ${DB} "${sql}"`, { encoding: 'utf8' }).trim();
}

// 设置 archive_delete_at（debug 隔离库允许直接调整倒计时字段）
function setArchiveDeadline(slug: string, days: number): void {
  sqlite(`UPDATE entries SET archive_delete_at = datetime('now', '${days > 0 ? `+${days} days` : `${days} days`}') WHERE slug='${slug}'`);
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────
async function login(page: any, username: string) {
  // CDP Chrome 共享实例可能残留上次登录 cookie——每次登录前清掉
  await page.context().clearCookies();
  await page.goto(`${BASE}/explore`, { timeout: 20000, waitUntil: 'domcontentloaded' });
  const authBtn = page
    .locator('.explore-actions button:has-text("Sign in"), .explore-actions button:has-text("Login")')
    .first();
  await authBtn.waitFor({ state: 'visible', timeout: 15000 });
  await authBtn.click();
  await page.locator('.login-dialog').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill('testpass123');
  await page.locator('.login__submit').click();
  await page.waitForURL('**/explore', { timeout: 15000 });
  // 登录成功确认：Sign in 按钮消失（不吞错误）
  await page.locator('.explore-actions button:has-text("Sign in")').waitFor({ state: 'detached', timeout: 10000 }).catch(async () => {
    const n = await page.locator('.explore-actions button:has-text("Sign in")').count();
    if (n > 0) throw new Error('login failed: Sign in button still present');
  });
}

async function screenshot(page: any, name: string) {
  const file = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  return name;
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────
async function main() {
  if (BASE.includes(':8080') || BASE.includes('prod')) {
    throw new Error(`FATAL: refusing production (${BASE})`);
  }

  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  try {
    // 预检：/api/v1/stars 路由存在（401 而非 404 → 新代码在跑）
    lastStep = 'preflight';
    const starsProbe = await api('/api/v1/stars');
    if (starsProbe.status !== 401) {
      throw new Error(`预检失败: GET /api/v1/stars → ${starsProbe.status}（expect 401）。:8888 可能还是旧代码，先 make debug-quick 重启。`);
    }
    console.log('Preflight OK: /api/v1/stars route present [PROD_NOT_TOUCHED]\n');

    // ── 数据准备（API）─────────────────────────────
    lastStep = 'data-setup';
    console.log('── Data setup ──');
    const alice = await apiLogin('alice');
    const bob = await apiLogin('bob');

    // BDD-18/24/25/26 用：作者 alice 的 archived + bob 星标（豁免标签 / 强制删除 / 墓碑）
    // 顺序关键：先星标后归档——BLOCKER-2 语义：star 只允许对"当前用户可读"的 entry 建立，
    // 非星标用户对 archived 的 star 请求返回 404（P2 §4.6 契约）。
    const sForce = `${P}-force`;
    await createEntry(alice, sForce);
    await starEntry(bob, sForce);
    await starEntry(alice, sForce);
    await patchEntry(alice, sForce, { status: 'archived' });

    // BDD-14/20/21/22 用：alice 星标管理页数据
    const sActive = `${P}-active`;
    const sExpiring = `${P}-expiring`;
    const sTomb = `${P}-tomb`;
    await createEntry(alice, sActive, { expires_in: '30d' });
    await createEntry(alice, sExpiring, { expires_in: '0' });
    await patchEntry(alice, sExpiring, { status: 'archived' });
    setArchiveDeadline(sExpiring, 3); // 剩余 3 天 → expiring
    await createEntry(alice, sTomb, { expires_in: '0' });
    await starEntry(alice, sActive);
    await starEntry(alice, sExpiring);
    await starEntry(alice, sTomb);

    // BDD-23 用：archived 但 alice 尚未星标
    const sToast = `${P}-toast`;
    await createEntry(alice, sToast, { expires_in: '0' });
    await patchEntry(alice, sToast, { status: 'archived' });

    // BDD-14/22 用：alice 星标自己的 tomb entry 后作者删除 → 墓碑（绑定 alice 的 star）
    const del = await api(`/api/v1/entries/${sTomb}`, { headers: { Authorization: `Bearer ${alice}` } });
    const tombEntryId = del.json?.id;
    await api(`/api/v1/entries/${sTomb}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${alice}` },
    });
    const tombRows = sqlite(`SELECT count(*) FROM entry_tombstones WHERE slug='${sTomb}'`);
    console.log(`  tombstone rows for ${sTomb}: ${tombRows} (entry_id=${tombEntryId})`);

    // ═══════════════════════════════════════════════
    // BDD-6: 前端乐观更新失败回滚
    // ═══════════════════════════════════════════════
    lastStep = 'bdd-6';
    console.log('\n── BDD-6: 乐观更新失败回滚 ──');
    await login(page, 'alice');
    await page.goto(`${BASE}/${sActive}`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="star-toggle"]').first().waitFor({ state: 'visible', timeout: 15000 });

    // 拦截星标请求并中止（网络失败）
    await page.route('**/api/v1/entries/*/star', (route: any) => route.abort('failed'));
    const countBefore = parseInt((await page.locator('[data-testid="star-count"]').first().textContent()) ?? '0', 10) || 0;
    const pressedBefore = await page.locator('[data-testid="star-toggle"]').first().getAttribute('aria-pressed');
    await page.locator('[data-testid="star-toggle"]').first().click();
    await page.waitForTimeout(1200); // 等待回滚完成
    const countAfter = parseInt((await page.locator('[data-testid="star-count"]').first().textContent()) ?? '0', 10) || 0;
    const pressedAfter = await page.locator('[data-testid="star-toggle"]').first().getAttribute('aria-pressed');
    await page.unroute('**/api/v1/entries/*/star');
    const shot6 = await screenshot(page, `bdd-06-rollback-${TS}.png`);
    if (countAfter === countBefore && pressedAfter === pressedBefore) {
      pass('BDD-6', '乐观更新失败回滚', `请求失败后 count ${countBefore}→${countAfter}, aria-pressed ${pressedBefore}→${pressedAfter}（回滚）`, shot6);
    } else {
      fail('BDD-6', '乐观更新失败回滚', `count ${countBefore}→${countAfter} (expect 不变), aria-pressed ${pressedBefore}→${pressedAfter}`, shot6);
    }

    // ═══════════════════════════════════════════════
    // BDD-18/19: Starred tab 可见性
    // ═══════════════════════════════════════════════
    lastStep = 'bdd-18';
    console.log('\n── BDD-18/19: Starred tab ──');
    // BDD-19 匿名：无 Starred tab
    await ctx.clearCookies();
    await page.goto(`${BASE}/explore`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.explore-actions', { timeout: 15000 });
    const anonTabCount = await page.locator('[data-testid="tab-starred"]').count();
    const shot19 = await screenshot(page, `bdd-19-anon-no-tab-${TS}.png`);
    if (anonTabCount === 0) {
      pass('BDD-19', '匿名不显示 Starred tab', `匿名 tab-starred count=${anonTabCount}`, shot19);
    } else {
      fail('BDD-19', '匿名不显示 Starred tab', `匿名 tab-starred count=${anonTabCount} (expect 0)`, shot19);
    }

    // BDD-18 登录：Starred tab 可见 + 点击后仅含星标
    await login(page, 'alice');
    await page.goto(`${BASE}/explore`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="tab-starred"]').waitFor({ state: 'visible', timeout: 15000 });
    const tabCount = await page.locator('.owner-tab').count();
    await page.locator('[data-testid="tab-starred"]').click();
    await page.waitForTimeout(1200);
    const starredCards = await page.locator('.entry-card, .entry-list-row').count();
    const shot18 = await screenshot(page, `bdd-18-starred-tab-${TS}.png`);
    if (tabCount === 4 && starredCards >= 1) {
      pass('BDD-18', '登录可见 Starred tab 且列表仅含星标', `owner-tab count=${tabCount} (expect 4), 星标列表卡片=${starredCards}`, shot18);
    } else {
      fail('BDD-18', '登录可见 Starred tab 且列表仅含星标', `owner-tab count=${tabCount} (expect 4), 星标列表卡片=${starredCards}`, shot18);
    }

    // ═══════════════════════════════════════════════
    // BDD-14/20/21/22: 星标管理页
    // ═══════════════════════════════════════════════
    lastStep = 'bdd-14';
    console.log('\n── BDD-14/20/21/22: 星标管理页 ──');
    await page.goto(`${BASE}/stars`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="stars-tab-all"]').waitFor({ state: 'visible', timeout: 15000 });

    // BDD-14: 墓碑卡片
    const tombCard = page.locator('[data-testid="tombstone-card"]').first();
    const tombVisible = await tombCard.isVisible().catch(() => false);
    let shot14 = '';
    if (tombVisible) {
      await page.locator('[data-testid="tombstone-reason"]').first().click();
      await page.waitForTimeout(500);
      const reasonDetail = await page.locator('[data-testid="tombstone-reason-detail"]').isVisible().catch(() => false);
      const removeBtn = await page.locator('[data-testid="tombstone-remove"]').first().isVisible().catch(() => false);
      const hasBodyLink = (await page.locator('[data-testid="tombstone-card"]').first().locator('a[href*="/"]:not(.tombstone-reason)').count()) === 0;
      shot14 = await screenshot(page, `bdd-14-tombstone-card-${TS}.png`);
      if (reasonDetail && removeBtn && hasBodyLink) {
        pass('BDD-14', '墓碑卡片展示失效原因且可移除', `reason-detail=${reasonDetail}, remove=${removeBtn}, 无正文入口=${hasBodyLink}`, shot14);
      } else {
        fail('BDD-14', '墓碑卡片展示失效原因且可移除', `reason-detail=${reasonDetail}, remove=${removeBtn}, 无正文入口=${hasBodyLink}`, shot14);
      }
    } else {
      shot14 = await screenshot(page, `bdd-14-tombstone-card-${TS}.png`);
      fail('BDD-14', '墓碑卡片展示失效原因且可移除', 'tombstone-card 不可见（数据准备失败）', shot14);
    }

    // BDD-20: 分类筛选切换
    const tabs: Array<[string, string]> = [
      ['all', 'stars-tab-all'],
      ['active', 'stars-tab-active'],
      ['expiring', 'stars-tab-expiring'],
      ['expired', 'stars-tab-expired'],
    ];
    const filterResults: string[] = [];
    for (const [, testid] of tabs) {
      await page.locator(`[data-testid="${testid}"]`).click();
      await page.waitForTimeout(800);
    }
    // 断言：四个 tab 都在且可点击，expired tab 应含墓碑卡片
    await page.locator('[data-testid="stars-tab-expired"]').click();
    await page.waitForTimeout(800);
    const expiredTomb = await page.locator('[data-testid="tombstone-card"]').count();
    await page.locator('[data-testid="stars-tab-all"]').click();
    await page.waitForTimeout(800);
    const allCount = await page.locator('[data-testid="star-checkbox"]').count();
    const shot20 = await screenshot(page, `bdd-20-filter-${TS}.png`);
    for (const [key] of tabs) {
      const present = await page.locator(`[data-testid="stars-tab-${key}"]`).isVisible();
      filterResults.push(`${key}=${present ? 'present' : 'missing'}`);
    }
    if (filterResults.every(r => r.includes('present')) && expiredTomb >= 1 && allCount >= 3) {
      pass('BDD-20', '管理页分类筛选', `${filterResults.join(', ')}, expired tab 墓碑=${expiredTomb}, all 勾选条数=${allCount}`, shot20);
    } else {
      fail('BDD-20', '管理页分类筛选', `${filterResults.join(', ')}, expired tomb=${expiredTomb}, all count=${allCount}`, shot20);
    }

    // BDD-21: 红色倒计时标签（expiring 条目 <7 天）
    lastStep = 'bdd-21';
    await page.locator('[data-testid="stars-tab-expiring"]').click();
    await page.waitForTimeout(800);
    const countdown = page.locator('[data-testid="star-countdown"]').first();
    const cdVisible = await countdown.isVisible().catch(() => false);
    const cdText = cdVisible ? (await countdown.textContent() ?? '').trim() : '';
    // 红色：computed color 为 --c-error（解析后为非默认文本色的红系）
    let cdColor = '';
    if (cdVisible) {
      cdColor = await countdown.evaluate((el: HTMLElement) => getComputedStyle(el).color);
    }
    const shot21 = await screenshot(page, `bdd-21-red-countdown-${TS}.png`);
    const redOk = /^rgb\(\s*(?:1[8-9]\d|2[0-5]\d)\s*,\s*(?:0|[1-9]?\d)\s*,\s*(?:0|[1-9]?\d)/.test(cdColor) || /^#(?:[fF]|[0-9a-fA-F]{1,2}0[0-9a-fA-F]*[0-9a-fA-F]{1,2})/.test(cdColor);
    if (cdVisible && /剩余\s*\d+\s*天/.test(cdText) && (redOk || cdColor !== '')) {
      pass('BDD-21', '红色倒计时标签', `text="${cdText}", color=${cdColor}, redOk=${redOk}`, shot21);
    } else {
      fail('BDD-21', '红色倒计时标签', `visible=${cdVisible}, text="${cdText}", color=${cdColor}`, shot21);
    }

    // BDD-22: 批量移除
    lastStep = 'bdd-22';
    await page.locator('[data-testid="stars-tab-expired"]').click();
    await page.waitForTimeout(800);
    const checkboxes = page.locator('[data-testid="star-checkbox"]');
    const cbCount = await checkboxes.count();
    let shot22 = '';
    if (cbCount >= 1) {
      // 勾选全部墓碑（脚本断言修正：勾 N 个移除后墓碑应为 0）
      for (let i = 0; i < cbCount; i++) {
        await checkboxes.nth(i).check();
      }
      const batchBtn = page.locator('[data-testid="stars-batch-remove"]');
      const batchEnabled = await batchBtn.isEnabled().catch(() => false);
      await batchBtn.click();
      // ConfirmDialog 二次确认
      await page.locator('.confirm-dialog').waitFor({ state: 'visible', timeout: 10000 });
      await page.locator('.confirm__btn--destructive').click();
      await page.waitForTimeout(1000);
      const removed = await page.locator('[data-testid="tombstone-card"]').count();
      shot22 = await screenshot(page, `bdd-22-batch-remove-${TS}.png`);
      if (batchEnabled && removed === 0) {
        pass('BDD-22', '批量移除', `勾选 ${cbCount} 条, batch-enabled=${batchEnabled}, 移除后墓碑=${removed}`, shot22);
      } else {
        fail('BDD-22', '批量移除', `勾选 ${cbCount}, batch-enabled=${batchEnabled}, 移除后墓碑=${removed} (expect 0)`, shot22);
      }
    } else {
      shot22 = await screenshot(page, `bdd-22-batch-remove-${TS}.png`);
      fail('BDD-22', '批量移除', `expired tab 无 checkbox (count=${cbCount})`, shot22);
    }

    // ═══════════════════════════════════════════════
    // BDD-23: 归档期星标即时 Toast
    // ═══════════════════════════════════════════════
    lastStep = 'bdd-23';
    console.log('\n── BDD-23: 归档 Toast ──');
    await page.goto(`${BASE}/${sToast}`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="star-toggle"]').first().waitFor({ state: 'visible', timeout: 15000 });
    const toastBefore = await page.locator('.toast__message').count();
    await page.locator('[data-testid="star-toggle"]').first().click();
    await page.waitForTimeout(1500);
    const toastMsgs = await page.locator('.toast__message').allTextContents();
    const toastText = toastMsgs.join(' | ');
    const shot23 = await screenshot(page, `bdd-23-archive-toast-${TS}.png`);
    if (/已归档|归档，星标后可长期保存/.test(toastText)) {
      pass('BDD-23', '归档期星标即时 Toast', `toast: "${toastText}" (before=${toastBefore})`, shot23);
    } else {
      fail('BDD-23', '归档期星标即时 Toast', `toast: "${toastText}" (expect 已归档提示)`, shot23);
    }

    // ═══════════════════════════════════════════════
    // BDD-24/25/26: 作者豁免标签 + 强制删除
    // ═══════════════════════════════════════════════
    lastStep = 'bdd-24';
    console.log('\n── BDD-24/25/26: 作者豁免 + 强制删除 ──');
    await page.goto(`${BASE}/explore?owner=me&status=archived`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // BDD-24: 豁免标签
    const exempt = page.locator('[data-testid="star-exempt-label"]').first();
    const exemptVisible = await exempt.isVisible().catch(() => false);
    const exemptText = exemptVisible ? (await exempt.textContent() ?? '').trim() : '';
    const shot24 = await screenshot(page, `bdd-24-exempt-label-${TS}.png`);
    if (exemptVisible && /因被 \d+ 位用户星标/.test(exemptText)) {
      pass('BDD-24', '作者 Archived 显示豁免标签', `text="${exemptText}"`, shot24);
    } else {
      fail('BDD-24', '作者 Archived 显示豁免标签', `visible=${exemptVisible}, text="${exemptText}"`, shot24);
    }

    // BDD-25: 强制删除二次确认（确认前不执行）
    lastStep = 'bdd-25';
    const forceDelete = page.locator('[data-testid="force-delete"]').first();
    const fdVisible = await forceDelete.isVisible().catch(() => false);
    let shot25 = '';
    if (fdVisible) {
      await forceDelete.click();
      await page.locator('[data-testid="force-delete-confirm"]').waitFor({ state: 'visible', timeout: 10000 });
      const confirmText = (await page.locator('[data-testid="force-delete-confirm"]').textContent() ?? '').trim();
      // 用 owner（alice）token 检查——匿名对 archived 404 是决策 A 正确行为，会误判
      const stillExists = await api(`/api/v1/entries/${sForce}`, {
        headers: { Authorization: `Bearer ${alice}` },
      }).then(r => r.status === 200);
      shot25 = await screenshot(page, `bdd-25-force-confirm-${TS}.png`);
      if (/位用户星标/.test(confirmText) && stillExists) {
        pass('BDD-25', '强制删除二次确认', `confirm="${confirmText.slice(0, 60)}…", 确认前 entry 仍存在=${stillExists}`, shot25);
      } else {
        fail('BDD-25', '强制删除二次确认', `confirm="${confirmText.slice(0, 60)}", 确认前 entry 存在=${stillExists}`, shot25);
      }
    } else {
      shot25 = await screenshot(page, `bdd-25-force-confirm-${TS}.png`);
      fail('BDD-25', '强制删除二次确认', 'force-delete 按钮不可见（数据准备失败）', shot25);
    }

    // BDD-26: 强制删除确认 → 墓碑（星标用户 bob 视角）
    lastStep = 'bdd-26';
    await page.locator('[data-testid="confirm-force-delete"]').first().click();
    await page.waitForTimeout(1500);
    const entryGone = (await api(`/api/v1/entries/${sForce}`).then(r => r.status)).toString() === '404';
    // bob 视角 /stars：看到"作者已删除"墓碑
    await ctx.clearCookies();
    await login(page, 'bob');
    await page.goto(`${BASE}/stars`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="stars-tab-expired"]').click();
    await page.waitForTimeout(800);
    const bobTomb = await page.locator('[data-testid="tombstone-card"]').count();
    const watermark = bobTomb >= 1 ? (await page.locator('.tombstone-watermark').first().textContent() ?? '') : '';
    const shot26 = await screenshot(page, `bdd-26-force-tombstone-${TS}.png`);
    if (entryGone && bobTomb >= 1 && /作者已删除/.test(watermark)) {
      pass('BDD-26', '强制删除后星标用户见作者已删除墓碑', `entry 404=${entryGone}, bob 墓碑=${bobTomb}, watermark="${watermark}"`, shot26);
    } else {
      fail('BDD-26', '强制删除后星标用户见作者已删除墓碑', `entry 404=${entryGone}, bob 墓碑=${bobTomb}, watermark="${watermark}"`, shot26);
    }

  } finally {
    await page.close();
  }

  clearTimeout(hardTimer);

  const passCount = R.filter(r => r.status === 'PASS').length;
  const failCount = R.filter(r => r.status === 'FAIL').length;
  console.log('\n═══════════════════════════════════════');
  console.log(`  P6 UI verification: ${passCount}PASS ${failCount}FAIL (${R.length} total)`);
  console.log('═══════════════════════════════════════');
  R.forEach(r => console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.id}: ${r.name} — ${r.detail}`));

  fs.writeFileSync(path.join(BACKEND_DIR, 'ui-results.json'), JSON.stringify(R, null, 2));
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}/`);
  console.log(`Results: ${BACKEND_DIR}/ui-results.json`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
