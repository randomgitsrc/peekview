import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const ENTRIES_API = `${BASE_URL}/api/v1/entries`

test.beforeAll(async ({ request }) => {
  if (BASE_URL.includes(':8080') || BASE_URL.includes('prod')) {
    throw new Error(`FATAL: E2E tests must NOT run against production (${BASE_URL})`)
  }
  const resp = await request.get('/health')
  if (!resp.ok()) throw new Error(`Health check failed: ${resp.status()}`)
})

const createdEntries: string[] = []

test.afterEach(async ({ request }) => {
  for (const slug of createdEntries.splice(0)) {
    const del = await request.delete(`${ENTRIES_API}/${slug}`)
    if (![200, 204, 404].includes(del.status())) {
      throw new Error(`cleanup entry ${slug} failed: ${del.status()}`)
    }
  }
})

async function ensureEntry(request: APIRequestContext, slug: string, files: { filename: string; content: string }[]) {
  await request.delete(`${ENTRIES_API}/${slug}`).catch(() => {})
  const resp = await request.post(ENTRIES_API, {
    data: { slug, summary: `E2E fixture ${slug}`, is_public: true, files },
  })
  if (![200, 201].includes(resp.status())) {
    throw new Error(`ensureEntry ${slug} failed: ${resp.status()}`)
  }
  createdEntries.push(slug)
}

function diagramMd(flowchart: string) {
  return `# E2E Mermaid Fixture\n\n\`\`\`mermaid\n${flowchart}\n\`\`\`\n`
}

test.describe('Mermaid Diagram Rendering', () => {
  test('SVG fills container properly', async ({ page, request }) => {
    const slug = `e2e-mermaid-svg-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd(
          'flowchart TD\n    A[Start] --> B{Check}\n    B -->|Yes| C[Render SVG]\n    B -->|No| D[Show Code]\n    C --> E[Fullscreen]\n    D --> E'
        ),
      },
    ])
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const diagramMode = page.locator('.diagram-viewer').first()
    await expect(diagramMode).toBeVisible()

    const containerBox = await diagramMode.boundingBox()
    console.log(`Container size: ${containerBox?.width}x${containerBox?.height}`)

    expect(containerBox?.height).toBeGreaterThan(200)

    const svg = diagramMode.locator('svg').first()
    await expect(svg).toBeVisible()

    const svgBox = await svg.boundingBox()
    console.log(`SVG size: ${svgBox?.width}x${svgBox?.height}`)
    expect(svgBox?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/mermaid-test-1-initial.png', fullPage: true })
  })

  test('Code/Diagram toggle works', async ({ page, request }) => {
    const slug = `e2e-mermaid-toggle-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd(
          'flowchart LR\n    A[Input] --> B[Process]\n    B --> C{Valid}\n    C -->|Yes| D[Output]\n    C -->|No| B'
        ),
      },
    ])
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const block = page.locator('.diagram-block').first()
    const toggleBtn = block.locator('.diagram-view-toggle')
    const diagramMode = block.locator('.diagram-viewer')
    const codeMode = block.locator('.diagram-code')

    await toggleBtn.click()
    await page.waitForTimeout(500)
    await expect(codeMode).toBeVisible()
    await expect(diagramMode).toBeHidden()
    await page.screenshot({ path: '/tmp/mermaid-test-2-code.png', fullPage: true })

    await toggleBtn.click()
    await page.waitForTimeout(1500)
    await expect(diagramMode).toBeVisible()
    await expect(codeMode).toBeHidden()

    const svg = diagramMode.locator('svg')
    await expect(svg).toBeVisible()
    const svgBox = await svg.boundingBox()
    expect(svgBox?.height).toBeGreaterThan(100)

    await page.screenshot({ path: '/tmp/mermaid-test-3-after-toggle.png', fullPage: true })
  })

  test('Fullscreen fills window', async ({ page, request }) => {
    const slug = `e2e-mermaid-fullscreen-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd('flowchart TD\n    A[Open] --> B[View]\n    B --> C[Zoom]\n    C --> D[Fullscreen]'),
      },
    ])
    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const fullscreenBtn = page.locator('.diagram-action-btn.fullscreen-btn').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    const modal = page.locator('.diagram-modal')
    await expect(modal).toBeVisible()

    const modalBox = await modal.boundingBox()
    console.log(`Modal size: ${modalBox?.width}x${modalBox?.height}`)
    expect(modalBox?.height).toBeGreaterThan(500)

    const modalSvg = modal.locator('svg')
    await expect(modalSvg).toBeVisible()

    await page.screenshot({ path: '/tmp/mermaid-test-4-fullscreen.png' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
})
