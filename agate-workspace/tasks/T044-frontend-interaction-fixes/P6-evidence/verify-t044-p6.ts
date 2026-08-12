import { chromium, type BrowserContext, type Page } from 'playwright'

const BASE_URL = 'http://127.0.0.1:8888'

async function hardTimer(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const browser = await chromium.connectOverCDP('http://localhost:18800')
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = await context.newPage()

  try {
    const results: string[] = []

    // === B01-B06: zen-shortcut modifier key filtering ===
    // These are pure function tests - already verified by vitest unit tests.
    // Playwright cannot directly test shouldHandleZenShortcut return values,
    // but we can verify the behavioral effect: Ctrl+F should NOT toggle zen mode.

    // Navigate to an entry detail page to test zen mode
    await page.goto(BASE_URL)
    await hardTimer(2000)
    await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b01-explore-page.png' })

    // Try to find an entry card and click it to go to detail page
    const entryCard = await page.$('.entry-card, .entry-grid a, .entry-panel a')
    if (entryCard) {
      await entryCard.click()
      await hardTimer(2000)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b01-entry-detail.png' })

      // B01: Press Ctrl+F - should NOT toggle zen mode (should open browser search instead)
      // We can't directly intercept browser search, but we can check if zen mode was NOT activated
      const bodyBefore = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      await page.keyboard.down('Control')
      await page.keyboard.press('f')
      await page.keyboard.up('Control')
      await hardTimer(500)
      const bodyAfter = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      const b01Pass = !bodyBefore && !bodyAfter
      results.push(`B01 (Ctrl+F no zen mode): ${b01Pass ? 'PASS' : 'FAIL'} - zen-mode before=${bodyBefore}, after=${bodyAfter}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b01-after-ctrl-f.png' })

      // B02: Press plain F - should toggle zen mode
      const zenBefore = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      await page.keyboard.press('f')
      await hardTimer(500)
      const zenAfter = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      const b02Pass = zenAfter !== zenBefore
      results.push(`B02 (plain F toggles zen mode): ${b02Pass ? 'PASS' : 'FAIL'} - zen-mode before=${zenBefore}, after=${zenAfter}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b02-after-f-key.png' })

      // Toggle back out of zen mode
      await page.keyboard.press('f')
      await hardTimer(500)

      // B05: Escape should still work for zen mode exit
      // First enter zen mode
      await page.keyboard.press('f')
      await hardTimer(500)
      const zenInMode = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      await page.keyboard.press('Escape')
      await hardTimer(500)
      const zenAfterEsc = await page.evaluate(() => document.body.classList.contains('zen-mode') || document.querySelector('.zen-mode') !== null)
      const b05Pass = zenInMode && !zenAfterEsc
      results.push(`B05 (Escape exits zen mode): ${b05Pass ? 'PASS' : 'FAIL'} - zen in=${zenInMode}, after esc=${zenAfterEsc}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b05-after-escape.png' })
    } else {
      results.push('B01-B06: SKIPPED - no entry found to navigate to detail page')
    }

    // === B07-B11: viewMode persistence ===
    await page.goto(BASE_URL + '/explore')
    await hardTimer(2000)
    await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b07-explore-initial.png' })

    // B09: First visit (clear localStorage) should default to grid
    await page.evaluate(() => localStorage.removeItem('peekview-view-mode'))
    await page.reload()
    await hardTimer(2000)
    const gridVisible = await page.evaluate(() => !!document.querySelector('.entry-grid'))
    const panelVisible = await page.evaluate(() => !!document.querySelector('.entry-panel'))
    const b09Pass = gridVisible && !panelVisible
    results.push(`B09 (default grid on no localStorage): ${b09Pass ? 'PASS' : 'FAIL'} - grid=${gridVisible}, panel=${panelVisible}`)
    await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b09-default-grid.png' })

    // B07: Switch to list mode, check localStorage
    const listBtn = await page.$('.view-toggle-btn[title="List view"]')
    if (listBtn) {
      await listBtn.click()
      await hardTimer(1000)
      const lsAfterList = await page.evaluate(() => localStorage.getItem('peekview-view-mode'))
      const b07Pass = lsAfterList === 'list'
      results.push(`B07 (switch to list persists): ${b07Pass ? 'PASS' : 'FAIL'} - localStorage=${lsAfterList}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b07-list-mode.png' })

      // B08: Reload page, should restore list mode
      await page.reload()
      await hardTimer(2000)
      const gridAfterReload = await page.evaluate(() => !!document.querySelector('.entry-grid'))
      const panelAfterReload = await page.evaluate(() => !!document.querySelector('.entry-panel'))
      const b08Pass = !gridAfterReload && panelAfterReload
      results.push(`B08 (reload restores list): ${b08Pass ? 'PASS' : 'FAIL'} - grid=${gridAfterReload}, panel=${panelAfterReload}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b08-reload-list.png' })

      // B11: Switch back to grid, check localStorage
      const gridBtn = await page.$('.view-toggle-btn[title="Grid view"]')
      if (gridBtn) {
        await gridBtn.click()
        await hardTimer(1000)
        const lsAfterGrid = await page.evaluate(() => localStorage.getItem('peekview-view-mode'))
        const b11Pass = lsAfterGrid === 'grid'
        results.push(`B11 (switch to grid persists): ${b11Pass ? 'PASS' : 'FAIL'} - localStorage=${lsAfterGrid}`)
        await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b11-grid-mode.png' })
      } else {
        results.push('B11: FAIL - grid toggle button not found')
      }

      // B10: Set invalid localStorage value, should fallback to grid
      await page.evaluate(() => localStorage.setItem('peekview-view-mode', 'table'))
      await page.reload()
      await hardTimer(2000)
      const gridAfterInvalid = await page.evaluate(() => !!document.querySelector('.entry-grid'))
      const panelAfterInvalid = await page.evaluate(() => !!document.querySelector('.entry-panel'))
      const b10Pass = gridAfterInvalid && !panelAfterInvalid
      results.push(`B10 (invalid value fallback to grid): ${b10Pass ? 'PASS' : 'FAIL'} - grid=${gridAfterInvalid}, panel=${panelAfterInvalid}`)
      await page.screenshot({ path: '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/screenshots/b10-invalid-fallback.png' })
    } else {
      results.push('B07-B11: FAIL - list toggle button not found')
    }

    // Write results
    const fs = await import('fs')
    const resultText = results.join('\n')
    fs.appendFileSync(
      '/home/kity/oclab/peekview/docs/tasks/T044-frontend-interaction-fixes/P6-evidence/test-output.log',
      '\n\n=== Playwright E2E Results ===\n' + resultText + '\n'
    )

    console.log('=== Playwright E2E Results ===')
    console.log(resultText)
  } finally {
    await page.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) }).then(() => process.exit(0))
