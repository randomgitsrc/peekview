import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import YAML from 'yaml';
import { verifyAction } from '../src/cli/config.js';

describe('BDD-13: config verify 测试 allowed_paths 文件可读性', () => {
  const originalEnv = { ...process.env };
  let testHome: string;
  let readableDir: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-bdd13-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
    readableDir = mkdtempSync(join(tmpdir(), 'pv-bdd13-readable-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const restoreEnv = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, restoreEnv);
    rmSync(testHome, { recursive: true, force: true });
    rmSync(readableDir, { recursive: true, force: true });
  });

  it('BDD-13: allowed_paths 路径可读 → 输出包含可读性验证结果', async () => {
    mkdirSync(join(testHome, '.peekview'), { recursive: true });
    writeFileSync(
      join(testHome, '.peekview', 'mcp-config.yaml'),
      YAML.stringify({
        peekview: { url: 'http://test:8080', public_url: 'http://public:8080' },
        server: { mode: 'local', allowed_paths: [readableDir] },
      }),
      'utf-8'
    );

    const output: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    );

    try {
      await verifyAction();
    } catch {
      // verifyAction may call process.exit(1) for unrelated reasons; that's fine
    }

    const combined = output.join('\n');
    expect(combined).toMatch(/allowed_paths.*可读|可读性/);
    logSpy.mockRestore();
  });
});

describe('BDD-14: config verify 报告不可读的 allowed_paths', () => {
  const originalEnv = { ...process.env };
  let testHome: string;

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-bdd14-'));
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

  it('BDD-14: allowed_paths 含 /nonexistent → 输出报告不可读', async () => {
    mkdirSync(join(testHome, '.peekview'), { recursive: true });
    writeFileSync(
      join(testHome, '.peekview', 'mcp-config.yaml'),
      YAML.stringify({
        peekview: { url: 'http://test:8080', public_url: 'http://public:8080' },
        server: { mode: 'local', allowed_paths: ['/nonexistent/path/that/does/not/exist'] },
      }),
      'utf-8'
    );

    const output: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    );

    try {
      await verifyAction();
    } catch {
      // verifyAction may call process.exit(1); that's fine
    }

    const combined = output.join('\n');
    expect(combined).toMatch(/nonexistent.*不可读|不可读.*nonexistent/);
    logSpy.mockRestore();
  });
});
