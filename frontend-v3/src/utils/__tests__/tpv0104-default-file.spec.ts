/**
 * TPV0104 — 默认入口 resolver（BDD-08 ~ BDD-12 + 无效 id 回退机理 BDD-16/17/18/51）
 *
 * 取证通道：**已存在**的 `@/stores/entryDetail` 的 `loadEntry()` —— resolver 的唯一生产消费点
 * （P2-design.md D3：三条来源最终都汇聚到 loadEntry）。本用例断言的是 resolver 的**输出**
 * （`activeFile.filename`），不是它的实现形态，故不 import 尚未存在的 `@/utils/default-file`。
 *
 * 素材通则（P1 §3.2）：凡依赖「排序首个」的判据，素材必须使「排序首个 ≠ 期望值」，
 * 且排序首个必须是非 README/index 的普通文件名；`aaa.*` 排不到 `README.md` 之前（`R`=82<`a`=97），
 * 故凡「README 优先」场景一律用大写起头名（`A`=65 < `R`=82）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Entry, File } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import { api } from '@/api/client'
import { useEntryDetailStore } from '@/stores/entryDetail'

function file(id: number, filename: string, path: string | null = null): File {
  return { id, path, filename, language: 'markdown', isBinary: false, size: 100, lineCount: 10 }
}

function entry(files: File[]): Entry {
  return {
    id: 1,
    slug: 'tpv0104-default-file',
    summary: 'resolver probe',
    tags: [],
    status: 'active',
    files,
    fileCount: files.length,
    isPublic: true,
    ownerId: null,
    username: null,
    expiresAt: null,
    archivedAt: null,
    createdAt: '2026-11-24T00:00:00Z',
  }
}

async function loadActiveFilename(files: File[], fileId?: number): Promise<string | null> {
  vi.mocked(api.getEntry).mockResolvedValue(entry(files))
  vi.mocked(api.getFileContent).mockResolvedValue('# probe')
  const store = useEntryDetailStore()
  await store.loadEntry('tpv0104-default-file', fileId)
  return store.activeFile?.filename ?? null
}

describe('TPV0104 默认入口 resolver（BDD-08 ~ BDD-12）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('test_bdd_08_root_readme_wins_over_lexicographically_first', async () => {
    // 实测 sorted(['AAA.txt','README.md']) == ['AAA.txt','README.md']（A=65 < R=82）
    const got = await loadActiveFilename([file(1, 'AAA.txt'), file(2, 'README.md')])
    expect(got).toBe('README.md')
    expect(got).not.toBe('AAA.txt')
  })

  it('test_bdd_09_root_index_when_no_readme', async () => {
    // 实测 sorted(['aaa.md','index.md']) == ['aaa.md','index.md']
    const got = await loadActiveFilename([file(1, 'aaa.md'), file(2, 'index.md')])
    expect(got).toBe('index.md')
  })

  it('test_bdd_10_falls_back_to_stably_sorted_first_not_construction_first', async () => {
    // 构造序 bbb 在前，字典序 aaa.md 在前
    const got = await loadActiveFilename([file(1, 'bbb.txt'), file(2, 'aaa.txt')])
    expect(got).toBe('aaa.txt')
    expect(got).not.toBe('bbb.txt')
  })

  it('test_bdd_11_only_root_level_readme_matches', async () => {
    // P2-design.md R10：`path='sub'` 落盘为根级文件 `sub`（basename 非 readme → 不选中）
    const got = await loadActiveFilename([file(1, 'README.md', 'sub'), file(2, 'aaa.md')])
    expect(got).toBe('aaa.md')
    expect(got).not.toBe('README.md')
  })

  it('test_bdd_11_nested_readme_path_is_never_selected', async () => {
    // 真嵌套形态（path 含 '/'）同样不得被选为根级默认入口
    const got = await loadActiveFilename([file(1, 'README.md', 'sub/README.md'), file(2, 'aaa.md')])
    expect(got).toBe('aaa.md')
  })

  it('test_bdd_12_readme_match_is_case_insensitive', async () => {
    // 构造序 AAA.txt 在前；现状兜底取构造首个 → FAIL；改后得 readme.md
    const got = await loadActiveFilename([file(1, 'AAA.txt'), file(2, 'readme.md')])
    expect(got).toBe('readme.md')
    expect(got).not.toBe('AAA.txt')
  })
})

describe('TPV0104 无效 file id 回退默认入口（BDD-16/17/18/51 的机理层）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('test_bdd_16_unknown_file_id_falls_back_to_default_entry', async () => {
    const got = await loadActiveFilename([file(1, 'AAA.txt'), file(2, 'README.md')], 999999)
    expect(got).toBe('README.md')
  })

  it('test_bdd_17_cross_entry_file_id_falls_back_to_default_entry', async () => {
    // 999 不是本 entry 的任何文件 id（模拟「其他 entry 的 file id」）
    const got = await loadActiveFilename([file(1, 'AAA.txt'), file(2, 'README.md')], 999)
    expect(got).toBe('README.md')
  })

  it('test_bdd_18_valid_file_id_still_selects_that_file', async () => {
    // 成对对照的正向前置：有效 id 必须真的切换（不成立即证「参数从未被读取」）
    const got = await loadActiveFilename([file(1, 'AAA.txt'), file(2, 'README.md')], 1)
    expect(got).toBe('AAA.txt')
  })
})
