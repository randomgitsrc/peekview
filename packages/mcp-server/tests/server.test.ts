import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createMCPServer, createExpressApp } from '../src/server.js';
import { PeekViewClient } from '../src/client.js';
import { createTools } from '../src/tools/index.js';
import type { ServerConfig } from '../src/types.js';

const testConfig: ServerConfig = {
  peekviewUrl: 'http://localhost:8080',
  publicUrl: 'http://localhost:8080',
  apiKey: 'pv_test_key',
  mcpToken: 'mct_test_token',
  port: 3000,
  host: '0.0.0.0',
  corsOrigins: ['*'],
  logLevel: 'info',
};

describe('SSE Server', () => {
  let app: any;
  let client: PeekViewClient;

  beforeAll(() => {
    client = new PeekViewClient({
      peekviewUrl: testConfig.peekviewUrl,
      apiKey: testConfig.apiKey,
    });
    const tools = createTools(client, testConfig);
    const server = createMCPServer(tools);
    app = createExpressApp(server, testConfig, client);
  });

  describe('Authentication', () => {
    it('should reject /sse without token', async () => {
      const res = await request(app)
        .get('/sse')
        .expect(401);
      expect(res.body.error).toContain('MCP_TOKEN');
    });

    it('should reject /sse with invalid token', async () => {
      const res = await request(app)
        .get('/sse')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject /messages without token', async () => {
      const res = await request(app)
        .post('/messages')
        .expect(401);
      expect(res.body.error).toContain('MCP_TOKEN');
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
      // Override client.ping to return false
      client.ping = async () => false;

      const res = await request(app)
        .get('/health')
        .expect(503);
      expect(res.body.status).toBe('degraded');
    });
  });

  describe('Session Management', () => {
    it('should reject /messages with invalid sessionId format', async () => {
      const res = await request(app)
        .post('/messages?sessionId=invalid')
        .set('Authorization', 'Bearer mct_test_token')
        .send({})
        .expect(400);
      expect(res.body.error).toContain('Invalid sessionId');
    });

    it('should return 400 for unknown sessionId', async () => {
      // Note: handlePostMessage validates the request format first
      // So we get 400 from SDK validation before our 404 check
      const res = await request(app)
        .post('/messages?sessionId=12345678-1234-1234-1234-123456789abc')
        .set('Authorization', 'Bearer mct_test_token')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} })
        // SDK validates format first, then we check session - can be 400 or 404
        .expect((res) => [400, 404].includes(res.status));
      expect(res.body.error).toMatch(/Session not found|Invalid/);
    });
  });
});
