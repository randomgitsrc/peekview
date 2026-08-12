// 部署位置: frontend-v3/src/composables/__tests__/useEntryDetailComputed.svg.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

// T085 BDD-1/2/3: SVG 调度修复
// isSvg computed 未实现 → isSvg 为 undefined → 断言失败（B 类红灯）
// 动态 mock 模式：vi.doMock 在 beforeEach + vi.resetModules + await import()

const slug = ref('t085-svg-test')
const currentEntry = ref(null)
const activeFile = ref<{ language: string | null; filename: string; isBinary: boolean } | null>(null)
const fileContent = ref('')

async function loadComputed() {
  const { useEntryDetailComputed } = await import('../useEntryDetailComputed')
  return useEntryDetailComputed(
    slug as Ref<string>,
    currentEntry as Ref<never>,
    activeFile as Ref<never>,
  )
}

function setFile(filename: string, language: string | null, isBinary = false) {
  activeFile.value = { filename, language, isBinary }
}

describe('T085 BDD-1/2/3: SVG 调度修复', () => {
  beforeEach(async () => {
    vi.resetModules()
    activeFile.value = null
    fileContent.value = ''
    vi.doMock('@/stores/entryDetail', () => ({
      useEntryDetailStore: () => ({
        activeFile,
        fileContent,
      }),
    }))
    vi.doMock('@/composables/useToast', () => ({
      useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
    }))
  })

  describe('BDD-1: SVG 文件默认渲染为图片预览', () => {
    it('test_bdd_1_svg_file_is_svg_true_and_is_image_true', async () => {
      setFile('icon.svg', 'xml')
      const computed = await loadComputed()
      expect(computed.isSvg?.value).toBe(true)
      expect(computed.isImage?.value).toBe(true)
    })

    it('test_bdd_1_svg_not_in_rich_render_branch', async () => {
      setFile('icon.svg', 'xml')
      const computed = await loadComputed()
      expect(computed.isSvg?.value).toBe(true)
      expect(computed.isImage?.value).toBe(true)
      expect(computed.isXml?.value).toBe(true)
      expect(computed.isRichRenderable?.value).toBe(false)
    })
  })

  describe('BDD-2: 普通 XML 文件仍渲染为树视图（防回归）', () => {
    it('test_bdd_2_xml_file_is_svg_false_and_is_xml_true', async () => {
      setFile('data.xml', 'xml')
      const computed = await loadComputed()
      expect(computed.isSvg?.value).toBe(false)
      expect(computed.isXml?.value).toBe(true)
      expect(computed.isRichRenderable?.value).toBe(true)
      expect(computed.isImage?.value).toBe(false)
    })

    it('test_bdd_2_xml_still_has_toggle_button', async () => {
      setFile('config.xml', 'xml')
      const computed = await loadComputed()
      expect(computed.isRichRenderable?.value).toBe(true)
    })
  })

  describe('BDD-3: SVG 文件不显示源码/渲染切换按钮', () => {
    it('test_bdd_3_svg_is_rich_renderable_false', async () => {
      setFile('icon.svg', 'xml')
      const computed = await loadComputed()
      expect(computed.isRichRenderable?.value).toBe(false)
    })

    it('test_bdd_3_svg_is_svg_excluded_from_rich_renderable', async () => {
      setFile('diagram.svg', 'xml')
      const computed = await loadComputed()
      expect(computed.isSvg?.value).toBe(true)
      expect(computed.isXml?.value).toBe(true)
      expect(computed.isRichRenderable?.value).toBe(false)
    })
  })
})
