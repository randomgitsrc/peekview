# MCP 设计文档二次评审

> 评审框架：gstack review（Staff Engineer）
> 日期：2026-05-24
> 评审对象：`docs/reviews/expert-review-mcp-design.md`（对上轮三份设计文档的评审意见）
> 目的：对评审意见本身做二次核查，确认哪些建议正确、哪些有问题

---

## 上轮评审意见的核查结论

| 建议 | 结论 | 说明 |
|------|------|------|
| staging 目录改为 ~/.peekview/staging | ❌ 无需此设计 | staging 概念不存在于 publish_files spec，这是误读 |
| allowlist 改为渐进式（permissive 模式）| ⚠️ 部分同意 | 默认 cwd 沙箱比"默认拒绝"更合理，但 permissive 太宽松 |
| 硬编码黑名单（.ssh、.aws 等）| ✅ 正确 | 值得加，但实现方式需要更严谨 |
| 文件大小提升到 10MB/100MB | ⚠️ 数字错了 | 应该对齐后端实际限制，不是随意提升 |
| 路径安全：符号链接 + 路径遍历 | ✅ 正确 | 这是真实的安全缺口，必须修 |
| 二进制文件跳过给出原因 | ✅ 正确 | 改进体验，值得做 |
| git rev-parse 检测项目根目录 | ✅ 正确 | 解决了 cwd 歧义问题 |

---

## 上轮评审的问题

### 问题 1：误读 staging 设计

上轮评审提出"staging 目录改为 `~/.peekview/staging`"，但 `publish_files` spec 里根本没有 staging 概念——那是被否定的旧方案里的东西。`publish_files` 直接读文件传 API，不需要 staging 目录。

这个建议是对不存在的问题的修复，不应该采纳。

### 问题 2：文件大小数字与后端实际限制不一致

上轮建议"提升到 10MB/100MB"，但没有核查后端的实际配置。

后端实际限制（`config.py`）：
- `max_file_size = 10MB`（单文件）
- `max_entry_size = 100MB`（总大小）
- `max_entry_files = 50`（文件数）

spec 里写的是 2MB / 20MB / 200 文件，与后端都不一致。

**正确的做法：MCP Server 的限制应该≤后端限制，且应该从后端限制推导，不是随意设定。**

推荐值：
- 单文件：≤ 5MB（留给后端 10MB 上限的余量，内联传输 JSON 有编码开销）
- 总大小：≤ 50MB（后端 100MB 的一半，避免单次 MCP 调用占满后端配额）
- 文件数：≤ 50（与后端 max_entry_files 对齐）

### 问题 3：allowlist 的"渐进式安全模型"设计过于复杂

上轮建议三层防护（autoAllowed + 黑名单 + 用户配置），但这个模型有内在矛盾：

- `autoAllowed` 包含 `os.tmpdir()`——`/tmp` 目录通常对所有用户可写，prompt injection 场景下攻击者可以在 `/tmp` 放恶意文件让 Agent 发布
- `permissive` 模式默认允许 cwd，但 MCP Server 作为 systemd 服务运行时，cwd 是服务目录（如 `/`），等于允许所有路径

**更简洁且安全的设计：**

```typescript
// 安全边界的优先级（从高到低）：
// 1. 黑名单：始终拒绝（硬编码）
// 2. 用户配置的 allowedPaths：显式允许
// 3. session cwd：兜底允许（仅当 allowedPaths 为空时）

function isPathAllowed(filePath: string, config: McpConfig, sessionCwd: string): boolean {
  const resolved = path.resolve(filePath);

  // 第一层：硬编码黑名单，始终拒绝
  if (isSensitivePath(resolved)) return false;

  // 第二层：用户配置了 allowedPaths，严格按配置
  if (config.allowedPaths.length > 0) {
    return config.allowedPaths.some(p =>
      resolved === path.resolve(p) || resolved.startsWith(path.resolve(p) + path.sep)
    );
  }

  // 第三层：未配置 allowedPaths，默认只允许 session cwd 下的路径
  // 注意：systemd 服务场景下 sessionCwd 可能不可靠，需要文档说明
  return resolved.startsWith(path.resolve(sessionCwd) + path.sep)
      || resolved === path.resolve(sessionCwd);
}
```

这比三层模型更清晰，且没有 `/tmp` 默认允许的安全风险。

---

## 上轮评审遗漏的问题

### 遗漏 1：`publish_files` 的限制数字与后端不对齐（最重要）

上轮提到文件大小要提升，但没有指出根本问题：spec 里的三个限制数字（2MB / 200文件 / 20MB）都应该参考后端实际值来设定，不能凭空写。

**需要更新 spec 的具体数值：**

```typescript
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024;    // 5MB（后端上限10MB，留余量）
const MAX_TOTAL_FILES = 50;                          // 对齐后端 max_entry_files=50
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;           // 50MB（后端上限100MB，留余量）
```

### 遗漏 2：路径安全的实现方式有误

上轮建议：
```typescript
if (realPath.includes('..')) throw new Error('路径遍历攻击');
```

这是错误的——`realpath` 已经解析了所有 `..`，解析后的路径里不会有 `..`，这个检查永远不会触发，是无效代码。

正确的路径遍历防护：
```typescript
async function validatePath(filePath: string, allowedBase: string): Promise<string> {
  // realpath 同时处理符号链接和 ..
  const resolved = await fs.realpath(filePath);
  const base = await fs.realpath(allowedBase);

  // 关键检查：解析后的真实路径是否在允许的目录下
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`路径越界: ${filePath} 不在允许的目录 ${allowedBase} 下`);
  }
  return resolved;
}
```

### 遗漏 3：`/peeklink` 的安全性问题描述不准确

上轮建议在 `/peeklink` 里加"硬编码黑名单"，但 `/peeklink` 本质上是调用 `peekview create` CLI——CLI 没有任何安全限制，任何路径都能传进去。

问题的核心不是黑名单，而是：**斜杠命令的安全边界来自用户自己**。用户直接输入 `/peeklink ~/.ssh/id_rsa`，说明用户主动想发布这个文件（虽然这不明智）。斜杠命令是用户主动操作，不是 Agent 自主调用，安全责任在用户，不在工具。

加黑名单反而会造成"我为什么发布不了这个文件"的困惑。**`/peeklink` 不需要安全限制，`publish_files` 才需要**（因为 publish_files 是 Agent 自主调用，存在 prompt injection 风险）。

---

## 需要更新到 spec 的内容

### spec-mcp-publish-files.md 需要更新

1. **限制数值对齐后端**：2MB → 5MB，200文件 → 50文件，20MB → 50MB
2. **路径安全修正**：加 realpath + 符号链接处理，移除无效的 `includes('..')` 检查
3. **allowlist 逻辑更新**：用简洁三层模型替换复杂的渐进式模型
4. **跳过原因反馈**：skipped 数组改为包含原因（`{ path, reason }`）

### spec-mcp-peeklink-command.md 需要更新

1. **加 `git rev-parse` 检测项目根目录**（上轮建议，正确）
2. **不需要加安全限制**（上轮建议有误，移除）

---

## 总结

上轮评审方向基本正确，但有三个问题：

1. **误读 staging**：publish_files 没有 staging 概念，这个建议无效
2. **数字不准确**：文件大小应该对齐后端实际配置（10MB/100MB/50文件），不是凭感觉提升
3. **路径安全实现有 bug**：`realPath.includes('..')` 永远不触发，是无效的安全检查

修完以上三点 + 遗漏的问题，两份 spec 可以进入实现阶段。

---

*二次评审完成：2026-05-24*
