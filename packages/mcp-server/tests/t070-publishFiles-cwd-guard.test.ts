import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PeekViewClient } from '../src/client.js';
import { publishFilesTool } from '../src/tools/publishFiles.js';
import type { ServerConfig } from '../src/config.js';
import type { SessionContext } from '../src/types.js';

type ServerConfigWithNamespaces = ServerConfig & {
  pathNamespaces: Record<string, Record<string, string>>;
};

const mockServer = setupServer();
beforeEach(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterEach(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });
const ctx: SessionContext = { userToken: 'pv_test', userId: 1, username: 'alice' };

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

function mockCreateEntry() {
  mockServer.use(
    http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
      const body = (await request.json()) as { files: Array<{ filename: string }>; is_public?: boolean };
      return HttpResponse.json({
        id: 1,
        slug: 'bdd-test',
        summary: 'Test',
        tags: [],
        files: body.files.map((f, i) => ({
          id: i + 1, filename: f.filename, path: null, language: 'text', size: 10,
        })),
        created_at: '2026-01-01T00:00:00Z',
        expires_at: null,
        is_public: body.is_public ?? false,
      });
    })
  );
}

describe('BDD-1: 已配 allowed_paths 且 cwd=/ 时 publish_files 正常工作', () => {
  it('BDD-1: cwd=/ + allowed_paths=["/data"] → publish_files 成功', async () => {
    const root = path.parse(process.cwd()).root;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-bdd1-'));
    try {
      const file = path.join(tmpDir, 'test.py');
      await fs.writeFile(file, 'print("hello")');
      mockCreateEntry();

      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({ summary: 'BDD-1', paths: [file] }, ctx);

      expect(result.content[0].text).toContain('已发布');
      expect(result.content[0].text).not.toContain('ERROR');
    } finally {
      cwdSpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('BDD-2: 未配 allowed_paths 且 cwd=/ 时 publish_files 被拒绝', () => {
  it('BDD-2: cwd=/ + no allowed_paths + trust_all_paths=false → 拒绝', async () => {
    const root = path.parse(process.cwd()).root;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      const tool = publishFilesTool(client, makeConfig('local', [], false));
      const result = await tool.handler({ summary: 'BDD-2', paths: ['/data/test.py'] }, ctx);

      expect(result.content[0].text).toContain('ERROR');
      expect(result.content[0].text).not.toContain('已发布');
    } finally {
      cwdSpy.mockRestore();
    }
  });
});

describe('BDD-3: 已配 allowed_paths 且 cwd 非根目录时行为不变', () => {
  it('BDD-3: cwd=/home/user + allowed_paths=["/data"] → publish_files 成功', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-bdd3-'));
    try {
      const file = path.join(tmpDir, 'test.py');
      await fs.writeFile(file, 'print("hello")');
      mockCreateEntry();

      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({ summary: 'BDD-3', paths: [file] }, ctx);

      expect(result.content[0].text).toContain('已发布');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('BDD-4: 未配 allowed_paths 且 cwd 非根目录时行为不变', () => {
  it('BDD-4: cwd=/home/user + no allowed_paths → publish_files 成功（默认 cwd+tmpdir）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-bdd4-'));
    try {
      const file = path.join(tmpDir, 'test.py');
      await fs.writeFile(file, 'print("hello")');
      mockCreateEntry();

      const tool = publishFilesTool(client, makeConfig('local', []));
      const result = await tool.handler({ summary: 'BDD-4', paths: [file] }, ctx);

      expect(result.content[0].text).toContain('已发布');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('BDD-5: trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作', () => {
  it('BDD-5: cwd=/ + trust_all_paths=true + no allowed_paths → publish_files 成功', async () => {
    const root = path.parse(process.cwd()).root;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-bdd5-'));
    try {
      const file = path.join(tmpDir, 'test.py');
      await fs.writeFile(file, 'print("hello")');
      mockCreateEntry();

      const tool = publishFilesTool(client, makeConfig('local', [], true));
      const result = await tool.handler({ summary: 'BDD-5', paths: [file] }, ctx);

      expect(result.content[0].text).toContain('已发布');
      expect(result.content[0].text).not.toContain('ERROR');
    } finally {
      cwdSpy.mockRestore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('BDD-6: cwd=/ 且未配 allowed_paths 时错误信息包含两个原因', () => {
  it('BDD-6: 错误信息同时包含"cwd 为根目录"和"未配置 allowed_paths"', async () => {
    const root = path.parse(process.cwd()).root;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      const tool = publishFilesTool(client, makeConfig('local', [], false));
      const result = await tool.handler({ summary: 'BDD-6', paths: ['/data/test.py'] }, ctx);

      const text = result.content[0].text;
      expect(text).toContain('根目录');
      expect(text).toContain('allowed_paths');
      expect(text).toContain('trust_all_paths');
    } finally {
      cwdSpy.mockRestore();
    }
  });
});
