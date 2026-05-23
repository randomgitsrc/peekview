# MCP publish_files 工具设计

> 作者：gstack 专家评审
> 日期：2026-05-24
> 背景：解决本地文件发布场景下 Agent 需要先 read_file 再传 content 导致的 ~2 分钟延迟

---

## 一、问题的准确定位

当前 `create_entry` 工具只接受文件内容（content），当 Agent 需要发布本地已有文件时，
必须先 read_file 把内容加载进上下文，再传给 create_entry，形成：

```
read_file(file) → 内容进上下文 → create_entry(content) → 推理处理大上下文 → 慢
```

**根因：文件内容被 Agent 的上下文处理了两次（read 一次，write 一次），而这完全不必要。**

---

## 二、设计原则

**不改 create_entry，新增 publish_files。**

两个工具职责明确：

| 工具 | 适用场景 | 谁读文件 |
|------|---------|---------|
| `create_entry` | Agent 生成的内容（代码、文档、分析结果） | Agent 自己（内容已在上下文） |
| `publish_files` | 本地磁盘已有文件 | MCP Server 读（Agent 只传路径） |

这种分离：
- 不绑定任何特定 Agent（Claude Code、Codex、opencode 等均适用）
- 不依赖 MCP 协议的 `roots` 特性（各 Agent 实现程度不一）
- 接口语义清晰，Agent 根据场景选择正确工具

### create_entry 的慢问题同步修复

在 `create_entry` 的工具描述里加明确说明，引导 Agent 不要先 read_file：

```
⚠️ Do NOT call read_file before this tool.
If you have already generated the content, pass it directly via 'files'.
If the content is in files on disk, use 'publish_files' instead.
```

这样 Agent 在使用 create_entry 时直接传自己生成的内容，不多一步 read_file，
推理时间从 ~2 分钟降到正常的 5-10 秒。

---

## 三、publish_files 工具设计

### 3.1 输入 schema

```typescript
const schema = z.object({
  // 必填
  summary: z.string().min(1).max(500),

  // 路径列表（文件或目录，必须是绝对路径）
  paths: z.array(z.string().min(1)).min(1).max(50),

  // 可选：PeekView entry 选项
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().default(true),
  expires_in: z.string().optional(),

  // 可选：文件过滤
  include_patterns: z.array(z.string()).optional(), // glob 模式，如 ["*.py", "*.md"]
  exclude_patterns: z.array(z.string()).optional(), // glob 模式，如 ["*.log", "*.tmp"]
});
```

**路径必须是绝对路径。** 不接受相对路径，避免 cwd 歧义（不同 Agent 的 cwd 语义不同）。
Agent 应该知道自己操作文件的绝对路径——如果不知道，就不应该调用这个工具。

### 3.2 工具描述

```
Publish local files to PeekView. MCP Server reads the files directly.

Use this instead of create_entry when publishing existing files from disk.
Paths must be absolute. Supports files and directories.

Examples:
- Single file:   { "summary": "Fix", "paths": ["/project/fix.py"] }
- Directory:     { "summary": "Src", "paths": ["/project/src/"] }
- Mixed:         { "summary": "Release", "paths": ["/project/src/", "/project/README.md"] }
- With filter:   { "summary": "Python only", "paths": ["/project/"], "include_patterns": ["*.py"] }

Directories are scanned recursively. Automatically skipped:
.git, node_modules, __pycache__, .venv, dist, build, .next, coverage

⚠️ Requires 'allowed_paths' configuration in MCP Server config.
   The server will reject paths not in the allowed list.
```

### 3.3 文件读取逻辑

```typescript
// tools/publishFiles.ts

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.DS_Store', '.idea', '.vscode',
]);

const MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024;   // 2MB 单文件上限
const MAX_TOTAL_FILES = 200;                        // 最多200个文件
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;          // 20MB 总大小上限

interface FileData {
  filename: string;
  path: string;    // 相对路径（用于在 PeekView 里显示目录结构）
  content: string;
}

interface ScanResult {
  files: FileData[];
  skipped: string[];   // 跳过的文件（二进制、过大、超限等）
  warnings: string[];
}

async function resolvePaths(
  paths: string[],
  allowedPaths: string[],
  includePatterns?: string[],
  excludePatterns?: string[],
): Promise<ScanResult> {
  const result: ScanResult = { files: [], skipped: [], warnings: [] };
  let totalBytes = 0;

  for (const p of paths) {
    // 1. 必须绝对路径
    if (!path.isAbsolute(p)) {
      result.warnings.push(`跳过相对路径（只接受绝对路径）: ${p}`);
      continue;
    }

    // 2. allowlist 检查
    if (!isPathAllowed(p, allowedPaths)) {
      throw new Error(
        `路径不在允许的目录中: ${p}\n` +
        `请在 MCP Server 配置的 allowed_paths 中添加此路径。`
      );
    }

    const stat = await fs.stat(p).catch(() => null);
    if (!stat) {
      result.warnings.push(`路径不存在: ${p}`);
      continue;
    }

    if (stat.isDirectory()) {
      const dirResult = await scanDirectory(p, p, allowedPaths, includePatterns, excludePatterns);
      result.files.push(...dirResult.files);
      result.skipped.push(...dirResult.skipped);
      totalBytes += dirResult.files.reduce((s, f) => s + f.content.length, 0);
    } else {
      const fileResult = await readSingleFile(p, path.dirname(p));
      if (fileResult) {
        result.files.push(fileResult);
        totalBytes += fileResult.content.length;
      } else {
        result.skipped.push(p);
      }
    }

    // 总大小检查
    if (totalBytes > MAX_TOTAL_BYTES) {
      result.warnings.push(`总大小超过 20MB，已停止读取`);
      break;
    }
    if (result.files.length > MAX_TOTAL_FILES) {
      result.warnings.push(`文件数超过 200，已停止读取`);
      break;
    }
  }

  return result;
}

async function scanDirectory(
  dir: string,
  base: string,
  allowedPaths: string[],
  includePatterns?: string[],
  excludePatterns?: string[],
): Promise<ScanResult> {
  const result: ScanResult = { files: [], skipped: [], warnings: [] };
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const sub = await scanDirectory(full, base, allowedPaths, includePatterns, excludePatterns);
      result.files.push(...sub.files);
      result.skipped.push(...sub.skipped);
    } else if (entry.isFile()) {
      // include/exclude 过滤
      if (!matchesPatterns(entry.name, includePatterns, excludePatterns)) {
        continue;
      }
      const fileResult = await readSingleFile(full, base);
      if (fileResult) result.files.push(fileResult);
      else result.skipped.push(full);
    }
  }

  return result;
}

async function readSingleFile(filePath: string, base: string): Promise<FileData | null> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_SINGLE_FILE_BYTES) return null; // 超过 2MB，跳过

    const content = await fs.readFile(filePath, 'utf-8');
    return {
      filename: path.basename(filePath),
      path: path.relative(base, path.dirname(filePath)) || '',
      content,
    };
  } catch {
    return null; // 二进制文件或读取失败，跳过
  }
}
```

### 3.4 安全边界：allowlist

**MCP Server 配置文件（`~/.peekview/mcp-config.yaml`）：**

```yaml
allowed_paths:
  - /home/alice/projects
  - /tmp/peekview-staging
```

**默认行为：空 allowlist = 拒绝所有路径请求。**

用户必须明确配置才能使用 `publish_files`。这与 Anthropic 官方 filesystem MCP server 的设计一致——安全优先，用户主动授权。

如果 `publish_files` 被调用但未配置 allowlist，工具返回清晰的错误提示：

```
✗ publish_files 需要在 MCP Server 配置文件中设置 allowed_paths。

请编辑 ~/.peekview/mcp-config.yaml，添加：
  allowed_paths:
    - /path/to/your/project

然后重启 MCP Server。
```

```typescript
function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  if (!allowedPaths || allowedPaths.length === 0) return false; // 未配置 = 拒绝
  const resolved = path.resolve(filePath);
  return allowedPaths.some(allowed =>
    resolved === path.resolve(allowed) ||
    resolved.startsWith(path.resolve(allowed) + path.sep)
  );
}
```

---

## 四、工具描述的引导策略（关键）

Agent 选择工具的依据完全是工具描述。描述写得好，Agent 自动选正确工具。

**create_entry 描述更新（关键部分）：**

```
For Agent-generated content only. Do NOT use for existing files on disk.

❌ Wrong: read_file("main.py") → create_entry({content: ...})
✅ Right for existing files: publish_files({paths: ["/project/main.py"]})
✅ Right for generated content: create_entry({files: [{filename: "fix.py", content: "..."}]})
```

**publish_files 描述（关键部分）：**

```
For existing files on disk. MCP Server reads directly — no read_file needed.

❌ Wrong: read_file → collect content → publish_files
✅ Right: publish_files({paths: ["/absolute/path/to/file"]})
```

---

## 五、实施计划

### Task 1：新增 `publish_files` 工具

**新文件**：`packages/mcp-server/src/tools/publishFiles.ts`
- 实现 schema、handler、resolvePaths、scanDirectory、isPathAllowed

**修改**：`packages/mcp-server/src/tools/index.ts`
- 注册 publishFiles 工具，传入 `config.allowedPaths`

### Task 2：ServerConfig 新增 `allowedPaths`

**修改**：`packages/mcp-server/src/config.ts`
```typescript
export interface ServerConfig {
  // ...现有字段...
  allowedPaths: string[];  // 默认 []
}
```

**修改**：`packages/mcp-server/src/config/merge.ts`
- 从配置文件读取 `allowed_paths`，合并进 config

**修改**：`~/.peekview/mcp-config.yaml` schema 文档

### Task 3：更新 `create_entry` 工具描述

**修改**：`packages/mcp-server/src/tools/createEntry.ts`
- 在 description 里加明确的选择引导（见第四节）

### Task 4：测试

**新文件**：`packages/mcp-server/tests/publishFiles.test.ts`
- mock fs，测试路径解析、目录扫描、allowlist 拦截
- 测试二进制文件跳过、超大文件跳过、超限时停止
- 测试相对路径拒绝
- 测试未配置 allowlist 时的清晰错误提示

---

## 六、不做什么（边界说明）

| 想法 | 不做的理由 |
|------|-----------|
| 依赖 MCP roots 做安全边界 | roots 各 Agent 实现不一，是 hints 不是权限控制 |
| 支持相对路径 | cwd 跨 Agent 语义不一致，绝对路径更清晰 |
| 合并两个工具为一个 | 职责混乱，工具描述无法清晰引导 Agent |
| 默认允许所有路径 | 安全风险，应该用户主动授权 |
| 支持 glob 作为顶层路径（如 `*.py`）| 路径应该是目录或文件，过滤用 include_patterns |

---

## 七、预期效果

| 场景 | 改动前 | 改动后 |
|------|--------|--------|
| Agent 发布自己生成的内容 | create_entry，~10s | create_entry，~5s（工具描述改善引导） |
| Agent 发布本地已有文件 | read_file + create_entry，~2min | publish_files，~3s |
| 发布整个目录 | 需要 Agent 逐文件 read | publish_files(dir)，MCP 递归扫描 |

---

*设计完成：2026-05-24*
