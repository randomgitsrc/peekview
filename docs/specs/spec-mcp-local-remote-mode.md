# MCP Server 本地/远程双模式设计

> 日期：2026-05-24  
> 背景：架构分析发现 A≠B 时 MCP 无法直接访问 Agent 本地文件，
>       需要根据部署拓扑提供不同的工具集
>
> 📌 **实现以 `docs/plans/mcp-dual-mode-final-v0.7.md` 为权威。**
> 本规格的工具策略（local 只暴露 publish_files）与最终方案一致；
> 安全模型以最终方案的三层防护为准（黑名单 → allowed_paths → cwd fallback）。

---

## 一、问题背景

### 部署拓扑

```
模式 A=B→C（本地模式）         模式 A→B→C（远程模式）
┌─────────────────┐             ┌──────┐    ┌──────┐    ┌──────┐
│  A = B（本机）  │             │  A   │───▶│  B   │───▶│  C   │
│ Claude + MCP    │────▶ C      │Agent │    │ MCP  │    │Peek  │
└─────────────────┘             └──────┘    └──────┘    └──────┘
文件和MCP同机，                 文件在A，MCP在B，
路径直接可达                    路径跨机不可达
```

### 核心矛盾

- **本地模式（A=B）**：MCP Server 和文件在同一台机器，路径可达，可以直接读文件
- **远程模式（A≠B）**：MCP Server 在远程，无法访问 Agent 本地文件；Agent 调用 MCP 工具时文件内容必须经过 LLM 上下文，大文件导致推理时间爆炸（实测 ~2 分钟）

### 设计原则

**选择越多，出错越多。** 不同部署模式下只暴露一套工具，Agent 看到什么就用什么，不需要判断模式。

---

## 二、双模式工具策略

| | 本地模式（local） | 远程模式（remote，默认） |
|---|---|---|
| 适用拓扑 | A=B→C | A→B→C |
| 安装位置 | Agent 所在机器 | 任意服务器 |
| 暴露工具 | `publish_files` | `create_entry` |
| Agent 传什么 | 文件/目录绝对路径 | 文件内容（Agent 生成的） |
| 文件名/后缀 | 从路径自动推断 | Agent 手动填写（易出错）|
| 大文件支持 | ✅ | ❌ 撑上下文 |
| 典型场景 | 发布本地项目文件 | Agent 自主发布生成内容 |

**关键设计决策：两种模式的工具不重叠。**
- 本地模式屏蔽 `create_entry`（Agent 应用路径，不传内容）
- 远程模式屏蔽 `publish_files`（MCP 在远程读不到本地文件）

---

## 三、配置设计

### 配置文件（`~/.peekview/mcp-config.yaml`）

```yaml
# 远程模式（默认，不需要配置 mode）
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com
  api_key: pv_xxx  # 可选，多用户模式下由 Agent 提供 token

server:
  port: 33333
```

```yaml
# 本地模式：增加 mode 和 allowed_paths
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com

server:
  mode: local                    # 开启本地模式
  allowed_paths:                 # 安全边界：允许访问的目录
    - /home/alice/projects
    - /tmp/peekview-staging
```

### ServerConfig 类型扩展

```typescript
// config.ts
export interface ServerConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;

  // 新增
  mode: 'local' | 'remote';    // 默认 'remote'
  allowedPaths: string[];       // 本地模式的安全边界，默认 []
}
```

### 环境变量（优先级高于配置文件）

```bash
MCP_MODE=local                          # 'local' | 'remote'
MCP_ALLOWED_PATHS=/home/alice/projects:/tmp  # 冒号分隔
```

### 启动时校验

```typescript
// 本地模式未配置 allowed_paths 时不拒绝启动，仅 warning + cwd 限制
// （详见 docs/plans/mcp-dual-mode-final-v0.7.md 三层安全模型）
if (config.mode === 'local' && config.allowedPaths.length === 0) {
  logger.warn(
    '未配置 allowed_paths，仅允许当前工作目录下的路径。' +
    '若作为系统服务运行，强烈建议显式配置 allowed_paths。'
  );
}
```

---

## 四、工具注册逻辑

```typescript
// server.ts
export function createTools(client: PeekViewClient, config: ServerConfig): ToolDefinition[] {
  const common = [getEntryTool(client), listEntriesTool(client), deleteEntryTool(client)];
  if (config.mode === 'local') {
    // 本地模式：只暴露 publish_files + 通用工具
    return [publishFilesTool(client, config), ...common];
  }
  // 远程模式（默认）：只暴露 create_entry + 通用工具
  return [createEntryTool(client, config.publicUrl), ...common];
}
```

**本地模式只暴露 `publish_files`，不暴露 `create_entry`。**
Agent 通过 `list_tools` 看到的工具列表即为可用工具，无需感知部署模式。

---

## 五、publish_files 工具设计（本地模式专用）

### 输入 Schema

```typescript
const schema = z.object({
  summary: z.string().min(1).max(500),
  paths: z.array(z.string().min(1)).min(1),  // 绝对路径，文件或目录
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().default(true),
  expires_in: z.string().optional(),
  include_patterns: z.array(z.string()).optional(),  // glob，如 ["*.py", "*.md"]
  exclude_patterns: z.array(z.string()).optional(),
});
```

**路径必须是绝对路径。** 不接受相对路径，避免跨 Agent 的 cwd 歧义。

### 工具描述

```
Publish local files or directories to PeekView.
MCP Server reads files directly — no need to read_file first.
Paths must be absolute. Supports single files and directories (recursive).

Examples:
- File:      { "summary": "Fix", "paths": ["/project/fix.py"] }
- Directory: { "summary": "Src", "paths": ["/project/src/"] }
- Mixed:     { "summary": "v1.0", "paths": ["/project/src/", "/project/README.md"] }
- Filtered:  { "summary": "Python", "paths": ["/project/"], "include_patterns": ["*.py"] }

Skipped automatically: .git, node_modules, __pycache__, .venv, dist, build
```

### 文件读取限制（对齐后端实际配置）

```typescript
const MAX_SINGLE_FILE_BYTES = 7 * 1024 * 1024;   // 7MB（后端上限 10MB，留 base64 膨胀余量）
const MAX_TOTAL_FILES = 50;                         // 对齐后端 max_entry_files=50
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;          // 50MB（后端上限 100MB，留余量）
```

### 路径安全

```typescript
// 三层防护：黑名单 → allowed_paths → cwd fallback（cwd 为 / 时拒绝 fallback）

// 第一层：硬编码黑名单（始终拒绝，优先级最高）
const SENSITIVE_PATTERNS = [
  /\/\.ssh\//,    // SSH 密钥
  /\/\.gnupg\//,  // GPG 密钥
  /\/\.aws\//,    // AWS 凭证
  /\/\.config\/gcloud\//,  // GCP 凭证
  /\.key$/,       // 私钥文件
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
];

// 第二层：allowlist（用户配置）
function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  const resolved = path.resolve(filePath);

  // 黑名单优先
  if (SENSITIVE_PATTERNS.some(p => p.test(resolved))) return false;

  // allowlist 检查
  return allowedPaths.some(allowed => {
    const base = path.resolve(allowed);
    return resolved === base || resolved.startsWith(base + path.sep);
  });
}

// 符号链接处理：解析真实路径后再检查 allowlist
async function validatePath(filePath: string, allowedPaths: string[]): Promise<string> {
  const realPath = await fs.realpath(filePath);  // 解析符号链接
  if (!isPathAllowed(realPath, allowedPaths)) {
    throw new Error(`路径不在允许范围内: ${filePath}`);
  }
  return realPath;
}
```

### 跳过原因反馈

```typescript
interface SkippedFile {
  path: string;
  reason: 'binary' | 'too_large' | 'not_allowed' | 'not_found';
}

// 工具返回示例
OK: 已发布 3 个文件到 PeekView
  main.py (2.1 KB)
  utils.py (0.8 KB)
  README.md (1.2 KB)

Skipped 2 个文件：
  logo.png — 二进制文件
  dump.log — 超过 7MB 限制

Link: https://peek.example.com/abc123
```

---

## 六、create_entry 工具描述更新（远程模式）

在现有描述基础上增加明确说明：

```
WARNING: For Agent-generated content only.
Do NOT call read_file before this tool — it will slow down your response significantly.

If you need to publish existing local files:
- Use publish_files tool (requires local mode MCP deployment)
- Or use the /peeklink slash command
```

---

## 七、安装指引

### 远程模式（默认，现有方式不变）

```bash
# 在服务器 B 上安装
npm install -g @peekview/mcp-server

# 配置
cat > ~/.peekview/mcp-config.yaml << EOF
peekview:
  url: http://localhost:8080
  public_url: https://peek.example.com
EOF

peekview-mcp start
```

Claude Code 配置：
```json
{
  "mcpServers": {
    "peekview": {
      "type": "sse",
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

### 本地模式（新增，安装在 Agent 所在机器 A）

```bash
# 在本机 A 上安装
npm install -g @peekview/mcp-server

# 配置本地模式
cat > ~/.peekview/mcp-config.yaml << EOF
peekview:
  url: https://peek.example.com   # PeekView 服务地址（可以是远程）
  public_url: https://peek.example.com

server:
  mode: local
  allowed_paths:
    - /home/alice/projects           # 允许访问的目录
    - /tmp
EOF

peekview-mcp start
```

Claude Code 配置（本地连接）：
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

---

## 八、实施计划

### Task 1：配置系统扩展
- `config/merge.ts`：新增 `mode`、`allowedPaths` 字段解析
- `config/file.ts`：`ConfigFileData` 新增 `mode`、`allowed_paths`
- `config.ts`：`ServerConfig` 新增两个字段
- 启动校验：local 模式未配置 allowedPaths 时 warning + cwd fallback；cwd 为 `/` 时拒绝 fallback

### Task 2：实现 `publish_files` 工具
- 新文件：`src/tools/publishFiles.ts`
- 实现路径解析、目录扫描、allowlist 校验、符号链接处理
- 实现跳过原因反馈

### Task 3：工具注册按模式区分
- `src/tools/index.ts`：`createTools()` 根据 `config.mode` 返回不同工具集
- `src/server.ts`：无需改动（工具由 `createTools` 决定）

### Task 4：更新 `create_entry` 描述
- 加"不要先 read_file"的明确说明

### Task 5：测试
- `tests/publishFiles.test.ts`：路径安全、目录扫描、限制、skipped 反馈
- `tests/server.test.ts`：local/remote 模式下工具列表验证

### Task 6：文档和 CLI
- `README.md`：增加本地模式安装章节
- `peekview-mcp config set mode local`：CLI 命令支持设置 mode
- `peekview-mcp config set allowed-paths /path1 /path2`

---

## 九、版本规划

- 本次改动为 **MCP Server v0.7.0**（Breaking Change：工具集根据模式变化）
- 现有远程模式用户无感知（默认 remote，行为不变）
- 本地模式为新增能力，需要用户主动配置

---

*设计完成：2026-05-24*
