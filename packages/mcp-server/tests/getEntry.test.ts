import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';
import { getEntryTool } from '../src/tools/getEntry.js';
import type { SessionContext } from '../src/types.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

const config = {
  peekviewUrl: 'http://localhost:8080',
  publicUrl: 'http://localhost:8080',
  port: 33333,
  host: '0.0.0.0',
  corsOrigins: ['*'],
  logLevel: 'info' as const,
  mode: 'remote' as const,
  allowedPaths: [] as string[],
  trustAllPaths: false,
  pathNamespaces: {},
};

const ctx: SessionContext = { userToken: 'pv_test_key', userId: 1, username: 'alice' };

const tool = () => getEntryTool(client, config);

function rawResponse(slug: string, summary: string, files: unknown[]) {
  return {
    slug,
    summary,
    tags: ['t1'],
    created_at: '2026-01-01T00:00:00Z',
    files,
    raw_url: `http://localhost:8080/api/v1/entries/${slug}/raw`,
  };
}

function textFile(filename: string, content: string, path: string | null = null) {
  return {
    id: 1,
    filename,
    path,
    language: 'markdown',
    is_binary: false,
    size: content.length,
    content,
    content_encoding: 'utf-8',
    file_url: null,
  };
}

function binaryFile(filename: string, size: number) {
  return {
    id: 2,
    filename,
    path: null,
    language: null,
    is_binary: true,
    size,
    content: null,
    content_encoding: null,
    file_url: `http://localhost:8080/api/v1/entries/x/files/2/content`,
  };
}

function parseJson(text: string): any {
  return JSON.parse(text);
}

describe('get_entry 任意 PeekView 链接', () => {
  it('BDD-1 页面链接返回结构化 JSON 含内容', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/my-slug/raw', () => {
        return HttpResponse.json(rawResponse('my-slug', 'Page Entry', [textFile('note.md', 'hello world')]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/my-slug' }, ctx);

    expect(result.isError).toBeFalsy();
    const parsed = parseJson(result.content[0].text);
    expect(parsed.slug).toBe('my-slug');
    expect(parsed.summary).toBe('Page Entry');
    expect(parsed.files[0].content).toBe('hello world');
  });

  it('BDD-2 raw 长链接返回内容', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/my-slug/raw', () => {
        return HttpResponse.json(rawResponse('my-slug', 'Raw Long', [textFile('a.py', 'print(1)')]));
      })
    );

    const result = await tool().handler(
      { ref: 'https://example.com/api/v1/entries/my-slug/raw' }, ctx
    );

    expect(result.isError).toBeFalsy();
    expect(parseJson(result.content[0].text).files[0].content).toBe('print(1)');
  });

  it('BDD-3 raw 短链接返回内容', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/my-slug/raw', () => {
        return HttpResponse.json(rawResponse('my-slug', 'Raw Short', [textFile('b.txt', 'short')]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/my-slug/raw' }, ctx);

    expect(result.isError).toBeFalsy();
    expect(parseJson(result.content[0].text).files[0].content).toBe('short');
  });

  it('BDD-4 裸 slug 走配置实例带 Bearer 并返回内容', async () => {
    let capturedAuth = '';
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries/my-slug/raw', ({ request }) => {
        capturedAuth = request.headers.get('Authorization') || '';
        return HttpResponse.json(rawResponse('my-slug', 'Bare Slug', [textFile('c.md', 'bare content')]));
      })
    );

    const result = await tool().handler({ ref: 'my-slug' }, ctx);

    expect(result.isError).toBeFalsy();
    expect(capturedAuth).toBe('Bearer pv_test_key');
    expect(parseJson(result.content[0].text).files[0].content).toBe('bare content');
  });

  it('BDD-5 分享链接解析并透传 share token 读取私有内容', async () => {
    let capturedShare = '';
    mockServer.use(
      http.get('https://example.com/api/v1/entries/priv/raw', ({ request }) => {
        capturedShare = new URL(request.url).searchParams.get('share') || '';
        return HttpResponse.json(rawResponse('priv', 'Private via share', [textFile('secret.md', 'top secret')]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/priv?share=secret-token' }, ctx);

    expect(result.isError).toBeFalsy();
    expect(capturedShare).toBe('secret-token');
    expect(parseJson(result.content[0].text).files[0].content).toBe('top secret');
  });

  it('BDD-6 跨 host 读取公开 entry', async () => {
    mockServer.use(
      http.get('https://external.example.com/api/v1/entries/ext/raw', () => {
        return HttpResponse.json(rawResponse('ext', 'External Host', [textFile('e.md', 'from another host')]));
      })
    );

    const result = await tool().handler({ ref: 'https://external.example.com/ext' }, ctx);

    expect(result.isError).toBeFalsy();
    expect(parseJson(result.content[0].text).files[0].content).toBe('from another host');
  });

  it('BDD-7 跨 host 私有无 token → 明确不可读错误', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/priv/raw', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/priv' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('无法读取');
  });

  it('BDD-8 URL 形态请求不携带配置实例凭据（无 Authorization）', async () => {
    let capturedAuth: string | null = null;
    let capturedSource = '';
    mockServer.use(
      http.get('https://example.com/api/v1/entries/pub/raw', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        capturedSource = request.headers.get('X-PeekView-Source') || '';
        return HttpResponse.json(rawResponse('pub', 'Public', [textFile('p.md', 'public content')]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/pub' }, ctx);

    expect(result.isError).toBeFalsy();
    expect(capturedAuth).toBeNull();
    expect(capturedSource).toBe('mcp');
    expect(parseJson(result.content[0].text).files[0].content).toBe('public content');
  });

  it('BDD-9 非 PeekView 响应 → 无法识别且不泄露响应体', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/fake/raw', () => {
        return HttpResponse.json({ ok: true, data: 'SUPERSECRETBODY' });
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/fake' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('无法识别');
    expect(result.content[0].text).not.toContain('SUPERSECRETBODY');
  });

  it('BDD-13 二进制文件 content 为 null', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/bin/raw', () => {
        return HttpResponse.json(rawResponse('bin', 'Binary Entry', [binaryFile('img.png', 1024)]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/bin' }, ctx);

    expect(result.isError).toBeFalsy();
    const parsed = parseJson(result.content[0].text);
    expect(parsed.files[0].is_binary).toBe(true);
    expect(parsed.files[0].content).toBeNull();
  });

  it('BDD-15 单文件 ≤200KB 返回全量内容', async () => {
    const content = 'x'.repeat(100 * 1024);
    mockServer.use(
      http.get('https://example.com/api/v1/entries/single/raw', () => {
        return HttpResponse.json(rawResponse('single', 'Single', [textFile('big.txt', content)]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/single' }, ctx);

    const parsed = parseJson(result.content[0].text);
    expect(parsed.files[0].content).toBe(content);
    expect(parsed.warning).toBeFalsy();
  });

  it('BDD-16 单文件 >200KB 全量 + 软警告', async () => {
    const content = 'y'.repeat(200 * 1024 + 1);
    mockServer.use(
      http.get('https://example.com/api/v1/entries/big/raw', () => {
        return HttpResponse.json(rawResponse('big', 'Big File', [textFile('huge.md', content)]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/big' }, ctx);

    const parsed = parseJson(result.content[0].text);
    expect(parsed.files[0].content).toBe(content);
    expect(parsed.warning).toBeTruthy();
  });

  it('BDD-17 多文件总量 ≤32KB 全部全量', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/multi/raw', () => {
        return HttpResponse.json(rawResponse('multi', 'Multi Small', [
          textFile('a.md', 'a'.repeat(10 * 1024)),
          textFile('b.py', 'b'.repeat(10 * 1024)),
        ]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/multi' }, ctx);

    const parsed = parseJson(result.content[0].text);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].content).toBe('a'.repeat(10 * 1024));
    expect(parsed.files[1].content).toBe('b'.repeat(10 * 1024));
  });

  it('BDD-18 多文件总量 >32KB 返回清单与片段 + file= 提示', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/many/raw', () => {
        return HttpResponse.json(rawResponse('many', 'Many Big', [
          textFile('a.md', 'a'.repeat(30 * 1024)),
          textFile('b.py', 'b'.repeat(30 * 1024)),
        ]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/many' }, ctx);

    const parsed = parseJson(result.content[0].text);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].content.length).toBeLessThanOrEqual(2000);
    expect(parsed.files[0].content).not.toBe('a'.repeat(30 * 1024));
    expect(result.content[0].text).toContain('file=');
  });

  it('BDD-19 file= 取单个文件全量（path+filename 优先）', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/pick/raw', () => {
        return HttpResponse.json(rawResponse('pick', 'Pick One', [
          textFile('app.py', 'def app(): pass', 'src'),
          textFile('readme.md', 'r'.repeat(30 * 1024)),
        ]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/pick', file: 'src/app.py' }, ctx);

    expect(result.isError).toBeFalsy();
    const parsed = parseJson(result.content[0].text);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].filename).toBe('app.py');
    expect(parsed.files[0].content).toBe('def app(): pass');
  });

  it('BDD-19 file= 无匹配 → 错误并列出可用文件', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/pick/raw', () => {
        return HttpResponse.json(rawResponse('pick', 'Pick One', [
          textFile('app.py', 'code'),
          textFile('readme.md', 'readme'),
        ]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/pick', file: 'missing.py' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('app.py');
    expect(result.content[0].text).toContain('readme.md');
  });

  it('BDD-19 file= 多匹配 → 要求更精确', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/dup/raw', () => {
        return HttpResponse.json(rawResponse('dup', 'Dup', [
          textFile('x.md', 'one', 'a'),
          textFile('x.md', 'two', 'b'),
        ]));
      })
    );

    const result = await tool().handler({ ref: 'https://example.com/dup', file: 'x.md' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/更精确|多个|multiple|模糊/i);
  });

  it('BDD-25 错误消息不含 share token 明文与完整 URL', async () => {
    mockServer.use(
      http.get('https://example.com/api/v1/entries/priv/raw', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const result = await tool().handler(
      { ref: 'https://example.com/priv?share=KNOWNTOKEN123' }, ctx
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('无法读取');
    expect(result.content[0].text).not.toContain('KNOWNTOKEN123');
    expect(result.content[0].text).not.toContain('share=KNOWNTOKEN123');
  });
});
