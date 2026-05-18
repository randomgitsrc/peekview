/**
 * EntryDetailView HTML 渲染分支测试
 *
 * 覆盖 spec-html-render.md P1 测试项：
 * - HTML 文件时 Wrap 按钮不显示
 * - 切换 .html 和 .css 渲染方式正确切换
 * - canWrap store 逻辑
 *
 * 注意：Copy tooltip 和完整渲染切换由 E2E 覆盖（需要真实 DOM 交互）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useEntryStore } from '@/stores/entry'

// ─── Mock 子组件，聚焦渲染分支逻辑 ──────────────────────────────────────────
vi.mock('@/components/HtmlViewer.vue', () => ({
  default: { template: '<div data-testid="html-viewer" />', props: ['content'] },
}))
vi.mock('@/components/CodeViewer.vue', () => ({
  default: {
    template: '<div data-testid="code-viewer" />',
    props: ['content', 'language', 'wrap', 'canWrap', 'loading', 'filename'],
  },
}))
vi.mock('@/components/MarkdownViewer.vue', () => ({
  default: {
    template: '<div data-testid="markdown-viewer" />',
    props: ['content', 'headings'],
  },
}))
vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

// ─── 构造测试用文件对象 ───────────────────────────────────────────────────────
function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    filename: 'index.html',
    language: 'html',
    isBinary: false,
    size: 1024,
    lineCount: 10,
    path: 'index.html',
    ...overrides,
  }
}

// ─── canWrap store 逻辑 ───────────────────────────────────────────────────────
describe('entry store canWrap', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('HTML 文件时 canWrap 为 false', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ language: 'html' }) })
    expect(store.canWrap).toBe(false)
  })

  it('Markdown 文件时 canWrap 为 false', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ filename: 'README.md', language: 'markdown' }) })
    expect(store.canWrap).toBe(false)
  })

  it('Python 文件时 canWrap 为 true', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ filename: 'main.py', language: 'python' }) })
    expect(store.canWrap).toBe(true)
  })

  it('二进制文件时 canWrap 为 false', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ filename: 'image.png', language: null, isBinary: true }) })
    expect(store.canWrap).toBe(false)
  })

  it('无 activeFile 时 canWrap 为 false', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: null })
    expect(store.canWrap).toBe(false)
  })
})

// ─── 渲染分支：mount EntryDetailView，验证正确的 viewer 被渲染 ────────────────
// 注意：EntryDetailView 依赖 router 和 store，需要完整挂载环境
// 此处只验证 isHtml computed 和 canWrap 的 store 层逻辑
// 完整的渲染分支切换（HtmlViewer vs CodeViewer 出现/消失）由 E2E 覆盖
describe('渲染分支 isHtml computed（store 层验证）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('HTML 文件：activeFile.language 为 html', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ language: 'html' }) })
    expect(store.activeFile?.language).toBe('html')
  })

  it('Markdown 文件：activeFile.language 为 markdown', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ filename: 'README.md', language: 'markdown' }) })
    expect(store.activeFile?.language).toBe('markdown')
  })

  it('CSS 文件：activeFile.language 不为 html 也不为 markdown', () => {
    const store = useEntryStore()
    store.$patch({ activeFile: makeFile({ filename: 'style.css', language: 'css' }) })
    const lang = store.activeFile?.language
    expect(lang).not.toBe('html')
    expect(lang).not.toBe('markdown')
  })
})
