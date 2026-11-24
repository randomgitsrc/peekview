/**
 * TPV0104 — 真实字节数判断（BDD-42 / BDD-43 回归 / BDD-44）
 *
 * ⚠️ 反假 PASS（dispatch 约束 4）：既有 `HtmlViewer.spec.ts:338-365` **全部**用
 * `HTML_VIEWER_TEST_SIZE_KEY` 注入假值，绕开了「从 `file.size` 取值」这个被测行为本身。
 * 本文件的 BDD-42/44 用例**不注入**该 key，改为显式传真实 `size`/`file` prop。
 *
 * 左闭右开语义（BDD-43 回归）：`>=` 触发。512KB 恰好 → 警告但仍渲染；2MB 恰好 → 不自动渲染。
 */

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HtmlViewer from '@/components/HtmlViewer.vue'
import { HTML_VIEWER_TEST_SIZE_KEY } from '@/components/HtmlViewerTestKeys'
import TreeView from '@/components/TreeView.vue'

const MB = 1024 * 1024

const HTML_PROPS = {
  slug: 'tpv0104-bytes',
  fileId: 7,
  content: '<html><body><h1>hi</h1></body></html>',
  siblingFileIds: [] as number[],
}

function mountHtml(props: Record<string, unknown> = {}) {
  return mount(HtmlViewer, { props: { ...HTML_PROPS, ...props } })
}

function mountTree(props: Record<string, unknown> = {}) {
  return mount(TreeView, {
    props: {
      content: JSON.stringify({ a: 1 }),
      format: 'json',
      filename: 'data.json',
      downloadFn: vi.fn(),
      ...props,
    },
  })
}

describe('TPV0104 HtmlViewer 按真实字节判定（BDD-42）', () => {
  it('test_bdd_42_bytes_over_2mb_but_chars_under_blocks_auto_render', async () => {
    // 中文素材实测形态：chars 700084 / bytes 2100088（UTF-8 下字节 ≈ 3×字符）
    // 若仍按 content.length 判断（< 2MB）则会自动渲染 iframe → FAIL
    const chars = 700_000
    const content = '<p>' + '中'.repeat(chars - 8) + '</p>'
    expect(content.length).toBeLessThan(2 * MB)
    const wrapper = mountHtml({ content, file: { size: 2_100_088 } })
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('test_bdd_42_bytes_under_2mb_auto_renders', async () => {
    // 反向对照：真实字节 < 2MB 时仍自动渲染（排除「恒不渲染」也通过）
    const wrapper = mountHtml({ content: '<p>中文</p>', file: { size: 1024 } })
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })
})

describe('TPV0104 HtmlViewer 左闭右开边界（BDD-43 回归兼容）', () => {
  // 既有契约（HtmlViewer.spec.ts:338-350 / :354-365）走注入通道；本条守护的是
  // 「阈值数值与 `>=` 语义不被改动」，故沿用既有取证通道而非新增的 file prop。
  it('test_bdd_43_exactly_512kb_warns_but_still_renders', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...HTML_PROPS },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 512 * 1024 } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="size-warning"]').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(true)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })

  it('test_bdd_43_exactly_2mb_blocks_auto_render', async () => {
    const wrapper = mount(HtmlViewer, {
      props: { ...HTML_PROPS },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 2 * MB } },
    })
    await flushPromises()
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(true)
  })

  it('test_bdd_43_just_under_2mb_does_not_block', async () => {
    // 左闭：2MB - 1 字节不得触发阻断
    const wrapper = mount(HtmlViewer, {
      props: { ...HTML_PROPS },
      global: { provide: { [HTML_VIEWER_TEST_SIZE_KEY]: 2 * MB - 1 } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="manual-render-btn"]').exists()).toBe(false)
  })
})

describe('TPV0104 TreeView 按真实字节判定（BDD-44 正反两向）', () => {
  it('test_bdd_44_bytes_over_2mb_truncates_even_when_chars_under', async () => {
    const chars = 700_000
    const content = JSON.stringify({ note: '中'.repeat(Math.max(1, chars - 16)) })
    expect(content.length).toBeLessThan(2 * MB)
    const wrapper = mountTree({ content, size: 2_100_088 })
    await flushPromises()
    expect(wrapper.find('.truncation-banner').exists()).toBe(true)
  })

  it('test_bdd_44_bytes_under_2mb_does_not_truncate', async () => {
    const wrapper = mountTree({ content: JSON.stringify({ a: 1 }), size: 1024 })
    await flushPromises()
    expect(wrapper.find('.truncation-banner').exists()).toBe(false)
  })
})
