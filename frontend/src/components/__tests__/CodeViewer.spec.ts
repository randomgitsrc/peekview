import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CodeViewer from '../CodeViewer.vue'

// Mock useShiki
const mockHighlight = vi.fn()
vi.mock('../../composables/useShiki', () => ({
  useShiki: () => ({
    highlight: mockHighlight,
  }),
}))

describe('CodeViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHighlight.mockResolvedValue('<pre><code>highlighted</code></pre>')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('FC1: renders code with Shiki highlighting', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'console.log("hello")',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    await flushPromises()

    expect(mockHighlight).toHaveBeenCalledWith('console.log("hello")', 'javascript')
    expect(wrapper.find('.code-content').exists()).toBe(true)
  })

  it('FC2: displays line count in header', () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'line1\nline2',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 2,
        wrap: false,
      },
    })

    expect(wrapper.find('.line-count').text()).toBe('2 lines')
  })

  it('FC3: displays filename in header', () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'main.py',
        language: 'python',
        lineCount: 1,
        wrap: false,
      },
    })

    expect(wrapper.find('.filename').text()).toBe('main.py')
  })

  it('FC4: shows loading skeleton initially', () => {
    mockHighlight.mockImplementation(() => new Promise(() => {})) // Never resolves

    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    expect(wrapper.find('.code-loading').exists()).toBe(true)
    expect(wrapper.find('.code-skeleton').exists()).toBe(true)
  })

  it('FC5: applies wrap class when wrap prop is true', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: true,
      },
    })

    await flushPromises()

    expect(wrapper.find('.code-content').classes()).toContain('wrap')
  })

  it('FC6: does not apply wrap class when wrap prop is false', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    await flushPromises()

    expect(wrapper.find('.code-content').classes()).not.toContain('wrap')
  })

  it('FC7: shows empty file message for empty content', () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: '',
        filename: 'empty.txt',
        language: 'text',
        lineCount: 0,
        wrap: false,
      },
    })

    expect(wrapper.find('.empty-file').exists()).toBe(true)
    expect(wrapper.find('.empty-file').text()).toBe('Empty file')
  })

  it('FC8: falls back to plain text when Shiki fails', async () => {
    mockHighlight.mockRejectedValue(new Error('Language not found'))

    const wrapper = mount(CodeViewer, {
      props: {
        content: 'line1\nline2',
        filename: 'unknown.xyz',
        language: 'xyz',
        lineCount: 2,
        wrap: false,
      },
    })

    await flushPromises()

    // Should render fallback
    expect(wrapper.find('.fallback').exists()).toBe(true)
    expect(wrapper.find('pre code').text()).toContain('line1')
  })

  it('FC9: re-highlights when content changes', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'initial',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    await flushPromises()
    expect(mockHighlight).toHaveBeenCalledTimes(1)

    // Change content
    await wrapper.setProps({ content: 'updated', lineCount: 1 })
    await flushPromises()

    expect(mockHighlight).toHaveBeenCalledTimes(2)
    expect(mockHighlight).toHaveBeenLastCalledWith('updated', 'javascript')
  })

  it('FC10: re-highlights when language changes', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    await flushPromises()

    // Change language
    await wrapper.setProps({ language: 'python' })
    await flushPromises()

    expect(mockHighlight).toHaveBeenLastCalledWith('code', 'python')
  })

  it('FC11: updates wrap styling when wrap prop changes', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
        wrap: false,
      },
    })

    await flushPromises()
    expect(wrapper.find('.code-content').classes()).not.toContain('wrap')

    // Change wrap prop
    await wrapper.setProps({ wrap: true })
    await flushPromises()

    expect(wrapper.find('.code-content').classes()).toContain('wrap')
  })
})
