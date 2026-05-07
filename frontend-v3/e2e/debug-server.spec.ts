import { test, expect } from '@playwright/test'

/**
 * Debug Server E2E Tests
 * 这些测试在调试服务器 (http://127.0.0.1:8888) 上运行
 * 会自动创建所需的测试数据
 *
 * 注意: 所有测试数据设置1小时自动过期
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'

// 存储创建的测试条目，用于测试完成后清理
const testEntries: string[] = []

// ========================================
// Helper Functions
// ========================================

async function createTestEntry(page: any, slug: string, data: any) {
  const response = await page.request.post('/api/v1/entries', {
    data: {
      slug,
      summary: data.summary || 'Test Entry',
      expires_in: '1h',  // 自动1小时过期
      files: data.files || []
    }
  })
  if (response.ok()) {
    testEntries.push(slug)
  }
  return response
}

async function cleanupTestEntry(page: any, slug: string) {
  try {
    await page.request.delete(`/api/v1/entries/${slug}`)
  } catch (e) {
    // 忽略删除失败
  }
}

// ========================================
// Test Suite 1: Basic Functionality
// ========================================

test.describe('Debug Server - Basic', () => {
  test('health check', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.status()).toBe(200)
  })

  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await page.screenshot({ path: '/tmp/e2e-results/01-homepage.png' })
  })

  test('create and view code entry', async ({ page }) => {
    // Create test entry
    const response = await createTestEntry(page, 'e2e-code-test', {
      summary: 'E2E Code Test',
      files: [{
        filename: 'test.py',
        content: 'def hello():\n    print("Hello World")\n    return 42'
      }]
    })
    expect(response.status()).toBe(201)

    // View entry
    await page.goto('/#/entry/e2e-code-test')
    await page.waitForSelector('.code-body', { timeout: 5000 })

    // Verify code is displayed
    const codeText = await page.locator('.code-body').textContent()
    expect(codeText).toContain('def hello')

    await page.screenshot({ path: '/tmp/e2e-results/02-code-viewer.png' })
  })
})

// ========================================
// Test Suite 2: Mermaid
// ========================================

test.describe('Debug Server - Mermaid', () => {
  test('mermaid diagram renders and fills container', async ({ page }) => {
    // Create entry with mermaid
    const response = await createTestEntry(page, 'e2e-mermaid-test', {
      summary: 'E2E Mermaid Test',
      files: [{
        filename: 'diagram.md',
        content: `# Test

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B -->|No| E[End]
\`\`\`
`
      }]
    })
    expect(response.status()).toBe(201)

    // View entry
    await page.goto('/#/entry/e2e-mermaid-test')
    await page.waitForTimeout(3000)

    // Take screenshot
    await page.screenshot({ path: '/tmp/e2e-results/03-mermaid-diagram.png', fullPage: true })

    // Check mermaid block exists
    const mermaidCount = await page.locator('.mermaid-block').count()
    expect(mermaidCount).toBeGreaterThan(0)

    // Check SVG fills container (height > 200px)
    const svg = page.locator('.mermaid-content.diagram-mode svg').first()
    const box = await svg.boundingBox()
    expect(box?.height).toBeGreaterThan(100)
    expect(box?.width).toBeGreaterThan(200)
  })

  test('mermaid code/diagram toggle preserves chart', async ({ page }) => {
    await page.goto('/#/entry/e2e-mermaid-test')
    await page.waitForTimeout(3000)

    // Click Code to switch to code view
    await page.click('button:has-text("Code")')
    await page.waitForTimeout(500)

    // Verify code is visible
    const codeBlock = page.locator('.mermaid-content.code-mode pre')
    await expect(codeBlock).toBeVisible()

    // Click Diagram to switch back
    await page.click('button:has-text("Diagram")')
    await page.waitForTimeout(2000)

    // Verify diagram is still rendered
    const svg = page.locator('.mermaid-content.diagram-mode svg')
    await expect(svg).toBeVisible()

    const box = await svg.boundingBox()
    expect(box?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/e2e-results/04-mermaid-toggle.png' })
  })

  test('mermaid fullscreen fills window', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#/entry/e2e-mermaid-test')
    await page.waitForTimeout(3000)

    // Click fullscreen
    await page.click('[title="Fullscreen"]')
    await page.waitForTimeout(1000)

    // Check modal SVG fills window
    const modalSvg = page.locator('.mermaid-modal svg')
    const box = await modalSvg.boundingBox()
    expect(box?.width).toBeGreaterThan(800)
    expect(box?.height).toBeGreaterThan(500)

    await page.screenshot({ path: '/tmp/e2e-results/05-mermaid-fullscreen.png' })

    // Close modal
    await page.click('.mermaid-modal .close-btn, .mermaid-modal .modal-overlay')
    await expect(modalSvg).not.toBeVisible()
  })
})

// ========================================
// Test Suite 3: Pagination
// ========================================

test.describe('Debug Server - Pagination', () => {
  test('pagination shows page numbers', async ({ page }) => {
    // Create multiple entries to trigger pagination
    for (let i = 1; i <= 15; i++) {
      await createTestEntry(page, `e2e-page-test-${i}`, {
        summary: `Pagination Test ${i}`,
        files: [{ filename: 'test.txt', content: `Test ${i}` }]
      })
    }

    await page.goto('/')
    await page.waitForTimeout(1000)

    // Check pagination exists
    const pagination = page.locator('.pagination')
    await expect(pagination).toBeVisible()

    // Check page numbers exist
    const pageNumbers = await page.locator('.page-number').count()
    expect(pageNumbers).toBeGreaterThan(0)

    await page.screenshot({ path: '/tmp/e2e-results/06-pagination.png' })
  })

  test('page navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    // Get first page entries
    const firstPageEntries = await page.locator('.entry-card').count()

    // Go to page 2
    await page.click('.pagination .page-number:nth-child(2)')
    await page.waitForTimeout(1000)

    // Verify different content
    const secondPageEntries = await page.locator('.entry-card').count()
    expect(secondPageEntries).toBeGreaterThan(0)

    await page.screenshot({ path: '/tmp/e2e-results/07-page-nav.png' })
  })
})

// ========================================
// Test Suite 4: Theme
// ========================================

test.describe('Debug Server - Theme', () => {
  test('theme toggle works', async ({ page }) => {
    await page.goto('/')

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )

    // Click theme toggle
    await page.click('.theme-toggle, [title="Toggle theme"]')
    await page.waitForTimeout(500)

    // Check theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(newTheme).not.toBe(initialTheme)

    await page.screenshot({ path: `/tmp/e2e-results/08-theme-${newTheme}.png` })
  })
})

// ========================================
// Test Suite 5: Mobile
// ========================================

test.describe('Debug Server - Mobile', () => {
  test('mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/#/entry/e2e-code-test')
    await page.waitForTimeout(1000)

    // Mobile should not show sidebars
    await expect(page.locator('.file-sidebar')).not.toBeVisible()
    await expect(page.locator('.toc-sidebar')).not.toBeVisible()

    // Mobile actions should be visible
    await expect(page.locator('.mobile-actions')).toBeVisible()

    await page.screenshot({ path: '/tmp/e2e-results/09-mobile.png' })
  })
})
