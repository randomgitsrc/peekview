import { chromium } from 'playwright';

const HARD = 60_000;
let lastStep = 'init';
const hardTimer = setTimeout(() => {
  console.error(`HARD TIMEOUT at: ${lastStep}`);
  process.exit(2);
}, HARD);

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  try {
    lastStep = 'goto';
    await page.goto('http://127.0.0.1:8888/diagram-test-2', { timeout: 15000 });
    
    lastStep = 'wait-for-render';
    // Wait for mermaid to render
    await page.waitForTimeout(3000);
    
    lastStep = 'screenshot';
    await page.screenshot({ path: '/tmp/diagram-test.png', fullPage: true });
    console.log('Screenshot: /tmp/diagram-test.png');
    
    // Check for diagram block
    const hasDiagramBlock = await page.locator('.diagram-block').count() > 0;
    console.log('Has .diagram-block:', hasDiagramBlock);
    
    const hasMermaidLabel = await page.locator('.diagram-label').textContent().catch(() => '');
    console.log('Diagram label:', hasMermaidLabel);
    
    const hasViewer = await page.locator('.diagram-viewer').count() > 0;
    console.log('Has .diagram-viewer:', hasViewer);
    
    const hasSvg = await page.locator('.diagram-viewer svg').count() > 0;
    console.log('Has SVG rendered:', hasSvg);
    
  } finally {
    await page.close();
  }

  clearTimeout(hardTimer);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
