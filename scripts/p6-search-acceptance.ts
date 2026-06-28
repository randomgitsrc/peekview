/**
 * P6 BDD Acceptance — T026 search-url
 * 通过 Chrome CDP 直连真实浏览器，验证搜索 URL 化功能。
 * 使用 playwright-vision skill 标准模式。
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8888';
const HARD = 120_000;
let lastStep = 'init';

const hardTimer = setTimeout(() => {
  console.error(`HARD TIMEOUT at: ${lastStep}`);
  process.exit(2);
}, HARD);

interface BDDResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  screenshot?: string;
}

const results: BDDResult[] = [];

function record(id: string, name: string, status: 'PASS' | 'FAIL', detail: string, screenshot?: string) {
  results.push({ id, name, status, detail, screenshot });
  const mark = status === 'PASS' ? '✅' : '❌';
  console.log(`${mark} ${id}: ${name} — ${detail}`);
}

async function main() {
  // Connect to Chrome via CDP
  lastStep = 'connect';
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  try {
    // ── Health check ──
    lastStep = 'health-check';
    await page.goto(`${BASE}/health`, { timeout: 10000 });
    const healthOk = await page.textContent('body');
    console.log(`Health: ${healthOk?.substring(0, 80)}`);

    // ── BDD-1: Basic search with debounce ──
    lastStep = 'bdd-1';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="search"]', { timeout: 5000 }).catch(() => {});
    const searchInput = page.locator('input[type="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('python');
      await page.waitForTimeout(800); // 300ms debounce + margin
      const url1 = page.url();
      if (url1.includes('?q=python')) {
        record('BDD-1', '防抖搜索更新URL', 'PASS', `URL contains ?q=python`);
      } else {
        record('BDD-1', '防抖搜索更新URL', 'FAIL', `URL: ${url1}`);
      }
      await page.screenshot({ path: '/tmp/e2e-results/bdd1-search-python.png', fullPage: false });
    } else {
      record('BDD-1', '防抖搜索更新URL', 'FAIL', 'search input not found');
    }

    // ── BDD-2: Enter immediate trigger ──
    lastStep = 'bdd-2';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input2 = page.locator('input[type="search"]');
    if (await input2.isVisible()) {
      await input2.fill('react');
      await input2.press('Enter');
      await page.waitForTimeout(500);
      const url2 = page.url();
      if (url2.includes('?q=react')) {
        record('BDD-2', 'Enter立即触发', 'PASS', 'URL updated immediately on Enter');
      } else {
        record('BDD-2', 'Enter立即触发', 'FAIL', `URL: ${url2}`);
      }
    } else {
      record('BDD-2', 'Enter立即触发', 'FAIL', 'search input not found');
    }

    // ── BDD-3: Esc clears search ──
    lastStep = 'bdd-3';
    await page.goto(`${BASE}/explore?q=something`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const input3 = page.locator('input[type="search"]');
    if (await input3.isVisible()) {
      const valBefore = await input3.inputValue();
      await input3.press('Escape');
      await page.waitForTimeout(500);
      const url3 = page.url();
      const valAfter = await input3.inputValue().catch(() => '');
      if (!url3.includes('?q=') && valAfter === '') {
        record('BDD-3', 'Esc清空搜索', 'PASS', 'URL q removed, input cleared');
      } else {
        record('BDD-3', 'Esc清空搜索', 'FAIL', `URL: ${url3}, input: "${valAfter}"`);
      }
    } else {
      record('BDD-3', 'Esc清空搜索', 'FAIL', 'search input not found');
    }

    // ── BDD-4: Search + tab combination ──
    lastStep = 'bdd-4';
    await page.goto(`${BASE}/explore?q=python`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // Click "Mine" tab if available
    const mineBtn = page.locator('button:has-text("Mine"), a:has-text("Mine"), .tab:has-text("Mine")');
    if (await mineBtn.isVisible().catch(() => false)) {
      await mineBtn.click();
      await page.waitForTimeout(800);
      const url4 = page.url();
      if (url4.includes('?q=python') && url4.includes('owner=me')) {
        record('BDD-4', '搜索+Tab组合', 'PASS', 'q preserved when switching to Mine tab');
      } else {
        record('BDD-4', '搜索+Tab组合', 'FAIL', `URL: ${url4}`);
      }
    } else {
      record('BDD-4', '搜索+Tab组合', 'FAIL', 'Mine tab button not found (auth required?)');
    }

    // ── BDD-7: Search + pagination ──
    lastStep = 'bdd-7';
    await page.goto(`${BASE}/explore?q=demo&page=2`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const url7 = page.url();
    if (url7.includes('?q=demo') && url7.includes('page=2')) {
      record('BDD-7', '搜索+分页', 'PASS', `URL preserves both q and page: ${url7}`);
    } else {
      record('BDD-7', '搜索+分页', 'FAIL', `URL: ${url7}`);
    }

    // ── BDD-8: Direct URL access with search ──
    lastStep = 'bdd-8';
    await page.goto(`${BASE}/explore?q=NoMatchXYZ123`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const input8 = page.locator('input[type="search"]');
    const inputVal = await input8.inputValue().catch(() => '');
    if (inputVal === 'NoMatchXYZ123') {
      record('BDD-8', '直接URL访问搜索', 'PASS', `input restored from URL: "${inputVal}"`);
    } else {
      record('BDD-8', '直接URL访问搜索', 'FAIL', `input value: "${inputVal}", expected NoMatchXYZ123`);
    }
    await page.screenshot({ path: '/tmp/e2e-results/bdd8-empty-search.png', fullPage: false });

    // ── BDD-16: a11y check ──
    lastStep = 'bdd-16';
    await page.goto(`${BASE}/explore`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const ariaLabel = await page.locator('input[type="search"]').getAttribute('aria-label').catch(() => null);
    const roleSearch = await page.locator('[role="search"]').count().catch(() => 0);
    if (ariaLabel && roleSearch > 0) {
      record('BDD-16', '无障碍', 'PASS', `aria-label="${ariaLabel}", role="search" x${roleSearch}`);
    } else {
      record('BDD-16', '无障碍', 'FAIL', `aria-label: ${ariaLabel}, role=search: ${roleSearch}`);
    }

    // ── Summary screenshot ──
    lastStep = 'screenshot';
    await page.goto(`${BASE}/explore?q=python`, { timeout: 15000, waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/e2e-results/search-summary.png', fullPage: true });
    console.log('Screenshot saved: /tmp/e2e-results/search-summary.png');

  } finally {
    await page.close();
  }

  clearTimeout(hardTimer);

  // ── Print summary ──
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n=== P6 BDD Acceptance Summary ===`);
  console.log(`Total: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);
  for (const r of results) {
    console.log(`  ${r.status === 'PASS' ? '✅' : '❌'} ${r.id}: ${r.name} — ${r.detail}`);
  }

  // Write results JSON for P6-acceptance.md
  const fs = await import('fs');
  fs.writeFileSync('/tmp/e2e-results/p6-bdd-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults written to /tmp/e2e-results/p6-bdd-results.json');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
