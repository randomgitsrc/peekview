import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mergeConfig } from '../src/config/merge.js';
import type { ConfigFileData } from '../src/config/file.js';

describe('Config Merge', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Priority: Env > File > Default', () => {
    it('should use defaults when no file and no env', () => {
      // Set required env vars
      process.env.PEEKVIEW_URL = 'http://test:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
      // Other values use defaults

      const fileConfig: ConfigFileData | null = null;
      const result = mergeConfig(fileConfig, process.env);

      expect(result.port).toBe(33333);
      expect(result.host).toBe('0.0.0.0');
      expect(result.logLevel).toBe('info');
    });

    it('should use file config when no env override', () => {
      // Set required env vars, but not port
      process.env.PEEKVIEW_URL = 'http://test:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

      const fileConfig: ConfigFileData = {
        server: {
          port: 44444,
          host: '127.0.0.1',
        },
      };

      const result = mergeConfig(fileConfig, process.env);

      expect(result.port).toBe(44444);
      expect(result.host).toBe('127.0.0.1');
    });

    it('should use env over file config', () => {
      process.env.PEEKVIEW_URL = 'http://env-url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://env-public:8080';
      process.env.MCP_PORT = '55555';

      const fileConfig: ConfigFileData = {
        peekview: {
          url: 'http://file-url:8080',
          public_url: 'http://file-public:8080',
        },
        server: {
          port: 44444,
        },
      };

      const result = mergeConfig(fileConfig, process.env);

      expect(result.peekviewUrl).toBe('http://env-url:8080');
      expect(result.publicUrl).toBe('http://env-public:8080');
      expect(result.port).toBe(55555);
    });

    it('should merge partially - env overrides only specific keys', () => {
      process.env.PEEKVIEW_URL = 'http://file-url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://file-public:8080';
      process.env.MCP_PORT = '66666';
      // MCP_HOST not set

      const fileConfig: ConfigFileData = {
        server: {
          port: 44444,
          host: '127.0.0.1',
        },
      };

      const result = mergeConfig(fileConfig, process.env);

      // Port from env
      expect(result.port).toBe(66666);
      // Host from file
      expect(result.host).toBe('127.0.0.1');
    });

    it('should remove trailing slash from URLs', () => {
      process.env.PEEKVIEW_URL = 'http://example.com/';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public.com/';

      const result = mergeConfig(null, process.env);

      expect(result.peekviewUrl).toBe('http://example.com');
      expect(result.publicUrl).toBe('http://public.com');
    });

    it('should throw on missing required PEEKVIEW_URL', () => {
      delete process.env.PEEKVIEW_URL;
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

      expect(() => mergeConfig(null, process.env)).toThrow('PEEKVIEW_URL');
    });

    it('should throw on missing required PEEKVIEW_PUBLIC_URL', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      delete process.env.PEEKVIEW_PUBLIC_URL;

      expect(() => mergeConfig(null, process.env)).toThrow('PEEKVIEW_PUBLIC_URL');
    });

    it('should use PEEKVIEW_API_KEY from env', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
      process.env.PEEKVIEW_API_KEY = 'pv_test_key';

      const result = mergeConfig(null, process.env);

      expect(result.apiKey).toBe('pv_test_key');
    });
  });

  describe('CORS origins parsing', () => {
    it('should parse comma-separated origins', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
      process.env.MCP_CORS_ORIGINS = 'https://a.com,https://b.com';

      const result = mergeConfig(null, process.env);

      expect(result.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    });

    it('should use default * when no CORS env', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

      const result = mergeConfig(null, process.env);

      expect(result.corsOrigins).toEqual(['*']);
    });
  });

  describe('Logging level', () => {
    it('should use custom log level from env', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
      process.env.MCP_LOG_LEVEL = 'debug';

      const result = mergeConfig(null, process.env);

      expect(result.logLevel).toBe('debug');
    });

    it('should use log level from file', () => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

      const fileConfig: ConfigFileData = {
        logging: {
          level: 'error',
        },
      };

      const result = mergeConfig(fileConfig, process.env);

      expect(result.logLevel).toBe('error');
    });
  });

  describe('mode / allowedPaths（双模式）', () => {
    beforeEach(() => {
      process.env.PEEKVIEW_URL = 'http://url:8080';
      process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
    });

    it('默认 mode 为 remote', () => {
      const result = mergeConfig(null, process.env);
      expect(result.mode).toBe('remote');
      expect(result.allowedPaths).toEqual([]);
    });

    it('从文件读取 mode=local 和 allowed_paths', () => {
      const fileConfig: ConfigFileData = {
        server: { mode: 'local', allowed_paths: ['/home/alice/projects', '/tmp'] },
      };
      const result = mergeConfig(fileConfig, process.env);
      expect(result.mode).toBe('local');
      expect(result.allowedPaths).toEqual(['/home/alice/projects', '/tmp']);
    });

    it('环境变量 MCP_MODE 覆盖文件', () => {
      process.env.MCP_MODE = 'local';
      const fileConfig: ConfigFileData = { server: { mode: 'remote' } };
      const result = mergeConfig(fileConfig, process.env);
      expect(result.mode).toBe('local');
    });

    it('环境变量 MCP_ALLOWED_PATHS 冒号分隔覆盖文件', () => {
      process.env.MCP_ALLOWED_PATHS = '/a:/b:/c';
      const fileConfig: ConfigFileData = {
        server: { allowed_paths: ['/should-be-overridden'] },
      };
      const result = mergeConfig(fileConfig, process.env);
      expect(result.allowedPaths).toEqual(['/a', '/b', '/c']);
    });

    it('非法 mode 值抛错', () => {
      process.env.MCP_MODE = 'invalid';
      expect(() => mergeConfig(null, process.env)).toThrow(/must be 'local' or 'remote'/);
    });

    it('local 模式无 allowed_paths 不抛错（仅 warning + cwd fallback）', () => {
      const fileConfig: ConfigFileData = { server: { mode: 'local' } };
      const result = mergeConfig(fileConfig, process.env);
      expect(result.mode).toBe('local');
      expect(result.allowedPaths).toEqual([]);
    });
  });
});
