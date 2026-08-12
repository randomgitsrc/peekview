---
phase: P0
task_id: T046
task_name: content-link-resolution
type: feature
trace_id: T046-P0-20260630
created: 2026-06-30
status: draft
agent: main
---

task: Markdown/HTML 文件内链路径重写 — 让发布的 entry 中图片和链接指向正确的 PeekView API URL

## 问题本质

用户写 Markdown/HTML 时引用的是**本地文件路径**（`/tmp/screenshot.png`、`images/arch.png`、`./style.css`）。发布到 PeekView 后，这些文件以 `File(id, filename, path)` 存储并通过 `/api/v1/entries/{slug}/files/{file_id}/content` 提供访问。但 Markdown/HTML 中的路径引用没有被重写，浏览器请求原路径 → 404。

**本质**：这是一个 **发布时路径空间映射** 问题——从"开发者本地文件系统"映射到"PeekView 文件服务 URL"。

## 当前状态

| 上下文 | 路径重写 | 机制 |
|--------|---------|------|
| HTML 文件（主资源引用） | ✅ 已覆盖 | 后端 `inject_resources()` sibling injection |
| HTML 内部链接 `<a href>` | ❌ 未覆盖 | sibling injection 不处理 |
| HTML `<iframe src>` | ❌ 未覆盖 | sibling injection 不处理 |
| HTML inline `<style>` 中的 `url()` | ❌ 未覆盖 | 只处理 sibling CSS 文件 |
| HTML `<source srcset>` | ❌ 未覆盖 | 只处理 `src`，不处理 `srcset` |
| **Markdown 图片** `![](path)` | ❌ 未覆盖 | MarkdownViewer 无路径重写 |
| **Markdown 链接** `[text](path)` | ❌ 未覆盖 | MarkdownViewer 无路径重写 |
| **Markdown raw HTML** `<img src>` | ❌ 未覆盖 | 不走 sibling injection |

## 引用分类与优先级

### 🔴 P0 — Markdown 图片路径（核心场景）

| Markdown 路径 | 示例 | 匹配策略 |
|--------------|------|---------|
| 相对路径（子目录）| `![图](images/arch.png)` | 精确匹配 `File.path` |
| 相对路径（同目录）| `![图](photo.png)` | 匹配 `File.path` 或 `File.filename` |
| 绝对本地路径 | `![图](/tmp/screenshot.png)` | basename → 匹配 `File.filename` |
| 相对路径（父目录）| `![图](../assets/logo.svg)` | basename fallback → `File.filename` |
| 外部 URL | `![图](https://cdn.example.com/img.png)` | **跳过**（不需要重写） |
| Fragment | `![图](#anchor)` | **跳过** |

**处理方式**：替换 `src` 为 `/api/v1/entries/{slug}/files/{file_id}/content`

### 🟠 P1 — Markdown 链接路径

| Markdown 路径 | 示例 | 期望行为 |
|--------------|------|---------|
| 指向同 entry 内文件 | `[代码](main.py)` | 链接到该文件的查看页面 |
| 指向同 entry 内 Markdown | `[文档](README.md)` | 切换到该文件查看 |
| 指向非 entry 资源 | `[文档](https://...)` | 保持原样 |
| 锚点链接 | `[章节](#intro)` | 保持原样（页内导航） |

**处理方式**：替换 `href` 为文件查看链接（如 `/{slug}?file={file_id}` 或触发文件切换）

### 🟡 P2 — HTML 未覆盖的引用

| 引用类型 | 说明 |
|----------|------|
| `<a href="page.html">` | 内部链接应重写 |
| `<iframe src="inner.html">` | 应指向 render endpoint |
| `<source srcset="img.webp 1x, img@2x.webp 2x">` | 解析 srcset 语法，重写每个 URL |
| Inline `<style>` 中的 `url()` | 应走 CSS 引用替换 |

### ⬜ P3 — 低优先级

| 引用类型 | 说明 |
|----------|------|
| `<object data>` / `<embed src>` | 低频标签 |
| `<svg><use href>` | SVG 外部引用 |
| `<area href>` / `<input src>` | 极低频 |

## 方案设计

### 架构选择：前端重写 vs 后端重写

| 维度 | 前端重写 | 后端重写 |
|------|---------|---------|
| 改动位置 | `useMarkdown.ts` + `MarkdownViewer.vue` | 新增 Markdown render 路由 |
| 文件信息可用性 | ✅ 前端已有 `entry.files` | ✅ 后端可查 File 表 |
| 与 HTML render 对齐 | ❌ 两套管线 | ✅ 统一为 render 路由 |
| 缓存/性能 | 每次渲染都重写 | 可缓存 |
| 复杂度 | 中 | 高（Markdown 渲染逻辑搬后端） |
| 对 API 的影响 | 无 | 新增路由 |
| 对 MCP 的影响 | 无 | 无 |

**推荐**：**前端重写**（P0/P1），理由：
1. 前端已有 `entry.files` 列表，无需新 API
2. Markdown 渲染本身就在前端（markdown-it + DOMPurify）
3. 改动集中，不影响 HTML render 管线
4. 后端重写需要搬移整个 markdown-it + Shiki 管线，复杂度极高

**后端重写**作为 P2 的长期方向——未来可以统一 HTML 和 Markdown 的 render 路由。

### 前端方案详细设计

#### 数据流

```
EntryDetailView.vue
  │
  ├─ currentEntry.files = [{id, filename, path, is_binary, language}, ...]
  │
  ├─ buildPathMap(files): Map<string, number>
  │   key: normalize(路径) → value: file_id
  │   注册: path → file_id, filename → file_id, basename(path) → file_id
  │
  └─ 传给 MarkdownViewer
       ↓ 新增 prop: pathMap + slug

MarkdownViewer.vue
  │ 新增 props: pathMap, slug
  │
  └─ 传给 useMarkdown()
       ↓

useMarkdown.ts
  │ 接收 pathMap, slug
  │
  ├─ 方案 A: 自定义 markdown-it renderer rules
  │   md.renderer.rules.image → 重写 src
  │   md.renderer.rules.link_open → 重写 href
  │   优点: token 级操作, 不影响代码块
  │   缺点: 不覆盖 Markdown 中的 raw HTML
  │
  ├─ 方案 B: post-render DOM walk (DOMPurify 之后)
  │   遍历 <img src> / <a href> → 查 pathMap → 替换
  │   优点: 覆盖所有类型（含 raw HTML）
  │   缺点: 需要解析 DOM
  │
  └─ 推荐: A + B 组合
     markdown-it rules 处理标准 Markdown 语法
     post-DOMPurify DOM walk 处理 raw HTML
```

#### 路径归一化函数

```typescript
function normalizeRef(ref: string): string | null {
  if (!ref) return null
  ref = ref.trim()
  if (!ref) return null
  // 跳过外部 URL
  if (/^(https?:\/\/|data:|blob:|mailto:|tel:|\/\/|#|\/)/.test(ref)) return null
  // strip ./
  while (ref.startsWith('./')) ref = ref.slice(2)
  if (!ref) return null
  return ref
}
```

#### PathMap 构建策略

```
对于每个 file in entry.files:
  if file.path:
    注册 file.path → file.id          // "images/arch.png" → 3
    注册 basename(file.path) → file.id // "arch.png" → 3
  注册 file.filename → file.id        // "arch.png" → 3

匹配优先级:
  1. 精确 path 匹配 (images/arch.png → images/arch.png)
  2. filename 匹配 (photo.png → photo.png)
  3. basename fallback (../logo.svg → logo.svg)
```

**同名冲突处理**：path 精确匹配优先；basename 冲突时取第一个匹配 + 控制台 warning。

#### 图片 vs 链接的不同重写目标

| 类型 | 图片 `![](...)` | 链接 `[](...)` |
|------|----------------|----------------|
| 重写目标 | `/api/v1/entries/{slug}/files/{id}/content` | `/{slug}?file={id}` 或触发文件切换 |
| 找不到匹配 | 保持原样 | 保持原样 |
| 二进制文件 | ✅ 浏览器直接显示图片 | ✅ 触发下载 |
| 文本文件 | ❌ 不应作为 img src | ✅ 切换查看 |

### HTML 引用重写（P2）

HTML 的 sibling injection 已覆盖主资源引用。未覆盖的 `<a href>` / `<iframe src>` 等，可以在 `inject_resources()` 中扩展处理：

```python
# 新增处理
for a in soup.find_all("a", href=True):
    key = normalize_ref(a["href"])
    if key and key in text_map or key in binary_map:
        file_id = lookup_file_id(key)
        a["href"] = f"/api/v1/entries/{slug}/files/{file_id}/content"

for iframe in soup.find_all("iframe", src=True):
    key = normalize_ref(iframe["src"])
    if key and key in text_map:
        file_id = lookup_file_id(key)
        iframe["src"] = f"/api/v1/entries/{slug}/files/{file_id}/render?inject=..."
```

但 `<a href>` 的重写需要**传入 entry 中所有文件的 ID 映射**（不仅是 sibling），当前 `inject_resources()` 只接收 sibling 列表。可能需要扩展 API 参数。

### MCP publish_files 阶段的预处理（可选增强）

MCP `publish_files` 上传时，可以**在客户端预处理** Markdown 文件中的图片路径：

1. 扫描 Markdown 文件中的 `![](path)` 引用
2. 将引用的文件路径加入上传列表（即使不在用户指定的目录中）
3. 上传后，在 Markdown 内容中将本地路径替换为相对路径（匹配 File.path）

优点：发布后 Markdown 中的路径就是正确的，不需要运行时重写。
缺点：修改了用户的原始内容；MCP 客户端需要做 Markdown 解析。

**建议**：作为优化方向，不作为 P0。运行时重写是更可靠的兜底。

## 改动域

### P0（Markdown 图片路径重写）

- `frontend-v3/src/views/EntryDetailView.vue` — 构建 pathMap，传给 MarkdownViewer
- `frontend-v3/src/components/MarkdownViewer.vue` — 新增 pathMap/slug props，传给 useMarkdown
- `frontend-v3/src/composables/useMarkdown.ts` — 自定义 markdown-it rules + post-render DOM walk
- `frontend-v3/src/utils/path-map.ts`（新建）— normalizeRef + buildPathMap + resolvePath 工具函数

### P1（Markdown 链接路径重写）

- `frontend-v3/src/composables/useMarkdown.ts` — link_open rule 重写 href
- `frontend-v3/src/views/EntryDetailView.vue` — 处理文件切换链接点击

### P2（HTML 未覆盖引用）

- `backend/peekview/services/html_render_service.py` — 扩展 inject_resources 处理 `<a href>` / `<iframe src>`
- `backend/peekview/api/files.py` — render 路由传入完整文件映射

## 与现有任务的关系

- **T041**（html-sibling-inject-fix）已完成，`inject_resources()` 是 HTML 侧的基座
- **T045**（code-block-rendering-fix）和本任务都改 `useMarkdown.ts`，可能需要协调
- 本任务的 P0 改动与 T045 不重叠（T045 改行号/zebra，本任务改路径重写），但都改 `useMarkdown.ts`

known_risks:
  - pathMap basename fallback 在同名文件场景下可能匹配错误文件
  - 自定义 markdown-it rules 可能与未来 markdown-it 升级不兼容
  - post-DOMPurify DOM walk 在大 Markdown 文件中可能影响渲染性能
  - Markdown 链接重写后的点击行为需要与 Vue Router 协调（文件切换 vs 页面导航）
  - HTML `<a href>` 重写需要后端 inject_resources 扩展，当前只接收 sibling 列表

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 涉及 Markdown/HTML 渲染管线核心路径，需走 P2 评审 + P3 TDD；P0 部分可先实现，P1/P2 按优先级递进
