/**
 * HtmlViewer 单元测试
 *
 * 覆盖 spec-html-render.md P1 测试项：
 * - Blob URL 正确创建和释放（无内存泄漏）
 * - DOMParser 相对路径检测触发警告条
 * - > 2MB 文件不自动渲染，手动触发正常
 * - Load 事件后 Loading 态消失
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HtmlViewer from '../HtmlViewer.vue'
import { HTML_VIEWER_TEST_SIZE_KEY } from '../HtmlViewerTestKeys'

// ─── Mock URL.createObjectURL / revokeObjectURL ──────────────────────────────
const mockBlobUrl = 'blob:null/mock-uuid-1234'
const createObjectURLMock = vi.fn(() => mockBlobUrl)
const revokeObjectURLMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock,
  })
  createObjectURLMock.mockClear()
  revokeObjectURLMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── 测试用 HTML ─────────────────────────────────────────────────────────────
const SIMPLE_HTML = '<html><body><h1>Hello</h1></body></html>'

// 3 个相对路径：style.css / main.js / ../assets/logo.png
// 2 个非相对路径（不计入）：https://cdn... / data:image...
const HTML_WITH_RELATIVE_PATHS = `
<html>
  <head>
    <link rel="stylesheet" href="style.css">
    <script src="./main.js"></script>
  </head>
  <body>
    <img src="../assets/logo.png">
    <img src="https://cdn.example.com/ok.png">
    <img src="data:image/png;base64,abc">
  </body>
</html>
`

const HTML_CDN_ONLY = `
<html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="//fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
  </head>
  <body><h1>CDN only</h1></body>
</html>
`

const MB = 1024 * 1024

// ─── Blob URL 创建与释放 ──────────────────────────────────────────────────────
describe('Blob URL 创建与释放', () => {
  it('挂载时创建 Blob URL，src 绑定到 iframe', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(createObjectURLMock).toHaveBeenCalledOnce()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = (createObjectURLMock.mock.calls as any[][])[0][0]
    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).type).toBe('text/html')

    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe(mockBlobUrl)
  })

  it('卸载时释放 Blob URL，防止内存泄漏', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    wrapper.unmount()

    expect(revokeObjectURLMock).toHaveBeenCalledOnce()
    expect(revokeObjectURLMock).toHaveBeenCalledWith(mockBlobUrl)
  })

  it('content 变更时释放旧 URL 并创建新 URL', async () => {
    const mockBlobUrl2 = 'blob:null/mock-uuid-5678'
    createObjectURLMock
      .mockReturnValueOnce(mockBlobUrl)
      .mockReturnValueOnce(mockBlobUrl2)

    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ content: '<html><body>Updated</body></html>' })
    await flushPromises()

    expect(revokeObjectURLMock).toHaveBeenCalledWith(mockBlobUrl)
    expect(createObjectURLMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('iframe').attributes('src')).toBe(mockBlobUrl2)
  })
})

// ─── iframe sandbox 属性 ──────────────────────────────────────────────────────
describe('iframe sandbox 属性', () => {
  it('sandbox 仅含 allow-scripts，不含危险权限', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    const sandbox = wrapper.find('iframe').attributes('sandbox') ?? ''
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(sandbox).not.toContain('allow-forms')
    expect(sandbox).not.toContain('allow-popups')
    expect(sandbox).not.toContain('allow-top-navigation')
  })

  it('referrerpolicy 为 no-referrer', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('iframe').attributes('referrerpolicy')).toBe('no-referrer')
  })
})

// ─── 相对路径检测 ─────────────────────────────────────────────────────────────
describe('相对路径检测警告', () => {
  it('含相对路径时显示警告条，数量为 3', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    // style.css + ./main.js + ../assets/logo.png = 3 个
    // https://... 和 data:... 不计入
    expect(warning.text()).toContain('3')
  })

  it('仅含 CDN 外链时不显示警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_CDN_ONLY },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })

  it('无外部引用时不显示警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })

  it('可以关闭警告条', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    const closeBtn = wrapper.find('[data-testid="relative-path-warning-close"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })
})

// ─── 大文件分级处理 ───────────────────────────────────────────────────────────
// 通过 mock 组件内部的大小计算函数避免生成真实大字符串
describe('大文件分级处理', () => {
  it('< 512KB：正常渲染，无警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('512KB ~ 2MB：显示性能警告，仍自动渲染', async () => {
    // mock contentSize computed 返回 600KB
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
      global: {
        provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 600 * 1024 },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })

  it('> 2MB：不自动渲染，显示手动触发按钮', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
      global: {
        provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 3 * MB },
      },
    })
    await flushPromises()

    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('恰好 512KB：显示性能警告，仍自动渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 512 * 1024 } },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })

  it('恰好 2MB：不自动渲染，显示手动触发按钮', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 2 * MB } },
    })
    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('> 2MB：点击手动触发后正常渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
      global: {
        provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 3 * MB },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="manual-render-btn"]').trigger('click')
    await flushPromises()

    expect(createObjectURLMock).toHaveBeenCalledOnce()
    expect(wrapper.find('iframe').exists()).toBe(true)
  })
})

// ─── Loading 状态 ─────────────────────────────────────────────────────────────
describe('Loading 状态', () => {
  it('iframe load 事件前显示 Loading 态', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
  })

  it('iframe load 事件后 Loading 态消失', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    await wrapper.find('iframe').trigger('load')

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(false)
  })
})

// ─── 多文件注入 ──────────────────────────────────────────────────────────────
describe('多文件注入', () => {
  const HTML_MULTI = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles.css">
  <script src="app.js"></script>
  <script type="module" src="main.mjs"></script>
  <link rel="icon" href="favicon.ico">
  <script type="application/json" src="data.json"></script>
</head>
<body>
  <h1>Hello</h1>
  <script src="https://cdn.example.com/lib.js"></script>
  <img src="missing.png">
</body>
</html>`

  it('无 siblingFiles 时行为与当前一致，相对路径警告正常', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_MULTI },
    })
    await flushPromises()

    // styles.css + app.js + main.mjs + favicon.ico + data.json + missing.png = 6
    // (https://cdn... 不计入)
    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('6')
  })

  it('CSS 内联注入：link[rel=stylesheet] 替换为 style', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'styles.css', content: 'body { color: red; }', language: 'css' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: styles.css */')
    expect(text).toContain('body { color: red; }')
    // link[rel=stylesheet] should be gone
    expect(text).not.toMatch(/<link[^>]*href="styles\.css"/)
  })

  it('JS 内联注入：script[src] 替换为 inline script 并移到 body 末尾', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'app.js', content: 'console.log("hi")', language: 'javascript' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: app.js */')
    expect(text).toContain('console.log("hi")')
    // head 中不应有注入的 script（原 <script src="app.js"> 在 head 中）
    // 注入后移到 body 末尾，保证 DOM 就绪再执行
    const bodyStart = text.indexOf('<body')
    const injectMarker = text.indexOf('/* injected from: app.js */')
    expect(injectMarker).toBeGreaterThan(bodyStart)
  })

  it('混合注入：CSS + JS 同时注入', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [
          { filename: 'styles.css', content: 'body {}', language: 'css' },
          { filename: 'app.js', content: 'console.log(1)', language: 'javascript' },
        ],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: styles.css */')
    expect(text).toContain('/* injected from: app.js */')
  })

  it('文件名带 ./ 前缀的 href 正确匹配', async () => {
    const html = '<html><head><link rel="stylesheet" href="./styles.css"></head><body></body></html>'
    mount(HtmlViewer, {
      props: {
        content: html,
        siblingFiles: [{ filename: 'styles.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: styles.css */')
  })

  it('不匹配的引用保留原节点，计入 unmatchedCount', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'styles.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    // styles.css 注入成功，剩余: app.js + main.mjs + favicon.ico + data.json + missing.png = 5
    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('5')
  })

  it('非 stylesheet 的 link 不替换（rel=icon）', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'favicon.ico', content: 'not-real', language: 'ico' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    // favicon.ico link should remain unchanged
    expect(text).toContain('href="favicon.ico"')
    expect(text).not.toContain('/* injected from: favicon.ico */')
  })

  it('type="module" script 不注入，计入 unmatchedCount', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'main.mjs', content: 'export default {}', language: 'javascript' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).not.toContain('/* injected from: main.mjs */')
    expect(text).toContain('src="main.mjs"')
  })

  it('type="application/json" script 不替换', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'data.json', content: '{}', language: 'json' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).not.toContain('/* injected from: data.json */')
  })

  it('空文件内容不崩溃', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'styles.css', content: '', language: 'css' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: styles.css */')
  })

  it('siblingFile filename 含 ./ 前缀时 normalizeRef 正确 strip', async () => {
    const html = '<html><head><link rel="stylesheet" href="styles.css"></head><body></body></html>'
    mount(HtmlViewer, {
      props: {
        content: html,
        siblingFiles: [{ filename: './styles.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('/* injected from: styles.css */')
  })

  it('siblingFile filename 为绝对路径时不崩溃', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: '/absolute/path.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    // /absolute/path.css → normalizeRef returns null → fileMap skips it → no crash
    expect(createObjectURLMock).toHaveBeenCalled()
  })

  it('loadingSiblings=true 时显示 Loading 态，不渲染 iframe', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        content: SIMPLE_HTML,
        loadingSiblings: true,
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('DOCTYPE 保留：注入后序列化结果含 <!DOCTYPE html>', async () => {
    mount(HtmlViewer, {
      props: {
        content: HTML_MULTI,
        siblingFiles: [{ filename: 'styles.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    const blob = (createObjectURLMock.mock.calls as any[][])[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('<!DOCTYPE html>')
  })

  it('unmatchedCount 正确：全部注入时警告消失', async () => {
    const html = '<html><head><link rel="stylesheet" href="styles.css"></head><body></body></html>'
    const wrapper = mount(HtmlViewer, {
      props: {
        content: html,
        siblingFiles: [{ filename: 'styles.css', content: 'body{}', language: 'css' }],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })
})
