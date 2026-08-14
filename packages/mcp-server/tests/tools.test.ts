import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';
import { createEntryTool } from '../src/tools/createEntry.js';
import { getEntryTool } from '../src/tools/getEntry.js';
import { listEntriesTool } from '../src/tools/listEntries.js';
import { deleteEntryTool } from '../src/tools/deleteEntry.js';
import type { SessionContext } from '../src/types.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

const testContext: SessionContext = {
  userToken: 'pv_test_key',
  userId: 1,
  username: 'alice',
};

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

      const tool = createEntryTool(client, 'https://peek.example.com');
      const result = await tool.handler({
        summary: 'Test Summary',
        files: [{ filename: 'test.txt', content: 'Hello' }],
      }, testContext);

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

      const tool = createEntryTool(client, 'https://peek.example.com');
      await tool.handler({
        summary: 'Test',
        files: [{ filename: 'test.txt', content: 'Hello' }],
        is_public: false,
      }, testContext);

      expect(requestBody).toMatchObject({ is_public: false });
    });

    it('should translate 401 error to Chinese', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
            { status: 401 }
          );
        })
      );

      const tool = createEntryTool(client, 'https://peek.example.com');
      const result = await tool.handler({
        summary: 'Test',
        files: [{ filename: 'test.txt', content: 'Hello' }],
      }, testContext);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('认证失败');
    });
  });

  describe('get_entry', () => {
    it('should get entry details from ref (new contract)', async () => {
      mockServer.use(
        http.get('http://localhost:8080/api/v1/entries/test/raw', () => {
          return HttpResponse.json({
            slug: 'test',
            summary: 'Test Entry',
            tags: ['tag1', 'tag2'],
            files: [
              { id: 1, filename: 'file1.txt', path: null, language: 'text', is_binary: false, size: 11, content: 'hello world', content_encoding: 'utf-8', file_url: null },
              { id: 2, filename: 'file2.py', path: 'src', language: 'python', is_binary: false, size: 2, content: 'py', content_encoding: 'utf-8', file_url: null },
            ],
            created_at: '2026-01-01T00:00:00Z',
            raw_url: 'http://localhost:8080/api/v1/entries/test/raw',
          });
        })
      );

      const tool = getEntryTool(client);
      const result = await tool.handler({ ref: 'test' }, testContext);

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text) as { summary: string; files: Array<{ content: string }> };
      expect(parsed.summary).toBe('Test Entry');
      expect(parsed.files).toHaveLength(2);
      expect(parsed.files[0].content).toBe('hello world');
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
      const result = await tool.handler({}, testContext);

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
      const result = await tool.handler({}, testContext);

      expect(result.content[0].text).toBe('No entries found.');
    });
  });

  describe('delete_entry', () => {
    it('should require confirm before deleting', async () => {
      const tool = deleteEntryTool(client);
      const result = await tool.handler({
        slug: 'test-entry',
      }, testContext);

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
      }, testContext);

      expect(result.content[0].text).toContain('deleted successfully');
    });

    it('should translate 403 error to Chinese', async () => {
      mockServer.use(
        http.delete('http://localhost:8080/api/v1/entries/some-entry', () => {
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Not your entry' } },
            { status: 403 }
          );
        })
      );

      const tool = deleteEntryTool(client);
      const result = await tool.handler({
        slug: 'some-entry',
        confirm: true,
      }, testContext);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('权限不足');
    });
  });
});