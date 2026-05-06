import { chromium, Browser, Page } from 'playwright'
import { execSync } from 'child_process'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'http://127.0.0.1:8888'
const SCREENSHOT_DIR = '/tmp/mermaid-test-results'

async function runTests(): Promise<{ test1: boolean; test2: boolean; test3: boolean }> {
  console.log('=== 启动 Playwright E2E 测试 ===\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  // Create test entry with Mermaid diagrams
  console.log('=== 创建测试条目 ===')
  const testContent = `# Mermaid Test

## 流程图

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B -->|No| E[End]
\`\`\`

## 时序图

\`\`\`mermaid
sequenceDiagram
    participant A as User
    participant B as System
    A->>B: Request
    B->>B: Process
    B-->>A: Response
\`\`\`
`

  try {
    execSync(`curl -s -X POST ${BASE_URL}/api/v1/entries \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify({
        slug: 'mermaid-e2e-test',
        summary: 'Mermaid E2E Test',
        files: [{ path: 'test.md', content: testContent }]
      }).replace(/'/g, "'\"'\"'")}'`,
      { encoding: 'utf-8' }
    )
    console.log('✓ 测试条目已创建: mermaid-e2e-test\n')
  } catch (e) {
    console.log('Note: Entry may already exist\n')
  }

  const testUrl = `${BASE_URL}/mermaid-e2e-test`
  console.log(`测试URL: ${testUrl}\n`)

  // Capture console logs
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    consoleLogs.push(text)
  })
  page.on('pageerror', error => {
    const text = `[PAGE ERROR] ${error.message}`
    consoleLogs.push(text)
    console.log(text)
  })

  // ========================================
  // Test 1: SVG fills container properly
  // ========================================
  console.log('--- 测试1: SVG容器填充检查 ---')

  await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(5000) // Wait for Mermaid to render

  // Take screenshot
  const screenshot1 = join(SCREENSHOT_DIR, '01-initial-render.png')
  await page.screenshot({ path: screenshot1, fullPage: true })
  console.log(`✓ 截图已保存: ${screenshot1}`)

  // Check SVG
  const mermaidBlocks = await page.locator('.mermaid-block').count()
  const svgCount = await page.locator('.mermaid-content svg').count()
  console.log(`  Mermaid blocks: ${mermaidBlocks}`)
  console.log(`  SVG elements: ${svgCount}`)

  let test1Pass = false
  if (svgCount > 0) {
    const svgBox = await page.locator('.mermaid-content svg').first().boundingBox()
    const containerBox = await page.locator('.mermaid-content.diagram-mode').first().boundingBox()
    console.log(`  SVG尺寸: ${svgBox?.width?.toFixed(0)}x${svgBox?.height?.toFixed(0)}`)
    console.log(`  容器尺寸: ${containerBox?.width?.toFixed(0)}x${containerBox?.height?.toFixed(0)}`)

    if (containerBox && containerBox.height >= 200 && svgBox && svgBox.height >= 100) {
      console.log('  ✓ PASS: SVG容器高度正常 (>200px)，图表正确渲染')
      test1Pass = true
    } else {
      console.log('  ✗ FAIL: SVG高度不足或被截断')
    }
  } else {
    console.log('  ✗ FAIL: 未找到SVG元素')
  }

  // ========================================
  // Test 2: Code/Diagram toggle works
  // ========================================
  console.log('\n--- 测试2: Code/Diagram 切换检查 ---')

  let test2Pass = false
  if (mermaidBlocks > 0) {
    const toggleBtn = page.locator('.mermaid-view-toggle').first()

    try {
      // Click to switch to code mode
      await toggleBtn.click({ timeout: 5000 })
      await page.waitForTimeout(500)

      const screenshot2 = join(SCREENSHOT_DIR, '02-code-mode.png')
      await page.screenshot({ path: screenshot2, fullPage: true })
      console.log(`✓ 截图已保存: ${screenshot2}`)

      const codeMode = page.locator('.mermaid-content[data-mode="code"]')
      const codeVisible = await codeMode.isVisible().catch(() => false)
      console.log(`  Code模式可见: ${codeVisible}`)

      // Click to switch back to diagram mode
      await toggleBtn.click({ timeout: 5000 })
      await page.waitForTimeout(2000) // Wait for resize

      const screenshot3 = join(SCREENSHOT_DIR, '03-back-to-diagram.png')
      await page.screenshot({ path: screenshot3, fullPage: true })
      console.log(`✓ 截图已保存: ${screenshot3}`)

      // Check if SVG is visible again
      const svgAfterToggle = page.locator('.mermaid-content[data-mode="diagram"] svg').first()
      const svgVisibleAfterToggle = await svgAfterToggle.isVisible().catch(() => false)
      const svgBoxAfterToggle = await svgAfterToggle.boundingBox().catch(() => null)
      console.log(`  SVG可见: ${svgVisibleAfterToggle}, 高度: ${svgBoxAfterToggle?.height?.toFixed(0)}`)

      if (svgVisibleAfterToggle && (svgBoxAfterToggle?.height || 0) > 50) {
        console.log('  ✓ PASS: Code/Diagram切换正常工作，图表正确显示')
        test2Pass = true
      } else {
        console.log('  ✗ FAIL: 切换后图表未正确显示')
      }
    } catch (e: any) {
      console.log(`  ✗ FAIL: 切换测试出错: ${e.message}`)
    }
  } else {
    console.log('  ✗ SKIP: 无Mermaid块可测试')
  }

  // ========================================
  // Test 3: Fullscreen fills window
  // ========================================
  console.log('\n--- 测试3: Fullscreen 模态框检查 ---')

  let test3Pass = false
  if (mermaidBlocks > 0) {
    try {
      // Click fullscreen button directly
      const fullscreenBtn = page.locator('.mermaid-action-btn[title="Fullscreen"]').first()
      await fullscreenBtn.click({ timeout: 5000 })
      await page.waitForTimeout(1000)

      const screenshot4 = join(SCREENSHOT_DIR, '04-fullscreen.png')
      await page.screenshot({ path: screenshot4 })
      console.log(`✓ 截图已保存: ${screenshot4}`)

      const modal = page.locator('.mermaid-modal-overlay')
      const modalVisible = await modal.isVisible().catch(() => false)
      console.log(`  Modal可见: ${modalVisible}`)

      if (modalVisible) {
        const modalBox = await modal.boundingBox()
        const modalSvg = modal.locator('svg')
        const modalSvgVisible = await modalSvg.isVisible().catch(() => false)
        const modalSvgBox = await modalSvg.boundingBox().catch(() => null)
        console.log(`  Modal尺寸: ${modalBox?.width?.toFixed(0)}x${modalBox?.height?.toFixed(0)}`)
        console.log(`  Modal SVG可见: ${modalSvgVisible}, 尺寸: ${modalSvgBox?.width?.toFixed(0)}x${modalSvgBox?.height?.toFixed(0)}`)

        if ((modalBox?.height || 0) > 500 && modalSvgVisible) {
          console.log('  ✓ PASS: Fullscreen模态框正常显示 (>500px)')
          test3Pass = true
        } else {
          console.log('  ✗ FAIL: Fullscreen模态框高度不足')
        }
      } else {
        console.log('  ✗ FAIL: Fullscreen模态框未显示')
      }

      // Close modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    } catch (e: any) {
      console.log(`  ✗ FAIL: Fullscreen测试出错: ${e.message}`)
    }
  } else {
    console.log('  ✗ SKIP: 无Mermaid块可测试')
  }

  // Print console errors if any
  const errors = consoleLogs.filter(l => l.includes('error') || l.includes('Error'))
  if (errors.length > 0) {
    console.log('\n=== 浏览器错误日志 ===')
    for (const err of errors) {
      console.log(err)
    }
  }

  await browser.close()

  return { test1: test1Pass, test2: test2Pass, test3: test3Pass }
}

async function main() {
  const results = await runTests()

  console.log('\n========================================')
  console.log('=== 测试结果摘要 ===')
  console.log('========================================')
  console.log(`测试1 (SVG容器填充): ${results.test1 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`测试2 (Code/Diagram切换): ${results.test2 ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`测试3 (Fullscreen): ${results.test3 ? '✓ PASS' : '✗ FAIL'}`)

  const allPass = results.test1 && results.test2 && results.test3
  console.log(`\n总体结果: ${allPass ? '✓ 全部通过' : '✗ 有测试失败'}`)
  console.log(`\n截图文件位置: ${SCREENSHOT_DIR}`)

  process.exit(allPass ? 0 : 1)
}

main().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
