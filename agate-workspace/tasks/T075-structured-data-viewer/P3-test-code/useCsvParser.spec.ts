import { describe, it, expect } from 'vitest'
import { parseCsv } from '../useCsvParser'

// T075 useCsvParser — CSV/TSV 状态机解析（P2 §3.6）
// 当前红灯：../useCsvParser 模块不存在 → import 失败（B 类红灯）

describe('T075 useCsvParser 引号内逗号/换行/转义/BOM（BDD-14/15/16）', () => {
  it('test_bdd_14_quoted_comma_not_split', () => {
    const result = parseCsv('a,b\n"hello, world",x', ',')
    expect(result.headers).toEqual(['a', 'b'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0][0]).toBe('hello, world')
    expect(result.rows[0][1]).toBe('x')
  })

  it('test_bdd_15_quoted_newline_not_split', () => {
    const result = parseCsv('a,b\n"line1\nline2",x', ',')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0][0]).toBe('line1\nline2')
    expect(result.rows[0][1]).toBe('x')
  })

  it('test_bdd_16_double_quote_unescaped', () => {
    const result = parseCsv('a,b\n"say ""hi""",x', ',')
    expect(result.rows[0][0]).toBe('say "hi"')
    expect(result.rows[0][0]).not.toContain('""')
  })

  it('test_csv_bom_header_stripped', () => {
    const result = parseCsv('\uFEFFa,b\n1,2', ',')
    expect(result.headers[0]).toBe('a')
    expect(result.headers[0]).not.toBe('\uFEFFa')
  })

  it('test_tsv_tab_delimiter_supported', () => {
    const result = parseCsv('name\tage\nalice\t30', '\t')
    expect(result.headers).toEqual(['name', 'age'])
    expect(result.rows[0]).toEqual(['alice', '30'])
  })
})

describe('T075 useCsvParser 截断与空输入（BDD-22/23）', () => {
  it('test_bdd_22_parser_truncates_over_max_rows', () => {
    const content = Array.from({ length: 5 }, (_, i) => `v,${i}`).join('\n')
    const result = parseCsv(content, ',', 2)
    expect(result.rows).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(result.totalRows).toBe(5)
  })

  it('test_bdd_23_empty_csv_no_rows', () => {
    const result = parseCsv('', ',')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.totalRows).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('test_bdd_23_header_only_csv_no_data_rows', () => {
    const result = parseCsv('a,b,c', ',')
    expect(result.headers).toEqual(['a', 'b', 'c'])
    expect(result.rows).toEqual([])
  })
})

describe('T075 useCsvParser 异常（BDD-49）', () => {
  it('test_bdd_49_unclosed_quote_throws', () => {
    expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow()
  })
})
