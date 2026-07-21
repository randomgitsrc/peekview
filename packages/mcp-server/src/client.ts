/**
 * PeekView API HTTP Client - user token passthrough
 */
import { PeekViewApiError } from './types.js';
import type {
  CreateEntryRequest,
  EntryResponse,
  ListEntriesResponse,
} from './types.js';

interface ClientConfig {
  peekviewUrl: string;
}

export class PeekViewClient {
  private baseUrl: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    userToken: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'X-PeekView-Source': 'mcp',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new PeekViewApiError(response.status, errorText || response.statusText);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new PeekViewApiError(response.status, `Expected JSON response, got ${contentType}`);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateToken(token: string): Promise<{ id: number; username: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const user = await res.json();
      return { id: user.id, username: user.username };
    } catch (e) {
      clearTimeout(timeout);
      // Distinguish timeout (503) from other errors
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('PeekView connection timeout during token validation');
      }
      return null;
    }
  }

  async createEntry(request: CreateEntryRequest, userToken: string): Promise<EntryResponse> {
    return this.request<EntryResponse>('/api/v1/entries', {
      method: 'POST',
      body: JSON.stringify(request),
    }, userToken);
  }

  async getEntry(slug: string, userToken: string): Promise<EntryResponse> {
    return this.request<EntryResponse>(`/api/v1/entries/${slug}`, undefined, userToken);
  }

  async listEntries(
    userToken: string,
    page = 1,
    perPage = 20,
    query?: string,
    tags?: string[],
    status?: string,
  ): Promise<ListEntriesResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    if (query) params.append('q', query);
    if (tags?.length) {
      params.append('tags', tags.join(','));
    }
    if (status) params.append('status', status);
    return this.request<ListEntriesResponse>(`/api/v1/entries?${params}`, undefined, userToken);
  }

  async deleteEntry(slug: string, userToken: string): Promise<void> {
    await this.request<void>(`/api/v1/entries/${slug}`, {
      method: 'DELETE',
    }, userToken);
  }

  async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  }
}