import { test, expect, chromium, type APIRequestContext } from '@playwright/test'

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

test.describe('Mermaid Visual Tests', () => {
  test('check mermaid container height', async ({ request }) => {
    const slug = `e2e-mermaid-visual-height-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd(
          'flowchart TD\n    A[Start] --> B[Measure]\n    B --> C[Container]\n    C --> D[SVG]\n    D --> E[Assert]\n    E --> F[Done]'
        ),
      },
    ])
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForTimeout(4000) // 等待Vue和Mermaid渲染

    await page.screenshot({ path: '/tmp/mermaid-full-page.png', fullPage: true })
    console.log('截图已保存: /tmp/mermaid-full-page.png')

    const diagram = page.locator('.diagram-viewer').first()
    await expect(diagram).toBeVisible()

    const box = await diagram.boundingBox()
    console.log(`Container size: ${box?.width}x${box?.height}`)

    const svg = diagram.locator('svg').first()
    await expect(svg).toBeVisible()

    const svgBox = await svg.boundingBox()
    console.log(`SVG size: ${svgBox?.width}x${svgBox?.height}`)

    expect(box?.height).toBeGreaterThan(200)
    expect(svgBox?.height).toBeGreaterThan(100)

    await browser.close()
  })

  test('check toggle functionality', async ({ request }) => {
    const slug = `e2e-mermaid-visual-toggle-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd('flowchart LR\n    A[Left] --> B[Middle]\n    B --> C[Right]\n    C --> D[End]\n    D --> A'),
      },
    ])
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForTimeout(3000)

    await page.screenshot({ path: '/tmp/mermaid-before-toggle.png', fullPage: true })

    const toggleBtn = page.locator('.diagram-view-toggle').first()
    await toggleBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/mermaid-code-view.png', fullPage: true })

    await toggleBtn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: '/tmp/mermaid-after-toggle.png', fullPage: true })

    const svg = page.locator('.diagram-viewer svg').first()
    await expect(svg).toBeVisible()

    await browser.close()
  })

  test('check fullscreen', async ({ request }) => {
    const slug = `e2e-mermaid-visual-fullscreen-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
    await ensureEntry(request, slug, [
      {
        filename: 'diagram.md',
        content: diagramMd('flowchart TD\n    A[Launch] --> B[Page]\n    B --> C[Modal]\n    C --> D[Verify]'),
      },
    ])
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/${slug}`)
    await page.waitForTimeout(3000)

    const fullscreenBtn = page.locator('.diagram-action-btn.fullscreen-btn').first()
    await fullscreenBtn.click()
    await page.waitForTimeout(1000)

    await page.screenshot({ path: '/tmp/mermaid-fullscreen.png' })

    const modal = page.locator('.diagram-modal').first()
    await expect(modal).toBeVisible()

    const box = await modal.boundingBox()
    expect(box?.height).toBeGreaterThan(500)

    await browser.close()
  })
})
