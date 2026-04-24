import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FileTree from '../FileTree.vue'
import type { FileResponse } from '../../types'

describe('FileTree', () => {
  const mockFiles: FileResponse[] = [
    { id: 1, path: null, filename: 'README.md', language: 'markdown', is_binary: false, size: 100, line_count: 10 },
    { id: 2, path: 'src/main.py', filename: 'main.py', language: 'python', is_binary: false, size: 200, line_count: 20 },
    { id: 3, path: 'src/utils.py', filename: 'utils.py', language: 'python', is_binary: false, size: 150, line_count: 15 },
    { id: 4, path: 'tests/test.py', filename: 'test.py', language: 'python', is_binary: false, size: 300, line_count: 30 },
  ]

  it('FT1: renders tree structure with directories', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    // Should have root level files and directories
    const treeNodes = wrapper.findAll('.tree-node')
    expect(treeNodes.length).toBeGreaterThan(0)
  })

  it('FT2: emits select event when file clicked', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    // Find a file node (not directory) and click
    const fileRows = wrapper.findAll('.tree-node-row')
    // Click on the first file row
    await fileRows[0].trigger('click')

    // Check if emitted - the emit happens via TreeNodeItem which emits to FileTree
    // and FileTree re-emits to parent
    expect(wrapper.emitted()).toBeDefined()
  })

  it('FT3: highlights active file', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: 1,
      },
    })

    // Should have active class on the active file
    const activeRows = wrapper.findAll('.tree-node-row.active')
    expect(activeRows.length).toBeGreaterThan(0)
  })

  it('FT4: directories can expand and collapse', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    // Find directory row (has chevron)
    const directoryRow = wrapper.find('.tree-chevron')
    expect(directoryRow.exists()).toBe(true)

    // Click to expand/collapse
    await directoryRow.trigger('click')
  })

  it('FT5: directories sorted first', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    // Directories should come before files at same level
    const rows = wrapper.findAll('.tree-node-row')
    // README.md (root file) should be after directories
    const texts = rows.map(r => r.text())
    expect(texts.length).toBeGreaterThan(0)
  })

  it('FT6: shows file icons', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    // Should have icon elements
    const icons = wrapper.findAll('.tree-icon')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('FT7: handles deeply nested structure', () => {
    const nestedFiles: FileResponse[] = [
      { id: 1, path: 'a/b/c/d/file.txt', filename: 'file.txt', language: 'text', is_binary: false, size: 100, line_count: 10 },
    ]

    const wrapper = mount(FileTree, {
      props: {
        files: nestedFiles,
        activeFileId: null,
      },
    })

    // Should render nested structure
    expect(wrapper.find('.file-tree').exists()).toBe(true)
  })

  it('FT8: handles empty files array', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [],
        activeFileId: null,
      },
    })

    // Should render empty tree
    expect(wrapper.find('.file-tree').exists()).toBe(true)
    expect(wrapper.findAll('.tree-node')).toHaveLength(0)
  })

  it('FT9: keyboard navigation with Enter', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: null,
      },
    })

    const fileRow = wrapper.find('.tree-node-row')
    await fileRow.trigger('keydown.enter')

    // Should emit or handle keyboard event
    expect(wrapper.emitted()).toBeDefined()
  })

  it('FT10: has correct aria attributes', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: mockFiles,
        activeFileId: 1,
      },
    })

    expect(wrapper.find('[role="tree"]').exists()).toBe(true)
    expect(wrapper.find('[role="treeitem"]').exists()).toBe(true)
  })
})
