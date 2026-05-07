import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Light mode screenshot
await page.screenshot({ path: '/tmp/mermaid-light.png', fullPage: true });
console.log('Light mode screenshot saved');

// Get SVG content in light mode
const lightSvg = await page.locator('.mermaid-block svg').innerHTML();
console.log('\n=== Light mode SVG (first 500 chars) ===');
console.log(lightSvg.substring(0, 500));

// Click dark mode button
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(3000);

// Dark mode screenshot
await page.screenshot({ path: '/tmp/mermaid-dark.png', fullPage: true });
console.log('Dark mode screenshot saved');

// Get SVG content in dark mode
const darkSvg = await page.locator('.mermaid-block svg').innerHTML();
console.log('\n=== Dark mode SVG (first 500 chars) ===');
console.log(darkSvg.substring(0, 500));

console.log('\n=== SVG comparison ===');
console.log('Are SVGs identical?', lightSvg === darkSvg);
console.log('Light SVG length:', lightSvg.length);
console.log('Dark SVG length:', darkSvg.length);

await browser.close();
