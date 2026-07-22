import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntryStore } from '@/stores/entry'
import type { Entry } from '@/types'

vi.mock('@/api/client', () => ({
  api: {
    getEntry: vi.fn(),
    getFileContent: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import { api } from '@/api/client'

const mockEntry: Entry = {
  id: 1,
  slug: 'test-entry',
  summary: 'Test',
  tags: [],
  status: 'active',
  files: [{ id: 10, path: null, filename: 'main.py', language: 'python', isBinary: false, size: 100, lineCount: 10 }],
  fileCount: 1,
  isPublic: true,
  ownerId: 1,
  username: 'alice',
  expiresAt: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('T031 BDD-1: parallel loading', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loadEntry should call getEntry and getFileContent concurrently (not sequentially)', async () => {
    const callOrder: string[] = []
    let resolveEntry: (v: Entry) => void
    let resolveContent: (v: string) => void

    const entryPromise = new Promise<Entry>((r) => { resolveEntry = r })
    const contentPromise = new Promise<string>((r) => { resolveContent = r })

    vi.mocked(api.getEntry).mockImplementation(async () => {
      callOrder.push('getEntry:start')
      const result = await entryPromise
      callOrder.push('getEntry:end')
      return result
    })

    vi.mocked(api.getFileContent).mockImplementation(async () => {
      callOrder.push('getFileContent:start')
      const result = await contentPromise
      callOrder.push('getFileContent:end')
      return result
    })

    const store = useEntryStore()
    const loadPromise = store.loadEntry('test-entry')

    await vi.waitFor(() => {
      expect(callOrder).toContain('getEntry:start')
    })

    resolveEntry!(mockEntry)
    resolveContent!('# Hello')
    await loadPromise

    const getFileContentStartIdx = callOrder.indexOf('getFileContent:start')
    const getEntryEndIdx = callOrder.indexOf('getEntry:end')

    expect(getFileContentStartIdx).toBeGreaterThanOrEqual(0)
    expect(getFileContentStartIdx).toBeLessThan(getEntryEndIdx)
  })
})
