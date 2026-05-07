import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

console.log('=== Initial state ===');
const initialRendered = await page.locator('.mermaid-viewer-mount').evaluate(el => el.dataset.rendered);
console.log('data-rendered:', initialRendered);

const initialSvg = await page.locator('.mermaid-block svg').count();
console.log('SVG count:', initialSvg);

// Switch to dark mode
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(3000);

console.log('\n=== After dark mode ===');
const afterRendered = await page.locator('.mermaid-viewer-mount').evaluate(el => el.dataset.rendered);
console.log('data-rendered:', afterRendered);

const afterSvg = await page.locator('.mermaid-block svg').count();
console.log('SVG count:', afterSvg);

// Check if the element was recreated or reused
const elementId = await page.locator('.mermaid-block').evaluate(el => el.id);
console.log('Element ID:', elementId);

await browser.close();
