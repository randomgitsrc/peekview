import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';
import { PeekViewClient } from '../src/client.js';
import { createTools } from '../src/tools/index.js';
import type { ServerConfig } from '../src/config.js';

type ServerConfigWithNamespaces = ServerConfig & {
  pathNamespaces: Record<string, Record<string, string>>;
};

function makeConfig(
  mode: 'local' | 'remote',
  allowedPaths: string[] = [],
  trustAllPaths = false,
  pathNamespaces: Record<string, Record<string, string>> = {}
): ServerConfigWithNamespaces {
  return {
    peekviewUrl: 'http://localhost:8080',
    publicUrl: 'http://localhost:8080',
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
    mode,
    allowedPaths,
    trustAllPaths,
    pathNamespaces,
  };
}

function createTestApp(configOverrides?: Partial<ServerConfigWithNamespaces>) {
  const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });
  client.validateToken = async () => ({ id: 1, username: 'alice' });
  client.ping = async () => true;

  const config = { ...makeConfig('local', ['/data']), ...configOverrides };
  const tools = createTools(client, config);
  const app = createExpressApp(tools, config, client);
  return { app, client, config };
}

describe('BDD-15: /health 返回 cwd 和 mode 信息（local 模式）', () => {
  it('BDD-15: local 模式 /health 包含 cwd 和 mode 字段', async () => {
    const { app } = createTestApp(makeConfig('local', ['/data']));

    const res = await request(app).get('/health').expect(200);

    expect(res.body).toHaveProperty('config');
    expect(res.body.config).toHaveProperty('cwd');
    expect(res.body.config).toHaveProperty('mode');
    expect(res.body.config.mode).toBe('local');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
  });
});

describe('BDD-16: /health 返回 allowed_paths 信息（local 模式）', () => {
  it('BDD-16: local 模式 /health 包含 allowed_paths 字段', async () => {
    const { app } = createTestApp(makeConfig('local', ['/data']));

    const res = await request(app).get('/health').expect(200);

    expect(res.body.config).toHaveProperty('allowed_paths');
    expect(res.body.config.allowed_paths).toContain('/data');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
  });
});

describe('BDD-17: /health 在 remote 模式下 cwd/allowed_paths 语义正确', () => {
  it('BDD-17: remote 模式 /health 的 allowed_paths 为空或不适用', async () => {
    const { app } = createTestApp(makeConfig('remote'));

    const res = await request(app).get('/health').expect(200);

    expect(res.body.config).toHaveProperty('cwd');
    expect(res.body.config).toHaveProperty('mode');
    expect(res.body.config.mode).toBe('remote');
    expect(res.body.config).toHaveProperty('allowed_paths');
    expect(res.body.config.allowed_paths).toEqual([]);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
  });
});
