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
  totalRows: number
  truncated: boolean
}
