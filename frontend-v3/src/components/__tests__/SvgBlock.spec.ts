/**
 * SvgBlock 组件层测试（P3b-3）
 *
 * mount MarkdownViewer 组件，传入含 ```svg 代码块的 markdown，
 * 断言 DOM 结构和 toggle 行为。svg 块的 HTML 结构镜像 mermaid/plantuml：
 *   .svg-block > .svg-header > .svg-label("SVG") + .svg-header-actions
 *     > .svg-view-toggle[data-action="toggle-svg-view"] > .toggle-text
 *     > .fullscreen-btn[data-action="open-svg-fullscreen"]
 *     > .svg-dropdown > .menu-btn + .svg-dropdown-menu
 *   .svg-content[data-mode="diagram"].is-active  (图形视图，默认)
 *   .svg-content[data-mode="code"]               (代码视图，默认隐藏)
 *
 * 状态：P3 TDD RED。useMarkdown.ts 当前只有 mermaid/plantuml 分支，
 * 无 svg 分支，```svg 代码块会走通用 fence 渲染（.code-block-wrapper），
 * 不生成 .svg-block → 所有 svg 相关断言失败（红灯，正确）。
 * P4 在 useMarkdown 增加 svg 分支 + MarkdownViewer 增加 toggle-svg-view
 * action 处理后转 GREEN。
 */

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MarkdownViewer from '../MarkdownViewer.vue'

// ─── 测试用 markdown ──────────────────────────────────────────────────────────

const SVG_CODE = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="40" fill="red"/></svg>'

const MD_WITH_SVG_BLOCK = '```svg\n' + SVG_CODE + '\n```\n'

const MD_WITH_INLINE_SVG = 'Here is an inline svg:\n\n' + SVG_CODE + '\n'

const MD_WITH_THREE_FAMILIES = [
  '```mermaid',
 'graph LR; A-->B',
 '```',
 '',
 '```plantuml',
 '@startuml',
 'Bob -> Alice : hello',
 '@enduml',
 '```',
 '',
 '```svg',
 SVG_CODE,
 '```',
 '',
].join('\n')

// MarkdownViewer 内部用 useThemeStore（pinia），mount 需注入 active pinia
function mountViewer(content: string) {
  return mount(MarkdownViewer, {
    props: { content },
    global: { plugins: [createPinia()] },
  })
}

// 等待 MarkdownViewer 的完整异步渲染链：
// render(content) → setRenderedHtml → nextTick → renderMermaidDiagrams → renderPlantUmlDiagrams → renderSvgBlocks
// render() 内部调用 Shiki 的 createHighlighter（macrotask，动态导入语言/主题），
// flushPromises 只能 flush microtask，无法可靠等待 macrotask → 用 vi.waitFor 轮询。
async function waitForRender(wrapper: VueWrapper) {
  await flushPromises()
  await vi.waitFor(() => {
    const body = wrapper.find('.markdown-body')
    if (!body.exists() || body.text() === '') {
      throw new Error('markdown not rendered yet')
    }
  }, { timeout: 5000, interval: 10 })
  await flushPromises()
  await flushPromises()
  await flushPromises()
}

// ─── TC-01 渲染结构 ───────────────────────────────────────────────────────────
describe('TC-01 渲染结构', () => {
  it('```svg 代码块生成 .svg-block 容器', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    expect(wrapper.find('.svg-block').exists()).toBe(true)
  })

  it('.svg-block 含 .svg-label 文本 "SVG"', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const label = wrapper.find('.svg-block .svg-label')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('SVG')
  })

  it('.svg-block 含 .svg-view-toggle / .fullscreen-btn / .svg-dropdown', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    expect(wrapper.find('.svg-block .svg-view-toggle').exists()).toBe(true)
    expect(wrapper.find('.svg-block .fullscreen-btn').exists()).toBe(true)
    expect(wrapper.find('.svg-block .svg-dropdown').exists()).toBe(true)
  })
})

// ─── TC-02 默认图形视图 ───────────────────────────────────────────────────────
describe('TC-02 默认图形视图', () => {
  it('diagram-mode 默认 is-active', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const diagram = wrapper.find('.svg-block .svg-content[data-mode="diagram"]')
    expect(diagram.exists()).toBe(true)
    expect(diagram.classes()).toContain('is-active')
  })

  it('code-mode 默认非 is-active', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const code = wrapper.find('.svg-block .svg-content[data-mode="code"]')
    expect(code.exists()).toBe(true)
    expect(code.classes()).not.toContain('is-active')
  })

  it('toggle-text 默认为 "Diagram"', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const toggleText = wrapper.find('.svg-block .svg-view-toggle .toggle-text')
    expect(toggleText.exists()).toBe(true)
    expect(toggleText.text()).toBe('Diagram')
  })
})

// ─── TC-03 toggle 切换 ────────────────────────────────────────────────────────
describe('TC-03 toggle 切换', () => {
  it('点击 toggle 后切换到 code 视图', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const toggleBtn = wrapper.find(".svg-block .svg-view-toggle")
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')
    await flushPromises()

    const diagram = wrapper.find('.svg-block .svg-content[data-mode="diagram"]')
    const code = wrapper.find('.svg-block .svg-content[data-mode="code"]')
    expect(code.classes()).toContain('is-active')
    expect(diagram.classes()).not.toContain('is-active')

    const toggleText = wrapper.find('.svg-block .svg-view-toggle .toggle-text')
    expect(toggleText.text()).toBe('Code')
  })

  it('再次点击切回 diagram 视图', async () => {
    const wrapper = mountViewer(MD_WITH_SVG_BLOCK)
    await waitForRender(wrapper)

    const toggleBtn = wrapper.find(".svg-block .svg-view-toggle")

    // 第一次：切到 code
    await toggleBtn.trigger('click')
    await flushPromises()

    // 第二次：切回 diagram
    await toggleBtn.trigger('click')
    await flushPromises()

    const diagram = wrapper.find('.svg-block .svg-content[data-mode="diagram"]')
    const code = wrapper.find('.svg-block .svg-content[data-mode="code"]')
    expect(diagram.classes()).toContain('is-active')
    expect(code.classes()).not.toContain('is-active')

    const toggleText = wrapper.find('.svg-block .svg-view-toggle .toggle-text')
    expect(toggleText.text()).toBe('Diagram')
  })
})

// ─── TC-10 内联 svg 不受影响 ──────────────────────────────────────────────────
describe('TC-10 内联 svg 不受影响', () => {
  it('内联 svg 不产生 .svg-block 容器', async () => {
    const wrapper = mountViewer(MD_WITH_INLINE_SVG)
    await waitForRender(wrapper)

    // 内联 svg 走 markdown inline html，不走代码块管线，不应有 .svg-block
    expect(wrapper.find('.svg-block').exists()).toBe(false)
  })
})

// ─── TC-12 三族共存 ───────────────────────────────────────────────────────────
describe('TC-12 三族共存', () => {
  it('mermaid / plantuml / svg 三块各自有独立容器', async () => {
    const wrapper = mountViewer(MD_WITH_THREE_FAMILIES)
    await waitForRender(wrapper)

    expect(wrapper.find('.mermaid-block').exists()).toBe(true)
    expect(wrapper.find('.plantuml-block').exists()).toBe(true)
    expect(wrapper.find('.svg-block').exists()).toBe(true)
  })
})
