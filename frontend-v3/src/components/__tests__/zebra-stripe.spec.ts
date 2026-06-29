import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const MULTI_LINE_HTML = `<div class="code-container"><div class="line-numbers" aria-hidden="true"><span class="line-number">1</span><span class="line-number">2</span><span class="line-number">3</span><span class="line-number">4</span><span class="line-number">5</span></div><pre><code><span class="line">line 1</span><span class="line">line 2</span><span class="line">line 3</span><span class="line">line 4</span><span class="line">line 5</span></code></pre></div>`

function mountCodeViewer(props: Record<string, unknown> = {}) {
  return mount(CodeViewer, {
    props: {
      content: 'line 1\nline 2\nline 3\nline 4\nline 5',
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

describe('CodeViewer — Zebra Stripe Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.mockHighlight.mockReset()
    mocks.mockHighlight.mockResolvedValue(MULTI_LINE_HTML)
  })

  it('renders .line elements from Shiki output', async () => {
    const wrapper = mountCodeViewer()
    await flushPromises()
    const codeBodyHtml = wrapper.find('.code-body').html()
    const lineCount = (codeBodyHtml.match(/class="line"/g) || []).length
    expect(lineCount).toBeGreaterThanOrEqual(5)
  })

  it('.line elements are direct children of <code>', async () => {
    const wrapper = mountCodeViewer()
    await flushPromises()
    const codeEl = wrapper.find('.code-body code')
    expect(codeEl.exists()).toBe(true)
    const codeHtml = codeEl.html()
    expect(codeHtml).toContain('<span class="line">')
  })

  it('.line-numbers column exists as sibling of <pre> (not ancestor of .line)', async () => {
    const wrapper = mountCodeViewer()
    await flushPromises()
    const container = wrapper.find('.code-container')
    expect(container.exists()).toBe(true)
    const lineNumbers = container.find('.line-numbers')
    expect(lineNumbers.exists()).toBe(true)
    expect(lineNumbers.find('.line').exists()).toBe(false)
  })

  it('code.css has wrap-enabled rule for .line height:auto', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const codeCss = fs.default.readFileSync(
      path.resolve(__dirname, '../../styles/code.css'),
      'utf-8'
    )
    expect(codeCss).toContain('wrap-enabled')
    expect(codeCss).toMatch(/\.line\)\s*\{[^}]*height:\s*auto/)
  })
})
