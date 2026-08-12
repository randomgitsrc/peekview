---
phase: P0
task_id: TPV0091
task_name: unicode-download-header-fix
trace_id: TPV0091
created: 2026-08-12
status: pending
parent: TPV0089 验收补验发现（用户质疑截图盲区 → 实际验证暴露）
---

# P0-brief — T091 中文/日文文件名下载与图片预览 500 修复

## task

修复中文/日文等非 latin-1 文件名的**下载**与**图片预览**路径 500 错误：后端 `download_file` 的 `Content-Disposition` header 直接放原始中文文件名（HTTP header 必须 latin-1 可编码 → `UnicodeEncodeError` → 500），前端 `getFileAsBase64`/`downloadFile` 走该端点导致失败。

## 发现过程（用户驱动的验收补验）

TPV0089 P6 验收通过后，用户质疑截图只点击了 README.md/报告附件.txt，未点击各图片文件。补验（Playwright CDP 实跑）发现：

| 文件 | 点击文件树结果 |
|------|--------------|
| `中文图片.png` | ❌ "图片加载失败"（500） |
| `概要図.png`（日文） | ❌ "图片加载失败"（500） |
| `café.png` | ✅ 正常（é 在 latin-1 范围内 < 256） |
| `report final.png` | ✅ 正常 |
| markdown 内联渲染（full-page） | ✅ 5 张图全部正常（走 /content 端点） |

## 根因（已用 curl + 后端日志确认，非猜测）

**后端** `backend/peekview/api/files.py:204-208` `download_file`：
```python
return Response(
    content=content,
    media_type="application/octet-stream",
    headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},  # safe_name = 原始中文
)
```
HTTP header 值必须 latin-1 可编码（Starlette `init_headers` → `v.encode("latin-1")`）。`概要図.png`/`中文图片.png` 超出 latin-1 → `UnicodeEncodeError: 'latin-1' codec can't encode characters` → 500。`é`（U+00E9 < 256）在 latin-1 范围内所以 café.png 正常——解释为什么只有中/日文失败（后端日志已捕获完整 traceback）。

**前端** `frontend-v3/src/api/client.ts:160-171` `getFileAsBase64`：
```ts
this.client.get(`/entries/${slug}/files/${fileId}`, { responseType: 'arraybuffer' })
```
请求**不带 `/content`** 的 download 端点（Content-Disposition: attachment）——图片预览语义上不该走 download 端点，且触发上述 header bug。`downloadFile`（:173-175）同样用 `/files/${fileId}`。

## known_risks

- **这不是 TPV0089 引入的**（`download_file` 的 latin-1 header 问题在 TPV0089 之前就存在），但 TPV0089 修复 markdown 内联路径后，用户点击文件树暴露了这条独立的更深 bug
- **影响面**：所有含非 latin-1 文件名（中文/日文/韩文/emoji 等）的 entry：
  1. 图片预览（ImageViewer → getFileAsBase64）→ 500
  2. 附件下载（downloadFile → 同端点）→ 500
  3. TableView/TreeView 的 download-fn → 同端点 → 500
- **修复方案有分歧，需 P2 选型**：
  - 后端：Content-Disposition 用 RFC 5987 `filename*=UTF-8''...` 编码（标准做法，浏览器正确显示中文文件名）——治本
  - 前端：`getFileAsBase64` 改用 `/content` 端点（图片预览不该走 download 端点）——语义修正
  - 组合最优：后端修 header 编码（下载正确显示中文名）+ 前端 getFileAsBase64 改 /content（预览语义）
- **无现成测试覆盖**：`test_file_service.py` 无中文文件名 download 用例 → P3 不可跳
- **改动面**：后端 files.py（+可能测试）+ 前端 client.ts —— 跨端改动，P7 不可裁
- 不触碰生产 :8080 / ~/.peekview/

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；复现：Playwright CDP 点击文件树里的中文/日文图片，或 curl /api/v1/entries/unicode-filenames/files/41（不带 /content）"
lint: "make lint && make typecheck（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"

## 裁剪倾向

- P1：BDD 覆盖「中文/日文文件名下载 200 + Content-Disposition 正确」「中文/日文图片预览正常」「é/空格/英文不回归」「markdown 内联渲染不回归」
- P2：跨端改动（backend + frontend），两处修复需明确选型（RFC 5987 + /content 端点），不可单候选跳过
- P3：**不可跳**——零现成覆盖，需新增中文文件名 download 测试
- P5：后端 pytest 全量 + 前端 typecheck
- P6：**不可裁**——需 Playwright 实跑点击中文/日文图片 + 下载，截图确认
- P7：**不可裁**——跨端改动（后端 files.py + 前端 client.ts）
- 风险：medium（影响所有含非 latin-1 文件名的 entry 的下载/预览，用户已实际观察到）

## 排期

TPV0091：独立，可随时启动。与 TPV0090（xdist）无依赖。
