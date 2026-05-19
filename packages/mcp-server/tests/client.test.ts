import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({
  peekviewUrl: 'http://localhost:8080',
  apiKey: 'pv_test_key',
});

describe('PeekViewClient', () => {
  describe('createEntry', () => {
    it('should create entry', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', async () => {
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

      const result = await client.createEntry({
        summary: 'Test',
        files: [{ filename: 'test.txt', content: 'Hello' }],
      });

      expect(result.slug).toBe('test-entry');
    });
  });

  describe('getEntry', () => {
    it('should get entry', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/test', () => {
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

      const result = await client.getEntry('test');
      expect(result.summary).toBe('Test Entry');
      expect(result.files).toHaveLength(1);
    });
  });

  describe('listEntries', () => {
    it('should list entries', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
          });
        })
      );

      const result = await client.listEntries();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
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

      await client.listEntries(1, 20, undefined, ['foo', 'bar']);

      expect(capturedUrl).toContain('tags=foo%2Cbar');
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry', async () => {
      mockServer.use(
        http.delete('http://localhost:8080/api/v1/entries/test', () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(client.deleteEntry('test')).resolves.toBeUndefined();
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

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', () => {
          return new HttpResponse('Invalid request', { status: 400 });
        })
      );

      await expect(
        client.createEntry({ summary: 'Test', files: [] })
      ).rejects.toThrow('PeekView API error 400');
    });

    it('should throw on non-JSON response', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/test', () => {
          return new HttpResponse('not json', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
      );

      await expect(client.getEntry('test')).rejects.toThrow('Expected JSON response');
    });
  });
});
