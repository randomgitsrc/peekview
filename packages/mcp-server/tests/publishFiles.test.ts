import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PeekViewClient } from '../src/client.js';
import { createTools } from '../src/tools/index.js';
import { publishFilesTool } from '../src/tools/publishFiles.js';
import type { ServerConfig } from '../src/config.js';
import type { SessionContext } from '../src/types.js';

const mockServer = setupServer();
beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

const ctx: SessionContext = { userToken: 'pv_test', userId: 1, username: 'alice' };

function makeConfig(mode: 'local' | 'remote', allowedPaths: string[] = [], trustAllPaths = false): ServerConfig {
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
  };
}

// ─── 工具策略：local/remote 暴露不同工具集 ──────────────────────────────────
describe('工具策略（按模式区分）', () => {
  it('remote 模式：暴露 create_entry，不暴露 publish_files', () => {
    const tools = createTools(client, makeConfig('remote'));
    const names = tools.map((t) => t.name);
    expect(names).toContain('create_entry');
    expect(names).not.toContain('publish_files');
    expect(names).toContain('get_entry');
    expect(names).toContain('list_entries');
    expect(names).toContain('delete_entry');
  });

  it('local 模式：暴露 publish_files，不暴露 create_entry', () => {
    const tools = createTools(client, makeConfig('local', ['/tmp']));
    const names = tools.map((t) => t.name);
    expect(names).toContain('publish_files');
    expect(names).not.toContain('create_entry');
    expect(names).toContain('get_entry');
    expect(names).toContain('list_entries');
    expect(names).toContain('delete_entry');
  });
});

// ─── publish_files 工具 ─────────────────────────────────────────────────────
describe('publish_files', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-publish-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function mockCreateEntry() {
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        const body = (await request.json()) as { files: Array<{ filename: string }>; is_public?: boolean };
        return HttpResponse.json({
          id: 1,
          slug: 'pub-test',
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

  it('发布单个文件', async () => {
    const file = path.join(tmpDir, 'main.py');
    await fs.writeFile(file, 'print("hello")');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Test', paths: [file] }, ctx);

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('已发布 1 个文件');
    expect(result.content[0].text).toContain('pub-test');
  });

  it('递归扫描目录', async () => {
    await fs.mkdir(path.join(tmpDir, 'src'));
    await fs.writeFile(path.join(tmpDir, 'src', 'a.py'), 'a');
    await fs.writeFile(path.join(tmpDir, 'src', 'b.py'), 'b');
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# readme');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Dir', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 3 个文件');
  });

  it('跳过构建目录（node_modules 等）', async () => {
    await fs.mkdir(path.join(tmpDir, 'node_modules'));
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'junk.js'), 'junk');
    await fs.writeFile(path.join(tmpDir, 'app.js'), 'app');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Skip', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 1 个文件');
    expect(result.content[0].text).not.toContain('junk.js');
  });

  it('include_patterns 只发布匹配的文件', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.py'), 'a');
    await fs.writeFile(path.join(tmpDir, 'b.txt'), 'b');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler(
      { summary: 'Py', paths: [tmpDir], include_patterns: ['*.py'] }, ctx
    );

    expect(result.content[0].text).toContain('已发布 1 个文件');
  });

  it('拒绝绝对路径之外的相对路径', async () => {
    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Rel', paths: ['relative/path.py'] }, ctx);

    expect(result.content[0].text).toContain('没有可发布的文件');
  });

  it('安全失败：黑名单路径拒绝整个请求', async () => {
    // 构造一个 .pem 文件在允许目录内，但命中黑名单
    const keyFile = path.join(tmpDir, 'private.pem');
    await fs.writeFile(keyFile, 'SECRET KEY');

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Key', paths: [keyFile] }, ctx);

    expect(result.content[0].text).toContain('发布被拒绝');
    expect(result.content[0].text).toContain('敏感文件保护规则');
  });

  it('安全失败：超出 allowed_paths 拒绝整个请求', async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-other-'));
    try {
      const file = path.join(otherDir, 'x.py');
      await fs.writeFile(file, 'x');
      // allowed 只含 tmpDir，不含 otherDir
      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('发布被拒绝');
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  it('不存在的文件 skip 而非崩溃', async () => {
    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler(
      { summary: 'Missing', paths: [path.join(tmpDir, 'nope.py')] }, ctx
    );
    expect(result.content[0].text).toContain('没有可发布的文件');
  });

  it('二进制文件用 base64 上传', async () => {
    await fs.writeFile(path.join(tmpDir, 'data.bin'), Buffer.from([0, 1, 2, 0, 3]));
    await fs.writeFile(path.join(tmpDir, 'ok.txt'), 'text');
    let capturedBody: { files: Array<{ filename: string; content?: string; content_base64?: string }> } | null = null;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          id: 1, slug: 'bin-test', summary: 'Bin', tags: [],
          files: [
            { id: 1, filename: 'ok.txt', path: null, language: 'text', size: 4 },
            { id: 2, filename: 'data.bin', path: null, language: null, size: 5 },
          ],
          created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: false,
        });
      })
    );

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Bin', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 2 个文件');
    expect(capturedBody).not.toBeNull();
    const textFile = capturedBody!.files.find(f => f.filename === 'ok.txt');
    const binFile = capturedBody!.files.find(f => f.filename === 'data.bin');
    expect(textFile?.content).toBe('text');
    expect(textFile?.content_base64).toBeUndefined();
    expect(binFile?.content).toBeUndefined();
    expect(binFile?.content_base64).toBeDefined();
    const decoded = Buffer.from(binFile!.content_base64!, 'base64');
    expect(decoded).toEqual(Buffer.from([0, 1, 2, 0, 3]));
  });

  it('超大二进制文件跳过（too_large）', async () => {
    const bigFile = path.join(tmpDir, 'big.bin');
    const bigBuf = Buffer.alloc(21 * 1024 * 1024, 0);
    await fs.writeFile(bigFile, bigBuf);
    await fs.writeFile(path.join(tmpDir, 'small.txt'), 'ok');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Big', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 1 个文件');
    expect(result.content[0].text).toContain('超过 20MB');
  });

  it('混合文本+二进制：文本走 content，二进制走 content_base64', async () => {
    await fs.writeFile(path.join(tmpDir, 'code.py'), 'print("hi")');
    const pngBuf = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100, 0)]);
    await fs.writeFile(path.join(tmpDir, 'img.png'), pngBuf);
    let capturedBody: { files: Array<{ filename: string; content?: string; content_base64?: string }> } | null = null;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          id: 1, slug: 'mix-test', summary: 'Mix', tags: [],
          files: [
            { id: 1, filename: 'code.py', path: null, language: 'python', size: 12 },
            { id: 2, filename: 'img.png', path: null, language: null, size: 104 },
          ],
          created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: false,
        });
      })
    );

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Mix', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 2 个文件');
    expect(capturedBody).not.toBeNull();
    const pyFile = capturedBody!.files.find(f => f.filename === 'code.py');
    const pngFile = capturedBody!.files.find(f => f.filename === 'img.png');
    expect(pyFile?.content).toBe('print("hi")');
    expect(pyFile?.content_base64).toBeUndefined();
    expect(pngFile?.content).toBeUndefined();
    expect(pngFile?.content_base64).toBeDefined();
  });

  it('文件名/后缀从路径自动推断，不要求传 language', async () => {
    const file = path.join(tmpDir, 'doc.md');
    await fs.writeFile(file, '# title');
    let capturedBody: { files: Array<{ filename: string; language?: string }> } | null = null;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          id: 1, slug: 'md-test', summary: 'Doc', tags: [],
          files: [{ id: 1, filename: 'doc.md', path: null, language: 'markdown', size: 7 }],
          created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true,
        });
      })
    );

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    await tool.handler({ summary: 'Doc', paths: [file] }, ctx);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.files[0].filename).toBe('doc.md');
    // 不传 language，由后端 detect_language 处理
    expect(capturedBody!.files[0].language).toBeUndefined();
  });

  it('默认白名单：允许 cwd + os.tmpdir() 下文件', async () => {
    // tmpDir 在 os.tmpdir() 下，零配置应允许
    const file = path.join(tmpDir, 'x.py');
    await fs.writeFile(file, 'x');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', []));
    const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
    expect(result.content[0].text).toContain('已发布 1 个文件');
  });

  it('默认白名单：拒绝 cwd/tmpdir 外文件', async () => {
    const outsideDir = await fs.mkdtemp('/var/tmp/pv-outside-');
    const file = path.join(outsideDir, 'notes.md');
    await fs.writeFile(file, '# notes');

    try {
      const tool = publishFilesTool(client, makeConfig('local', []));
      const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('发布被拒绝');
      expect(result.content[0].text).toContain('超出允许范围');
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('cwd 为根目录时拒绝使用', async () => {
    const root = path.parse(process.cwd()).root;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      const file = path.join(tmpDir, 'x.py');
      await fs.writeFile(file, 'x');
      const tool = publishFilesTool(client, makeConfig('local', []));
      const result = await tool.handler({ summary: 'Root', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('未配置 allowed_paths');
      expect(result.content[0].text).toContain('根目录');
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('trust_all_paths: true 允许 cwd 外普通文件', async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-trust-'));
    try {
      const file = path.join(otherDir, 'x.py');
      await fs.writeFile(file, 'x');
      mockCreateEntry();

      const tool = publishFilesTool(client, makeConfig('local', [], true));
      const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('已发布 1 个文件');
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  it('trust_all_paths: true 仍被 denylist 拒绝', async () => {
    const file = path.join(tmpDir, '.env');
    await fs.writeFile(file, 'SECRET=123');

    const tool = publishFilesTool(client, makeConfig('local', [], true));
    const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
    expect(result.content[0].text).toContain('发布被拒绝');
    expect(result.content[0].text).toContain('敏感文件保护规则');
  });

  it('trust_all_paths: true + allowed_paths 同时配置 → trust 优先', async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-trust2-'));
    try {
      const file = path.join(otherDir, 'x.py');
      await fs.writeFile(file, 'x');
      mockCreateEntry();

      // allowed_paths 不含 otherDir，但 trust_all_paths=true 生效
      const tool = publishFilesTool(client, makeConfig('local', [tmpDir], true));
      const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('已发布 1 个文件');
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  it('denylist: .env / .env.local / secrets.env 始终拒绝', async () => {
    for (const name of ['.env', '.env.local', 'secrets.env']) {
      const file = path.join(tmpDir, name);
      await fs.writeFile(file, 'SECRET=123');
      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
      expect(result.content[0].text).toContain('发布被拒绝');
      await fs.unlink(file).catch(() => {});
    }
  });

  it('denylist: .npmrc / .pypirc / .git-credentials / .kube/config / .docker/config.json 始终拒绝', async () => {
    const files = [
      path.join(tmpDir, '.npmrc'),
      path.join(tmpDir, '.pypirc'),
      path.join(tmpDir, '.git-credentials'),
      path.join(tmpDir, '.kube', 'config'),
      path.join(tmpDir, '.docker', 'config.json'),
    ];
    for (const f of files) {
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, 'secret');
      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({ summary: 'X', paths: [f] }, ctx);
      expect(result.content[0].text).toContain('发布被拒绝');
      await fs.rm(path.dirname(f), { recursive: true, force: true }).catch(() => {});
    }
  });

  it('denylist: symlink 经 realpath 后仍拒绝', async () => {
    const target = path.join(tmpDir, 'real.pem');
    const link = path.join(tmpDir, 'link.pem');
    await fs.writeFile(target, 'SECRET');
    await fs.symlink(target, link);

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'X', paths: [link] }, ctx);
    expect(result.content[0].text).toContain('发布被拒绝');
  });

  it('is_public 未传 → 默认 false', async () => {
    const file = path.join(tmpDir, 'pub.md');
    await fs.writeFile(file, 'text');
    let capturedBody: { is_public?: boolean } | null = null;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({ id: 1, slug: 't', summary: 'T', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: false });
      })
    );

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    await tool.handler({ summary: 'T', paths: [file] }, ctx);
    expect(capturedBody?.is_public).toBe(false);
  });

  it('is_public: true → 公开', async () => {
    const file = path.join(tmpDir, 'pub.md');
    await fs.writeFile(file, 'text');
    let capturedBody: { is_public?: boolean } | null = null;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({ id: 1, slug: 't', summary: 'T', tags: [], files: [], created_at: '2026-01-01T00:00:00Z', expires_at: null, is_public: true });
      })
    );

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    await tool.handler({ summary: 'T', paths: [file], is_public: true }, ctx);
    expect(capturedBody?.is_public).toBe(true);
  });
});
