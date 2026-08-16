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
  archived_at: string | null
  created_at: string
  updated_at: string
  star_count?: number
  is_starred?: boolean
  countdown?: CountdownResponse | null
}
 
// For get entry endpoint - full response with files
export interface ReadStatsResponse {
  total_count: number
  unique_readers: number
  by_channel: Record<string, number>
  last_read_at: string | null
}

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
  archived_at: string | null
  created_at: string
  updated_at: string
  share_context?: {
    is_share_access: boolean
    shared_by: string | null
  } | null
  revoked_shares?: number | null
  read_stats?: ReadStatsResponse | null
  star_count?: number
  is_starred?: boolean
  countdown?: CountdownResponse | null
}

export interface CountdownResponse {
  status: string
  remaining_days: number
  archive_delete_at: string | null
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
  disabled_at: string | null
  disabled_by: number | null
}

export interface UserListApiResponse {
  items: UserApiResponse[]
  total: number
  page: number
  per_page: number
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

// Diagram config response types
export interface DiagramConfigResponse {
  sanitize_enabled: boolean
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

// Star API response types
export interface StarApiResponse {
  star_count: number
  is_starred: boolean
  already_starred?: boolean
  created_at?: string | null
}

export interface StarListItemResponse {
  type: 'entry'
  entry_id: number
  slug: string
  summary: string | null
  status: string
  is_public: boolean
  owner_id: number | null
  username: string | null
  starred_at: string
  star_count: number
  is_starred: boolean
  expires_at: string | null
  archived_at: string | null
  countdown: CountdownResponse | null
  tombstone: null
}

export interface TombstoneNestedResponse {
  id: number
  entry_id: number | null
  slug: string
  title: string
  cover: string | null
  deleted_by: string
  deleted_at: string
  reason: 'author_deleted' | 'expired'
}

export interface TombstoneItemResponse {
  type: 'tombstone'
  entry_id: number
  slug: string
  summary: string | null
  starred_at: string
  tombstone: TombstoneNestedResponse
}

export interface StarListApiResponse {
  items: (StarListItemResponse | TombstoneItemResponse)[]
  total: number
}

export interface RemoveStarsResponse {
  removed: number
}