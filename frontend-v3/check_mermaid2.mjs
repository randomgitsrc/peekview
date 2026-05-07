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
await page.waitForTimeout(2000);

// Click on the mermaid entry
await page.locator('a[href="/hq9hbu"]').click();
await page.waitForTimeout(5000);

console.log('=== Current URL ===');
console.log(page.url());

console.log('\n=== Checking elements ===');
console.log('.entry-detail:', await page.locator('.entry-detail').count());
console.log('.markdown-viewer:', await page.locator('.markdown-viewer').count());
console.log('.mermaid-block:', await page.locator('.mermaid-block').count());
console.log('.mermaid-block svg:', await page.locator('.mermaid-block svg').count());

// Get HTML content of markdown body
const markdownHtml = await page.locator('.markdown-body').innerHTML().catch(() => 'Not found');
console.log('\n=== Markdown body HTML (first 1500 chars) ===');
console.log(markdownHtml.substring(0, 1500));

console.log('\n=== Console Messages ===');
consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));

await browser.close();
