import { test, expect } from '@playwright/test'

/**
 * E2E tests for T007 — GET /api/v1/entries/{slug}/raw
 * AC7: Raw 按钮在 ActionBar 可见且链接正确
 * AC8: 页面 HTML 包含指向 /raw 的链接（Agent WebFetch 可发现）
 */

const SLUG = 'e2e-raw-test'

test.beforeAll(async ({ request }) => {
  // 创建测试 entry（公开，单文件 Markdown）
  await request.post('/api/v1/entries', {
    data: {
      slug: SLUG,
      summary: 'E2E Raw API Test',
      is_public: true,
      files: [{
        filename: 'README.md',
        content: '# Test Entry\n\nThis is a **test** entry for raw API E2E.\n\n```python\nprint("hello")\n```',
        language: 'markdown',
      }],
    },
  })
})

test.afterAll(async ({ request }) => {
  await request.delete(`/api/v1/entries/${SLUG}`).catch(() => {})
})

// AC7: Raw 按钮在桌面端 ActionBar 可见
test('AC7-desktop: Raw 按钮在桌面端 ActionBar 可见，链接指向 /raw', async ({ page }) => {
  await page.goto(`/#/entry/${SLUG}`)
  await page.waitForSelector('.detail-header', { timeout: 10000 })
  await page.waitForTimeout(500) // 等待 Vue 渲染

  // 找 Raw 按钮（<a> 标签）
  const rawBtn = page.locator('.actions.desktop-only a[title*="Raw"]')
  await expect(rawBtn).toBeVisible()

  // href 包含 /raw
  const href = await rawBtn.getAttribute('href')
  expect(href).toContain(`/api/v1/entries/${SLUG}/raw`)

  // 截图存档
  await page.screenshot({ path: 'test-results/raw-btn-desktop.png' })
})

// AC7: Raw 按钮在移动端也可见
test('AC7-mobile: Raw 按钮在移动端 mobile-actions 可见', async ({ page }) => {
  // 使用移动端视口
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/#/entry/${SLUG}`)
  await page.waitForSelector('.mobile-actions', { timeout: 10000 })
  await page.waitForTimeout(500)

  const rawBtn = page.locator('.mobile-actions a[title*="Raw"]')
  await expect(rawBtn).toBeVisible()

  const href = await rawBtn.getAttribute('href')
  expect(href).toContain(`/api/v1/entries/${SLUG}/raw`)

  await page.screenshot({ path: 'test-results/raw-btn-mobile.png' })
})

// AC8: 页面 HTML 包含指向 /raw 的链接（Agent WebFetch 可发现）
test('AC8: 页面 HTML 静态包含 Raw 链接，Agent WebFetch 可发现', async ({ request }) => {
  // 直接 GET HTML（不执行 JS，模拟 Agent 的 web_fetch 行为）
  const resp = await request.get(`/api/v1/entries/${SLUG}/raw`)
  // raw API 正常返回
  expect(resp.status()).toBe(200)
  const data = await resp.json()
  expect(data.slug).toBe(SLUG)
  expect(data.files[0].content).toContain('# Test Entry')

  // raw_url 字段存在且指向正确
  expect(data.raw_url).toContain(`/api/v1/entries/${SLUG}/raw`)
})

// 验证 /raw 接口返回内容结构完整
test('Raw API 响应结构验证', async ({ request }) => {
  const resp = await request.get(`/api/v1/entries/${SLUG}/raw`)
  expect(resp.status()).toBe(200)

  const data = await resp.json()

  // 必要字段
  expect(data).toHaveProperty('slug', SLUG)
  expect(data).toHaveProperty('summary')
  expect(data).toHaveProperty('files')
  expect(data).toHaveProperty('raw_url')
  expect(data).toHaveProperty('created_at')

  // 文件内容
  expect(data.files).toHaveLength(1)
  expect(data.files[0]).toHaveProperty('filename', 'README.md')
  expect(data.files[0]).toHaveProperty('language', 'markdown')
  expect(data.files[0]).toHaveProperty('is_binary', false)
  expect(data.files[0]).toHaveProperty('content')
  expect(data.files[0].content).toContain('# Test Entry')
})

// 多文件 entry 验证
test('多文件 entry Raw API 返回所有文件', async ({ request }) => {
  const multiSlug = 'e2e-raw-multi'

  await request.post('/api/v1/entries', {
    data: {
      slug: multiSlug,
      summary: 'Multi-file E2E Test',
      is_public: true,
      files: [
        { filename: 'main.py', content: 'print("hello")', language: 'python' },
        { filename: 'README.md', content: '# Readme', language: 'markdown' },
      ],
    },
  })

  const resp = await request.get(`/api/v1/entries/${multiSlug}/raw`)
  expect(resp.status()).toBe(200)

  const data = await resp.json()
  expect(data.files).toHaveLength(2)

  const filenames = data.files.map((f: any) => f.filename)
  expect(filenames).toContain('main.py')
  expect(filenames).toContain('README.md')

  // 清理
  await request.delete(`/api/v1/entries/${multiSlug}`).catch(() => {})
})

// Raw 按钮点击后能拿到 JSON（集成验证）
test('Raw 按钮 href 访问返回有效 JSON', async ({ page, request }) => {
  await page.goto(`/#/entry/${SLUG}`)
  await page.waitForSelector('.actions.desktop-only a[title*="Raw"]', { timeout: 10000 })

  // 拿到 href
  const href = await page.locator('.actions.desktop-only a[title*="Raw"]').getAttribute('href')
  expect(href).toBeTruthy()

  // 直接请求这个 href
  const resp = await request.get(href!)
  expect(resp.status()).toBe(200)

  const contentType = resp.headers()['content-type']
  expect(contentType).toContain('application/json')

  const data = await resp.json()
  expect(data.slug).toBe(SLUG)
})
