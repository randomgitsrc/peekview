import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { validate as validateUUID } from 'uuid';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServer, createExpressApp } from '../src/server.js';
import { PeekViewClient } from '../src/client.js';
import { createTools } from '../src/tools/index.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const VALID_TOKEN = 'pv_valid_test_key';
const INVALID_TOKEN = 'pv_invalid_key';

describe('SSE Server', () => {
  let app: any;
  let client: PeekViewClient;

  beforeAll(() => {
    client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

    // Mock validateToken for SSE auth
    client.validateToken = async (token: string) => {
      if (token === VALID_TOKEN) {
        return { id: 1, username: 'alice' };
      }
      return null;
    };

    const tools = createTools(client, 'http://localhost:8080');
    const server = createMCPServer(tools);
    app = createExpressApp(server, {
      peekviewUrl: 'http://localhost:8080',
      publicUrl: 'http://localhost:8080',
      port: 33333,
      host: '0.0.0.0',
      corsOrigins: ['*'],
      logLevel: 'info',
    }, client);
  });

  describe('SDK transport.sessionId verification', () => {
    it('SSEServerTransport exposes sessionId as UUID', () => {
      // P0-1 verification: SDK source confirmed sessionId is a getter
      // returning a randomUUID(). This test proves it exists at runtime.
      const mockRes = { writeHead: () => {}, write: () => {}, on: () => {}, end: () => {} } as any;
      const transport = new SSEServerTransport('/messages', mockRes);
      expect(transport.sessionId).toBeDefined();
      expect(typeof transport.sessionId).toBe('string');
      expect(validateUUID(transport.sessionId)).toBe(true);
    });
  });

  describe('Authentication - pv_ prefix check', () => {
    it('should reject /sse without Authorization header', async () => {
      const res = await request(app)
        .get('/sse')
        .expect(401);
      expect(res.body.error).toContain('API Key');
    });

    it('should reject /sse with empty Authorization', async () => {
      const res = await request(app)
        .get('/sse')
        .set('Authorization', '')
        .expect(401);
      expect(res.body.error).toContain('API Key');
    });

    it('should reject JWT token (eyJ prefix) at SSE connect', async () => {
      const res = await request(app)
        .get('/sse')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.test.test')
        .expect(401);
      expect(res.body.error).toContain('pv_');
    });

    it('should reject non-pv_ token at SSE connect', async () => {
      const res = await request(app)
        .get('/sse')
        .set('Authorization', 'Bearer random_string')
        .expect(401);
      expect(res.body.error).toContain('pv_');
    });

    it('should reject pv_ token that fails PeekView validation', async () => {
      const res = await request(app)
        .get('/sse')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .expect(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should return 503 when PeekView is unreachable during validation', async () => {
      // Override validateToken to throw timeout error
      client.validateToken = async () => {
        throw new Error('PeekView connection timeout during token validation');
      };

      const res = await request(app)
        .get('/sse')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .expect(503);
      expect(res.body.error).toContain('unreachable');

      // Restore original validateToken
      client.validateToken = async (token: string) => {
        if (token === VALID_TOKEN) return { id: 1, username: 'alice' };
        return null;
      };
    });

    it('should call validateToken for valid pv_ token', async () => {
      let capturedToken: string | undefined;
      client.validateToken = async (token: string) => {
        capturedToken = token;
        return token === VALID_TOKEN ? { id: 1, username: 'alice' } : null;
      };

      // SSE is long-lived so we can't wait for full response,
      // but we can verify validateToken was called with the right token
      request(app)
        .get('/sse')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .end(() => {});

      // Give async validation time to execute
      await new Promise(r => setTimeout(r, 50));
      expect(capturedToken).toBe(VALID_TOKEN);

      // Restore
      client.validateToken = async (token: string) => {
        if (token === VALID_TOKEN) return { id: 1, username: 'alice' };
        return null;
      };
    });
  });

  describe('POST /messages - session-based auth', () => {
    it('should reject /messages with invalid sessionId format', async () => {
      const res = await request(app)
        .post('/messages?sessionId=invalid')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect(400);
      expect(res.body.error).toContain('Invalid sessionId');
    });

    it('should return 404 for non-existent sessionId', async () => {
      const res = await request(app)
        .post('/messages?sessionId=12345678-1234-1234-1234-123456789abc')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        .expect((res) => [400, 404].includes(res.status));
      expect(res.body.error).toMatch(/Session not found|Invalid/);
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
    });
  });

  describe('Error translation', () => {
    it('should translate 401 to user-friendly message', async () => {
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', () => {
          return HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
            { status: 401 }
          );
        })
      );

      const tools = createTools(client, 'http://localhost:8080');
      const createEntry = tools.find(t => t.name === 'create_entry');
      const result = await createEntry!.handler(
        { summary: 'Test', files: [{ filename: 't.txt', content: 'x' }] },
        { userToken: 'pv_bad', userId: 1, username: 'alice' }
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('认证失败');
    });

    it('should translate 403 to user-friendly message', async () => {
      mockServer.use(
        http.delete('http://localhost:8080/api/v1/entries/some-entry', () => {
          return HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Not your entry' } },
            { status: 403 }
          );
        })
      );

      const tools = createTools(client, 'http://localhost:8080');
      const deleteEntry = tools.find(t => t.name === 'delete_entry');
      const result = await deleteEntry!.handler(
        { slug: 'some-entry', confirm: true },
        { userToken: 'pv_alice', userId: 1, username: 'alice' }
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('权限不足');
    });
  });
});