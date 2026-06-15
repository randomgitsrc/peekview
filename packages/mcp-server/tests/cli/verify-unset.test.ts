import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { saveConfigToFile, loadConfigFromFile } from '../../src/config/file.js';
import { verifyAction, unsetAction } from '../../src/cli/config.js';

describe('CLI config verify + unset', () => {
  let testHome: string;
  const originalEnv = { ...process.env };

  function restoreEnv() {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-verify-test-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
    rmSync(testHome, { recursive: true, force: true });
  });

  async function captureVerifyResult(): Promise<{ output: string; exitCode: number }> {
    const lines: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    const origExit = process.exit;
    let exitCode = 0;

    console.log = (...args: unknown[]) => lines.push(args.join(' '));
    console.error = (...args: unknown[]) => lines.push(args.join(' '));
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      await verifyAction();
    } catch (e) {
      if (!(e instanceof Error && e.message === 'EXIT')) throw e;
    } finally {
      console.log = origLog;
      console.error = origError;
      process.exit = origExit;
    }

    return { output: lines.join('\n'), exitCode };
  }

  function captureOutput(fn: () => void): string {
    const lines: string[] = [];
    const orig = console.log;
    const origError = console.error;
    console.log = (...args: unknown[]) => lines.push(args.join(' '));
    console.error = (...args: unknown[]) => lines.push(args.join(' '));
    try { fn(); } finally { console.log = orig; console.error = origError; }
    return lines.join('\n');
  }

  function captureUnsetResult(key: string): { output: string; exitCode: number } {
    const lines: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    const origExit = process.exit;
    let exitCode = 0;

    console.log = (...args: unknown[]) => lines.push(args.join(' '));
    console.error = (...args: unknown[]) => lines.push(args.join(' '));
    process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

    try {
      unsetAction(key);
    } catch (e) {
      if (!(e instanceof Error && e.message === 'EXIT')) throw e;
    } finally {
      console.log = origLog;
      console.error = origError;
      process.exit = origExit;
    }

    return { output: lines.join('\n'), exitCode };
  }

  // ── verify tests ────────────────────────────────────────────────────────

  it('AC1: verify passes when all config is valid and backend reachable', async () => {
    saveConfigToFile({
      peekview: {
        url: 'http://127.0.0.1:8080',
        api_key: 'pv_validkey123',
        public_url: 'http://example.com',
      }
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('✅');
    expect(output).not.toContain('❌');
    expect(exitCode).toBe(0);
  });

  it('AC2: verify fails when URL is unreachable', async () => {
    saveConfigToFile({ peekview: { url: 'http://127.0.0.1:9999' } });

    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValue(new Error('Connection refused'))
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toContain('连接失败');
    expect(exitCode).toBe(1);
  });

  it('AC3: verify reports auth failure when api_key returns 401', async () => {
    saveConfigToFile({
      peekview: { url: 'http://127.0.0.1:8080', api_key: 'pv_badkey' }
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toContain('401');
    expect(exitCode).toBe(1);
  });

  it('AC4: verify exits early when config file missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toMatch(/配置文件不存在|config.*not.*found/i);
    expect(exitCode).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AC5: verify exits early when peekview.url not set', async () => {
    saveConfigToFile({ logging: { level: 'info' } });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toMatch(/peekview\.url.*未配置|peekview\.url.*required/i);
    expect(exitCode).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verify shows warning (not error) when api_key not configured', async () => {
    saveConfigToFile({ peekview: { url: 'http://127.0.0.1:8080' } });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('⚠');
    expect(output).toMatch(/api_key.*未配置/i);
    expect(exitCode).toBe(0);
  });

  it('verify validates URL format before making HTTP request', async () => {
    saveConfigToFile({ peekview: { url: 'ftp://bad-url' } });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toMatch(/格式错误|format/i);
    expect(exitCode).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verify treats 403 as valid authentication', async () => {
    saveConfigToFile({
      peekview: { url: 'http://127.0.0.1:8080', api_key: 'pv_limitedkey' }
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('✅');
    expect(exitCode).toBe(0);
  });

  // ── unset tests ─────────────────────────────────────────────────────────

  it('AC6: unset removes existing key from config', () => {
    saveConfigToFile({ peekview: { url: 'http://test', api_key: 'pv_key' } });

    const { exitCode } = captureUnsetResult('peekview.url');

    const config = loadConfigFromFile();
    expect(config?.peekview?.url).toBeUndefined();
    expect(config?.peekview?.api_key).toBe('pv_key');
    expect(exitCode).toBe(0);
  });

  it('AC7: unset deletes empty section after removing last key', () => {
    saveConfigToFile({ peekview: { url: 'http://test' } });

    captureUnsetResult('peekview.url');

    const config = loadConfigFromFile();
    expect(config?.peekview).toBeUndefined();
  });

  it('AC8: unset of non-existent key exits 0 with friendly message', () => {
    saveConfigToFile({ peekview: { api_key: 'pv_key' } });

    const { output, exitCode } = captureUnsetResult('peekview.url');
    expect(output).toMatch(/未设置|not set/i);
    expect(exitCode).toBe(0);
  });

  it('AC9: unset with invalid key format exits 1 with error', () => {
    const { output, exitCode } = captureUnsetResult('invalidkey');
    expect(exitCode).toBe(1);
    expect(output).toMatch(/格式|format/i);
  });

  it('unset with no config file exits 0 with friendly message', () => {
    const { output, exitCode } = captureUnsetResult('peekview.url');
    expect(output).toMatch(/未设置|not set/i);
    expect(exitCode).toBe(0);
  });

  it('unset with too many dot segments exits 1', () => {
    const { exitCode } = captureUnsetResult('a.b.c');
    expect(exitCode).toBe(1);
  });
});
