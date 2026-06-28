// Raw API response types (may differ from domain types)

// For list entries endpoint - simplified response
export interface EntryListItemResponse {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  file_count: number
  is_public: boolean
  owner_id: number | null
  username: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

// For get entry endpoint - full response with files
export interface EntryResponse {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  files: FileResponse[]
  is_public: boolean
  owner_id: number | null
  username: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  share_context?: {
    is_share_access: boolean
    shared_by: string | null
  } | null
  revoked_shares?: number | null
}

export interface FileResponse {
  id: number
  path: string | null
  filename: string
  language: string | null
  is_binary: boolean
  size: number
  line_count: number
}

export interface EntryListApiResponse {
  items: EntryListItemResponse[]
  total: number
  page: number
  per_page: number
  owner_found?: boolean | null
}

// Auth API response types
export interface AuthApiResponse {
  access_token: string
  token_type: string
  user: UserApiResponse
}

export interface UserApiResponse {
  id: number
  username: string
  display_name: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

// API Key API response types
export interface ApiKeyResponse {
  id: number
  name: string
  key_prefix: string
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

export interface ApiKeyCreateResponse {
  id: number
  name: string
  key: string
  key_prefix: string
  expires_at: string | null
  created_at: string
}

export interface ApiKeyListApiResponse {
  items: ApiKeyResponse[]
}

// Share API response types
export interface ShareResponse {
  id: number
  token_prefix: string
  expires_at: string | null
  max_views: number | null
  view_count: number
  created_by: number
  created_at: string
  revoked_at: string | null
}

export interface ShareCreateResponse extends ShareResponse {
  share_url: string
}

export interface ShareListApiResponse {
  shares: ShareResponse[]
  total: number
}