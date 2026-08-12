---
phase: P7
task_id: T047
task_name: content-link-fix
type: consistency
parent: P4-implementation.md
trace_id: T047-P7-20260705
status: draft
created: 2026-07-05
agent: architect
---

# T047 P7 一致性检查

## 方向 1：设计→实现（逐项对照 P2）

### §1 方案选型

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| 选择方案 A（分流策略：文本走 `_language_to_content_type`，二进制走三级 fallback） | `files.py:117-136` 实现了 `_determine_content_type`，分流条件 `file_record.language and not file_record.is_binary` 与 P2 §3.1 伪代码一致 | ✅ 一致 |
| 分流条件：`language 存在且 is_binary=False` → 文本路径 | `files.py:123` `if file_record.language and not file_record.is_binary` | ✅ 一致 |
| 二进制/无语言：`_LANGUAGE_TO_MIME → mimetypes.guess_type → octet-stream` | `files.py:126-136` 三级 fallback 顺序与 P2 §3.1 数据流完全一致 | ✅ 一致 |

### §3.1 后端 `_determine_content_type` 函数

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| 函数签名 `_determine_content_type(file_record: File) -> str` | `files.py:117` 签名一致 | ✅ 一致 |
| 文本路径：调用 `_language_to_content_type(language)` | `files.py:124` `return _language_to_content_type(file_record.language)` | ✅ 一致 |
| Level 1 fallback：`_LANGUAGE_TO_MIME.get(file_record.language)` | `files.py:127-129` | ✅ 一致 |
| Level 2 fallback：`mimetypes.guess_type(actual_path)` 其中 `actual_path = file_record.path or file_record.filename` | `files.py:131-134` | ✅ 一致 |
| Level 3 fallback：`"application/octet-stream"` | `files.py:136` | ✅ 一致 |
| `_language_to_content_type()` 保留不变 | `files.py:92-114` 未修改 | ✅ 一致 |
| SVG 边界：`language="xml" + is_binary=False` → 走文本路径 | 分流条件 `language and not is_binary` → True → `_language_to_content_type("xml")` → `text/xml` | ✅ 一致 |
| SVG 边界：`language=None + is_binary=False` → 走 mimetypes | 分流条件 `language and not is_binary` → False → `_LANGUAGE_TO_MIME.get(None)` → None → `mimetypes.guess_type("diagram.svg")` → `image/svg+xml` | ✅ 一致 |

### §3.2 后端 `get_file_content` 修改

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| 仅替换一行调用：`_language_to_content_type` → `_determine_content_type` | `files.py:282` `content_type = _determine_content_type(file_record)` | ✅ 一致 |
| Response 构造不变 | `files.py:283-286` `return Response(content=content, media_type=content_type)` | ✅ 一致 |

### §3.3 后端 `mimetypes` import

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| `_determine_content_type` 改为模块级 import | `files.py:7` `import mimetypes` | ✅ 一致 |
| `_build_sibling_data` 的局部 import 可保留 | `files.py:297` `import mimetypes`（局部 import 保留） | ✅ 一致 |

### §3.4 前端 path-map.ts

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| `PathMapEntry = { fileId: number; priority: number }` | `path-map.ts:1` 一致 | ✅ 一致 |
| `PathMap = Map<string, PathMapEntry>` | `path-map.ts:2` 一致 | ✅ 一致 |
| `normalizeRef`：跳过外部 URL/data/blob/mailto/tel/协议相对/锚点；strip `./`；绝对路径提取 basename | `path-map.ts:10-23` 正则覆盖 `https?://` / `data:` / `blob:` / `mailto:` / `tel:` / `ftp:` / `//` / `#`；strip `./` 循环；绝对路径提取 basename | ✅ 一致 |
| `normalizeRef`：跳过已重写的 API URL `/api/v1/entries/` | `path-map.ts:15` `if (ref.startsWith('/api/v1/entries/')) return null` | [EXTENSION] P2 §3.4 未提及此条，但这是 T046 patch 中的已有逻辑（防止二次重写），实现正确且必要 |
| `buildPathMap`：精确 path (priority=1) → filename (priority=2) → basename fallback (priority=3)；同名冲突删除 key | `path-map.ts:25-74` priority 体系一致；`basenameConflicts` Set + `map.delete` 处理冲突 | ✅ 一致 |
| `resolvePath`：normalizeRef → 精确匹配 → basename fallback | `path-map.ts:77-88` | ✅ 一致 |
| 38 个单元测试 | `path-map.test.ts` 共 38 个 it()（TC-BPM 10 个 + TC-NR 18 个 + TC-RP 10 个） | ✅ 一致 |

### §3.5 前端 useMarkdown.ts

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| `render()` 签名扩展：`(content, theme, pathMap=null, slug='')` | `useMarkdown.ts:126-131` 签名一致 | ✅ 一致 |
| 覆写 `md.renderer.rules.image`：重写 src | `useMarkdown.ts:283-298` 当 `pathMap && slug` 时覆写，`resolvePath` + `token.attrSet` | ✅ 一致 |
| 覆写 `md.renderer.rules.link_open`：重写 href + data-peekview-file-id | `useMarkdown.ts:301-317` | ✅ 一致 |
| 渲染后恢复 rules | `useMarkdown.ts:322-330` 恢复 link_open 和 image | ✅ 一致 |
| DOMPurify `ADD_ATTR` 新增 `data-peekview-file-id` | `useMarkdown.ts:388` ADD_ATTR 列表含 `data-peekview-file-id` | ✅ 一致 |
| post-DOMPurify DOM walk：对 `type:'html'` block 执行 `rewriteHtmlRefs` | `useMarkdown.ts:395-401` | ✅ 一致 |
| `rewriteHtmlRefs` 函数：DOMParser → querySelectorAll img/a → 重写 | `useMarkdown.ts:101-124` 实现与 P2 §3.5 伪代码一致 | ✅ 一致 |
| `rewriteHtmlRefs` img src 重写为 `/api/v1/entries/${slug}/files/${fileId}/content` | `useMarkdown.ts:109` | ✅ 一致 |
| `rewriteHtmlRefs` a href 重写为 `/${slug}?file=${fileId}` + `data-peekview-file-id` | `useMarkdown.ts:118-119` | ✅ 一致 |

### §3.6 前端 MarkdownViewer.vue

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| 新增 `pathMap?: PathMap \| null` 和 `slug?: string` props | `MarkdownViewer.vue:22-26` | ✅ 一致 |
| 新增 `navigate-file` emit | `MarkdownViewer.vue:29` | ✅ 一致 |
| `handleLinkClick` 事件委托：查找 `a[data-peekview-file-id]` → `e.preventDefault()` → `emit('navigate-file', fileId)` | `MarkdownViewer.vue:66-73` | ✅ 一致 |
| `onMounted` 注册 click 事件 | `MarkdownViewer.vue:75-78` 同时注册 handleCodeBlockCopy 和 handleLinkClick | ✅ 一致 |
| `onBeforeUnmount` 移除 click 事件 | `MarkdownViewer.vue:80-83` | ✅ 一致 |
| `renderContent()` 传 `pathMap` 和 `slug` 给 `render()` | `MarkdownViewer.vue:90` `render(props.content, themeName, props.pathMap ?? null, props.slug ?? '')` | ✅ 一致 |
| watch 新增 `props.pathMap, props.slug` | `MarkdownViewer.vue:102` watch 数组含 `props.pathMap, props.slug` | ✅ 一致 |

### §3.7 前端 EntryDetailView.vue

| P2 设计项 | 实现情况 | 判定 |
|-----------|---------|------|
| MarkdownViewer 组件传 `:path-map` `:slug` `@navigate-file` | `EntryDetailView.vue:168-174` | ✅ 一致 |
| 新增 `pathMap` computed | `EntryDetailView.vue:472-475` | ✅ 一致 |
| `handleNavigateFile` 函数 | `EntryDetailView.vue:477-482` | ✅ 一致 |
| import `buildPathMap` 和 `PathMap` | `EntryDetailView.vue:322-323` | ✅ 一致 |

### §2 影响域 — 不改什么

| P2 声明"不改"的项 | 实际情况 | 判定 |
|-------------------|---------|------|
| `_language_to_content_type()` 保留不变 | `files.py:92-114` 未修改 | ✅ 一致 |
| `_LANGUAGE_TO_MIME` map 保持 8 条目不变 | `files.py:67-76` 8 个条目 | ✅ 一致 |
| `download_file` 端点不变 | `files.py:227-252` 未修改 | ✅ 一致 |
| `render_html_file` 端点不变 | 未在本次改动范围 | ✅ 一致 |
| `_build_sibling_data` 保持不变 | `files.py:289-318` 未修改（仍用局部 `import mimetypes`） | ✅ 一致 |
| `HtmlViewer/CodeViewer/ImageViewer` 不涉及 | 未改动 | ✅ 一致 |
| `FileTree.vue` 不变 | 未改动 | ✅ 一致 |
| `router.ts` 不新增路由 | 未改动 | ✅ 一致 |
| MCP server 不受影响 | 未改动 | ✅ 一致 |
| `models.py` 无 schema 变更 | 未改动 | ✅ 一致 |

### §4 BDD 覆盖矩阵

| BDD | P2 覆盖机制 | P4 实现覆盖 | P6 验收 | 判定 |
|-----|------------|------------|--------|------|
| AC-1 PNG Content-Type | `_determine_content_type` mimetypes | TC-DCT-01 + TC-EP-01 | PASS B01 | ✅ |
| AC-2 JPEG Content-Type | 同上 | TC-DCT-02 + TC-EP-02 | PASS B02 | ✅ |
| AC-3 SVG Content-Type | mimetypes.guess_type | TC-DCT-03/11 + TC-EP-03 | PASS B03 | ✅ |
| AC-4 未知二进制 fallback | octet-stream | TC-DCT-04/10/12 + TC-EP-04 | PASS B04 | ✅ |
| AC-5 文本文件不变 | `_language_to_content_type` | TC-DCT-05 + TC-EP-05 | PASS B05 | ✅ |
| AC-6 CSS/JS MIME | `_language_to_content_type` | TC-DCT-06/07/13 + TC-EP-06 | PASS B06 | ✅ |
| AC-7 path-map.ts 测试 | 38 个测试 | 38 passed | PASS B07 | ✅ |
| AC-8 useMarkdown.ts 兼容 | 手动合并 + vue-tsc | 无错误 | PASS B08 | ✅ |
| AC-9 图片端到端渲染 | 后端 + 前端 | P6 E2E | PASS B09 | ✅ |
| AC-10 链接端到端重写 | link_open + 事件委托 | P6 E2E | PASS B10 | ✅ |
| AC-11 同名文件 fallback | pathMap 删除冲突 key | P6 E2E | PASS B11 | ✅ |
| AC-12 `_determine_content_type` 测试 | 三级 fallback 覆盖 | 23 passed | PASS B12 | ✅ |
| AC-13 真实尺寸图片 + vision | P6 Playwright + vision | vision-helper 确认 | PASS B13 | ✅ |
| AC-14 网络请求 Content-Type | P6 Playwright 监控 | 确认 image/png | PASS B14 | ✅ |

### §5 实现完成标志

| # | 完成标志 | 实现情况 | 判定 |
|---|---------|---------|------|
| 1 | `_determine_content_type` 函数实现，分流逻辑正确 | `files.py:117-136` | ✅ |
| 2 | `get_file_content` 调用 `_determine_content_type` | `files.py:282` | ✅ |
| 3 | `curl` 对 PNG 返回 `image/png` | P6 AC-1 PASS | ✅ |
| 4 | `path-map.ts` 导出 + 38 测试全绿 | P4 + P6 AC-7 | ✅ |
| 5 | `useMarkdown.ts` 接受 pathMap/slug 参数 | `useMarkdown.ts:126-131` | ✅ |
| 6 | `MarkdownViewer.vue` 接受 props + emit 事件 | `MarkdownViewer.vue:22-30` | ✅ |
| 7 | `EntryDetailView.vue` 构建 pathMap + 处理事件 | `EntryDetailView.vue:472-482` | ✅ |
| 8 | 所有 14 条 BDD 通过 | P6: 14/14 PASS | ✅ |

### §6 权衡/选择理由

| P2 决策点 | 实现是否遵循 | 判定 |
|-----------|-------------|------|
| 分流 vs 统一 → 选分流(A) | 实现方案 A | ✅ |
| `_language_to_content_type` 保留 | 保留 | ✅ |
| mimetypes 模块级 import | `files.py:7` | ✅ |
| SVG 自然分流 | 未特判 | ✅ |
| 手动合并（非 patch apply） | 手动合并 | ✅ |
| 链接点击用事件委托 | 事件委托 | ✅ |
| 同名文件冲突删除 key | 删除 key | ✅ |

## 方向 2：实现→设计（检查设计中不再适用的要求 / 实现超出设计）

| 实现内容 | P2 设计覆盖 | 判定 |
|---------|------------|------|
| `normalizeRef` 跳过 `/api/v1/entries/` 前缀 | P2 §3.4 未提及 | [EXTENSION] 防止二次重写已有 API URL，T046 patch 中已有逻辑，合理扩展 |
| `buildPathMap` 接受 `_slug` 可选参数 | P2 §3.4 签名 `buildPathMap(files)` | [DEVIATION] 签名变为 `buildPathMap(files, _slug?)`，`_slug` 未使用（前缀 `_` + 可选）。P2 设计目标：精确 path/filename/basename 映射。此偏差不影响核心设计目标。 |
| `MarkdownViewer.vue` 保留 `headings` prop + `select-heading` emit（T045 遗留） | P2 §3.6 未提及 | [EXTENSION] T045 已有功能，T047 不改动但需共存，合理 |
| `MarkdownViewer.spec.ts` 4 处 `toHaveBeenCalledWith` 适配新 4 参数签名 | P2 §3.6 未提及测试适配 | [EXTENSION] 合理——P4 实现记录已标注 |
| 测试中 `test_level4_fallback_octet_stream` 使用 `.zzzz` 而非 `.xyz` | P2 未指定测试数据 | [EXTENSION] 合理——`.xyz` 在系统 mimetypes 中有映射，`.zzzz` 确保 None 返回 |

## [DESIGN_GAP] 审查

P4-implementation.md 中标记了 1 条 [DESIGN_GAP]：

> [DESIGN_GAP: test_level4_fallback_octet_stream 使用 `.xyz` 扩展名，但本系统 mimetypes.guess_type 将 `.xyz` 映射为 `chemical/x-xyz`（非 None），导致第四级 fallback 无法触发。测试数据改为 `.zzzz`（mimetypes 返回 None），正确验证 octet-stream 兜底路径。这是测试数据修正，非测试逻辑修改]

**审查结论**：[DESIGN_GAP_REVIEWED: 已确认]

理由：
1. 这是测试数据的选择问题，不是设计缺陷或实现偏差
2. P2 设计明确要求第四级 fallback 为 `application/octet-stream`，`.zzzz` 正确验证了此路径
3. 使用 `.xyz` 反而会测到 `mimetypes` 的意外映射，无法验证兜底逻辑
4. 测试逻辑未修改，仅调整了测试 fixture 数据

## P6 BDD 二值规则检查

P6 验收中 14 条 BDD 全部为 PASS，无中间态（如"调整/跳过/覆盖"）。✅ 合规

## 一致性总结

| 类别 | 数量 |
|------|------|
| ✅ 一致 | 42 |
| [EXTENSION] | 4 |
| [DEVIATION] | 1 |
| [BLOCKER] | 0 |
| [DEVIATION-CRITICAL] | 0 |
| [DESIGN_GAP_REVIEWED] | 1（已确认） |

**结论**：实现与 P2 设计高度一致。唯一的 [DEVIATION] 是 `buildPathMap` 签名新增未使用的 `_slug` 参数，不影响核心设计目标。[EXTENSION] 均为合理补充。无 BLOCKER 或 DEVIATION-CRITICAL。P6 验收 14/14 PASS，BDD 二值规则合规。
