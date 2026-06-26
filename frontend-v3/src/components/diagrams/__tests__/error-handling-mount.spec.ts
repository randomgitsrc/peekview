/**
 * useCodeBlockRenderer 错误处理单测（P3b-2，文件 2）
 *
 * 错误处理分两层：
 * - preRender 阶段：mermaid/plantuml render 抛错 → sourcesMap.set error 标记（不操作 DOM）
 * - mount 阶段：BaseDiagram 渲染时检测到 error → 显示错误 UI
 *
 * 纯 composable 测试，mock useMermaid/usePlantUML 抛错，断言 sourcesMap 标记。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mock 外部渲染器 ───
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

describe('6. 错误处理', () => {
  beforeEach(() => {
    mermaidRenderMock.mockReset()
    plantUmlRenderMock.mockReset()
    highlightCodeMock.mockReset()
    mermaidRenderMock.mockResolvedValue('<svg>mock</svg>')
    plantUmlRenderMock.mockResolvedValue('<svg>plantuml</svg>')
    highlightCodeMock.mockResolvedValue('<shiki>highlighted</shiki>')
    document.body.innerHTML = ''
  })

  it('6.1 preRenderMermaid 抛错标记 error 不操作 DOM', async () => {
    mermaidRenderMock.mockRejectedValueOnce(new Error('mermaid render failed'))
    document.body.innerHTML = '<div id="mount-0"></div>'
    const mountPoint = document.getElementById('mount-0')!
    const before = mountPoint.innerHTML

    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(0, 'graph LR', 'light', '<code>view</code>')

    expect(renderer.getError(0)).toBe('Failed to render diagram')
    expect(mountPoint.innerHTML).toBe(before)
  })

  it('6.2 preRenderPlantUml 抛错标记 error', async () => {
    plantUmlRenderMock.mockRejectedValueOnce(new Error('plantuml failed'))
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderPlantUml(0, '@startuml\nA->B\n@enduml', 'light', '<code>view</code>')
    expect(renderer.getError(0)).toBe('plantuml-validate-failed')
  })

  it('6.3 svg sanitize 失败不阻断', async () => {
    const renderer = useCodeBlockRenderer()
    await renderer.registerSvg(0, '<svg><circle r="10"/></svg>', 'light')
    const err = renderer.getError(0)
    expect(err).toBeUndefined()
    expect(renderer.sourcesMap.get(0)?.code).toBe('<svg><circle r="10"/></svg>')
  })

  it('6.4 preRender error 标记 sourcesMap.error 不操作 DOM', async () => {
    mermaidRenderMock.mockRejectedValueOnce(new Error('mermaid render failed'))
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(0, 'graph LR', 'light', '<code>view</code>')

    const src = renderer.sourcesMap.get(0)
    expect(src?.error).toBeDefined()
    expect(src?.error).toBe('Failed to render diagram')
  })

  it('6.5 getError(index) 返回 error 标记', async () => {
    mermaidRenderMock.mockRejectedValueOnce(new Error('mermaid render failed'))
    const renderer = useCodeBlockRenderer()
    await renderer.preRenderMermaid(5, 'graph', 'light', '<code>view</code>')
    expect(renderer.getError(5)).toBe('Failed to render diagram')
    expect(renderer.getError(99)).toBeUndefined()
  })
})