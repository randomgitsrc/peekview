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

// 生成超过指定大小的 HTML（字节数）
function makeHtmlOfSize(bytes: number): string {
  const base = '<html><body>'
  const end = '</body></html>'
  const padding = 'x'.repeat(bytes - base.length - end.length)
  return base + padding + end
}

const MB = 1024 * 1024
const HTML_512KB_PLUS = makeHtmlOfSize(512 * 1024 + 1)
const HTML_2MB_PLUS = makeHtmlOfSize(2 * MB + 1)

// ─── Blob URL 创建与释放 ──────────────────────────────────────────────────────
describe('Blob URL 创建与释放', () => {
  it('挂载时创建 Blob URL，src 绑定到 iframe', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(createObjectURLMock).toHaveBeenCalledOnce()
    const blob = createObjectURLMock.mock.calls[0]?.[0]
    expect(blob).toBeDefined()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/html')

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
  it('sandbox 仅含 allow-scripts，不含 allow-same-origin / allow-forms / allow-popups', async () => {
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
  it('含相对路径时显示警告条', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('3')  // style.css + main.js + logo.png = 3 个
  })

  it('警告条显示正确的相对路径数量', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    // https:// 和 data: 开头的不计入
    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.text()).toContain('3')
  })

  it('仅含 CDN 外链时不显示警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_CDN_ONLY },
    })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(false)
  })

  it('无任何外部引用时不显示警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(false)
  })

  it('可以关闭警告条', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    const closeBtn = wrapper.find('[data-testid="relative-path-warning-close"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(false)
  })
})

// ─── 大文件分级处理 ───────────────────────────────────────────────────────────
describe('大文件分级处理', () => {
  it('< 512KB：正常渲染，无性能警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('512KB ~ 2MB：显示性能警告条，仍自动渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_512KB_PLUS },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    // 仍然自动渲染
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })

  it('> 2MB：不自动渲染，显示手动触发按钮', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_2MB_PLUS },
    })
    await flushPromises()

    // 不自动创建 Blob URL
    expect(createObjectURLMock).not.toHaveBeenCalled()
    // 不显示 iframe
    expect(wrapper.find('iframe').exists()).toBe(false)
    // 显示手动触发按钮
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('> 2MB：点击手动触发后正常渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: HTML_2MB_PLUS },
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

    // load 事件未触发前应有 loading 指示
    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
  })

  it('iframe load 事件后 Loading 态消失', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { content: SIMPLE_HTML },
    })
    await flushPromises()

    // 触发 iframe load 事件
    const iframe = wrapper.find('iframe')
    await iframe.trigger('load')

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(false)
  })
})
