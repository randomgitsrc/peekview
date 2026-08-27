import { chromium } from 'playwright';

const HARD = 30_000;
let lastStep = 'init';
const hardTimer = setTimeout(() => {
  console.error(`HARD TIMEOUT at: ${lastStep}`);
  process.exit(2);
}, HARD);

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  try {
    lastStep = 'goto';
    await page.goto('https://example.com', { timeout: 15000 });
    
    lastStep = 'title';
    const title = await page.title();
    console.log(`Title: ${title}`);
    
    lastStep = 'screenshot';
    await page.screenshot({ path: '/tmp/cdp-smoke.png' });
    console.log('Screenshot: /tmp/cdp-smoke.png');
  } finally {
    await page.close();
  }

  clearTimeout(hardTimer);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
