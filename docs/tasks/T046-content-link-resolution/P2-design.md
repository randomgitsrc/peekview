---
phase: P2
task_id: T046
type: design
parent: P1-requirements.md
trace_id: T046-P2-20260704
status: draft
agent: architect
created: 2026-07-04
---

packages: peekview
domains: [frontend, backend]
ui_affected: true
ui_affected_reason: "Markdown图片渲染+链接点击文件切换是用户可见的UI交互变化; P6需Playwright截图验证"
gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no 2>&1 | tail -30; cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no 2>&1 | tail -30; cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P8: "grep -q 'content-link-resolution' CHANGELOG.md && echo 'CHANGELOG OK' || echo 'CHANGELOG MISSING'"
env_constraints:
  debug_env: "make debug (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 2>/dev/null || echo 'debug DB not found'"
files_to_read:
  - path: frontend-v3/src/composables/useMarkdown.ts
    why: "核心改动点: 新增pathMap/slug参数, 覆写image/link_open renderer rules, post-DOMPurify DOM walk"
  - path: frontend-v3/src/components/MarkdownViewer.vue
    why: "新增pathMap/slug props, 传递给useMarkdown; 新增link-click事件拦截"
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: "构建pathMap, 传给MarkdownViewer; 处理文件切换链接点击事件"
  - path: frontend-v3/src/types/index.ts:31-39
    why: "File interface定义, pathMap构建依赖的字段(id, path, filename)"
  - path: frontend-v3/src/stores/entry.ts:100-116
    why: "selectFile方法签名, 链接点击需调用此方法"
  - path: frontend-v3/src/utils/mime.ts
    why: "现有工具函数风格参考, path-map.ts应遵循"
  - path: backend/peekview/services/html_render_service.py
    why: "P2 HTML引用重写: 扩展inject_resources处理<a href>/<iframe src>"
  - path: backend/peekview/api/files.py:299-359
    why: "render端点, 需传入完整文件映射给inject_resources"
  - path: backend/peekview/models.py
    why: "File模型定义, 查询entry所有文件时参考"
minimal_validation:
  assumption: "markdown-it image/link_open token attrs可修改; DOMPurify不删除重写后的API URL src/href"
  method: "Node.js验证markdown-it token结构; DOMPurify分析确认API URL是合法属性值"
  result: "confirmed"
  note: "markdown-it token结构已验证(image attrs=[['src',path]], link_open attrs=[['href',path]]); DOMPurify在Node.js缺JSDOM无法运行, 但分析确认/api/v1/entries/...是合法URL, 默认白名单不删除"

# T046 Content Link Resolution — 方案设计

## §1 候选方案

### 方案 A: 前端重写（markdown-it rules + post-DOMPurify DOM walk 组合）

**核心思路**：在前端 Markdown 渲染管线中，利用 markdown-it renderer rules 覆写 `image`/`link_open` token 的 `src`/`href` 属性，再用 post-DOMPurify DOM walk 处理 raw HTML 中的引用。

**数据流**：
```
EntryDetailView.vue
  ├─ buildPathMap(files) → PathMap
  └─ 传给 MarkdownViewer (props: pathMap, slug)

MarkdownViewer.vue
  ├─ 传给 useMarkdown (params: pathMap, slug)
  └─ 监听 link-click 事件 → emit('navigate-file', fileId)

useMarkdown.ts
  ├─ md.renderer.rules.image → 重写 src
  ├─ md.renderer.rules.link_open → 重写 href
  ├─ DOMPurify sanitize
  └─ post-DOMPurify DOM walk → 处理 raw HTML <img src>/<a href>
```

**优点**：
1. 前端已有 `entry.files` 列表，无需新 API
2. Markdown 渲染本身就在前端（markdown-it + DOMPurify），改动集中
3. markdown-it token 级操作天然不触及代码块内容（AC-P0-7 安全）
4. 不影响 HTML render 管线（两套管线独立）
5. 改动量小：4 个前端文件（1 新建 + 3 修改）

**缺点**：
1. Markdown 和 HTML 的路径重写是两套独立管线，长期维护成本
2. post-DOMPurify DOM walk 在大 Markdown 文件中有性能开销（但实际场景 Markdown 文件通常 <100KB，可接受）
3. pathMap basename fallback 在同名文件场景下可能匹配错误（降级策略：不重写比错误重写更安全）

**工作量**：P0 约 2-3h，P1 约 1-2h，P2 后端约 1-2h

### 方案 B: 后端 Markdown render 路由

**核心思路**：新增后端 `/api/v1/entries/{slug}/files/{file_id}/render?format=markdown` 路由，在服务端完成 Markdown→HTML 转换 + 路径重写，前端 MarkdownViewer 改为 iframe 加载（与 HtmlViewer 统一）。

**优点**：
1. 与 HTML render 管线统一，长期维护成本低
2. 可缓存渲染结果
3. 路径重写逻辑集中在一处

**缺点**：
1. **致命障碍**：Python 生态没有 markdown-it 等价物。python-markdown 对 GFM 扩展、footnote、自定义 fence 的支持差距大；更没有 Shiki 语法高亮。渲染质量/一致性远不如前端
2. 需要搬移整个 markdown-it + Shiki 管线到 Python 端，工作量巨大（>1 周）
3. 前端 Mermaid/PlantUML/SVG 图表渲染依赖浏览器 DOM，无法在后端完成
4. 新增 API 路由，增加后端复杂度
5. 前端 TOC（目录）提取、代码块复制等交互功能需要重新设计

**工作量**：>1 周（仅 P0 部分），且渲染质量降级

### 方案 C: MCP publish_files 阶段预处理

**核心思路**：在 MCP `publish_files` 上传时，扫描 Markdown 文件中的 `![](path)` 引用，将引用的文件路径加入上传列表，上传后在 Markdown 内容中将本地路径替换为相对路径。

**优点**：
1. 发布后 Markdown 中的路径就是正确的，不需要运行时重写
2. 不改前端渲染管线

**缺点**：
1. 修改了用户的原始内容（不可逆）
2. MCP 客户端需要做 Markdown 解析（增加复杂度）
3. 不覆盖非 MCP 发布路径（CLI create、API 直接创建）
4. 已发布的 entry 无法受益（需要重新发布）
5. 不能作为唯一方案，只能作为优化增强

**工作量**：约 2-3h（仅 MCP 侧），但不覆盖所有场景

### 选择理由

**推荐方案 A**（前端重写），理由：

1. **可行性**：方案 B 的致命障碍（Python 无 markdown-it 等价物 + 无 Shiki）使其不可行；方案 C 不能覆盖所有发布路径
2. **最小改动**：方案 A 改动集中在 4 个前端文件 + 1 个后端文件，不影响现有管线
3. **安全性**：markdown-it token 级操作天然不触及代码块；找不到匹配时不重写（比错误重写更安全）
4. **与 P0-brief 一致**：P0-brief 推荐前端重写，P1 分析确认正确
5. **渐进实现**：P0（图片）→ P1（链接）→ P2（HTML）可按优先级递进，每步独立可验证

方案 B 作为 P2 HTML 引用的长期方向（统一 render 路由），但不在本迭代实现。
方案 C 作为可选增强，不作为 P0。

## §2 影响域分析

### 改什么

| 文件 | 改动内容 | 优先级 |
|------|---------|--------|
| `frontend-v3/src/utils/path-map.ts`（新建）| normalizeRef + buildPathMap + resolvePath 工具函数 | P0 |
| `frontend-v3/src/composables/useMarkdown.ts` | 接收 pathMap/slug; 覆写 image/link_open rules; post-DOMPurify DOM walk | P0+P1 |
| `frontend-v3/src/components/MarkdownViewer.vue` | 新增 pathMap/slug props; 传给 useMarkdown; link-click 事件拦截 | P0+P1 |
| `frontend-v3/src/views/EntryDetailView.vue` | 构建 pathMap; 传给 MarkdownViewer; 处理 navigate-file 事件 | P0+P1 |
| `backend/peekview/services/html_render_service.py` | 扩展 inject_resources 处理 `<a href>` / `<iframe src>` | P2 |
| `backend/peekview/api/files.py` | render 路由传入完整文件映射 | P2 |

### 不改什么

- `HtmlViewer.vue` — HTML 文件走后端 render 路由，前端不改
- `CodeViewer.vue` / `ImageViewer.vue` — 不涉及路径重写
- `FileTree.vue` — 文件切换机制不变
- `router.ts` — 不新增路由，文件切换走 store 不走 router
- `entry.ts` store — selectFile 接口不变
- MCP server — 不受影响
- `models.py` — 无 schema 变更

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| pathMap basename fallback 同名文件匹配错误 | 图片/链接指向错误文件 | 优先精确 path 匹配; basename 冲突时不重写 + console.warn |
| post-DOMPurify DOM walk 性能 | 大 Markdown 文件渲染变慢 | 实际场景 <100KB; 可用 requestIdleCallback 优化 |
| markdown-it rules 与未来升级不兼容 | 升级 markdown-it 后重写失效 | rules 覆写是 markdown-it 官方扩展机制, 稳定 |
| 链接点击与 Vue Router 冲突 | 点击重写链接触发页面导航 | event.preventDefault() + selectFile; href 仍设为 /{slug}?file={id} 作为降级 |
| T045 协调 | 两个任务都改 useMarkdown.ts | 改不同的 renderer rules, 不重叠; P4 时确认 T045 已合并 |

## §3 详细设计

### 3.1 pathMap 构建（P0 核心）

#### 数据结构

```typescript
// frontend-v3/src/utils/path-map.ts

export type PathMapEntry = { fileId: number; priority: number }
export type PathMap = Map<string, PathMapEntry>

export function buildPathMap(files: File[]): PathMap {
  const map = new Map<string, PathMapEntry>()
  const basenameConflicts = new Set<string>()

  for (const file of files) {
    const entries: Array<{ key: string; priority: number }> = []

    if (file.path) {
      const normalized = normalizeRef(file.path)
      if (normalized) {
        entries.push({ key: normalized, priority: 1 })
        const basename = normalized.split('/').pop()
        if (basename && basename !== normalized) {
          entries.push({ key: basename, priority: 3 })
        }
      }
    }

    const byFilename = normalizeRef(file.filename)
    if (byFilename) {
      entries.push({ key: byFilename, priority: 2 })
    }

    for (const { key, priority } of entries) {
      if (map.has(key)) {
        const existing = map.get(key)!
        if (priority < existing.priority) {
          map.set(key, { fileId: file.id, priority })
        } else if (priority === existing.priority) {
          basenameConflicts.add(key)
        }
      } else {
        map.set(key, { fileId: file.id, priority })
      }
    }
  }

  for (const key of basenameConflicts) {
    console.warn(`[path-map] Ambiguous basename "${key}" maps to multiple files; removing from pathMap`)
    map.delete(key)
  }

  return map
}
```

**匹配优先级**：
1. **精确 path 匹配**（priority=1）：`images/arch.png` → `images/arch.png`
2. **filename 匹配**（priority=2）：`arch.png` → `arch.png`
3. **basename fallback**（priority=3）：`../logo.svg` → `logo.svg`

**同名冲突处理**：priority 相同时（如两个文件 basename 都是 `utils.py`），从 pathMap 中删除该 key，不重写。这比"取第一个匹配"更安全——错误重写比不重写更危险。

#### normalizeRef 函数

```typescript
export function normalizeRef(ref: string): string | null {
  if (!ref) return null
  ref = ref.trim()
  if (!ref) return null
  // 跳过外部 URL 和特殊协议
  if (/^(https?:\/\/|data:|blob:|mailto:|tel:|\/\/|#)/.test(ref)) return null
  // 绝对本地路径: 提取 basename 用于匹配
  if (ref.startsWith('/')) {
    const basename = ref.split('/').pop()
    return basename || null
  }
  // strip ./
  while (ref.startsWith('./')) ref = ref.slice(2)
  if (!ref) return null
  return ref
}
```

**跳过规则**：
- 外部 URL（`https://`, `http://`）
- Data URI / Blob URI
- `mailto:` / `tel:`
- 协议相对 URL（`//`）
- 锚点（`#`）

**绝对路径特殊处理**：`/tmp/screenshot.png` 以 `/` 开头，提取 basename `screenshot.png` 用于匹配。与后端 `normalize_ref` 行为不同（后端跳过 `/` 开头），但前端场景需要 basename fallback。风险：basename 冲突时 pathMap 会删除该 key，不会错误重写。

#### resolvePath 函数

```typescript
export function resolvePath(ref: string, pathMap: PathMap): number | null {
  const normalized = normalizeRef(ref)
  if (!normalized) return null

  if (pathMap.has(normalized)) return pathMap.get(normalized)!.fileId

  const basename = normalized.split('/').pop()
  if (basename && basename !== normalized && pathMap.has(basename)) {
    return pathMap.get(basename)!.fileId
  }

  return null
}
```

### 3.2 Markdown 图片路径重写（P0）

#### markdown-it image rule 覆写

```typescript
// 在 useMarkdown.ts render() 函数内

const originalImage = md.renderer.rules.image
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const srcAttr = token.attrGet('src')
  if (srcAttr && pathMap) {
    const fileId = resolvePath(srcAttr, pathMap)
    if (fileId !== null) {
      token.attrSet('src', `/api/v1/entries/${slug}/files/${fileId}/content`)
    }
  }
  return originalImage
    ? originalImage(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}
```

**关键点**：
- 在 `md.render()` 调用前覆写 rule，render 后恢复（与现有 fence/heading 覆写模式一致）
- `token.attrGet('src')` 获取原始路径，`resolvePath` 查 pathMap
- 找不到匹配时不修改 token（保持原样）
- 覆写在 token 级别操作，不触及代码块内容（AC-P0-7 安全）

#### post-DOMPurify DOM walk（处理 raw HTML）

```typescript
function rewriteHtmlRefs(html: string, pathMap: PathMap, slug: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 处理 <img src>
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src')
    if (!src) continue
    const fileId = resolvePath(src, pathMap)
    if (fileId !== null) {
      img.setAttribute('src', `/api/v1/entries/${slug}/files/${fileId}/content`)
    }
  }

  // 处理 <a href>（P1 链接重写）
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

**触发时机**：在 DOMPurify sanitize 之后、返回 blocks 之前。每个 `type: 'html'` block 都经过此函数。

**为什么需要 DOM walk**：markdown-it 的 `image`/`link_open` rules 不处理 raw HTML token（`html_inline`/`html_block`）。用户在 Markdown 中写 `<img src="photo.png">` 时，这些 token 被直接输出，不经过 renderer rules。DOM walk 是覆盖 raw HTML 的唯一方式。

**性能**：每个 html block 独立 parse + walk。实际场景中 Markdown 文件通常 <100KB，html block 数量有限（代码块占大部分），性能可接受。

### 3.3 Markdown 链接路径重写（P1）

#### markdown-it link_open rule 覆写

```typescript
const originalLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const hrefAttr = token.attrGet('href')
  if (hrefAttr && pathMap) {
    const fileId = resolvePath(hrefAttr, pathMap)
    if (fileId !== null) {
      token.attrSet('href', `/${slug}?file=${fileId}`)
      token.attrSet('data-peekview-file-id', String(fileId))
    }
  }
  return originalLinkOpen
    ? originalLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}
```

**重写目标**：`/{slug}?file={fileId}`（而非 API content URL）

**理由**：
- 图片 `![](path)` → 浏览器直接请求 content URL 显示图片
- 链接 `[text](path)` → 用户点击后应切换到文件查看页面，不是下载 content

#### 链接点击拦截（无刷新文件切换）

**方案选择**：事件委托 + `data-peekview-file-id` 属性

**理由**：
- Vue Router query param 方案（`/{slug}?file={id}`）会触发页面导航/刷新，不符合 AC-P1-2
- 事件总线增加全局耦合，不必要
- 事件委托是 MarkdownViewer 已有模式（`handleCodeBlockCopy`），一致性好

**实现**：

MarkdownViewer.vue:
```typescript
const emit = defineEmits<{
  headings: [headings: TocHeading[]]
  'navigate-file': [fileId: number]
}>()

function handleLinkClick(e: MouseEvent) {
  const target = (e.target as Element).closest('a[data-peekview-file-id]')
  if (!target) return
  const fileId = parseInt(target.getAttribute('data-peekview-file-id') || '', 10)
  if (!fileId) return
  e.preventDefault()
  emit('navigate-file', fileId)
}

onMounted(() => {
  contentRef.value?.addEventListener('click', handleLinkClick)
})
onBeforeUnmount(() => {
  contentRef.value?.removeEventListener('click', handleLinkClick)
})
```

EntryDetailView.vue:
```vue
<MarkdownViewer
  :content="entryStore.fileContent"
  :path-map="pathMap"
  :slug="slug"
  @navigate-file="handleNavigateFile"
/>
```

```typescript
const pathMap = computed(() => {
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

**降级**：`href` 仍设为 `/{slug}?file={fileId}`。如果 JS 事件拦截失败（如中键点击、右键打开），浏览器会导航到该 URL。当前路由 `/:slug` 不处理 `?file=` query param，会正常加载 entry 并选择第一个文件——这是可接受的降级行为。

### 3.4 HTML 引用重写（P2 后端）

#### inject_resources() 扩展

当前 `inject_resources()` 只处理 sibling 文件的 CSS/JS/二进制注入。需扩展处理：

1. **`<a href>` 内部链接重写**（AC-P2-1）
2. **`<iframe src>` 重写**（AC-P2-2）

**关键问题**：当前 `inject_resources()` 只接收 `siblings: list[SiblingFileData]`（sibling 列表），不包含 entry 中所有文件的 ID 映射。`<a href>` 可能指向 entry 中任何文件（不仅是 sibling），需要完整文件映射。

**方案**：新增参数 `all_files: list[AllFileRef] | None = None` 和 `slug: str = ""`

```python
@dataclass
class AllFileRef:
    file_id: int
    filename: str
    path: str | None

def inject_resources(
    html: str,
    siblings: list[SiblingFileData],
    all_files: list[AllFileRef] | None = None,
    slug: str = "",
) -> str:
```

当 `all_files` 提供时，构建完整文件 ID 映射用于 `<a href>` / `<iframe src>` 重写：

```python
if all_files is not None and slug:
    all_file_ids: dict[str, int] = {}
    for f in all_files:
        for k in _sibling_keys(f):  # 复用现有 key 生成逻辑
            all_file_ids[k] = f.file_id

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        key = normalize_ref(href)
        if not key:
            continue
        resolved = _lookup_key(key, all_file_ids)
        if resolved is not None:
            a["href"] = f"/api/v1/entries/{slug}/files/{all_file_ids[resolved]}/content"

    for iframe in soup.find_all("iframe", src=True):
        src = iframe.get("src", "")
        key = normalize_ref(src)
        if not key:
            continue
        resolved = _lookup_key(key, all_file_ids)
        if resolved is not None:
            iframe["src"] = f"/api/v1/entries/{slug}/files/{all_file_ids[resolved]}/render"
```

**render 端点改动**（`files.py`）：

```python
@router.get("/{slug}/files/{file_id}/render")
async def render_html_file(...):
    # ... 现有逻辑 ...

    # 新增: 查询 entry 所有文件构建映射
    all_file_records = session.exec(
        select(File).where(File.entry_id == entry_id)
    ).all()
    all_files_refs = [AllFileRef(file_id=f.id, filename=f.filename, path=f.path) for f in all_file_records]

    if siblings:
        html = inject_resources(html, siblings, all_files=all_files_refs, slug=slug)
```

### 3.5 useMarkdown.ts 改动汇总

`render()` 函数签名扩展：

```typescript
async function render(
  content: string,
  theme: 'github-dark' | 'github-light',
  pathMap: PathMap | null = null,
  slug: string = '',
): Promise<MarkdownRenderResult>
```

改动步骤（在现有 render 函数内）：

1. **覆写 image rule**（P0）：在 `md.render()` 前，保存 originalImage，覆写 `md.renderer.rules.image`
2. **覆写 link_open rule**（P1）：同上
3. **执行 `md.render(processedContent)`**（现有逻辑）
4. **恢复 rules**：`md.renderer.rules.image = originalImage` / `link_open = originalLinkOpen`
5. **DOMPurify sanitize**（现有逻辑，ADD_ATTR 新增 `data-peekview-file-id`）
6. **post-DOMPurify DOM walk**（P0+P1 raw HTML）：对每个 `type: 'html'` block 执行 `rewriteHtmlRefs(block.html, pathMap, slug)`

**DOMPurify ADD_ATTR 扩展**：新增 `data-peekview-file-id`，确保 DOMPurify 不删除此属性。

**重要**：post-DOMPurify DOM walk 在 DOMPurify sanitize **之后**执行，因此：
- DOMPurify 不会删除重写后的属性值（API URL 是合法的）
- DOM walk 不受 DOMPurify 影响
- 两种方案（rules + DOM walk）互不干扰

### 3.6 MarkdownViewer.vue 改动汇总

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

`renderContent()` 传递 `pathMap` 和 `slug` 给 `render()`。

新增 `handleLinkClick` 事件委托，在 `onMounted` 中注册，`onBeforeUnmount` 中移除。

### 3.7 EntryDetailView.vue 改动汇总

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
| AC-P0-1 相对路径图片重写 | A | image rule: `images/arch.png` → pathMap 精确匹配 → 重写 src |
| AC-P0-2 同目录文件名匹配 | A | image rule: `photo.png` → pathMap filename 匹配 → 重写 src |
| AC-P0-3 绝对路径 basename fallback | A | image rule: `/tmp/screenshot.png` → normalizeRef 提取 basename → pathMap 匹配 |
| AC-P0-4 外部 URL 不重写 | A | normalizeRef 返回 null → 不重写 |
| AC-P0-5 无匹配文件时保持原样 | A | resolvePath 返回 null → 不修改 token |
| AC-P0-6 Raw HTML 图片重写 | A+B | post-DOMPurify DOM walk 处理 `<img src>` |
| AC-P0-7 代码块路径不重写 | A | markdown-it token 级操作, 代码块是 fence token, 不经过 image rule |
| AC-P1-1 链接到同 entry 内文件 | A | link_open rule: `main.py` → pathMap 匹配 → 重写 href |
| AC-P1-2 点击重写链接触发文件切换 | 事件委托 | `data-peekview-file-id` + handleLinkClick + entryStore.selectFile |
| AC-P1-3 外部链接不重写 | A | normalizeRef 返回 null → 不重写 |
| AC-P1-4 锚点链接不重写 | A | normalizeRef 返回 null (`#`开头) → 不重写 |
| AC-P1-5 链接到 Markdown 文件 | A+事件 | link_open rule 重写 + selectFile 切换 |
| AC-P1-6 Raw HTML 链接重写 | A+B | post-DOMPurify DOM walk 处理 `<a href>` |
| AC-P2-1 HTML `<a href>` 重写 | 后端 | inject_resources 扩展 + all_files 映射 |
| AC-P2-2 HTML `<iframe src>` 重写 | 后端 | inject_resources 扩展 + all_files 映射 |

## §5 实现完成标志

1. `path-map.ts` 导出 `PathMapEntry`/`buildPathMap`/`normalizeRef`/`resolvePath`，单元测试覆盖：外部 URL 跳过、`./` 前缀剥离、绝对路径 basename 提取、同名冲突删除、priority 体系正确（低 priority 覆盖高 priority、同 priority 触发冲突删除）
2. `useMarkdown.ts` 的 `render()` 接受 `pathMap`/`slug` 参数，image/link_open rules 正确覆写和恢复
3. `MarkdownViewer.vue` 接受 `pathMap`/`slug` props，emit `navigate-file` 事件
4. `EntryDetailView.vue` 构建 pathMap，传给 MarkdownViewer，处理 navigate-file 事件
5. 后端 `inject_resources` 扩展处理 `<a href>` / `<iframe src>`（P2）
6. 所有 16 条 BDD 验收条件通过

## §6 权衡/选择理由

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| 前端 vs 后端重写 | A(前端) / B(后端) | A | Python 无 markdown-it 等价物 + 无 Shiki; 前端已有 files 列表 |
| markdown-it rules vs 纯 DOM walk | rules+DOM walk / 纯 DOM walk | rules+DOM walk | rules 天然不触及代码块; DOM walk 覆盖 raw HTML; 组合覆盖最全 |
| 链接点击: Router vs 事件委托 | Router query / 事件委托 | 事件委托 | Router 导航触发页面刷新, 不符合 AC-P1-2; 事件委托复用现有模式 |
| 同名文件冲突 | 取第一个 / 删除key | 删除key | 错误重写比不重写更危险; 删除key=不重写=保持原样 |
| 绝对路径 `/tmp/x.png` 处理 | 跳过 / 提取basename | 提取basename | AC-P0-3 要求 basename fallback; pathMap冲突机制兜底安全 |
| 链接重写目标 | content URL / file view URL | file view URL | 链接点击应切换查看, 非下载content |
| 后端 inject_resources 扩展 | 复用 siblings / 新增 all_files | 新增 all_files | siblings 只含inject参数指定的文件, a href可能指向任意文件 |
| normalizeRef 前后端对齐 | 完全一致 / 各自合理 | 各自合理 | 后端HTML场景跳过/路径; 前端Markdown场景需basename fallback |

## §7 DOMPurify 交互细节

### 渲染管线执行顺序

```
1. md.render(processedContent)
   ├─ image rule 覆写 → token.attrSet('src', API_URL)   ← P0 标准Markdown
   ├─ link_open rule 覆写 → token.attrSet('href', VIEW_URL)  ← P1 标准Markdown
   └─ raw HTML token 直接输出 (不经过 rules)

2. 分割 html → blocks (CODE_BLOCK 分割)

3. DOMPurify.sanitize(block.html)  ← 每个 html block
   ├─ ADD_ATTR 含 data-peekview-file-id
   └─ API URL / view URL 是合法属性值, 不被删除

4. rewriteHtmlRefs(block.html, pathMap, slug)  ← 每个 html block
   ├─ DOMParser.parse → querySelector('img[src]') → 重写
   └─ DOMParser.parse → querySelector('a[href]') → 重写
```

**关键安全保证**：
- 步骤 3（DOMPurify）在步骤 4（DOM walk）之前 → DOM walk 重写的 URL 不经过 DOMPurify
- 但 DOM walk 只生成 `/api/v1/entries/...`（合法 URL）和 `/{slug}?file={id}`（合法路径）→ 无 XSS 风险
- 步骤 1（rules）的 token 修改在 `md.render()` 输出 HTML 之前 → DOMPurify 会处理这些 HTML → 但 API URL 是合法的，不会被删除
