import axios, { type AxiosInstance } from 'axios'
import type { Entry, EntryListResponse, ListEntriesParams, AuthResponse, User, ApiKey, ApiKeyCreateResult, ShareInfo, ShareCreateResult } from '@/types'
import type { EntryResponse, EntryListItemResponse, EntryListApiResponse, AuthApiResponse, UserApiResponse, ApiKeyResponse, ApiKeyCreateResponse, ApiKeyListApiResponse, ShareResponse, ShareCreateResponse, ShareListApiResponse } from './types'

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
      updatedAt: entry.updated_at,
      shareContext: entry.share_context
        ? {
            isShareAccess: entry.share_context.is_share_access,
            sharedBy: entry.share_context.shared_by,
          }
        : null,
      revokedShares: entry.revoked_shares ?? undefined,
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
      ownerFound: response.data.owner_found ?? null,
    }
  }

  async getEntry(slug: string, shareToken?: string): Promise<Entry> {
    const config = shareToken ? { params: { share: shareToken } } : undefined
    const response = await this.client.get<EntryResponse>(`/entries/${slug}`, config)
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

  // --- Share API --- //

  private transformShare(share: ShareResponse): ShareInfo {
    return {
      id: share.id,
      tokenPrefix: share.token_prefix,
      expiresAt: share.expires_at,
      maxViews: share.max_views,
      viewCount: share.view_count,
      createdBy: share.created_by,
      createdAt: share.created_at,
      revokedAt: share.revoked_at,
    }
  }

  async createShare(slug: string, data: { expires_in: string; max_views: number | null }): Promise<ShareCreateResult> {
    const response = await this.client.post<ShareCreateResponse>(`/entries/${slug}/shares`, data)
    const d = response.data
    return {
      id: d.id,
      tokenPrefix: d.token_prefix,
      shareUrl: d.share_url,
      expiresAt: d.expires_at,
      maxViews: d.max_views,
      viewCount: d.view_count,
      createdAt: d.created_at,
    }
  }

  async listShares(slug: string): Promise<{ shares: ShareInfo[]; total: number }> {
    const response = await this.client.get<ShareListApiResponse>(`/entries/${slug}/shares`)
    return {
      shares: response.data.shares.map(s => this.transformShare(s)),
      total: response.data.total,
    }
  }

  async revokeShares(slug: string, data: { share_ids: number[] }): Promise<{ revoked_count: number }> {
    const response = await this.client.post(`/entries/${slug}/shares/revoke`, data)
    return response.data
  }
}

export const api = new PeekAPI()