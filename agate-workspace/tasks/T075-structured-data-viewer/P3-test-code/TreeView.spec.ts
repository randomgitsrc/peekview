import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TreeView from '@/components/TreeView.vue'

// T075 TreeView — JSON/YAML/XML 树渲染器（P2 §3.9）
// 当前红灯：@/components/TreeView.vue 不存在 → import 失败（B 类红灯）
//
// 选择器契约（P4 implementer 须满足）：
//   - 根容器 class="tree-view"
//   - 搜索框 input[aria-label="Search tree nodes"]，匹配数量 aria-live="polite"
//   - 递归节点 class="tree-node"，展开按钮 class="expand-toggle"（aria-expanded）
//   - 节点标签 class="tree-node-label"，类型标签 class="type-tag"
//   - 搜索命中的节点 class="search-highlight"
//   - 截断提示条 class="truncation-banner" + 下载按钮

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
}

const JSON_CONTENT = JSON.stringify({
  name: 'alice',
  age: 30,
  admin: true,
  notes: null,
  tags: ['a', 'b'],
  meta: { level: 3 },
})

function mountTree(props: Partial<{
  content: string
  format: 'json' | 'yaml' | 'xml'
  filename: string
  downloadFn: () => void
}> = {}) {
  return mount(TreeView, {
    props: {
      content: JSON_CONTENT,
      format: 'json',
      filename: 'data.json',
      downloadFn: vi.fn(),
      ...props,
    },
  })
}

describe('T075 TreeView 渲染（BDD-24/25/26）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_24_json_renders_tree', async () => {
    const wrapper = mountTree()
    await flushPromises()
    expect(wrapper.find('.tree-view').exists()).toBe(true)
    expect(wrapper.findAll('.tree-node').length).toBeGreaterThan(0)
    expect(wrapper.find('.expand-toggle').exists()).toBe(true)
  })

  it('test_bdd_25_yaml_renders_tree', async () => {
    const wrapper = mountTree({ format: 'yaml', content: 'name: alice\nage: 30' })
    await flushPromises()
    expect(wrapper.find('.tree-view').exists()).toBe(true)
    const labels = wrapper.findAll('.tree-node-label').map(n => n.text())
    expect(labels.join(' ')).toContain('name')
    expect(labels.join(' ')).toContain('age')
  })

  it('test_bdd_26_xml_renders_tree', async () => {
    const wrapper = mountTree({ format: 'xml', content: '<root><item id="1">text</item></root>' })
    await flushPromises()
    expect(wrapper.find('.tree-view').exists()).toBe(true)
    const labels = wrapper.findAll('.tree-node-label').map(n => n.text())
    expect(labels.join(' ')).toContain('item')
  })
})

describe('T075 TreeView 展开/折叠（BDD-27/28）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_27_expand_shows_children', async () => {
    const wrapper = mountTree()
    await flushPromises()
    const metaNode = wrapper.findAll('.tree-node').find(n => n.text().includes('meta'))!
    const toggle = metaNode.find('.expand-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    await flushPromises()
    expect(metaNode.find('.expand-toggle').attributes('aria-expanded')).toBe('true')
    expect(metaNode.text()).toContain('level')
  })

  it('test_bdd_28_collapse_hides_children', async () => {
    const wrapper = mountTree()
    await flushPromises()
    const metaNode = wrapper.findAll('.tree-node').find(n => n.text().includes('meta'))!
    const toggle = metaNode.find('.expand-toggle')

    await toggle.trigger('click')
    await flushPromises()
    expect(metaNode.text()).toContain('level')

    await metaNode.find('.expand-toggle').trigger('click')
    await flushPromises()
    expect(metaNode.find('.expand-toggle').attributes('aria-expanded')).toBe('false')
    expect(metaNode.text()).not.toContain('level')
  })
})

describe('T075 TreeView 类型标签（BDD-29）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_29_type_labels_all_six', async () => {
    const wrapper = mountTree()
    await flushPromises()
    const tags = wrapper.findAll('.type-tag').map(t => t.text())
    for (const type of ['string', 'number', 'boolean', 'null', 'array', 'object']) {
      expect(tags).toContain(type)
    }
  })
})

describe('T075 TreeView 搜索高亮（BDD-30）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_30_search_highlights_matches', async () => {
    const wrapper = mountTree()
    await flushPromises()
    const search = wrapper.find('input[aria-label="Search tree nodes"]')
    expect(search.exists()).toBe(true)

    await search.setValue('alice')
    await flushPromises()
    expect(wrapper.findAll('.search-highlight').length).toBeGreaterThan(0)

    const live = wrapper.find('[aria-live="polite"]')
    expect(live.exists()).toBe(true)
    expect(live.text()).toMatch(/\d+/)
  })
})

describe('T075 TreeView 点击复制（BDD-31）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_31_click_leaf_copies_value', async () => {
    const wrapper = mountTree()
    await flushPromises()
    const ageNode = wrapper.findAll('.tree-node').find(n => n.text().includes('age'))!
    await ageNode.find('.tree-node-label').trigger('click')
    await flushPromises()
    expect(mockClipboard.writeText).toHaveBeenCalled()
    expect(mockClipboard.writeText.mock.calls[0][0]).toContain('30')
  })
})

describe('T075 TreeView YAML 安全（BDD-32）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_32_yaml_unsafe_tag_rejected', async () => {
    const wrapper = mountTree({
      format: 'yaml',
      content: 'a: !!python/object:os.system ["ls"]',
    })
    await flushPromises()
    const emitted = wrapper.emitted('parse-error')
    expect(emitted).toBeDefined()
  })
})

describe('T075 TreeView 超 2MB 截断（BDD-33/34/35）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  const BIG = 'x'.repeat(2 * 1024 * 1024 + 100)

  it('test_bdd_33_json_2mb_truncation', async () => {
    const downloadFn = vi.fn()
    const wrapper = mountTree({ format: 'json', content: BIG, downloadFn })
    await flushPromises()
    const banner = wrapper.find('.truncation-banner')
    expect(banner.exists()).toBe(true)
    await banner.find('button').trigger('click')
    expect(downloadFn).toHaveBeenCalled()
  })

  it('test_bdd_34_yaml_2mb_truncation', async () => {
    const downloadFn = vi.fn()
    const wrapper = mountTree({ format: 'yaml', content: BIG, downloadFn })
    await flushPromises()
    const banner = wrapper.find('.truncation-banner')
    expect(banner.exists()).toBe(true)
    await banner.find('button').trigger('click')
    expect(downloadFn).toHaveBeenCalled()
  })

  it('test_bdd_35_xml_2mb_truncation', async () => {
    const downloadFn = vi.fn()
    const wrapper = mountTree({ format: 'xml', content: BIG, downloadFn })
    await flushPromises()
    const banner = wrapper.find('.truncation-banner')
    expect(banner.exists()).toBe(true)
    await banner.find('button').trigger('click')
    expect(downloadFn).toHaveBeenCalled()
  })
})

describe('T075 TreeView 空输入（BDD-36）', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('test_bdd_36_empty_json_no_crash', async () => {
    for (const content of ['{}', '[]', 'null']) {
      const wrapper = mountTree({ content })
      await flushPromises()
      expect(wrapper.find('.tree-view').exists()).toBe(true)
      const noData = wrapper.find('.no-data')
      const nodes = wrapper.findAll('.tree-node')
      expect(noData.exists() || nodes.length === 0).toBe(true)
    }
  })
})
