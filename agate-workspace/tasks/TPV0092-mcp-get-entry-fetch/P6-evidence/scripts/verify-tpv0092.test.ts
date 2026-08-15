import { describe, it, beforeAll, afterAll } from 'vitest';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PeekViewClient } from '../../../../../packages/mcp-server/src/client.js';
import { getEntryTool } from '../../../../../packages/mcp-server/src/tools/getEntry.js';
import { publishFilesTool } from '../../../../../packages/mcp-server/src/tools/publishFiles.js';
import type { SessionContext } from '../../../../../packages/mcp-server/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '..');

const HOST_8888 = 'http://127.0.0.1:8888';
const HOST_8889 = 'http://127.0.0.1:8889';
const API_KEY = 'pv_QLpdLuMqffSan5nYMqhDOhA8D9851mGR';
const SHARE_TOKEN = 'DZvZ8Gu_Td5D4Fut';
const SECRET_TOKEN = 'SUPERSECRET_TOKEN_XYZ';

const client = new PeekViewClient({ peekviewUrl: HOST_8888 });
const ctx: SessionContext = { userToken: API_KEY, userId: 0, username: 'alice' };
const tool = getEntryTool(client, { peekviewUrl: HOST_8888 });

const pubConfig = {
  peekviewUrl: HOST_8888,
  publicUrl: HOST_8888,
  port: 33333,
  host: '0.0.0.0',
  corsOrigins: ['*'],
  logLevel: 'info' as const,
  mode: 'remote' as const,
  allowedPaths: [] as string[],
  trustAllPaths: false,
  pathNamespaces: {},
};
const pubTool = publishFilesTool(client, pubConfig);

interface MockServer {
  server: http.Server;
  port: number;
}

function startMock(handler: http.RequestListener): Promise<MockServer> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

function stopMock(m: MockServer): void {
  try {
    (m.server as any).closeAllConnections?.();
  } catch { /* ignore */ }
  m.server.close();
}

async function publishEntry(slug: string, summary: string, files: { filename: string; content: string }[]): Promise<void> {
  const res = await fetch(`${HOST_8888}/api/v1/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ slug, summary, files, is_public: true }),
  });
  if (!res.ok) throw new Error(`publish ${slug} failed: ${res.status} ${await res.text()}`);
}

async function deleteEntry(slug: string): Promise<void> {
  try {
    await fetch(`${HOST_8888}/api/v1/entries/${slug}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
  } catch { /* ignore cleanup errors */ }
}

function parseJson(text: string): any {
  return JSON.parse(text);
}

function writeEvidence(name: string, lines: string[]): void {
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), lines.join('\n') + '\n');
}

function mockRawJson(slug: string, summary: string, content: string, port: number) {
  return {
    slug,
    summary,
    tags: ['mock'],
    created_at: '2026-08-15T00:00:00Z',
    files: [{
      id: 1,
      filename: 'm.md',
      path: null,
      language: 'markdown',
      is_binary: false,
      size: content.length,
      content,
      content_encoding: 'utf-8',
      file_url: null,
    }],
    raw_url: `http://127.0.0.1:${port}/api/v1/entries/${slug}/raw`,
  };
}

// ---- global outcome accumulation ----
const outcomes: Array<{ bdd: string; ok: boolean; detail: string }> = [];

function record(bdd: string, ok: boolean, detail: string): void {
  outcomes.push({ bdd, ok, detail });
  const line = `${ok ? 'PASS' : 'FAIL'} ${bdd}: ${detail}\n`;
  fs.appendFileSync(path.join(EVIDENCE_DIR, 'test-output.log'), line);
}

function check(bdd: string, cond: boolean, detail: string): void {
  record(bdd, cond, detail);
  if (!cond) throw new Error(`assertion failed ${bdd}: ${detail}`);
}

const createdSlugs: string[] = [];
const mocks: MockServer[] = [];

describe('TPV0092 P6 acceptance against real debug backends', () => {
  beforeAll(async () => {
    fs.rmSync(path.join(EVIDENCE_DIR, 'test-output.log'), { force: true });
  });

  afterAll(async () => {
    for (const m of mocks) stopMock(m);
    for (const slug of createdSlugs) await deleteEntry(slug);
    const passCount = outcomes.filter(o => o.ok).length;
    const failCount = outcomes.length - passCount;
    console.log(`\nP6 SUMMARY: ${passCount}/${outcomes.length} PASS, ${failCount} FAIL`);
  });

  it('BDD-1..5 URL 形态解析（真实 :8888）', async () => {
    const log: string[] = [];
    // BDD-1 页面链接
    {
      const r = await tool.handler({ ref: `${HOST_8888}/yaml-docker-compose` }, ctx);
      const ok = !r.isError && parseJson(r.content[0].text).slug === 'yaml-docker-compose'
        && parseJson(r.content[0].text).files[0].content.length > 0;
      log.push(`ref=${HOST_8888}/yaml-docker-compose → isError=${r.isError} slug=${r.isError ? '-' : parseJson(r.content[0].text).slug} content_len=${r.isError ? '-' : parseJson(r.content[0].text).files[0].content.length}`);
      check('BDD-1', ok, '页面链接返回结构化 JSON 含 content');
    }
    // BDD-2 raw 长链接
    {
      const r = await tool.handler({ ref: `${HOST_8888}/api/v1/entries/yaml-docker-compose/raw` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const ok = !r.isError && parsed.slug === 'yaml-docker-compose' && parsed.files[0].content.length > 0;
      log.push(`ref=${HOST_8888}/api/v1/entries/yaml-docker-compose/raw → isError=${r.isError} content_len=${parsed?.files[0]?.content?.length ?? '-'}`);
      check('BDD-2', ok, 'raw 长链接返回内容，非无法识别错误');
    }
    // BDD-3 raw 短链接
    {
      const r = await tool.handler({ ref: `${HOST_8888}/yaml-docker-compose/raw` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const ok = !r.isError && parsed.slug === 'yaml-docker-compose' && parsed.files[0].content.length > 0;
      log.push(`ref=${HOST_8888}/yaml-docker-compose/raw → isError=${r.isError} slug=${parsed?.slug ?? '-'} content_len=${parsed?.files[0]?.content?.length ?? '-'}`);
      check('BDD-3', ok, 'raw 短链接直连 raw API 返回内容');
    }
    // BDD-4 裸 slug
    {
      const r = await tool.handler({ ref: 'yaml-docker-compose' }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const ok = !r.isError && parsed.slug === 'yaml-docker-compose' && parsed.files[0].content.length > 0;
      log.push(`ref=yaml-docker-compose（裸 slug，配置实例 Bearer）→ isError=${r.isError} content_len=${parsed?.files[0]?.content?.length ?? '-'}`);
      check('BDD-4', ok, '裸 slug 走配置实例返回内容（向后兼容）');
    }
    // BDD-5 分享链接
    {
      const r = await tool.handler({ ref: `${HOST_8888}/t094-p6-private?share=${SHARE_TOKEN}` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const ok = !r.isError && parsed.slug === 't094-p6-private' && parsed.files[0].content === 'private share content';
      log.push(`ref=${HOST_8888}/t094-p6-private?share=<token> → isError=${r.isError} content=${parsed?.files[0]?.content ?? '-'}`);
      check('BDD-5', ok, '分享链接透传 share token 返回私有 entry 内容');
    }
    writeEvidence('bdd-01-05-url-forms.log', log);
  }, 30000);

  it('BDD-6..8 跨 host 读取（真实 :8889 + mock 观测头）', async () => {
    const log: string[] = [];
    // BDD-6 跨 host 公开
    {
      const r = await tool.handler({ ref: `${HOST_8889}/ext-public` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const ok = !r.isError && parsed.slug === 'ext-public' && parsed.files[0].content === 'hello from external instance';
      log.push(`ref=${HOST_8889}/ext-public → isError=${r.isError} content=${parsed?.files[0]?.content ?? '-'}`);
      check('BDD-6', ok, '跨 host（:8889）公开 entry 可读');
    }
    // BDD-7 跨 host 私有无 token
    {
      const r = await tool.handler({ ref: `${HOST_8889}/ext-private-2` }, ctx);
      const ok = r.isError === true && r.content[0].text.includes('无法读取');
      log.push(`ref=${HOST_8889}/ext-private-2（无 token）→ isError=${r.isError} text=${r.content[0].text.slice(0, 60)}`);
      check('BDD-7', ok, '跨 host 私有无 token 返回明确不可读错误且不泄内容');
    }
    // BDD-8 匿名 fetch 不携带配置实例凭据
    {
      const captured: Record<string, string | null> = {};
      const mock = await startMock((req, res) => {
        captured.authorization = req.headers.authorization ?? null;
        captured.source = req.headers['x-peekview-source'] ?? null;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockRawJson('myslug', 'Mock External', 'mock public content', mock.port)));
      });
      mocks.push(mock);
      const ref = `http://127.0.0.1:${mock.port}/myslug`;
      const r = await tool.handler({ ref }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      log.push(`ref=${ref} → isError=${r.isError} captured.authorization=${JSON.stringify(captured.authorization)} captured.source=${JSON.stringify(captured.source)} content=${parsed?.files[0]?.content ?? '-'}`);
      const ok = !r.isError && parsed.files[0].content === 'mock public content'
        && captured.authorization === null
        && captured.source === 'mcp';
      check('BDD-8', ok, '跨 host 请求无 Authorization（未泄漏配置实例凭据），X-PeekView-Source=mcp');
    }
    writeEvidence('bdd-06-08-cross-host.log', log);
  }, 30000);

  it('BDD-9..11 SSRF 防护（mock 非 PeekView + 协议白名单）', async () => {
    const log: string[] = [];
    // BDD-9 非 PeekView 响应拒绝且不泄响应体
    {
      const mock = await startMock((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, data: 'SUPERSECRETBODY' }));
      });
      mocks.push(mock);
      const ref = `http://127.0.0.1:${mock.port}/fake`;
      const r = await tool.handler({ ref }, ctx);
      const text = r.content[0].text;
      log.push(`ref=${ref}（非 PeekView JSON）→ isError=${r.isError} text=${text.slice(0, 120)}`);
      const ok = r.isError === true && text.includes('无法识别') && !text.includes('SUPERSECRETBODY');
      check('BDD-9', ok, '非 PeekView 响应拒绝，错误不泄露响应体');
    }
    // BDD-10 非白名单协议
    {
      const r = await tool.handler({ ref: 'ftp://example.com/foo' }, ctx);
      const ok = r.isError === true && r.content[0].text.includes('协议不支持');
      log.push(`ref=ftp://example.com/foo → isError=${r.isError} text=${r.content[0].text.slice(0, 80)}`);
      check('BDD-10', ok, 'ftp:// 请求前拒绝');
    }
    {
      const r = await tool.handler({ ref: 'file:///etc/passwd' }, ctx);
      const ok = r.isError === true && r.content[0].text.includes('协议不支持');
      log.push(`ref=file:///etc/passwd → isError=${r.isError} text=${r.content[0].text.slice(0, 80)}`);
      check('BDD-10b', ok, 'file:// 请求前拒绝');
    }
    // BDD-11 http 非 localhost
    {
      const r = await tool.handler({ ref: 'http://example.com/foo' }, ctx);
      const ok = r.isError === true && r.content[0].text.includes('不支持的 host');
      log.push(`ref=http://example.com/foo → isError=${r.isError} text=${r.content[0].text.slice(0, 80)}`);
      check('BDD-11', ok, 'http 非 localhost 请求前拒绝');
    }
    writeEvidence('bdd-09-11-ssrf.log', log);
  }, 30000);

  it('BDD-12..14 内容净化（真实 base64 entry）', async () => {
    const log: string[] = [];
    // BDD-12 base64 图片 → 占位符保 alt
    {
      const r = await tool.handler({ ref: `${HOST_8888}/t094-p6-base64` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const content = parsed?.files[0]?.content ?? '';
      log.push(`ref=${HOST_8888}/t094-p6-base64 → isError=${r.isError} content=${JSON.stringify(content)}`);
      const ok = !r.isError && content.includes('[image: alt text') && !content.includes('iVBORw0KGgoAAAANSUhEUgAAAAE=') && content.includes('plain line after image');
      check('BDD-12', ok, 'base64 图片替换为 [image: 占位符且保留 alt text，base64 载荷不出现');
    }
    // BDD-13 二进制 content=null
    {
      const r = await tool.handler({ ref: `${HOST_8888}/unicode-filenames` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const png = parsed?.files?.find((f: any) => f.filename === 'arch.png');
      log.push(`ref=${HOST_8888}/unicode-filenames → isError=${r.isError} arch.png is_binary=${png?.is_binary} content=${JSON.stringify(png?.content)}`);
      const ok = !r.isError && png && png.is_binary === true && png.content === null;
      check('BDD-13', ok, '二进制文件 content=null 不带 base64 进上下文');
    }
    // BDD-14 无 base64 普通文本原样返回
    {
      const rawRes = await fetch(`${HOST_8888}/api/v1/entries/yaml-docker-compose/raw`);
      const raw = await rawRes.json();
      const r = await tool.handler({ ref: `${HOST_8888}/yaml-docker-compose` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      const eq = parsed?.files[0]?.content === raw.files[0].content;
      log.push(`raw_no_purify_len=${raw.files[0].content.length} get_entry_len=${parsed?.files[0]?.content?.length ?? '-'} equal=${eq}`);
      check('BDD-14', eq && !r.isError, '普通文本原样返回，未被误净化');
    }
    writeEvidence('bdd-12-14-purify.log', log);
  }, 30000);

  it('BDD-15..19 返回策略（真实发布 entry）', async () => {
    const log: string[] = [];
    // BDD-15 单文件 ≤200KB 全量
    {
      const r = await tool.handler({ ref: `${HOST_8888}/yaml-docker-compose` }, ctx);
      const parsed = parseJson(r.content[0].text);
      const full = parsed.files[0].content.length === 1810;
      log.push(`single yaml-docker-compose → files=${parsed.files.length} content_len=${parsed.files[0].content.length} warning=${JSON.stringify(parsed.warning)}`);
      check('BDD-15', !r.isError && parsed.files.length === 1 && full && parsed.warning === null, '单文件 ≤200KB 返回全量内容且无 warning');
    }
    // BDD-16 单文件 >200KB 全量 + 软警告（发布 210KB）
    {
      const slug = `p6-bdd16-${Date.now()}`;
      createdSlugs.push(slug);
      const big = 'A'.repeat(210 * 1024);
      await publishEntry(slug, 'single big file >200KB', [{ filename: 'big.txt', content: big }]);
      const r = await tool.handler({ ref: `${HOST_8888}/${slug}` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      log.push(`ref=${HOST_8888}/${slug} → isError=${r.isError} content_len=${parsed?.files[0]?.content?.length ?? '-'} warning=${JSON.stringify(parsed?.warning)}`);
      const ok = !r.isError && parsed.files[0].content.length === 210 * 1024 && parsed.warning && parsed.warning.includes('200KB');
      check('BDD-16', ok, '单文件 >200KB 返回全量并附“文件较大（>200KB）”软警告');
    }
    // BDD-17 多文件总量 ≤32KB 全量
    {
      const slug = `p6-bdd17-${Date.now()}`;
      createdSlugs.push(slug);
      await publishEntry(slug, 'multi small ≤32KB', [
        { filename: 'a.md', content: 'a'.repeat(10 * 1024) },
        { filename: 'b.py', content: 'b'.repeat(10 * 1024) },
      ]);
      const r = await tool.handler({ ref: `${HOST_8888}/${slug}` }, ctx);
      const parsed = r.isError ? null : parseJson(r.content[0].text);
      log.push(`ref=${HOST_8888}/${slug} → isError=${r.isError} files=${parsed?.files?.length} len0=${parsed?.files?.[0]?.content?.length} len1=${parsed?.files?.[1]?.content?.length} warning=${JSON.stringify(parsed?.warning)}`);
      const ok = !r.isError && parsed.files.length === 2 && parsed.files[0].content.length === 10 * 1024 && parsed.files[1].content.length === 10 * 1024 && !parsed.warning;
      check('BDD-17', ok, '多文件总量 ≤32KB 返回全部文件全量');
    }
    // BDD-18 多文件总量 >32KB 清单+片段+file= 提示
    {
      const slug = `p6-bdd18-${Date.now()}`;
      createdSlugs.push(slug);
      await publishEntry(slug, 'multi big >32KB', [
        { filename: 'a.md', content: 'a'.repeat(30 * 1024) },
        { filename: 'b.py', content: 'b'.repeat(30 * 1024) },
      ]);
      const r = await tool.handler({ ref: `${HOST_8888}/${slug}` }, ctx);
      const text = r.content[0].text;
      const parsed = r.isError ? null : parseJson(text);
      log.push(`ref=${HOST_8888}/${slug} → isError=${r.isError} files=${parsed?.files?.length} len0=${parsed?.files?.[0]?.content?.length} len1=${parsed?.files?.[1]?.content?.length} has_file_hint=${text.includes('file=')}`);
      const ok = !r.isError && parsed.files.length === 2 && parsed.files[0].content.length <= 2000 && parsed.files[0].content.length < 30 * 1024 && text.includes('file=');
      check('BDD-18', ok, '多文件 >32KB 返回片段（≤2000 字符）并提示可用 file= 取单个');
    }
    // BDD-19 file= 取单个文件全量
    {
      const slug18 = createdSlugs.filter(s => s.startsWith('p6-bdd18-'))[0];
      const r19 = await tool.handler({ ref: `${HOST_8888}/${slug18}`, file: 'a.md' }, ctx);
      const parsed = r19.isError ? null : parseJson(r19.content[0].text);
      log.push(`ref=${HOST_8888}/${slug18} file=a.md → isError=${r19.isError} files=${parsed?.files?.length} filename=${parsed?.files?.[0]?.filename} content_len=${parsed?.files?.[0]?.content?.length}`);
      const ok = !r19.isError && parsed.files.length === 1 && parsed.files[0].filename === 'a.md' && parsed.files[0].content.length === 30 * 1024;
      check('BDD-19', ok, 'file= 取单个文件全量，不返回其他文件');
    }
    writeEvidence('bdd-15-19-return-strategy.log', log);
  }, 30000);

  it('BDD-20 publish_files 返回 raw_url 且可被 get_entry 读取', async () => {
    const log: string[] = [];
    const tmpDir = os.tmpdir();
    const f = path.join(tmpDir, `p6-rawurl-${Date.now()}.md`);
    fs.writeFileSync(f, '# raw url test\nhello raw url');
    const slug = `p6-bdd20-${Date.now()}`;
    createdSlugs.push(slug);
    const r = await pubTool.handler({
      summary: 'publish files raw url test',
      paths: [f],
      slug,
      is_public: true,
    }, ctx);
    const text = r.content[0].text;
    const rawUrl = `${HOST_8888}/api/v1/entries/${slug}/raw`;
    log.push(`publish_files text:\n${text}\n--- expected raw_url line: Raw URL: ${rawUrl}`);
    const ok = !r.isError && text.includes(`Raw URL: ${rawUrl}`);
    check('BDD-20', ok, 'publish_files 返回含 {publicUrl}/api/v1/entries/{slug}/raw');
    const r2 = await tool.handler({ ref: rawUrl }, ctx);
    const parsed = r2.isError ? null : parseJson(r2.content[0].text);
    log.push(`get_entry(raw_url=${rawUrl}) → isError=${r2.isError} content=${parsed?.files?.[0]?.content ?? '-'}`);
    check('BDD-20b', !r2.isError && parsed.files[0].content.includes('hello raw url'), 'raw_url 可被 get_entry 直接读取');
    fs.rmSync(f, { force: true });
    writeEvidence('bdd-20-publish-raw-url.log', log);
  }, 30000);

  it('BDD-21..24 后端 raw 端点 ?share=/?purify= 直接 HTTP 验证', async () => {
    const log: string[] = [];
    const check200 = await fetch(`${HOST_8888}/api/v1/entries/t094-p6-private/raw?share=${SHARE_TOKEN}`);
    const body21 = await check200.text();
    const setCookie = check200.headers.get('set-cookie');
    log.push(`raw?share=<valid> → status=${check200.status} has_set_cookie=${setCookie !== null} content=${body21.includes('private share content')}`);
    check('BDD-21', check200.status === 200 && body21.includes('private share content') && setCookie === null, 'raw ?share= 有效 token 一次访问返回 200 + 内容且不设 cookie');
    const checkBad = await fetch(`${HOST_8888}/api/v1/entries/t094-p6-private/raw?share=BADTOKEN123`);
    log.push(`raw?share=BADTOKEN123 → status=${checkBad.status}`);
    check('BDD-22', checkBad.status === 404, 'raw ?share= 无效 token 返回 404（不泄露存在性）');
    const pur = await fetch(`${HOST_8888}/api/v1/entries/t094-p6-base64/raw?purify=true`);
    const pbody = await pur.text();
    const rawNoQ = await fetch(`${HOST_8888}/api/v1/entries/t094-p6-base64/raw`);
    const rbody = await rawNoQ.text();
    log.push(`raw?purify=true → status=${pur.status} purified_len=${pbody.length} has_placeholder=${pbody.includes('[image: alt text')} has_b64=${pbody.includes('iVBORw0KGgoAAAANSUhEUgAAAAE=')}`);
    log.push(`raw (no query) → status=${rawNoQ.status} raw_len=${rbody.length} has_b64=${rbody.includes('iVBORw0KGgoAAAANSUhEUgAAAAE=')}`);
    check('BDD-23', pur.status === 200 && pbody.includes('[image: alt text') && !pbody.includes('iVBORw0KGgoAAAANSUhEUgAAAAE=') && pbody.length < rbody.length, 'raw ?purify=true 剥离 base64 图片为占位符且响应体积减小');
    check('BDD-24', rawNoQ.status === 200 && rbody.includes('iVBORw0KGgoAAAANSUhEUgAAAAE='), 'raw 无 query 向后兼容（返回原样含 base64）');
    writeEvidence('bdd-21-24-backend-raw.log', log);
  }, 30000);

  it('BDD-25 错误消息不打印 share token 明文', async () => {
    const log: string[] = [];
    const r = await tool.handler({ ref: `${HOST_8888}/t094-p6-private?share=${SECRET_TOKEN}` }, ctx);
    const text = r.content[0].text;
    log.push(`ref=.../t094-p6-private?share=<SECRET_TOKEN> → isError=${r.isError} text=${JSON.stringify(text)}`);
    log.push(`contains_secret_token=${text.includes(SECRET_TOKEN)} contains_full_url=${text.includes(`${HOST_8888}/t094-p6-private?share=${SECRET_TOKEN}`)}`);
    const ok = r.isError === true && text.includes('无法读取') && !text.includes(SECRET_TOKEN) && !text.includes(`share=${SECRET_TOKEN}`);
    check('BDD-25', ok, '错误消息不含 share token 明文，也不含完整 URL');
    writeEvidence('bdd-25-token-redaction.log', log);
  }, 30000);

  it('BDD-26 fetch 超时返回明确错误而非挂起', async () => {
    const log: string[] = [];
    const hanging = await startMock((_req, _res) => { /* never respond */ });
    mocks.push(hanging);
    const started = Date.now();
    let timedOut = false;
    let errMsg = '';
    try {
      await client.fetchEntryRaw(`http://127.0.0.1:${hanging.port}`, 'hang', { timeoutMs: 1500 });
    } catch (e) {
      timedOut = true;
      errMsg = e instanceof Error ? e.message : String(e);
    }
    const elapsed = Date.now() - started;
    const abortLike = /abort/i.test(errMsg) || /timeout/i.test(errMsg);
    log.push(`hanging server ref → timed_out=${timedOut} elapsed_ms=${elapsed} err=${JSON.stringify(errMsg)}`);
    const ok = timedOut === true && abortLike && elapsed >= 1000 && elapsed < 15000;
    check('BDD-26', ok, '挂起服务器在超时阈值内返回明确超时错误而非无限挂起');
    stopMock(hanging);
    mocks.splice(mocks.indexOf(hanging), 1);
    writeEvidence('bdd-26-timeout.log', log);
  }, 30000);
});
