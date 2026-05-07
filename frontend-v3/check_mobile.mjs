import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 } }); // iPhone SE size
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Check header actions (should only have theme toggle and TOC)
const headerButtons = await page.locator('.detail-header .header-right .actions.desktop-only').count();
console.log('Header actions visible:', headerButtons === 0 ? 'No (correct for mobile)' : 'Yes (incorrect)');

// Check mobile actions bar (should exist at bottom)
const mobileActions = await page.locator('.mobile-actions').count();
console.log('Mobile actions bar visible:', mobileActions === 1 ? 'Yes (correct)' : 'No (incorrect)');

// Take screenshot
await page.screenshot({ path: '/tmp/mobile-view.png', fullPage: true });
console.log('Mobile screenshot saved');

await browser.close();
