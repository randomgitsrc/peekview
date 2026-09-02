import axios, { type AxiosInstance } from 'axios'
import type { Entry, EntryListResponse, ListEntriesParams, AuthResponse, User, UserListResponse, ListUsersParams, ApiKey, ApiKeyCreateResult, ShareInfo, ShareCreateResult, StarItem, StarListParams, StarListResponse, CountdownInfo, Team, TeamDetail, TeamListResponse, TeamMemberRef } from '@/types'
import type { EntryResponse, EntryListItemResponse, EntryListApiResponse, AuthApiResponse, UserApiResponse, UserListApiResponse, ApiKeyResponse, ApiKeyCreateResponse, ApiKeyListApiResponse, ShareResponse, ShareCreateResponse, ShareListApiResponse, StarApiResponse, StarListItemResponse, StarListApiResponse, TombstoneItemResponse, CountdownResponse, RemoveStarsResponse, TeamListApiResponse, TeamDetailResponse } from './types'

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

  private transformCountdown(countdown?: CountdownResponse | null): CountdownInfo | null {
    if (!countdown) return null
    return {
      status: countdown.status as CountdownInfo['status'],
      remainingDays: countdown.remaining_days,
      archiveDeleteAt: countdown.archive_delete_at,
    }
  }

  private transformListItem(entry: EntryListItemResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'archived',
      files: [],
      fileCount: entry.file_count,
      isPublic: entry.is_public ?? true,
      ownerId: entry.owner_id ?? null,
      username: entry.username,
      expiresAt: entry.expires_at,
      archivedAt: entry.archived_at ?? null,
      createdAt: entry.created_at,
      teamId: entry.team_id ?? null,
      team: entry.team ? { slug: entry.team.slug, name: entry.team.name } : null,
      starCount: entry.star_count ?? 0,
      isStarred: entry.is_starred ?? false,
      countdown: this.transformCountdown(entry.countdown),
    }
  }

  private transformEntry(entry: EntryResponse): Entry {
    return {
      id: entry.id,
      slug: entry.slug,
      summary: entry.summary,
      tags: entry.tags,
      status: entry.status as 'active' | 'archived',
      files: entry.files.map(f => this.transformFile(f)),
      isPublic: entry.is_public ?? true,
      ownerId: entry.owner_id ?? null,
      username: entry.username,
      expiresAt: entry.expires_at,
      archivedAt: entry.archived_at ?? null,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      teamId: entry.team_id ?? null,
      team: entry.team ? { slug: entry.team.slug, name: entry.team.name } : null,
      shareContext: entry.share_context
        ? {
            isShareAccess: entry.share_context.is_share_access,
            sharedBy: entry.share_context.shared_by,
          }
        : null,
      revokedShares: entry.revoked_shares ?? undefined,
      readStats: entry.read_stats
        ? {
            totalCount: entry.read_stats.total_count,
            uniqueReaders: entry.read_stats.unique_readers,
            byChannel: entry.read_stats.by_channel,
            lastReadAt: entry.read_stats.last_read_at,
          }
        : null,
      starCount: entry.star_count ?? 0,
      isStarred: entry.is_starred ?? false,
      countdown: this.transformCountdown(entry.countdown),
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
      disabledAt: user.disabled_at ?? null,
      disabledBy: user.disabled_by ?? null,
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
        starred: params?.starred,
        team: params?.team,
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

  async updateEntry(slug: string, data: { expires_in?: string; is_public?: boolean; summary?: string; tags?: string[]; team_id?: string | null }): Promise<Entry> {
    const response = await this.client.patch<EntryResponse>(`/entries/${slug}`, data)
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
      `/entries/${slug}/files/${fileId}/content`,
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

  // --- Star API --- //

  star = async (slug: string): Promise<StarApiResponse> => {
    const response = await this.client.post<StarApiResponse>(`/entries/${slug}/star`)
    return response.data
  }

  async unstar(slug: string): Promise<{ star_count: number; is_starred: boolean }> {
    const response = await this.client.delete<{ star_count: number; is_starred: boolean }>(`/entries/${slug}/star`)
    return response.data
  }

  private transformTombstone(item: TombstoneItemResponse): StarItem {
    const t = item.tombstone
    return {
      type: 'tombstone',
      id: item.entry_id,
      slug: item.slug,
      title: t.title,
      deletedBy: t.deleted_by,
      deletedAt: t.deleted_at,
      reason: t.reason,
    }
  }

  private transformStarEntry(item: StarListItemResponse): StarItem {
    return {
      type: 'entry',
      id: item.entry_id,
      slug: item.slug,
      summary: item.summary ?? '',
      tags: [],
      status: item.status as 'active' | 'archived',
      files: [],
      fileCount: 0,
      isPublic: item.is_public ?? true,
      ownerId: item.owner_id ?? null,
      username: item.username,
      expiresAt: item.expires_at,
      archivedAt: item.archived_at ?? null,
      createdAt: item.starred_at,
      teamId: item.team_id ?? null,
      team: item.team ? { slug: item.team.slug, name: item.team.name } : null,
      starCount: item.star_count ?? 0,
      isStarred: item.is_starred ?? false,
      countdown: this.transformCountdown(item.countdown),
    }
  }

  async listStars(params?: StarListParams): Promise<StarListResponse> {
    const response = await this.client.get<StarListApiResponse>('/stars', {
      params: {
        filter: params?.filter,
        page: params?.page,
        per_page: params?.perPage,
      },
    })
    return {
      items: response.data.items.map(i =>
        i.type === 'tombstone'
          ? this.transformTombstone(i)
          : this.transformStarEntry(i)
      ),
      total: response.data.total,
    }
  }

  async removeStars(entryIds: number[]): Promise<RemoveStarsResponse> {
    const response = await this.client.delete<RemoveStarsResponse>('/stars', {
      data: { entry_ids: entryIds },
    })
    return response.data
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

  async updateProfile(displayName: string | null): Promise<User> {
    const response = await this.client.patch<UserApiResponse>('/auth/me', {
      display_name: displayName,
    })
    return this.transformUser(response.data)
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    })
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

  async getDiagramConfig(): Promise<import('./types').DiagramConfigResponse> {
    const response = await this.client.get('/config/diagram')
    return response.data
  }

  // --- Admin User API --- //

  async listUsers(params?: ListUsersParams): Promise<UserListResponse> {
    const response = await this.client.get<UserListApiResponse>('/admin/users', {
      params: {
        username: params?.username,
        page: params?.page,
        per_page: params?.perPage,
      },
    })
    return {
      items: response.data.items.map(u => this.transformUser(u)),
      total: response.data.total,
      page: response.data.page,
      perPage: response.data.per_page,
    }
  }

  async disableUser(id: number, reason?: string): Promise<User> {
    const response = await this.client.post<UserApiResponse>(
      `/admin/users/${id}/disable`,
      reason ? { reason } : undefined,
    )
    return this.transformUser(response.data)
  }

  async enableUser(id: number): Promise<User> {
    const response = await this.client.post<UserApiResponse>(`/admin/users/${id}/enable`)
    return this.transformUser(response.data)
  }

  async promoteUser(id: number): Promise<User> {
    const response = await this.client.post<UserApiResponse>(`/admin/users/${id}/promote`)
    return this.transformUser(response.data)
  }

  async demoteUser(id: number): Promise<User> {
    const response = await this.client.post<UserApiResponse>(`/admin/users/${id}/demote`)
    return this.transformUser(response.data)
  }

  async resetUserPassword(id: number, newPassword: string): Promise<{ newPassword: string }> {
    const response = await this.client.post(`/admin/users/${id}/reset-password`, {
      new_password: newPassword,
    })
    return { newPassword: response.data.new_password }
  }

  async deleteUser(id: number): Promise<void> {
    await this.client.delete(`/admin/users/${id}`)
  }

  // --- Team API --- //

  private transformTeamSummary(team: import('./types').TeamSummaryResponse): Team {
    return {
      slug: team.slug,
      name: team.name,
      memberCount: team.member_count ?? 0,
    }
  }

  private transformTeamDetail(team: TeamDetailResponse): TeamDetail {
    return {
      slug: team.slug,
      name: team.name,
      memberCount: team.member_count ?? 0,
      ownerUsername: team.owner_username,
      members: (team.members ?? []).map((m: { id: number; username: string }): TeamMemberRef => ({
        id: m.id,
        username: m.username,
      })),
    }
  }

  async listTeams(): Promise<TeamListResponse> {
    const response = await this.client.get<TeamListApiResponse>('/teams')
    return {
      owned: response.data.owned.map(t => this.transformTeamSummary(t)),
      joined: response.data.joined.map(t => this.transformTeamSummary(t)),
    }
  }

  async getTeam(slug: string): Promise<TeamDetail> {
    const response = await this.client.get<TeamDetailResponse>(`/teams/${slug}`)
    return this.transformTeamDetail(response.data)
  }

  async createTeam(name: string): Promise<TeamDetail> {
    const response = await this.client.post<TeamDetailResponse>('/teams', { name })
    return this.transformTeamDetail(response.data)
  }

  async renameTeam(slug: string, name: string): Promise<TeamDetail> {
    const response = await this.client.patch<TeamDetailResponse>(`/teams/${slug}`, { name })
    return this.transformTeamDetail(response.data)
  }

  async deleteTeam(slug: string): Promise<void> {
    await this.client.delete(`/teams/${slug}`)
  }

  async addMember(slug: string, username: string): Promise<TeamDetail> {
    const response = await this.client.post<TeamDetailResponse>(`/teams/${slug}/members`, { username })
    return this.transformTeamDetail(response.data)
  }

  async removeMember(slug: string, userId: number): Promise<TeamDetail> {
    const response = await this.client.delete<TeamDetailResponse>(`/teams/${slug}/members/${userId}`)
    return this.transformTeamDetail(response.data)
  }

  async leaveTeam(slug: string): Promise<void> {
    await this.client.post(`/teams/${slug}/leave`)
  }
}

export const api = new PeekAPI()