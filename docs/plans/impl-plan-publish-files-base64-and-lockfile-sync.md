# 实现计划：publish_files 二进制 base64 + package-lock.json 同步

> 来源：improvement-backlog.md #6 #7
> 日期：2026-06-10
> 冲突风险：🟡 中（改 backend config.py 可能与 captcha agent 冲突，需 rebase）

---

## #6 publish_files 二进制文件 base64 支持

### 问题

MCP 的 `publish_files` 工具遇到图片、PDF 等二进制文件时直接跳过（`skipped: { reason: 'binary' }`）。
后端已支持 `content_base64` 字段接收二进制文件，但 MCP Server 完全没有利用这个能力。
结果：用户发布含截图的项目时图片全丢。

### 现状分析

| 组件 | 二进制处理 |
|------|-----------|
| MCP `publishFiles.ts` | `looksBinary()` 检测 NUL 字节 → 跳过 |
| MCP `types.ts` | `EntryFile` 只有 `content: string`，无 `content_base64` |
| MCP `client.ts` | JSON.stringify 发送，无 base64 编码 |
| 后端 `models.py` | `FileCreate` 已有 `content_base64: str | None` |
| 后端 `file_service.py` | `decode_base64_content()` 解码 + `is_binary=True` |

### 改动清单

#### 1. `packages/mcp-server/src/types.ts`

```typescript
export interface EntryFile {
  filename: string;
  content?: string;           // 改为 optional（二进制时不用）
  content_base64?: string;    // 新增：base64 编码的二进制内容
  path?: string;
}
```

#### 2. `packages/mcp-server/src/tools/publishFiles.ts`

核心改动：二进制文件不再跳过，改为 base64 编码后上传。

```
原来（~行 426-432）：
  if (looksBinary(buf)) {
    skipped.push({ path: cf.absPath, reason: 'binary' });
    continue;
  }

改为：
  if (looksBinary(buf)) {
    if (buf.length > MAX_SINGLE_FILE_BYTES) {
      skipped.push({ path: cf.absPath, reason: 'too_large' });
      continue;
    }
    totalBytes += buf.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return { content: [{ type: 'text', text: `ERROR: 总大小超过 ${MAX_TOTAL_BYTES / 1024 / 1024}MB 限制。` }] };
    }
    files.push({
      filename: cf.filename,
      content_base64: buf.toString('base64'),
      path: cf.relPath,
    });
    continue;
  }
```

不再需要额外常量，直接用 `MAX_SINGLE_FILE_BYTES`（20MB，见下方后端改动）检查原始字节数。
base64 编码后约 26.7MB 的字符串，JSON 传输没问题（FastAPI 默认 body limit 远大于此）。

结果消息大小显示修复（ISSUE-5）：
```
// 原来：
text += `  ${f.path} (${formatSize(Buffer.byteLength(f.content, 'utf-8'))})\n`;
// 改为：
const size = f.content
  ? Buffer.byteLength(f.content, 'utf-8')
  : f.content_base64
    ? Math.floor(f.content_base64.length * 3 / 4)
    : 0;
text += `  ${f.path} (${formatSize(size)})\n`;
```

#### 3. 单元测试 `packages/mcp-server/tests/`

更新现有测试 + 新增用例（ISSUE-3）：

**更新**：`二进制文件被跳过` → `二进制文件用 base64 上传`，验证 `content_base64` 字段存在
**新增**：
- 超大二进制文件（> 20MB）→ 跳过（too_large）
- 混合文本+二进制 → 文本走 `content`，二进制走 `content_base64`
- mock API 验证请求体中 `content_base64` 字段可被 `Buffer.from(b64, 'base64')` 还原

**后端测试**：`test_storage.py` / `test_entries.py` 中如有硬编码 10MB 上限的测试用例需同步更新。

#### 4. `backend/peekview/config.py`

`MAX_FILE_SIZE` 默认值从 10MB → 20MB：

```python
max_file_size: int = Field(
    default=20_971_520,  # 20MB
    description="Maximum size for a single file (bytes)",
)
```

#### 5. `packages/mcp-server/src/tools/publishFiles.ts` 中的常量同步

`MAX_SINGLE_FILE_BYTES` 从 7MB → 20MB，与后端 `MAX_FILE_SIZE` 对齐。

### 不改动的文件

- `client.ts`：无需改动，`JSON.stringify` 会自动包含 `content_base64` 字段
- `looksBinary()` 函数：保持不变，检测逻辑足够

---

## #7 package-lock.json 版本元数据同步

### 问题

`bump-mcp-version` 只改 `package.json`，导致 `package-lock.json` 的顶层 `version` 字段长期落后。
当前：`package.json` = 0.8.1，`package-lock.json` = 0.7.3。

### 现状

Makefile `bump-mcp-version` 已有 `npm install --package-lock-only`（行 254），
但它是最近才加的，之前的版本 bump 没有执行过，所以当前 lock 文件仍是旧的。

### 改动清单

#### 1. 立即修复：手动执行一次同步

```bash
cd packages/mcp-server && npm install --package-lock-only
```

这会将 `package-lock.json` 中的 version 从 0.7.3 更新到 0.8.1。

#### 2. Makefile 验证步骤增强

当前验证只检查 `package.json`，增加 `package-lock.json` 一致性检查：

```makefile
# 现有（行 258-263）：
@grep -q "\"version\": \"$(NEW_MCP_VERSION)\"" packages/mcp-server/package.json && \
 echo "✅ package.json version: $(NEW_MCP_VERSION)" || \
 echo "❌ package.json version mismatch"

# 新增：
@grep -q "\"version\": \"$(NEW_MCP_VERSION)\"" packages/mcp-server/package-lock.json && \
 echo "✅ package-lock.json version: $(NEW_MCP_VERSION)" || \
 echo "❌ package-lock.json version mismatch — run: cd packages/mcp-server && npm install --package-lock-only"
```

#### 3. 不需要额外测试

`npm install --package-lock-only` 本身就是验证——如果失败会报错。

---

## 实施顺序

1. **#7 先做**（1 分钟）：执行 `npm install --package-lock-only` + Makefile 验证增强
2. **#6 后做**（30 分钟）：types.ts → publishFiles.ts → 测试
3. 全部完成后：`make test-mcp-unit` + `make build-mcp` 验证
4. 提交到 main

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| base64 体积膨胀（~33%） | 20MB 文件 → ~26.7MB JSON 字符串 | 后端 `MAX_ENTRY_SIZE=100MB` 保护总量 |
| 后端 MAX_FILE_SIZE 提升 | 允许更大文件占磁盘 | 可通过 `PEEKVIEW_LIMITS__MAX_FILE_SIZE` 环境变量调低 |
| 二进制检测漏判 | 非 NUL 字节的二进制被当文本 | `looksBinary` 对常见格式够用，后续可增强 |
| 前端单文件下载 bug（ISSUE-1） | 更多二进制文件 → 更多用户触发 bug | "Pack" 下载可用，follow-up 修 |
| 后端 Content-Type 错误（ISSUE-2） | `/content` 端点对二进制返回 text/plain | 前端不走此端点，follow-up 修 |

---

## 专家评审（2026-06-10）

### BUG-1：750KB 限制过于保守 → 改为 20MB（✅ 已修复）

**原始问题**：方案限制原始文件 ≤ 750KB 走 base64。

**评审结论**：后端 `content_base64` 不受 `MAX_CONTENT_LENGTH (1MB)` 限制，走的是 base64 解码路径。实际限制是 `_validate_limits()` 中的 `MAX_FILE_SIZE`。

**修复**：MCP 端 `MAX_SINGLE_FILE_BYTES` 从 7MB → 20MB，后端 `MAX_FILE_SIZE` 默认值从 10MB → 20MB，一揽子对齐。

---

### BUG-2：二进制文件跳过后 totalBytes 未计算，但文件数检查可能导致"0 files"

**现状**：方案中二进制文件大小不计入 `totalBytes`。

**问题**：如果所有文件都是二进制且都 > 7MB，全部跳过 → `files.length === 0` → 返回 "所有文件都被跳过"，这是正确行为。

但如果所有文件都是二进制且都 ≤ 7MB，全部走 `content_base64` 上传 → `files` 不为空 → OK。

**结论**：不是 bug，但需要注意二进制文件的字节数应计入 `totalBytes`（不然 50MB 总限制被绕过）。

**修复**：方案中 `totalBytes += buf.length` 已包含这一行，OK。

---

### ISSUE-1：前端单文件下载按钮对二进制文件有已知 bug

**现状**：前端 `EntryDetailView.vue` 的 Download 按钮对二进制文件创建空 Blob（`entryStore.fileContent` 为空），下载出来是空文件。

**影响**：这个 bug 在当前就存在（CLI `local_path` 上传的二进制文件也有此问题），不是本次引入的。但本次改动会让更多二进制文件出现在 PeekView 中，bug 影响面扩大。

**决策**：本次不修（属于前端 backlog），但应在结果消息中提示用户可用 "Pack" 下载。记录为 follow-up。

---

### ISSUE-2：后端 `/content` 端点对二进制文件返回错误 Content-Type

**现状**：`GET /api/v1/entries/{slug}/files/{file_id}/content` 对 `language=null` 的二进制文件返回 `text/plain; charset=utf-8`。但 `ImageViewer` 用的是另一个端点（`/files/{file_id}`，返回 `application/octet-stream`），所以图片能正常显示。

**影响**：如果有客户端直接用 `/content` 端点访问二进制文件，会得到错误的 Content-Type。但前端当前不会对二进制文件调用此端点，所以无实际影响。

**决策**：本次不修，记录为 follow-up。

---

### ISSUE-3：现有测试 `二进制文件被跳过` 需要更新

**现状**：`publishFiles.test.ts:184-194` 有测试 `it('二进制文件被跳过')`，验证二进制文件出现在 skipped 列表中。

**影响**：改为 base64 上传后，这个测试会失败——二进制文件不再跳过，而是正常上传。

**修复**：更新测试，验证二进制文件生成 `content_base64` 而非跳过。增加新测试用例：
1. 小二进制文件 → `content_base64` 上传成功
2. 大二进制文件（> 20MB）→ 跳过（too_large）
3. 混合文本+二进制 → 文本 `content`，二进制 `content_base64`
4. mock API 验证请求体中 `content_base64` 字段存在且可解码

---

### ISSUE-4：SkippedFile.reason 类型需更新

**现状**：`SkippedFile.reason` 类型为 `'binary' | 'too_large' | 'not_allowed' | 'not_found'`。

**影响**：改为 base64 后，'binary' 不再作为 skip reason 出现（除非将来有其他原因跳过二进制）。但超大二进制文件走 'too_large'，合理。

**决策**：保留 'binary' 类型（向后兼容），但实际不会再产生。`formatSkipped` 中的 `binary: '二进制文件'` 标签可以改为 `'二进制文件（超过大小限制）'` 或保持不变。

---

### ISSUE-5：结果消息中二进制文件的大小显示

**现状**：成功上传后显示 `f.path (formatSize(Buffer.byteLength(f.content, 'utf-8')))`。

**问题**：二进制文件用 `content_base64`，没有 `content` 字段。`Buffer.byteLength(undefined, 'utf-8')` 会抛错。

**修复**：
```typescript
const size = f.content
  ? Buffer.byteLength(f.content, 'utf-8')
  : f.content_base64
    ? Math.floor(f.content_base64.length * 3 / 4)  // base64 → 原始字节近似
    : 0;
text += `  ${f.path} (${formatSize(size)})\n`;
```

---

### ISSUE-6：`createEntry` 类型需要 EntryFile 含 content_base64

**现状**：`client.ts` 的 `createEntry(request: CreateEntryRequest)` 直接 `JSON.stringify(request)`。

**影响**：只要 `EntryFile` 类型加上 `content_base64`，`CreateEntryRequest.files` 自然包含，`JSON.stringify` 会自动序列化。无需改动 `client.ts`。

**验证**：需要确认 mock 测试中 `capturedBody` 能正确捕获 `content_base64` 字段。

---

### E2E 考量

#### 全链路测试路径

```
MCP publish_files（本地图片）
  → base64 编码
  → HTTP POST /api/v1/entries（content_base64 字段）
  → 后端 decode_base64_content() 解码
  → 写入磁盘 storage（原始字节）
  → 数据库 File 记录（is_binary=true, language=null）
  → 前端 ImageViewer 通过 /files/{id} 获取
  → 渲染 <img>
```

#### 单元测试覆盖（MCP 侧）

| 用例 | 验证点 |
|------|--------|
| 小 PNG 文件 | `content_base64` 字段存在，请求成功 |
| 小二进制文件 | 不再出现在 skipped 列表 |
| 20MB+ 二进制文件 | 跳过（too_large） |
| 混合 .py + .png | .py 走 `content`，.png 走 `content_base64` |
| mock 验证请求体 | `capturedBody.files[1].content_base64` 可被 `Buffer.from(b64, 'base64')` 还原 |

#### 集成测试覆盖（需要 debug 后端）

- 用 debug 后端实际创建含图片的 entry
- 验证图片可被 `/files/{id}` 端点获取
- 验证前端 `ImageViewer` 可渲染

**决策**：集成测试可在下次 debug 调试周期做，本次先确保单元测试覆盖。

---

### 评审结论

| 编号 | 级别 | 问题 | 决策 |
|------|------|------|------|
| BUG-1 | 🔴 高 | 750KB 限制过于保守 | ✅ 已修复：改为 20MB，后端 + MCP 一揽子对齐 |
| BUG-2 | ⚪ 非 bug | totalBytes 计算确认 | OK，方案已包含 |
| ISSUE-1 | 🟡 中 | 前端单文件下载 bug | 本次不修，记录 follow-up |
| ISSUE-2 | 🟢 低 | 后端 Content-Type 问题 | 本次不修，记录 follow-up |
| ISSUE-3 | 🟠 高 | 现有测试需更新 | 必须修复，否则 CI 红灯 |
| ISSUE-4 | 🟢 低 | SkippedFile.reason 类型 | 保留不改 |
| ISSUE-5 | 🟠 高 | 结果消息大小显示会崩 | 必须修复 |
| ISSUE-6 | ⚪ 确认 OK | client.ts 不需改动 | 无需改动 |

**必须修复项**：BUG-1、ISSUE-3、ISSUE-5
**follow-up 记录**：ISSUE-1（前端下载 bug）、ISSUE-2（Content-Type）

---

## 第二轮专家评审（2026-06-10）

### R2-ISSUE-1：文本文件限制不应从 7MB 提到 20MB

**问题**：方案将 `MAX_SINGLE_FILE_BYTES` 统一从 7MB → 20MB，但 7MB 对文本文件已很宽裕。
20MB 文本文件进入 MCP → JSON 传后端 → 后端存磁盘，整个链路无问题，但 20MB 文本对 LLM context 不友好。
且原有 7MB 限制是刻意的设计，不是 bug。

**修复**：拆分为两个常量：
```typescript
const MAX_TEXT_FILE_BYTES = 7 * 1024 * 1024;     // 7MB（文本文件，与之前一致）
const MAX_BINARY_FILE_BYTES = 20 * 1024 * 1024;  // 20MB（二进制文件，与后端 MAX_FILE_SIZE 对齐）
```
文本文件检测路径用 `MAX_TEXT_FILE_BYTES`，二进制文件检测路径用 `MAX_BINARY_FILE_BYTES`。

### R2-ISSUE-2：MCP 端 MAX_TOTAL_BYTES 50MB 可能过小

**问题**：单文件提到 20MB 后，50MB 总量只能放 2 个大文件。后端 `MAX_ENTRY_SIZE = 100MB`。

**修复**：`MAX_TOTAL_BYTES` 从 50MB → 100MB，与后端对齐。
注意：MCP local 模式下 base64 编码会使请求体膨胀 ~33%，100MB 原始 → ~133MB JSON body。
后端 FastAPI 默认无 body size 限制（nginx reverse proxy 可能有），需确认不被中间件截断。

### R2-ISSUE-3：后端 MAX_FILE_SIZE 默认值变更的向后兼容性

**问题**：10MB → 20MB 是默认值变更，已有部署升级后行为变化。

**结论**：低风险。`MAX_FILE_SIZE` 一直可通过环境变量配置，且用户需求就是发更大文件。
在 CHANGELOG 中标注此 breaking change。

### R2-ISSUE-4：`content?: string` 改为 optional 的向后兼容性

**验证**：`createEntry` 调用中，文本文件仍然传 `content`，二进制文件传 `content_base64`。
TypeScript strict 模式下 `content?: string` 允许 undefined，不影响现有代码。
后端 `FileCreate.content` 本身就是 `Optional[str]`。**OK，无需额外处理**。

---

### 第二轮评审结论

| 编号 | 级别 | 问题 | 决策 |
|------|------|------|------|
| R2-ISSUE-1 | 🟠 中 | 文件限制不应统一 20MB | 修复：文本 7MB / 二进制 20MB 拆分 |
| R2-ISSUE-2 | 🟠 中 | 总量限制 50MB 偏小 | 修复：100MB 与后端对齐 |
| R2-ISSUE-3 | 🟢 低 | 默认值变更向后兼容 | 标注 CHANGELOG |
| R2-ISSUE-4 | ⚪ OK | content optional 兼容性 | 无需处理 |

**新增必须修复项**：R2-ISSUE-1、R2-ISSUE-2

---

*维护：实施完成后更新 improvement-backlog.md 状态*
