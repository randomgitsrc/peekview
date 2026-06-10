# MCP Path Namespace 映射方案（Docker 路径空间错位）

> 创建：2026-06-10
> 目标版本：MCP Server v0.9.0
> 优先级：🟠 近期（解决 Docker agent 路径空间错位）
> 关联：docs/roadmap/improvement-backlog.md

---

## 一、问题

### 场景

Agent 运行在 Docker 容器中，通过网络连接主机上的 MCP Server（local 模式）。容器内的数据卷映射到主机目录：

```
docker run -v ~/docker-data1:/opt/data ...

容器内 agent 看到：     /opt/data/report.md
主机上 MCP Server 看到：~/docker-data1/report.md（同一文件）
```

Agent 调用 `publish_files({ paths: ["/opt/data/report.md"] })`，MCP Server 在主机上找 `/opt/data/report.md`——不存在，或是完全不相干的文件。allowlist 配了 `~/docker-data1` 也没用，因为路径根本对不上。

### 多容器冲突

多个容器可能都用相同的容器内路径：

```
容器 A：/opt/data → 主机 ~/docker-data1
容器 B：/opt/data → 主机 ~/docker-data2

两个 agent 都发 /opt/data/report.md，字面相同，实际是不同主机目录
```

单纯路径前缀替换无法区分——必须有额外的区分维度。

---

## 二、设计：Path Namespace + 客户端标识 Header

### 核心机制

1. MCP Server 配置多个**命名空间**，每个命名空间是一组"容器路径 → 主机路径"的映射
2. Agent 连接时通过 **header** 声明自己属于哪个命名空间
3. MCP Server 在 initialize 时捕获 header，绑定到 session
4. publish_files 处理路径时，先按 session 的命名空间翻译，再走正常安全链

### 配置

```yaml
# ~/.peekview/mcp-config.yaml
server:
  mode: local
  allowed_paths:
    - ~/docker-data1      # 主机真实路径（翻译后的目标）
    - ~/docker-data2

  path_namespaces:
    docker-a:                       # 命名空间 ID（语义化命名）
      /opt/data: ~/docker-data1
    docker-b:
      /opt/data: ~/docker-data2
      /opt/cache: ~/docker-cache2   # 一个命名空间可含多条映射
```

### Agent 配置（声明命名空间）

```bash
# 容器 A 的 agent（Claude Code 示例）
claude mcp add --transport http peekview https://host:13003/mcp \
  --header "Authorization: Bearer pv_xxx" \
  --header "X-Peekview-Namespace: docker-a"
```

```json
// OpenCode 示例
{
  "mcp": {
    "peekview": {
      "type": "remote",
      "url": "https://host:13003/mcp",
      "headers": {
        "Authorization": "Bearer pv_xxx",
        "X-Peekview-Namespace": "docker-a"
      }
    }
  }
}
```

### 翻译流程

```
agent (docker-a) 调用 publish_files({ paths: ["/opt/data/report.md"] })
  ↓
MCP Server 取 session 的 namespace = docker-a
  ↓
查 docker-a 映射：/opt/data → ~/docker-data1（最长前缀匹配）
翻译：/opt/data/report.md → ~/docker-data1/report.md
  ↓
stat 存在性检查
  ↓
realpath 解析符号链接
  ↓
denylist 检查（对 realpath 后路径）
  ↓
allowlist 检查：~/docker-data1 在 allowed_paths 里 ✅
  ↓
读文件 → PeekView
```

**翻译只是第一步，翻译后的真实路径仍走完整安全链（realpath → denylist → allowlist）。安全模型不被绕过。**

---

## 三、关键设计决策

### 决策 0：`~` 展开（前置依赖，顺带修现有 bug）

**现有 bug**：`path.resolve('~/docker-data1')` 不展开 `~`，会得到 `<cwd>/~/docker-data1`。所以现有 `allowed_paths` 配 `~/xxx` 是静默失效的——用户必须配绝对路径。

本方案需要统一实现 `expandHome`，并应用到所有路径配置（allowed_paths + path_namespaces 的 host_path）：

```typescript
function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}
```

这同时修复了现有 allowed_paths 的 `~` bug，作为本方案的一部分一并实现。



stateful 模式下，工具调用请求只带 `mcp-session-id` 头，不重复带 namespace 头。因此 **namespace 必须在 initialize 请求时从 header 捕获，存进 session**，后续工具调用从 session 读取。

```typescript
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
  userToken: string;
  userId: number;
  username: string;
  namespace?: string;   // 新增：initialize 时捕获
  lastActivity: number;
}
```

### 决策 2：无 namespace header → 不翻译，走本机真实路径

向后兼容。本机 agent（非 Docker）不带 header，路径不翻译，按现有 allowlist 逻辑处理。本机 agent 想用 `/opt/data` 仍需显式配 `allowed_paths`，安全性由现有模型保证。

### 决策 3：namespace header 带了但配置里没有 → 拒绝，不静默 fallback

```
agent 发 X-Peekview-Namespace: docker-c
配置里只有 docker-a / docker-b
→ initialize 返回错误："Unknown path namespace: docker-c"
```

**不能静默 fallback 到本机真实路径**——agent 明确声明了命名空间，说明它期望路径被翻译。静默 fallback 可能读到完全不相干的文件（甚至主机敏感文件），是危险的。明确报错让用户发现配置漏配。

### 决策 4：最长前缀匹配

一个命名空间下多条映射时，按最长前缀匹配，避免 `/opt/data` 和 `/opt/data-backup` 歧义：

```
namespace docker-x:
  /opt/data: ~/d1
  /opt/data/sub: ~/d2

/opt/data/sub/x.md → 匹配 /opt/data/sub（更长）→ ~/d2/x.md
/opt/data/other.md → 匹配 /opt/data → ~/d1/other.md
```

### 决策 5：只翻译路径，不影响其他工具

namespace 翻译只在 publish_files 的路径处理中生效。create_entry（传内容）、get/list/delete（不碰路径）不受影响。

### 决策 6：namespace 标识不是安全凭证

namespace header 可被任何能连 MCP Server 的客户端伪造。但这不构成安全风险，因为：
- 翻译后的路径仍走 allowlist + denylist + realpath 完整安全链
- 伪造 namespace 最多让攻击者访问"已配置允许的主机目录"，不能越界
- 真正的身份认证仍由 `Authorization: Bearer pv_xxx` 负责

namespace 是"路径空间选择器"，不是"权限凭证"。安全边界由 allowlist/denylist 保证。

---

## 四、实现

### Step 1：config 扩展
- `config/merge.ts`：`MergedConfig` 加 `pathNamespaces: Record<string, Record<string, string>>`
- 从 `fileConfig.server.path_namespaces` 读取
- `config.ts:ServerConfig` 同步加字段

### Step 2：initialize 捕获 namespace
- `server.ts` 的 POST /mcp initialize 分支：
  - 读 `req.headers['x-peekview-namespace']`
  - 若存在但不在 `config.pathNamespaces` 中 → 返回错误（决策 3）
  - 存入 session entry 的 `namespace` 字段
- 工具调用时，把 namespace 通过 SessionContext 传给 handler

### Step 3：SessionContext 加 namespace
- `types.ts:SessionContext` 加 `namespace?: string` 和 `pathNamespaces?: Record<...>`
- 或更简洁：把翻译函数注入 ctx

### Step 4：publish_files 路径翻译
- 在路径处理主循环最开始（绝对路径检查之后、stat 之前）插入翻译：
```typescript
function translatePath(
  inputPath: string,
  namespace: string | undefined,
  pathNamespaces: Record<string, Record<string, string>>,
): string {
  if (!namespace) return inputPath;  // 无 namespace 不翻译
  const mappings = pathNamespaces[namespace];
  if (!mappings) return inputPath;   // 理论上 initialize 已拦截

  // 最长前缀匹配
  const sorted = Object.keys(mappings).sort((a, b) => b.length - a.length);
  for (const containerPath of sorted) {
    if (inputPath === containerPath || inputPath.startsWith(containerPath + path.sep)) {
      const hostBase = path.resolve(expandHome(mappings[containerPath]));  // host_path 经 expandHome
      const rest = inputPath.slice(containerPath.length);
      return hostBase + rest;
    }
  }
  return inputPath;  // 不匹配任何映射，原样（后续 allowlist 会拦）
}
```
- 翻译后的路径替换 inputPath，继续走现有 stat → realpath → denylist → allowlist 流程
- **重要：translatePath 只对 params.paths 的顶层路径调用一次。scanDirectory 内部不翻译**——递归拿到的子文件路径已经是主机真实路径（翻译后目录下的真实子路径），二次翻译会出错。

### Step 5：错误信息（不泄露主机路径）

Docker 场景下容器内 agent 不应知道主机目录布局（容器隔离的意义）。错误信息**只返回容器路径**给 agent，翻译后的主机路径只写服务端日志：

```
返回给 agent：
ERROR: 路径不在允许范围: /opt/data/x.md (namespace docker-a)
       请联系管理员确认该 namespace 的映射目标已加入 allowed_paths

服务端日志（不返回 agent）：
translated /opt/data/x.md → /home/user/docker-data1/x.md, not in allowlist
```

---

## 五、测试

| 用例 | 验证 |
|------|------|
| 带 namespace + 路径在映射内 | 翻译正确，读到主机文件 |
| 带 namespace + 翻译后路径在 allowlist | 通过 |
| 带 namespace + 翻译后路径不在 allowlist | 拒绝 |
| 带 unknown namespace | initialize 阶段拒绝 |
| 无 namespace | 不翻译，走本机 allowlist |
| 多映射最长前缀匹配 | 选最长匹配的映射 |
| 多 session 不同 namespace | 各自翻译，不串 |
| 翻译后路径命中 denylist | 拒绝（安全链不被绕过）|
| namespace 翻译 + 符号链接 | realpath 后仍正确校验 |

---

## 六、前置依赖核查

各 agent 客户端对自定义 header 的支持（已查证 2026-06）：

| Agent | 自定义 header 支持 | 备注 |
|-------|-------------------|------|
| Claude Code | ✅ `--header` | 注意 issue #14977 曾报告 HTTP header 不传输的 bug，需验证当前版本已修复 |
| OpenCode | ✅ headers 配置字段 | |
| Codex | ✅（OAuth/header）| 需实测 |
| Hermes | 待实测 | first-class MCP client since v0.6.0 |
| OpenClaw | 待实测 | 通过插件系统消费 MCP |

**风险**：不是所有 agent 都保证支持自定义 header。不支持的 agent 无法用 namespace 映射，但仍可：
- 用无 namespace 模式（本机路径）
- 用 create_entry 传内容
- 容器内装 peekview CLI

**实施前必须验证目标 agent（尤其 Claude Code issue #14977）的 header 传输实际可用。**

---

## 七、与"容器内跑独立 MCP"方案的对比

| | path_namespace（本方案） | 容器内独立 MCP |
|---|---|---|
| 运维 | 一个 MCP 服务 + 配置 | 每容器一个 MCP 实例 |
| 多容器路径冲突 | header 区分，优雅 | 天然隔离 |
| 依赖 | agent 支持自定义 header | 无 |
| 适用 | agent 支持 header 的场景 | header 不可用时的兜底 |

两者不互斥。path_namespace 是首选（省运维），容器内独立 MCP 是 header 不可用时的兜底。

---

## 八、验收标准

- [ ] 实现 expandHome，allowed_paths + path_namespaces 的 host_path 都经过它（顺带修现有 `~` bug）
- [ ] config 支持 `server.path_namespaces`
- [ ] initialize 捕获 X-Peekview-Namespace 头并绑定 session
- [ ] unknown namespace 在 initialize 阶段拒绝
- [ ] publish_files 按 namespace 翻译路径（最长前缀匹配）
- [ ] translatePath 只对顶层路径调用，scanDirectory 不二次翻译
- [ ] 翻译后路径走完整安全链（realpath/denylist/allowlist）
- [ ] 无 namespace 向后兼容（不翻译）
- [ ] 多 session 不同 namespace 隔离
- [ ] 错误信息只返回容器路径，主机路径只入服务端日志
- [ ] 测试覆盖上述全部用例 + `~` 展开
- [ ] 文档：README 增加 Docker 场景配置示例
- [ ] 版本 bump v0.9.0

---

*方案创建：2026-06-10*
