# MCP Server 测试环境隔离设计

> 文档状态: P0 设计阶段  
> 目标版本: @peekview/mcp-server v0.5.3  
> 创建时间: 2026-05-23

---

## 问题陈述

### 当前问题

测试失败：`tests/config.test.ts` 第22行期望端口 `33333`，实际得到 `13003`。

```
AssertionError: expected 13003 to be 33333
```

### 根本原因

1. **环境变量污染**: 生产环境设置了 `PORT=13003`
2. **测试未隔离**: `beforeEach` 复制了全部环境变量（包括 `PORT`）
3. **缺乏统一清理机制**: 每个测试文件各自处理，容易遗漏

### 影响范围

- 本地测试失败（如果用户设置了自定义端口）
- CI/CD 可能因环境变量不同而表现不一致
- 发布流程受阻（`prepublishOnly` 钩子运行测试）

---

## 设计原则

| 原则 | 说明 |
|------|------|
| **测试零污染** | 测试不应依赖或影响外部环境 |
| **生产代码纯净** | 业务代码不应包含测试逻辑（如 `if (test)`） |
| **配置集中化** | 环境隔离统一处理，不分散在各测试文件 |
| **可维护性** | 新增测试自动继承隔离配置，无需修改 |

---

## 方案对比

| 方案 | 实现方式 | 优点 | 缺点 | 推荐度 |
|------|----------|------|------|--------|
| A. 修改测试文件 | 每个 `beforeEach` 删除 `PORT` | 简单直接 | 每个文件都要改，易遗漏 | ⭐⭐ |
| B. 修改业务代码 | `config.ts` 中 `if (test)` 逻辑 | 一处修改 | 污染生产代码 | ⭐ |
| C. 修改 package.json | 添加 `NODE_ENV=test` | 标准做法 | 需配合其他修改 | ⭐⭐⭐ |
| **D. Vitest setupFiles** | 统一 setup 文件清理环境 | **完全隔离，零污染** | 需新增配置文件 | **⭐⭐⭐⭐⭐** |

**推荐方案**: D (Vitest setupFiles)

---

## 详细设计

### 步骤 1: 创建测试环境清理文件

**文件**: `packages/mcp-server/tests/setup.ts`

```typescript
/**
 * Vitest setup file - runs before all tests
 * Ensures clean environment for tests
 */

// Clean environment variables that might affect tests
const envVarsToClean = [
  'PORT',
  'MCP_PORT',
  'SERVER_PORT',
  // 未来可能添加的其他变量
  'PEEKVIEW_URL',
  'PEEKVIEW_PUBLIC_URL',
];

// Clean before all tests
envVarsToClean.forEach((key) => {
  delete process.env[key];
});

// Set safe defaults for tests
process.env.PEEKVIEW_URL = 'http://localhost:8080';
process.env.PEEKVIEW_PUBLIC_URL = 'http://localhost:8080';

console.log('[Test Setup] Environment cleaned:', envVarsToClean);
```

### 步骤 2: 配置 Vitest 使用 setup file

**文件**: `packages/mcp-server/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],  // 测试前执行清理
    environment: 'node',
    globals: true,
  },
});
```

### 步骤 3: 更新测试文件

**文件**: `packages/mcp-server/tests/config.test.ts`

简化 `beforeEach`，因为 setup 文件已处理清理：

```typescript
beforeEach(() => {
  // setup.ts 已清理环境，这里只需设置测试专用配置
  process.env.PEEKVIEW_URL = 'http://localhost:8080';
  process.env.PEEKVIEW_PUBLIC_URL = 'http://localhost:8080';
});
```

---

## 验收标准

### 测试标准

| 检查项 | 预期结果 |
|--------|----------|
| 生产环境 `PORT=13003` | 测试不受影响，使用默认 `33333` |
| `npm test` | 所有测试通过 |
| `npm run test:unit` | 所有测试通过 |
| 新增测试文件 | 自动继承隔离配置，无需修改 |

### 发布标准

| 检查项 | 预期结果 |
|--------|----------|
| `npm publish` | `prepublishOnly` 钩子通过 |
| CI/CD | 测试步骤通过 |

---

## 实施计划

### P1: 写测试（TDD）

创建 `tests/fileNaming.test.ts` 测试文件（已完成，v0.5.2）。

### P2: 实现

1. 创建 `tests/setup.ts`
2. 更新 `vitest.config.ts`
3. 简化 `tests/config.test.ts` 的 `beforeEach`
4. 验证所有测试通过

### P3: 验证

```bash
cd packages/mcp-server
npm run build
npm run test:unit
```

### P4: 发布

```bash
npm version patch  # v0.5.3
npm publish --access public
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `tests/setup.ts` | 新增：测试环境清理 |
| `vitest.config.ts` | 修改：添加 setupFiles 配置 |
| `tests/config.test.ts` | 修改：简化 beforeEach |
| `tests/fileNaming.test.ts` | 已有：v0.5.2 添加的测试 |

---

## 风险与回滚

| 风险 | 缓解措施 |
|------|----------|
| setup.ts 导致其他测试失败 | 逐步验证，先本地测试 |
| 清理过度影响必要变量 | 白名单机制，只清理已知问题变量 |

**回滚方案**: 删除 `tests/setup.ts`，恢复 `vitest.config.ts` 即可。

---

## 附录：Debug 流程规范

### 本地开发

```bash
# 使用 debug 端口
cd packages/mcp-server
export MCP_PORT=33334
npm run dev
```

### 测试

```bash
# 自动隔离环境
npm test
```

### 生产

```bash
# 使用环境变量或配置文件
peekview-mcp config set server.port 33333
peekview-mcp service start
```
