/**
 * HTML 渲染 E2E 测试
 *
 * 覆盖 spec-html-render.md P1 测试项：
 * - HTML 文件显示 iframe 而非代码高亮
 * - 多文件 entry：.html 和 .css 渲染方式不同
 * - Copy / Download 正常工作
 * - Wrap 按钮对 HTML 文件不显示
 * - 安全 negative test：沙盒隔离验证
 */

import { test, expect } from '@playwright/test'

// ─── 测试数据 ─────────────────────────────────────────────────────────────────

const SIMPLE_HTML = `<!DOCTYPE html>
<html>
  <head><title>Test Page</title></head>
  <body>
    <h1 id="main-heading">Hello from iframe</h1>
    <p>This is a rendered HTML page.</p>
  </body>
</html>`

// 2 个相对路径：style.css / main.js
const HTML_WITH_RELATIVE_PATHS = `<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="style.css">
    <script src="./main.js"></script>
  </head>
  <body><h1>Relative paths test</h1></body>
</html>`

const HTML_WITH_CDN = `<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="p-8 bg-gray-100">
    <h1 class="text-2xl font-bold text-blue-600" id="cdn-heading">Tailwind CDN Test</h1>
  </body>
</html>`

// 沙盒逃逸测试 HTML
const HTML_SANDBOX_ESCAPE_ATTEMPT = `<!DOCTYPE html>
<html>
<body>
<script>
  try {
    window.parent.document.cookie
    document.title = 'ESCAPE_SUCCESS'
  } catch(e) {
    document.title = 'SANDBOX_INTACT'
  }
  try {
    top.location.href = 'https://evil.com'
  } catch(e) {
    document.body.innerHTML = 'top.location blocked'
  }
<\/script>
</body>
</html>`

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

async function createEntry(request, slug: string, files: Array<{ filename: string; content: string }>) {
  const res = await request.post('/api/v1/entries', {
    data: { slug, summary: `HTML E2E - ${slug}`, files },
  })
  expect(res.ok()).toBeTruthy()
  return res
}

async function waitForIframe(page) {
  await page.waitForSelector('iframe.html-frame', { timeout: 8000 })
}

// ─── Test Suite: HTML 渲染基础 ────────────────────────────────────────────────

test.describe('HTML 渲染基础', () => {
  test.beforeAll(async ({ request }) => {
    await createEntry(request, 'e2e-html-basic', [
      { filename: 'index.html', content: SIMPLE_HTML },
    ])
    await createEntry(request, 'e2e-html-cdn', [
      { filename: 'index.html', content: HTML_WITH_CDN },
    ])
  })

  test('TC-HTML-001: HTML 文件显示 iframe 而非代码高亮', async ({ page }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    await expect(page.locator('iframe.html-frame')).toBeVisible()
    await expect(page.locator('.code-body')).not.toBeVisible()
    await expect(page.locator('.markdown-body')).not.toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-001-iframe.png' })
  })

  test('TC-HTML-002: iframe 内容正确渲染', async ({ page }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    const iframe = page.frameLocator('iframe.html-frame')
    await expect(iframe.locator('#main-heading')).toHaveText('Hello from iframe')
  })

  test('TC-HTML-003: CDN 外链资源正常加载', async ({ page }) => {
    await page.goto('/e2e-html-cdn')
    await waitForIframe(page)

    const iframe = page.frameLocator('iframe.html-frame')
    await expect(iframe.locator('#cdn-heading')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-003-cdn.png' })
  })
})

// ─── Test Suite: 相对路径警告 ─────────────────────────────────────────────────

test.describe('相对路径警告', () => {
  test.beforeAll(async ({ request }) => {
    await createEntry(request, 'e2e-html-relative', [
      { filename: 'index.html', content: HTML_WITH_RELATIVE_PATHS },
    ])
  })

  test('TC-HTML-010: 含相对路径时显示警告条，数量为 2', async ({ page }) => {
    await page.goto('/e2e-html-relative')
    await waitForIframe(page)

    const warning = page.locator('[data-testid="relative-path-warning"]')
    await expect(warning).toBeVisible()
    // style.css + main.js = 2 个相对路径
    await expect(warning).toContainText('2')
  })

  test('TC-HTML-011: 警告条可以关闭', async ({ page }) => {
    // 独立导航，不依赖前一个测试
    await page.goto('/e2e-html-relative')
    await waitForIframe(page)
    await expect(page.locator('[data-testid="relative-path-warning"]')).toBeVisible()

    await page.click('[data-testid="relative-path-warning-close"]')
    await expect(page.locator('[data-testid="relative-path-warning"]')).not.toBeVisible()
  })

  test('TC-HTML-012: 仅 CDN 外链时无警告条', async ({ page }) => {
    await page.goto('/e2e-html-cdn')
    await waitForIframe(page)

    await expect(page.locator('[data-testid="relative-path-warning"]')).not.toBeVisible()
  })
})

// ─── Test Suite: 操作按钮 ─────────────────────────────────────────────────────

test.describe('操作按钮', () => {
  test.beforeAll(async ({ request }) => {
    await createEntry(request, 'e2e-html-buttons', [
      { filename: 'index.html', content: SIMPLE_HTML },
    ])
  })

  test('TC-HTML-020: Wrap 按钮对 HTML 文件不显示', async ({ page }) => {
    await page.goto('/e2e-html-buttons')
    await waitForIframe(page)

    await expect(page.locator('button:has-text("Wrap")')).not.toBeVisible()
  })

  test('TC-HTML-021: Copy 按钮 tooltip 含 "HTML source"', async ({ page }) => {
    await page.goto('/e2e-html-buttons')
    await waitForIframe(page)

    const copyBtn = page.locator('button:has-text("Copy")')
    await expect(copyBtn).toBeVisible()
    const title = await copyBtn.getAttribute('title') ?? ''
    const ariaLabel = await copyBtn.getAttribute('aria-label') ?? ''
    const label = (title + ariaLabel).toLowerCase()
    expect(label).toContain('html source')
  })

  test('TC-HTML-022: Copy 复制 HTML 源码', async ({ page, context }) => {
    // 授予 clipboard 权限
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/e2e-html-buttons')
    await waitForIframe(page)

    await page.click('button:has-text("Copy")')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('<!DOCTYPE html>')
    expect(clipboard).toContain('Hello from iframe')
  })

  test('TC-HTML-023: Download 按钮存在', async ({ page }) => {
    await page.goto('/e2e-html-buttons')
    await waitForIframe(page)

    await expect(page.locator('button:has-text("Download")')).toBeVisible()
  })
})

// ─── Test Suite: 多文件 ───────────────────────────────────────────────────────

test.describe('多文件 entry', () => {
  test.beforeAll(async ({ request }) => {
    await createEntry(request, 'e2e-html-multifile', [
      { filename: 'index.html', content: SIMPLE_HTML },
      { filename: 'style.css', content: 'body { color: red; }' },
    ])
  })

  test('TC-HTML-030: .html 文件用 iframe，.css 文件用 CodeViewer', async ({ page }) => {
    await page.goto('/e2e-html-multifile')
    await waitForIframe(page)

    await expect(page.locator('iframe.html-frame')).toBeVisible()

    await page.click('[data-testid="file-tree"] >> text=style.css')
    await expect(page.locator('.code-body')).toBeVisible()
    await expect(page.locator('iframe.html-frame')).not.toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-030-multifile.png' })
  })

  test('TC-HTML-031: 切换回 .html 文件恢复 iframe', async ({ page }) => {
    await page.goto('/e2e-html-multifile')
    await waitForIframe(page)

    await page.click('[data-testid="file-tree"] >> text=style.css')
    await page.click('[data-testid="file-tree"] >> text=index.html')

    await expect(page.locator('iframe.html-frame')).toBeVisible()
    await expect(page.locator('.code-body')).not.toBeVisible()
  })
})

// ─── Test Suite: 安全 negative test ──────────────────────────────────────────

test.describe('安全沙盒验证', () => {
  test.beforeAll(async ({ request }) => {
    await createEntry(request, 'e2e-html-security', [
      { filename: 'test.html', content: HTML_SANDBOX_ESCAPE_ATTEMPT },
    ])
  })

  test('TC-HTML-SEC-001: iframe 内无法读取父页面 cookie', async ({ page, context }) => {
    await context.addCookies([{
      name: 'sensitive_token',
      value: 'super_secret',
      domain: 'localhost',
      path: '/',
    }])

    await page.goto('/e2e-html-security')
    await waitForIframe(page)
    await page.waitForTimeout(500)

    // iframe 内脚本执行失败，title 应为 SANDBOX_INTACT
    const iframe = page.frameLocator('iframe.html-frame')
    const title = await iframe.locator('title').textContent().catch(() => '')
    expect(title).not.toBe('ESCAPE_SUCCESS')
  })

  test('TC-HTML-SEC-002: iframe 内 top.location 修改被阻止', async ({ page }) => {
    await page.goto('/e2e-html-security')
    await waitForIframe(page)
    await page.waitForTimeout(500)

    expect(page.url()).not.toContain('evil.com')
    expect(page.url()).toContain('localhost')

    const iframe = page.frameLocator('iframe.html-frame')
    const bodyText = await iframe.locator('body').textContent().catch(() => '')
    expect(bodyText).toContain('top.location blocked')
  })
})

// ─── Test Suite: 移动端布局 ───────────────────────────────────────────────────

test.describe('移动端布局', () => {
  test('TC-HTML-040: 移动端 iframe 正常显示，操作栏在底部', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    await expect(page.locator('iframe.html-frame')).toBeVisible()
    await expect(page.locator('[data-testid="action-bar"]')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-040-mobile.png' })
  })
})
