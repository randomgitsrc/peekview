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

test('mermaid rendered and visible', async ({ page, request }) => {
  const slug = `e2e-mermaid-check-main-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'chromium'}`
  await ensureEntry(request, slug, [
    {
      filename: 'diagram.md',
      content:
        '# E2E Mermaid Fixture\n\n```mermaid\nflowchart TD\n    A[Start] --> B[Parse]\n    B --> C[Render]\n    C --> D{Success}\n    D -->|Yes| E[Visible]\n    D -->|No| F[Error]\n```\n',
    },
  ])
  await page.goto(`${BASE_URL}/${slug}`)
  await page.waitForTimeout(5000)

  await page.screenshot({ path: '/tmp/mermaid-screenshot.png', fullPage: true })
  console.log('截图已保存: /tmp/mermaid-screenshot.png')

  const count = await page.locator('.diagram-block').count()
  console.log(`找到 ${count} 个 mermaid-block`)
  expect(count).toBeGreaterThan(0)

  const box = await page.locator('.diagram-viewer').first().boundingBox()
  console.log(`容器高度: ${box?.height}px`)
  expect(box?.height).toBeGreaterThan(200)

  const svgBox = await page.locator('.diagram-viewer svg').first().boundingBox()
  console.log(`SVG高度: ${svgBox?.height}px`)
  expect(svgBox?.height).toBeGreaterThan(100)
})
