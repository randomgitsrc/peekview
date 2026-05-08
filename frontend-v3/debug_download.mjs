import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture console messages
page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => console.error('[page error]', err.message));

await page.goto('http://127.0.0.1:8888/jmnru9', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Test the download function directly
const result = await page.evaluate(async () => {
  const blockId = 'mermaid-block-0';
  const block = document.getElementById(blockId);
  if (!block) return { error: 'Block not found' };

  const mountPoint = block.querySelector('.mermaid-viewer-mount');
  if (!mountPoint) return { error: 'Mount point not found' };

  const svg = mountPoint.querySelector('svg');
  if (!svg) return { error: 'SVG not found' };

  try {
    const clonedSvg = svg.cloneNode(true);
    
    // Check if namespace is set
    const hasNs = !!clonedSvg.getAttribute('xmlns');
    
    // Calculate bounds
    const elements = clonedSvg.querySelectorAll('rect, circle, ellipse, path, text, g[class*="node"], g[class*="cluster"], line, polyline, polygon');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let processedCount = 0;
    
    elements.forEach(elem => {
      try {
        const bbox = elem.getBBox?.();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          minX = Math.min(minX, bbox.x);
          minY = Math.min(minY, bbox.y);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          maxY = Math.max(maxY, bbox.y + bbox.height);
          processedCount++;
        }
      } catch (e) {}
    });
    
    const hasValidBounds = minX !== Infinity && minY !== Infinity;
    const width = hasValidBounds ? maxX - minX + 40 : 0;
    const height = hasValidBounds ? maxY - minY + 40 : 0;
    
    return {
      hasNs,
      elementCount: elements.length,
      processedCount,
      hasValidBounds,
      width,
      height,
      bounds: hasValidBounds ? { minX, minY, maxX, maxY } : null
    };
  } catch (err) {
    return { error: err.message };
  }
});

console.log('Debug result:', JSON.stringify(result, null, 2));

await browser.close();
