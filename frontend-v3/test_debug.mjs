import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture console messages
const messages = [];
page.on('console', msg => {
  const text = `[${msg.type()}] ${msg.text()}`;
  messages.push(text);
  console.log(text);
});

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

console.log('\n=== Initial load complete ===\n');

// Switch to dark mode
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(3000);

console.log('\n=== After dark mode click ===\n');

await page.screenshot({ path: '/tmp/mermaid-debug.png', fullPage: true });

await browser.close();

console.log('\n=== All console messages ===');
messages.filter(m => m.includes('[Mermaid]')).forEach(m => console.log(m));
