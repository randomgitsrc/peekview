import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { AsyncLocalStorage } from 'async_hooks';
import request from 'supertest';
import { createExpressApp, createMCPServer } from '../src/server.js';
import { PeekViewClient } from '../src/client.js';
import { createTools } from '../src/tools/index.js';
import type { SessionContext } from '../src/types.js';
import type { ServerConfig } from '../src/config.js';

function makeConfig(mode: 'local' | 'remote', allowedPaths: string[] = []): ServerConfig {
  return {
    peekviewUrl: 'http://localhost:8080',
    publicUrl: 'http://localhost:8080',
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
    mode,
    allowedPaths,
  };
}

const VALID_TOKEN = 'pv_valid_test_key';
const INVALID_TOKEN = 'pv_invalid_key';

function createTestApp() {
  const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

  client.validateToken = async (token: string) => {
    if (token === VALID_TOKEN) {
      return { id: 1, username: 'alice' };
    }
    return null;
  };

  client.ping = async () => true;

  const tools = createTools(client, makeConfig('remote'));
  const app = createExpressApp(tools, {
    peekviewUrl: 'http://localhost:8080',
    publicUrl: 'http://localhost:8080',
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
  }, client);

  return { app, client };
}

const INIT_REQUEST = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' },
  },
};

describe('Streamable HTTP Server', () => {
  let app: ReturnType<typeof createTestApp>['app'];
  let client: ReturnType<typeof createTestApp>['client'];

  beforeAll(() => {
    ({ app, client } = createTestApp());
  });

  describe('POST /mcp - Authentication', () => {
    it('should reject initialize without Authorization header', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(INIT_REQUEST)
        .expect(401);
      expect(res.body.error).toContain('API Key');
    });

    it('should reject initialize with empty Authorization', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', '')
        .send(INIT_REQUEST)
        .expect(401);
      expect(res.body.error).toContain('pv_');
    });

    it('should reject JWT token (eyJ prefix)', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.test.test')
        .send(INIT_REQUEST)
        .expect(401);
      expect(res.body.error).toContain('pv_');
    });

    it('should reject non-pv_ token', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', 'Bearer random_string')
        .send(INIT_REQUEST)
        .expect(401);
      expect(res.body.error).toContain('pv_');
    });

    it('should reject pv_ token that fails PeekView validation', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .send(INIT_REQUEST)
        .expect(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return 503 when PeekView is unreachable during validation', async () => {
      client.validateToken = async () => {
        throw new Error('PeekView connection timeout during token validation');
      };

      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST)
        .expect(503);
      expect(res.body.error).toContain('unreachable');

      client.validateToken = async (token: string) => {
        if (token === VALID_TOKEN) return { id: 1, username: 'alice' };
        return null;
      };
    });
  });

  describe('POST /mcp - Stateless mode', () => {
    it('should successfully initialize and NOT return mcp-session-id (stateless)', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);

      expect(res.status).toBe(200);
      expect(res.headers['mcp-session-id']).toBeUndefined();
      expect(res.body.jsonrpc).toBe('2.0');
      expect(res.body.result).toBeDefined();
    });

    it('should handle tools/list without prior initialize (stateless)', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        });
      // Stateless: each request is independent, tools/list should work
      expect(res.status).toBe(200);
    });

    it('should authenticate on every request independently', async () => {
      // First request - valid
      const res1 = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);
      expect(res1.status).toBe(200);

      // Second request - invalid key (no session to reuse)
      const res2 = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .send(INIT_REQUEST);
      expect(res2.status).toBe(401);
    });

    it('should ignore stale mcp-session-id header (stateless)', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .set('mcp-session-id', 'stale-session-id-from-previous-server-instance')
        .send(INIT_REQUEST);
      // Stateless: session-id header is ignored, request succeeds
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /mcp - Stateless acknowledgement', () => {
    it('should return 200 regardless of session-id (stateless)', async () => {
      const res = await request(app)
        .delete('/mcp')
        .set('mcp-session-id', 'any-session-id')
        .expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('should return 200 for DELETE without session-id header', async () => {
      const res = await request(app)
        .delete('/mcp')
        .expect(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /mcp', () => {
    it('should return 405 (SSE streaming not yet implemented)', async () => {
      await request(app)
        .get('/mcp')
        .expect(405);
    });
  });

  describe('Health Check', () => {
    it('should return 200 for /health without auth', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('should return 503 when PeekView is unreachable', async () => {
      client.ping = async () => false;

      const res = await request(app)
        .get('/health')
        .expect(503);
      expect(res.body.status).toBe('degraded');

      client.ping = async () => true;
    });
  });

  describe('Full session lifecycle', () => {
    it('should complete initialize → tools/list → tools/call lifecycle', async () => {
      const initRes = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);

      expect(initRes.status).toBe(200);
      const sessionId = initRes.headers['mcp-session-id'];
      expect(sessionId).toBeDefined();

      // Send initialized notification
      await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        });

      // List tools
      const listRes = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        });

      expect(listRes.status).toBe(200);
      expect(listRes.body.result.tools).toBeDefined();
      expect(listRes.body.result.tools.length).toBeGreaterThan(0);

      // Delete session
      await request(app)
        .delete('/mcp')
        .set('mcp-session-id', sessionId)
        .expect(200);
    });
  });

  describe('Multi-user session isolation', () => {
    it('should maintain separate AsyncLocalStorage contexts for concurrent sessions', async () => {
      const sessionContext = new AsyncLocalStorage<SessionContext>();

      const aliceCtx: SessionContext = { userToken: 'pv_alice', userId: 1, username: 'alice' };
      const bobCtx: SessionContext = { userToken: 'pv_bob', userId: 2, username: 'bob' };

      let aliceCaptured: string | undefined;
      let bobCaptured: string | undefined;

      await Promise.all([
        sessionContext.run(aliceCtx, async () => {
          await new Promise(r => setTimeout(r, 10));
          aliceCaptured = sessionContext.getStore()?.userToken;
        }),
        sessionContext.run(bobCtx, async () => {
          await new Promise(r => setTimeout(r, 5));
          bobCaptured = sessionContext.getStore()?.userToken;
        }),
      ]);

      expect(aliceCaptured).toBe('pv_alice');
      expect(bobCaptured).toBe('pv_bob');
    });

    it('should not leak context between sequential sessions', async () => {
      const sessionContext = new AsyncLocalStorage<SessionContext>();

      const aliceCtx: SessionContext = { userToken: 'pv_alice', userId: 1, username: 'alice' };
      const bobCtx: SessionContext = { userToken: 'pv_bob', userId: 2, username: 'bob' };

      sessionContext.run(aliceCtx, () => {
        expect(sessionContext.getStore()?.userToken).toBe('pv_alice');
      });

      expect(sessionContext.getStore()).toBeUndefined();

      sessionContext.run(bobCtx, () => {
        expect(sessionContext.getStore()?.userToken).toBe('pv_bob');
      });

      expect(sessionContext.getStore()).toBeUndefined();
    });
  });

  describe('Origin header validation', () => {
    it('should reject requests with invalid Origin header', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Origin', 'https://evil.example.com')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST)
        .expect(403);
      expect(res.body.error).toContain('Origin');
    });

    it('should allow requests with localhost Origin', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Origin', 'http://localhost:3000')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);

      expect(res.status).toBe(200);
    });

    it('should allow requests without Origin header', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);

      expect(res.status).toBe(200);
    });
  });

  describe('CORS headers', () => {
    it('should include mcp-session-id in response headers', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(INIT_REQUEST);

      expect(res.status).toBe(200);
      expect(res.headers['mcp-session-id']).toBeDefined();
    });
  });

  describe('Dual mode tools (regression)', () => {
    it('should expose correct tools for remote mode', async () => {
      const remoteClient = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });
      remoteClient.ping = async () => true;
      const tools = createTools(remoteClient, makeConfig('remote'));
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('create_entry');
      expect(toolNames).toContain('get_entry');
      expect(toolNames).toContain('list_entries');
      expect(toolNames).toContain('delete_entry');
      expect(toolNames).not.toContain('publish_files');
    });

    it('should expose correct tools for local mode', async () => {
      const localClient = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });
      localClient.ping = async () => true;
      const tools = createTools(localClient, makeConfig('local', ['/tmp']));
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('publish_files');
      expect(toolNames).toContain('get_entry');
      expect(toolNames).toContain('list_entries');
      expect(toolNames).toContain('delete_entry');
      expect(toolNames).not.toContain('create_entry');
    });
  });
});
