import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  await page.goto('http://127.0.0.1:8888/');
  await page.waitForTimeout(2000);

  // Scroll to bottom to see footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/e2e-results/new-footer.png', fullPage: true });
  console.log('Screenshot saved: /tmp/e2e-results/new-footer.png');

  await browser.close();
})();
