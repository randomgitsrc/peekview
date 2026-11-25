import type { LocationQuery } from 'vue-router'
import type { File } from '@/types'

function effectivePath(file: File): string {
  return file.path ? file.path : file.filename
}

function basenameOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

function sortKey(file: File): string {
  return effectivePath(file)
}

function rootBasenameLower(file: File): string | null {
  const path = effectivePath(file)
  if (path.includes('/')) return null
  return basenameOf(path).toLowerCase()
}

export function resolveDefaultFile(files: File[]): File | null {
  if (files.length === 0) return null

  const sorted = [...files].sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return a.id - b.id
  })

  const readme = sorted.find(file => rootBasenameLower(file) === 'readme.md')
  if (readme) return readme

  const index = sorted.find(file => rootBasenameLower(file) === 'index.md')
  if (index) return index

  return sorted[0]
}

export function normalizeFileQuery(
  query: LocationQuery,
  activeFileId: number | null,
  defaultFileId: number | null,
): LocationQuery {
  const next: LocationQuery = { ...query }
  delete next.file
  if (activeFileId !== null && activeFileId !== defaultFileId) {
    next.file = String(activeFileId)
  }
  return next
}
