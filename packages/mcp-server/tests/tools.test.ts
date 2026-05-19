import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';
import { createEntryTool } from '../src/tools/createEntry.js';
import { getEntryTool } from '../src/tools/getEntry.js';
import { listEntriesTool } from '../src/tools/listEntries.js';
import { deleteEntryTool } from '../src/tools/deleteEntry.js';
import type { ServerConfig } from '../src/types.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const testConfig: ServerConfig = {
  peekviewUrl: 'http://localhost:8080',
  publicUrl: 'https://peek.example.com',
  apiKey: 'pv_test_key',
  mcpToken: 'mct_test',
  port: 3000,
  host: '0.0.0.0',
  corsOrigins: ['*'],
  logLevel: 'info',
};

const client = new PeekViewClient({
  peekviewUrl: testConfig.peekviewUrl,
  apiKey: testConfig.apiKey,
});

describe('Tools', () => {
  describe('create_entry', () => {
    it('should create entry and return publicUrl', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', async () => {
          return HttpResponse.json({
            id: 1,
            slug: 'test-entry',
            summary: 'Test Summary',
            tags: [],
            files: [{ id: 1, filename: 'test.txt', path: null, language: 'text', size: 100 }],
            created_at: '2026-01-01T00:00:00Z',
            expires_at: null,
            is_public: true,
          });
        })
      );

      const tool = createEntryTool(client, testConfig);
      const result = await tool.handler({
        summary: 'Test Summary',
        files: [{ filename: 'test.txt', content: 'Hello' }],
      });

      // Verify returned URL uses publicUrl, not peekviewUrl
      expect(result.content[0].text).toContain('https://peek.example.com/test-entry');
      expect(result.content[0].text).not.toContain('http://localhost:8080');
    });

    it('should pass is_public to backend', async () => {
      let requestBody: unknown;
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            id: 1,
            slug: 'test-entry',
            summary: 'Test',
            tags: [],
            files: [],
            created_at: '2026-01-01T00:00:00Z',
            expires_at: null,
            is_public: false,
          });
        })
      );

      const tool = createEntryTool(client, testConfig);
      await tool.handler({
        summary: 'Test',
        files: [{ filename: 'test.txt', content: 'Hello' }],
        is_public: false,
      });

      expect(requestBody).toMatchObject({ is_public: false });
    });
  });

  describe('get_entry', () => {
    it('should get entry details', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/test', () => {
          return HttpResponse.json({
            id: 1,
            slug: 'test',
            summary: 'Test Entry',
            tags: ['tag1', 'tag2'],
            files: [
              { id: 1, filename: 'file1.txt', path: null, language: 'text', size: 100 },
              { id: 2, filename: 'file2.py', path: 'src', language: 'python', size: 200 },
            ],
            created_at: '2026-01-01T00:00:00Z',
            expires_at: null,
            is_public: true,
          });
        })
      );

      const tool = getEntryTool(client);
      const result = await tool.handler({ slug: 'test' });

      expect(result.content[0].text).toContain('Test Entry');
      expect(result.content[0].text).toContain('Files (2):');
      expect(result.content[0].text).toContain('tag1');
    });
  });

  describe('list_entries', () => {
    it('should list entries', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json({
            items: [
              { id: 1, slug: 'entry1', summary: 'Entry 1', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true },
              { id: 2, slug: 'entry2', summary: 'Entry 2', tags: ['tag1'], files: [], created_at: '2026-01-02T00:00:00Z', expires_at: null, is_public: false },
            ],
            total: 2,
            page: 1,
            per_page: 20,
          });
        })
      );

      const tool = listEntriesTool(client);
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('Found 2 entries');
      expect(result.content[0].text).toContain('Entry 1');
      expect(result.content[0].text).toContain('Entry 2');
    });

    it('should handle empty results', async () => {
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

      const tool = listEntriesTool(client);
      const result = await tool.handler({});

      expect(result.content[0].text).toBe('No entries found.');
    });
  });

  describe('delete_entry', () => {
    it('should require confirm before deleting', async () => {
      const tool = deleteEntryTool(client);
      const result = await tool.handler({
        slug: 'test-entry',
      });

      // Should return confirmation prompt, not delete
      expect(result.content[0].text).toContain('About to delete');
      expect(result.content[0].text).toContain('"confirm": true');
      expect(result.isError).toBeUndefined();
    });

    it('should delete when confirmed', async () => {
      mockServer.use(
        http.delete('http://localhost:8080/api/v1/entries/test-entry', () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      const tool = deleteEntryTool(client);
      const result = await tool.handler({
        slug: 'test-entry',
        confirm: true,
      });

      expect(result.content[0].text).toContain('deleted successfully');
    });
  });
});
