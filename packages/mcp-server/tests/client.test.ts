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
});