import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Light mode screenshot
await page.screenshot({ path: '/tmp/mermaid-light.png', fullPage: true });

// Get SVG style content
const lightStyles = await page.locator('.mermaid-block style').innerHTML();
console.log('=== Light mode styles (first 200 chars) ===');
console.log(lightStyles.substring(0, 200));

// Click dark mode button
await page.locator('button[title="Switch to dark mode"]').click();
await page.waitForTimeout(3000);

// Dark mode screenshot
await page.screenshot({ path: '/tmp/mermaid-dark.png', fullPage: true });

// Get SVG style content
const darkStyles = await page.locator('.mermaid-block style').innerHTML();
console.log('\n=== Dark mode styles (first 200 chars) ===');
console.log(darkStyles.substring(0, 200));

// Check for dark theme indicators
console.log('\n=== Theme indicators ===');
console.log('Light has #333:', lightStyles.includes('#333'));
console.log('Dark has #333:', darkStyles.includes('#333'));
console.log('Dark has #eee or #ccc:', darkStyles.includes('#eee') || darkStyles.includes('#ccc'));

await browser.close();
