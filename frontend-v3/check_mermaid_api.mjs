import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/hq9hbu', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Check mermaid global object and its config
const mermaidInfo = await page.evaluate(() => {
  const info = {
    mermaidExists: typeof window.mermaid !== 'undefined',
    mermaidVersion: window.mermaid?.version,
    config: window.mermaid?.mermaidAPI?.getConfig?.(),
    apiExists: typeof window.mermaid?.mermaidAPI !== 'undefined'
  };
  return info;
});

console.log('Mermaid info:', JSON.stringify(mermaidInfo, null, 2));

await browser.close();
