import { describe, it, expect } from 'vitest'
import { mergeQuery, parseRestoreQuery, type RestoredQuery } from '../searchUrl.logic'

type RestoredWithTags = RestoredQuery & { tags?: string[] }

describe('T076 searchUrl.logic — tags query support', () => {
  describe('BDD-11: URL ?tags=python parses to a tag filter', () => {
    it('parseRestoreQuery returns tags=["python"] for tags=python', () => {
      const result = parseRestoreQuery('tags=python') as RestoredWithTags
      expect(result.tags).toEqual(['python'])
    })

    it('defaults tags to empty array when no tags param', () => {
      const result = parseRestoreQuery('q=hello') as RestoredWithTags
      expect(result.tags).toEqual([])
    })
  })

  describe('BDD-13: multi-tag filter ?tags=python,cli', () => {
    it('parseRestoreQuery splits comma-separated tags into an array', () => {
      const result = parseRestoreQuery('tags=python,cli') as RestoredWithTags
      expect(result.tags).toEqual(['python', 'cli'])
    })
  })

  describe('BDD-14: tag filter combines with search q', () => {
    it('parseRestoreQuery returns both tags and q', () => {
      const result = parseRestoreQuery('tags=python&q=hello') as RestoredWithTags
      expect(result.tags).toEqual(['python'])
      expect(result.q).toBe('hello')
    })
  })

  describe('BDD-15: tag filter survives page refresh (URL round-trip)', () => {
    it('mergeQuery writes tags param and parseRestoreQuery restores it', () => {
      const merged = mergeQuery('', { tags: 'python' })
      expect(merged).toContain('tags=python')
      const result = parseRestoreQuery(merged) as RestoredWithTags
      expect(result.tags).toEqual(['python'])
    })

    it('mergeQuery removes tags param when value is undefined (chip dismiss)', () => {
      const merged = mergeQuery('tags=python&q=hello', { tags: undefined })
      expect(merged).not.toContain('tags=')
      expect(merged).toContain('q=hello')
    })
  })
})
