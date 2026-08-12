---
phase: P2
task_id: T001
parent: P1-requirements.md
trace_id: T001-P2-20260615
---

# P2 方案设计 — T001 MCP Path Namespace Mapping

## 声明字段

```yaml
packages: [mcp-server]
domains: [mcp]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm test"
env_constraints:
  debug_env: "make debug（:8888）；MCP测试须用临时HOME"
```

---

## 一、改动文件清单

| 文件 | 改动 |
|------|------|
| `src/config/merge.ts` | 新增 `pathNamespaces` 字段；`expandHome` 统一应用到 `allowedPaths` + namespace host_path |
| `src/types.ts` | `SessionContext` 加 `namespace?: string` 和 `pathNamespaces` 字段 |
| `src/server.ts` | POST /mcp handler 读取 `X-Peekview-Namespace` header，注入 SessionContext |
| `src/tools/publishFiles.ts` | 注入 `translatePath()`，插在步骤1（绝对路径检查）后、步骤2（stat）前 |
| `tests/server.test.ts` | 新增 namespace 相关测试 |
| `tests/publishFiles.test.ts` | 新增路径翻译 + expandHome 测试 |

**不改动**：CLI、client.ts、index.ts、其他 tools、CHANGELOG（P8 时改）

---

## 二、config/merge.ts

### 新增 expandHome

```typescript
import os from 'os';

function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}
```

### MergedConfig 新增字段

```typescript
export interface MergedConfig {
  // ... 现有字段不变 ...
  pathNamespaces: Record<string, Record<string, string>>;
  // key: namespace ID（如 "docker-a"）
  // value: 容器路径 → 主机路径 的映射（如 { "/opt/data": "~/docker-data1" }）
}
```

### mergeConfig 处理 pathNamespaces + expandHome

```typescript
// allowedPaths 统一经 expandHome（修复现有 ~ bug）
if (env.MCP_ALLOWED_PATHS) {
  allowedPaths = env.MCP_ALLOWED_PATHS.split(':')
    .filter(p => p.length > 0)
    .map(expandHome);
} else if (fileConfig?.server?.allowed_paths) {
  allowedPaths = fileConfig.server.allowed_paths.map(expandHome);
}

// pathNamespaces：从 file config 读取，host_path 经 expandHome 展开
const rawNamespaces = fileConfig?.server?.path_namespaces ?? {};
const pathNamespaces: Record<string, Record<string, string>> = {};
for (const [nsId, mappings] of Object.entries(rawNamespaces)) {
  pathNamespaces[nsId] = {};
  for (const [containerPath, hostPath] of Object.entries(mappings as Record<string, string>)) {
    pathNamespaces[nsId][containerPath] = expandHome(hostPath);
  }
}
// pathNamespaces 不支持环境变量覆盖（namespace 是复杂结构，不适合 env var）
```

---

## 三、types.ts

```typescript
export interface SessionContext {
  userToken: string;
  userId: number;
  username: string;
  namespace?: string;                                    // 新增
  pathNamespaces: Record<string, Record<string, string>>; // 新增（从 config 传入）
}
```

---

## 四、server.ts

POST /mcp handler 里，认证通过后构建 ctx 时读取 namespace header：

```typescript
const rawNamespace = req.headers['x-peekview-namespace'] as string | undefined;
const namespace = rawNamespace?.trim() || undefined;

// unknown namespace 拒绝（决策 3）
if (namespace && !config.pathNamespaces[namespace]) {
  res.status(400).json({
    error: `Unknown path namespace: "${namespace}". ` +
           `Configured namespaces: ${Object.keys(config.pathNamespaces).join(', ') || '(none)'}`,
  });
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

---

## 五、publishFiles.ts

### 新增 translatePath 函数

```typescript
/**
 * 按 namespace 翻译容器路径 → 主机路径。
 * 无 namespace 时原样返回（向后兼容）。
 * 使用最长前缀匹配。
 */
function translatePath(
  inputPath: string,
  namespace: string | undefined,
  pathNamespaces: Record<string, Record<string, string>>,
): string {
  if (!namespace) return inputPath;
  const mappings = pathNamespaces[namespace];
  if (!mappings) return inputPath; // 理论上 server.ts 已拦截

  // 最长前缀匹配
  const sorted = Object.keys(mappings).sort((a, b) => b.length - a.length);
  for (const containerPath of sorted) {
    if (inputPath === containerPath) {
      return path.resolve(mappings[containerPath]);
    }
    if (inputPath.startsWith(containerPath + path.sep)) {
      const hostBase = path.resolve(mappings[containerPath]);
      const rest = inputPath.slice(containerPath.length); // 含前导 /
      return hostBase + rest;
    }
  }
  return inputPath; // 无匹配，原样（后续 allowlist 会拦）
}
```

### 注入位置

publishFiles 主循环，步骤1（绝对路径检查）之后、步骤2（stat）之前：

```typescript
for (const inputPath of params.paths) {
  // 1. 必须绝对路径
  if (!path.isAbsolute(inputPath)) {
    skipped.push({ path: inputPath, reason: 'not_allowed' });
    continue;
  }

  // 1.5 【NEW】namespace 路径翻译（只翻译顶层路径，scanDirectory 内部不翻译）
  const translatedPath = translatePath(inputPath, context.namespace, context.pathNamespaces);

  // 2. stat 检查存在性（对翻译后路径）
  let stat: import('fs').Stats;
  try {
    stat = await fs.stat(translatedPath);
  } catch {
    // 错误信息用原始容器路径，不暴露主机路径
    skipped.push({ path: inputPath, reason: 'not_found' });
    continue;
  }

  // 3. realpath（对翻译后路径）
  const realPath = await fs.realpath(translatedPath);

  // 4. denylist（对 realpath 后的主机路径，入日志；返回 agent 的错误用 inputPath）
  if (isSensitive(realPath)) {
    logger.warn({ containerPath: inputPath, hostPath: realPath }, 'denylist rejected');
    throw new SecurityRejection(inputPath, 'sensitive', ''); // 用 inputPath 不暴露 realPath
  }

  // 5. allowlist（对 realPath，同上）
  if (!isWithinAllowed(realPath, allowedBases)) {
    logger.warn({ containerPath: inputPath, hostPath: realPath }, 'allowlist rejected');
    throw new SecurityRejection(inputPath, 'out_of_scope', '');
  }
  // ... 后续逻辑不变，但 absPath 用 realPath（已是主机真实路径）
```

**注意**：`scanDirectory` 接收的 `dirAbs` 已是翻译+realpath 后的主机路径，内部不需要再翻译。

---

## 六、安全设计确认

| 风险 | 处理方式 |
|------|---------|
| namespace 伪造 | 不是安全凭证，翻译后仍走完整 denylist+allowlist；伪造最多访问已配置允许的目录 |
| 主机路径泄露 | denylist/allowlist 错误返回 inputPath（容器路径），主机路径只入 logger |
| 二次翻译 | translatePath 只在主循环顶层调用，scanDirectory 不翻译 |
| expandHome 引入的路径 | 展开后路径仍走 realpath + allowlist 验证 |
| 未配置 pathNamespaces 但带了 header | server.ts 400 拒绝，不 fallback |

---

## 七、配置示例（文档补充，P8 时写入 README）

```yaml
# ~/.peekview/mcp-config.yaml
server:
  mode: local
  allowed_paths:
    - ~/docker-data1
    - ~/docker-data2
  path_namespaces:
    docker-a:
      /opt/data: ~/docker-data1
    docker-b:
      /opt/data: ~/docker-data2
      /opt/cache: ~/docker-cache2
```

```yaml
# Hermes config.yaml（容器 A）
mcp_servers:
  peekview:
    url: "http://host:33333/mcp"
    headers:
      Authorization: "Bearer pv_xxx"
      X-Peekview-Namespace: "docker-a"
```
