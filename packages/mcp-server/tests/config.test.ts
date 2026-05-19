import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set required env vars for each test
    process.env.PEEKVIEW_URL = 'http://localhost:8080';
    process.env.PEEKVIEW_PUBLIC_URL = 'http://localhost:8080';
    process.env.PEEKVIEW_API_KEY = 'pv_test_key';
    process.env.MCP_TOKEN = 'mct_test_token';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load valid config', () => {
    const config = loadConfig();

    expect(config.peekviewUrl).toBe('http://localhost:8080');
    expect(config.publicUrl).toBe('http://localhost:8080');
    expect(config.apiKey).toBe('pv_test_key');
    expect(config.mcpToken).toBe('mct_test_token');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
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

    expect(() => loadConfig()).toThrow('PEEKVIEW_URL');
  });

  it('should throw on missing PEEKVIEW_PUBLIC_URL', () => {
    delete process.env.PEEKVIEW_PUBLIC_URL;

    expect(() => loadConfig()).toThrow('PEEKVIEW_PUBLIC_URL');
  });

  it('should throw on missing PEEKVIEW_API_KEY', () => {
    delete process.env.PEEKVIEW_API_KEY;

    expect(() => loadConfig()).toThrow('PEEKVIEW_API_KEY');
  });

  it('should throw on missing MCP_TOKEN', () => {
    delete process.env.MCP_TOKEN;

    expect(() => loadConfig()).toThrow('MCP_TOKEN');
  });

  it('should use custom port', () => {
    process.env.MCP_PORT = '4000';

    const config = loadConfig();
    expect(config.port).toBe(4000);
  });
});
