// frontend/src/api/client.ts

import type {
  EntryResponse,
  EntryListResponse,
  FileContentResponse,
} from '../types'
import { PeekApiError } from '../types'

const BASE_URL = '/api/v1'

function getApiKey(): string | null {
  const meta = document.querySelector('meta[name="peek-api-key"]')
  return meta?.getAttribute('content') || null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  const apiKey = getApiKey()
  if (apiKey) headers['X-API-Key'] = apiKey
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    let code = 'UNKNOWN'
    try {
      const body = await resp.json()
      if (body.error) {
        message = body.error.message || message
        code = body.error.code || code
      }
    } catch { /* not JSON */ }
    throw new PeekApiError(code, message, resp.status)
  }

  const text = await resp.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new PeekApiError('PARSE_ERROR', 'Invalid JSON', resp.status)
  }
}

export const api = {
  listEntries(params?: {
    q?: string
    tags?: string
    status?: string
    page?: number
    per_page?: number
  }): Promise<EntryListResponse> {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.tags) search.set('tags', params.tags)
    if (params?.status) search.set('status', params.status)
    if (params?.page) search.set('page', String(params.page))
    if (params?.per_page) search.set('per_page', String(params.per_page))
    return request(`/entries?${search.toString()}`)
  },

  getEntry(slug: string, options?: { include?: string }): Promise<EntryResponse> {
    const params = new URLSearchParams()
    if (options?.include) params.set('include', options.include)
    return request(`/entries/${slug}?${params.toString()}`)
  },

  fetchFileContent(slug: string, fileId: number): Promise<string> {
    return fetch(`${BASE_URL}/entries/${slug}/files/${fileId}/content`).then(r => r.text())
  },

  downloadFile(slug: string, fileId: number): string {
    return `${BASE_URL}/entries/${slug}/files/${fileId}/download`
  },
}
