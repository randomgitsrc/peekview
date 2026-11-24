/**
 * TPV0104 — CSV 解析成本与计数契约（BDD-35 / BDD-36 / BDD-37）
 *
 * 取证通道（P2-design.md D1/D2）：`CsvParseResult.constructedRows` —— 本次改动**新增暴露**的
 * 「实际构造进数组的数据行数」观测面。**不得**用 `rows.length` 判断：
 * 现状 `useCsvParser.ts:12` 的 `slice(0, maxRows)` 已天然保证 `rows.length <= maxRows`
 * （实测 1000 数据行 + maxRows=5 → rows.length=5，用它判会得假 PASS）。
 *
 * 联合约束（P2-design.md D2）：BDD-35 满足「只构造 5 行」时若把数据行计数一并砍掉，
 * `totalRows` 会从 1001 掉到 6 → BDD-36 变红。计数与构造必须解耦。
 */

import { describe, it, expect } from 'vitest'
import { parseCsv } from '../useCsvParser'
import type { CsvParseResult } from '@/types/structured-data'

/**
 * 观测面读取通道。
 *
 * `constructedRows` 是本次改动**新增**的字段（P2-design.md D1），P4 之前
 * `CsvParseResult` 尚未声明它 —— 直接 `result.constructedRows` 会在 `make typecheck`
 * 报 TS2339，把「行为未实现」误报成 A 类错误。故在**类型层**局部放宽、**取值仍走真实运行时**：
 * 未实现时读出 `undefined`，断言照常失败（classic assertion red-light）。
 *
 * 「该字段必须成为 `CsvParseResult` 的**必填**成员」由 `tpv0104-source-scan.test.ts`
 * 的 `test_bdd_35_constructed_rows_declared_in_type` 代码级锁死，故此处放宽不放水。
 */
function constructedRowsOf(result: CsvParseResult): number | undefined {
  return (result as CsvParseResult & { constructedRows?: number }).constructedRows
}

function csvWithDataRows(n: number): string {
  const rows: string[] = ['id,name']
  for (let i = 0; i < n; i++) rows.push(`${i},row${i}`)
  return rows.join('\n')
}

describe('TPV0104 CSV 构造行数观测面（BDD-35）', () => {
  it('test_bdd_35_constructed_rows_bounded_by_max_rows', () => {
    const result = parseCsv(csvWithDataRows(1000), ',', 5)
    // ① 上界：实际构造的数据行数 <= maxRows
    expect(constructedRowsOf(result)).toBeLessThanOrEqual(5)
  })

  it('test_bdd_35_constructed_rows_equals_data_rows_when_under_limit', () => {
    // ② 正反双向：未达上限时必须 == 真实数据行数（排除「恒返回 0」也通过）
    const result = parseCsv(csvWithDataRows(3), ',', 5)
    expect(constructedRowsOf(result)).toBe(3)
  })

  it('test_bdd_35_constructed_rows_equals_max_rows_when_truncated', () => {
    // 超限时构造量恰为上界（与 BDD-36 的 totalRows 精确性互不干扰）
    const result = parseCsv(csvWithDataRows(1000), ',', 5)
    expect(constructedRowsOf(result)).toBe(5)
    expect(result.rows).toHaveLength(5)
  })
})

describe('TPV0104 CSV 截断态计数（BDD-36 回归兼容）', () => {
  it('test_bdd_36_total_rows_exact_when_truncated', () => {
    const result = parseCsv(csvWithDataRows(1000), ',', 5)
    expect(result.totalRows).toBe(1001)
    expect(result.truncated).toBe(true)
    expect(result.rows).toHaveLength(5)
  })

  it('test_bdd_36_total_rows_exact_when_not_truncated', () => {
    const result = parseCsv(csvWithDataRows(3), ',', 5)
    expect(result.totalRows).toBe(4)
    expect(result.truncated).toBe(false)
  })

  it('test_bdd_36_empty_input_total_rows_zero', () => {
    // 既有契约（useCsvParser.spec.ts:51-57 断言在 :55）：空输入 totalRows === 0
    const result = parseCsv('', ',')
    expect(result.totalRows).toBe(0)
    expect(constructedRowsOf(result)).toBe(0)
  })
})

describe('TPV0104 CSV 超限且引号未闭合仍抛错（BDD-37 回归兼容）', () => {
  it('test_bdd_37_unclosed_quote_throws_even_when_far_over_max_rows', () => {
    // 前置 1000 行合法数据 + 末尾未闭合引号：不得因「提前终止构造」静默吞掉校验
    const content = `${csvWithDataRows(1000)}\n"unclosed`
    expect(() => parseCsv(content, ',', 5)).toThrow()
  })

  it('test_bdd_37_short_unclosed_quote_still_throws', () => {
    // 与既有契约 expect(() => parseCsv('a,b\n"unclosed', ',')).toThrow() 同型
    expect(() => parseCsv('a,b\n"unclosed', ',', 5)).toThrow()
  })
})
