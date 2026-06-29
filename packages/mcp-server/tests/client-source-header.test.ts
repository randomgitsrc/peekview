import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

describe('PeekViewClient X-PeekView-Source header', () => {
  it('should send X-PeekView-Source: mcp on getEntry', async () => {
    let capturedSource = '';
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries/test', ({ request }) => {
        capturedSource = request.headers.get('X-PeekView-Source') || '';
        return HttpResponse.json({
          id: 1,
          slug: 'test',
          summary: 'Test Entry',
          tags: [],
          files: [],
          created_at: new Date().toISOString(),
          expires_at: null,
          is_public: true,
        });
      })
    );

    await client.getEntry('test', 'pv_alice_key');
    expect(capturedSource).toBe('mcp');
  });

  it('should send X-PeekView-Source: mcp on listEntries', async () => {
    let capturedSource = '';
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedSource = request.headers.get('X-PeekView-Source') || '';
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          per_page: 20,
        });
      })
    );

    await client.listEntries('pv_alice_key');
    expect(capturedSource).toBe('mcp');
  });

  it('should send X-PeekView-Source: mcp on createEntry', async () => {
    let capturedSource = '';
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', ({ request }) => {
        capturedSource = request.headers.get('X-PeekView-Source') || '';
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

    await client.createEntry(
      { summary: 'Test', files: [{ filename: 'test.txt', content: 'Hello' }] },
      'pv_alice_key'
    );
    expect(capturedSource).toBe('mcp');
  });

  it('should send X-PeekView-Source: mcp on deleteEntry', async () => {
    let capturedSource = '';
    mockServer.use(
      http.delete('http://localhost:8080/api/v1/entries/test', ({ request }) => {
        capturedSource = request.headers.get('X-PeekView-Source') || '';
        return new HttpResponse(null, { status: 204 });
      })
    );

    await client.deleteEntry('test', 'pv_alice_key');
    expect(capturedSource).toBe('mcp');
  });
});
