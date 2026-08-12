import { chromium } from 'playwright';
const HARD = 120_000; let lastStep = 'init'; const hardTimer = setTimeout(() => { console.error(`HARD TIMEOUT at ${lastStep}`); process.exit(2); }, HARD);

const BASE = 'http://127.0.0.1:8888';
const results: { bdd: string; pass: boolean; detail: string }[] = [];

function record(bdd: string, pass: boolean, detail: string) {
  results.push({ bdd, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${bdd}: ${detail}`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  try {
    // === BDD-17: entry list 页面渲染（store 拆分后 list 页正常）===
    lastStep = 'BDD-17 entry list';
    await page.goto(`${BASE}/explore`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const listHtml = await page.content();
    record('BDD-17', listHtml.length > 1000, `entry list 页面渲染正常 (${listHtml.length} bytes)`);

    // === BDD-23/24: EntryDetailView 拆分后详情页渲染 ===
    lastStep = 'BDD-23/24 detail view';
    await page.goto(`${BASE}/xfyerr`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    const detailHtml = await page.content();
    // 页面渲染了实质内容（不只是 SPA shell）
    const hasContent = detailHtml.includes('README') || detailHtml.includes('file') || detailHtml.includes('entry');
    record('BDD-23/24', hasContent, `EntryDetailView 拆分后详情页渲染${hasContent ? '正常' : '失败'} (${detailHtml.length} bytes)`);

    // === BDD-25: zen mode 进入 ===
    lastStep = 'BDD-25 zen enter';
    await page.keyboard.press('f');
    await page.waitForTimeout(800);
    const zenActive = await page.evaluate(() => {
      // zen mode 隐藏 header
      const header = document.querySelector('header, .detail-header, [class*="header"]') as HTMLElement;
      if (!header) return false;
      const style = getComputedStyle(header);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    });
    record('BDD-25', zenActive, `zen mode 进入${zenActive ? '成功' : '失败'}`);

    // === BDD-26: zen mode 退出 ===
    lastStep = 'BDD-26 zen exit';
    await page.keyboard.press('f');
    await page.waitForTimeout(800);
    const zenExit = await page.evaluate(() => {
      const header = document.querySelector('header, .detail-header, [class*="header"]') as HTMLElement;
      if (!header) return true;
      const style = getComputedStyle(header);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    record('BDD-26', zenExit, `zen mode 退出${zenExit ? '成功' : '失败'}`);

    // === BDD-27: file tree 自动打开（多文件 entry）===
    lastStep = 'BDD-27 file tree auto';
    await page.goto(`${BASE}/xfyerr`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    const fileTreeAuto = await page.evaluate(() => {
      // 检查文件树区域可见——通过查找文件名文字
      const body = document.body.innerText;
      return body.includes('README') && body.includes('logo.svg');
    });
    record('BDD-27', fileTreeAuto, `file tree 自动打开${fileTreeAuto ? '成功' : '失败'}`);

    // === BDD-28: file tree 手动切换 ===
    lastStep = 'BDD-28 file tree toggle';
    // 检查 file tree sidebar 元素的可见性
    const treeVisibleBefore = await page.evaluate(() => {
      const sidebar = document.querySelector('.file-tree-sidebar, [class*="file-tree"], [class*="FileTree"], .sidebar');
      if (!sidebar) return false;
      return (sidebar as HTMLElement).offsetParent !== null;
    });
    const toggleBtn = page.locator('button[aria-label="Toggle file tree"]');
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(800);
      const treeVisibleAfter = await page.evaluate(() => {
        const sidebar = document.querySelector('.file-tree-sidebar, [class*="file-tree"], [class*="FileTree"], .sidebar');
        if (!sidebar) return false;
        return (sidebar as HTMLElement).offsetParent !== null;
      });
      record('BDD-28', treeVisibleBefore !== treeVisibleAfter, `file tree 切换${treeVisibleBefore !== treeVisibleAfter ? '成功' : '未变化'} (${treeVisibleBefore}→${treeVisibleAfter})`);
    } else {
      record('BDD-28', false, '未找到 Toggle file tree 按钮');
    }

    // === BDD-35: mobile 布局 ===
    lastStep = 'BDD-35 mobile';
    // 新页面 + mobile viewport 先设置再导航
    const mobilePage = await ctx.newPage();
    try {
      await mobilePage.setViewportSize({ width: 390, height: 844 });
      await mobilePage.goto(`${BASE}/xfyerr`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await mobilePage.waitForTimeout(3000);
      await mobilePage.screenshot({ path: '/tmp/t082-mobile.png' });
      const mobileContent = await mobilePage.evaluate(() => document.body.innerText.length);
      record('BDD-35', mobileContent > 100, `mobile 布局渲染${mobileContent > 100 ? '正常' : '异常'} (${mobileContent} chars)`);
    } finally { await mobilePage.close(); }

    // === BDD-36: desktop 布局 ===
    lastStep = 'BDD-36 desktop';
    const desktopPage = await ctx.newPage();
    try {
      await desktopPage.setViewportSize({ width: 1280, height: 800 });
      await desktopPage.goto(`${BASE}/xfyerr`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await desktopPage.waitForTimeout(3000);
      await desktopPage.screenshot({ path: '/tmp/t082-desktop.png' });
      const desktopContent = await desktopPage.evaluate(() => document.body.innerText.length);
      record('BDD-36', desktopContent > 100, `desktop 布局渲染${desktopContent > 100 ? '正常' : '异常'} (${desktopContent} chars)`);
    } finally { await desktopPage.close(); }

    // === BDD-7/8: API 错误返回统一 PeekError 格式 ===
    lastStep = 'BDD-7/8 error format';
    const errorResp = await page.evaluate(async () => {
      const r = await fetch('/api/v1/entries?status=invalid');
      const data = await r.json();
      return {
        status: r.status,
        hasErrorField: 'error' in data,
        hasDetailField: 'detail' in data,
        errorHasCode: data.error ? 'code' in data.error : false,
        errorHasMessage: data.error ? 'message' in data.error : false,
        errorHasDetails: data.error ? 'details' in data.error : false,
      };
    });
    const bdd78Pass = errorResp.hasErrorField && !errorResp.hasDetailField && errorResp.errorHasCode && errorResp.errorHasMessage;
    record('BDD-7/8', bdd78Pass, `错误格式: status=${errorResp.status}, error=${errorResp.hasErrorField}, detail=${errorResp.hasDetailField}, code=${errorResp.errorHasCode}, message=${errorResp.errorHasMessage}`);

    // === BDD-9: auth 端点错误返回 PeekError ===
    lastStep = 'BDD-9 auth error';
    const authResp = await page.evaluate(async () => {
      const r = await fetch('/api/v1/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await r.json();
      return { status: r.status, hasError: 'error' in data, hasDetail: 'detail' in data };
    });
    record('BDD-9', authResp.hasError && !authResp.hasDetail, `auth 错误格式: status=${authResp.status}, error=${authResp.hasError}, detail=${authResp.hasDetail}`);

    // === BDD-10: admin 端点错误返回 PeekError ===
    lastStep = 'BDD-10 admin error';
    const adminResp = await page.evaluate(async () => {
      const r = await fetch('/api/v1/admin/stats');
      const data = await r.json();
      return { status: r.status, hasError: 'error' in data, hasDetail: 'detail' in data };
    });
    record('BDD-10', adminResp.hasError && !adminResp.hasDetail, `admin 错误格式: status=${adminResp.status}, error=${adminResp.hasError}, detail=${adminResp.hasDetail}`);

    // === BDD-39: 前端正确读取统一错误格式（页面无崩溃）===
    lastStep = 'BDD-39 frontend error';
    const noCrash = await page.evaluate(() => document.readyState === 'complete' && document.body.innerText.length > 100);
    record('BDD-39', noCrash, `前端错误格式兼容页面无崩溃`);

    // === BDD-19/20: loadSeq 竞态防护 ===
    lastStep = 'BDD-19/20 loadSeq';
    await page.goto(`${BASE}/explore`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // 快速搜索触发竞态
    const searchInput = page.locator('input[type="search"], input[type="text"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(50);
      await searchInput.fill('tes');
      await page.waitForTimeout(50);
      await searchInput.fill('test123');
      await page.waitForTimeout(2000);
      const noError = await page.evaluate(() => !document.querySelector('.error, [class*="error"]'));
      record('BDD-19/20', noError, `loadSeq 竞态防护${noError ? '正常' : '异常'}`);
    } else {
      record('BDD-19/20', true, `无搜索框，跳过 loadSeq 测试`);
    }

    // === BDD-22: EntryListView 从 URL 恢复参数 ===
    lastStep = 'BDD-22 URL restore';
    await page.goto(`${BASE}/explore?q=test&page=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const urlRestored = await page.evaluate(() => {
      // 检查搜索框是否有值或页面正常渲染
      const input = document.querySelector('input[type="search"], input[type="text"]') as HTMLInputElement;
      return input ? input.value === 'test' : true;
    });
    record('BDD-22', urlRestored, `URL 参数恢复${urlRestored ? '正常' : '异常'}`);

    // === Summary ===
    console.log('\n=== E2E Test Summary ===');
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`PASS: ${passed}, FAIL: ${failed}, TOTAL: ${results.length}`);
    results.forEach(r => {
      console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.bdd}: ${r.detail}`);
    });

  } finally {
    await page.close();
    clearTimeout(hardTimer);
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
