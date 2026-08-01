import type { CsvParseResult } from '@/types/structured-data'

const DEFAULT_MAX_ROWS = 50000

export function parseCsv(content: string, delimiter: ',' | '\t', maxRows: number = DEFAULT_MAX_ROWS): CsvParseResult {
  const cleaned = content.replace(/^\uFEFF/, '')
  const allRows = parseRows(cleaned, delimiter)
  const headers = allRows.length > 0 ? allRows[0] : []
  const dataRows = allRows.slice(1)
  const totalRows = headers.length > 0 ? dataRows.length + 1 : 0
  const truncated = totalRows > maxRows
  const rows = dataRows.slice(0, maxRows)
  return { headers, rows, totalRows, truncated }
}

function parseRows(content: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < content.length) {
    const c = content[i]

    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
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
      if (c === '\r' && content[i + 1] === '\n') i++
      if (field !== '' || row.length > 0) {
        row.push(field)
        rows.push(row)
      }
      row = []
      field = ''
    } else {
      field += c
    }

    i++
  }

  if (inQuotes) {
    throw new Error('CSV 解析失败：存在未闭合的引号')
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}
