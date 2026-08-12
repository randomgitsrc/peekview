---
phase: P2
task_id: T070
type: design
parent: P1-requirements.md
trace_id: T070-P2-20260725
status: draft
created: 2026-07-25
agent: architect
---

## 影响域分析

### 改什么

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/mcp-server/src/tools/publishFiles.ts` | bug fix | CWD guard 逻辑修复 + 错误信息区分 |
| `packages/mcp-server/src/config/merge.ts` | bug fix | allowed_paths 字符串容错 |
| `packages/mcp-server/src/server.ts` | enhance | /health 增加 cwd/mode/allowed_paths |
| `packages/mcp-server/src/cli/config.ts` | enhance | config list 显示运行时值 + config verify 增加文件可读性测试 |
| `packages/mcp-server/README.md` | docs fix | namespace 语义、allowed_paths 格式、Docker 示例修正 |
| `README.md` | docs add | Docker 场景指引 + OpenCode/Cursor 接入示例 |
| `backend/README.md` | docs add | Docker 场景指引 |

### 不改什么

- PeekView 后端代码（FastAPI/Python）
- PeekView 前端代码（Vue/TypeScript）
- MCP Server 的 transport 层、认证层、client 层
- MCP Server 的其他工具（create_entry/get_entry/list_entries/delete_entry）
- Dockerfile（已正确使用 node:20-alpine + npm install -g）
- 配置文件格式（YAML 结构不变，只加容错）

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| CWD guard 修复破坏"未配 allowed_paths + cwd=/"的保护 | 安全漏洞 | BDD-2 明确覆盖此场景；TDD 红灯先行 |
| allowed_paths 容错引入新边界（空字符串 split） | 空路径进入白名单 | split 后 filter(p => p.length > 0)，与 env 路径一致 |
| config list 改为调 mergeConfig 可能改变输出格式 | 现有用户脚本依赖 | BDD-12 要求现有字段格式不变，新字段追加 |
| /health 增加字段可能被监控脚本依赖 | 字段变更需兼容 | 只追加字段，不修改/删除现有字段 |

## §1 候选方案

### 方案 A：最小侵入修复 + 诊断增强（推荐）

**CWD guard 修复**（follows_existing_pattern: publishFiles.ts L338-346）：

当前代码：
```typescript
const cwd = process.cwd();
if (path.resolve(cwd) === path.parse(cwd).root) {
  return { content: [{ type: 'text', text: 'ERROR: ...未配置 allowed_paths...' }] };
}
```

修复为：
```typescript
const cwd = process.cwd();
const isCwdRoot = path.resolve(cwd) === path.parse(cwd).root;
if (isCwdRoot && !config.trustAllPaths && config.allowedPaths.length === 0) {
  return {
    content: [{
      type: 'text',
      text: 'ERROR: local 模式当前工作目录为文件系统根目录（/），且未配置 allowed_paths。\n' +
            '原因：cwd 为根目录时默认允许范围过大，存在安全风险。\n' +
            '解决方案：\n' +
            '  1. 配置 server.allowed_paths 显式指定允许的目录\n' +
            '  2. 或设置 server.trust_all_paths=true（危险，跳过路径白名单）\n' +
            '  3. 或用 -w /tmp 等非根目录启动\n' +
            '诊断：peekview-mcp config verify'
    }]
  };
}
```

逻辑：`isCwdRoot && !trustAllPaths && allowedPaths.length === 0` → 拒绝。其余情况（有 allowedPaths 或 trustAllPaths）→ 放行到后续路径检查。

**allowed_paths 容错**（design_trivial）：

merge.ts L81-82 修改：
```typescript
} else if (fileConfig?.server?.allowed_paths) {
  const raw = fileConfig.server.allowed_paths;
  const paths = typeof raw === 'string'
    ? raw.split(':').filter((p: string) => p.length > 0)
    : Array.isArray(raw) ? raw : [];
  allowedPaths = paths.map(expandHome);
}
```

**config list 增强**：

configListAction() 改为调 mergeConfig 获取最终生效值，追加：
```
runtime:
  cwd:          /home/user
  mode:         local
  allowed_paths:/data:/tmp  (resolved, env-merged)
```

**config verify 增强**：

verifyAction() 末尾追加 allowed_paths 可读性测试：
```typescript
const allowedPaths = mergedConfig.allowedPaths;
if (allowedPaths.length > 0) {
  console.log('\nallowed_paths 可读性检查:');
  for (const p of allowedPaths) {
    try {
      await fs.promises.access(p, fs.constants.R_OK);
      console.log(`  ✅ ${p} — 可读`);
    } catch {
      console.log(`  ❌ ${p} — 不可读或不存在`);
      allOk = false;
    }
  }
}
```

**/health 增强**：

server.ts /health 端点 config 对象追加：
```typescript
config: {
  ...existingFields,
  cwd: process.cwd(),
  mode: config.mode,
  allowed_paths: config.mode === 'local' ? config.allowedPaths : [],
}
```

**文档修正**：详见 §2。

**优点**：
- 改动最小，每个修复点独立
- 不引入新依赖、新命令、新配置项
- CWD guard 修复保持安全语义不变
- 诊断增强复用现有 mergeConfig 逻辑

**风险**：
- config list 改为调 mergeConfig 需要环境变量（CLI 场景下 process.env 可用，无问题）
- /health 增加 allowed_paths 字段暴露路径信息（但 /health 已需网络访问，且 allowed_paths 是白名单非敏感数据）

**工作量**：代码 ~50 行改动 + 文档 ~200 行修正

### 方案 B：CWD guard 改为配置级拦截

将 CWD guard 从 publishFiles handler 移到 mergeConfig 阶段：如果 cwd=/ 且无 allowed_paths 且非 trust，在 mergeConfig 时抛出 Error 或返回 warning 标记。

**优点**：更早拦截，所有工具都受保护
**缺点**：
- mergeConfig 是纯配置函数，不应有副作用（cwd 检查是运行时行为）
- mergeConfig 在 config list/verify 中也被调用，会阻断诊断命令本身
- 改动范围更大，需修改 mergeConfig 返回类型
- 违反现有架构分层（配置层 vs 运行时层）

**选择理由**：方案 A 最小侵入，保持现有架构分层，CWD guard 留在运行时层（publishFiles handler）是正确位置。方案 B 的"更早拦截"优势不成立——remote 模式不需要 CWD guard，且诊断命令需要能在 cwd=/ 下运行。选方案 A。

## §2 文档修正设计

### mcp-server/README.md

1. **L96-100 namespace 语义修正**：
   - 删除"容器路径自动翻译为主机路径"
   - 改为："namespace 是 Agent 侧的短路径别名。volume mount 必须同路径（容器内路径 = 主机挂载路径），namespace 只影响 Agent 传入路径的前缀替换"
   - 示例改为：容器内 `/data/project` → 主机 `/data/project`（同路径 mount），namespace `docker-a` 的 `/data` → `/data` 映射用于 Agent 传 `/data/xxx` 时确认归属

2. **L169 allowed_paths 格式区分**：
   - 改为："YAML 配置文件用数组格式（`- /path1`），环境变量用冒号分隔（`MCP_ALLOWED_PATHS=/path1:/path2`）"
   - 两种格式各给一个示例

3. **L425-441 Docker Compose 示例**：
   - 删除 `peekview:latest` 和 `peekview/mcp-server:latest`
   - 改为 `node:20-alpine` + `npm install -g @peekview/mcp-server`
   - 增加 `working_dir: /app` 或 `environment: MCP_ALLOWED_PATHS=/data` 示例

4. **新增 Docker 场景指引节**：
   - cwd=/ 问题说明 + allowed_paths 配置方案
   - `--network host` vs 端口映射选择
   - volume mount 同路径原则
   - Docker Compose 完整示例

### README.md（根）

1. **MCP 接入节增加 OpenCode/Cursor 示例**：
   - OpenCode: opencode.json 配置示例
   - Cursor: .cursor/mcp.json 配置示例

2. **新增 Docker 场景指引**（简版，指向 mcp-server/README.md）：
   - Docker 环境下需配 MCP_ALLOWED_PATHS
   - 链接到 mcp-server/README.md Docker 节

### backend/README.md

1. **新增 Docker 场景指引**（简版）：
   - MCP Server Docker 部署提示
   - 链接到 mcp-server/README.md

## §3 工具描述增强

publish_files 工具 description 追加（精炼，不超过 3 行）：

```
Docker/container: if cwd=/, configure server.allowed_paths or set trust_all_paths=true.
Troubleshooting: run 'peekview-mcp config verify' to check config and file access.
Namespace: use X-Peekview-Namespace header when Agent runs in a container with path_namespaces configured.
```

## §4 完成标志

- [ ] BDD-1: 已配 allowed_paths 且 cwd=/ → publish_files 正常
- [ ] BDD-2: 未配 allowed_paths 且 cwd=/ → 拒绝（安全语义不变）
- [ ] BDD-3: 已配 allowed_paths 且 cwd 非根 → 行为不变
- [ ] BDD-4: 未配 allowed_paths 且 cwd 非根 → 行为不变
- [ ] BDD-5: trust_all_paths=true 且 cwd=/ → 正常
- [ ] BDD-6: cwd=/ 且未配 allowed_paths → 错误信息含两个原因
- [ ] BDD-7: YAML allowed_paths 字符串 → 自动解析为数组
- [ ] BDD-8: YAML allowed_paths 数组 → 正常工作
- [ ] BDD-9: 空 allowed_paths 数组 → 等同未配置
- [ ] BDD-10: config list 显示 cwd
- [ ] BDD-11: config list 显示 env 覆盖后最终值
- [ ] BDD-12: config list 新增字段不改变现有输出格式
- [ ] BDD-13: config verify 测试 allowed_paths 可读性
- [ ] BDD-14: config verify 报告不可读路径
- [ ] BDD-15: /health 返回 cwd 和 mode（local 模式）
- [ ] BDD-16: /health 返回 allowed_paths（local 模式）
- [ ] BDD-17: /health remote 模式下 cwd/allowed_paths 语义正确
- [ ] BDD-18: mcp-server/README namespace 语义正确
- [ ] BDD-19: mcp-server/README allowed_paths 格式区分
- [ ] BDD-20: mcp-server/README Docker 示例无不存在镜像
- [ ] BDD-21: 三份 README 均有 Docker 场景指引
- [ ] BDD-22: 根 README 含 OpenCode/Cursor 示例
- [ ] BDD-23: publish_files 描述含 Docker 场景提示
- [ ] BDD-24: publish_files 描述含诊断命令提示
- [ ] 现有测试全部通过（无回归）

## 四字段

```yaml
packages: ["@peekview/mcp-server"]
domains: [mcp, docs, security]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm run test:unit 2>&1 | tail -40"
```

## files_to_read

```yaml
files_to_read:
  - path: packages/mcp-server/src/tools/publishFiles.ts
    why: CWD guard bug 修复位置（L338-346），需理解完整 handler 逻辑
  - path: packages/mcp-server/src/config/merge.ts
    why: allowed_paths 容错修复位置（L78-83），mergeConfig 函数
  - path: packages/mcp-server/src/server.ts
    why: /health 端点增强（L231-266），config 对象结构
  - path: packages/mcp-server/src/cli/config.ts
    why: config list 增强（L141-193）+ config verify 增强（L425-498）
  - path: packages/mcp-server/src/config/file.ts
    why: ConfigFileData 类型定义，loadConfigFromFile 返回值
  - path: packages/mcp-server/src/config.ts
    why: loadConfig 入口，mergeConfig 调用方式
  - path: packages/mcp-server/tests/publishFiles.test.ts
    why: 现有 CWD guard 测试（L326-339），需扩展 BDD-1~6
  - path: packages/mcp-server/tests/config-merge.test.ts
    why: 现有 allowed_paths 测试，需扩展 BDD-7~9
  - path: packages/mcp-server/tests/cli-config.test.ts
    why: 现有 CLI config 测试，需扩展 BDD-10~14
  - path: packages/mcp-server/tests/server.test.ts
    why: 现有 server 测试，需扩展 /health BDD-15~17
  - path: packages/mcp-server/README.md
    why: 文档修正目标（namespace 语义、allowed_paths 格式、Docker 示例）
  - path: README.md
    why: Docker 场景指引 + OpenCode/Cursor 示例
  - path: backend/README.md
    why: Docker 场景指引
```

## env_constraints

```yaml
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/); MCP 单测: cd packages/mcp-server && npm run test:unit"
  isolation_check: "MCP 单测用临时 HOME（conftest 隔离），不触碰 ~/.peekview/；P5/P6 Docker 测试用 node:20-alpine 容器"
```

## minimal_validation

```yaml
minimal_validation:
  assumption: "纯代码逻辑，不依赖浏览器行为/安全模型/外部系统行为"
  method: not_needed
  result: not_needed
  note: "CWD guard 修复是条件逻辑变更，allowed_paths 容错是类型检查，诊断增强是字段追加——均由 TDD 覆盖"
```
