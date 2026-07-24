import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import YAML from 'yaml';
import { configListAction } from '../src/cli/config.js';

describe('BDD-10: config list 显示运行时 cwd', () => {
  const originalEnv = { ...process.env };
  let testHome: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-bdd10-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const restoreEnv = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, restoreEnv);
    rmSync(testHome, { recursive: true, force: true });
  });

  it('BDD-10: config list 输出包含 cwd 信息', () => {
    mkdirSync(join(testHome, '.peekview'), { recursive: true });
    writeFileSync(
      join(testHome, '.peekview', 'mcp-config.yaml'),
      YAML.stringify({
        peekview: { url: 'http://test:8080', public_url: 'http://public:8080' },
        server: { mode: 'local' },
      }),
      'utf-8'
    );

    const output: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });

    configListAction();

    const combined = output.join('\n');
    expect(combined).toMatch(/runtime:|cwd:\s*\//);
    logSpy.mockRestore();
  });
});

describe('BDD-11: config list 显示 env 覆盖后的最终生效值', () => {
  const originalEnv = { ...process.env };
  let testHome: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-bdd11-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
    process.env.PEEKVIEW_URL = 'http://test:8080';
    process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
    process.env.MCP_ALLOWED_PATHS = '/data:/tmp';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const restoreEnv = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, restoreEnv);
    rmSync(testHome, { recursive: true, force: true });
  });

  it('BDD-11: env MCP_ALLOWED_PATHS 覆盖文件配置，config list 显示最终值', () => {
    mkdirSync(join(testHome, '.peekview'), { recursive: true });
    writeFileSync(
      join(testHome, '.peekview', 'mcp-config.yaml'),
      YAML.stringify({
        peekview: { url: 'http://test:8080', public_url: 'http://public:8080' },
        server: { mode: 'local' },
      }),
      'utf-8'
    );

    const output: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });

    configListAction();

    const combined = output.join('\n');
    expect(combined).toMatch(/\/data.*\/tmp|\/data:\/tmp/);
    logSpy.mockRestore();
  });
});

describe('BDD-12: config list 新增字段不改变现有输出格式', () => {
  const originalEnv = { ...process.env };
  let testHome: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-bdd12-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const restoreEnv = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, restoreEnv);
    rmSync(testHome, { recursive: true, force: true });
  });

  it('BDD-12: 现有字段（server/port/url 等）格式不变，新增字段追加', () => {
    mkdirSync(join(testHome, '.peekview'), { recursive: true });
    writeFileSync(
      join(testHome, '.peekview', 'mcp-config.yaml'),
      YAML.stringify({
        peekview: { url: 'http://test:8080', public_url: 'http://public:8080' },
        server: { port: 44444, host: '127.0.0.1', mode: 'local' },
        logging: { level: 'debug' },
      }),
      'utf-8'
    );

    const output: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });

    configListAction();

    const combined = output.join('\n');
    expect(combined).toContain('44444');
    expect(combined).toContain('127.0.0.1');
    expect(combined).toContain('debug');
    expect(combined).toMatch(/port/i);
    expect(combined).toMatch(/host/i);
    logSpy.mockRestore();
  });
});
