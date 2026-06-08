# 双模式最终方案自评审

> 评审框架：gstack review（Staff Engineer + /cso）
> 日期：2026-06-09
> 评审对象：docs/plans/mcp-dual-mode-final-v0.7.md
> 评审方式：实现前自评审，核查技术可行性

---

## 评审结论

方案整体可行，决策（local 只暴露 publish_files）论证充分。发现 3 个需要修正的技术问题和 2 个补充点。

---

## 需要修正的问题

### 问题 1：realpath 对不存在的文件抛 ENOENT，校验流程顺序错误

**方案原流程：**
```
1. paths 必须绝对路径
2. fs.realpath() 解析
3. 黑名单检查
4. allowedPaths/cwd 检查
```

**问题：** `fs.realpath('/nonexistent')` 直接抛 `ENOENT`，在 Step 2 就崩了，到不了后面的检查。而且对不存在的路径，应该归入 skipped（reason: not_found），不应该抛异常中断整个发布。

**修正流程：**
```
1. paths 必须绝对路径（否则 skip, reason: not_allowed）
2. fs.stat() 检查存在性（不存在则 skip, reason: not_found）
3. fs.realpath() 解析符号链接（此时文件确定存在）
4. 黑名单检查（命中则 skip, reason: not_allowed）
5. allowedPaths/cwd 边界检查（越界则 skip, reason: not_allowed）
6. 通过后读取文件
```

关键：单个文件校验失败应该 skip 并继续处理其他文件，而不是抛异常中断整批。只有"路径越界"这种安全问题可以考虑直接拒绝整个请求（防止信息泄露探测）。

**决策：** 安全类失败（黑名单、越界）→ 直接拒绝整个请求（避免被用于探测文件系统）；非安全类（不存在、二进制、过大）→ skip 单个文件继续。

---

### 问题 2：include/exclude patterns 的 glob 实现有 Node 版本兼容问题

**问题：** 方案提到用 glob 匹配 include/exclude_patterns。但：
- `fs.glob` / `fs.globSync` 是 Node 22+ 才有的 API
- `engines` 要求 `>=18.0.0`
- Node 18/20 上 `fs.glob` 不存在，会运行时报错

**修正方案（二选一）：**

**方案 A（推荐，零依赖）**：自己实现简单的 glob 匹配，只支持 `*` 和 `*.ext` 这类常见模式：
```typescript
function matchPattern(filename: string, pattern: string): boolean {
  // 将 glob 转为正则：* → [^/]*，. → \.
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
  );
  return regex.test(filename);
}
```

**方案 B**：引入 `minimatch` 依赖（成熟、广泛使用），但增加一个依赖。

**决策：** include/exclude 只需要匹配文件名（如 `*.py`），不需要完整 glob 路径匹配，用方案 A 自实现足够，避免增加依赖。在 spec 里明确"只支持文件名通配，不支持路径 glob"。

---

### 问题 3：createTools 签名变更影响面未完整说明

**方案 Step 4** 把 `createTools(client, publicUrl)` 改为 `createTools(client, config)`。

**遗漏：** 现有 `createTools` 的调用方在 `server.ts`，签名变更后调用处必须同步改。方案里没有列出这个改动点。

**补充：** Step 4 需要明确：
- `src/tools/index.ts`：`createTools` 签名改为 `(client, config)`
- `src/server.ts`：调用 `createTools(client, config)` 的地方同步更新
- `createEntryTool` 仍需要 `publicUrl`，从 `config.publicUrl` 取

---

## 补充点

### 补充 1：publish_files 不需要传 language，依赖后端自动检测

核查后端 `entry_service.py`，发现有 `detect_language` 函数，`files_data` 不传 `language` 时后端会自动检测。

这正好支撑了"只暴露 publish_files"决策的核心优势——**publish_files 完全不碰 language/filename 的判断，全部交给后端从文件名和内容推断**，从根本上消除了 create_entry 时代"后缀填错导致渲染错误"的问题。

应在方案里明确：publish_files 传给后端的 files_data 只含 `path`（相对路径）和 `content`，不传 language，由后端 detect_language 处理。

### 补充 2：二进制文件的处理需要明确

方案说"二进制文件跳过"，但 PeekView 本身支持图片等二进制文件（通过 content_base64）。

**需要决策：** publish_files 遇到二进制文件（如图片）是跳过，还是用 base64 编码上传？

- 跳过：简单，但用户发布项目时图片会丢失
- base64 上传：完整，但增加复杂度和体积

**建议：** 初版先跳过并在 skipped 里说明（reason: binary），明确告知用户。base64 支持作为后续增强。在方案里记录这个边界。

---

## 评审结论

| 维度 | 评分 | 说明 |
|------|------|------|
| 决策合理性 | 9/10 | local 只暴露 publish_files 论证充分 |
| 技术可行性 | 7/10 | realpath 流程、glob 兼容需修正 |
| 安全模型 | 8/10 | 三层防护合理，需补充安全失败的拒绝策略 |
| 完整性 | 8/10 | createTools 签名影响面需补全 |

**需要修正后进入实现：**
1. 路径校验流程改为 stat → realpath，安全失败拒绝整个请求，非安全失败 skip 单文件
2. include/exclude 用自实现的文件名通配（不依赖 fs.glob，不引入 minimatch）
3. createTools 签名变更的调用方同步说明
4. 明确 publish_files 不传 language（后端自动检测）
5. 明确二进制文件初版跳过（reason: binary）

---

*自评审完成：2026-06-09*
