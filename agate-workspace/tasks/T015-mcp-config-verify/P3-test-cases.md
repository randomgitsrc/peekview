---
phase: P3
task_id: T015
parent: P2-design.md
trace_id: T015-P3-20260615
---

# P3 测试用例 — T015 MCP config verify + unset

测试文件：`packages/mcp-server/tests/cli/verify-unset.test.ts`

## Fixture 设计

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { saveConfigToFile, loadConfigFromFile } from '../../src/config/file.js';

describe('CLI config verify + unset', () => {
  let testHome: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-verify-test-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(testHome, { recursive: true, force: true });
    Object.assign(process.env, originalEnv);
  });
```

## verify 测试用例

verify 依赖 HTTP 请求，全部用 `vi.stubGlobal('fetch', ...)` mock。

### AC1：verify 全部通过

```typescript
  it('AC1: verify passes when all config is valid and backend reachable', async () => {
    saveConfigToFile({
      peekview: {
        url: 'http://127.0.0.1:8080',
        api_key: 'pv_validkey123',
        public_url: 'http://example.com',
      }
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })  // /health
      .mockResolvedValueOnce({ ok: true, status: 200 })  // /api/v1/entries
    );

    const output = await captureOutputAsync(() => invokeVerify());
    expect(output).toContain('✅');
    expect(output).not.toContain('❌');
  });
```

### AC2：verify URL 不可达

```typescript
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
```

### AC3：verify api_key 无效（401）

```typescript
  it('AC3: verify reports auth failure when api_key returns 401', async () => {
    saveConfigToFile({
      peekview: { url: 'http://127.0.0.1:8080', api_key: 'pv_badkey' }
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })  // /health 通过
      .mockResolvedValueOnce({ ok: false, status: 401 }) // /api/v1/entries 失败
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toContain('401');
    expect(exitCode).toBe(1);
  });
```

### AC4：verify 无配置文件

```typescript
  it('AC4: verify exits early when config file missing', async () => {
    // testHome 下无配置文件
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toMatch(/配置文件不存在|config.*not.*found/i);
    expect(exitCode).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled(); // 不应发 HTTP 请求
  });
```

### AC5：verify peekview.url 未配置

```typescript
  it('AC5: verify exits early when peekview.url not set', async () => {
    saveConfigToFile({ logging: { level: 'info' } }); // 有文件但无 url

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('❌');
    expect(output).toMatch(/peekview\.url.*未配置|peekview\.url.*required/i);
    expect(exitCode).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
```

### 额外：verify 无 api_key 时显示警告不报错

```typescript
  it('verify shows warning (not error) when api_key not configured', async () => {
    saveConfigToFile({ peekview: { url: 'http://127.0.0.1:8080' } });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })  // /health
    );

    const { output, exitCode } = await captureVerifyResult();
    expect(output).toContain('⚠');
    expect(output).toMatch(/api_key.*未配置/i);
    expect(exitCode).toBe(0); // 警告不算失败
  });
```

---

## unset 测试用例

### AC6：unset 已有的 key

```typescript
  it('AC6: unset removes existing key from config', () => {
    saveConfigToFile({ peekview: { url: 'http://test', api_key: 'pv_key' } });

    invokeUnset('peekview.url');

    const config = loadConfigFromFile();
    expect(config?.peekview?.url).toBeUndefined();
    expect(config?.peekview?.api_key).toBe('pv_key'); // 其他 key 保留
  });
```

### AC7：unset 后 section 变空时删除空 section

```typescript
  it('AC7: unset deletes empty section after removing last key', () => {
    saveConfigToFile({ peekview: { url: 'http://test' } }); // url 是 peekview 下唯一 key

    invokeUnset('peekview.url');

    const config = loadConfigFromFile();
    // peekview section 整体消失，不留 `peekview: {}`
    expect(config?.peekview).toBeUndefined();
  });
```

### AC8：unset 不存在的 key 不报错

```typescript
  it('AC8: unset of non-existent key exits 0 with friendly message', () => {
    saveConfigToFile({ peekview: { api_key: 'pv_key' } });

    const output = captureOutput(() => invokeUnset('peekview.url'));
    expect(output).toMatch(/未设置|not set/i);
    // 不抛异常，不 exit(1)
  });
```

### AC9：unset 格式错误的 key

```typescript
  it('AC9: unset with invalid key format exits 1 with error', () => {
    expect(() => invokeUnset('invalidkey')).toThrow();
    // 或检查 process.exit 被调用且参数为 1
  });
```

---

## 辅助函数说明

```typescript
async function captureVerifyResult(): Promise<{ output: string; exitCode: number }> {
  const lines: string[] = [];
  const origLog = console.log;
  const origExit = process.exit;
  let exitCode = 0;

  console.log = (...args) => lines.push(args.join(' '));
  process.exit = ((code: number) => { exitCode = code; throw new Error('EXIT'); }) as any;

  try {
    await invokeVerify();
  } catch (e) {
    if (!(e instanceof Error && e.message === 'EXIT')) throw e;
  } finally {
    console.log = origLog;
    process.exit = origExit;
  }

  return { output: lines.join('\n'), exitCode };
}

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
| fetch timeout（>5s）| AbortError → ❌ 连接失败，exit 1 |
| api_key 返回 403（有效但无权）| ✅ 认证有效（403 ≠ 401）|
| peekview.url 格式错误（非 http）| validateUrl 失败 → ❌，不发 HTTP 请求 |
| unset 深层嵌套 key（server.port）| 正确删除，不影响 server 其他字段 |
| unset 后配置文件为空对象 | 写空文件或删文件（取决于实现，保持一致） |
