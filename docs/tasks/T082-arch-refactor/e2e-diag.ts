import { chromium } from 'playwright';
const HARD = 90_000; let lastStep = 'init'; const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2); }, HARD);

const BASE = 'http://127.0.0.1:8888';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  try {
    // === 诊断 BDD-23/24：详情页渲染 ===
    lastStep = 'diag detail page';
    await page.goto(`${BASE}/xfyerr`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000); // wait for SPA render

    // 截图看实际渲染
    await page.screenshot({ path: '/tmp/t082-detail-diag.png', fullPage: false });

    // 列出页面主要元素
    const elements = await page.evaluate(() => {
      const bodyChildren = Array.from(document.body.children).map(e => e.tagName + '.' + (e.className || '').slice(0, 80));
      const root = document.querySelector('#app') as HTMLElement;
      const rootHTML = root ? root.innerHTML.slice(0, 500) : 'NO #app';
      const allClasses = Array.from(document.querySelectorAll('[class]'))
        .map(e => (e.className as string).slice(0, 60))
        .filter(c => c.includes('detail') || c.includes('entry') || c.includes('view'))
        .slice(0, 20);
      return { bodyChildren, rootHTML, allClasses, readyState: document.readyState };
    });
    console.log('=== BDD-23/24 诊断 ===');
    console.log('readyState:', elements.readyState);
    console.log('bodyChildren:', JSON.stringify(elements.bodyChildren, null, 2));
    console.log('rootHTML (first 500):', elements.rootHTML);
    console.log('detail/entry/view classes:', JSON.stringify(elements.allClasses, null, 2));

    // === 诊断 BDD-7/8：错误格式 ===
    lastStep = 'diag error format';
    const errorResp = await page.evaluate(async () => {
      const r = await fetch('/api/v1/entries?status=invalid');
      const data = await r.json();
      return { status: r.status, data, hasError: 'error' in data, hasDetail: 'detail' in data };
    });
    console.log('\n=== BDD-7/8 诊断 ===');
    console.log('status:', errorResp.status);
    console.log('data:', JSON.stringify(errorResp.data, null, 2));
    console.log('hasError:', errorResp.hasError, 'hasDetail:', errorResp.hasDetail);
    // 正确判定：有 error 字段且无 detail 字段 = PASS
    const bdd78Pass = errorResp.hasError === true && errorResp.hasDetail === false;
    console.log('BDD-7/8 判定:', bdd78Pass ? 'PASS' : 'FAIL');

  } finally {
    await page.close();
    clearTimeout(hardTimer);
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
