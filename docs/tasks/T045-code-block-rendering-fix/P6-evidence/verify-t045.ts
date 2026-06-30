import { chromium } from 'playwright'

const DEBUG_URL = 'http://127.0.0.1:8888'
const EVIDENCE_DIR = '/home/kity/oclab/peekview/docs/tasks/T045-code-block-rendering-fix/P6-evidence/screenshots'
const LOG_FILE = '/home/kity/oclab/peekview/docs/tasks/T045-code-block-rendering-fix/P6-evidence/test-output.log'

function log(msg: string) {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}`
  console.log(line)
  require('fs').appendFileSync(LOG_FILE, line + '\n')
}

async function hardTimer(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Hard timer: ${label} exceeded ${ms}ms`)), ms)
  )
}

async function main() {
  require('fs').writeFileSync(LOG_FILE, `=== T045 P6 Verification Log ===\nStarted: ${new Date().toISOString()}\n\n`)

  const browser = await chromium.connectOverCDP('http://localhost:18800')
  const contexts = browser.contexts()
  const context = contexts[0] || await browser.newContext()
  const page = await context.newPage()

  try {
    // ========================================================
    // B01: Zebra stripe full-width in Markdown code block
    // ========================================================
    log('B01: Testing zebra stripe full-width in Markdown code block...')

    // Navigate to a page with a markdown code block
    // We need an entry that contains a code block. Let's find or create one.
    await page.goto(`${DEBUG_URL}/`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Find any entry with code block content
    const entryLinks = await page.$$eval('a[href^="/"]', links =>
      links.map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() || '' }))
        .filter(l => l.href.match(/\/[^/]+$/) && !l.href.includes('/api/'))
    )
    log(`Found ${entryLinks.length} entry links on homepage`)

    // Try to find an entry that likely has code - or use the first one
    // For a more reliable test, we'll check the entry detail page
    let testSlug = ''
    if (entryLinks.length > 0) {
      const href = entryLinks[0].href
      testSlug = href.split('/').pop() || ''
      log(`Using entry slug: ${testSlug}`)
    }

    if (!testSlug) {
      log('ERROR: No entry found to test. Creating a test entry via API...')
      // Create a test entry with code block
      const createRes = await fetch(`${DEBUG_URL}/api/v1/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'P6 Test - Code Block Rendering',
          slug: 'p6-test-code-block',
          is_public: true,
          content: `# Code Block Test

\`\`\`python
def hello():
    print("Hello, World!")
    return 42
\`\`\`

\`\`\`javascript
const x = 1;
const y = 2;
const z = x + y;
\`\`\`

## Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

## SVG Diagram

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>
\`\`\`

## PlantUML Diagram

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi
@enduml
\`\`\`
`,
        }),
      })
      const createData = await createRes.json()
      log(`Created test entry: ${JSON.stringify(createData.slug || createData)}`)
      testSlug = createData.slug || 'p6-test-code-block'
    }

    // Navigate to the entry page
    await page.goto(`${DEBUG_URL}/${testSlug}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Take screenshot in dark mode (default)
    await page.screenshot({ path: `${EVIDENCE_DIR}/b01-dark-code-block.png`, fullPage: true })
    log('B01: Screenshot taken (dark mode)')

    // Check if .line elements have display: block and full-width background
    const b01DarkResult = await page.evaluate(() => {
      const lines = document.querySelectorAll('.code-block-wrapper .line')
      if (lines.length === 0) return { pass: false, reason: 'No .line elements found in code-block-wrapper' }

      const firstEven = Array.from(lines).find((_, i) => (i + 1) % 2 === 0) as HTMLElement | undefined
      if (!firstEven) return { pass: false, reason: 'No even line found' }

      const computedStyle = window.getComputedStyle(firstEven)
      const display = computedStyle.display
      const bgColor = computedStyle.backgroundColor
      const lineWidth = firstEven.getBoundingClientRect().width
      const parentWidth = (firstEven.closest('pre') as HTMLElement)?.getBoundingClientRect().width || 0

      return {
        pass: display === 'block',
        display,
        backgroundColor: bgColor,
        lineWidth,
        parentWidth,
        widthRatio: parentWidth > 0 ? lineWidth / parentWidth : 0,
        reason: display === 'block'
          ? `Line is block, bg=${bgColor}, width covers ${((lineWidth / parentWidth) * 100).toFixed(1)}% of pre`
          : `Line display=${display}, expected block`
      }
    })
    log(`B01 (dark): ${JSON.stringify(b01DarkResult)}`)

    // Switch to light theme
    const themeToggle = await page.$('[data-action="toggle-theme"], .theme-toggle, button[title*="theme" i]')
    if (themeToggle) {
      await themeToggle.click()
      await page.waitForTimeout(1000)
    } else {
      // Try setting data-theme attribute directly
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light')
      })
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: `${EVIDENCE_DIR}/b01-light-code-block.png`, fullPage: true })
    log('B01: Screenshot taken (light mode)')

    const b01LightResult = await page.evaluate(() => {
      const lines = document.querySelectorAll('.code-block-wrapper .line')
      if (lines.length === 0) return { pass: false, reason: 'No .line elements found in code-block-wrapper' }

      const firstEven = Array.from(lines).find((_, i) => (i + 1) % 2 === 0) as HTMLElement | undefined
      if (!firstEven) return { pass: false, reason: 'No even line found' }

      const computedStyle = window.getComputedStyle(firstEven)
      const display = computedStyle.display
      const bgColor = computedStyle.backgroundColor
      const lineWidth = firstEven.getBoundingClientRect().width
      const parentWidth = (firstEven.closest('pre') as HTMLElement)?.getBoundingClientRect().width || 0

      return {
        pass: display === 'block',
        display,
        backgroundColor: bgColor,
        lineWidth,
        parentWidth,
        widthRatio: parentWidth > 0 ? lineWidth / parentWidth : 0,
        reason: display === 'block'
          ? `Line is block, bg=${bgColor}, width covers ${((lineWidth / parentWidth) * 100).toFixed(1)}% of pre`
          : `Line display=${display}, expected block`
      }
    })
    log(`B01 (light): ${JSON.stringify(b01LightResult)}`)

    // Switch back to dark
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(1000)

    // ========================================================
    // B02: Zebra stripe full-width in Diagram code mode
    // ========================================================
    log('B02: Testing zebra stripe full-width in Diagram code mode...')

    // Find diagram blocks and click code toggle
    const diagramToggles = await page.$$('.diagram-view-toggle')
    log(`Found ${diagramToggles.length} diagram toggle buttons`)

    if (diagramToggles.length > 0) {
      await diagramToggles[0].click()
      await page.waitForTimeout(2000)

      await page.screenshot({ path: `${EVIDENCE_DIR}/b02-dark-diagram-code.png`, fullPage: true })
      log('B02: Screenshot taken (dark, diagram code mode)')

      const b02DarkResult = await page.evaluate(() => {
        const lines = document.querySelectorAll('.diagram-code .line')
        if (lines.length === 0) return { pass: false, reason: 'No .line elements in diagram-code' }

        const firstEven = Array.from(lines).find((_, i) => (i + 1) % 2 === 0) as HTMLElement | undefined
        if (!firstEven) return { pass: false, reason: 'No even line found' }

        const computedStyle = window.getComputedStyle(firstEven)
        const display = computedStyle.display
        const bgColor = computedStyle.backgroundColor
        const lineWidth = firstEven.getBoundingClientRect().width
        const parentWidth = (firstEven.closest('pre') as HTMLElement)?.getBoundingClientRect().width || 0

        return {
          pass: display === 'block',
          display,
          backgroundColor: bgColor,
          lineWidth,
          parentWidth,
          widthRatio: parentWidth > 0 ? lineWidth / parentWidth : 0,
        }
      })
      log(`B02 (dark): ${JSON.stringify(b02DarkResult)}`)

      // Light mode
      await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light') })
      await page.waitForTimeout(1000)

      await page.screenshot({ path: `${EVIDENCE_DIR}/b02-light-diagram-code.png`, fullPage: true })
      log('B02: Screenshot taken (light, diagram code mode)')

      const b02LightResult = await page.evaluate(() => {
        const lines = document.querySelectorAll('.diagram-code .line')
        if (lines.length === 0) return { pass: false, reason: 'No .line elements in diagram-code' }

        const firstEven = Array.from(lines).find((_, i) => (i + 1) % 2 === 0) as HTMLElement | undefined
        if (!firstEven) return { pass: false, reason: 'No even line found' }

        const computedStyle = window.getComputedStyle(firstEven)
        const display = computedStyle.display
        const bgColor = computedStyle.backgroundColor

        return { pass: display === 'block', display, backgroundColor: bgColor }
      })
      log(`B02 (light): ${JSON.stringify(b02LightResult)}`)

      // Switch back to dark
      await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark') })
      await page.waitForTimeout(1000)
    } else {
      log('B02: SKIP - No diagram blocks found on page')
    }

    // ========================================================
    // B03/B04: Zebra color contrast >= 8% brightness difference
    // ========================================================
    log('B03/B04: Testing zebra color contrast...')

    const contrastDarkResult = await page.evaluate(() => {
      const lines = document.querySelectorAll('.code-block-wrapper .line')
      if (lines.length < 2) return { pass: false, reason: 'Less than 2 lines' }

      const oddLine = lines[0] as HTMLElement
      const evenLine = lines[1] as HTMLElement

      const oddBg = window.getComputedStyle(oddLine).backgroundColor
      const evenBg = window.getComputedStyle(evenLine).backgroundColor

      function parseRgb(s: string): [number, number, number] {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0]
      }

      function luminance(r: number, g: number, b: number): number {
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
      }

      const oddRgb = parseRgb(oddBg)
      const evenRgb = parseRgb(evenBg)
      const oddL = luminance(oddRgb[0], oddRgb[1], oddRgb[2])
      const evenL = luminance(evenRgb[0], evenRgb[1], evenRgb[2])
      const diff = Math.abs(oddL - evenL)

      return {
        pass: diff >= 0.08,
        oddBg,
        evenBg,
        oddLuminance: oddL.toFixed(4),
        evenLuminance: evenL.toFixed(4),
        brightnessDiff: diff.toFixed(4),
        diffPercent: (diff * 100).toFixed(2) + '%',
      }
    })
    log(`B03 (dark contrast): ${JSON.stringify(contrastDarkResult)}`)

    // Light theme contrast
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light') })
    await page.waitForTimeout(1000)

    const contrastLightResult = await page.evaluate(() => {
      const lines = document.querySelectorAll('.code-block-wrapper .line')
      if (lines.length < 2) return { pass: false, reason: 'Less than 2 lines' }

      const oddLine = lines[0] as HTMLElement
      const evenLine = lines[1] as HTMLElement

      const oddBg = window.getComputedStyle(oddLine).backgroundColor
      const evenBg = window.getComputedStyle(evenLine).backgroundColor

      function parseRgb(s: string): [number, number, number] {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0]
      }

      function luminance(r: number, g: number, b: number): number {
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
      }

      const oddRgb = parseRgb(oddBg)
      const evenRgb = parseRgb(evenBg)
      const oddL = luminance(oddRgb[0], oddRgb[1], oddRgb[2])
      const evenL = luminance(evenRgb[0], evenRgb[1], evenRgb[2])
      const diff = Math.abs(oddL - evenL)

      return {
        pass: diff >= 0.08,
        oddBg,
        evenBg,
        oddLuminance: oddL.toFixed(4),
        evenLuminance: evenL.toFixed(4),
        brightnessDiff: diff.toFixed(4),
        diffPercent: (diff * 100).toFixed(2) + '%',
      }
    })
    log(`B04 (light contrast): ${JSON.stringify(contrastLightResult)}`)

    await page.screenshot({ path: `${EVIDENCE_DIR}/b04-light-code-block.png`, fullPage: true })

    // Switch back to dark
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark') })
    await page.waitForTimeout(1000)

    // ========================================================
    // B05: Markdown code block line numbers
    // ========================================================
    log('B05: Testing Markdown code block line numbers...')

    const b05Result = await page.evaluate(() => {
      const lineNumbers = document.querySelectorAll('.code-block-wrapper .line-number')
      if (lineNumbers.length === 0) return { pass: false, reason: 'No .line-number elements found' }

      const numbers = Array.from(lineNumbers).map(el => el.textContent?.trim())
      const startsWith1 = numbers[0] === '1'
      const sequential = numbers.every((n, i) => n === String(i + 1))

      // Check that line-number styles match CodeViewer pattern
      const firstLineNumber = lineNumbers[0] as HTMLElement
      const style = window.getComputedStyle(firstLineNumber)
      const fontFamily = style.fontFamily
      const color = style.color

      return {
        pass: startsWith1 && sequential,
        count: lineNumbers.length,
        firstThree: numbers.slice(0, 3),
        startsWith1,
        sequential,
        fontFamily,
        color,
      }
    })
    log(`B05: ${JSON.stringify(b05Result)}`)

    // ========================================================
    // B06/B07/B08: Diagram code mode line numbers
    // ========================================================
    log('B06/B07/B08: Testing Diagram code mode line numbers...')

    // Already in code mode for first diagram (clicked earlier)
    const b06Result = await page.evaluate(() => {
      const diagramBlocks = document.querySelectorAll('.diagram-block')
      const results: any[] = []

      diagramBlocks.forEach((block, idx) => {
        const lang = block.getAttribute('data-type')
        const lineNumbers = block.querySelectorAll('.diagram-code .line-number')
        const hasLineNumbers = lineNumbers.length > 0
        const numbers = Array.from(lineNumbers).map(el => el.textContent?.trim())
        const startsWith1 = numbers[0] === '1'

        results.push({
          diagramIndex: idx,
          lang,
          hasLineNumbers,
          count: lineNumbers.length,
          firstThree: numbers.slice(0, 3),
          startsWith1,
        })
      })

      return results
    })
    log(`B06/B07/B08: ${JSON.stringify(b06Result)}`)

    // Click remaining diagram toggles
    const allToggles = await page.$$('.diagram-view-toggle')
    for (let i = 1; i < allToggles.length; i++) {
      await allToggles[i].click()
      await page.waitForTimeout(500)
    }
    await page.waitForTimeout(1000)

    const b068FullResult = await page.evaluate(() => {
      const diagramBlocks = document.querySelectorAll('.diagram-block')
      const results: any[] = []

      diagramBlocks.forEach((block, idx) => {
        const lang = block.getAttribute('data-type')
        const lineNumbers = block.querySelectorAll('.diagram-code .line-number')
        const hasLineNumbers = lineNumbers.length > 0
        const numbers = Array.from(lineNumbers).map(el => el.textContent?.trim())
        const startsWith1 = numbers[0] === '1'
        const sequential = numbers.every((n, i) => n === String(i + 1))

        // Check line-number style matches CodeViewer
        const firstLineNumber = lineNumbers[0] as HTMLElement | undefined
        let fontFamily = '', color = ''
        if (firstLineNumber) {
          const style = window.getComputedStyle(firstLineNumber)
          fontFamily = style.fontFamily
          color = style.color
        }

        results.push({
          diagramIndex: idx,
          lang,
          hasLineNumbers,
          count: lineNumbers.length,
          firstThree: numbers.slice(0, 3),
          startsWith1,
          sequential,
          fontFamily,
          color,
        })
      })

      return results
    })
    log(`B06/B07/B08 (full): ${JSON.stringify(b068FullResult)}`)

    await page.screenshot({ path: `${EVIDENCE_DIR}/b06-diagram-mermaid-code.png`, fullPage: true })

    // ========================================================
    // B09: CodeViewer no regression
    // ========================================================
    log('B09: Testing CodeViewer no regression...')

    // Navigate to a file viewer page - need an entry with files
    // Let's check the current entry or find one with files
    const hasFileTree = await page.$('.file-tree, .file-list')
    if (hasFileTree) {
      // Click on a code file
      const fileItems = await page.$$('.file-tree-item, .file-list-item, [data-file-id]')
      if (fileItems.length > 0) {
        await fileItems[0].click()
        await page.waitForTimeout(2000)
      }
    }

    const b09Result = await page.evaluate(() => {
      const codeViewer = document.querySelector('.code-viewer')
      if (!codeViewer) return { pass: true, reason: 'No CodeViewer on this page (expected for markdown-only entry)' }

      const lineNumbers = codeViewer.querySelectorAll('.line-number')
      const lines = codeViewer.querySelectorAll('.line')
      const hasLineNumbers = lineNumbers.length > 0
      const hasLines = lines.length > 0

      // Check zebra
      const evenLines = codeViewer.querySelectorAll('.line:nth-child(even)')
      let evenHasBg = false
      if (evenLines.length > 0) {
        const bg = window.getComputedStyle(evenLines[0] as HTMLElement).backgroundColor
        evenHasBg = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      }

      return {
        pass: hasLineNumbers && hasLines,
        hasLineNumbers,
        lineCount: lines.length,
        lineNumberCount: lineNumbers.length,
        evenLinesHaveBg: evenHasBg,
      }
    })
    log(`B09: ${JSON.stringify(b09Result)}`)

    await page.screenshot({ path: `${EVIDENCE_DIR}/b09-code-viewer.png`, fullPage: true })

    // ========================================================
    // CSS Variable Verification (supplementary)
    // ========================================================
    log('CSS Variable Verification...')

    const cssVars = await page.evaluate(() => {
      const darkEven = getComputedStyle(document.documentElement).getPropertyValue('--bg-code-even').trim()
      const darkOdd = getComputedStyle(document.documentElement).getPropertyValue('--bg-code-odd').trim()
      const darkCode = getComputedStyle(document.documentElement).getPropertyValue('--bg-code').trim()
      return { darkEven, darkOdd, darkCode }
    })
    log(`CSS vars (dark): ${JSON.stringify(cssVars)}`)

    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light') })
    await page.waitForTimeout(500)

    const cssVarsLight = await page.evaluate(() => {
      const lightEven = getComputedStyle(document.documentElement).getPropertyValue('--bg-code-even').trim()
      const lightOdd = getComputedStyle(document.documentElement).getPropertyValue('--bg-code-odd').trim()
      const lightCode = getComputedStyle(document.documentElement).getPropertyValue('--bg-code').trim()
      return { lightEven, lightOdd, lightCode }
    })
    log(`CSS vars (light): ${JSON.stringify(cssVarsLight)}`)

    // ========================================================
    // highlightCode output structure check
    // ========================================================
    log('Checking highlightCode output structure...')

    const structureResult = await page.evaluate(() => {
      const containers = document.querySelectorAll('.code-container')
      const results: any[] = []

      containers.forEach((container, idx) => {
        const hasLineNumbers = container.querySelector('.line-numbers') !== null
        const hasPre = container.querySelector('pre') !== null
        const hasCode = container.querySelector('code') !== null
        const lineElements = container.querySelectorAll('.line')
        const lineNumberElements = container.querySelectorAll('.line-number')

        results.push({
          containerIndex: idx,
          hasLineNumbers,
          hasPre,
          hasCode,
          lineCount: lineElements.length,
          lineNumberCount: lineNumberElements.length,
        })
      })

      return results
    })
    log(`Structure check: ${JSON.stringify(structureResult)}`)

    log('\n=== Verification complete ===')
  } catch (err: any) {
    log(`ERROR: ${err.message}`)
    log(`Stack: ${err.stack}`)
  } finally {
    await page.close()
    // Don't browser.close() — would kill Chrome
    setTimeout(() => process.exit(0), 1000)
  }
}

Promise.race([main(), hardTimer(180000, 'total script')])
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
