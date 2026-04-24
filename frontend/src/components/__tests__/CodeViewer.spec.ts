import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
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

    // Setup clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    })
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
      },
    })

    expect(wrapper.find('.code-loading').exists()).toBe(true)
    expect(wrapper.find('.code-skeleton').exists()).toBe(true)
  })

  it('FC5: toggles wrap mode when wrap button clicked', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
      },
    })

    await flushPromises()

    const wrapBtn = wrapper.find('.wrap-btn')
    expect(wrapBtn.exists()).toBe(true)

    // Initially no wrap class
    expect(wrapper.find('.code-content').classes()).not.toContain('wrap')

    // Click to enable wrap
    await wrapBtn.trigger('click')
    expect(wrapper.find('.code-content').classes()).toContain('wrap')

    // Click again to disable
    await wrapBtn.trigger('click')
    expect(wrapper.find('.code-content').classes()).not.toContain('wrap')
  })

  it('FC6: copies code content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    const wrapper = mount(CodeViewer, {
      props: {
        content: 'console.log("hello")',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
      },
    })

    await flushPromises()

    const copyBtn = wrapper.find('.copy-btn')
    await copyBtn.trigger('click')

    expect(writeText).toHaveBeenCalledWith('console.log("hello")')
  })

  it('FC7: shows copied feedback after copy', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })

    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
      },
    })

    await flushPromises()

    const copyBtn = wrapper.find('.copy-btn')
    expect(copyBtn.text()).toBe('Copy')

    await copyBtn.trigger('click')
    await flushPromises()

    // Should show checkmark after successful copy
    expect(copyBtn.text()).toBe('✓')
  })

  it('FC8: shows empty file message for empty content', () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: '',
        filename: 'empty.txt',
        language: 'text',
        lineCount: 0,
      },
    })

    expect(wrapper.find('.empty-file').exists()).toBe(true)
    expect(wrapper.find('.empty-file').text()).toBe('Empty file')
  })

  it('FC9: falls back to plain text when Shiki fails', async () => {
    mockHighlight.mockRejectedValue(new Error('Language not found'))

    const wrapper = mount(CodeViewer, {
      props: {
        content: 'line1\nline2',
        filename: 'unknown.xyz',
        language: 'xyz',
        lineCount: 2,
      },
    })

    await flushPromises()

    // Should render fallback with line numbers
    expect(wrapper.find('.code-line').exists()).toBe(true)
    expect(wrapper.findAll('.code-line')).toHaveLength(2)
  })

  it('FC10: re-highlights when content changes', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'initial',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
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

  it('FC11: re-highlights when language changes', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
      },
    })

    await flushPromises()

    // Change language
    await wrapper.setProps({ language: 'python' })
    await flushPromises()

    expect(mockHighlight).toHaveBeenLastCalledWith('code', 'python')
  })

  it('FC12: has correct aria-labels', async () => {
    const wrapper = mount(CodeViewer, {
      props: {
        content: 'code',
        filename: 'test.js',
        language: 'javascript',
        lineCount: 1,
      },
    })

    await flushPromises()

    const copyBtn = wrapper.find('.copy-btn')
    const wrapBtn = wrapper.find('.wrap-btn')

    expect(copyBtn.attributes('aria-label')).toBe('Copy code')
    expect(wrapBtn.attributes('aria-label')).toBe('Enable word wrap')
  })
})
