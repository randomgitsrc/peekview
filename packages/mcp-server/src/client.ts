/**
 * PeekView API HTTP Client - user token passthrough
 */
import { PeekViewApiError } from './types.js';
import type {
  CreateEntryRequest,
  EntryRawResponse,
  EntryResponse,
  ListEntriesResponse,
} from './types.js';

interface ClientConfig {
  peekviewUrl: string;
}

const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_ERROR_BYTES = 1024 * 1024;

export class PeekViewClient {
  private baseUrl: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.peekviewUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
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
        let errorText: string;
        try {
          errorText = await this.readTextWithLimit(response, controller, MAX_ERROR_BYTES, 'error response');
        } catch {
          errorText = response.statusText;
        }
        throw new PeekViewApiError(response.status, errorText || response.statusText);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new PeekViewApiError(response.status, `Expected JSON response, got ${contentType}`);
      }

      return this.readJsonWithLimit(response, controller, MAX_RESPONSE_BYTES, 'response') as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readTextWithLimit(
    response: Response,
    controller: AbortController,
    maxBytes: number,
    context: string,
  ): Promise<string> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      controller.abort();
      throw new PeekViewApiError(response.status, `响应体过大（${context}）`);
    }

    if (!response.body) {
      return await response.text();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          controller.abort();
          throw new PeekViewApiError(response.status, `响应体过大（${context}）`);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(buffer);
  }

  private async readJsonWithLimit(
    response: Response,
    controller: AbortController,
    maxBytes: number,
    context: string,
  ): Promise<unknown> {
    return JSON.parse(await this.readTextWithLimit(response, controller, maxBytes, context));
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

  async fetchEntryRaw(
    host: string,
    slug: string,
    opts?: { shareToken?: string; timeoutMs?: number },
  ): Promise<EntryRawResponse> {
    const base = host.replace(/\/$/, '');
    const params = new URLSearchParams({ purify: 'true' });
    if (opts?.shareToken) params.set('share', opts.shareToken);
    const url = `${base}/api/v1/entries/${encodeURIComponent(slug)}/raw?${params}`;

    const controller = new AbortController();
    const timeoutMs = opts?.timeoutMs ?? 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { 'X-PeekView-Source': 'mcp' },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PeekViewApiError(response.status, response.statusText);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`无法识别为 PeekView entry（host=${base}, slug=${slug}）`);
      }

      const data = await this.readJsonWithLimit(
        response,
        controller,
        MAX_RESPONSE_BYTES,
        `host=${base}, slug=${slug}`,
      );
      this.assertRawResponse(data, base, slug);
      return data as EntryRawResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchEntryRawAuthenticated(slug: string, userToken: string): Promise<EntryRawResponse> {
    return this.request<EntryRawResponse>(
      `/api/v1/entries/${encodeURIComponent(slug)}/raw?purify=true`,
      { redirect: 'manual' },
      userToken,
    );
  }

  private assertRawResponse(data: unknown, host: string, slug: string): void {
    const obj = data as Record<string, unknown> | null;
    if (
      !obj ||
      typeof obj !== 'object' ||
      typeof obj.slug !== 'string' ||
      typeof obj.summary !== 'string' ||
      !Array.isArray(obj.files) ||
      obj.files.length === 0
    ) {
      throw new Error(`无法识别为 PeekView entry（host=${host}, slug=${slug}）`);
    }
  }
}