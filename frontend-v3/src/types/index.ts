// Entry types
export interface Entry {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: 'active' | 'expired'
  files: File[]
  createdAt: string
}

export interface File {
  id: number
  path: string
  filename: string
  language: string | null
  isBinary: boolean
  size: number
  lineCount: number
}

// API response types
export interface EntryListResponse {
  items: Entry[]
  total: number
  page: number
  perPage: number
}

export interface ListEntriesParams {
  q?: string
  tags?: string[]
  status?: string
  page?: number
  perPage?: number
}

// TOC types
export interface TocHeading {
  level: number
  text: string
  id: string
}

// Theme
export type Theme = 'light' | 'dark'
