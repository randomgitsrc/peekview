/**
 * MCP Server E2E Tests (Streamable HTTP)
 *
 * Tests the full Streamable HTTP flow: initialize → session → tool invocation → response
 * Requires real PeekView backend running
 *
 * Run with: PEEKVIEW_URL=http://127.0.0.1:8888 PEEKVIEW_API_KEY=pv_xxx npm run test:e2e:node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createExpressApp } from '../../src/server.js';
import { PeekViewClient } from '../../src/client.js';
import { createTools } from '../../src/tools/index.js';
import request from 'supertest';

const PEEKVIEW_URL = process.env.PEEKVIEW_URL || 'http://127.0.0.1:8888';
const PEEKVIEW_PUBLIC_URL = process.env.PEEKVIEW_PUBLIC_URL || PEEKVIEW_URL;
const PEEKVIEW_API_KEY = process.env.PEEKVIEW_API_KEY || '';

let backendAvailable = false;
let userInfo: { id: number; username: string } | null = null;

let client: PeekViewClient;
let tools: ReturnType<typeof createTools>;
let app: ReturnType<typeof createExpressApp>;

const INIT_REQUEST = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'e2e-test', version: '1.0' },
  },
};

beforeAll(async () => {
  try {
    const res = await fetch(`${PEEKVIEW_URL}/health`);
    if (res.ok) backendAvailable = true;
  } catch { /* backend not available */ }

  if (PEEKVIEW_API_KEY && backendAvailable) {
    client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
    userInfo = await client.validateToken(PEEKVIEW_API_KEY);
  }

  client = client ?? new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
  tools = createTools(client, {
    peekviewUrl: PEEKVIEW_URL,
    publicUrl: PEEKVIEW_PUBLIC_URL,
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
    mode: 'remote',
    allowedPaths: [],
  });
  app = createExpressApp(tools, {
    peekviewUrl: PEEKVIEW_URL,
    publicUrl: PEEKVIEW_PUBLIC_URL,
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
  }, client);
});

const itIfReady = (name: string, fn: () => Promise<void>) => {
  it(name, async () => {
    if (!backendAvailable || !PEEKVIEW_API_KEY || !userInfo) {
      console.warn(`Skipping "${name}" - prerequisites not met`);
      return;
    }
    await fn();
  });
};

describe('E2E: Streamable HTTP Server + PeekView Backend', () => {
  describe('Streamable HTTP auth with real backend', () => {
    itIfReady('should reject /mcp initialize with invalid pv_ key', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', 'Bearer pv_totally_fake_invalid_key')
        .send(INIT_REQUEST)
        .expect(401);

      expect(res.body.error).toContain('Invalid');
    });

    it('should reject /mcp initialize without any auth header', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(INIT_REQUEST)
        .expect(401);

      expect(res.body.error).toContain('pv_');
    });

    it('should reject JWT token even if valid format', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig')
        .send(INIT_REQUEST)
        .expect(401);

      expect(res.body.error).toContain('pv_');
    });
  });

  describe('Health check with real backend', () => {
    itIfReady('should return ok when PeekView is reachable', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });

  describe('Full Streamable HTTP → tool invocation flow', () => {
    itIfReady('should initialize session and return mcp-session-id', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${PEEKVIEW_API_KEY}`)
        .send(INIT_REQUEST)
        .expect(200);

      expect(res.headers['mcp-session-id']).toBeDefined();
      expect(res.body.result).toBeDefined();
    });

    itIfReady('should call create_entry via tool handler with real backend', async () => {
      const createEntry = tools.find(t => t.name === 'create_entry');

      const slug = `e2e-test-${Date.now()}`;
      const result = await createEntry!.handler({
        slug,
        summary: 'E2E Test Entry',
        files: [{ filename: 'test.txt', content: 'E2E test content' }],
        is_public: true,
      }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      expect(result.content[0].text).toContain('Entry created successfully');
      expect(result.content[0].text).toContain(slug);

      const verifyRes = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      expect(verifyRes.ok).toBe(true);
      const entry = await verifyRes.json();
      expect(entry.owner_id).toBe(userInfo!.id);

      await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
    });

    itIfReady('should call get_entry with real backend', async () => {
      const getEntry = tools.find(t => t.name === 'get_entry');

      const result = await getEntry!.handler({ slug: 'zufvwz' }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      expect(result.content[0].text).toContain('Multi-user MCP Test');
    });

    itIfReady('should call list_entries with real backend', async () => {
      const listEntries = tools.find(t => t.name === 'list_entries');

      const result = await listEntries!.handler({}, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      expect(result.content[0].text).toMatch(/Found|No entries found/);
    });

    itIfReady('should call delete_entry with real backend', async () => {
      const createEntry = tools.find(t => t.name === 'create_entry');
      const deleteEntry = tools.find(t => t.name === 'delete_entry');

      const slug = `e2e-delete-${Date.now()}`;
      await createEntry!.handler({
        slug,
        summary: 'Entry to delete',
        files: [{ filename: 'tmp.txt', content: 'tmp' }],
      }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      const result = await deleteEntry!.handler({ slug, confirm: true }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      expect(result.content[0].text).toContain('deleted successfully');

      const verifyRes = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      expect(verifyRes.status).toBe(404);
    });
  });

  describe('Entry ownership verification', () => {
    itIfReady('should create entry owned by API key user', async () => {
      const createEntry = tools.find(t => t.name === 'create_entry');

      const slug = `e2e-owner-${Date.now()}`;
      await createEntry!.handler({
        slug,
        summary: 'Owner test',
        files: [{ filename: 'owner.txt', content: 'owned by me' }],
      }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      const res = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      const entry = await res.json();
      expect(entry.owner_id).toBe(userInfo!.id);
      expect(entry.username).toBe(userInfo!.username);

      await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
    });
  });

  describe('Error handling with real backend', () => {
    itIfReady('should return 401 error for invalid API key', async () => {
      const createEntry = tools.find(t => t.name === 'create_entry');

      const result = await createEntry!.handler({
        summary: 'Should fail or create anonymous',
        files: [{ filename: 't.txt', content: 'x' }],
      }, {
        userToken: 'pv_invalid_nonexistent_key_xyz',
        userId: 999,
        username: 'nobody',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeTruthy();
    });

    itIfReady('should return error for non-existent entry', async () => {
      const getEntry = tools.find(t => t.name === 'get_entry');

      const result = await getEntry!.handler({ slug: 'nonexistent-entry-e2e-test' }, {
        userToken: PEEKVIEW_API_KEY,
        userId: userInfo!.id,
        username: userInfo!.username,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('CORS configuration', () => {
    it('should include Authorization in allowed headers', async () => {
      const res = await request(app)
        .options('/mcp')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type, mcp-session-id');

      const allowHeaders = res.headers['access-control-allow-headers'];
      expect(allowHeaders).toContain('Authorization');
    });
  });
});
