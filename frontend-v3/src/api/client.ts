import axios, { type AxiosInstance } from 'axios'
import type { Entry, EntryListResponse, ListEntriesParams, AuthResponse, User, ApiKey, ApiKeyCreateResult } from '@/types'
import type { EntryResponse, EntryListItemResponse, EntryListApiResponse, AuthApiResponse, UserApiResponse, ApiKeyResponse, ApiKeyCreateResponse, ApiKeyListApiResponse } from './types'

const API_BASE = '/api/v1'

class PeekAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.client.post('/auth/logout').catch(() => {})
          window.dispatchEvent(new CustomEvent('peekview:auth-expired'))
        }
        return Promise.reject(error)
      }
    )
  }

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

  private transformListItem(entry: EntryListItemResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'expired',
      files: [],
      fileCount: entry.file_count,
      isPublic: entry.is_public ?? true,
      ownerId: entry.owner_id ?? null,
      username: entry.username,
      expiresAt: entry.expires_at,
      createdAt: entry.created_at,
    }
  }

  private transformEntry(entry: EntryResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'expired',
      files: entry.files.map(f => this.transformFile(f)),
      isPublic: entry.is_public ?? true,
      ownerId: entry.owner_id ?? null,
      username: entry.username,
      expiresAt: entry.expires_at,
      createdAt: entry.created_at,
    }
  }

  private transformUser(user: UserApiResponse): User {
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      isActive: user.is_active,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
    }
  }

  // --- Entry API --- //

  async listEntries(params?: ListEntriesParams): Promise<EntryListResponse> {
    const response = await this.client.get<EntryListApiResponse>('/entries', {
      params: {
        q: params?.q,
        tags: params?.tags?.join(','),
        status: params?.status,
        owner: params?.owner,
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

  async toggleEntryVisibility(slug: string, isPublic: boolean): Promise<Entry> {
    const response = await this.client.patch<EntryResponse>(`/entries/${slug}`, {
      is_public: isPublic,
    })
    return this.transformEntry(response.data)
  }

  async deleteEntry(slug: string): Promise<void> {
    await this.client.delete(`/entries/${slug}`)
  }

  async getFileContent(slug: string, fileId: number): Promise<string> {
    const response = await this.client.get<string>(
      `/entries/${slug}/files/${fileId}/content`,
      { responseType: 'text' }
    )
    return response.data
  }

  async getFileAsBase64(slug: string, fileId: number): Promise<string> {
    const response = await this.client.get(
      `/entries/${slug}/files/${fileId}`,
      { responseType: 'arraybuffer' }
    )
    const bytes = new Uint8Array(response.data)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  downloadFile(slug: string, fileId: number): string {
    return `${API_BASE}/entries/${slug}/files/${fileId}`
  }

  // --- Auth API --- //

  async login(username: string, password: string, captchaToken?: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthApiResponse>('/auth/login', {
      username,
      password,
      captcha_token: captchaToken || null,
    })
    const data = response.data
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      user: this.transformUser(data.user),
    }
  }

  async register(username: string, password: string, displayName?: string, captchaToken?: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthApiResponse>('/auth/register', {
      username,
      password,
      display_name: displayName || null,
      captcha_token: captchaToken || null,
    })
    const data = response.data
    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      user: this.transformUser(data.user),
    }
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<UserApiResponse>('/auth/me')
    return this.transformUser(response.data)
  }

  logout(): void {
    this.client.post('/auth/logout').catch(() => {})
  }

  // --- API Key management --- //

  private transformApiKey(key: ApiKeyResponse): ApiKey {
    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
    }
  }

  async listApiKeys(): Promise<ApiKey[]> {
    const response = await this.client.get<ApiKeyListApiResponse>('/apikeys')
    return response.data.items.map(k => this.transformApiKey(k))
  }

  async createApiKey(name: string, expiresIn?: string): Promise<ApiKeyCreateResult> {
    const payload: { name: string; expires_in?: string } = { name }
    if (expiresIn) payload.expires_in = expiresIn

    const response = await this.client.post<ApiKeyCreateResponse>('/apikeys', payload)
    const data = response.data
    return {
      id: data.id,
      name: data.name,
      key: data.key,
      keyPrefix: data.key_prefix,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    }
  }

  async revokeApiKey(keyId: number): Promise<void> {
    await this.client.delete(`/apikeys/${keyId}`)
  }

  async cleanupExpiredKeys(): Promise<number> {
    const response = await this.client.delete<{ deleted: number }>('/apikeys/expired')
    return response.data.deleted
  }
}

export const api = new PeekAPI()