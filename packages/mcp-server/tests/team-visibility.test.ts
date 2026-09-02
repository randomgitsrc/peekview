// ─── TPV0095 team-visibility: MCP 域 TDD 测试（BDD-35~37，红灯）────────────
//
// phase: P3
// task_id: TPV0095
// parent: P2-design.md §4 MCP 设计
// trace_id: TPV0095-P3-test-designer-mcp-20260902
//
// 被测功能（P4 前全部未实现 → 本文件红灯）：
//  - create_entry / publish_files zod schema 加 team_id: z.string().optional() 且 handler 透传
//  - create_entry / publish_files description 含 TEAM VISIBILITY 引导 + "omit team_id → PUBLIC" 硬提示（BDD-37）
//  - 新增 src/tools/listTeams.ts（无参只读）并注册进 tools/index.ts common（BDD-35）
//  - client.listTeams()（GET /api/v1/teams，两分区 owned/joined）（BDD-35）
//  - get_entry 输出 base 加 team: {slug,name}|null（BDD-36）
//
// 后端侧行为（is_public=false 强制 / 非成员 404 / 全局 key 200）由 backend 批 P3/P6 覆盖，
// MCP 批只断言 MCP 层契约：schema 接受并透传 team_id、list_teams 注册与输出分区、description 硬提示、get_entry team 字段透传。

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PeekViewClient } from '../src/client.js';
import { createEntryTool } from '../src/tools/createEntry.js';
import { publishFilesTool } from '../src/tools/publishFiles.js';
import { getEntryTool } from '../src/tools/getEntry.js';
import { createTools } from '../src/tools/index.js';
import type { ServerConfig } from '../src/config.js';
import type { SessionContext } from '../src/types.js';

const mockServer = setupServer();
beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({ peekviewUrl: 'http://localhost:8080' });

const ctx: SessionContext = { userToken: 'pv_test_key', userId: 1, username: 'alice' };

function makeConfig(
  mode: 'local' | 'remote',
  allowedPaths: string[] = [],
): ServerConfig {
  return {
    peekviewUrl: 'http://localhost:8080',
    publicUrl: 'http://localhost:8080',
    port: 33333,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    logLevel: 'info',
    mode,
    allowedPaths,
    trustAllPaths: false,
    pathNamespaces: {},
  } as ServerConfig;
}

function entryResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'team-post',
    summary: 'Team Post',
    tags: [],
    files: [],
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    is_public: false,
    ...overrides,
  };
}

function rawWithFile(slug: string, summary: string) {
  return {
    slug,
    summary,
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    files: [{
      id: 1,
      filename: 'note.md',
      path: null,
      language: 'markdown',
      is_binary: false,
      size: 5,
      content: 'hello',
      content_encoding: 'utf-8',
      file_url: null,
    }],
    raw_url: `http://localhost:8080/api/v1/entries/${slug}/raw`,
  };
}

// ─── BDD-35: team_id 透传 + list_teams 两分区 ──────────────────────────────
describe('BDD-35 MCP team_id 发布 + list_teams 两分区', () => {
  it('create_entry 传 team_id → POST /api/v1/entries body 透传 team_id', async () => {
    let body: Record<string, unknown> | undefined;
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(entryResponse({ slug: 'team-post', is_public: false }));
      })
    );

    const tool = createEntryTool(client, 'https://peek.example.com');
    const result = await tool.handler({
      summary: 'Team Post',
      files: [{ filename: 'note.md', content: 'hello' }],
      team_id: 'proj-a',
    }, ctx);

    expect(result.isError).toBeFalsy();
    // 红灯：schema 无 team_id（zod strip）→ body.team_id undefined
    expect(body?.team_id).toBe('proj-a');
  });

  it('publish_files 传 team_id → POST body 透传 team_id', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-tv-pub-'));
    try {
      const file = path.join(tmpDir, 'doc.md');
      await fs.writeFile(file, '# doc');

      let body: Record<string, unknown> | undefined;
      mockServer.use(
        http.post('http://localhost:8080/api/v1/entries', async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(entryResponse({ slug: 'tv-pub', is_public: false }));
        })
      );

      const tool = publishFilesTool(client, makeConfig('local', [tmpDir]));
      const result = await tool.handler({
        summary: 'TV',
        paths: [file],
        team_id: 'proj-a',
      }, ctx);

      expect(result.isError).toBeFalsy();
      // 红灯：schema 无 team_id（zod strip）→ body.team_id undefined
      expect(body?.team_id).toBe('proj-a');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('client.listTeams() GET /api/v1/teams 带 Bearer 并返回 owned/joined 两分区', async () => {
    let capturedAuth = '';
    mockServer.use(
      http.get('http://localhost:8080/api/v1/teams', ({ request }) => {
        capturedAuth = request.headers.get('Authorization') || '';
        return HttpResponse.json({
          owned: [{ slug: 'proj-a', name: 'Proj A', member_count: 2 }],
          joined: [{ slug: 'shared-b', name: 'Shared B', member_count: 1 }],
        });
      })
    );

    // 红灯：client.listTeams 方法不存在 → TypeError
    const res = await client.listTeams(ctx.userToken);

    expect(capturedAuth).toBe('Bearer pv_test_key');
    expect(res.owned[0].slug).toBe('proj-a');
    expect(res.joined[0].slug).toBe('shared-b');
  });

  it('list_teams 注册进 remote 模式 common 工具集', () => {
    const tools = createTools(client, makeConfig('remote'));
    const names = tools.map((t) => t.name);
    // 红灯：tools/index.ts common 未注册 list_teams
    expect(names).toContain('list_teams');
  });

  it('list_teams 注册进 local 模式 common 工具集', () => {
    const tools = createTools(client, makeConfig('local', ['/tmp']));
    const names = tools.map((t) => t.name);
    // 红灯：tools/index.ts common 未注册 list_teams
    expect(names).toContain('list_teams');
  });

  it('listTeamsTool handler 无参只读：无查询参数 + Bearer + 输出 owned/joined 两分区', async () => {
    let capturedUrl = '';
    let capturedAuth = '';
    mockServer.use(
      http.get('http://localhost:8080/api/v1/teams', ({ request }) => {
        capturedUrl = request.url;
        capturedAuth = request.headers.get('Authorization') || '';
        return HttpResponse.json({
          owned: [{ slug: 'proj-a', name: 'Proj A', member_count: 2 }],
          joined: [{ slug: 'shared-b', name: 'Shared B', member_count: 1 }],
        });
      })
    );

    // 红灯：src/tools/listTeams.ts 不存在 → dynamic import 抛模块未找到
    const { listTeamsTool } = await import('../src/tools/listTeams.js');
    const tool = listTeamsTool(client);
    const result = await tool.handler({}, ctx);

    expect(result.isError).toBeFalsy();
    expect(capturedUrl).not.toContain('?');
    expect(capturedAuth).toBe('Bearer pv_test_key');
    const text = result.content[0].text;
    expect(text.toLowerCase()).toContain('owned');
    expect(text.toLowerCase()).toContain('joined');
    expect(text).toContain('proj-a');
    expect(text).toContain('shared-b');
  });
});

// ─── BDD-36: get_entry 输出含 team 字段 ─────────────────────────────────────
describe('BDD-36 MCP get_entry team 字段透传', () => {
  it('raw 响应含 team → get_entry 输出含 team: {slug,name}', async () => {
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries/team-post/raw', () => {
        return HttpResponse.json({
          ...rawWithFile('team-post', 'Team Post'),
          team: { slug: 'proj-a', name: 'Proj A' },
        });
      })
    );

    const tool = getEntryTool(client);
    const result = await tool.handler({ ref: 'team-post' }, ctx);

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text) as { team?: { slug: string; name: string } | null };
    // 红灯：buildOutput 未透传 team → parsed.team undefined
    expect(parsed.team).toEqual({ slug: 'proj-a', name: 'Proj A' });
  });

  it('raw 响应无 team → get_entry 输出 team: null', async () => {
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries/pub/raw', () => {
        return HttpResponse.json(rawWithFile('pub', 'Public Entry'));
      })
    );

    const tool = getEntryTool(client);
    const result = await tool.handler({ ref: 'pub' }, ctx);

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text) as { team?: unknown };
    // 红灯：输出对象没有 team 键（undefined）而非显式 null
    expect(parsed.team).toBeNull();
  });
});

// ─── BDD-37: description 硬提示 ────────────────────────────────────────────
describe('BDD-37 MCP description 硬提示文案', () => {
  it('create_entry description 含 TEAM VISIBILITY 引导与 omit team_id → PUBLIC 硬提示', () => {
    const tool = createEntryTool(client, 'https://peek.example.com');
    // 红灯：description 无 TEAM VISIBILITY 块
    expect(tool.description).toMatch(/TEAM VISIBILITY/);
    expect(tool.description).toMatch(/list_teams/);
    expect(tool.description).toMatch(/omit team_id/i);
    expect(tool.description).toMatch(/PUBLIC/);
  });

  it('publish_files description 含 TEAM VISIBILITY 引导与 omit team_id → PUBLIC 硬提示', () => {
    const tool = publishFilesTool(client, makeConfig('local', ['/tmp']));
    // 红灯：description 无 TEAM VISIBILITY 块
    expect(tool.description).toMatch(/TEAM VISIBILITY/);
    expect(tool.description).toMatch(/list_teams/);
    expect(tool.description).toMatch(/omit team_id/i);
    expect(tool.description).toMatch(/PUBLIC/);
  });
});
