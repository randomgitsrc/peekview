/**
 * HtmlViewer 单元测试（T019 rev 2：后端 render 路由方案）
 *
 * 覆盖 P2-design.md「前端设计」节测试项：
 * - iframe src 指向后端 render 路由 /api/v1/entries/{slug}/files/{file_id}/render
 * - sibling file IDs 作为 ?inject= 逗号分隔 query 参数传递
 * - iframe sandbox="allow-scripts"（无 allow-same-origin，凭据隔离）
 * - iframe 无 csp 属性（CSP 由后端 HTTP response header 设置）
 * - 前端仍保留 countRelativePaths 相对路径检测（显示警告条，不注入）
 * - > 2MB 文件不自动渲染，手动触发后正常
 * - loadingSiblings=true 时 iframe 不渲染（等 sibling IDs 到齐）
 *
 * 状态：P3 TDD RED。HtmlViewer.vue 仍为 srcdoc 方案，测试此时应失败；
 * P4 改造 HtmlViewer.vue 为 :src="renderUrl" 后转 GREEN。
 */

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HtmlViewer from '../HtmlViewer.vue'
import { HTML_VIEWER_TEST_SIZE_KEY } from '../HtmlViewerTestKeys'

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

// 默认 props（构造完整 renderUrl 所需：slug + fileId + content + siblingFileIds）
const DEFAULT_PROPS = {
  slug: 'test-slug',
  fileId: 42,
  content: SIMPLE_HTML,
  siblingFileIds: [] as number[],
}

// ─── renderUrl 拼接 ──────────────────────────────────────────────────────────
describe('renderUrl 拼接', () => {
  it('iframe src 指向 render 路由', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/api/v1/entries/test-slug/files/42/render')
  })

  it('无 siblingFileIds 时 URL 不含 inject 参数', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, siblingFileIds: [] },
    })
    await flushPromises()

    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/render')
    expect(src).not.toContain('inject=')
  })

  it('sibling file IDs 作为 inject query 参数（逗号分隔）', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        siblingFileIds: [10, 20, 30],
      },
    })
    await flushPromises()

    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/render')
    expect(src).toContain('inject=10,20,30')
  })

  it('单个 sibling file ID 也走 inject 参数', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        siblingFileIds: [99],
      },
    })
    await flushPromises()

    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('inject=99')
  })

  it('slug 变化时 URL 更新', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    let src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/entries/test-slug/files/42/render')

    await wrapper.setProps({ slug: 'new-slug' })
    await flushPromises()

    src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/entries/new-slug/files/42/render')
    expect(src).not.toContain('test-slug')
  })

  it('fileId 变化时 URL 更新', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    await wrapper.setProps({ fileId: 99 })
    await flushPromises()

    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/files/99/render')
  })

  it('siblingFileIds 变化时 inject 参数更新', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, siblingFileIds: [1, 2] },
    })
    await flushPromises()

    let src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('inject=1,2')

    await wrapper.setProps({ siblingFileIds: [3, 4, 5] })
    await flushPromises()

    src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('inject=3,4,5')
    expect(src).not.toContain('inject=1,2')
  })

  it('iframe 用 src 而非 srcdoc', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('src')).toBeTruthy()
    // 改用 :src 后不应再有 srcdoc 属性
    expect(iframe.attributes('srcdoc')).toBeFalsy()
  })
})

// ─── iframe sandbox 属性（凭据隔离）──────────────────────────────────────────
describe('iframe sandbox 属性', () => {
  it('sandbox 仅含 allow-scripts，不含危险权限', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    const sandbox = wrapper.find('iframe').attributes('sandbox') ?? ''
    expect(sandbox).toContain('allow-scripts')
    // 关键：无 allow-same-origin → iframe content 在 opaque origin 运行，
    // 无法访问父页面 cookie/localStorage（BDD-8 凭据隔离）
    expect(sandbox).not.toContain('allow-same-origin')
    expect(sandbox).not.toContain('allow-forms')
    expect(sandbox).not.toContain('allow-popups')
    expect(sandbox).not.toContain('allow-top-navigation')
  })

  it('referrerpolicy 为 no-referrer', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    expect(wrapper.find('iframe').attributes('referrerpolicy')).toBe('no-referrer')
  })
})

// ─── iframe 无 csp 属性（CSP 由后端 HTTP header 设置）─────────────────────────
describe('iframe 无 csp 属性（CSP 由后端 HTTP response header 设置）', () => {
  it('iframe 不携带 csp 属性', async () => {
    // 新方案：iframe 加载独立 URL，浏览器用该 URL 响应的 CSP header
    // iframe 的 csp 属性只能追加限制不能放宽，且 HTTP CSP 已生效，故移除
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    expect(wrapper.find('iframe').attributes('csp')).toBeFalsy()
  })
})

// ─── 相对路径检测警告（前端保留 countRelativePaths）──────────────────────────
// 注意：注入移到后端，前端只检测相对路径数量并显示警告条。
// siblingFileIds 不影响警告计数（前端不注入，仅传 ID 给后端）。
describe('相对路径检测警告', () => {
  it('含相对路径时显示警告条，数量为 3', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, content: HTML_WITH_RELATIVE_PATHS },
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
      props: { ...DEFAULT_PROPS, content: HTML_CDN_ONLY },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })

  it('无外部引用时不显示警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })

  it('可以关闭警告条', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, content: HTML_WITH_RELATIVE_PATHS },
    })
    await flushPromises()

    const closeBtn = wrapper.find('[data-testid="relative-path-warning-close"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)
  })

  it('siblingFileIds 存在时仍按原始 content 计数警告', async () => {
    // 前端只检测相对路径，不注入；注入由后端完成。
    // 警告计数与 siblingFileIds 无关，始终基于原始 content 扫描。
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        content: HTML_WITH_RELATIVE_PATHS,
        siblingFileIds: [10, 20, 30],
      },
    })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    // 警告数仍为 3（style.css + main.js + ../assets/logo.png）
    expect(warning.text()).toContain('3')
  })

  it('content 变更时警告数更新', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS, content: SIMPLE_HTML },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="relative-path-warning"]').exists()).toBe(false)

    await wrapper.setProps({ content: HTML_WITH_RELATIVE_PATHS })
    await flushPromises()

    const warning = wrapper.find('[data-testid="relative-path-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('3')
  })
})

// ─── 大文件分级处理 ───────────────────────────────────────────────────────────
// 通过 provide HTML_VIEWER_TEST_SIZE_KEY 注入虚假大小，避免生成真实大字符串
describe('大文件分级处理', () => {
  it('< 512KB：正常渲染，无警告', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('512KB ~ 2MB：显示性能警告，仍自动渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
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
      props: { ...DEFAULT_PROPS },
      global: {
        provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 3 * MB },
      },
    })
    await flushPromises()

    // 大文件未点击渲染时无 iframe
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('恰好 512KB：显示性能警告，仍自动渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 512 * 1024 } },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })

  it('恰好 2MB：不自动渲染，显示手动触发按钮', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 2 * MB } },
    })
    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('> 2MB：点击手动触发后正常渲染', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
      global: {
        provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 3 * MB },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="manual-render-btn"]').trigger('click')
    await flushPromises()

    // 点击渲染后 iframe 出现，src 指向 render 路由
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    const src = iframe.attributes('src') ?? ''
    expect(src).toContain('/api/v1/entries/test-slug/files/42/render')
  })
})

// ─── Loading 状态 ─────────────────────────────────────────────────────────────
describe('Loading 状态', () => {
  it('iframe load 事件前显示 Loading 态', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
  })

  it('iframe load 事件后 Loading 态消失', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    await wrapper.find('iframe').trigger('load')

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(false)
  })

  it('iframe error 事件后 Loading 态消失', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    await wrapper.find('iframe').trigger('error')

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(false)
  })
})

// ─── loadingSiblings 时序 ─────────────────────────────────────────────────────
// P2-design：shouldRender = !showManualRender && !props.loadingSiblings
// 等 sibling IDs 到齐再渲染，避免双次加载
describe('loadingSiblings 时序', () => {
  it('loadingSiblings=true 时显示 Loading 态，不渲染 iframe', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        loadingSiblings: true,
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('loadingSiblings 从 true 切到 false 后渲染 iframe', async () => {
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        loadingSiblings: true,
      },
    })
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(false)

    await wrapper.setProps({ loadingSiblings: false })
    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(true)
    const src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/render')
  })

  it('loadingSiblings=true 时即便有 siblingFileIds 也不渲染', async () => {
    // 防止 P4 误实现：把 siblingFileIds 非空当作"已就绪"
    const wrapper = mount(HtmlViewer, {
      props: {
        ...DEFAULT_PROPS,
        siblingFileIds: [10, 20, 30],
        loadingSiblings: true,
      },
    })
    await flushPromises()

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="html-loading"]').exists()).toBe(true)
  })
})

// ─── content 切换 ─────────────────────────────────────────────────────────────
describe('content 切换', () => {
  it('content 变更时 iframe 仍指向 render 路由（URL 不变）', async () => {
    // renderUrl 仅由 slug + fileId + siblingFileIds 决定，与 content 无关
    // content 仅用于相对路径检测和 size 检测
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    let src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/test-slug/files/42/render')

    await wrapper.setProps({ content: '<html><body><h1>Updated</h1></body></html>' })
    await flushPromises()

    src = wrapper.find('iframe').attributes('src') ?? ''
    expect(src).toContain('/test-slug/files/42/render')
  })

  it('卸载时不崩溃', async () => {
    // 后端 URL 方案无需手动 revoke Blob URL，unmount 应无副作用
    const wrapper = mount(HtmlViewer, {
      props: { ...DEFAULT_PROPS },
    })
    await flushPromises()

    expect(() => wrapper.unmount()).not.toThrow()
  })
})
