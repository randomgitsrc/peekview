---
phase: P2
task_id: T047
task_name: content-link-fix
type: design
parent: P1-requirements.md
trace_id: T047-P2-20260705
status: draft
created: 2026-07-05
agent: architect
---

packages: [peekview]
domains: [backend, frontend]
ui_affected: true
ui_affected_reason: "Markdown图片渲染+链接点击文件切换是用户可见UI交互; P6需Playwright截图+vision-helper验证"
gate_commands:
  P5: "cd backend && python3 -m pytest tests/ -q --tb=short 2>&1 | tail -30; cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30; cd frontend-v3 && npx vue-tsc --noEmit 2>&1 | tail -20"
  P5_e2e: "bash docs/tasks/T047-content-link-fix/e2e-smoke.sh"
  P6: "bash docs/tasks/T047-content-link-fix/p6-verify.sh"
env_constraints:
  debug_env: "make debug-start (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 2>/dev/null || echo 'debug DB not found'"
files_to_read:
  - path: backend/peekview/api/files.py:66-113
    why: "_LANGUAGE_TO_MIME map + _language_to_content_type 函数, 新函数 _determine_content_type 的参考实现"
  - path: backend/peekview/api/files.py:232-263
    why: "get_file_content 端点, 需修改的目标函数"
  - path: backend/peekview/api/files.py:266-296
    why: "_build_sibling_data 三级 fallback 参考实现, 新函数复用相同逻辑"
  - path: backend/peekview/models.py:306-340
    why: "File model 定义 (path/filename/language/is_binary 字段)"
  - path: frontend-v3/src/composables/useMarkdown.ts
    why: "核心改动点: 新增 pathMap/slug 参数, 覆写 image/link_open rules, post-DOMPurify DOM walk"
  - path: frontend-v3/src/components/MarkdownViewer.vue
    why: "新增 pathMap/slug props, 传给 useMarkdown; 新增 link-click 事件拦截"
  - path: frontend-v3/src/views/EntryDetailView.vue:155-200
    why: "MarkdownViewer 组件调用处, 需传 pathMap/slug + 处理 navigate-file 事件"
  - path: frontend-v3/src/views/EntryDetailView.vue:303-340
    why: "script setup 区域, 需新增 buildPathMap + handleNavigateFile"
  - path: frontend-v3/src/utils/mime.ts
    why: "现有工具函数风格参考, path-map.ts 应遵循"
  - path: frontend-v3/src/stores/entry.ts:100-116
    why: "selectFile 方法签名, 链接点击需调用此方法"
  - path: frontend-v3/src/types/index.ts
    why: "File interface 定义, pathMap 构建依赖的字段 (id/path/filename)"
  - path: docs/tasks/T046-content-link-resolution/P4-code-diff.patch
    why: "T046 前端代码 patch, 恢复时参考 (不能直接 apply, 需手动合并)"
minimal_validation:
  assumption: "后端 /content 端点对 PNG 返回 text/plain (bug), 修复后应返回 image/png; mimetypes.guess_type 对常见图片扩展名返回正确 MIME"
  method: "curl -D - -o /dev/null 请求 /content 端点, 检查 Content-Type 响应头; python3 验证 mimetypes.guess_type 覆盖范围"
  result: "confirmed"
  note: |
    验证结果:
    1. 当前 bug 确认: PNG 文件 (file_id=2, t046-real-test) 返回 Content-Type: text/plain; charset=utf-8
    2. mimetypes.guess_type 覆盖验证: .png→image/png, .jpg→image/jpeg, .svg→image/svg+xml, .webp→image/webp, .gif→image/gif, .bin→application/octet-stream — 全部正确
    3. 关键发现: mimetypes.guess_type 对 .rs→application/rls-services+xml (错误), .ts→text/vnd.trolltech.linguist (错误), .sh→text/x-sh (与 text/x-shellscript 不同), .sql→application/sql (与 text/x-sql 不同), .go→None — 因此 _determine_content_type 必须先走 _language_to_content_type (文本文件), 仅对 language 未命中或二进制文件走 mimetypes 路径

# T047 Content Link Fix — 方案设计

## §1 候选方案

### 方案 A: 分流策略 — 文本走 `_language_to_content_type`, 二进制走三级 fallback

**核心思路**：`_determine_content_type(file_record)` 根据文件类型分流：
- **文本文件** (`is_binary=False` 或 `language` 在 `_language_to_content_type` 的 `_TYPE_MAP` 中): 继续使用 `_language_to_content_type(language)` — 保持现有行为不变
- **二进制文件** (`is_binary=True` 且 `language` 不在 `_TYPE_MAP` 中): 走三级 fallback (`_LANGUAGE_TO_MIME` → `mimetypes.guess_type()` → `application/octet-stream`)

**数据流**：
```
get_file_content(file_record)
  └─ _determine_content_type(file_record)
       ├─ if file_record.language in _TYPE_MAP:
       │    return _language_to_content_type(file_record.language)  # 文本文件, 保持不变
       ├─ elif file_record.language and _LANGUAGE_TO_MIME.get(file_record.language):
       │    return _LANGUAGE_TO_MIME[file_record.language]          # CSS/JS/JSON 等已知 MIME
       ├─ elif mimetypes.guess_type(actual_path)[0]:
       │    return mimetypes.guess_type(actual_path)[0]             # PNG/JPEG/SVG/WebP 等
       └─ else:
            return "application/octet-stream"                        # 兜底
```

**优点**：
1. **零回归风险**：文本文件完全走现有 `_language_to_content_type`，行为不变（AC-5/AC-6）
2. **与 P0-brief 一致**：P0 明确要求"使用与 `_build_sibling_data` 相同的三级 fallback"
3. **最小改动**：仅新增一个函数 + 修改 `get_file_content` 一行调用
4. **`_language_to_content_type` 保留不变**：P0 明确要求保留

**缺点**：
1. 分流逻辑增加一个条件判断（但逻辑清晰，可维护）
2. `_TYPE_MAP` 在 `_language_to_content_type` 内部定义（局部变量），`_determine_content_type` 需要引用它 — 需提取为模块级常量或复制

**工作量**：后端约 1h（新增函数 + 修改调用 + 测试）

### 方案 B: 统一三级 fallback — 所有文件走同一路径

**核心思路**：`_determine_content_type(file_record)` 对所有文件统一走三级 fallback，不区分文本/二进制。将 `_language_to_content_type` 的 `_TYPE_MAP` 合并到 `_LANGUAGE_TO_MIME` 中，形成完整的 language→MIME 映射。

**数据流**：
```
get_file_content(file_record)
  └─ _determine_content_type(file_record)
       ├─ _FULL_MIME_MAP.get(file_record.language)   # 合并 _TYPE_MAP + _LANGUAGE_TO_MIME
       ├─ mimetypes.guess_type(actual_path)
       └─ "application/octet-stream"
```

**优点**：
1. 逻辑统一，无分流判断
2. 单一映射表，维护简单

**缺点**：
1. **回归风险**：`_TYPE_MAP` 和 `_LANGUAGE_TO_MIME` 有重叠但不完全相同（如 `javascript` 在两者中都有，但 `python` 只在 `_TYPE_MAP` 中）。合并时需仔细处理
2. **`mimetypes.guess_type` 对文本文件的错误映射**：如 `.rs` → `application/rls-services+xml`、`.ts` → `text/vnd.trolltech.linguist`。如果 `_FULL_MIME_MAP` 未覆盖某个 language（如新增语言），fallback 到 `mimetypes` 会返回错误 MIME
3. **违反 P0-brief**：P0 明确要求"`_language_to_content_type()` 保留不变"

**工作量**：后端约 2h（合并映射 + 处理边界 + 测试），且回归风险更高

### 选择理由

**推荐方案 A**（分流策略），理由：

1. **零回归**：文本文件行为完全不变，二进制文件获得正确 MIME — 这是 T047 的核心目标
2. **与 P0-brief 一致**：P0 要求保留 `_language_to_content_type`，方案 A 直接满足
3. **与 `_build_sibling_data` 模式一致**：`_build_sibling_data` 本身就是分流逻辑（`if file_record.is_binary` 走 MIME fallback，否则走文本路径），方案 A 遵循相同模式
4. **最小验证已确认**：`mimetypes.guess_type` 对图片扩展名返回正确 MIME，对文本扩展名有误判 — 分流策略规避了误判风险

方案 B 的致命问题：`mimetypes.guess_type` 对 `.rs`/`.ts` 返回错误 MIME，统一 fallback 路径会导致回归。

## §2 影响域分析

### 改什么

| 文件 | 改动内容 | 优先级 |
|------|---------|--------|
| `backend/peekview/api/files.py` | 新增 `_determine_content_type(file_record)`; 修改 `get_file_content` 调用 | P0 |
| `backend/tests/test_content_type.py`（新建）| `_determine_content_type` 单元测试 + `/content` 端点集成测试 | P0 |
| `frontend-v3/src/utils/path-map.ts`（新建）| PathMapEntry 类型 + buildPathMap/normalizeRef/resolvePath | P0 |
| `frontend-v3/src/utils/path-map.test.ts`（新建）| 38 个单元测试 | P0 |
| `frontend-v3/src/composables/useMarkdown.ts` | +pathMap/slug 参数; +image/link_open rules 覆写; +post-DOMPurify DOM walk | P0+P1 |
| `frontend-v3/src/components/MarkdownViewer.vue` | +pathMap/slug props; +link-click 事件委托 | P0+P1 |
| `frontend-v3/src/views/EntryDetailView.vue` | +buildPathMap computed; +pathMap/slug 传给 MarkdownViewer; +handleNavigateFile | P0+P1 |

### 不改什么

- `_language_to_content_type()` — P0 明确保留，仍用于文本文件
- `_LANGUAGE_TO_MIME` map — 保持现有 8 个条目不变
- `download_file` 端点 — 已使用 `application/octet-stream` + `Content-Disposition: attachment`，不受影响
- `render_html_file` 端点 — HTML render 走独立管线，不受影响
- `get_entry_raw` 端点 — 返回 JSON，不受影响
- `_build_sibling_data` — 保持不变（参考实现，不修改）
- `HtmlViewer.vue` / `CodeViewer.vue` / `ImageViewer.vue` — 不涉及路径重写
- `FileTree.vue` — 文件切换机制不变
- `router.ts` — 不新增路由
- MCP server — 不受影响
- `models.py` — 无 schema 变更

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| `_TYPE_MAP` 是 `_language_to_content_type` 内部局部变量 | `_determine_content_type` 无法直接引用 | 提取为模块级 `_TEXT_TYPE_MAP` 常量; 或 `_determine_content_type` 对文本文件直接调用 `_language_to_content_type` |
| 前端 useMarkdown.ts 与 T045 合并代码冲突 | patch 无法直接 apply | 手动合并: 读取当前 useMarkdown.ts, 按 T046 设计逐项添加, 不用 patch apply |
| pathMap basename fallback 同名文件匹配错误 | 图片/链接指向错误文件 | 优先精确 path 匹配; basename 冲突时删除 key 不重写 |
| SVG 文件 `is_binary` 可能为 False | SVG 是文本格式, language 可能被检测为 "xml" | `_determine_content_type` 分流基于 language 是否在 `_TYPE_MAP` 中, 不依赖 `is_binary`; SVG language=null 时走 mimetypes → image/svg+xml |
| DOMPurify 删除重写后的属性 | 图片/链接失效 | API URL 是合法属性值, DOMPurify 默认不删除; ADD_ATTR 新增 data-peekview-file-id |

## §3 详细设计

### 3.1 后端: `_determine_content_type` 函数

```python
import mimetypes

def _determine_content_type(file_record: File) -> str:
    """Determine Content-Type for /content endpoint.

    Text files: use _language_to_content_type (existing behavior).
    Binary files: three-level fallback (_LANGUAGE_TO_MIME → mimetypes → octet-stream).
    """
    # Text files: preserve existing behavior via _language_to_content_type
    if file_record.language and not file_record.is_binary:
        return _language_to_content_type(file_record.language)

    # Binary files or language-less files: three-level fallback
    # Level 1: _LANGUAGE_TO_MIME (covers css/javascript/json/html/xml/yaml/text/markdown)
    if file_record.language:
        mime = _LANGUAGE_TO_MIME.get(file_record.language)
        if mime:
            return mime

    # Level 2: mimetypes.guess_type (covers PNG/JPEG/GIF/SVG/WebP/ICO/BMP/PDF/ZIP etc.)
    actual_path = file_record.path or file_record.filename
    guessed, _ = mimetypes.guess_type(actual_path)
    if guessed:
        return guessed

    # Level 3: fallback
    return "application/octet-stream"
```

**关键设计决策**：

1. **分流条件**: `file_record.language and not file_record.is_binary` — 有 language 且非二进制的文件走文本路径。这确保：
   - Python/Go/Rust/Java/C++/Bash/SQL/TypeScript 等文本文件继续走 `_language_to_content_type`（AC-5）
   - CSS/JS/JSON/YAML/Markdown 等文本文件也走 `_language_to_content_type`（AC-6），因为 `is_binary=False`
   - PNG/JPEG/GIF 等二进制文件（`is_binary=True`, `language=None`）走三级 fallback（AC-1/AC-2/AC-3/AC-4）

2. **SVG 边界情况**: SVG 文件 `is_binary=False`, `language` 可能是 `"xml"` 或 `None`:
   - `language="xml"` + `is_binary=False` → 走 `_language_to_content_type("xml")` → `text/xml` — 这与当前行为一致（SVG 在代码查看器中显示为文本）
   - `language=None` + `is_binary=False` → 跳过文本路径 → `_LANGUAGE_TO_MIME.get(None)` → None → `mimetypes.guess_type("diagram.svg")` → `image/svg+xml` — 这对 `/content` 端点是正确的（浏览器能渲染）
   - 两种情况都是可接受的

3. **`_language_to_content_type` 保留不变**: P0 明确要求。新函数是独立入口，不修改旧函数。

### 3.2 后端: `get_file_content` 修改

```python
@router.get("/{slug}/files/{file_id}/content")
async def get_file_content(
    slug: str,
    file_id: int,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    # ... existing code (unchanged) ...

    content = storage.read_file(entry_id, file_record.filename, file_record.path)

    content_type = _determine_content_type(file_record)  # 替换 _language_to_content_type
    return Response(
        content=content,
        media_type=content_type,
    )
```

**改动量**: 仅替换一行调用 (`_language_to_content_type` → `_determine_content_type`)。

### 3.3 后端: `mimetypes` import

`mimetypes` 已在 `_build_sibling_data` 中局部 import。`_determine_content_type` 改为模块级 import（与 `asyncio`/`re`/`logging` 等现有 import 一致），因为：
- `mimetypes` 是标准库，无加载开销
- 模块级 import 是 Python 惯例
- `_build_sibling_data` 的局部 import 可保留（不影响）

### 3.4 前端: path-map.ts

与 T046 P2-design §3.1 完全一致，从 P4-code-diff.patch 恢复。核心：

- `PathMapEntry = { fileId: number; priority: number }`
- `PathMap = Map<string, PathMapEntry>`
- `normalizeRef(ref)`: 跳过外部 URL/data/blob/mailto/tel/协议相对/锚点; strip `./`; 绝对路径提取 basename
- `buildPathMap(files)`: 精确 path (priority=1) → filename (priority=2) → basename fallback (priority=3); 同名冲突删除 key
- `resolvePath(ref, pathMap)`: normalizeRef → 精确匹配 → basename fallback

### 3.5 前端: useMarkdown.ts 改动

**与 T046 P2-design §3.2/§3.3/§3.5 一致**，但需手动合并到当前代码（T045 已合并，patch 不能直接 apply）。

改动步骤：
1. `render()` 签名扩展: `(content, theme, pathMap=null, slug='')`
2. 在 `md.render(processedContent)` 前:
   - 覆写 `md.renderer.rules.image` → 重写 src
   - 覆写 `md.renderer.rules.link_open` → 重写 href + data-peekview-file-id
3. 在 `md.render()` 后恢复 rules
4. DOMPurify sanitize: `ADD_ATTR` 新增 `data-peekview-file-id`
5. Post-DOMPurify DOM walk: 对每个 `type: 'html'` block 执行 `rewriteHtmlRefs(block.html, pathMap, slug)`

**rewriteHtmlRefs 函数**:
```typescript
function rewriteHtmlRefs(html: string, pathMap: PathMap, slug: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src')
    if (!src) continue
    const fileId = resolvePath(src, pathMap)
    if (fileId !== null) {
      img.setAttribute('src', `/api/v1/entries/${slug}/files/${fileId}/content`)
    }
  }
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')
    if (!href) continue
    const fileId = resolvePath(href, pathMap)
    if (fileId !== null) {
      a.setAttribute('href', `/${slug}?file=${fileId}`)
      a.setAttribute('data-peekview-file-id', String(fileId))
    }
  }
  return doc.body.innerHTML
}
```

### 3.6 前端: MarkdownViewer.vue 改动

```typescript
const props = defineProps<{
  content: string
  pathMap?: PathMap | null
  slug?: string
}>()

const emit = defineEmits<{
  headings: [headings: TocHeading[]]
  'navigate-file': [fileId: number]
}>()
```

新增 `handleLinkClick` 事件委托:
- `onMounted`: `contentRef.value?.addEventListener('click', handleLinkClick)`
- `onBeforeUnmount`: `contentRef.value?.removeEventListener('click', handleLinkClick)`
- `handleLinkClick`: 查找 `a[data-peekview-file-id]` → `e.preventDefault()` → `emit('navigate-file', fileId)`

`renderContent()` 传递 `pathMap` 和 `slug` 给 `render()`。

### 3.7 前端: EntryDetailView.vue 改动

```vue
<MarkdownViewer
  v-else-if="isMarkdown"
  :content="entryStore.fileContent"
  :path-map="pathMap"
  :slug="slug"
  @navigate-file="handleNavigateFile"
/>
```

```typescript
import { buildPathMap } from '@/utils/path-map'
import type { PathMap } from '@/utils/path-map'

const pathMap = computed<PathMap | null>(() => {
  if (!currentEntry.value) return null
  return buildPathMap(currentEntry.value.files)
})

function handleNavigateFile(fileId: number) {
  const file = currentEntry.value?.files.find(f => f.id === fileId)
  if (file) {
    entryStore.selectFile(file)
  }
}
```

## §4 BDD 覆盖矩阵

| BDD | 方案 | 覆盖机制 |
|-----|------|---------|
| AC-1 PNG Content-Type | A | `_determine_content_type`: is_binary=True → mimetypes.guess_type("arch.png") → image/png |
| AC-2 JPEG Content-Type | A | 同上: mimetypes.guess_type("photo.jpg") → image/jpeg |
| AC-3 SVG Content-Type | A | mimetypes.guess_type("diagram.svg") → image/svg+xml |
| AC-4 未知二进制 fallback | A | mimetypes.guess_type("data.bin") → None → application/octet-stream |
| AC-5 文本文件不受影响 | A | is_binary=False + language="python" → _language_to_content_type("python") → text/x-python |
| AC-6 CSS/JS MIME 映射 | A | is_binary=False + language="css" → _language_to_content_type("css") → text/css |
| AC-7 path-map.ts 测试全绿 | A | 从 patch 恢复 path-map.test.ts (38 个测试) |
| AC-8 useMarkdown.ts 兼容 | A | 手动合并 T046 改动到 T045 后的代码; vue-tsc 验证 |
| AC-9 图片端到端渲染 | A+B | 后端 Content-Type 修复 + 前端 image rule 重写 src → API URL |
| AC-10 链接端到端重写 | A | link_open rule 重写 href + 事件委托 selectFile |
| AC-11 同名文件 fallback | A | pathMap basename 冲突删除 key; priority 体系 |
| AC-12 _determine_content_type 测试 | A | pytest: 三级 fallback 路径覆盖 |
| AC-13 真实尺寸图片 + vision | A | P6 Playwright 截图 + vision-helper |
| AC-14 网络请求 Content-Type | A | P6 Playwright 监控网络请求 |

## §5 实现完成标志

1. `_determine_content_type(file_record)` 函数实现，分流逻辑正确（文本→`_language_to_content_type`，二进制→三级 fallback）
2. `get_file_content` 端点调用 `_determine_content_type` 替换 `_language_to_content_type`
3. `curl -D - -o /dev/null /content` 对 PNG 返回 `image/png`（非 `text/plain`）
4. `path-map.ts` 导出 `PathMapEntry`/`buildPathMap`/`normalizeRef`/`resolvePath`，38 个单元测试全绿
5. `useMarkdown.ts` 接受 `pathMap`/`slug` 参数，image/link_open rules 正确覆写和恢复
6. `MarkdownViewer.vue` 接受 `pathMap`/`slug` props，emit `navigate-file` 事件
7. `EntryDetailView.vue` 构建 pathMap，传给 MarkdownViewer，处理 navigate-file 事件
8. 所有 14 条 BDD 验收条件通过

## §6 权衡/选择理由

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| 分流 vs 统一 fallback | A(分流) / B(统一) | A | mimetypes.guess_type 对 .rs/.ts 返回错误 MIME; 分流规避回归 |
| _language_to_content_type 保留 | 保留 / 合并 | 保留 | P0 明确要求; 15 个 language→MIME 映射覆盖文本文件需求 |
| mimetypes import 位置 | 模块级 / 局部 | 模块级 | 标准库惯例; _determine_content_type 是模块级函数 |
| SVG is_binary=False 处理 | 特判 / 自然分流 | 自然分流 | language="xml" 走文本路径(当前行为); language=None 走 mimetypes(正确 MIME) |
| 前端 patch 恢复方式 | git apply / 手动合并 | 手动合并 | T045 已合并, patch 基于旧代码无法直接 apply |
| 链接点击: Router vs 事件委托 | Router query / 事件委托 | 事件委托 | Router 导航触发页面刷新; 事件委托复用现有模式 |
| 同名文件冲突 | 取第一个 / 删除 key | 删除 key | 错误重写比不重写更危险 |
