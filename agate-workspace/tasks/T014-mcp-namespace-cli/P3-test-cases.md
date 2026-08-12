---
phase: P3
task_id: T014
parent: P2-design.md
trace_id: T014-P3-20260615
---

# P3 测试用例 — T014 MCP path_namespace CLI

测试文件：`packages/mcp-server/tests/cli/namespace.test.ts`

## Fixture 设计

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { saveConfigToFile, loadConfigFromFile } from '../../src/config/file.js';

describe('CLI config namespace', () => {
  let testHome: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 每个测试独立 HOME，绝不触碰 ~/.peekview
    testHome = mkdtempSync(join(tmpdir(), 'pv-ns-test-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
  });

  afterEach(() => {
    rmSync(testHome, { recursive: true, force: true });
    Object.assign(process.env, originalEnv);
  });
  
  // helper: 直接写 config 到 testHome
  function writeConfig(data: object) {
    saveConfigToFile(data as any);
  }
  function readConfig() {
    return loadConfigFromFile();
  }
```

## 测试用例

### AC1：add 新 namespace

```typescript
  it('AC1: add creates namespace mapping in config', () => {
    // 运行 CLI action（直接调 action 函数，不走命令行解析）
    invokeNamespaceAdd('docker-a', '/opt/data', '~/docker-data1');

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']?.['/opt/data'])
      .toBe('~/docker-data1');
  });
```

### AC2：add 追加到已有 namespace

```typescript
  it('AC2: add appends mapping to existing namespace', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } }
    });

    invokeNamespaceAdd('docker-a', '/opt/cache', '~/cache1');

    const config = readConfig();
    const ns = config?.server?.path_namespaces?.['docker-a'];
    expect(ns?.['/opt/data']).toBe('~/d1');   // 原映射保留
    expect(ns?.['/opt/cache']).toBe('~/cache1'); // 新映射追加
  });
```

### AC3：list 所有 namespace

```typescript
  it('AC3: list outputs all namespaces', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1' },
          'docker-b': { '/opt/data': '~/d2' },
        }
      }
    });

    const output = captureOutput(() => invokeNamespaceList(undefined));
    expect(output).toContain('docker-a');
    expect(output).toContain('docker-b');
    expect(output).toContain('/opt/data');
  });
```

### AC4：list 单个 namespace

```typescript
  it('AC4: list with ns arg shows only that namespace', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1' },
          'docker-b': { '/opt/data': '~/d2' },
        }
      }
    });

    const output = captureOutput(() => invokeNamespaceList('docker-a'));
    expect(output).toContain('docker-a');
    expect(output).not.toContain('docker-b');
  });
```

### AC5：remove 单条映射

```typescript
  it('AC5: remove single mapping leaves others intact', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1', '/opt/cache': '~/c1' }
        }
      }
    });

    invokeNamespaceRemove('docker-a', '/opt/data');

    const ns = readConfig()?.server?.path_namespaces?.['docker-a'];
    expect(ns?.['/opt/data']).toBeUndefined();
    expect(ns?.['/opt/cache']).toBe('~/c1'); // 保留
  });
```

### AC6：remove 整个 namespace

```typescript
  it('AC6: remove without container_path deletes entire namespace', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } }
    });

    invokeNamespaceRemove('docker-a', undefined, /* yes */ true);

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']).toBeUndefined();
  });
```

### AC7：container_path 非绝对路径报错

```typescript
  it('AC7: add with relative container_path exits with error', () => {
    expect(() => invokeNamespaceAdd('docker-a', 'relative/path', '~/d1'))
      .toThrow(); // 或 process.exit(1) — 视实现而定
    // 确认 config 未被修改
    expect(readConfig()?.server?.path_namespaces).toBeUndefined();
  });
```

### AC8：config list 展示 path_namespaces

```typescript
  it('AC8: config list shows path_namespaces section', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } }
    });

    const output = captureOutput(() => invokeConfigList());
    expect(output).toContain('path_namespaces');
    expect(output).toContain('docker-a');
  });
```

### AC9：无配置文件时 list 友好提示

```typescript
  it('AC9: list with no config file shows friendly message', () => {
    // testHome 下没有 .peekview/mcp-config.yaml
    const output = captureOutput(() => invokeNamespaceList(undefined));
    expect(output).toMatch(/未找到|no namespace|not configured/i);
    // 不抛异常，exit code 0
  });
```

## 辅助函数说明

`invokeNamespaceAdd / invokeNamespaceRemove / invokeNamespaceList`：
直接调用 commander action 函数，不走 `process.argv` 解析。
参考 `cli-config.test.ts` 的现有测试写法。

`captureOutput(fn)`：
临时 mock `console.log` 收集输出，返回字符串。

```typescript
function captureOutput(fn: () => void): string {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try { fn(); } finally { console.log = orig; }
  return lines.join('\n');
}
```

## 边界条件清单

| 边界 | 期望行为 |
|------|---------|
| remove 不存在的 namespace | 提示「namespace not found」，exit 1 |
| remove 不存在的 container_path | 提示「mapping not found」，exit 1 |
| 同一 container_path 多次 add | 覆盖（后面的值生效） |
| namespace ID 含特殊字符（如 `my-ns_1`）| 允许，原样存储 |
| 无 `--yes` 时 remove 整个 namespace | 提示确认，不立即执行 |
