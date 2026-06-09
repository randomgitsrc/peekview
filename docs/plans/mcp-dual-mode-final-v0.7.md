# MCP Server 双模式最终方案 v0.7.0

> 文档状态：最终实现方案（取代 mcp-local-remote-mode-v0.7.md 的工具策略部分）
> 目标版本：@peekview/mcp-server v0.7.0
> 创建时间：2026-06-09
> 关联：
> - docs/specs/spec-mcp-local-remote-mode.md（规格）
> - docs/reviews/expert-review-mcp-local-remote-mode.md（评审）
> - docs/plans/mcp-local-remote-mode-v0.7.md（前序计划）

---

## 一、背景与根本约束

### 部署拓扑

```
remote 模式（A→B→C，默认）        local 模式（A=B→C）
┌─────┐   ┌─────┐   ┌─────┐       ┌──────────────┐   ┌─────┐
│  A  │──▶│  B  │──▶│  C  │       │   A = B      │──▶│  C  │
│Agent│SSE│ MCP │   │Peek │       │ Agent + MCP  │   │Peek │
└─────┘   └─────┘   └─────┘       └──────────────┘   └─────┘
文件在A，MCP在B，路径不可达        文件和MCP同机，路径可达
```

### 根本约束（不可绕过）

**Agent 调用 MCP 工具时，所有参数都经过 LLM 上下文。** 这不是 SSE 协议的限制，而是 LLM-in-the-loop 工具调用架构的本质——Agent 必须"看到"参数才能构造工具调用。

因此：
- 远程模式下，文件内容作为参数传递 → 进入 LLM 上下文 → 大文件导致推理时间爆炸（实测 ~2 分钟）
- 本地模式下，传路径而非内容 → MCP Server 自己读文件 → 上下文只有路径字符串

---

## 二、核心产品决策

### 2.1 工具策略（最终版）

| 模式 | 拓扑 | 暴露工具 | 设计理由 |
|------|------|----------|----------|
| `remote`（默认）| A→B→C | `create_entry`, `get_entry`, `list_entries`, `delete_entry` | MCP 读不到 Agent 本地文件，只能发布 Agent 生成的内容 |
| `local` | A=B→C | `publish_files`, `get_entry`, `list_entries`, `delete_entry` | MCP 与文件同机，统一用路径发布；**不暴露 create_entry** |

### 2.2 关键决策：本地模式只暴露 publish_files，不暴露 create_entry

这是与前序评审（C1 建议保留 create_entry）**不同的决策**，理由如下：

**1. 选择越少，出错越少**
本地模式只有一个发布工具 `publish_files`，Agent 没有"该用哪个工具"的判断负担。之前出现过 Agent 用 create_entry 时漏填后缀导致 `.md` 被识别为代码的问题——根源就是 create_entry 要求 Agent 同时正确填写 filename、content。publish_files 从路径自动推断文件名和后缀，消除这类错误。

**2. Agent 会自然落盘，不需要 create_entry**
Claude Code、Codex 等 Agent 都有 write_file 类工具。生成内容后写文件是它们完成任务的自然步骤，不是绕路。流程：
```
Agent 生成内容 → write_file("/tmp/x.md", content) → publish_files({paths:["/tmp/x.md"]})
```
这个流程：
- 不需要任何特殊引导（write_file 是 Agent 本能）
- 生成的内容有持久化记录（用户事后可查）
- 上下文只有路径，无内容膨胀

**3. "不想落盘"的场景在本地部署中几乎不存在**
本地模式（A=B）下，Agent 在本机运行，写临时文件到 /tmp 无副作用。唯一需要 create_entry 的场景（Agent 生成内容且坚决不落盘）在本地部署里没有实际意义。

### 2.3 远程模式不暴露 publish_files

远程模式下 Agent 传入的是 A 机器路径，MCP Server 运行在 B 机器，路径语义不成立（B 机器上没有那个文件）。工具描述写 "publish local files"，但 "local" 对 Agent（A）和 MCP Server（B）是不同机器，会导致 Agent 理解错误。

如果 B 机器管理员需要发布 B 上的文件，那是另一个用户场景，应在 B 上部署一个 local 模式 MCP Server。

---

## 三、用户故事

- **作为** 使用 PeekView 的 Agent 用户
- **我希望** MCP Server 根据部署位置自动提供正确的工具集
- **以便** 本地部署时发布文件不撑爆上下文，远程部署时仍能发布 Agent 生成的内容

---

## 四、验收标准

- [x] AC1: MCP Server 支持 `mode: remote | local`，默认 `remote`
- [x] AC2: remote 模式暴露 `create_entry/get_entry/list_entries/delete_entry`，**不暴露** `publish_files`
- [x] AC3: local 模式暴露 `publish_files/get_entry/list_entries/delete_entry`，**不暴露** `create_entry`
- [x] AC4: `publish_files` 支持绝对路径文件和目录递归扫描
- [x] AC5: `publish_files` 工具描述明确"不要先 read_file"
- [x] AC6: `publish_files` 实现敏感路径黑名单，优先级最高
- [x] AC7: `publish_files` 支持 `allowed_paths` 显式 allowlist
- [x] AC8: local 模式未配置 `allowed_paths` 时不拒绝启动，仅允许 cwd 范围内路径并输出 warning
- [x] AC9: `publish_files` 从文件路径自动推断文件名和后缀（不要求 Agent 填写）
- [x] AC10: `publish_files` 返回 skipped files 及 reason
- [x] AC11: 文件数/单文件/总大小限制与后端对齐并留余量
- [x] AC12: `publish_files` 使用 `fs.realpath` 解析符号链接后再做边界检查
- [x] AC13: `spec-mcp-publish-files.md` 顶部声明已被双模式 spec 取代
- [x] AC14: 单元测试覆盖 local/remote 工具列表、路径安全、目录扫描、跳过原因、文件名推断
- [x] AC15: 旧 `mcp-local-remote-mode-v0.7.md` 标注工具策略已被本文取代

---

## 五、安全模型（三层防护）

| 优先级 | 防护层 | 行为 |
|--------|--------|------|
| 1 | 硬编码敏感路径黑名单 | 始终拒绝：`.ssh/`, `.gnupg/`, `.aws/`, `.config/gcloud/`, `*.pem`, `*.key`, `*.p12`, `*.pfx` |
| 2 | 用户配置 `allowed_paths` | 若配置，只允许这些目录下的真实路径 |
| 3 | cwd fallback | 未配置 `allowed_paths` 时，仅允许 MCP Server 启动时的工作目录下的路径 |

### cwd fallback 的明确说明

- 本地模式下 MCP Server 与 Agent 同机，启动 cwd 通常是用户的项目目录
- **警告**：若 MCP Server 作为 systemd/launchd 服务运行，cwd 可能是服务工作目录（如 `/`），此时 cwd fallback 会允许过大范围。文档必须提示：**作为系统服务运行时，必须显式配置 `allowed_paths`**
- 启动校验：
  ```typescript
  if (config.mode === 'local' && config.allowedPaths.length === 0) {
    logger.warn(
      '未配置 allowed_paths，仅允许当前工作目录下的路径。' +
      '若作为系统服务运行，强烈建议显式配置 allowed_paths。'
    );
  }
  ```

### 路径校验流程（修正：stat 先于 realpath）

`fs.realpath()` 对不存在的路径抛 ENOENT，因此必须先 stat 检查存在性。

```
1. paths 必须是绝对路径（否则拒绝整个请求）
2. fs.stat() 检查存在性（不存在 → skip，reason: not_found，继续其他文件）
3. fs.realpath() 解析符号链接（此时文件确定存在）
4. 黑名单检查（命中 → 拒绝整个请求）
5. allowedPaths/cwd 边界检查（越界 → 拒绝整个请求）
6. 通过后读取文件
7. 目录扫描跳过：.git, node_modules, __pycache__, .venv, dist, build, .next, .nuxt, coverage, .DS_Store
```

### 失败处理策略

- **安全类失败**（黑名单命中、路径越界）→ **拒绝整个请求**。避免被用于探测文件系统（逐个路径试探哪些存在/被拒）。
- **非安全类失败**（文件不存在、二进制、超大）→ **skip 单个文件，继续处理其他**，在 skipped 里说明原因。

---

## 六、配置设计

### 配置文件（`~/.peekview/mcp-config.yaml`）

```yaml
# remote 模式（默认，无需配置 mode）
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com

server:
  port: 33333
```

```yaml
# local 模式
peekview:
  url: https://peek.example.com
  public_url: https://peek.example.com

server:
  mode: local
  allowed_paths:
    - /home/alice/projects
    - /tmp/peekview-staging
```

### 命名规范（统一）

| 层级 | mode | allowed_paths |
|------|------|---------------|
| YAML 配置 | `server.mode` | `server.allowed_paths` |
| TypeScript 类型 | `mode` | `allowedPaths` |
| 环境变量 | `MCP_MODE` | `MCP_ALLOWED_PATHS`（冒号分隔） |

> 注：mode/allowed_paths 放在 `server:` 下，与 port/host 保持嵌套一致（采纳评审 M6）。

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
  mode: 'local' | 'remote';     // 默认 'remote'
  allowedPaths: string[];        // 默认 []
}
```

---

## 七、publish_files 工具设计

### 输入 Schema

```typescript
const schema = z.object({
  summary: z.string().min(1).max(500),
  paths: z.array(z.string().min(1)).min(1).max(50),  // 绝对路径，文件或目录
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().default(true),
  expires_in: z.string().optional(),
  include_patterns: z.array(z.string()).optional(),  // glob，如 ["*.py","*.md"]
  exclude_patterns: z.array(z.string()).optional(),
});
```

### 文件名匹配（include/exclude_patterns）

只支持**文件名通配**（如 `*.py`、`*.md`），不支持完整路径 glob。

**不使用 `fs.glob`**（Node 22+ 才有，engines 要求 >=18）或 minimatch（避免增加依赖），自实现：

```typescript
function matchPattern(filename: string, pattern: string): boolean {
  // glob → 正则：转义特殊字符，* → [^/]*
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
  );
  return regex.test(filename);
}
```

### 语言检测：交给后端

publish_files 传给后端的 files_data **只含 `path`（相对路径）和 `content`，不传 `language`**。
后端 `entry_service.py` 的 `detect_language` 会从文件名和内容自动推断语言。

这是"只暴露 publish_files"决策的核心优势：从根本上消除 create_entry 时代"Agent 填错后缀/language 导致渲染错误"的问题（如 `.md` 被识别为代码）。

### 二进制文件处理（初版）

PeekView 后端支持二进制文件（base64），但 publish_files 初版**跳过二进制文件**：
- 读取失败或检测为二进制 → skip，reason: `binary`
- 在结果中明确告知用户哪些文件被跳过
- base64 上传支持作为后续增强（避免初版复杂度）

### 文件大小限制（对齐后端，考虑 base64 膨胀）

后端实际限制：单文件 10MB、总大小 100MB、最多 50 文件。

```typescript
const MAX_SINGLE_FILE_BYTES = 7 * 1024 * 1024;   // 7MB（后端10MB，扣除base64 33%膨胀余量）
const MAX_TOTAL_FILES = 50;                         // 对齐后端 max_entry_files
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;          // 50MB（后端100MB的一半，留余量）
```

### 错误处理

复用现有 `translateError`（utils.ts），与其他工具统一。

### skipped 反馈

```typescript
interface SkippedFile {
  path: string;
  reason: 'binary' | 'too_large' | 'not_allowed' | 'not_found';
}
```

返回示例：
```
✓ 已发布 3 个文件
  src/main.py (2.1 KB)
  src/utils.py (0.8 KB)
  README.md (1.2 KB)
⚠ 跳过 2 个：
  logo.png — 二进制文件
  dump.log — 超过 7MB
🔗 https://peek.example.com/abc123
```

### 工具描述

```
Publish local files or directories to PeekView. MCP Server reads files directly.

⚠️ Do NOT call read_file before this tool — pass paths directly.
Filenames and extensions are inferred from paths automatically.
Paths must be absolute. Directories are scanned recursively.

Examples:
- File:      { "summary": "Fix", "paths": ["/project/fix.py"] }
- Directory: { "summary": "Src", "paths": ["/project/src/"] }
- Mixed:     { "summary": "v1", "paths": ["/project/src/", "/project/README.md"] }
- Filtered:  { "summary": "Py", "paths": ["/project/"], "include_patterns": ["*.py"] }

For Agent-generated content: write it to a file first (write_file), then publish the path.
Skipped automatically: .git, node_modules, __pycache__, .venv, dist, build
```

---

## 八、实施步骤

### Step 1：修订规格文档
- `spec-mcp-local-remote-mode.md`：工具策略改为"local 只暴露 publish_files（不含 create_entry）"，安全模型三层，版本 v0.7.0
- `spec-mcp-publish-files.md`：顶部加取代声明
- `mcp-vs-cli-positioning.md`：根本限制表述改为"LLM-in-the-loop 架构限制"
- `mcp-local-remote-mode-v0.7.md`：顶部标注工具策略已被本文取代

### Step 2：配置系统扩展
- `config.ts`：ServerConfig 加 `mode`、`allowedPaths`
- `config/file.ts`：ConfigFileData 的 `server` 下加 `mode`、`allowed_paths`
- `config/merge.ts`：解析 + 环境变量覆盖 + local 模式 warning

### Step 3：实现 publish_files
- 新文件 `src/tools/publishFiles.ts`
- 路径校验、目录扫描、黑名单、allowlist/cwd、realpath、限制、skipped

### Step 4：工具注册按模式区分
- `src/tools/index.ts`：`createTools` 签名从 `(client, publicUrl)` 改为 `(client, config)`
  ```typescript
  export function createTools(client: PeekViewClient, config: ServerConfig): ToolDefinition[] {
    const common = [getEntryTool(client), listEntriesTool(client), deleteEntryTool(client)];
    if (config.mode === 'local') {
      return [publishFilesTool(client, config), ...common];
    }
    return [createEntryTool(client, config.publicUrl), ...common];
  }
  ```
- **调用方同步更新**（签名变更影响面）：
  - `src/server.ts`：调用 `createTools(client, ...)` 处改为传 `config`
  - `createEntryTool` 仍从 `config.publicUrl` 取 publicUrl
  - 检查其他引用 `createTools` 的位置（测试文件等）一并更新

### Step 5：测试
| 测试文件 | 覆盖 |
|----------|------|
| `config.test.ts` | mode/allowedPaths 解析、env 覆盖、默认 remote |
| `server.test.ts` | local/remote 工具列表（关键：local 无 create_entry，remote 无 publish_files）|
| `publishFiles.test.ts` | 路径校验、目录扫描、黑名单、allowlist、cwd fallback、skipped、文件名推断、realpath |

验证：`make build-mcp && make test-mcp-unit`

---

## 九、迁移说明

### 现有用户
无需改动，默认 remote，工具集不变。

### 需要本地文件发布
在 Agent 所在机器安装 MCP Server，配置 local 模式，MCP 连接指向 localhost:33333。

### remote ↔ local 切换
改 `server.mode` → 配 `allowed_paths` → 重启 MCP Server → 更新 Agent 的 MCP 连接地址（如有变化）。

---

## 十、版本规划

- MCP Server **v0.7.0**（Breaking Change：工具集随模式变化）
- 现有 remote 用户无感知（默认 remote）
- local 为 opt-in 新能力

---

## 十一、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| prompt injection 诱导发布敏感文件 | 高 | 黑名单优先 + realpath + allowlist/cwd 边界 + 系统服务必须配 allowed_paths |
| 系统服务下 cwd fallback 范围过大 | 中 | 文档强提示 + 启动 warning |
| 大目录扫描内存/时间过高 | 中 | 文件数/单文件/总大小限制 + 跳过构建目录 |
| Agent 不落盘直接想发内容 | 低 | 工具描述引导 write_file；本地部署该场景无实际意义 |

---

*方案创建：2026-06-09*
