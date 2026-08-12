import { describe, it, expect } from 'vitest'
import { buildPathMap, normalizeRef, resolvePath } from './path-map'
import type { PathMap } from './path-map'

describe('buildPathMap', () => {
  it('TC-BPM-01: single file with path → exact path match (priority=1)', () => {
    const files = [{ id: 3, path: 'images/arch.png', filename: 'arch.png' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('images/arch.png')).toEqual({ fileId: 3, priority: 1 })
  })

  it('TC-BPM-02: filename match (priority=2)', () => {
    const files = [{ id: 5, path: null, filename: 'photo.png' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('photo.png')).toEqual({ fileId: 5, priority: 2 })
  })

  it('TC-BPM-03: basename match from path (priority=3)', () => {
    const files = [{ id: 7, path: '/tmp/screenshot.png', filename: 'screenshot.png' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('screenshot.png')).toEqual({ fileId: 7, priority: 2 })
  })

  it('TC-BPM-04: same-name conflict at same priority → key removed from map', () => {
    const files = [
      { id: 1, path: 'src/utils.py', filename: 'utils.py' },
      { id: 2, path: 'test/utils.py', filename: 'utils.py' },
    ]
    const map = buildPathMap(files, 'test-entry')
    expect(map.has('utils.py')).toBe(false)
    expect(map.get('src/utils.py')).toEqual({ fileId: 1, priority: 1 })
    expect(map.get('test/utils.py')).toEqual({ fileId: 2, priority: 1 })
  })

  it('TC-BPM-05: lower priority (1) wins over higher priority (2) for same key', () => {
    const files = [
      { id: 10, path: null, filename: 'logo.svg' },
      { id: 11, path: 'assets/logo.svg', filename: 'logo.svg' },
    ]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('assets/logo.svg')).toEqual({ fileId: 11, priority: 1 })
    expect(map.get('logo.svg')!.fileId).toBe(10)
    expect(map.get('logo.svg')!.priority).toBe(2)
  })

  it('TC-BPM-06: ./ prefix stripped from path', () => {
    const files = [{ id: 3, path: './images/logo.png', filename: 'logo.png' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('images/logo.png')).toEqual({ fileId: 3, priority: 1 })
    expect(map.has('./images/logo.png')).toBe(false)
  })

  it('TC-BPM-07: empty file list → empty Map', () => {
    const map = buildPathMap([], 'test-entry')
    expect(map.size).toBe(0)
  })

  it('TC-BPM-08: external URL path not entered into map', () => {
    const files = [
      { id: 1, path: 'https://cdn.example.com/img.png', filename: 'img.png' },
      { id: 2, path: 'http://example.com/file.md', filename: 'file.md' },
      { id: 3, path: 'ftp://files.example.com/data.csv', filename: 'data.csv' },
    ]
    const map = buildPathMap(files, 'test-entry')
    expect(map.has('https://cdn.example.com/img.png')).toBe(false)
    expect(map.has('http://example.com/file.md')).toBe(false)
    expect(map.has('ftp://files.example.com/data.csv')).toBe(false)
    expect(map.get('img.png')).toEqual({ fileId: 1, priority: 2 })
    expect(map.get('file.md')).toEqual({ fileId: 2, priority: 2 })
  })

  it('TC-BPM-09: file with null path uses filename only', () => {
    const files = [{ id: 5, path: null, filename: 'README.md' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.get('README.md')).toEqual({ fileId: 5, priority: 2 })
    expect(map.size).toBe(1)
  })

  it('TC-BPM-10: absolute path extracts basename as key', () => {
    const files = [{ id: 7, path: '/tmp/screenshot.png', filename: 'screenshot.png' }]
    const map = buildPathMap(files, 'test-entry')
    expect(map.has('/tmp/screenshot.png')).toBe(false)
    expect(map.get('screenshot.png')).toBeDefined()
  })
})

describe('normalizeRef', () => {
  it('TC-NR-01: absolute path /api/v1/entries/... → returns null (skip)', () => {
    expect(normalizeRef('/api/v1/entries/abc/files/3/content')).toBeNull()
  })

  it('TC-NR-02: external URL https://... → null', () => {
    expect(normalizeRef('https://cdn.example.com/img.png')).toBeNull()
  })

  it('TC-NR-03: external URL http://... → null', () => {
    expect(normalizeRef('http://example.com/file.md')).toBeNull()
  })

  it('TC-NR-04: data URI → null', () => {
    expect(normalizeRef('data:image/png;base64,iVBOR...')).toBeNull()
  })

  it('TC-NR-05: blob URI → null', () => {
    expect(normalizeRef('blob:https://example.com/uuid')).toBeNull()
  })

  it('TC-NR-06: anchor # → null', () => {
    expect(normalizeRef('#intro')).toBeNull()
  })

  it('TC-NR-07: mailto: → null', () => {
    expect(normalizeRef('mailto:user@example.com')).toBeNull()
  })

  it('TC-NR-08: tel: → null', () => {
    expect(normalizeRef('tel:+1234567890')).toBeNull()
  })

  it('TC-NR-09: protocol-relative URL // → null', () => {
    expect(normalizeRef('//cdn.example.com/script.js')).toBeNull()
  })

  it('TC-NR-10: relative path ./images/logo.png → images/logo.png', () => {
    expect(normalizeRef('./images/logo.png')).toBe('images/logo.png')
  })

  it('TC-NR-11: relative path images/logo.png → images/logo.png (unchanged)', () => {
    expect(normalizeRef('images/logo.png')).toBe('images/logo.png')
  })

  it('TC-NR-12: ../parent/file.md → ../parent/file.md (unchanged)', () => {
    expect(normalizeRef('../parent/file.md')).toBe('../parent/file.md')
  })

  it('TC-NR-13: multiple ./ prefixes stripped', () => {
    expect(normalizeRef('./././images/logo.png')).toBe('images/logo.png')
  })

  it('TC-NR-14: absolute path /tmp/screenshot.png → basename screenshot.png', () => {
    expect(normalizeRef('/tmp/screenshot.png')).toBe('screenshot.png')
  })

  it('TC-NR-15: empty string → null', () => {
    expect(normalizeRef('')).toBeNull()
  })

  it('TC-NR-16: whitespace-only string → null', () => {
    expect(normalizeRef('   ')).toBeNull()
  })

  it('TC-NR-17: string with surrounding whitespace → trimmed', () => {
    expect(normalizeRef('  images/logo.png  ')).toBe('images/logo.png')
  })

  it('TC-NR-18: ./ only → null', () => {
    expect(normalizeRef('./')).toBeNull()
  })
})

describe('resolvePath', () => {
  const pathMap: PathMap = new Map([
    ['images/arch.png', { fileId: 3, priority: 1 }],
    ['arch.png', { fileId: 3, priority: 2 }],
    ['main.py', { fileId: 10, priority: 2 }],
    ['GUIDE.md', { fileId: 20, priority: 2 }],
  ])

  it('TC-RP-01: exact path match → returns fileId', () => {
    expect(resolvePath('images/arch.png', pathMap)).toBe(3)
  })

  it('TC-RP-02: filename/basename match → returns fileId', () => {
    expect(resolvePath('main.py', pathMap)).toBe(10)
  })

  it('TC-RP-03: ref not in map → null', () => {
    expect(resolvePath('nonexistent.file', pathMap)).toBeNull()
  })

  it('TC-RP-04: priority — exact path match preferred over basename', () => {
    const localMap: PathMap = new Map([
      ['images/arch.png', { fileId: 3, priority: 1 }],
      ['arch.png', { fileId: 99, priority: 3 }],
    ])
    expect(resolvePath('images/arch.png', localMap)).toBe(3)
    expect(resolvePath('arch.png', localMap)).toBe(99)
  })

  it('TC-RP-05: external URL → null (normalizeRef returns null)', () => {
    expect(resolvePath('https://cdn.example.com/img.png', pathMap)).toBeNull()
  })

  it('TC-RP-06: anchor → null', () => {
    expect(resolvePath('#intro', pathMap)).toBeNull()
  })

  it('TC-RP-07: ./ prefix stripped before lookup', () => {
    expect(resolvePath('./main.py', pathMap)).toBe(10)
  })

  it('TC-RP-08: empty pathMap → null', () => {
    expect(resolvePath('main.py', new Map())).toBeNull()
  })

  it('TC-RP-09: basename fallback when full path not in map', () => {
    const localMap: PathMap = new Map([
      ['arch.png', { fileId: 3, priority: 2 }],
    ])
    expect(resolvePath('some/deep/path/arch.png', localMap)).toBe(3)
  })

  it('TC-RP-10: no basename fallback when basename also not in map', () => {
    expect(resolvePath('some/deep/path/missing.png', pathMap)).toBeNull()
  })
})
