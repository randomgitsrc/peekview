---
phase: P4
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P4-implementation.md
trace_id: TPV0091-P4-review-frontend-20260813
status: approved
created: 2026-08-13
agent: design-review
---

# P4 实现评审 — frontend 域（design-review）

## 评审范围与锚点

- 实现：`frontend-v3/src/api/client.ts` `getFileAsBase64`（:160-171）URL 变更
- 规格：P2-design.md §2.2（:129-145）；BDD 映射 P1-requirements.md §3
- git diff 核验：client.ts 仅单行变更（`/entries/{slug}/files/{fileId}` → `/entries/{slug}/files/{fileId}/content`，行 162），与 P2-design §2.2 一字不差
- 独立实测（只读，debug :8888，未触碰 :8080）：`GET /api/v1/entries/unicode-filenames/files/41/content` → **200 image/png**，前 8 字节 `89504e47 0d0a1a0a`（合法 PNG 签名），与 P2 minimal_validation 一致

## 逐项评审结论

### 1. 正确性 — PASS

- URL 变更与 P2-design.md §2.2（:136）完全一致：`/entries/${slug}/files/${fileId}/content`。
- 后端路由锚点：`backend/peekview/api/files.py:220` `@router.get("/{slug}/files/{file_id}/content")` 存在，路径精确匹配前端拼接。
- `responseType: 'arraybuffer'` 与 `/content` 兼容：独立 curl 实测返回原始字节（PNG 签名正确），axios arraybuffer 只依赖响应字节流，与端点无关。`getFileContent`（:152-158）已用同路径 `responseType: 'text'` 证明该端点工作正常。

### 2. 交互状态 — PASS（data URI 零影响论断成立）

- ImageViewer.vue:109 `guessMimeType(props.filename)` 构造 mime；:120 `data:${mimeType};base64,${base64}`。
- `mime.ts:9-12` 仅按文件扩展名查表，**从不读取响应 content-type**；data URI = filename 扩展名 + 响应字节的 base64，二者均与端点来源无关。
- P2-design minimal_validation 已实测：download 与 /content 共用 `service.read_file_content`（files.py:195/240），字节必然逐一致 → base64 输出与改端点半点差别没有。论断成立。

### 3. 回归 — PASS

- 同路径不同 responseType 无冲突：`getFileContent`（'text'）与 `getFileAsBase64`（'arraybuffer'）各自请求独立配置（client.ts:153-156 / :161-164），无共享可变状态，axios 按请求单独解析。
- ImageViewer.spec.ts mock 零影响确认：:10-14 `vi.mock('@/api/client')` **全对象替换**为 `{ api: { getFileAsBase64: mock } }`——单测根本不发起 axios 请求、不断言 URL，11 条用例全部经 mock，URL 变更对单测完全不可见。P2-design §8（:245-247）「前端零测试改动」成立。
- `downloadFile`（:173-175）死代码保留：前端 grep 确认无调用者（P1-requirements.md §2 已核实），后端修复后其 URL 返回 200，符合 P2-design §0 边界（:32）。
- e2e BDD-8（tpv0091 spec:97-111）断言 markdown 内联图 src 匹配 `/files/\d+/content`，与预览走 /content 的路径族一致，无交叉。

### 4. 组件完整性 — PASS

- ImageViewer 契约保持：props（filename/slug/fileId，ImageViewer.vue:70-74）未增删；`getFileAsBase64(slug, fileId)` 签名未变；loadImage（:108-127）调用链 `props.slug/props.fileId → api.getFileAsBase64 → data Uri` 原样。
- `getFileAsBase64` 唯一调用点即 ImageViewer.vue:119（grep 确认），无遗漏的第三方消费者。

### 5. 移动端 / a11y — PASS

- 改动纯传输层（client.ts 一行 URL），ImageViewer.vue 模板/DOM/CSS/键盘/SR 零触碰（diff 核验仅 client.ts）。
- 移动端已由 e2e 覆盖：tpv0091 spec:117-124 `test_bdd_1_mobile_chinese_image_preview_renders`（390×844），配合 `openFileTreeAndClick` 处理文件树收起态。

## BLOCKER / CRITICAL 清单

无 BLOCKER、无 CRITICAL。

## 非阻断备注（供主 Agent，不计入评审结论）

- **P2 gate_commands 命名漂移**：P2-design.md §3 `P5_e2e` 仍写 `e2e/t091-unicode-preview-download.spec.ts`（旧前缀），实际文件为 `tpv0091-unicode-preview-download.spec.ts`。P3-test-cases.md（:28）与 P4-implementation.md「下游提示」（:53-54）均已标注，属文档漂移非实现缺陷；P5 执行时主 Agent 需同步更新 gate 命令。
- e2e BDD-5 用 `page.goto` + `waitForEvent('download')` 触发下载事件——依赖后端 RFC 5987 header（backend 域已审），P6 验收时在 CDP 环境实测即可。

## 结论

**status: approved** — frontend 实现（client.ts 单行 URL 变更）与 P2-design §2.2 完全一致，5 项评审点全部 PASS，无 BLOCKER/CRITICAL。ImageViewer 预览链路（props → data URI）、单测 mock 化零影响、e2e 断言均已独立核验。
