import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import DiagramBlock from '@/components/DiagramBlock.vue'
import type { TocHeading, MarkdownBlock } from '@/types'

const mocks = vi.hoisted(() => ({
  mockRender: vi.fn(),
}))

vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({
    render: mocks.mockRender,
  }),
}))

function createHeadings(): TocHeading[] {
  return [
    { level: 1, text: 'Title', id: 'title' },
    { level: 2, text: 'Section', id: 'section' },
    { level: 2, text: 'Another', id: 'another' },
  ]
}

function createHtmlBlocks(): MarkdownBlock[] {
  return [
    { type: 'html', html: '<h1 id="title">Title</h1>' },
    { type: 'html', html: '<p>Paragraph text</p>' },
    { type: 'html', html: '<pre><code>console.log("hello")</code></pre>' },
  ]
}

function createMixedBlocks(): MarkdownBlock[] {
  return [
    { type: 'html', html: '<h1 id="intro">Intro</h1>' },
    { type: 'html', html: '<p>Some text</p>' },
    {
      type: 'diagram',
      lang: 'mermaid',
      code: 'graph TD; A-->B;',
      codeViewHtml: '<pre>mermaid code</pre>',
      index: 0,
    },
    { type: 'html', html: '<p>After diagram</p>' },
  ]
}

function resolveBlocks(blocks: MarkdownBlock[], headings: TocHeading[] = createHeadings()) {
  mocks.mockRender.mockResolvedValue({ blocks, headings })
}

describe('MarkdownViewer', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders html blocks', async () => {
    resolveBlocks(createHtmlBlocks(), createHeadings())

    const wrapper = mount(MarkdownViewer, {
      props: { content: '# Title\n\nSome content' },
    })
    await flushPromises()

    const html = wrapper.find('.markdown-body').html()
    expect(html).toContain('Title')
    expect(html).toContain('Paragraph text')
    expect(html).toContain('console.log("hello")')
  })

  it('renders diagram blocks', async () => {
    resolveBlocks(createMixedBlocks(), createHeadings())

    const wrapper = mount(MarkdownViewer, {
      props: { content: '# Intro\n\n```mermaid\ngraph TD; A--&gt;B;\n```' },
    })
    await flushPromises()

    const body = wrapper.find('.markdown-body')
    expect(body.html()).toContain('Intro')
    expect(body.html()).toContain('After diagram')
    expect(wrapper.findComponent(DiagramBlock).exists()).toBe(true)
  })

  it('emits headings event', async () => {
    const headings = createHeadings()
    resolveBlocks(createHtmlBlocks(), headings)

    const wrapper = mount(MarkdownViewer, {
      props: { content: '# Title\n\n## Section' },
    })
    await flushPromises()

    const emitted = wrapper.emitted('headings')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual(headings)
  })

  it('passes github-dark theme name to render when theme is dark', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const { useThemeStore } = await import('@/stores/theme')
    const store = useThemeStore()
    store.theme = 'dark' as const
    vi.clearAllMocks()

    resolveBlocks(createHtmlBlocks(), createHeadings())

    mount(MarkdownViewer, {
      props: { content: '# Test' },
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(mocks.mockRender).toHaveBeenCalledWith('# Test', 'github-dark', null, '')
  })

  it('uses github-light for light theme', async () => {
    resolveBlocks(createHtmlBlocks(), createHeadings())

    mount(MarkdownViewer, {
      props: { content: '# Test' },
    })
    await flushPromises()

    expect(mocks.mockRender).toHaveBeenCalledWith('# Test', 'github-light', null, '')
  })

  it('re-renders when content changes', async () => {
    resolveBlocks(createHtmlBlocks(), createHeadings())

    const wrapper = mount(MarkdownViewer, {
      props: { content: 'first' },
    })
    await flushPromises()
    expect(mocks.mockRender).toHaveBeenCalledTimes(1)
    expect(mocks.mockRender).toHaveBeenLastCalledWith('first', 'github-light', null, '')

    await wrapper.setProps({ content: 'second' })
    await flushPromises()
    expect(mocks.mockRender).toHaveBeenCalledTimes(2)
    expect(mocks.mockRender).toHaveBeenLastCalledWith('second', 'github-light', null, '')
  })

  it('handles empty content', async () => {
    resolveBlocks([], [])

    const wrapper = mount(MarkdownViewer, {
      props: { content: '' },
    })
    await flushPromises()

    expect(wrapper.find('.markdown-body').exists()).toBe(true)
    expect(mocks.mockRender).toHaveBeenCalledWith('', 'github-light', null, '')
  })

  it('passes theme prop to DiagramBlock', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const { useThemeStore } = await import('@/stores/theme')
    const store = useThemeStore()
    store.theme = 'dark' as const
    vi.clearAllMocks()

    const blocks: MarkdownBlock[] = [
      {
        type: 'diagram',
        lang: 'mermaid',
        code: 'graph TD; A-->B;',
        codeViewHtml: '<pre>code</pre>',
        index: 0,
      },
    ]
    resolveBlocks(blocks, createHeadings())

    const wrapper = mount(MarkdownViewer, {
      props: { content: '```mermaid\ngraph TD; A-->B;\n```' },
      global: { plugins: [pinia] },
    })
    await flushPromises()

    const diagramBlock = wrapper.findComponent(DiagramBlock)
    expect(diagramBlock.exists()).toBe(true)
    expect(diagramBlock.props('theme')).toBe('dark')
  })

  it('handles render errors gracefully', async () => {
    mocks.mockRender.mockRejectedValue(new Error('Render failure'))

    const wrapper = mount(MarkdownViewer, {
      props: { content: '# Bad markdown' },
    })
    await flushPromises()

    expect(wrapper.find('.markdown-body').exists()).toBe(true)
  })

  it('ignores stale render results', async () => {
    let resolveFirst!: (v: unknown) => void
    const firstPromise = new Promise((r) => { resolveFirst = r })

    mocks.mockRender
      .mockResolvedValueOnce(
        firstPromise.then(() => ({ blocks: createHtmlBlocks(), headings: createHeadings() })),
      )
      .mockResolvedValueOnce({
        blocks: [{ type: 'html', html: '<p>Updated content</p>' }],
        headings: createHeadings(),
      })

    const wrapper = mount(MarkdownViewer, {
      props: { content: 'first' },
    })

    await wrapper.setProps({ content: 'second' })

    resolveFirst({ blocks: [{ type: 'html', html: '<p>Stale content</p>' }], headings: [] })
    await flushPromises()

    const html = wrapper.find('.markdown-body').html()
    expect(html).toContain('Updated content')
    expect(html).not.toContain('Stale content')
  })
})
