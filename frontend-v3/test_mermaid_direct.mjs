import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Test mermaid directly by importing it
const result = await page.evaluate(async () => {
  // Import mermaid dynamically
  const mermaid = await import('/assets/mermaid-*.js');
  return {
    mermaidDefault: typeof mermaid.default,
    mermaidKeys: Object.keys(mermaid),
  };
});

console.log('Import result:', result);

await browser.close();
