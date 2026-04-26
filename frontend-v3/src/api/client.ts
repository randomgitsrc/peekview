import axios, { type AxiosInstance } from 'axios'
import type { Entry, EntryListResponse, ListEntriesParams } from '@/types'
import type { EntryResponse, EntryListItemResponse, EntryListApiResponse } from './types'

const API_BASE = '/api/v1'

class PeekAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Transform API response to domain model
  private transformFile(file: import('./types').FileResponse) {
    return {
      id: file.id,
      path: file.path,
      filename: file.filename,
      language: file.language,
      isBinary: file.is_binary,
      size: file.size,
      lineCount: file.line_count,
    }
  }

  // Transform for list items (simplified, no files array)
  private transformListItem(entry: EntryListItemResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'expired',
      files: [], // Empty array for list view
      fileCount: entry.file_count,
      createdAt: entry.created_at,
    }
  }

  // Transform for detail (full with files)
  private transformEntry(entry: EntryResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'expired',
      files: entry.files.map(f => this.transformFile(f)),
      createdAt: entry.created_at,
    }
  }

  async listEntries(params?: ListEntriesParams): Promise<EntryListResponse> {
    const response = await this.client.get<EntryListApiResponse>('/entries', {
      params: {
        q: params?.q,
        tags: params?.tags?.join(','),
        status: params?.status,
        page: params?.page,
        per_page: params?.perPage,
      },
    })

    return {
      items: response.data.items.map(e => this.transformListItem(e)),
      total: response.data.total,
      page: response.data.page,
      perPage: response.data.per_page,
    }
  }

  async getEntry(slug: string): Promise<Entry> {
    const response = await this.client.get<EntryResponse>(`/entries/${slug}`)
    return this.transformEntry(response.data)
  }

  async getFileContent(slug: string, fileId: number): Promise<string> {
    const response = await this.client.get<string>(
      `/entries/${slug}/files/${fileId}/content`,
      { responseType: 'text' }
    )
    return response.data
  }

  downloadFile(slug: string, fileId: number): string {
    return `${API_BASE}/entries/${slug}/files/${fileId}`
  }

  downloadPack(slug: string): string {
    return `${API_BASE}/entries/${slug}/files/pack`
  }
}

export const api = new PeekAPI()
