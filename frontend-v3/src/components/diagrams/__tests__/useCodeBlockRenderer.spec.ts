/**
 * useCodeBlockRenderer composable 单测（P3b-1，文件 1）
 *
 * 纯函数单测：直接调 useCodeBlockRenderer()，mock useMermaid/usePlantUML/useShiki，
 * 不 mount 任何组件。stub 返回空值 → 断言失败 = 红灯（TDD RED）。
 * P4 实现后转 GREEN。
 *
 * 依据：P3-test-cases.md 第 2 节文件 1（13 测试点）+ P2-design.md 第 4 节。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mock 外部渲染器（stub 不导入，但 P4 实现后会用；mock 保证测试隔离）──
const { mermaidRenderMock, plantUmlRenderMock, highlightCodeMock } = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
  plantUmlRenderMock: vi.fn(),
  highlightCodeMock: vi.fn(),
}))

vi.mock('@/composables/useMermaid', () => ({
  useMermaid: () => ({ render: mermaidRenderMock }),
}))

vi.mock('@/composables/usePlantUML', () => ({
  render: plantUmlRenderMock,
  validateSource: vi.fn(() => ({ ok: true })),
  ensureLoaded: vi.fn(async () => {}),
  _setPlantUmlRender: vi.fn(),
  _setTimeout: vi.fn(),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({ highlightCode: highlightCodeMock }),
}))

import { useCodeBlockRenderer } from '@/composables/useCodeBlockRenderer'

describe('useCodeBlockRenderer', () => {
  beforeEach(() => {
    mermaidRenderMock.mockReset()
    plantUmlRenderMock.mockReset()
    highlightCodeMock.mockReset()
    mermaidRenderMock.mockResolvedValue('<svg>mock</svg>')
    plantUmlRenderMock.mockResolvedValue('<svg>plantuml</svg>')
    highlightCodeMock.mockResolvedValue('<shiki>highlighted</shiki>')
    document.body.innerHTML = ''
  })

  it('1.1 mermaidCache key 格式 `${theme}-${code}`，命中跳过 render', async () => {
    const r = useCodeBlockRenderer()
    await r.preRenderMermaid(0, 'graph TD', 'light', '<code>view</code>')
    expect(r.mermaidCache.has('light-graph TD')).toBe(true)
    expect(r.mermaidCache.get('light-graph TD')).toBe('<svg>mock</svg>')
    expect(mermaidRenderMock).toHaveBeenCalled()
  })

  it('1.2 getMermaidSvgByIndex miss 返回空串，hit 返回 svgContent', async () => {
    const r = useCodeBlockRenderer()
    expect(r.getMermaidSvgByIndex(99)).toBe('')
    await r.preRenderMermaid(0, 'graph TD', 'light', '<code></code>')
    expect(r.getMermaidSvgByIndex(0)).toBe('<svg>mock</svg>')
    expect(r.getMermaidSvgByIndex(99)).toBe('')
  })

  it('1.3 getCodeViewHtml(index) mermaid/plantuml 同步；svg 异步', async () => {
    const r = useCodeBlockRenderer()
    const codeView = '<pre>escaped</pre>'
    await r.preRenderMermaid(0, 'graph TD', 'light', codeView)
    expect(r.getCodeViewHtml(0)).toBe(codeView)
    await r.preRenderPlantUml(1, '@startuml\nA->B\n@enduml', 'light', '<pre>p</pre>')
    expect(r.getCodeViewHtml(1)).toBe('<pre>p</pre>')
    await r.registerSvg(2, '<svg/>', 'light')
    expect(r.getCodeViewHtml(2)).toBe('<shiki>highlighted</shiki>')
  })

  it('1.4 getError(index) 返回 error 标记', async () => {
    const r = useCodeBlockRenderer()
    mermaidRenderMock.mockRejectedValueOnce(new Error('render boom'))
    await r.preRenderMermaid(0, 'bad code', 'light', '<code></code>')
    expect(r.getError(0)).toBeTruthy()
    expect(r.getMermaidSvgByIndex(0)).toBe('')
  })

  it('1.5 nextToken 递增 + isCurrent 二值', () => {
    const r = useCodeBlockRenderer()
    const t1 = r.nextToken()
    const t2 = r.nextToken()
    expect(t2).toBeGreaterThan(t1)
    expect(r.isCurrent(t2)).toBe(true)
    expect(r.isCurrent(t1)).toBe(false)
  })

  it('1.6 preRenderMermaid cache 命中不调渲染器', async () => {
    const r = useCodeBlockRenderer()
    await r.preRenderMermaid(0, 'graph TD', 'light', '<code></code>')
    const callsAfterFirst = mermaidRenderMock.mock.calls.length
    expect(callsAfterFirst).toBe(1)
    await r.preRenderMermaid(1, 'graph TD', 'light', '<code></code>')
    expect(mermaidRenderMock.mock.calls.length).toBe(callsAfterFirst)
  })

  it('1.7 preRenderMermaid 抛错标记 error 不操作 DOM', async () => {
    const r = useCodeBlockRenderer()
    mermaidRenderMock.mockRejectedValueOnce(new Error('render fail'))
    document.body.innerHTML = '<div id="mount-0"></div>'
    const mountPoint = document.getElementById('mount-0')!
    const before = mountPoint.innerHTML
    await r.preRenderMermaid(0, 'bad', 'light', '<code></code>')
    expect(r.getError(0)).toBeTruthy()
    expect(mountPoint.innerHTML).toBe(before)
  })

  it('1.8 preRenderPlantUml 走 usePlantUML.render 串行，禁 Promise.all', async () => {
    const r = useCodeBlockRenderer()
    await r.preRenderPlantUml(0, '@startuml\nA->B\n@enduml', 'light', '<code></code>')
    expect(plantUmlRenderMock).toHaveBeenCalled()
    expect(r.getPlantUmlSvgByIndex(0)).toBe('<svg>plantuml</svg>')
    expect(plantUmlRenderMock.mock.calls.length).toBe(1)
  })

  it('1.9 registerSvg 异步 Shiki 填 codeViewHtml', async () => {
    const r = useCodeBlockRenderer()
    await r.registerSvg(0, '<svg xmlns="x"><circle r="40"/></svg>', 'light')
    expect(highlightCodeMock).toHaveBeenCalledWith(expect.any(String), 'xml', 'github-light')
    expect(r.getCodeViewHtml(0)).toBe('<shiki>highlighted</shiki>')
    // registerSvg 设 svgContent=code；mermaid svg getter 仍返回 svgContent（svg 源码）—— getMermaidSvgByIndex 是按 index 查 sourcesMap.svgContent，不分 lang
    expect(r.getMermaidSvgByIndex(0)).toBe('<svg xmlns="x"><circle r="40"/></svg>')
  })

  it('1.10 registerInstance/unregister/getInstance 按 lang+id', () => {
    const r = useCodeBlockRenderer()
    const inst = { toggle: () => {} }
    r.registerInstance('mermaid', 'b0', inst)
    expect(r.getInstance('mermaid', 'b0')).toBe(inst)
    expect(r.getInstance('mermaid', 'b1')).toBeUndefined()
    expect(r.getInstance('svg', 'b0')).toBeUndefined()
    r.unregisterInstance('mermaid', 'b0')
    expect(r.getInstance('mermaid', 'b0')).toBeUndefined()
  })

  it('1.11 beginResize/endResize 维护 resizingBlock', () => {
    const r = useCodeBlockRenderer()
    r.beginResize('b0', 100, 300)
    expect(r.resizingBlock.value).toBe('b0')
    expect(r.startY.value).toBe(100)
    expect(r.startHeight.value).toBe(300)
    r.endResize()
    expect(r.resizingBlock.value).toBeNull()
  })

  it('1.12 clearInstances 清空三族 Map', () => {
    const r = useCodeBlockRenderer()
    r.registerInstance('mermaid', 'b0', {})
    r.registerInstance('plantuml', 'b1', {})
    r.registerInstance('svg', 'b2', {})
    expect(r.instances.mermaid.size).toBe(1)
    expect(r.instances.plantuml.size).toBe(1)
    expect(r.instances.svg.size).toBe(1)
    r.clearInstances()
    expect(r.instances.mermaid.size).toBe(0)
    expect(r.instances.plantuml.size).toBe(0)
    expect(r.instances.svg.size).toBe(0)
  })

  it('1.13 renderMermaidFresh/renderPlantUmlFresh 非 cache', async () => {
    const r = useCodeBlockRenderer()
    const svg1 = await r.renderMermaidFresh('graph TD', 'light')
    expect(svg1).toBe('<svg>mock</svg>')
    expect(mermaidRenderMock).toHaveBeenCalled()
    // fresh 不写 cache
    expect(r.mermaidCache.size).toBe(0)
    const svg2 = await r.renderPlantUmlFresh('@startuml\nA->B\n@enduml', 'light')
    expect(svg2).toBe('<svg>plantuml</svg>')
    expect(plantUmlRenderMock).toHaveBeenCalled()
  })
})
