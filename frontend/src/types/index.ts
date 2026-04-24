// frontend/src/types/index.ts

// === Entry Types ===
export interface EntryResponse {
  id: number
  slug: string
  url: string
  summary: string
  status: 'active' | 'archived' | 'published'
  tags: string[]
  files: FileResponse[]
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface FileResponse {
  id: number
  path: string | null
  filename: string
  language: string | null
  is_binary: boolean
  size: number
  line_count: number | null
  content?: string  // Populated when ?include=files.content
}

export interface EntryListItem {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  file_count: number
  created_at: string
  updated_at: string
}

export interface EntryListResponse {
  items: EntryListItem[]
  total: number
  page: number
  per_page: number
}

export interface FileContentResponse {
  content: string
  language: string | null
  filename: string
  size: number
}

// === TOC Types ===
export interface TocHeading {
  id: string
  text: string
  level: number
}

// === Tree Types ===
export interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  file?: FileResponse
}

// === Error Types ===
export interface PeekErrorBody {
  error: {
    code: string
    message: string
    details: unknown
  }
}

export class PeekApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number = 0) {
    super(message)
    this.name = 'PeekApiError'
    this.code = code
    this.status = status
  }
}

// === UI Types ===
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}
