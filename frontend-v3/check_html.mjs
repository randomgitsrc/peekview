import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/entry/test-mermaid-md', { waitUntil: 'networkidle', timeout: 10000 });
await page.waitForTimeout(3000);

// Get full HTML
const html = await page.content();

// Find the markdown body content
console.log('\n=== Full HTML (first 3000 chars) ===');
console.log(html.substring(0, 3000));

console.log('\n=== Looking for code blocks ===');
const preBlocks = await page.locator('pre').count();
console.log(`<pre> blocks found: ${preBlocks}`);

const codeBlocks = await page.locator('code').count();
console.log(`<code> blocks found: ${codeBlocks}`);

// Get the content text
const content = await page.locator('.markdown-body').innerHTML().catch(() => 'Not found');
console.log('\n=== Markdown body innerHTML ===');
console.log(content.substring(0, 2000));

await browser.close();
