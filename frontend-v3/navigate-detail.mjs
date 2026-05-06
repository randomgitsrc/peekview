import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// First go to home, then click entry
await page.goto('http://127.0.0.1:8888/');
await page.waitForTimeout(2000);

// Click on UI Test Entry
await page.click('text=UI Test Entry');
await page.waitForTimeout(3000);

await page.screenshot({ path: '/tmp/e2e-results/detail-clicked.png', fullPage: true });
console.log('Screenshot saved');

await browser.close();
