export type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export interface TreeDataNode {
  key: string
  value: string
  type: NodeType
  children?: TreeDataNode[]
  path: string
}

export interface CsvParseResult {
  headers: string[]
  rows: string[][]
  /**
   * 精确总行数（含表头行）。与 `maxRows` 截断**无关**——扫完全文后得出。
   */
  totalRows: number
  truncated: boolean
  /**
   * 实际构造进 `rows` 数组的**数据行**数（不含表头），达 `maxRows` 即停止增长。
   *
   * 与 `rows.length` 的区别：未超限时两者相等；超限时 `rows.length` 恒等于 `maxRows`
   * 而 `constructedRows` 才是「本次真正解包了多少行」的观测面（P2-design.md D1）。
   * **不要**把它当「返回数据的行数上限」或重新推导 `totalRows`（`totalRows` 已有精确计数）。
   */
  constructedRows: number
}
