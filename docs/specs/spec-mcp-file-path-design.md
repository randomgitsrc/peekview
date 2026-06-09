# MCP create_entry 文件传递方式重设计

> 作者：专家评审
> 日期：2026-05-24
> 触发问题：MCP 调用 create_entry 耗时 ~2 分钟，根因是 Claude 把文件内容塞进上下文

---

## 问题根因

当前 `create_entry` 工具要求 Claude 传入文件**内容**：

```json
{
  "files": [{"filename": "main.py", "content": "（几百行代码）"}]
}
```

这导致：
1. Claude 必须将文件内容读入自己的上下文
2. 大文件（几万 token）让 Claude 推理时间急剧增加
3. 用户看到的"2分钟"几乎全部是 Claude 的推理等待时间

**CLI 的正确做法**：接收路径参数 → 自己读文件 → 传 content 给 API。MCP Server 应该做同样的事。

---

## 设计原则

参考 Anthropic 官方 filesystem MCP server 和业界实践，**MCP 工具处理本地文件时，应接收路径而非内容**。Claude 的职责是"决定发什么、怎么组织"，不是"搬运文件内容"。

---

## 新设计：`create_entry` 只接受路径

### 工具输入

```typescript
const schema = z.object({
  summary: z.string().min(1),
  paths: z.array(z.string()).min(1),  // 文件或目录路径（绝对路径或相对路径）
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  expires_in: z.string().optional(),
});
```

**`content` 字段完全移除。** Claude 传路径，MCP Server 读文件。

### 路径解析逻辑（MCP Server 侧）

```typescript
// MCP Server 的文件读取逻辑，对标 CLI 的实现
async function resolvePaths(paths: string[], cwd: string): Promise<FileData[]> {
  const files: FileData[] = [];

  for (const p of paths) {
    // 相对路径 → 基于 cwd 解析
    const resolved = path.isAbsolute(p) ? p : path.join(cwd, p);
    const stat = await fs.stat(resolved);

    if (stat.isDirectory()) {
      // 目录：递归扫描，对标 CLI 的 _scan_directory_local
      const dirFiles = await scanDirectory(resolved);
      files.push(...dirFiles);
    } else {
      // 文件：直接读取
      const content = await fs.readFile(resolved, 'utf-8');
      files.push({
        filename: path.basename(resolved),
        path: path.relative(path.dirname(resolved), resolved),
        content,
      });
    }
  }

  return files;
}

async function scanDirectory(dirPath: string): Promise<FileData[]> {
  const IGNORED_DIRS = new Set([
    '.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build',
    '.next', '.nuxt', 'coverage', '.DS_Store',
  ]);
  const files: FileData[] = [];

  async function walk(dir: string, base: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, base);
      } else {
        try {
          const content = await fs.readFile(full, 'utf-8');
          files.push({
            filename: entry.name,
            path: path.relative(base, full),
            content,
          });
        } catch {
          // 二进制文件跳过，与 CLI 行为一致
        }
      }
    }
  }

  await walk(dirPath, dirPath);
  return files;
}
```

### `cwd` 如何获取

MCP Server 在 SSE 连接建立时，从 Claude Code 的环境中获取工作目录。有两种方式：

**方式 A（推荐）**：工具接受可选的 `cwd` 参数，Claude 自己告知：
```json
{
  "summary": "项目文件",
  "paths": ["src/main.py", "README.md"],
  "cwd": "/Users/alice/my-project"
}
```

**方式 B**：MCP Server 启动时记录进程的 `process.cwd()`，所有相对路径基于此解析。

方式 A 更灵活，因为 Claude Code 的工作目录可能随对话切换。工具描述里引导 Claude 提供 `cwd`。

---

## 关于"Claude 生成的内容写到哪里"

这是一个**工作流设计**问题，不是 MCP Server 的功能问题。

### 正确的工作流

**场景 1：发布现有文件**
```
Claude Code: "把 /project/src/ 发布到 PeekView"
→ create_entry({ paths: ["/project/src/"], summary: "项目源码" })
→ MCP Server 读目录 → 发 API
```

**场景 2：Claude 生成内容后发布**
```
Claude Code: 生成代码
→ [Claude 用 write_file 写到磁盘，如 /tmp/generated/fix.py]
→ create_entry({ paths: ["/tmp/generated/fix.py"], summary: "修复方案" })
→ MCP Server 读文件 → 发 API
```

**Claude 写文件用自己的工具（write_file），MCP create_entry 只负责"发布"。** 这是正确的职责分离。

### "碎片化"问题的处理

用户担心 Claude 生成的文件散落各处。有两个层次的应对：

**层次 1（不做，只靠工作流引导）**：在工具描述里告诉 Claude：
> "生成的文件请先写到项目目录或 /tmp/peekview-staging/ 下，再用路径发布。"

这足够了。Claude 理解工作流后会自动遵循。

**层次 2（可选，未来考虑）**：提供 `stage` 工具：
```
create_entry 拆成两步：
1. peekview_stage(content, filename) → 写到 ~/.peekview/staging/{uuid}/filename
2. peekview_publish(staging_id, summary) → 读 staging 目录 → 发布
```

但这增加了复杂度，且 Claude Code 本身的 `write_file` 已经可以做到步骤 1 的事。**暂不实现，先用层次 1。**

---

## 安全边界

MCP Server 读取本地文件，需要有访问控制，防止 Claude 被注入恶意指令访问敏感文件（如 `~/.ssh/id_rsa`）。

对标 Anthropic filesystem MCP server 的 allowlist 机制：

```typescript
// config.ts 新增
interface McpConfig {
  // ...现有配置...
  allowed_paths?: string[];  // 允许读取的目录列表，默认为空（允许所有）
}
```

```typescript
// tools/createEntry.ts
function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  if (!allowedPaths || allowedPaths.length === 0) return true;  // 未配置则不限制
  const resolved = path.resolve(filePath);
  return allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
}
```

配置示例（`~/.peekview/mcp-config.yaml`）：
```yaml
allowed_paths:
  - /home/alice/projects
  - /tmp/peekview-staging
```

**初始版本可以不做 allowlist**（默认允许所有路径），在工具描述里注明，后续版本再加。

---

## 工具描述更新

```typescript
description: `Publish local files to PeekView. Accepts file or directory paths.

MCP Server reads the files directly — do NOT include file content in the call.

Usage:
- Single file: { "summary": "Fix", "paths": ["/project/fix.py"] }
- Directory:   { "summary": "Project", "paths": ["/project/src/"] }
- Mixed:       { "summary": "Report", "paths": ["/project/src/", "/project/README.md"] }
- Relative paths (provide cwd): { "paths": ["src/main.py"], "cwd": "/project" }

For Claude-generated content: use write_file to save first, then provide the path here.

Ignored automatically: .git, node_modules, __pycache__, .venv, dist, build`
```

---

## 实施计划

### Task 1：重写 `create_entry` 工具（核心改动）

**文件**：`packages/mcp-server/src/tools/createEntry.ts`

- 移除 `files` 参数（含 content 字段）
- 新增 `paths` 参数（字符串数组）
- 新增可选 `cwd` 参数
- 新增 `resolvePaths()` 函数（读文件）
- 新增 `scanDirectory()` 函数（对标 CLI）

**文件**：`packages/mcp-server/src/tools/fileNaming.ts`

- 保留不动（路径模式下依然可以用内容检测扩展名）

### Task 2：更新类型定义

**文件**：`packages/mcp-server/src/types.ts`

- 移除 `CreateEntryRequest.files` 中的 `content` 字段相关类型

### Task 3：更新测试

**文件**：`packages/mcp-server/tests/tools.test.ts`

- 用 mock fs 替代 mock API content
- 测试路径解析、目录扫描、二进制文件跳过

### Task 4：更新 README 和工具描述

- 说明新的调用方式
- 提供"Claude 生成内容后发布"的工作流示例

---

## Breaking Change 说明

此改动是 **Breaking Change**：现有使用 `content` 参数的调用将失败。

- 版本号：MCP Server `v0.7.0`（文件路径设计已纳入双模式实现）
- 迁移：将 `files[].content` 替换为 `paths[]`（先用 write_file 写文件）
- CHANGELOG 需要明确标注

---

## 预期效果

| 指标 | 改动前 | 改动后 |
|------|--------|--------|
| 小文件（1KB）调用时间 | ~10s（Claude 处理） | ~2s |
| 大文件（100KB）调用时间 | ~2分钟 | ~3s |
| 上下文消耗 | 随文件大小线性增长 | 固定（只有路径字符串） |
| 文件大小上限 | 受 context window 限制 | 实际磁盘大小 |

---

*设计完成：2026-05-24*
