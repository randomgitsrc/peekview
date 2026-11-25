import type { CsvParseResult } from '@/types/structured-data'

const DEFAULT_MAX_ROWS = 50000

/**
 * 单次状态机扫描：**计数与构造解耦**（P2-design.md D1/D2）。
 *
 * - `parsedDataRows` 始终累加 → `totalRows` 在截断态下依然精确
 * - `constructedRows` 达 `maxRows` 后停止增长 → 只构造必要的数据行
 * - **不 `break`**：未闭合引号的校验必须在扫完全文之后（否则超限输入会静默吞掉错误）
 */
export function parseCsv(content: string, delimiter: ',' | '\t', maxRows: number = DEFAULT_MAX_ROWS): CsvParseResult {
  const cleaned = content.replace(/^\uFEFF/, '')

  const rows: string[][] = []
  let headers: string[] = []
  let headerSeen = false
  let parsedDataRows = 0
  let constructedRows = 0

  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const commit = () => {
    row.push(field)
    if (!headerSeen) {
      headers = row
      headerSeen = true
    } else {
      parsedDataRows++
      if (constructedRows < maxRows) {
        rows.push(row)
        constructedRows++
      }
    }
    row = []
    field = ''
  }

  while (i < cleaned.length) {
    const c = cleaned[i]

    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && cleaned[i + 1] === '\n') i++
      if (field !== '' || row.length > 0) commit()
    } else {
      field += c
    }

    i++
  }

  if (inQuotes) {
    throw new Error('CSV 解析失败：存在未闭合的引号')
  }

  if (field !== '' || row.length > 0) commit()

  const totalRows = headerSeen ? parsedDataRows + 1 : 0
  const truncated = totalRows > maxRows

  return { headers, rows, totalRows, truncated, constructedRows }
}
