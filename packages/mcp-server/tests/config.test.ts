import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Config', () => {
  const originalEnv = { ...process.env };
  let testHome: string;

  function restoreEnv() {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-config-test-'));
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, {
      PEEKVIEW_URL: 'http://localhost:8080',
      PEEKVIEW_PUBLIC_URL: 'http://localhost:8080',
      HOME: testHome,
      USERPROFILE: testHome,
    });
  });

  afterEach(() => {
    restoreEnv();
    rmSync(testHome, { recursive: true, force: true });
  });

  it('should load valid config without MCP_TOKEN and PEEKVIEW_API_KEY', () => {
    const config = loadConfig();

    expect(config.peekviewUrl).toBe('http://localhost:8080');
    expect(config.publicUrl).toBe('http://localhost:8080');
    expect(config.port).toBe(33333);
    expect(config.host).toBe('0.0.0.0');
    expect(config.corsOrigins).toEqual(['*']);
    expect(config.logLevel).toBe('info');
  });

  it('should remove trailing slash from PEEKVIEW_URL', () => {
    process.env.PEEKVIEW_URL = 'http://localhost:8080/';

    const config = loadConfig();
    expect(config.peekviewUrl).toBe('http://localhost:8080');
  });

  it('should remove trailing slash from PEEKVIEW_PUBLIC_URL', () => {
    process.env.PEEKVIEW_PUBLIC_URL = 'https://peek.example.com/';

    const config = loadConfig();
    expect(config.publicUrl).toBe('https://peek.example.com');
  });

  it('should throw on missing PEEKVIEW_URL', () => {
    delete process.env.PEEKVIEW_URL;
    delete process.env.PEEKVIEW_PUBLIC_URL;

    expect(() => loadConfig()).toThrow('PEEKVIEW_URL');
  });

  it('should throw on missing PEEKVIEW_PUBLIC_URL', () => {
    delete process.env.PEEKVIEW_PUBLIC_URL;
    delete process.env.PEEKVIEW_URL;

    expect(() => loadConfig()).toThrow('PEEKVIEW_PUBLIC_URL');
  });

  it('should use custom port', () => {
    process.env.MCP_PORT = '4000';

    const config = loadConfig();
    expect(config.port).toBe(4000);
  });

  it('should parse CORS origins as comma-separated', () => {
    process.env.MCP_CORS_ORIGINS = 'https://claude.ai,https://cursor.sh';

    const config = loadConfig();
    expect(config.corsOrigins).toEqual(['https://claude.ai', 'https://cursor.sh']);
  });

  it('should NOT require MCP_TOKEN', () => {
    // MCP_TOKEN is no longer a required config
    delete process.env.MCP_TOKEN;

    const config = loadConfig();
    // Should not throw - MCP_TOKEN removed from schema
    expect(config).toBeDefined();
  });

  it('should NOT require PEEKVIEW_API_KEY', () => {
    // PEEKVIEW_API_KEY is no longer a required config
    delete process.env.PEEKVIEW_API_KEY;

    const config = loadConfig();
    // Should not throw - PEEKVIEW_API_KEY removed from schema
    expect(config).toBeDefined();
  });
});