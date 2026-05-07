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

await page.goto('http://127.0.0.1:8888/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const html = await page.content();
console.log('=== Page title ===');
console.log(await page.title());

console.log('\n=== #app content (first 500 chars) ===');
const appContent = await page.locator('#app').innerHTML();
console.log(appContent.substring(0, 500));

console.log('\n=== Console Messages ===');
consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

await browser.close();
