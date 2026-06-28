import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import TreeNodeItem from '@/components/TreeNodeItem.vue'
import { EXPAND_KEY } from '@/components/FileTree.vue'
import type { File, TreeNode } from '@/types'

function makeFile(overrides: Partial<File> = {}): File {
  return {
    id: 1,
    path: null,
    filename: 'test.txt',
    language: null,
    isBinary: false,
    size: 100,
    lineCount: 10,
    ...overrides,
  }
}

function makeDirNode(overrides: Partial<TreeNode> = {}): TreeNode {
  const { isDir: _, ...rest } = overrides
  return {
    name: 'src',
    fullPath: 'src',
    isDir: true,
    children: [],
    ...rest,
  }
}

function makeFileNode(overrides: Partial<TreeNode> = {}): TreeNode {
  const { isDir: _, file: fileOverrides, ...rest } = overrides
  return {
    name: 'app.ts',
    fullPath: 'app.ts',
    isDir: false,
    children: [],
    file: makeFile({ filename: 'app.ts', language: 'typescript', ...(fileOverrides || {}) }),
    ...rest,
  }
}

function createExpandContext(initialPaths: string[] = []) {
  const expandedPaths = ref(new Set(initialPaths))
  const toggleDir = vi.fn((path: string) => {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
    } else {
      expandedPaths.value.add(path)
    }
  })
  return { expandedPaths, toggleDir }
}

function mountWithExpand(node: TreeNode, depth = 0, activeFileId: number | null = null, initialPaths: string[] = []) {
  const { expandedPaths, toggleDir } = createExpandContext(initialPaths)
  const wrapper = mount(TreeNodeItem, {
    props: { node, depth, activeFileId },
    global: {
      provide: {
        [EXPAND_KEY as symbol]: { expandedPaths, toggleDir },
      },
    },
  })
  return { wrapper, expandedPaths, toggleDir }
}

describe('TreeNodeItem', () => {
  describe('dir nodes', () => {
    it('renders dir item with toggle, icon, and name', () => {
      const { wrapper } = mountWithExpand(makeDirNode({ name: 'src', fullPath: 'src' }))
      expect(wrapper.find('.dir-item').exists()).toBe(true)
      expect(wrapper.find('.dir-toggle').text()).toBe('▸')
      expect(wrapper.find('.dir-icon').text()).toBe('📁')
      expect(wrapper.find('.dir-name').text()).toBe('src')
    })

    it('shows expanded toggle icon when path is in expanded set', () => {
      const { wrapper } = mountWithExpand(
        makeDirNode({ fullPath: 'src' }),
        0,
        null,
        ['src'],
      )
      expect(wrapper.find('.dir-toggle').text()).toBe('▾')
    })

    it('applies depth-based padding to dir item', () => {
      const { wrapper } = mountWithExpand(makeDirNode(), 3)
      const dirItem = wrapper.find('.dir-item')
      expect(dirItem.attributes('style')).toContain('padding-left')
      expect(dirItem.attributes('style')).toContain('calc(3')
    })

    it('calls toggleDir on click', async () => {
      const { wrapper, toggleDir } = mountWithExpand(
        makeDirNode({ fullPath: 'src' }),
        0,
        null,
        ['src'],
      )
      await wrapper.find('.dir-item').trigger('click')
      expect(toggleDir).toHaveBeenCalledWith('src')
    })

    it('does not render file item for dir node', () => {
      const { wrapper } = mountWithExpand(makeDirNode())
      expect(wrapper.find('.file-item').exists()).toBe(false)
    })
  })

  describe('file nodes', () => {
    it('renders file item with icon and name', () => {
      const { wrapper } = mountWithExpand(makeFileNode({ name: 'app.ts' }))
      expect(wrapper.find('.file-item').exists()).toBe(true)
      expect(wrapper.find('.file-name').text()).toBe('app.ts')
      expect(wrapper.find('.file-icon').exists()).toBe(true)
    })

    it('does not render dir item for file node', () => {
      const { wrapper } = mountWithExpand(makeFileNode())
      expect(wrapper.find('.dir-item').exists()).toBe(false)
    })

    it('applies depth-based padding to file item', () => {
      const { wrapper } = mountWithExpand(makeFileNode(), 2)
      const fileItem = wrapper.find('.file-item')
      expect(fileItem.attributes('style')).toContain('padding-left')
      expect(fileItem.attributes('style')).toContain('calc(2')
    })

    it('emits select event when clicked', async () => {
      const file = makeFile({ id: 42, filename: 'main.py' })
      const { wrapper } = mountWithExpand(makeFileNode({ file }))
      await wrapper.find('.file-item').trigger('click')
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([file])
    })

    it('adds active class when file id matches activeFileId', () => {
      const file = makeFile({ id: 99, filename: 'active.ts' })
      const { wrapper } = mountWithExpand(makeFileNode({ file }), 0, 99)
      expect(wrapper.find('.file-item').classes()).toContain('active')
    })

    it('does not add active class when file id differs from activeFileId', () => {
      const file = makeFile({ id: 1 })
      const { wrapper } = mountWithExpand(makeFileNode({ file }), 0, 999)
      expect(wrapper.find('.file-item').classes()).not.toContain('active')
    })

    it('does not add active class when activeFileId is null', () => {
      const file = makeFile({ id: 1 })
      const { wrapper } = mountWithExpand(makeFileNode({ file }), 0, null)
      expect(wrapper.find('.file-item').classes()).not.toContain('active')
    })
  })

  describe('file icons', () => {
    it.each([
      ['📦', true, null],
      ['📝', false, 'markdown'],
      ['🐍', false, 'python'],
      ['📜', false, 'javascript'],
      ['📜', false, 'typescript'],
      ['🌐', false, 'html'],
      ['🎨', false, 'css'],
      ['📄', false, 'rust'],
      ['📄', false, null],
      ['📄', false, undefined],
    ])('shows %s for isBinary=%s language=%s', (expectedIcon, isBinary, language) => {
      const file = makeFile({ isBinary, language })
      const { wrapper } = mountWithExpand(makeFileNode({ file }))
      expect(wrapper.find('.file-icon').text()).toBe(expectedIcon)
    })
  })

  describe('children rendering', () => {
    const childFile = makeFile({ id: 2, filename: 'child.ts', language: 'typescript' })
    const childNode: TreeNode = {
      name: 'child.ts',
      fullPath: 'src/child.ts',
      isDir: false,
      children: [],
      file: childFile,
    }
    const parentDir: TreeNode = {
      name: 'src',
      fullPath: 'src',
      isDir: true,
      children: [childNode],
    }

    it('renders children when expanded', () => {
      const { wrapper } = mountWithExpand(parentDir, 0, null, ['src'])
      expect(wrapper.find('.dir-children').exists()).toBe(true)
      // The child should be rendered as another TreeNodeItem
      const childItems = wrapper.findAllComponents(TreeNodeItem)
      expect(childItems).toHaveLength(1)
      expect(childItems[0].props('node')).toEqual(childNode)
      expect(childItems[0].props('depth')).toBe(1)
    })

    it('does not render children when collapsed', () => {
      const { wrapper } = mountWithExpand(parentDir, 0, null, [])
      expect(wrapper.find('.dir-children').exists()).toBe(false)
    })

    it('relays select event from child', async () => {
      const { wrapper } = mountWithExpand(parentDir, 0, null, ['src'])
      const childWrapper = wrapper.findComponent(TreeNodeItem)
      await childWrapper.vm.$emit('select', childFile)
      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([childFile])
    })
  })
})
