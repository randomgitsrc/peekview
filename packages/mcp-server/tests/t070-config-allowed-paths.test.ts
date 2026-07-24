import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mergeConfig } from '../src/config/merge.js';
import type { ConfigFileData } from '../src/config/file.js';

describe('BDD-7: YAML 文件中 allowed_paths 写为冒号分隔字符串时自动解析为数组', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('BDD-7: allowed_paths 为字符串 "/data:/tmp" → 解析为 ["/data", "/tmp"]', () => {
    process.env.PEEKVIEW_URL = 'http://test:8080';
    process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

    const fileConfig = {
      server: {
        allowed_paths: '/data:/tmp' as unknown as string[],
      },
    };

    const result = mergeConfig(fileConfig as ConfigFileData, process.env);
    expect(result.allowedPaths).toEqual(['/data', '/tmp']);
  });
});

describe('BDD-8: YAML 文件中 allowed_paths 写为数组时正常工作', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('BDD-8: allowed_paths 为数组 ["/data", "/tmp"] → 正常解析', () => {
    process.env.PEEKVIEW_URL = 'http://test:8080';
    process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';

    const fileConfig: ConfigFileData = {
      server: {
        allowed_paths: ['/data', '/tmp'],
      },
    };

    const result = mergeConfig(fileConfig, process.env);
    expect(result.allowedPaths).toEqual(['/data', '/tmp']);
  });
});

describe('BDD-9: 空 allowed_paths 数组等同于未配置', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('BDD-9: allowed_paths=[] → 视为未配置，allowedPaths 为空数组', () => {
    process.env.PEEKVIEW_URL = 'http://test:8080';
    process.env.PEEKVIEW_PUBLIC_URL = 'http://public:8080';
    process.env.MCP_MODE = 'local';

    const fileConfig: ConfigFileData = {
      server: {
        allowed_paths: [],
      },
    };

    const result = mergeConfig(fileConfig, process.env);
    expect(result.allowedPaths).toEqual([]);
  });
});
