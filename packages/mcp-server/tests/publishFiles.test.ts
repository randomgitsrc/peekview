import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
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
        const body = (await request.json()) as { files: Array<{ filename: string }> };
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
          is_public: true,
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

  it('二进制文件被跳过', async () => {
    await fs.writeFile(path.join(tmpDir, 'data.bin'), Buffer.from([0, 1, 2, 0, 3]));
    await fs.writeFile(path.join(tmpDir, 'ok.txt'), 'text');
    mockCreateEntry();

    const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
    const result = await tool.handler({ summary: 'Bin', paths: [tmpDir] }, ctx);

    expect(result.content[0].text).toContain('已发布 1 个文件');
    expect(result.content[0].text).toContain('二进制文件');
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

  it('cwd fallback：未配置 allowed_paths 时只允许 cwd 内路径', async () => {
    // allowedPaths 为空 → fallback 到 process.cwd()
    // tmpDir 在 /tmp 下，不在 cwd 内 → 应被拒绝
    const file = path.join(tmpDir, 'x.py');
    await fs.writeFile(file, 'x');
    const tool = publishFilesTool(client, makeConfig('local', []));
    const result = await tool.handler({ summary: 'X', paths: [file] }, ctx);
    expect(result.content[0].text).toContain('发布被拒绝');
  });
});
