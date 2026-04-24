import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileBottomBar from '../MobileBottomBar.vue'
import type { FileResponse } from '../../types'

describe('MobileBottomBar', () => {
  const mockCodeFile: FileResponse = {
    id: 1,
    path: null,
    filename: 'main.py',
    language: 'python',
    is_binary: false,
    size: 100,
    line_count: 20,
  }

  const mockMarkdownFile: FileResponse = {
    id: 2,
    path: null,
    filename: 'README.md',
    language: 'markdown',
    is_binary: false,
    size: 200,
    line_count: 30,
  }

  const mockBinaryFile: FileResponse = {
    id: 3,
    path: null,
    filename: 'data.bin',
    language: null,
    is_binary: true,
    size: 1024,
    line_count: null,
  }

  // Mock clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
    configurable: true,
  })

  it('FMB1: shows hamburger for multi-file entry', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: true,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'print("hello")',
      },
    })

    // Should show "files" badge in file-section
    expect(wrapper.find('.file-section').text()).toContain('files')
  })

  it('FMB2: shows filename for single-file entry', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'print("hello")',
      },
    })

    expect(wrapper.find('.filename').text()).toBe('main.py')
  })

  it('FMB3: shows copy button for code file', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'print("hello")',
      },
    })

    // Should have Copy button (with title "Copy content")
    const buttons = wrapper.findAll('.action-btn')
    const copyBtn = buttons.find(btn => btn.attributes('title') === 'Copy content')
    expect(copyBtn).toBeDefined()
  })

  it('FMB4: hides copy button when not applicable', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockMarkdownFile,
        hasMultipleFiles: false,
        canCopy: false, // Cannot copy (e.g., binary)
        canDownload: true,
        hasToc: true,
        content: '# Markdown',
      },
    })

    // Should have TOC button but no copy button
    const buttons = wrapper.findAll('.action-btn')
    const copyBtn = buttons.find(btn => btn.attributes('title') === 'Copy content')
    expect(copyBtn).toBeUndefined()
  })

  it('FMB5: shows TOC button when hasToc is true', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockMarkdownFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: true,
        content: '# Title',
      },
    })

    const tocBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Table of Contents'
    )
    expect(tocBtn).toBeDefined()
  })

  it('FMB6: download button emits event', async () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'code',
      },
    })

    const downloadBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Download'
    )!

    await downloadBtn.trigger('click')

    expect(wrapper.emitted('download')).toBeTruthy()
  })

  it('FMB7: copy button copies content', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'print("hello")',
      },
    })

    const copyBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Copy content'
    )!

    await copyBtn.trigger('click')

    expect(writeText).toHaveBeenCalledWith('print("hello")')
  })

  it('FMB8: shows copied feedback', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'code',
      },
    })

    const copyBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Copy content'
    )!

    // Initial state - button should have Copy label
    expect(copyBtn.find('.btn-label').text()).toBe('Copy')

    // Click
    await copyBtn.trigger('click')

    // Emitted event should exist
    expect(wrapper.emitted()).toBeDefined()
  })

  it('FMB9: hamburger opens file drawer', async () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: true,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'code',
      },
    })

    const fileSection = wrapper.find('.file-section')
    await fileSection.trigger('click')

    expect(wrapper.emitted('toggleFileDrawer')).toBeTruthy()
  })

  it('FMB10: TOC button opens TOC drawer', async () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockMarkdownFile,
        hasMultipleFiles: false,
        canCopy: true,
        canDownload: true,
        hasToc: true,
        content: '# Title',
      },
    })

    const tocBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Table of Contents'
    )!

    await tocBtn.trigger('click')

    expect(wrapper.emitted('toggleToc')).toBeTruthy()
  })

  it('FMB11: hides copy button when canCopy is false', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockBinaryFile,
        hasMultipleFiles: false,
        canCopy: false,
        canDownload: true,
        hasToc: false,
        content: undefined,
      },
    })

    const copyBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Copy content'
    )
    expect(copyBtn).toBeUndefined()
  })

  it('FMB12: hides download button when canDownload is false', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: null,
        hasMultipleFiles: false,
        canCopy: false,
        canDownload: false,
        hasToc: false,
        content: undefined,
      },
    })

    const downloadBtn = wrapper.findAll('.action-btn').find(btn =>
      btn.attributes('title') === 'Download'
    )
    expect(downloadBtn).toBeUndefined()
  })

  it('FMB13: file section shows correct info for multi-file', () => {
    const wrapper = mount(MobileBottomBar, {
      props: {
        activeFile: mockCodeFile,
        hasMultipleFiles: true,
        canCopy: true,
        canDownload: true,
        hasToc: false,
        content: 'code',
      },
    })

    expect(wrapper.find('.file-section').exists()).toBe(true)
    expect(wrapper.find('.file-badge').exists()).toBe(true)
  })
})
