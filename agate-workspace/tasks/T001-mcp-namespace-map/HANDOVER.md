# T001 交接文件 — MCP Path Namespace Mapping

> 状态：P0-P2 完成（设计阶段），P3-P8 需在有 node_modules 的环境执行
> 接手环境要求：node_modules 可用（npm install），可跑 npm test

---

## 当前进度

| 阶段 | 状态 |
|------|------|
| P0 任务简报 | ✅ P0-brief.md |
| P1 需求基线 | ✅ P1-requirements.md（8 条 BDD） |
| P2 方案设计 | ✅ approved — P2-design.md |
| P3 TDD | ⏳ 待执行 |
| P4 实现 | ⏳ 待执行 |
| P5 技术验证 | ⏳ 待执行 |
| P8 发布准备 | ⏳ 待 P5 通过 |

---

## P3 需要写的测试

测试文件位置：`packages/mcp-server/tests/`

**publishFiles.test.ts 新增用例**（对应 BDD AC1-AC8）：
- `translatePath: 基本翻译（namespace docker-a）` → AC1
- `translatePath: 最长前缀匹配` → AC5
- `translatePath: 无 namespace 不翻译（向后兼容）` → AC4
- `translatePath: 翻译后路径不在 allowlist → 被拒绝` → AC2
- `translatePath: 翻译后路径命中 denylist → 被拒绝` → AC8
- `expandHome: ~/xxx 正确展开` → AC7
- `expandHome: 非 ~ 路径原样返回`

**server.test.ts 新增用例**：
- `unknown namespace header → 400` → AC3
- `valid namespace header → 注入 SessionContext` → AC1 前提
- `无 namespace header → 不影响现有流程` → AC4

**先跑红灯确认（实现前测试应全 FAIL）**：
```bash
cd packages/mcp-server && npm install && npm test
```

---

## P4 需要实现的内容

按 P2-design.md 的方案，改动四个文件：

### 1. src/config/merge.ts

a. 新增 `expandHome(p: string): string`（展开 `~`）
b. `MergedConfig` 加 `pathNamespaces: Record<string, Record<string, string>>`
c. `mergeConfig` 里：
   - `allowedPaths` 经 `expandHome`（修复现有 ~ bug）
   - 读取 `fileConfig?.server?.path_namespaces`，host_path 经 `expandHome` 展开，存入 `pathNamespaces`

### 2. src/types.ts

`SessionContext` 加两个字段：
```typescript
namespace?: string;
pathNamespaces: Record<string, Record<string, string>>;
```

### 3. src/server.ts

POST /mcp handler 里，`sessionContext.run(ctx, ...)` 之前：
```typescript
const rawNamespace = req.headers['x-peekview-namespace'] as string | undefined;
const namespace = rawNamespace?.trim() || undefined;

if (namespace && !config.pathNamespaces[namespace]) {
  res.status(400).json({ error: `Unknown path namespace: "${namespace}"` });
  return;
}

const ctx: SessionContext = {
  userToken: auth.userToken,
  userId: auth.userId,
  username: auth.username,
  namespace,
  pathNamespaces: config.pathNamespaces,
};
```

### 4. src/tools/publishFiles.ts

a. 新增 `translatePath(inputPath, namespace, pathNamespaces)` 函数（见 P2-design.md 第五节）
b. 主循环步骤1（绝对路径检查）后、步骤2（stat）前插入翻译
c. stat/realpath 对翻译后路径操作
d. SecurityRejection 第一个参数改为 `inputPath`（不暴露主机路径）

**注意**：先查 `SecurityRejection` 构造函数，确认错误消息不会把 realPath 泄露给 Agent。

---

## P5 验收

```bash
cd packages/mcp-server && npm test
```

重点确认：
- translatePath 单元测试全通过
- expandHome 测试通过
- unknown namespace 返回 400
- 现有测试无回归

---

## P8 发布准备

```bash
make bump-mcp-version NEW_MCP_VERSION=0.9.0

# 手动填写 packages/mcp-server/CHANGELOG.md
# [0.9.0] - 2026-06-15
# ### Added
# - Path namespace mapping for Docker deployments (X-Peekview-Namespace header)
# - expandHome: ~ in allowed_paths and namespace host_path now correctly expanded
# ### Fixed
# - allowed_paths with ~ prefix no longer silently fails

git add packages/mcp-server/CHANGELOG.md packages/mcp-server/package.json
git commit --amend
git push origin main
cd packages/mcp-server && npm publish
```

---

## 关键参考文件

- 需求：`docs/tasks/T001-mcp-namespace-map/P1-requirements.md`
- 方案：`docs/tasks/T001-mcp-namespace-map/P2-design.md`
- 原始计划：`docs/plans/mcp-path-namespace-mapping.md`
- 安全链实现：`packages/mcp-server/src/tools/publishFiles.ts`（步骤 1-5，约第 337-395 行）
