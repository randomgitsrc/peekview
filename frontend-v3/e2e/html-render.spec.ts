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

// XSS 沙盒逃逸测试用 HTML
const HTML_SANDBOX_ESCAPE_ATTEMPT = `<!DOCTYPE html>
<html>
<body>
<script>
  // 尝试读取父页面 cookie
  try {
    window.parent.document.cookie
    document.title = 'ESCAPE_SUCCESS'
  } catch(e) {
    document.title = 'SANDBOX_INTACT'
  }
  // 尝试修改顶层 location
  try {
    top.location.href = 'https://evil.com'
  } catch(e) {
    document.body.innerHTML = 'top.location blocked'
  }
</script>
</body>
</html>`

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

async function createHtmlEntry(request, slug: string, files: Array<{ filename: string; content: string }>) {
  const res = await request.post('/api/v1/entries', {
    data: { slug, summary: `HTML E2E Test - ${slug}`, files },
  })
  expect(res.ok()).toBeTruthy()
  return res
}

async function waitForIframe(page) {
  await page.waitForSelector('iframe.html-frame', { timeout: 8000 })
}

// ─── Test Suite: HTML 渲染基础 ────────────────────────────────────────────────

test.describe('HTML 渲染基础', () => {
  test('TC-HTML-001: HTML 文件显示 iframe 而非代码高亮', async ({ page, request }) => {
    await createHtmlEntry(request, 'e2e-html-basic', [
      { filename: 'index.html', content: SIMPLE_HTML },
    ])

    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    // 应有 iframe，不应有代码高亮容器
    await expect(page.locator('iframe.html-frame')).toBeVisible()
    await expect(page.locator('.code-body')).not.toBeVisible()
    await expect(page.locator('.markdown-body')).not.toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-001-iframe.png' })
  })

  test('TC-HTML-002: iframe 内容正确渲染', async ({ page, request }) => {
    await createHtmlEntry(request, 'e2e-html-content', [
      { filename: 'index.html', content: SIMPLE_HTML },
    ])

    await page.goto('/e2e-html-content')
    await waitForIframe(page)

    // 等待 iframe load 事件
    const iframe = page.frameLocator('iframe.html-frame')
    await expect(iframe.locator('#main-heading')).toHaveText('Hello from iframe')
  })

  test('TC-HTML-003: CDN 外链资源正常加载', async ({ page, request }) => {
    await createHtmlEntry(request, 'e2e-html-cdn', [
      { filename: 'index.html', content: HTML_WITH_CDN },
    ])

    await page.goto('/e2e-html-cdn')
    await waitForIframe(page)

    const iframe = page.frameLocator('iframe.html-frame')
    // Tailwind 加载后元素应有样式
    await expect(iframe.locator('#cdn-heading')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-003-cdn.png' })
  })
})

// ─── Test Suite: 相对路径警告 ─────────────────────────────────────────────────

test.describe('相对路径警告', () => {
  test('TC-HTML-010: 含相对路径时显示警告条', async ({ page, request }) => {
    await createHtmlEntry(request, 'e2e-html-relative', [
      { filename: 'index.html', content: HTML_WITH_RELATIVE_PATHS },
    ])

    await page.goto('/e2e-html-relative')
    await waitForIframe(page)

    const warning = page.locator('[data-testid="relative-path-warning"]')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('2')  // style.css + main.js
  })

  test('TC-HTML-011: 警告条可以关闭', async ({ page, request }) => {
    await page.goto('/e2e-html-relative')
    await waitForIframe(page)

    await page.click('[data-testid="relative-path-warning-close"]')
    await expect(page.locator('[data-testid="relative-path-warning"]')).not.toBeVisible()
  })

  test('TC-HTML-012: 仅 CDN 外链时无警告条', async ({ page, request }) => {
    await page.goto('/e2e-html-cdn')
    await waitForIframe(page)

    await expect(page.locator('[data-testid="relative-path-warning"]')).not.toBeVisible()
  })
})

// ─── Test Suite: 操作按钮 ─────────────────────────────────────────────────────

test.describe('操作按钮', () => {
  test('TC-HTML-020: Wrap 按钮对 HTML 文件不显示', async ({ page, request }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    // Wrap 按钮不应存在
    await expect(page.locator('button:has-text("Wrap")')).not.toBeVisible()
  })

  test('TC-HTML-021: Copy 按钮 tooltip 为 "Copy HTML source"', async ({ page, request }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    const copyBtn = page.locator('button:has-text("Copy")')
    await expect(copyBtn).toBeVisible()
    // 检查 title 或 aria-label
    const label = await copyBtn.getAttribute('title') ?? await copyBtn.getAttribute('aria-label') ?? ''
    expect(label.toLowerCase()).toContain('html source')
  })

  test('TC-HTML-022: Copy 复制 HTML 源码', async ({ page, request }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    await page.click('button:has-text("Copy")')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('<html>')
    expect(clipboard).toContain('Hello from iframe')
  })

  test('TC-HTML-023: Download 按钮存在', async ({ page, request }) => {
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    await expect(page.locator('button:has-text("Download")')).toBeVisible()
  })
})

// ─── Test Suite: 多文件 ───────────────────────────────────────────────────────

test.describe('多文件 entry', () => {
  test('TC-HTML-030: .html 文件用 iframe，.css 文件用 CodeViewer', async ({ page, request }) => {
    await createHtmlEntry(request, 'e2e-html-multifile', [
      { filename: 'index.html', content: SIMPLE_HTML },
      { filename: 'style.css', content: 'body { color: red; }' },
    ])

    await page.goto('/e2e-html-multifile')
    await waitForIframe(page)

    // 初始选中 index.html → iframe
    await expect(page.locator('iframe.html-frame')).toBeVisible()

    // 切换到 style.css → CodeViewer
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
  test('TC-HTML-SEC-001: iframe 内无法读取父页面 cookie（沙盒隔离）', async ({ page, request }) => {
    // 设置父页面 cookie
    await page.context().addCookies([{
      name: 'sensitive_token',
      value: 'super_secret',
      domain: 'localhost',
      path: '/',
    }])

    await createHtmlEntry(request, 'e2e-html-security', [
      { filename: 'test.html', content: HTML_SANDBOX_ESCAPE_ATTEMPT },
    ])

    await page.goto('/e2e-html-security')
    await waitForIframe(page)

    // 等待 iframe 内脚本执行
    await page.waitForTimeout(1000)

    // iframe title 应为 SANDBOX_INTACT，不应为 ESCAPE_SUCCESS
    const iframe = page.frameLocator('iframe.html-frame')
    const title = await iframe.locator('title').textContent().catch(() => '')
    expect(title).not.toBe('ESCAPE_SUCCESS')

    // 父页面 cookie 不应被读取到（通过 iframe 内容验证）
    const bodyText = await iframe.locator('body').textContent()
    expect(bodyText).toContain('top.location blocked')
  })

  test('TC-HTML-SEC-002: iframe 内 top.location 修改被阻止', async ({ page }) => {
    await page.goto('/e2e-html-security')
    await waitForIframe(page)

    await page.waitForTimeout(1000)

    // 页面应仍在 PeekView，不应被跳转到 evil.com
    expect(page.url()).not.toContain('evil.com')
    expect(page.url()).toContain('localhost')
  })
})

// ─── Test Suite: 移动端布局 ───────────────────────────────────────────────────

test.describe('移动端布局', { tag: '@mobile' }, () => {
  test('TC-HTML-040: 移动端 iframe 正常显示，操作栏在底部', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/e2e-html-basic')
    await waitForIframe(page)

    await expect(page.locator('iframe.html-frame')).toBeVisible()

    // 底部 ActionBar 应存在
    await expect(page.locator('[data-testid="action-bar"]')).toBeVisible()

    await page.screenshot({ path: 'test-results/tc-html-040-mobile.png' })
  })
})
