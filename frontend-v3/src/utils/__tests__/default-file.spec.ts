import { describe, it, expect } from 'vitest'
import { normalizeFileQuery, resolveDefaultFile } from '@/utils/default-file'
import type { File } from '@/types'

function file(id: number, filename: string, path: string | null = null): File {
  return { id, path, filename, language: 'markdown', isBinary: false, size: 10, lineCount: 1 }
}

describe('normalizeFileQuery', () => {
  it('default file drops the file key and keeps other params', () => {
    const got = normalizeFileQuery({ share: 'TOK', file: '42' }, 42, 42)
    expect('file' in got).toBe(false)
    expect(got.share).toBe('TOK')
  })

  it('non-default file writes file as a string and keeps share', () => {
    const got = normalizeFileQuery({ share: 'TOK' }, 99, 42)
    expect(got.file).toBe('99')
    expect(got.share).toBe('TOK')
  })

  it('null active file drops the file key', () => {
    const got = normalizeFileQuery({ file: '99' }, null, 42)
    expect('file' in got).toBe(false)
  })

  it('does not mutate the input query', () => {
    const input = { file: '99' }
    normalizeFileQuery(input, null, 42)
    expect(input.file).toBe('99')
  })
})

describe('resolveDefaultFile', () => {
  it('returns null for an empty list', () => {
    expect(resolveDefaultFile([])).toBeNull()
  })

  it('prefers root README over a lexicographically earlier file', () => {
    const got = resolveDefaultFile([file(1, 'AAA.txt'), file(2, 'README.md')])
    expect(got?.id).toBe(2)
  })

  it('ignores a subdirectory README', () => {
    const got = resolveDefaultFile([file(1, 'README.md', 'sub/README.md'), file(2, 'aaa.md')])
    expect(got?.id).toBe(2)
  })

  it('breaks ties on id when sort keys are equal', () => {
    const got = resolveDefaultFile([file(7, 'dup.md'), file(3, 'dup.md')])
    expect(got?.id).toBe(3)
  })
})
