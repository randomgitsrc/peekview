import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Collect console messages
const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

page.on('pageerror', err => {
  consoleMessages.push({ type: 'error', text: 'Page error: ' + err.message });
});

// Log failed requests
page.on('response', response => {
  if (response.status() >= 400) {
    console.log(`[HTTP ${response.status()}] ${response.url()}`);
  }
});

await page.goto('http://127.0.0.1:8888/entry/test-mermaid-md', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

// Check if app is loaded
const appContent = await page.locator('#app').innerHTML();
console.log('=== #app content ===');
console.log(appContent.substring(0, 2000));

// Check for specific elements
console.log('\n=== Element checks ===');
console.log('.entry-detail:', await page.locator('.entry-detail').count());
console.log('.markdown-viewer:', await page.locator('.markdown-viewer').count());
console.log('.markdown-body:', await page.locator('.markdown-body').count());

// Check console
console.log('\n=== Console Messages ===');
consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

await browser.close();
