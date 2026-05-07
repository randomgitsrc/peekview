import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Collect console messages
const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});

page.on('pageerror', err => {
  consoleMessages.push({ type: 'error', text: 'Page error: ' + err.message });
});

try {
  await page.goto('http://127.0.0.1:8888/entry/test-mermaid-md', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Check for mermaid blocks
  const mermaidBlocks = await page.locator('.mermaid-block').count();
  console.log(`Mermaid blocks found: ${mermaidBlocks}`);
  
  // Check for SVG in mermaid blocks
  const svgs = await page.locator('.mermaid-block svg').count();
  console.log(`SVGs found in mermaid blocks: ${svgs}`);
  
  // Get HTML content
  const html = await page.content();
  console.log('\n=== HTML around mermaid ===');
  const mermaidIndex = html.indexOf('mermaid-block');
  if (mermaidIndex > 0) {
    console.log(html.substring(Math.max(0, mermaidIndex - 200), mermaidIndex + 500));
  } else {
    console.log('No mermaid-block found in HTML');
  }
  
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(m => console.log(`[${m.type}] ${m.text}`));
  
} catch (e) {
  console.error('Error:', e.message);
}

await browser.close();
