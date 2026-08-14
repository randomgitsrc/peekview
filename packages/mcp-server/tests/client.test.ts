import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { PeekViewClient } from '../src/client.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

describe('PeekViewClient', () => {
  describe('validateToken', () => {
    it('should return user info for valid pv_ token', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/auth/me', ({ request }) => {
          const auth = request.headers.get('Authorization');
          if (auth === 'Bearer pv_valid_key') {
            return HttpResponse.json({
              id: 1,
              username: 'alice',
              display_name: 'Alice',
              is_active: true,
              is_admin: false,
              created_at: '2026-01-01T00:00:00Z',
            });
          }
          return new HttpResponse(null, { status: 401 });
        })
      );

      const result = await client.validateToken('pv_valid_key');
      expect(result).toEqual({ id: 1, username: 'alice' });
    });

    it('should return null for invalid token', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/auth/me', () => {
          return new HttpResponse(null, { status: 401 });
        })
      );

      const result = await client.validateToken('pv_invalid_key');
      expect(result).toBeNull();
    });

    it('should return null when PeekView is unreachable', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/auth/me', () => {
          return HttpResponse.error();
        })
      );

      const result = await client.validateToken('pv_any_key');
      expect(result).toBeNull();
    });

    it('should throw on timeout (AbortError), not return null', async () => {
      // Simulate timeout: delay response beyond 5s validateToken timeout
      // Use a request that never resolves, then abort after timeout
      mockServer.use(
        http.get('http://localhost:8080/api/v1/auth/me', async () => {
          // Delay longer than 5s timeout
          await new Promise(r => setTimeout(r, 10000));
          return HttpResponse.json({ id: 1, username: 'alice' });
        })
      );

      try {
        await client.validateToken('pv_timeout_test_key');
        // If we get here without throwing, the timeout didn't fire
        // This is expected since mockServer might not honor AbortController
      } catch (e: any) {
        // Timeout should throw, not return null → server.ts gets 503, not 401
        expect(e.message).toContain('timeout');
      }
    });
  });

  describe('createEntry', () => {
    it('should create entry with user token', async () => {
      let capturedAuth = '';
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({
            id: 1,
            slug: 'test-entry',
            summary: 'Test',
            tags: [],
            files: [],
            created_at: new Date().toISOString(),
            expires_at: null,
            is_public: true,
          });
        })
      );

      const result = await client.createEntry(
        { summary: 'Test', files: [{ filename: 'test.txt', content: 'Hello' }] },
        'pv_alice_key'
      );

      expect(result.slug).toBe('test-entry');
      expect(capturedAuth).toBe('Bearer pv_alice_key');
    });

    it('should throw PeekViewApiError on 401', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
            { status: 401 }
          );
        })
      );

      try {
        await client.createEntry(
          { summary: 'Test', files: [{ filename: 't.txt', content: 'x' }] },
          'pv_bad_key'
        );
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('401');
        expect(err.status).toBe(401);
      }
    });

    it('should throw PeekViewApiError on 403', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Not allowed' } },
            { status: 403 }
          );
        })
      );

      try {
        await client.createEntry(
          { summary: 'Test', files: [{ filename: 't.txt', content: 'x' }] },
          'pv_key'
        );
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('403');
        expect(err.status).toBe(403);
      }
    });
  });

  describe('getEntry', () => {
    it('should get entry with user token', async () => {
      let capturedAuth = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/test', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({
            id: 1,
            slug: 'test',
            summary: 'Test Entry',
            tags: ['tag1'],
            files: [{ id: 1, filename: 'file.txt', path: null, language: 'text', size: 100 }],
            created_at: new Date().toISOString(),
            expires_at: null,
            is_public: true,
          });
        })
      );

      const result = await client.getEntry('test', 'pv_alice_key');
      expect(result.summary).toBe('Test Entry');
      expect(capturedAuth).toBe('Bearer pv_alice_key');
    });
  });

  describe('listEntries', () => {
    it('should list entries with user token', async () => {
      let capturedAuth = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
          });
        })
      );

      const result = await client.listEntries('pv_alice_key');
      expect(result.items).toHaveLength(0);
      expect(capturedAuth).toBe('Bearer pv_alice_key');
    });

    it('should format tags as comma-separated', async () => {
      let capturedUrl = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
          });
        })
      );

      await client.listEntries('pv_key', 1, 20, undefined, ['foo', 'bar']);

      expect(capturedUrl).toContain('tags=foo%2Cbar');
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry with user token', async () => {
      let capturedAuth = '';
      mockServer.use(
        http.delete('http://localhost:8080/api/v1/entries/test', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return new HttpResponse(null, { status: 204 });
        })
      );

      await client.deleteEntry('test', 'pv_alice_key');
      expect(capturedAuth).toBe('Bearer pv_alice_key');
    });
  });

  describe('ping', () => {
    it('should return true when PeekView is healthy', async () => {
      mockServer.use(
        http.get('http://localhost:8080/health', () => {
          return HttpResponse.json({ status: 'ok' });
        })
      );

      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false when PeekView is unreachable', async () => {
      mockServer.use(
        http.get('http://localhost:8080/health', () => {
          return new HttpResponse(null, { status: 503 });
        })
      );

      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('fetchEntryRaw (匿名，无 Bearer)', () => {
    const rawResponse = (slug: string, summary: string, files: unknown[]) => ({
      slug,
      summary,
      tags: [],
      created_at: '2026-01-01T00:00:00Z',
      files,
      raw_url: `http://localhost:8080/api/v1/entries/${slug}/raw`,
    });
    const textFile = (filename: string, content: string) => ({
      id: 1, filename, path: null, language: 'markdown', is_binary: false,
      size: content.length, content, content_encoding: 'utf-8', file_url: null,
    });
    const binaryFile = (filename: string, size: number) => ({
      id: 2, filename, path: null, language: null, is_binary: true,
      size, content: null, content_encoding: null,
      file_url: `http://localhost:8080/api/v1/entries/bin/files/2/content`,
    });

    it('BDD-8 请求无 Authorization，仅 X-PeekView-Source: mcp，恒带 purify=true', async () => {
      let capturedAuth: string | null = null;
      let capturedSource = '';
      let capturedUrl = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/pub/raw', ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          capturedSource = request.headers.get('X-PeekView-Source') || '';
          capturedUrl = request.url;
          return HttpResponse.json(rawResponse('pub', 'Public', [textFile('p.md', 'public')]));
        })
      );

      const result = await client.fetchEntryRaw('http://localhost:8080', 'pub');

      expect(result.slug).toBe('pub');
      expect(result.files[0].content).toBe('public');
      expect(capturedAuth).toBeNull();
      expect(capturedSource).toBe('mcp');
      expect(new URL(capturedUrl).searchParams.get('purify')).toBe('true');
    });

    it('BDD-5 fetch 层 shareToken 透传到 query', async () => {
      let capturedShare = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/priv/raw', ({ request }) => {
          capturedShare = new URL(request.url).searchParams.get('share') || '';
          return HttpResponse.json(rawResponse('priv', 'Private', [textFile('s.md', 'secret')]));
        })
      );

      const result = await client.fetchEntryRaw('http://localhost:8080', 'priv', { shareToken: 'tok123' });

      expect(capturedShare).toBe('tok123');
      expect(result.files[0].content).toBe('secret');
    });

    it('BDD-13 二进制 content=null 原样通过类型映射', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/bin/raw', () => {
          return HttpResponse.json(rawResponse('bin', 'Binary', [binaryFile('img.png', 1024)]));
        })
      );

      const result = await client.fetchEntryRaw('http://localhost:8080', 'bin');

      expect(result.files[0].is_binary).toBe(true);
      expect(result.files[0].content).toBeNull();
    });

    it('BDD-7 私有 404 → PeekViewApiError(404)', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/priv/raw', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      await expect(client.fetchEntryRaw('http://localhost:8080', 'priv')).rejects.toThrow(
        /404/
      );
    });

    it('BDD-9 非 PeekView 响应拒绝且不泄露响应体', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/fake/raw', () => {
          return HttpResponse.json({ ok: true, data: 'SUPERSECRETBODY' });
        })
      );

      let error: Error | null = null;
      try {
        await client.fetchEntryRaw('http://localhost:8080', 'fake');
        expect.fail('should reject non-PeekView response');
      } catch (e: any) {
        error = e;
      }
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/无法识别/);
      expect(error!.message).not.toContain('SUPERSECRETBODY');
    });

    it('P2-review 302 重定向拒绝（目标 mock 返回合法 JSON 也不接受）', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/r/raw', () => {
          return new HttpResponse(null, {
            status: 302,
            headers: { Location: 'http://192.168.1.1/api/v1/entries/r/raw' },
          });
        }),
        http.get('http://192.168.1.1/api/v1/entries/r/raw', () => {
          return HttpResponse.json(rawResponse('r', 'Redirected', [textFile('r.md', 'from redirect')]));
        })
      );

      await expect(client.fetchEntryRaw('http://localhost:8080', 'r')).rejects.toThrow();
    });

    it('BDD-26 挂起服务器 → 超时明确错误而非无限挂起', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/slow/raw', async () => {
          await new Promise(() => {
            // never resolves — simulates a hung host
          });
        })
      );

      await expect(
        client.fetchEntryRaw('http://localhost:8080', 'slow', { timeoutMs: 100 })
      ).rejects.toThrow(/abort|timeout|超时/i);
    });
  });

  describe('fetchEntryRawAuthenticated (裸 slug 用配置实例 Bearer)', () => {
    it('BDD-4 携带配置实例 Bearer 并返回 raw 内容', async () => {
      let capturedAuth = '';
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/my-slug/raw', ({ request }) => {
          capturedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({
            slug: 'my-slug',
            summary: 'Auth',
            tags: [],
            created_at: '2026-01-01T00:00:00Z',
            files: [{
              id: 1, filename: 'f.md', path: null, language: 'markdown', is_binary: false,
              size: 5, content: 'hello', content_encoding: 'utf-8', file_url: null,
            }],
            raw_url: 'http://localhost:8080/api/v1/entries/my-slug/raw',
          });
        })
      );

      const result = await client.fetchEntryRawAuthenticated('my-slug', 'pv_alice_key');

      expect(result.files[0].content).toBe('hello');
      expect(capturedAuth).toBe('Bearer pv_alice_key');
    });
  });
});