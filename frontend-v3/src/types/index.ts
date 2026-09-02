// Entry types
export interface ReadStats {
  totalCount: number
  uniqueReaders: number
  byChannel: Record<string, number>
  lastReadAt: string | null
}

export interface TeamRef {
  slug: string
  name: string
}

export interface Team {
  slug: string
  name: string
  memberCount: number
}

export interface TeamDetail extends Team {
  ownerUsername: string
  members: TeamMemberRef[]
}

export interface TeamMemberRef {
  id: number
  username: string
}

export interface TeamListResponse {
  owned: Team[]
  joined: Team[]
}

export interface Entry {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: 'active' | 'archived'
  files: File[]
  fileCount?: number
  isPublic: boolean
  ownerId: number | null
  username: string | null
  expiresAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt?: string
  teamId?: number | null
  team?: TeamRef | null
  shareContext?: {
    isShareAccess: boolean
    sharedBy: string | null
  } | null
  revokedShares?: number | null
  readStats?: ReadStats | null
  starCount?: number
  isStarred?: boolean
  countdown?: CountdownInfo | null
}

export interface CountdownInfo {
  status: 'paused' | 'running' | 'expired'
  remainingDays: number
  archiveDeleteAt: string | null
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
  ownerFound?: boolean | null
}

export interface ListEntriesParams {
  q?: string
  tags?: string[]
  status?: string
  owner?: string
  starred?: boolean
  team?: string
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
  disabledAt?: string | null
  disabledBy?: number | null
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: User
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  perPage: number
}

export interface ListUsersParams {
  page?: number
  perPage?: number
  username?: string
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

// Share types
export interface ShareInfo {
  id: number
  tokenPrefix: string
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  createdBy: number
  createdAt: string
  revokedAt: string | null
}

export interface ShareCreateResult {
  id: number
  tokenPrefix: string
  shareUrl: string
  expiresAt: string | null
  maxViews: number | null
  viewCount: number
  createdAt: string
}

// Star types
export type StarItem =
  | (Entry & { type: 'entry' })
  | {
      type: 'tombstone'
      id: number
      slug: string
      title: string
      deletedBy: string
      deletedAt: string
      reason: 'author_deleted' | 'expired'
    }

export interface StarListParams {
  filter?: string
  page?: number
  perPage?: number
}

export interface StarListResponse {
  items: StarItem[]
  total: number
}