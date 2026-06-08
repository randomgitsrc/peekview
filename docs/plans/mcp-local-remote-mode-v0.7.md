# 设计计划：MCP Server 本地/远程双模式 v0.7.0

> 文档状态: P0 设计修订计划  
> 目标版本: @peekview/mcp-server v0.7.0  
> 创建时间: 2026-06-09  
> 来源评审: `docs/reviews/expert-review-mcp-local-remote-mode.md`  
> 关联规格: `docs/specs/spec-mcp-local-remote-mode.md`

---

## 一、背景与问题

PeekView MCP Server 当前以远程 SSE 模式为主：

```text
Agent(A) → SSE → MCP Server(B) → HTTP → PeekView Backend(C)
```

在 A≠B 时，MCP Server 无法访问 Agent 所在机器的本地文件。若 Agent 要发布已有文件，只能先 `read_file`，再把文件内容作为 `create_entry` 参数传入。这样会导致文件内容进入 LLM 上下文，出现明显延迟和上下文污染。

此前规格 `spec-mcp-local-remote-mode.md` 提出本地/远程双模式，但存在三个需要修订的关键问题：

1. 本地模式只暴露 `publish_files`，会阻断 Agent 发布自己生成内容的路径
2. 新旧 spec 的安全模型不一致，需统一为可落地模型
3. 远程模式不应暴露 `publish_files`，否则路径语义会混淆

---

## 二、产品决策

### 2.1 最终工具策略

| 模式 | 拓扑 | 暴露工具 | 说明 |
|------|------|----------|------|
| `remote` 默认 | A→B→C | `create_entry`, `get_entry`, `list_entries`, `delete_entry` | MCP Server 不能读取 Agent 本地文件，只适合 Agent 生成内容 |
| `local` | A=B→C | `create_entry`, `publish_files`, `get_entry`, `list_entries`, `delete_entry` | MCP Server 与 Agent 同机，既能直接读本地文件，也能发布 Agent 生成内容 |

### 2.2 关键原则

1. **不让远程模式暴露 `publish_files`**  
   远程模式下 Agent 传入的是 A 机器路径，MCP Server 运行在 B 机器，路径语义不成立。

2. **本地模式保留 `create_entry`**  
   `publish_files` 解决的是“已有文件读取”问题，不应替代 Agent 生成内容发布。

3. **通过工具描述引导 Agent 选择**  
   - `create_entry`: Agent-generated content only
   - `publish_files`: existing files on disk, no `read_file` needed

4. **默认保持远程模式，兼容现有用户**  
   未配置 `mode` 时仍为 `remote`，现有 MCP Server 部署行为不变。

---

## 三、价值故事

- **作为** 使用 PeekView 的 Agent / Claude Code 用户
- **我希望** MCP Server 能区分本地文件可达和远程文件不可达两种部署模式
- **以便** Agent 发布已有本地文件时不需要把大文件读进 LLM 上下文，同时仍能发布自己生成的短内容

---

## 四、验收标准

- [ ] AC1: MCP Server 支持 `mode: remote | local`，默认值为 `remote`
- [ ] AC2: remote 模式暴露 `create_entry/get_entry/list_entries/delete_entry`，不暴露 `publish_files`
- [ ] AC3: local 模式暴露 `create_entry/publish_files/get_entry/list_entries/delete_entry`
- [ ] AC4: `publish_files` 支持绝对路径文件和目录递归扫描
- [ ] AC5: `publish_files` 明确不要求 Agent 先 `read_file`
- [ ] AC6: `publish_files` 实现敏感路径黑名单，黑名单优先级最高
- [ ] AC7: `publish_files` 支持 `allowed_paths` 显式 allowlist
- [ ] AC8: local 模式未配置 `allowed_paths` 时不拒绝启动，但仅允许 cwd 范围内路径，并输出 warning
- [ ] AC9: `create_entry` 描述明确仅用于 Agent 生成内容，不鼓励读取已有文件后再调用
- [ ] AC10: `publish_files` 返回 skipped files 及 reason
- [ ] AC11: 文件数量、单文件大小、总大小限制与后端限制对齐，并保留安全余量
- [ ] AC12: `spec-mcp-publish-files.md` 顶部声明已被双模式 spec 取代
- [ ] AC13: `mcp-vs-cli-positioning.md` 修正“协议根本限制”的表述
- [ ] AC14: 单元测试覆盖 local/remote 工具列表、路径安全、目录扫描、跳过原因

---

## 五、架构审查

| 维度 | 结论 | 备注 |
|------|------|------|
| 模块边界 | ✅ | 主要修改 `packages/mcp-server/`；复用现有 PeekView Backend create entry API |
| 依赖管理 | ⚠️ | 优先使用 Node 标准库；如引入 glob/minimatch 依赖，需说明必要性 |
| 性能 | ✅ | `publish_files` 避免文件内容进入 LLM 上下文；需限制文件数和总大小 |
| 部署拓扑 | ✅ | A=B 与 A≠B 工具集分离；远程模式不暴露 `publish_files` |
| 向后兼容 | ✅ | 默认 remote，现有用户工具集保持兼容；新增 local 为 opt-in |

架构结论：**通过，但必须先修订规格文档，再进入实现。**

---

## 六、安全模型

本地模式采用三层防护模型：

| 优先级 | 防护层 | 行为 |
|--------|--------|------|
| 1 | 硬编码敏感路径黑名单 | 始终拒绝，如 `.ssh/`, `.gnupg/`, `.aws/`, `*.pem`, `*.key` |
| 2 | 用户配置 `allowed_paths` | 若配置，则只允许这些目录下的真实路径 |
| 3 | cwd fallback | 未配置 `allowed_paths` 时，仅允许 MCP Server 当前工作目录下的路径 |

### 启动行为

```typescript
if (config.mode === 'local' && config.allowedPaths.length === 0) {
  logger.warn('未配置 allowed_paths，仅允许当前工作目录下的路径');
  // 不拒绝启动
}
```

### 路径校验要求

1. `publish_files.paths` 必须是绝对路径
2. 使用 `fs.realpath()` 解析真实路径后再做边界检查
3. 黑名单检查优先于 allowlist/cwd 检查
4. 解析后的路径必须满足：
   - 在 `allowed_paths` 内；或
   - 未配置 `allowed_paths` 时在 cwd 内
5. 目录扫描必须跳过常见大目录和构建目录：`.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build`, `.next`, `coverage`

---

## 七、配置设计

### 配置文件

```yaml
peekview:
  url: https://peek.example.com
  public_url: https://peek.example.com
  api_key: pv_xxx

server:
  port: 33333

mode: local
allowed_paths:
  - /home/alice/projects
  - /tmp/peekview-staging
```

### 命名规范

| 层级 | 命名 |
|------|------|
| YAML 配置 | `mode`, `allowed_paths` |
| TypeScript 类型 | `mode`, `allowedPaths` |
| 环境变量 | `MCP_MODE`, `MCP_ALLOWED_PATHS` |

### TypeScript 类型

```typescript
export interface ServerConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
  mode: 'local' | 'remote';
  allowedPaths: string[];
}
```

---

## 八、工具描述策略

### create_entry 描述关键内容

```text
For Agent-generated content only, especially short generated code, notes, analysis, or reports.
Do NOT read existing files from disk and pass their content to this tool; it wastes context.

If you need to publish existing local files:
- In local mode, use publish_files instead.
- In remote mode, use /peeklink or run a local-mode MCP Server on the Agent machine.
```

### publish_files 描述关键内容

```text
For existing files or directories on disk. MCP Server reads files directly.
Use this instead of create_entry when publishing local files.
Do NOT call read_file first.
Paths must be absolute.
```

---

## 九、实施计划

### Step 1: 修订规格文档

修改：`docs/specs/spec-mcp-local-remote-mode.md`

- local 工具集改为 `create_entry + publish_files + get/list/delete`
- remote 工具集保持 `create_entry + get/list/delete`
- 安全模型改为三层：黑名单 → allowed_paths → cwd fallback
- 启动校验从“拒绝启动”改为 warning + cwd 限制
- 版本规划改为 MCP Server v0.7.0
- 增加迁移说明：remote ↔ local 需要修改配置并重启 MCP Server

修改：`docs/specs/spec-mcp-publish-files.md`

- 顶部增加取代声明：工具设计已被双模式 spec 取代，安全模型仍可参考

修改：`docs/decisions/mcp-vs-cli-positioning.md`

- 将“MCP over SSE 协议的根本限制”修正为“Agent LLM-in-the-loop 工具调用架构的根本限制”
- 更新最终工具策略表

### Step 2: 配置系统扩展

修改：

- `packages/mcp-server/src/config.ts`
- `packages/mcp-server/src/config/file.ts`
- `packages/mcp-server/src/config/merge.ts`

实现：

- `mode` 解析，默认 `remote`
- `allowed_paths` → `allowedPaths` 转换
- `MCP_MODE` 环境变量覆盖
- `MCP_ALLOWED_PATHS` 环境变量覆盖，使用平台路径分隔符或明确约定冒号分隔
- local 模式无 `allowedPaths` 时输出 warning，不阻止启动

### Step 3: 实现 `publish_files` 工具

新增：`packages/mcp-server/src/tools/publishFiles.ts`

职责：

- 输入 schema 校验
- 绝对路径校验
- 文件/目录扫描
- 敏感路径黑名单
- `allowedPaths` / cwd 边界检查
- symlink realpath 防绕过
- 文本文件读取
- 二进制、超大、无权限、越权文件跳过
- 调用现有 PeekView create entry API
- 返回发布链接和 skipped files 信息

建议限制：

```typescript
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_FILES = 50;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
```

### Step 4: 工具注册按模式区分

修改：`packages/mcp-server/src/tools/index.ts`

```typescript
if (config.mode === 'local') {
  return [
    createEntryTool(client, config),
    publishFilesTool(client, config),
    getEntryTool(client),
    listEntriesTool(client),
    deleteEntryTool(client),
  ];
}

return [
  createEntryTool(client, config),
  getEntryTool(client),
  listEntriesTool(client),
  deleteEntryTool(client),
];
```

### Step 5: 更新工具描述

修改：`packages/mcp-server/src/tools/createEntry.ts`

- 添加“Agent-generated content only”说明
- 添加“不要先 read_file 再调用”的反例
- remote 模式描述中不要假设 `publish_files` 一定可见

### Step 6: 测试

新增/修改测试：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/config.test.ts` | `mode`, `allowedPaths`, env override, 默认 remote |
| `tests/tools.test.ts` 或 `tests/server.test.ts` | local/remote 工具列表 |
| `tests/publishFiles.test.ts` | 路径校验、目录扫描、黑名单、allowedPaths、cwd fallback、skipped reason |
| `tests/createEntry.test.ts` | 工具描述包含选择引导 |

验证命令：

```bash
make build-mcp
make test-mcp-unit
```

如涉及集成测试：

```bash
make debug-start
make test-mcp
make debug-stop
```

---

## 十、迁移说明

### 现有用户

无需修改。默认仍为 `remote` 模式，已有 `create_entry/get/list/delete` 工具保持可用。

### 需要本地文件发布的用户

在 Agent 所在机器安装并运行 MCP Server：

```yaml
peekview:
  url: https://peek.example.com
  public_url: https://peek.example.com

mode: local
allowed_paths:
  - /home/alice/projects
```

然后将 Agent 的 MCP 连接指向本机：

```json
{
  "mcpServers": {
    "peekview": {
      "type": "sse",
      "url": "http://localhost:33333/sse"
    }
  }
}
```

### remote ↔ local 切换

- 修改 `~/.peekview/mcp-config.yaml` 中的 `mode`
- 根据需要配置 `allowed_paths`
- 重启 MCP Server
- 如 MCP Server 地址发生变化，更新 Claude Code / Cursor / opencode 的 MCP 配置

---

## 十一、风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| prompt injection 诱导发布敏感文件 | 高 | 黑名单优先、realpath、allowedPaths/cwd 边界、默认不允许全盘 |
| Agent 仍误用 `create_entry` 发布已有文件 | 中 | 强化工具描述、增加反例、local 模式同时提供 `publish_files` |
| cwd 来源不一致 | 中 | 文档明确 cwd fallback 使用 MCP Server 启动 cwd；后续再评估 session cwd |
| 大目录扫描导致内存/时间过高 | 中 | 文件数、单文件大小、总大小限制；跳过常见构建目录 |
| 新依赖增加维护成本 | 低 | 优先标准库，必要依赖单独评审 |

---

## 十二、任务分配

- **全栈**:
  - 修订 MCP 相关 specs 和 decision 文档
  - 实现 MCP Server 配置扩展、工具注册、`publish_files`
  - 编写 MCP Server 单元/集成测试

- **前端**:
  - 本轮无需参与；不改变 Web UI 和前端 API 客户端

- **协作**:
  - API 契约默认复用现有 create entry 接口
  - 如发现后端 schema 不满足 `publish_files` 需求，先单独提交 API 契约变更评审

---

## 十三、投资评估

| 维度 | 评估 | 评级 |
|------|------|------|
| 业务价值 | 解决 MCP 发布本地已有文件慢的问题，补齐 Agent 自主发布能力 | 高 |
| 开发成本 | 约 2-3 人天，集中在 MCP Server | 中 |
| 技术风险 | 路径安全和工具选择误用是主要风险 | 中 |
| ROI | 约 80%-120%，MCP 重度用户收益明显 | 值得投资 |

---

## 十四、决策

- [x] ⚠️ 原 `spec-mcp-local-remote-mode.md` 不按当前版本进入开发
- [x] ✅ 按本文修订方向更新规格后，可进入实现排期
- [x] ✅ 目标版本定为 `@peekview/mcp-server v0.7.0`

---

*计划创建：2026-06-09*
