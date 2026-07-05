export type PathMapEntry = { fileId: number; priority: number }
export type PathMap = Map<string, PathMapEntry>

interface PathMapFile {
  id: number
  path: string | null
  filename: string
}

export function normalizeRef(ref: string): string | null {
  if (!ref) return null
  ref = ref.trim()
  if (!ref) return null
  if (/^(https?:\/\/|data:|blob:|mailto:|tel:|ftp:|\/\/|#)/.test(ref)) return null
  if (ref.startsWith('/api/v1/entries/')) return null
  if (ref.startsWith('/')) {
    const basename = ref.split('/').pop()
    return basename || null
  }
  while (ref.startsWith('./')) ref = ref.slice(2)
  if (!ref) return null
  return ref
}

export function buildPathMap(files: PathMapFile[], _slug?: string): PathMap {
  const map = new Map<string, PathMapEntry>()
  const basenameConflicts = new Set<string>()

  for (const file of files) {
    const entries: Array<{ key: string; priority: number }> = []
    let suppressFilenameKey: string | null = null

    if (file.path) {
      const normalized = normalizeRef(file.path)
      if (normalized) {
        const isExact = normalized === file.path.replace(/^\.\/+/, '')
        if (isExact) {
          entries.push({ key: normalized, priority: 1 })
          const basename = normalized.split('/').pop()
          if (basename && basename !== normalized) {
            entries.push({ key: basename, priority: 3 })
            suppressFilenameKey = basename
          }
        } else {
          entries.push({ key: normalized, priority: 3 })
        }
      }
    }

    const byFilename = normalizeRef(file.filename)
    if (byFilename && byFilename !== suppressFilenameKey) {
      entries.push({ key: byFilename, priority: 2 })
    }

    for (const { key, priority } of entries) {
      if (map.has(key)) {
        const existing = map.get(key)!
        if (priority < existing.priority) {
          map.set(key, { fileId: file.id, priority })
        } else if (priority === existing.priority) {
          basenameConflicts.add(key)
        }
      } else {
        map.set(key, { fileId: file.id, priority })
      }
    }
  }

  for (const key of basenameConflicts) {
    console.warn(`[path-map] Ambiguous basename "${key}" maps to multiple files; removing from pathMap`)
    map.delete(key)
  }

  return map
}

export function resolvePath(ref: string, pathMap: PathMap): number | null {
  const normalized = normalizeRef(ref)
  if (!normalized) return null

  if (pathMap.has(normalized)) return pathMap.get(normalized)!.fileId

  const basename = normalized.split('/').pop()
  if (basename && basename !== normalized && pathMap.has(basename)) {
    return pathMap.get(basename)!.fileId
  }

  return null
}
