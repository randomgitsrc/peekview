import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Listen to console
page.on('console', msg => console.log('[console]', msg.text()));

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

console.log('=== Light mode ===');
const lightSvg = await page.locator('.mermaid-block svg').innerHTML();
console.log('Light SVG contains #333:', lightSvg.includes('#333'));
console.log('Light SVG contains #eee:', lightSvg.includes('#eee'));

// Check for node fill colors
console.log('Light node fill:', lightSvg.match(/fill:#[a-f0-9]{6}/gi)?.slice(0, 5));

await page.screenshot({ path: '/tmp/mermaid-light2.png', fullPage: true });

// Click dark mode
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(5000);  // Wait longer for re-render

console.log('\n=== Dark mode ===');
const darkSvg = await page.locator('.mermaid-block svg').innerHTML();
console.log('Dark SVG contains #333:', darkSvg.includes('#333'));
console.log('Dark SVG contains #eee:', darkSvg.includes('#eee'));
console.log('Dark node fill:', darkSvg.match(/fill:#[a-f0-9]{6}/gi)?.slice(0, 5));

await page.screenshot({ path: '/tmp/mermaid-dark2.png', fullPage: true });

await browser.close();
