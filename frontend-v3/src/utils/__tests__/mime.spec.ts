import { describe, it, expect } from 'vitest'
import { guessMimeType } from '../mime'

describe('guessMimeType', () => {
  it('returns correct MIME for common image extensions', () => {
    expect(guessMimeType('photo.png')).toBe('image/png')
    expect(guessMimeType('photo.jpg')).toBe('image/jpeg')
    expect(guessMimeType('photo.jpeg')).toBe('image/jpeg')
    expect(guessMimeType('photo.gif')).toBe('image/gif')
    expect(guessMimeType('photo.webp')).toBe('image/webp')
    expect(guessMimeType('photo.bmp')).toBe('image/bmp')
  })

  it('returns correct MIME for icon files', () => {
    expect(guessMimeType('favicon.ico')).toBe('image/x-icon')
  })

  it('returns correct MIME for font files', () => {
    expect(guessMimeType('font.woff')).toBe('font/woff')
    expect(guessMimeType('font.woff2')).toBe('font/woff2')
    expect(guessMimeType('font.ttf')).toBe('font/ttf')
    expect(guessMimeType('font.otf')).toBe('font/otf')
  })

  it('returns null for unknown extensions', () => {
    expect(guessMimeType('data.json')).toBeNull()
    expect(guessMimeType('script.py')).toBeNull()
    expect(guessMimeType('file.xyz')).toBeNull()
  })

  it('returns null for files without extension', () => {
    expect(guessMimeType('Makefile')).toBeNull()
    expect(guessMimeType('README')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(guessMimeType('photo.PNG')).toBe('image/png')
    expect(guessMimeType('photo.Jpg')).toBe('image/jpeg')
    expect(guessMimeType('FONT.WOFF2')).toBe('font/woff2')
  })

  it('handles paths with directories', () => {
    expect(guessMimeType('/assets/img/logo.png')).toBe('image/png')
    expect(guessMimeType('src/fonts/inter.woff2')).toBe('font/woff2')
  })

  it('returns image/svg+xml for svg (supported)', () => {
    expect(guessMimeType('icon.svg')).toBe('image/svg+xml')
  })
})