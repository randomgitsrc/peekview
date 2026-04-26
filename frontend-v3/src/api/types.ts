// Raw API response types (may differ from domain types)

// For list entries endpoint - simplified response
export interface EntryListItemResponse {
  id: number
  slug: string
  summary: string
  tags: string[]
  status: string
  file_count: number
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
  created_at: string
  updated_at: string
}

export interface FileResponse {
  id: number
  path: string
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
}
