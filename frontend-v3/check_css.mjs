import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Check computed style of desktop-only element
const display = await page.locator('.desktop-only').evaluate(el => {
  return window.getComputedStyle(el).display;
});
console.log('desktop-only display:', display);

// Check if element is visible
const isVisible = await page.locator('.desktop-only').isVisible();
console.log('desktop-only isVisible:', isVisible);

await browser.close();
