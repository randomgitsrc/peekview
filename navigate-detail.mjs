import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto('http://127.0.0.1:8888/#/entry/demo-ui-test');
await page.waitForTimeout(3000);

await page.screenshot({ path: '/tmp/e2e-results/detail-navigated.png' });
console.log('Screenshot saved');

await browser.close();
