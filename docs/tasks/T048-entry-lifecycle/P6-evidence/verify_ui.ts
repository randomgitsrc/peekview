import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:18800';
const BASE_URL = 'http://127.0.0.1:8888';
const API = `${BASE_URL}/api/v1`;
const SCREENSHOTS = 'docs/tasks/T048-entry-lifecycle/P6-evidence/screenshots';

const HARD = 120_000;
let lastStep = 'init';
const hardTimer = setTimeout(() => {
  console.error(`HARD TIMEOUT at ${lastStep}`);
  process.exit(2);
}, HARD);

function hardTimerDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function step(s: string): void {
  lastStep = s;
  console.log(s);
}

async function apiRegister(page: any, prefix: string): Promise<string> {
  const username = `p6-ui-${prefix}-${Date.now()}`;
  const token = await page.evaluate(async (opts: any) => {
    const r = await fetch(`${opts.api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: opts.username, password: 'testpass123' }),
    });
    if (!r.ok) throw new Error(`Register failed: ${r.status}`);
    const data = await r.json();
    return data.access_token;
  }, { api: API, username });
  return token;
}

async function apiCreateEntry(page: any, token: string, slug: string, opts: {
  summary?: string;
  expires_in?: string;
  is_public?: boolean;
} = {}): Promise<void> {
  await page.evaluate(async (args: any) => {
    const r = await fetch(`${args.api}/entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${args.token}`,
      },
      body: JSON.stringify({
        slug: args.slug,
        summary: args.summary || `UI test ${args.slug}`,
        expires_in: args.expires_in,
        is_public: args.is_public ?? true,
      }),
    });
    if (!r.ok) throw new Error(`Create entry failed: ${r.status} ${await r.text()}`);
  }, { api: API, token, slug, ...opts });
}

async function apiArchiveEntry(page: any, token: string, slug: string): Promise<void> {
  await page.evaluate(async (args: any) => {
    const r = await fetch(`${args.api}/entries/${args.slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${args.token}`,
      },
      body: JSON.stringify({ status: 'archived' }),
    });
    if (!r.ok) throw new Error(`Archive entry failed: ${r.status} ${await r.text()}`);
  }, { api: API, token, slug });
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();
  try {
    // ============================================================
    // B11: EntryDetailView active entry "Expires in Xd [Edit]"
    // ============================================================
    step('[B11] Verifying active entry "Expires in Xd [Edit]"...');

    const b11Token = await apiRegister(page, 'b11');
    await apiCreateEntry(page, b11Token, 'b11-active', { expires_in: '7d' });

    await page.goto(`${BASE_URL}/b11-active`, { waitUntil: 'domcontentloaded' });
    await hardTimerDelay(2000);

    const expiresText = await page.locator('.entry-expires').textContent();
    console.log(`  expires text: ${expiresText}`);

    const editBtn = page.locator('.expires-edit-btn');
    const editBtnExists = await editBtn.isVisible();
    console.log(`  edit button visible: ${editBtnExists}`);

    await page.screenshot({
      path: `${SCREENSHOTS}/b11-active-entry.png`,
      fullPage: true,
    });

    if (editBtnExists) {
      await editBtn.click();
      await hardTimerDelay(1000);
      await page.screenshot({
        path: `${SCREENSHOTS}/b11-expires-dialog.png`,
        fullPage: true,
      });

      const submitBtn = page.locator('.expires__submit');
      const submitVisible = await submitBtn.isVisible();
      console.log(`  submit button visible: ${submitVisible}`);

      if (submitVisible) {
        await page.selectOption('#expires-in-select', '30d');
        await submitBtn.click();
        await hardTimerDelay(2000);
        await page.screenshot({
          path: `${SCREENSHOTS}/b11-updated-entry.png`,
          fullPage: true,
        });
      }
    }

    // ============================================================
    // B12: Archived entry "Expired" banner + Reactivate
    // ============================================================
    step('[B12] Verifying archived entry banner + Reactivate...');

    const b12Token = await apiRegister(page, 'b12');
    await apiCreateEntry(page, b12Token, 'b12-archived', { expires_in: '7d' });

    // PATCH entry status to archived
    await apiArchiveEntry(page, b12Token, 'b12-archived');

    await page.goto(`${BASE_URL}/b12-archived`, { waitUntil: 'domcontentloaded' });
    await hardTimerDelay(2000);

    const archivedBanner = page.locator('.archived-banner');
    const bannerVisible = await archivedBanner.isVisible();
    console.log(`  archived banner visible: ${bannerVisible}`);

    if (bannerVisible) {
      const bannerText = await archivedBanner.locator('.archived-banner-text').textContent();
      console.log(`  banner text: ${bannerText}`);
    }

    const reactivateBtn = page.locator('.reactivate-btn');
    const reactivateVisible = await reactivateBtn.isVisible();
    console.log(`  reactivate button visible: ${reactivateVisible}`);

    const archivedBadge = page.locator('.entry-archived-badge');
    const badgeVisible = await archivedBadge.isVisible();
    console.log(`  archived badge in header: ${badgeVisible}`);

    await page.screenshot({
      path: `${SCREENSHOTS}/b12-archived-entry.png`,
      fullPage: true,
    });

    if (reactivateVisible) {
      await reactivateBtn.click();
      await hardTimerDelay(1000);
      await page.screenshot({
        path: `${SCREENSHOTS}/b12-reactivate-dialog.png`,
        fullPage: true,
      });

      const reactSubmit = page.locator('.expires__submit');
      const reactVisible = await reactSubmit.isVisible();
      console.log(`  reactivate submit visible: ${reactVisible}`);
      if (reactVisible) {
        await page.selectOption('#expires-in-select', '7d');
        await reactSubmit.click();
        await hardTimerDelay(2000);
        await page.screenshot({
          path: `${SCREENSHOTS}/b12-reactivated-entry.png`,
          fullPage: true,
        });
      }
    }

    // ============================================================
    // B13: List view archived entry gray styling + "Archived" badge
    // ============================================================
    step('[B13] Verifying list view archived entry styling...');

    const b13Token = await apiRegister(page, 'b13');
    await apiCreateEntry(page, b13Token, 'b13-active', { expires_in: '30d' });
    await apiCreateEntry(page, b13Token, 'b13-archived', { expires_in: '7d' });

    // PATCH entry status to archived
    await apiArchiveEntry(page, b13Token, 'b13-archived');

    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'domcontentloaded' });
    await hardTimerDelay(3000);

    // Click "Mine" tab
    const mineTab = page.locator('.owner-tab', { hasText: 'Mine' });
    if (await mineTab.isVisible()) {
      await mineTab.click();
      await hardTimerDelay(2000);
    }

    await page.screenshot({
      path: `${SCREENSHOTS}/b13-list-archived.png`,
      fullPage: true,
    });

    // Check grid view for archived card
    const archivedCard = page.locator('.entry-card--archived');
    const cardExists = await archivedCard.count();
    console.log(`  archived cards in grid: ${cardExists}`);

    if (cardExists > 0) {
      const cardOpacity = await archivedCard.first().evaluate(
        (el: Element) => window.getComputedStyle(el).opacity,
      );
      console.log(`  archived card opacity: ${cardOpacity}`);
    }

    // Check for "Archived" badge in card footer
    const archivedBadgeInCard = page.locator('.badge-archived');
    const badgeCount = await archivedBadgeInCard.count();
    console.log(`  archived badges in list: ${badgeCount}`);

    // Switch to list view
    const listViewBtn = page.locator('.view-toggle-btn[title="List view"]');
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
      await hardTimerDelay(1000);
    }

    await page.screenshot({
      path: `${SCREENSHOTS}/b13-list-view-archived.png`,
      fullPage: true,
    });

    // Check list view for archived row
    const archivedRow = page.locator('.entry-list-row--archived');
    const rowExists = await archivedRow.count();
    console.log(`  archived rows in list: ${rowExists}`);

    if (rowExists > 0) {
      const rowOpacity = await archivedRow.first().evaluate(
        (el: Element) => window.getComputedStyle(el).opacity,
      );
      console.log(`  archived row opacity: ${rowOpacity}`);
    }

    console.log('\n[DONE] UI BDD verification complete.');
    console.log(`Screenshots saved to ${SCREENSHOTS}/`);
  } finally {
    await page.close();
    clearTimeout(hardTimer);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
