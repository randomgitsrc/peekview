/**
 * PeekView API HTTP Client
 */
import type {
  CreateEntryRequest,
  EntryResponse,
  ListEntriesResponse,
} from './types.js';

interface ClientConfig {
  peekviewUrl: string;
  apiKey: string;
}

export class PeekViewClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...((options.headers as Record<string, string>) || {}),
    };

    // 30s timeout to prevent hanging requests
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
        throw new Error(
          `PeekView API error ${response.status}: ${errorText || response.statusText}`
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      // Validate content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createEntry(request: CreateEntryRequest): Promise<EntryResponse> {
    return this.request<EntryResponse>('/api/v1/entries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getEntry(slug: string): Promise<EntryResponse> {
    return this.request<EntryResponse>(`/api/v1/entries/${slug}`);
  }

  async listEntries(
    page = 1,
    perPage = 20,
    query?: string,
    tags?: string[]
  ): Promise<ListEntriesResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    if (query) params.append('q', query);
    if (tags?.length) {
      params.append('tags', tags.join(',')); // Backend expects comma-separated
    }
    return this.request<ListEntriesResponse>(`/api/v1/entries?${params}`);
  }

  async deleteEntry(slug: string): Promise<void> {
    await this.request<void>(`/api/v1/entries/${slug}`, {
      method: 'DELETE',
    });
  }

  async ping(): Promise<boolean> {
    // Use /health endpoint for lightweight probe (no auth required)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}
