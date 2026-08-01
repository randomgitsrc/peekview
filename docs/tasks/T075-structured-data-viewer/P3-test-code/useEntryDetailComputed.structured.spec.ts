import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

// T075 useEntryDetailComputed 结构化格式检测属性（BDD-07~11）
// 动态 mock 模式（dispatch 约定）：vi.doMock 在 beforeEach 设置 + vi.resetModules + await import()
// 当前红灯：composable 未返回 isCsv/isTsv/isJson/isYaml/isXml/isRichRenderable → 断言失败

const slug = ref('t075-structured')
const currentEntry = ref(null)
const activeFile = ref<{ language: string | null } | null>(null)
const fileContent = ref('')

async function loadComputed() {
  const { useEntryDetailComputed } = await import('../useEntryDetailComputed')
  return useEntryDetailComputed(
    slug as Ref<string>,
    currentEntry as Ref<never>,
    activeFile as Ref<never>,
  )
}

function setLanguage(language: string | null) {
  activeFile.value = { language }
}

describe('T075 useEntryDetailComputed 结构化格式检测属性（BDD-07~11）', () => {
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

  it('test_bdd_07_is_csv_true_when_language_csv', async () => {
    setLanguage('csv')
    const computed = await loadComputed()
    expect(computed.isCsv?.value).toBe(true)
    expect(computed.isTsv?.value).toBe(false)
    expect(computed.isJson?.value).toBe(false)
    expect(computed.isYaml?.value).toBe(false)
    expect(computed.isXml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(true)
  })

  it('test_bdd_08_is_tsv_true_when_language_tsv', async () => {
    setLanguage('tsv')
    const computed = await loadComputed()
    expect(computed.isTsv?.value).toBe(true)
    expect(computed.isCsv?.value).toBe(false)
    expect(computed.isJson?.value).toBe(false)
    expect(computed.isYaml?.value).toBe(false)
    expect(computed.isXml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(true)
  })

  it('test_bdd_09_is_json_true_when_language_json', async () => {
    setLanguage('json')
    const computed = await loadComputed()
    expect(computed.isJson?.value).toBe(true)
    expect(computed.isCsv?.value).toBe(false)
    expect(computed.isTsv?.value).toBe(false)
    expect(computed.isYaml?.value).toBe(false)
    expect(computed.isXml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(true)
  })

  it('test_bdd_10_is_yaml_true_when_language_yaml', async () => {
    setLanguage('yaml')
    const computed = await loadComputed()
    expect(computed.isYaml?.value).toBe(true)
    expect(computed.isCsv?.value).toBe(false)
    expect(computed.isTsv?.value).toBe(false)
    expect(computed.isJson?.value).toBe(false)
    expect(computed.isXml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(true)
  })

  it('test_bdd_11_is_xml_true_when_language_xml', async () => {
    setLanguage('xml')
    const computed = await loadComputed()
    expect(computed.isXml?.value).toBe(true)
    expect(computed.isCsv?.value).toBe(false)
    expect(computed.isTsv?.value).toBe(false)
    expect(computed.isJson?.value).toBe(false)
    expect(computed.isYaml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(true)
  })

  it('test_design_rich_renderable_false_for_plain_language', async () => {
    setLanguage('python')
    const computed = await loadComputed()
    expect(computed.isCsv?.value).toBe(false)
    expect(computed.isTsv?.value).toBe(false)
    expect(computed.isJson?.value).toBe(false)
    expect(computed.isYaml?.value).toBe(false)
    expect(computed.isXml?.value).toBe(false)
    expect(computed.isRichRenderable?.value).toBe(false)
  })
})
