/**
 * TPV0104 — 代码级源码扫描断言（BDD-07 / BDD-47）
 *
 * 判据必须是**代码级**（dispatch 约束 5）：
 *  - BDD-47：E-4 已证明 `EntryCard`/`EntryListRow` 的 `files[0]` 分支是死代码
 *    （列表接口无 `files` 字段、`client.ts:91-99` 硬编码 `files: []`）
 *    → 浏览器点卡片看 URL **现状本来就通过** → 会得假 PASS。
 *  - BDD-07：现状 `extractHeadings` 的逐行正则确实命中 1 处，但只有代码级断言能锁死
 *    「不存在第二套数据源」。
 *
 * 仓库既有源码扫描先例：`src/__tests__/t080-admin-route-guard.test.ts`、
 * `src/stores/t082-store-split.spec.ts`、`backend/tests/test_dependency_guard.py`。
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(relPath: string): string {
  return readFileSync(join(SRC_DIR, relPath), 'utf-8')
}

/** 命中数（保留为函数以便失败信息直接给出计数） */
function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  return (text.match(re) ?? []).length
}

describe('TPV0104 BDD-07 目录数据源单点（代码级）', () => {
  it('test_bdd_07_no_per_line_heading_regex_in_entry_detail_computed', () => {
    const source = readSrc('composables/useEntryDetailComputed.ts')
    // 「split('\n') 后对每行套 /^(#{1,6})\s+/ 正则」的第二套标题扫描必须归零
    const hits = countMatches(source, /#\{1,6\}/)
    expect(hits).toBe(0)
  })

  it('test_bdd_07_no_second_heading_scan_in_detail_view', () => {
    // 单一数据通路：除 useMarkdown 的 render 返回值外不得有独立标题扫描
    const source = readSrc('views/EntryDetailView.vue')
    expect(countMatches(source, /#\{1,6\}/)).toBe(0)
  })
})

describe('TPV0104 BDD-35 观测面已声明为必填类型成员（代码级）', () => {
  it('test_bdd_35_constructed_rows_declared_in_type', () => {
    // `constructedRows` 必须是 `CsvParseResult` 的**必填**成员（P2-design.md D1 选定的观测面）。
    // 该断言的存在使 csv spec 里的类型放宽（`constructedRowsOf`）不会掩盖「忘记声明字段」。
    const source = readSrc('types/structured-data.ts')
    expect(source).toMatch(/constructedRows\s*:\s*number/)
  })
})

describe('TPV0104 BDD-47 卡片与列表不再引用 files[0]（代码级）', () => {
  it('test_bdd_47_entry_card_no_files_index_access', () => {
    const source = readSrc('components/EntryCard.vue')
    const hits = countMatches(source, /files\?*\.?\[0\]/)
    expect(hits).toBe(0)
  })

  it('test_bdd_47_entry_list_row_no_files_index_access', () => {
    const source = readSrc('components/EntryListRow.vue')
    const hits = countMatches(source, /files\?*\.?\[0\]/)
    expect(hits).toBe(0)
  })

  it('test_bdd_47_entry_card_navigates_to_bare_slug', () => {
    // 导航目标为 `/{slug}`，不附加任何文件参数
    const source = readSrc('components/EntryCard.vue')
    expect(source).toMatch(/router\.push\([^)]*slug/)
    expect(source).not.toContain('firstFileId')
  })

  it('test_bdd_47_entry_list_row_navigates_to_bare_slug', () => {
    const source = readSrc('components/EntryListRow.vue')
    expect(source).toMatch(/router\.push\([^)]*slug/)
    expect(source).not.toContain('firstFileId')
  })
})
