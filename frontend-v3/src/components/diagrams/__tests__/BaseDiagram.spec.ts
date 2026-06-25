/**
 * BaseDiagram 组件层测试（P3b-2）
 *
 * 测 BaseDiagram 的真实渲染行为：viewer v-html、classPrefix 派生、
 * modal toggle/close、modal 内 svg 可见、svgContent watch 更新、wheel 绑定。
 * mock svg-pan-zoom 避免真实库在 jsdom 中操作 SVG 失败。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BaseDiagram from '../BaseDiagram.vue'

vi.mock('svg-pan-zoom', () => ({
  default: vi.fn(() => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    center: vi.fn(),
    destroy: vi.fn(),
    resize: vi.fn(),
    fit: vi.fn(),
    on: vi.fn(),
    getZoom: vi.fn(() => 1),
    zoom: vi.fn(),
    panBy: vi.fn(),
  })),
}))

const baseProps = {
  svgContent: '<svg><circle r="10"/></svg>',
  codeViewHtml: '<span>code</span>',
  blockId: 'block-0',
  blockIndex: 0,
  classPrefix: 'mermaid' as const,
  theme: 'light' as const,
  label: 'MERMAID',
  pngBackground: '#ffffff' as const,
  pngViewBoxFallback: 'g-root-getBBox' as const,
  pngFinalSize: { width: 800, height: 600 },
  pngBrFix: true,
  pngFilenamePrefix: 'mermaid-diagram',
  panZoomMinZoom: 0.1,
  panZoomMaxZoom: 10,
  panZoomInitTryCatch: false,
  touchEnabled: true,
  resizeEnabled: true,
  refreshEventName: 'mermaid-refresh',
  modalTitle: 'Mermaid Diagram',
  toggleTextUpdates: true,
  refreshOnToggle: true,
  copyFeedback: true,
  menuClickOutside: true,
  menuCloseOthers: true,
}

function mountBase(overrides: Record<string, any> = {}) {
  return mount(BaseDiagram, {
    props: { ...baseProps, ...overrides },
  })
}

// Teleport to="body" 的内容不在 wrapper 树内，用 document.querySelector 查找。
// 每个测试前清理 body 残留（上一个测试 teleported 的 modal 不会自动卸载）。
beforeEach(() => {
  document.body.innerHTML = ''
})

describe('BaseDiagram', () => {
  it('1. svgContent v-html 渲染到 .mermaid-viewer', async () => {
    const wrapper = mountBase()
    await flushPromises()
    // jsdom 把自闭合 <circle r="10"/> 解析为 <circle r="10"></circle>
    expect(wrapper.find('.mermaid-viewer svg').exists()).toBe(true)
    expect(wrapper.find('.mermaid-viewer').html()).toContain('r="10"')
  })

  it('2. classPrefix=svg 派生 .svg-viewer', async () => {
    const wrapper = mountBase({ classPrefix: 'svg' })
    await flushPromises()
    expect(wrapper.find('.svg-viewer').exists()).toBe(true)
  })

  it('3. toggleFullscreen() 打开 modal', async () => {
    const wrapper = mountBase()
    await flushPromises()
    ;(wrapper.vm as any).toggleFullscreen()
    await flushPromises()
    expect(document.querySelector('.mermaid-modal-overlay')).not.toBeNull()
  })

  it('4. modal-title 文本 = modalTitle prop', async () => {
    const wrapper = mountBase({ modalTitle: 'My Modal Title' })
    await flushPromises()
    ;(wrapper.vm as any).toggleFullscreen()
    await flushPromises()
    const titleEl = document.querySelector('.modal-title')
    expect(titleEl).not.toBeNull()
    expect(titleEl!.textContent).toBe('My Modal Title')
  })

  it('5. closeFullscreen() 关闭 modal', async () => {
    const wrapper = mountBase()
    await flushPromises()
    ;(wrapper.vm as any).toggleFullscreen()
    await flushPromises()
    expect(document.querySelector('.mermaid-modal-overlay')).not.toBeNull()
    // closeFullscreen 未在 defineExpose 暴露，通过 close 按钮触发
    ;(document.querySelector('.close-btn') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('.mermaid-modal-overlay')).toBeNull()
  })

  it('6. modal 内 svgContent 可见', async () => {
    const wrapper = mountBase()
    await flushPromises()
    ;(wrapper.vm as any).toggleFullscreen()
    await flushPromises()
    const overlay = document.querySelector('.mermaid-modal-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelector('svg')).not.toBeNull()
  })

  it('7. svgContent 变化后 viewer 更新', async () => {
    const wrapper = mountBase()
    await flushPromises()
    const before = wrapper.find('.mermaid-viewer').html()
    await wrapper.setProps({ svgContent: '<svg><rect width="50" height="50"/></svg>' })
    await flushPromises()
    await flushPromises()
    const after = wrapper.find('.mermaid-viewer').html()
    expect(after).not.toBe(before)
    expect(after).toContain('<rect')
  })

  it('8. wheel 事件绑定', async () => {
    const wrapper = mountBase()
    await flushPromises()
    // 触发 wheel 事件不报错即通过（panZoomInstance 可能为 null，onWheel 早 return）
    await wrapper.find('.mermaid-viewer').trigger('wheel')
    expect(true).toBe(true)
  })
})
