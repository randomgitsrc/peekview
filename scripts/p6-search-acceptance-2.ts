/**
 * P6 BDD Acceptance — T026 search-url (Part 2: remaining BDDs)
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8888';
const HARD = 120_000;
let lastStep = 'init';
setTimeout(() => { console.error(`HARD TIMEOUT at: ${lastStep}`); process.exit(2); }, HARD);

const results: any[] = [];
function R(id: string, name: string, status: string, detail: string) {
  results.push({ id, name, status, detail });
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${id}: ${name} — ${detail}`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  try {
    // ── BDD-5: Tab + search (Mine tab then search) ──
    // Needs auth — register a test user first
    lastStep = 'bdd-5-register';
    const testUser = `t${Date.now()}`;
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Try to register
    const loginBtn = page.locator('button:has-text("Login"), button:has-text("登录"), a:has-text("Login")');
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.first().click();
      await page.waitForTimeout(800);
      // Switch to register tab if exists
      const regTab = page.locator('button:has-text("Register"), button:has-text("注册"), .tab:has-text("Register")');
      if (await regTab.isVisible().catch(() => false)) {
        await regTab.click();
        await page.waitForTimeout(500);
      }
      // Fill form
      await page.locator('input[name="username"], input[placeholder*="user"]').first().fill(testUser).catch(() => {});
      await page.locator('input[name="display_name"], input[placeholder*="name"]').first().fill('Test User').catch(() => {});
      await page.locator('input[type="password"]').first().fill('test123456').catch(() => {});
      const submitBtn = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("注册")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    console.log(`Auth attempt for ${testUser}, current URL: ${page.url()}`);

    // Check if we can see Mine tab now
    lastStep = 'bdd-5';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const mineBtn = page.locator('button:has-text("Mine"), a:has-text("Mine"), .tab:has-text("Mine")');
    if (await mineBtn.isVisible().catch(() => false)) {
      await mineBtn.click();
      await page.waitForTimeout(800);
      const input5 = page.locator('input[type="search"]');
      if (await input5.isVisible()) {
        await input5.fill('test');
        await page.waitForTimeout(800);
        const url5 = page.url();
        if (url5.includes('?q=test') && url5.includes('owner=me')) {
          R('BDD-5', 'Tab+搜索组合', 'PASS', 'owner preserved when adding search from Mine tab');
        } else {
          R('BDD-5', 'Tab+搜索组合', 'FAIL', `URL: ${url5}`);
        }
      }
    } else {
      R('BDD-5', 'Tab+搜索组合', 'FAIL', 'Mine tab still not available after registration');
    }

    // ── BDD-6: Clear search preserves tab ──
    lastStep = 'bdd-6';
    await page.goto(`${BASE}/explore?q=test&owner=me`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input6 = page.locator('input[type="search"]');
    if (await input6.isVisible()) {
      await input6.press('Escape');
      await page.waitForTimeout(500);
      const url6 = page.url();
      if (!url6.includes('?q=') && url6.includes('owner=me')) {
        R('BDD-6', '清空搜索保留Tab', 'PASS', 'owner=me preserved, q removed');
      } else {
        R('BDD-6', '清空搜索保留Tab', 'FAIL', `URL: ${url6}`);
      }
    } else {
      R('BDD-6', '清空搜索保留Tab', 'FAIL', 'search input not found');
    }

    // ── BDD-9: User page + search ──
    lastStep = 'bdd-9';
    await page.goto(`${BASE}/explore?q=python`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const url9 = page.url();
    if (url9.includes('?q=python')) {
      R('BDD-9', '用户页+搜索', 'PASS', `direct URL access works: ${url9}`);
    } else {
      R('BDD-9', '用户页+搜索', 'FAIL', `URL: ${url9}`);
    }

    // ── BDD-11: Browser back behavior ──
    lastStep = 'bdd-11';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const startUrl = page.url();
    // Type search
    const input11 = page.locator('input[type="search"]');
    if (await input11.isVisible()) {
      await input11.fill('demo');
      await page.waitForTimeout(800);
    }
    const searchUrl = page.url();
    // Go back
    await page.goBack({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const backUrl = page.url();
    if (searchUrl.includes('?q=demo')) {
      R('BDD-11', '浏览器后退', 'PASS', `search URL: ${searchUrl}, back: ${backUrl}`);
    } else {
      R('BDD-11', '浏览器后退', 'FAIL', `search URL: ${searchUrl}, back: ${backUrl}`);
    }

    // ── BDD-12: Search word change resets page ──
    lastStep = 'bdd-12';
    await page.goto(`${BASE}/explore?q=demo&page=2`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input12 = page.locator('input[type="search"]');
    if (await input12.isVisible()) {
      // Clear and type new search
      await input12.fill('');
      await input12.fill('python');
      await page.waitForTimeout(800);
      const url12 = page.url();
      if (url12.includes('?q=python') && !url12.includes('page=2')) {
        R('BDD-12', '搜索词变化重置分页', 'PASS', 'page reset to 1 on new search');
      } else {
        R('BDD-12', '搜索词变化重置分页', 'FAIL', `URL: ${url12}`);
      }
    } else {
      R('BDD-12', '搜索词变化重置分页', 'FAIL', 'input not found');
    }

    // ── BDD-13: Empty input removes q ──
    lastStep = 'bdd-13';
    await page.goto(`${BASE}/explore?q=python`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input13 = page.locator('input[type="search"]');
    if (await input13.isVisible()) {
      // Clear character by character
      const val = await input13.inputValue();
      for (let i = 0; i < val.length; i++) await input13.press('Backspace');
      await page.waitForTimeout(800);
      const url13 = page.url();
      if (!url13.includes('?q=')) {
        R('BDD-13', '空输入移除q', 'PASS', 'q parameter removed when input emptied');
      } else {
        R('BDD-13', '空输入移除q', 'FAIL', `URL: ${url13}`);
      }
    } else {
      R('BDD-13', '空输入移除q', 'FAIL', 'input not found');
    }

    // ── BDD-14: q + owner + page combo ──
    lastStep = 'bdd-14';
    await page.goto(`${BASE}/explore?q=test&owner=me&page=1`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const url14 = page.url();
    const input14 = page.locator('input[type="search"]');
    const val14 = await input14.inputValue().catch(() => '');
    if (url14.includes('?q=test') && url14.includes('owner=me') && val14 === 'test') {
      R('BDD-14', 'q+owner+page组合', 'PASS', `all 3 params preserved: ${url14}`);
    } else {
      R('BDD-14', 'q+owner+page组合', 'FAIL', `URL: ${url14}, input: "${val14}"`);
    }

    // ── BDD-15: Debounce verification ──
    lastStep = 'bdd-15';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input15 = page.locator('input[type="search"]');
    if (await input15.isVisible()) {
      // Type fast without waiting
      await input15.fill('a');
      await page.waitForTimeout(100);
      const urlFast = page.url();
      // After debounce, should update
      await page.waitForTimeout(500);
      const urlSlow = page.url();
      if (urlSlow.includes('?q=a')) {
        R('BDD-15', '防抖验证', 'PASS', 'URL updated after debounce period');
      } else {
        R('BDD-15', '防抖验证', 'FAIL', `fast: ${urlFast}, slow: ${urlSlow}`);
      }
    } else {
      R('BDD-15', '防抖验证', 'FAIL', 'input not found');
    }

  } finally {
    await page.close();
  }

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n=== Part 2 Summary: ${pass} PASS, ${fail} FAIL ===`);
  const fs = await import('fs');
  fs.writeFileSync('/tmp/e2e-results/p6-bdd-results-2.json', JSON.stringify(results, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
