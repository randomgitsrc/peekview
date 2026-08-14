import { describe, it, expect } from 'vitest';
import { parseEntryRef, EntryRefError } from '../src/lib/entryRef.js';

const config = { peekviewUrl: 'http://localhost:8080' };

describe('parseEntryRef', () => {
  describe('BDD-1 页面链接', () => {
    it('应解析页面链接并提取 slug', () => {
      const parsed = parseEntryRef('https://host/my-slug', config);
      expect(parsed).toMatchObject({ kind: 'url', host: 'https://host', slug: 'my-slug' });
    });
  });

  describe('BDD-2 raw 长链接', () => {
    it('应剥离 /api/v1/entries/{slug}/raw 前缀', () => {
      const parsed = parseEntryRef('https://host/api/v1/entries/my-slug/raw', config);
      expect(parsed).toMatchObject({ kind: 'url', host: 'https://host', slug: 'my-slug' });
    });
  });

  describe('BDD-3 raw 短链接', () => {
    it('应从短链接提取 slug（不经 302）', () => {
      const parsed = parseEntryRef('https://host/my-slug/raw', config);
      expect(parsed).toMatchObject({ kind: 'url', host: 'https://host', slug: 'my-slug' });
    });
  });

  describe('BDD-4 裸 slug', () => {
    it('应解析为 slug 形态并用配置实例 host', () => {
      const parsed = parseEntryRef('my-slug', config);
      expect(parsed).toEqual({ kind: 'slug', host: config.peekviewUrl, slug: 'my-slug' });
    });
  });

  describe('BDD-5 分享链接', () => {
    it('应提取 shareToken', () => {
      const parsed = parseEntryRef('https://host/my-slug?share=abc123', config);
      expect(parsed).toMatchObject({ kind: 'url', host: 'https://host', slug: 'my-slug' });
      expect(parsed.shareToken).toBe('abc123');
    });

    it('raw 长链接带 share 也应提取', () => {
      const parsed = parseEntryRef('https://host/api/v1/entries/my-slug/raw?share=tokenX', config);
      expect(parsed.shareToken).toBe('tokenX');
    });
  });

  describe('BDD-10 非白名单协议', () => {
    it('ftp:// 请求前拒绝', () => {
      expect(() => parseEntryRef('ftp://host/my-slug', config)).toThrow(EntryRefError);
    });

    it('file:// 请求前拒绝', () => {
      expect(() => parseEntryRef('file:///etc/passwd', config)).toThrow(EntryRefError);
    });
  });

  describe('BDD-11 http 非 localhost', () => {
    it('http:// 非 localhost 请求前拒绝', () => {
      expect(() => parseEntryRef('http://evil.example.com/my-slug', config)).toThrow(EntryRefError);
    });
  });

  describe('P2-review 白名单正向', () => {
    it('http://localhost 放行', () => {
      const parsed = parseEntryRef('http://localhost/my-slug', config);
      expect(parsed).toMatchObject({ kind: 'url', host: 'http://localhost', slug: 'my-slug' });
    });

    it('http://127.0.0.1 放行', () => {
      const parsed = parseEntryRef('http://127.0.0.1:8080/my-slug', config);
      expect(parsed).toMatchObject({ kind: 'url', slug: 'my-slug' });
    });

    it('https:// 任意 host 放行', () => {
      const parsed = parseEntryRef('https://anything.example.org/api/v1/entries/x/raw', config);
      expect(parsed.kind).toBe('url');
    });
  });

  describe('P2-review 无法识别路径', () => {
    it('多段非 raw 路径拒绝', () => {
      expect(() => parseEntryRef('https://host/a/b/c', config)).toThrow(EntryRefError);
    });

    it('路径穿越字符拒绝', () => {
      expect(() => parseEntryRef('https://host/../evil', config)).toThrow(EntryRefError);
    });

    it('空白输入拒绝', () => {
      expect(() => parseEntryRef('   ', config)).toThrow(EntryRefError);
    });
  });
});
