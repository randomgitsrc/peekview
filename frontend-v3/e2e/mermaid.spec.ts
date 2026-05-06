import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Mermaid Diagram Rendering
 *
 * These tests verify:
 * 1. SVG fills the container (not a thin strip)
 * 2. Diagram/Code toggle works correctly
 * 3. Fullscreen modal fills the window
 */

// Test data with mermaid diagram
const TEST_CONTENT = `# Test Document

## Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B -->|No| E[End]
\`\`\`

Some text after.
`

test.describe('Mermaid Diagram Rendering', () => {
  let entrySlug: string

  test.beforeAll(async ({ request }) => {
    // Create test entry via API
    const response = await request.post('/api/v1/entries', {
      data: {
        summary: 'Mermaid E2E Test',
        content: TEST_CONTENT,
        expires_in: '24h'
      }
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    entrySlug = data.slug
  })

  test.beforeEach(async ({ page }) => {
    // Navigate to the entry
    await page.goto(`/entries/${entrySlug}`)
    // Wait for page to load
    await page.waitForSelector('.markdown-body', { timeout: 10000 })
    // Wait for mermaid to render
    await page.waitForTimeout(2000)
  })

  test('SVG fills the diagram container', async ({ page }) => {
    const diagramMode = page.locator('.mermaid-content[data-mode="diagram"]')

    // Should be visible
    await expect(diagramMode).toBeVisible()

    // Check container has reasonable height (at least 200px)
    const containerHeight = await diagramMode.evaluate(el => el.offsetHeight)
    expect(containerHeight).toBeGreaterThanOrEqual(200)

    // Check SVG exists and has height
    const svg = diagramMode.locator('svg')
    await expect(svg).toBeVisible()

    const svgHeight = await svg.evaluate(el => el.getBoundingClientRect().height)
    expect(svgHeight).toBeGreaterThan(100)

    // SVG should fill most of the container
    const svgContainer = diagramMode.locator('.mermaid-viewer-mount')
    const containerBox = await svgContainer.boundingBox()
    expect(containerBox?.height).toBeGreaterThan(150)
  })

  test('Diagram/Code toggle works', async ({ page }) => {
    const block = page.locator('.mermaid-block').first()
    const toggleBtn = block.locator('.mermaid-view-toggle')
    const diagramMode = block.locator('.mermaid-content[data-mode="diagram"]')
    const codeMode = block.locator('.mermaid-content[data-mode="code"]')

    // Initially diagram should be visible, code hidden
    await expect(diagramMode).toBeVisible()
    await expect(codeMode).toBeHidden()

    // Click toggle to show code
    await toggleBtn.click()
    await page.waitForTimeout(500)

    // Code should be visible, diagram hidden
    await expect(codeMode).toBeVisible()
    await expect(diagramMode).toBeHidden()

    // Click toggle again to show diagram
    await toggleBtn.click()
    await page.waitForTimeout(1000) // Wait for resize

    // Diagram should be visible again
    await expect(diagramMode).toBeVisible()
    await expect(codeMode).toBeHidden()

    // SVG should still have proper height after toggle back
    const svg = diagramMode.locator('svg')
    await expect(svg).toBeVisible()

    const svgHeight = await svg.evaluate(el => el.getBoundingClientRect().height)
    expect(svgHeight).toBeGreaterThan(100)
  })

  test('Fullscreen modal fills window', async ({ page }) => {
    const block = page.locator('.mermaid-block').first()
    const fullscreenBtn = block.locator('.mermaid-action-btn[title="Fullscreen"], button[title="Fullscreen"]').first()

    // Click fullscreen
    await fullscreenBtn.click()

    // Wait for modal
    const modal = page.locator('.mermaid-modal-overlay')
    await expect(modal).toBeVisible()

    // Check modal overlay is full screen
    const modalBox = await modal.boundingBox()
    expect(modalBox?.width).toBeGreaterThan(800)
    expect(modalBox?.height).toBeGreaterThan(500)

    // Check inner modal has proper height
    const innerModal = page.locator('.mermaid-modal')
    const innerBox = await innerModal.boundingBox()
    expect(innerBox?.height).toBeGreaterThan(400)

    // Check SVG in modal
    const modalSvg = modal.locator('svg')
    await expect(modalSvg).toBeVisible()

    // Close modal
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('Resize handle adjusts container height', async ({ page }) => {
    const diagramMode = page.locator('.mermaid-content[data-mode="diagram"]').first()
    const resizeHandle = diagramMode.locator('.mermaid-resize-handle')

    // Get initial height
    const initialHeight = await diagramMode.evaluate(el => el.offsetHeight)

    // Drag resize handle down
    await resizeHandle.dragTo(diagramMode, { targetPosition: { x: 100, y: initialHeight + 100 } })
    await page.waitForTimeout(500)

    // Check height increased
    const newHeight = await diagramMode.evaluate(el => el.offsetHeight)
    expect(newHeight).toBeGreaterThan(initialHeight)
  })
})
