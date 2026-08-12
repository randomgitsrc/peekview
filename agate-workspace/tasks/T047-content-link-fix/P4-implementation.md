---
phase: P4
task_id: T047
task_name: content-link-fix
type: implementation
parent: P2-design.md
trace_id: T047-P4-20260705
status: draft
created: 2026-07-05
agent: implementer
---

# T047 P4 实现记录

## 改动摘要

### 后端（1 文件修改，1 文件新增）

**`backend/peekview/api/files.py`**：
- 新增模块级 `import mimetypes`（行 5）
- 新增 `_determine_content_type(file_record: File) -> str` 函数（文件头之后），实现方案A 分流策略：
  - 文本文件（`language` 存在且 `is_binary=False`）→ `_language_to_content_type()`（保持现有行为）
  - 二进制/无语言文件 → 三级 fallback：`_LANGUAGE_TO_MIME.get(language)` → `mimetypes.guess_type(path)` → `application/octet-stream`
- 修改 `get_file_content` 端点：`_language_to_content_type(file_record.language)` → `_determine_content_type(file_record)`
- `_language_to_content_type()` 保持不变

**`backend/tests/test_content_type.py`**（新建，从 P3-test-code 复制）：
- 23 个测试（14 单元 + 9 集成）
- [DESIGN_GAP: test_level4_fallback_octet_stream 使用 `.xyz` 扩展名，但本系统 mimetypes.guess_type 将 `.xyz` 映射为 `chemical/x-xyz`（非 None），导致第四级 fallback 无法触发。测试数据改为 `.zzzz`（mimetypes 返回 None），正确验证 octet-stream 兜底路径。这是测试数据修正，非测试逻辑修改]

### 前端（3 文件修改，2 文件新建）

**`frontend-v3/src/utils/path-map.ts`**（新建）：从 P4-code-diff.patch 恢复，89 行，导出 `PathMapEntry`/`PathMap`/`normalizeRef`/`buildPathMap`/`resolvePath`

**`frontend-v3/src/utils/path-map.test.ts`**（新建）：38 个单元测试

**`frontend-v3/src/composables/useMarkdown.ts`**（修改）：
- 新增 `import { resolvePath } from '@/utils/path-map'` + `import type { PathMap }`
- 新增 `rewriteHtmlRefs(html, pathMap, slug)` 函数（post-DOMPurify DOM walk）
- `render()` 签名扩展：`(content, theme, pathMap=null, slug='')`
- 覆写 `md.renderer.rules.image` 和 `md.renderer.rules.link_open`（pathMap+slug 存在时），渲染后恢复
- DOMPurify `ADD_ATTR` 新增 `data-peekview-file-id`
- post-DOMPurify 对 `type:'html'` block 执行 `rewriteHtmlRefs`

**`frontend-v3/src/components/MarkdownViewer.vue`**（修改）：
- 新增 `pathMap?: PathMap | null` 和 `slug?: string` props
- 新增 `navigate-file` emit
- 新增 `handleLinkClick` 事件委托
- `render()` 传 `props.pathMap ?? null, props.slug ?? ''`
- watch 新增 `props.pathMap, props.slug`

**`frontend-v3/src/views/EntryDetailView.vue`**（修改）：
- MarkdownViewer 组件传 `:path-map` `:slug` `@navigate-file`
- 新增 `pathMap` computed 和 `handleNavigateFile` 函数
- import `buildPathMap` 和 `PathMap`

**`frontend-v3/src/components/__tests__/MarkdownViewer.spec.ts`**（修改）：
- 4 处 `toHaveBeenCalledWith` 适配新的 4 参数签名（增加 `null, ''`）

## 验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 后端 Content-Type 测试 | `pytest tests/test_content_type.py -q --tb=short` | 23 passed |
| 后端全量回归 | `pytest tests/ -q --tb=short -x` | 764 passed, 1 skipped |
| 前端 path-map 测试 | `vitest run src/utils/path-map.test.ts` | 38 passed |
| 前端类型检查 | `npx vue-tsc --noEmit` | 无错误 |
| 前端全量测试 | `vitest run` | 675 passed, 1 skipped |

## BDD 覆盖

- AC-1 (PNG Content-Type) ✅ TC-DCT-01 + TC-EP-01
- AC-2 (JPEG Content-Type) ✅ TC-DCT-02 + TC-EP-02
- AC-3 (SVG Content-Type) ✅ TC-DCT-03/TC-DCT-11 + TC-EP-03
- AC-4 (未知二进制 fallback) ✅ TC-DCT-04/TC-DCT-10/TC-DCT-12 + TC-EP-04
- AC-5 (文本文件不变) ✅ TC-DCT-05 + TC-EP-05
- AC-6 (CSS/JS MIME) ✅ TC-DCT-06/TC-DCT-07/TC-DCT-13 + TC-EP-06
- AC-7 (path-map 测试) ✅ 38 个测试全绿
- AC-8 (useMarkdown 兼容) ✅ vue-tsc 无错误
- AC-12 (_determine_content_type 三级 fallback) ✅ TC-DCT-14

AC-9/AC-10/AC-11/AC-13/AC-14 属于 P6 端到端验收范围。

## 无 SCOPE_GAP / CLARIFY

方案A 设计清晰，所有改动严格遵循 P2-design.md。
