// Entry types
export interface Entry {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: 'active' | 'expired'
  files: File[]
  fileCount?: number
  isPublic: boolean
  ownerId: number | null
  username: string | null
  expiresAt: string | null
  createdAt: string
}

export interface File {
  id: number
  path: string | null
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
  owner?: string
  page?: number
  perPage?: number
}

// File tree types
export interface TreeNode {
  name: string
  fullPath: string
  isDir: boolean
  children: TreeNode[]
  file?: File
}

// TOC types
export interface TocHeading {
  level: number
  text: string
  id: string
}

// Markdown block types
export type MarkdownBlockType = "html" | "diagram"

export interface HtmlBlock {
  type: "html"
  html: string
}

export interface DiagramBlockData {
  type: "diagram"
  lang: "mermaid" | "plantuml" | "svg"
  code: string
  codeViewHtml: string
  index: number
}

export type MarkdownBlock = HtmlBlock | DiagramBlockData

export interface MarkdownBlocksResult {
  blocks: MarkdownBlock[]
  headings: TocHeading[]
}

// Theme
export type Theme = 'light' | 'dark'

// Auth types
export interface User {
  id: number
  username: string
  displayName: string | null
  isActive: boolean
  isAdmin: boolean
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: User
}

export type AuthState = 'loading' | 'authenticated' | 'anonymous'

// API Key types
export interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface ApiKeyCreateResult {
  id: number
  name: string
  key: string
  keyPrefix: string
  expiresAt: string | null
  createdAt: string
}