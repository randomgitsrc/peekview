import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://127.0.0.1:8888/jmnru9', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Check what's in the mount point
const mountInfo = await page.locator('.mermaid-viewer-mount').evaluate(el => {
  const svg = el.querySelector('svg');
  if (!svg) return { error: 'No SVG' };
  
  // Check the SVG structure
  const children = Array.from(svg.children).map(c => ({
    tag: c.tagName,
    class: c.getAttribute('class'),
    id: c.id,
    hasTransform: !!c.getAttribute('transform')
  }));
  
  return {
    childCount: svg.children.length,
    children: children.slice(0, 10),
    svgHasTransform: !!svg.getAttribute('transform')
  };
});

console.log('Mount info:', JSON.stringify(mountInfo, null, 2));

// Try to getBBox on different elements
const bboxInfo = await page.locator('.mermaid-block svg').evaluate(svg => {
  // Try the SVG itself
  let svgBBox = null;
  try {
    svgBBox = svg.getBBox();
  } catch (e) {}
  
  // Try direct children (not the viewport)
  const children = svg.querySelectorAll(':scope > *:not(.svg-pan-zoom_viewport)');
  const childBboxes = [];
  children.forEach((c, i) => {
    if (i < 5) {
      try {
        const bbox = c.getBBox?.();
        childBboxes.push({
          tag: c.tagName,
          class: c.getAttribute('class'),
          bbox: bbox ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } : null
        });
      } catch (e) {}
    }
  });
  
  // Try viewport
  const viewport = svg.querySelector('.svg-pan-zoom_viewport');
  let viewportBBox = null;
  if (viewport) {
    try {
      viewportBBox = viewport.getBBox();
    } catch (e) {}
  }
  
  return {
    svgBBox,
    childBboxes,
    viewportBBox: viewportBBox ? { x: viewportBBox.x, y: viewportBBox.y, width: viewportBBox.width, height: viewportBBox.height } : null,
    viewportChildCount: viewport ? viewport.children.length : 0
  };
});

console.log('\nBBox info:', JSON.stringify(bboxInfo, null, 2));

await browser.close();
