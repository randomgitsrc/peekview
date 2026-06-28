import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CodeViewer from '@/components/CodeViewer.vue'

const mocks = vi.hoisted(() => ({
  mockHighlight: vi.fn(),
}))

vi.mock('@/composables/useShiki', () => ({
  useShiki: () => ({
    highlight: mocks.mockHighlight,
  }),
}))

const HIGHLIGHTED_HTML = `<div class="code-container"><div class="line-numbers" aria-hidden="true"><span class="line-number">1</span></div><pre><code><span class="line">console.log("hello")</span></code></pre></div>`

function mountCodeViewer(props: Partial<{
  content: string
  filename: string
  language: string | null
  wrap: boolean
  canWrap: boolean
  loading: boolean
}> = {}) {
  return mount(CodeViewer, {
    props: {
      content: 'console.log("hello")',
      filename: 'test.ts',
      language: 'typescript',
      wrap: false,
      canWrap: true,
      loading: false,
      ...props,
    },
    global: {
      plugins: [createPinia()],
    },
  })
}

describe('CodeViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.mockHighlight.mockReset()
    mocks.mockHighlight.mockResolvedValue(HIGHLIGHTED_HTML)
  })

  it('shows skeleton when loading is true', () => {
    const wrapper = mountCodeViewer({ loading: true })
    expect(wrapper.find('.code-loading').exists()).toBe(true)
    expect(wrapper.find('.code-body').exists()).toBe(false)
    const skeletons = wrapper.findAll('.code-skeleton')
    expect(skeletons.length).toBe(8)
  })

  it('shows code body when loading is false', async () => {
    const wrapper = mountCodeViewer({ loading: false })
    await flushPromises()
    expect(wrapper.find('.code-loading').exists()).toBe(false)
    expect(wrapper.find('.code-body').exists()).toBe(true)
  })

  it('renders highlighted code after async highlight completes', async () => {
    const wrapper = mountCodeViewer({ loading: false })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalled()
    expect(wrapper.find('.code-body').html()).toContain('console.log')
  })

  it('uses github-dark theme when theme store is dark', async () => {
    const wrapper = mountCodeViewer({ loading: false })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalledWith(
      'console.log("hello")',
      'typescript',
      'github-light'
    )
  })

  it('passes correct language to highlight', async () => {
    const wrapper = mountCodeViewer({
      loading: false,
      content: 'print(1)',
      language: 'python',
    })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalledWith(
      'print(1)',
      'python',
      'github-light'
    )
  })

  it('falls back to text language when language is null', async () => {
    const wrapper = mountCodeViewer({
      loading: false,
      content: 'plain text',
      language: null,
    })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalledWith(
      'plain text',
      'text',
      'github-light'
    )
  })

  it('shows empty code body when content is empty', async () => {
    mocks.mockHighlight.mockResolvedValue('')
    const wrapper = mountCodeViewer({ loading: false, content: '' })

    // doHighlight returns early for empty content, no highlight call
    await flushPromises()
    expect(mocks.mockHighlight).not.toHaveBeenCalled()
    expect(wrapper.find('.code-body').html()).not.toContain('code-container')
  })

  it('shows escaped raw content when highlight throws', async () => {
    mocks.mockHighlight.mockRejectedValue(new Error('Shiki error'))
    const wrapper = mountCodeViewer({
      loading: false,
      content: '<script>alert("xss")</script>',
    })
    await flushPromises()

    const html = wrapper.find('.code-body').html()
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })

  it('adds wrap-enabled class when wrap is true', async () => {
    const wrapper = mountCodeViewer({ loading: false, wrap: true })
    await flushPromises()
    expect(wrapper.find('.code-body').classes('wrap-enabled')).toBe(true)
  })

  it('does not have wrap-enabled class when wrap is false', async () => {
    const wrapper = mountCodeViewer({ loading: false, wrap: false })
    await flushPromises()
    expect(wrapper.find('.code-body').classes('wrap-enabled')).toBe(false)
  })

  it('toggles wrap-enabled class when wrap prop changes', async () => {
    const wrapper = mountCodeViewer({ loading: false, wrap: false })
    await flushPromises()

    expect(wrapper.find('.code-body').classes('wrap-enabled')).toBe(false)

    await wrapper.setProps({ wrap: true })

    expect(wrapper.find('.code-body').classes('wrap-enabled')).toBe(true)
  })

  it('re-highlights when content changes', async () => {
    const wrapper = mountCodeViewer({ loading: false, content: 'first' })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalledTimes(1)
    expect(mocks.mockHighlight).toHaveBeenCalledWith('first', 'typescript', 'github-light')

    await wrapper.setProps({ content: 'second' })
    await flushPromises()

    expect(mocks.mockHighlight).toHaveBeenCalledTimes(2)
    expect(mocks.mockHighlight).toHaveBeenCalledWith('second', 'typescript', 'github-light')
  })
})
