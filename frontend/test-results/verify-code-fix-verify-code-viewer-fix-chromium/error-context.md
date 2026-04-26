# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-code-fix.spec.ts >> verify code viewer fix
- Location: e2e/verify-code-fix.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:8080/msexo8", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test('verify code viewer fix', async ({ page }) => {
  4  |   // Use existing entry
> 5  |   await page.goto('http://127.0.0.1:8080/msexo8')
     |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  6  |   await page.waitForLoadState('networkidle')
  7  | 
  8  |   // Wait for code container
  9  |   await page.waitForSelector('.code-container', { timeout: 10000 })
  10 | 
  11 |   // Get computed styles for code element
  12 |   const styles = await page.evaluate(() => {
  13 |     const codeEl = document.querySelector('.code-body code')
  14 |     if (!codeEl) return { error: 'code element not found' }
  15 | 
  16 |     const computed = getComputedStyle(codeEl)
  17 |     return {
  18 |       display: computed.display,
  19 |       flexDirection: computed.flexDirection,
  20 |       whiteSpace: computed.whiteSpace,
  21 |       lineHeight: computed.lineHeight,
  22 |     }
  23 |   })
  24 | 
  25 |   console.log('=== Code Element Styles ===')
  26 |   console.log(JSON.stringify(styles, null, 2))
  27 | 
  28 |   // Count child nodes to verify fix
  29 |   const childInfo = await page.evaluate(() => {
  30 |     const codeEl = document.querySelector('.code-body code')
  31 |     if (!codeEl) return { error: 'code element not found' }
  32 | 
  33 |     const children = Array.from(codeEl.childNodes)
  34 |     const textNodes = children.filter(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
  35 |     const elementNodes = children.filter(n => n.nodeType === Node.ELEMENT_NODE)
  36 | 
  37 |     return {
  38 |       totalChildNodes: children.length,
  39 |       nonEmptyTextNodes: textNodes.length,
  40 |       elementNodes: elementNodes.length,
  41 |     }
  42 |   })
  43 | 
  44 |   console.log('\n=== Child Node Analysis ===')
  45 |   console.log(JSON.stringify(childInfo, null, 2))
  46 | 
  47 |   // Check line alignment
  48 |   const lineInfo = await page.evaluate(() => {
  49 |     const lines = document.querySelectorAll('.code-body .line')
  50 |     const lineNumbers = document.querySelectorAll('.code-body .line-number')
  51 | 
  52 |     if (lines.length === 0) return { error: 'No lines found' }
  53 | 
  54 |     const firstLine = lines[0] as HTMLElement
  55 |     const firstLineNum = lineNumbers[0] as HTMLElement
  56 | 
  57 |     return {
  58 |       lineCount: lines.length,
  59 |       lineNumberCount: lineNumbers.length,
  60 |       firstLineHeight: firstLine.getBoundingClientRect().height,
  61 |       firstLineNumHeight: firstLineNum ? firstLineNum.getBoundingClientRect().height : null,
  62 |       firstLineText: firstLine.textContent?.slice(0, 50),
  63 |       firstLineNumText: firstLineNum ? firstLineNum.textContent : null,
  64 |     }
  65 |   })
  66 | 
  67 |   console.log('\n=== Line Alignment Info ===')
  68 |   console.log(JSON.stringify(lineInfo, null, 2))
  69 | 
  70 |   // Take screenshot for visual verification
  71 |   await page.screenshot({ path: 'test-results/code-viewer-fix.png', fullPage: true })
  72 | 
  73 |   // Verify the fix: flex layout should be applied
  74 |   expect(styles.display).toBe('flex')
  75 |   expect(styles.flexDirection).toBe('column')
  76 | 
  77 |   // Verify lines and line numbers match
  78 |   expect(lineInfo.lineCount).toBe(lineInfo.lineNumberCount)
  79 | 
  80 |   // Verify heights are similar (within 1px tolerance for rounding)
  81 |   const heightDiff = Math.abs((lineInfo.firstLineHeight || 0) - (lineInfo.firstLineNumHeight || 0))
  82 |   expect(heightDiff).toBeLessThanOrEqual(1)
  83 | 
  84 |   console.log('\n✅ All checks passed!')
  85 | })
  86 | 
```