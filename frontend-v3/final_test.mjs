import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Light mode screenshot
await page.screenshot({ path: '/tmp/mermaid-final-light.png', fullPage: true });

// Switch to dark mode
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(3000);

// Dark mode screenshot
await page.screenshot({ path: '/tmp/mermaid-final-dark.png', fullPage: true });

console.log('Screenshots saved!');

await browser.close();
