import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

page.on('pageerror', err => {
  consoleMessages.push({ type: 'error', text: 'Page error: ' + err.message });
});

// First navigate to home, then click the entry
await page.goto('http://127.0.0.1:8888/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Click on the mermaid entry
await page.locator('a[href="/test-mermaid-md"]').click();
await page.waitForTimeout(5000);

console.log('=== Current URL ===');
console.log(page.url());

console.log('\n=== #app content (first 1000 chars) ===');
const appContent = await page.locator('#app').innerHTML();
console.log(appContent.substring(0, 1000));

console.log('\n=== Console Messages ===');
consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

await browser.close();
