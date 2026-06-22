---
phase: P2
task_id: T019
task_name: html-viewer-srcdoc-csp
type: design
trace_id: T019-P2-2026-06-22
created: 2026-06-22
status: revised
revision: 2
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P1-requirements.md
supersedes: docs/tasks/T019-html-viewer-srcdoc-csp/P2-design.md (rev 1, srcdoc 方案)
---

# T019 P2 方案设计（修订版）

## 修订说明

原 P2（rev 1）方案「blob URL → srcdoc」在 P6 实跑失败：Chrome 安全设计使 **srcdoc iframe 继承父文档 CSP**，iframe 的 `csp` 属性只能追加限制不能放宽。父文档 CSP `script-src 'self' 'unsafe-eval'`（无 `'unsafe-inline'`）拦截所有 inline script。data URL 虽不继承 CSP 但有 ~2MB 大小限制，3.3MB 测试样本超限。

**新方案方向**：后端新增独立 HTML 渲染路由，iframe 用普通 HTTP URL 加载该路由。**关键原理**：iframe 加载独立 URL 时，用的是该 URL 响应的 CSP header，不是父页面的 CSP。

**P1 的 8 条 BDD 全部保留不变**，本方案不修改 P1。

## 方案概述

新增后端路由 `GET /api/v1/entries/{slug}/files/{file_id}/render`，返回 HTML 内容（含兄弟文件注入），响应设置宽松 CSP（支持 Three.js/WebGL/Canvas）和 `frame-ancestors 'self'`（允许同源 iframe 嵌入）。前端 `HtmlViewer.vue` 的 iframe 从 `srcdoc` 改为 `:src="renderUrl"`，兄弟文件注入逻辑从前端移到后端。

**认证关键原理**：iframe 同源加载后端路由，浏览器初始 fetch **自动携带 cookie**（`peekview_token`）——sandbox flags 限制 iframe content 的 browsing context，不影响初始 resource fetch。因此 private entry 的 iframe 也能正常加载。同时 `sandbox="allow-scripts"`（无 `allow-same-origin`）使 iframe content 在 opaque origin 运行，iframe 内 JS **无法访问** cookie/localStorage——BDD-8 凭据隔离仍满足。

## 字段声明

### packages
- `[backend, frontend-v3]`（原 P1 仅 `[frontend-v3]`，**[SCOPE+]** 扩展到后端）

### domains
- `[backend, frontend]`（原 P1 仅 `[frontend]`，**[SCOPE+]** 扩展）

### ui_affected
- `true`
  - iframe DOM 由 `<iframe :srcdoc="processedHtml">` 变为 `<iframe :src="renderUrl">`，用户视觉无感知
  - loading 态时机：HTTP URL load 事件在 iframe 完整加载（含同步资源 + 同步 script）后触发，与原 blob URL 行为一致（比 srcdoc 更接近原体验）
  - sibling files 加载从"前端 fetch 内容"变为"前端只传 file IDs"，**消除前端 N 次 fetch**，体验更流畅

### gate_commands

继承自 P1，补充后端测试 gate：

```bash
# 1. 后端单元测试（P3 产出，P5 gate）—— [SCOPE+] 新增
cd backend && python -m pytest tests/test_html_render.py -v
cd backend && python -m pytest tests/test_api.py -v  # 无回归

# 2. 后端 lint
cd backend && make lint

# 3. 前端单元测试（P3 产出，P5 gate）
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewer.spec.ts
cd frontend-v3 && npx vitest run src/components/__tests__/HtmlViewerIntegration.spec.ts

# 4. 全量单元测试（无回归）
cd frontend-v3 && npx vitest run

# 5. 类型检查 + 构建
cd frontend-v3 && npm run build

# 6. Lint
cd frontend-v3 && npm run lint

# 7. Playwright 实跑（P6 gate）—— 3D Model Viewer + CSP/WebGL 验证
make debug-start
# 通过 Playwright CDP 127.0.0.1:18800：
#   a. 创建 entry 指向测试样本 HTML
#   b. 打开 entry，点击「点击渲染」
#   c. page.on('console') 抓取 CSP 违规（应为 0 条）
#   d. 检查 iframe 内 #root childElementCount > 0
#   e. 检查 iframe 内 canvas + WebGL context 非 null
#   f. 采样两帧 canvas.toDataURL() 确认渲染循环
#   g. vision-helper 截图确认 3D 模型可见
#   h. 验证 private entry 的 iframe 也能加载（cookie 自动携带）—— [SCOPE+] 新增
make debug-stop
```

## 后端设计

### 1. 新路由：`GET /api/v1/entries/{slug}/files/{file_id}/render`

**路径**：复用 `files` router 的前缀 `/api/v1/entries`，与 `download_file` / `get_file_content` 同级，RESTful 一致。

**Query 参数**：
- `inject`（可选）：逗号分隔的 sibling file IDs，如 `?inject=12,15,18`。后端读取这些文件并注入到主 HTML。

**响应**：
- `Content-Type: text/html; charset=utf-8`
- `Content-Security-Policy`：见下文「CSP 策略」
- `X-Frame-Options`：**不设**（中间件特判跳过 DENY，由 CSP `frame-ancestors 'self'` 接管）
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Referrer-Policy: no-referrer`（iframe 不向外泄露 URL）
- `X-Content-Type-Options: nosniff`

**认证**：`Depends(get_current_user)` + `_resolve_entry(request, slug, current_user)`（复用现有可见性逻辑）。anonymous 访问公开 entry OK；private entry 需 owner/admin/API key（cookie 或 header）。**关键**：iframe 同源加载，浏览器自动携带 `peekview_token` cookie，private entry 无需额外处理。

**路由伪代码**（`backend/peekview/api/files.py`）：

```python
@router.get("/{slug}/files/{file_id}/render")
async def render_html_file(
    slug: str,
    file_id: int,
    request: Request,
    inject: str | None = Query(None),
    current_user: User | None = Depends(get_current_user),
):
    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)

    entry_id = _resolve_entry(request, slug, current_user)

    with Session(engine) as session:
        # 主文件
        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry_id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

        # 限制：只对 HTML 主文件提供 render 路由
        if file_record.language != "html":
            raise NotFoundError("Render endpoint only available for HTML files")

        # 解析 inject 参数
        inject_ids = _parse_inject_ids(inject, file_id)

        # 读取 sibling files（验证属于同一 entry）
        siblings: list[SiblingFileData] = []
        if inject_ids:
            sibling_records = session.exec(
                select(File).where(
                    File.id.in_(inject_ids),
                    File.entry_id == entry_id,
                )
            ).all()
            for f in sibling_records:
                siblings.append(_build_sibling_data(f, storage))

    # 读主 HTML
    html_bytes = storage.read_file(entry_id, file_record.filename, file_record.path)
    html = html_bytes.decode("utf-8", errors="replace")

    # 注入兄弟文件
    if siblings:
        html = inject_resources(html, siblings)

    return Response(
        content=html.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Security-Policy": RENDER_CSP,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Referrer-Policy": "no-referrer",
        },
    )
```

**`_parse_inject_ids` 安全要点**：
- 解析逗号分隔的整数列表
- 自动剔除主 `file_id`（避免自引用）
- 去重
- 上限 50 个 sibling（防止 DoS）

**`_build_sibling_data` 安全要点**：
- 二进制文件大小限制 768KB（沿用前端 `BINARY_SIZE_LIMIT`），超过则跳过注入并 logger.warning
- 文本文件无大小限制（但前端 manual render 阈值 2MB 仍生效，不会发起 render 请求）

### 2. 新 service：`backend/peekview/services/html_render_service.py`

复刻前端 `injectResources` 逻辑（CSS link → style、JS script src → inline、binary img → data URI、favicon → data URI）。

**依赖**：`beautifulsoup4` + Python 内置 `html.parser`（BS4 默认后端）。**[SCOPE+] 新依赖**，理由：
- Python 标准库 `html.parser` 是 SAX 风格，手写状态机实现 inject 逻辑需 200+ 行且易出 bug
- BS4 是 PyPI 主流包，纯 Python（无 C 扩展），wheel 普遍可用，体积小
- 前端用 DOMParser，BS4 + html.parser 行为最接近

**接口**：

```python
from dataclasses import dataclass

@dataclass
class SiblingFileData:
    filename: str
    path: str | None
    content: str           # 文本内容 或 base64 编码的二进制内容
    language: str | None   # 文本文件用
    is_binary: bool
    mime_type: str | None  # 二进制文件用

def inject_resources(html: str, siblings: list[SiblingFileData]) -> str:
    """注入兄弟文件到 HTML。

    逻辑（与前端 injectResources 一致）：
    1. <link rel="stylesheet" href="x"> → <style>/* injected */ ...</style>
    2. <script src="x" type="text/javascript"> → inline <script>（移到 body 末尾）
    3. <img|video|audio|source|track src="x"> → src 替换为 data URI
    4. <link rel="icon|shortcut icon" href="x"> → href 替换为 data URI

    匹配规则：normalizeRef(filename) 和 normalizeRef(path) 都作为 key，
    跳过 http(s)/data/blob/mailto/tel///# 开头的引用。
    """
    ...
```

**`normalizeRef` 规则**（与前端一致）：
- 跳过：`http://` / `https://` / `data:` / `blob:` / `mailto:` / `tel:` / `//` / `#` / `/` 开头
- 去除前导 `./`

### 3. `main.py` CSP 中间件特判

现有中间件（`main.py:136-141`）对所有 `/api` 路径强制 `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` 和 `X-Frame-Options: DENY`，会**覆盖**路由自设的 CSP。

**改动**：在中间件中特判 render 路由，跳过 CSP 和 X-Frame-Options 覆盖（路由自设），但仍设 `X-Content-Type-Options` / `Cache-Control` / `Referrer-Policy`。

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # 新增：render 路由特判
    is_render_route = path.endswith("/render") and "/files/" in path

    if path.startswith("/api") or path == "/health":
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if is_render_route:
            # render 路由自设 CSP 和 X-Frame-Options，中间件不覆盖
            pass
        else:
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    elif path == "/" or ...:
        # 主应用 CSP 不变
        ...
    return response
```

**注意**：中间件在路由之后执行，`response.headers["X"] = "..."` 会覆盖路由设的同名 header。因此特判必须**在中间件层**跳过赋值，不能依赖路由 setdefault。

### 4. CSP 策略（render 路由专用）

```
default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:;
script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:;
style-src 'unsafe-inline' blob: data: https:;
img-src blob: data: https:;
media-src blob: data: https:;
font-src blob: data: https:;
connect-src blob: data: https:;
worker-src blob:;
frame-src 'none';
frame-ancestors 'self';
form-action 'none';
base-uri 'self';
```

**逐条说明**：

| 指令 | 值 | 放宽容许 | 拒绝 |
|------|-----|---------|------|
| `default-src` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | inline 任意元素、eval、blob/data/https 兜底 | http:、file:、ftp: |
| `script-src` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | inline `<script>`、eval（Three.js 需要）、blob/data/https script | http: script |
| `style-src` | `'unsafe-inline' blob: data: https:` | inline `<style>`、外部 https CSS | http: CSS |
| `img-src` | `blob: data: https:` | 外部 https 图片、data URI、blob | http: 图片 |
| `media-src` | `blob: data: https:` | 同上，音视频 | http: |
| `font-src` | `blob: data: https:` | Google Fonts 等 | http: 字体 |
| `connect-src` | `blob: data: https:` | fetch 外部 API、XHR、WebSocket over HTTPS | http:、'self'（避免 iframe 向主应用发请求） |
| `worker-src` | `blob:` | Web Worker（物理引擎等） | data:、https:、'self' |
| `frame-src` | `'none'` | — | iframe 内嵌 iframe（防钓鱼） |
| `frame-ancestors` | `'self'` | 同源父页面嵌入 | 跨源嵌入（防 clickjacking） |
| `form-action` | `'none'` | — | 表单提交（防数据外泄） |
| `base-uri` | `'self'` | — | `<base>` 改写 |

**与原 P2（rev 1）CSP 的差异**：
- `frame-ancestors 'self'`（新增）：允许同源 iframe 嵌入——这是新方案能工作的核心
- 不再使用 iframe 的 `csp` 属性（HTTP header CSP 已生效，且 `csp` 属性不能放宽 HTTP CSP）
- `connect-src` 不含 `'self'`（避免 iframe 向主应用 `/api` 发请求；如 Three.js 需加载同源模型，由后端 inject 为 data URI）

**安全考量**：
- `sandbox="allow-scripts"`（前端 iframe 属性，无 `allow-same-origin`）：iframe content 在 opaque origin 运行，无法访问父 cookie/localStorage，即使 `connect-src https:` 允许 fetch，也是匿名跨域请求，不携带凭据
- `frame-ancestors 'self'`：仅同源父页面可嵌入（PeekView 主应用），防跨站 clickjacking
- `frame-src 'none'`：禁止 iframe 内嵌 iframe
- `form-action 'none'`：禁止表单提交，防数据外泄

### 5. 新依赖

`backend/pyproject.toml` `dependencies` 新增：
```
"beautifulsoup4>=4.12.0",
```

## 前端设计

### 1. `HtmlViewer.vue` 改写

**Props 变更**：

```typescript
// 改前
const props = defineProps<{
  content: string                    // 用于 size 检测 + 警告计数
  siblingFiles?: SiblingFile[]       // 已注入的内容
  loadingSiblings?: boolean
}>()

// 改后
const props = defineProps<{
  slug: string                       // [新增] 拼 renderUrl
  fileId: number                     // [新增] 拼 renderUrl
  content: string                    // [保留] 用于 size 检测 + 警告计数
  siblingFileIds: number[]           // [替换 siblingFiles] 轻量 ID 列表
  loadingSiblings?: boolean          // [保留] 兼容现有 EntryDetailView 流程
}>()
```

**移除**：
- `processedHtml` ref
- `injectResources()` 函数（移到后端）
- `createBlobUrl` / `revokeBlobUrl` / `blobUrl`（P0 提到，原 rev 1 已移除 srcdoc 时残留逻辑，现彻底清理）
- `serializeDoc()`、`countRelativePathsInDoc()` 中与 inject 相关的部分

**保留**：
- `normalizeRef()`、`countRelativePaths()`：用于警告计数（同步扫描 `props.content`，不修改 HTML，与后端 inject 规则一致）
- size warning / manual render 逻辑（基于 `content.length`）
- 相对路径警告条

**新增**：
- `renderUrl` computed：根据 slug / fileId / siblingFileIds 拼接 URL

```typescript
const renderUrl = computed(() => {
  const base = `/api/v1/entries/${props.slug}/files/${props.fileId}/render`
  if (props.siblingFileIds.length === 0) return base
  return `${base}?inject=${props.siblingFileIds.join(',')}`
})
```

**iframe 模板**：

```vue
<iframe
  v-if="shouldRender"
  :src="renderUrl"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  class="html-frame"
  @load="onIframeLoad"
  @error="onIframeError"
/>
```

**关键变化**：
- 不再设 `csp` 属性（HTTP header CSP 已生效，且 `csp` 属性不能放宽 HTTP CSP）
- `:src="renderUrl"` 替代 `:srcdoc="processedHtml"`
- `shouldRender` = `!showManualRender && !props.loadingSiblings`（等 sibling IDs 到齐再渲染，避免双次加载）

**`initRender` 简化**：

```typescript
function initRender() {
  if (!props.content) return
  if (props.loadingSiblings) return       // 等 sibling IDs 到齐
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  // 警告计数：同步扫描原始 content（不修改）
  relativePathWarningCount.value = countRelativePaths(props.content)
  isLoading.value = true
  // 不再设置 processedHtml —— iframe 直接加载 renderUrl
}

watch(() => props.content, () => {
  manuallyTriggered.value = false
  initRender()
}, { immediate: true })

watch(() => props.siblingFileIds, () => {
  initRender()
}, { immediate: true })

watch(manuallyTriggered, (triggered) => {
  if (triggered) initRender()
})
```

### 2. `EntryDetailView.vue` 改写

**移除**：sibling 文件内容 fetch 逻辑（约 50 行，line 330-388）
- 不再调用 `api.getFileContent` / `api.getFileAsBase64`
- 不再有 `BINARY_SIZE_LIMIT` 前端检查（后端处理）

**新增**：sibling file IDs 提取（轻量，从 entry files list 取）

```typescript
const siblingFileIds = computed<number[]>(() => {
  if (!currentEntry.value || !activeFile.value) return []
  if (activeFile.value.language !== 'html') return []
  return currentEntry.value.files
    .filter(f => f.id !== activeFile.value!.id)
    .map(f => f.id)
})

const isFetchingSiblings = ref(false)  // 保留为 false（不再 fetch），兼容 HtmlViewer 接口
```

**模板**：

```vue
<HtmlViewer
  v-if="isHtml"
  :slug="slug"
  :file-id="entryStore.activeFile.id"
  :content="entryStore.fileContent"
  :sibling-file-ids="siblingFileIds"
  :loading-siblings="false"
/>
```

### 3. 前端 API 客户端

**无需新增方法**——iframe 直接用 URL 加载，不走 axios/fetch。

## 测试策略

### 后端测试（[SCOPE+] 全新）

**`backend/tests/test_html_render.py`**（新增）：

| 测试类 | 测试项 |
|--------|--------|
| `TestRenderRoute` | 公开 entry 匿名访问返回 200 + text/html |
| | 私有 entry 匿名访问 404 |
| | 私有 entry owner cookie 访问 200 |
| | 非 HTML 文件访问 render 路由 404 |
| | 不存在的 file_id 404 |
| | 不存在的 slug 404 |
| `TestRenderHeaders` | CSP header 含 `script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:` |
| | CSP header 含 `frame-ancestors 'self'` |
| | X-Frame-Options header **不存在**（中间件特判生效） |
| | Cache-Control: no-store |
| | Referrer-Policy: no-referrer |
| `TestSiblingInjection` | `?inject=` 含 CSS sibling → 响应含 `<style>` 不含原 `<link>` |
| | `?inject=` 含 JS sibling → 响应含 inline `<script>` |
| | `?inject=` 含 binary sibling → `<img src>` 替换为 data URI |
| | `?inject=` 含不属于该 entry 的 file_id → 该 ID 被忽略 |
| | `?inject=` 含主 file_id 自身 → 被去重 |
| | `?inject=` 含非数字 → 解析忽略 |
| | 无 `?inject=` → 返回原始 HTML |
| | sibling 超过 50 个 → 截断到 50 |
| | 二进制 sibling > 768KB → 跳过注入（logger.warning） |
| `TestInjectResources` | 单元测试 `inject_resources()` 函数（无 HTTP） |
| | `<link rel="stylesheet" href="style.css">` 替换 |
| | `<script src="main.js">` 替换 |
| | `<script src="x.js" type="module">` 不替换（type != text/javascript） |
| | `<img src="logo.png">` 替换为 data URI |
| | `<link rel="icon" href="favicon.ico">` 替换 |
| | 外部 https 引用不替换 |
| | data URI 引用不替换 |
| | `#anchor` / `/abs` / `//cdn` 不替换 |
| | filename 和 path 都可匹配 |

### 前端测试（重写）

**`HtmlViewer.spec.ts`** 大幅重写（约 919 行 → 估计 600 行）：

| describe 块 | 变化 |
|-------------|------|
| `srcdoc 绑定` | **删除**，替换为 `iframe src URL` describe 块 |
| `srcdoc 渲染` | **删除**，合并到上面 |
| `CSP 属性`（原 rev 1 计划新增） | **删除**（不再用 iframe csp 属性） |
| `sandbox 属性`（原 rev 1 计划新增） | **保留**：`sandbox="allow-scripts"` |
| `相对路径警告` | **保留**：警告计数仍在前端（countRelativePaths） |
| `大文件保护` | **保留**：基于 content.length |
| `sibling 注入`（如有） | **重写**：断言 renderUrl 含 `?inject=12,15` |

**新增** describe 块 `renderUrl 拼接`：
- 无 siblingFileIds → URL 无 `?inject=`
- 有 siblingFileIds → URL 含 `?inject=12,15,18`
- slug/fileId 变化 → URL 更新

**新增** describe 块 `loading 时序`：
- loadingSiblings=true → iframe 不渲染
- loadingSiblings=false → iframe 渲染

### P6 Playwright 实跑（继承 P1）

P1 的 8 条 BDD 全部保留。**新增 P6 验证项**（[SCOPE+]）：
- BDD-8 之外，额外验证 private entry 的 iframe 也能加载（cookie 自动携带）
- 验证 iframe 内 `fetch('/api/v1/entries/...')` 不携带 cookie（sandbox 隔离）

## [SCOPE+] 标注汇总

本修订版引入以下原 P1 未覆盖的范围扩展：

### [SCOPE+]-1: 后端新增路由 + service

**位置**：本文件「后端设计 §1 §2」
**内容**：
- 新路由 `GET /api/v1/entries/{slug}/files/{file_id}/render`
- 新 service `backend/peekview/services/html_render_service.py`（含 `inject_resources` 函数）
**原因**：srcdoc/blob/data URL 三种前端方案均失败，必须由后端返回独立 URL 的 HTML 响应才能控制 CSP。sibling 注入因此也必须移到后端（前端无法把 inject 后的 HTML 塞进 iframe）。
**影响**：原 P1 `domains: [frontend]` 扩展为 `[backend, frontend]`；`packages: [frontend-v3]` 扩展为 `[backend, frontend-v3]`。

### [SCOPE+]-2: 新依赖 beautifulsoup4

**位置**：本文件「后端设计 §2 §5」
**内容**：`backend/pyproject.toml` 新增 `beautifulsoup4>=4.12.0`
**原因**：后端实现 `inject_resources` 需要 HTML 解析。Python 标准库 `html.parser` 是 SAX 风格，手写状态机实现复杂且易出 bug。BS4 是纯 Python 主流包，与前端 DOMParser 行为最接近。
**影响**：发布时需确认 wheel 可用（BS4 全平台支持）。

### [SCOPE+]-3: main.py CSP 中间件特判

**位置**：本文件「后端设计 §3」
**内容**：`main.py:132-160` 的 `add_security_headers` 中间件新增 render 路由特判分支
**原因**：现有中间件对所有 `/api` 路径强制 `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` 和 `X-Frame-Options: DENY`，会覆盖 render 路由自设的宽松 CSP。必须在中间件层特判跳过。
**影响**：P5 须跑全量后端测试确认无回归。

### [SCOPE+]-4: 前端 EntryDetailView 重写 sibling 加载逻辑

**位置**：本文件「前端设计 §2」
**内容**：移除 `EntryDetailView.vue:330-388` 的 sibling 内容 fetch 逻辑（约 50 行），改为提取 file IDs（约 5 行）
**原因**：sibling 注入移到后端，前端不再需要 fetch sibling 内容。
**影响**：原 P1「纯前端单文件改动（HtmlViewer.vue）」假设不成立，需改 EntryDetailView.vue。P7 一致性检查范围扩大。

### [SCOPE+]-5: 后端测试新增

**位置**：本文件「测试策略 §后端测试」
**内容**：新增 `backend/tests/test_html_render.py`（约 25 个测试用例）
**原因**：后端新增路由和 service 需要单元测试覆盖。
**影响**：P3 工作量增加；P5 gate 新增后端测试命令。

## 关键差异：新方案 vs 原方案（rev 1）

| 维度 | 原 P2 rev 1（srcdoc） | 新 P2 rev 2（后端 render 路由） |
|------|----------------------|------------------------------|
| **iframe 加载方式** | `:srcdoc="processedHtml"` | `:src="renderUrl"`（HTTP URL） |
| **CSP 来源** | iframe `csp` 属性 | HTTP response header（路由自设） |
| **CSP 生效原理** | srcdoc origin=null 不继承父 CSP（**实际失败**：Chrome 仍继承） | iframe 加载独立 URL，用该 URL 响应的 CSP |
| **sibling 注入位置** | 前端（DOMParser + injectResources） | 后端（BS4 + inject_resources） |
| **sibling 数据流** | 前端 fetch 内容 → inject → srcdoc 字符串 | 前端传 file IDs → 后端读 + inject → HTTP 响应 |
| **改动范围** | 纯前端单文件 | 后端 + 前端多文件 |
| **新依赖** | 无 | beautifulsoup4 |
| **认证模型** | 不涉及（srcdoc 无 HTTP 请求） | iframe 同源 fetch 带 cookie，private entry 自动通过 |
| **main.py 改动** | 不动 | CSP 中间件特判 render 路由 |
| **BDD-8 sandbox 隔离** | sandbox opaque origin 阻止 cookie 访问 | 同左（不变） |
| **BDD 1-7** | 期望通过（实际失败） | 期望通过（独立 URL CSP 可控） |
| **测试范围** | 前端 vitest | 前端 vitest + 后端 pytest |

## 风险与缓解

### 风险 1（中）：sandbox 不带 allow-same-origin 时初始 fetch 是否携带 cookie

**描述**：方案依赖"iframe 同源加载时浏览器自动携带 cookie"。若实际行为是 sandbox 阻止初始 fetch 携带 cookie，private entry 的 iframe 会 401。

**理论依据**：[WHATWG HTML spec §4.7.5](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) — sandbox flags 限制 iframe content 的 browsing context（运行时环境），不影响初始 resource fetch（网络请求）。初始 fetch 按 iframe 元素所在 document 的 origin 处理 cookie。

**缓解**：
- P6 必须实测 private entry 的 iframe 加载（[SCOPE+]-5 新增 P6 验证项）
- Fallback 方案：若实测不带 cookie，前端在 renderUrl 后追加短期 token query 参数（`?pv_token=<short-lived-jwt>`），后端优先从 query 参数认证。这会引入 token URL 泄露风险（但 sandbox 限制 referer，且 token 短期有效）。

### 风险 2（中）：BS4 + html.parser 与前端 DOMParser 行为差异

**描述**：后端 inject_resources 用 BS4 解析 HTML，前端警告计数用 DOMParser。两者对畸形 HTML 的解析可能不一致，导致警告数与实际注入数不匹配。

**缓解**：
- 后端测试覆盖关键场景（link/script/img/icon 注入）
- 前端警告条改为"提示性"（不保证精确）——若 P6 实跑发现明显不一致，可考虑后端响应 header `X-Peekview-Unmatched-Count`，但 iframe 父 JS 无法读 iframe 响应 header（sandbox 阻止），需额外 HEAD 请求。暂不实现，P6 观察后决定。

### 风险 3（低）：iframe src 暴露 file_id 和 sibling file_ids

**描述**：URL 如 `/api/v1/entries/{slug}/files/42/render?inject=43,44,45` 暴露 file IDs。但 file_id 是自增整数，可枚举。

**缓解**：
- 所有 file 访问都经 `_resolve_entry` 可见性检查，private entry 对非 owner 返回 404
- 公开 entry 本就预期可被任意访问
- file_id 暴露不增加攻击面（已有 `/files/{file_id}/content` 路由同样暴露）

### 风险 4（低）：main.py 中间件特判影响其他路由

**描述**：特判条件 `path.endswith("/render") and "/files/" in path` 可能误匹配未来新增路由。

**缓解**：
- 特判条件精确（同时要求 `/files/` 子串和 `/render` 后缀）
- P5 跑全量后端测试确认无回归
- 若未来有其他 `/render` 路由，需 review 特判条件

### 风险 5（低）：sibling 注入大小限制行为变化

**描述**：原前端方案对 binary sibling 限制 768KB（base64 后 ~1MB），超过则前端不传。新方案前端只传 file_id，后端读取时才发现超限，需后端 skip + log。

**缓解**：后端 `_build_sibling_data` 检查 `f.size > 768*1024` 跳过，与前端原逻辑一致。

### 风险 6（低）：警告计数与 inject 分离可能导致不一致

**描述**：前端 `countRelativePaths(props.content)` 扫描原始 HTML，后端 `inject_resources` 实际注入。两者规则需严格一致（normalizeRef 逻辑、跳过前缀列表）。

**缓解**：
- 后端 `normalizeRef` 复刻前端规则（注释明确标注"与前端 HtmlViewer.vue normalizeRef 保持一致"）
- P3 测试覆盖 normalizeRef 边界情况
- P7 一致性检查确认两端规则同步

## 下一步

P2 修订完成，可进入 P3（TDD）：
1. 后端：先写 `test_html_render.py`（覆盖路由 + inject_resources）
2. 后端：实现 `html_render_service.py` + 路由 + 中间件特判
3. 前端：重写 `HtmlViewer.spec.ts`（移除 srcdoc 断言，新增 renderUrl 断言）
4. 前端：改 `HtmlViewer.vue` + `EntryDetailView.vue`

P3 完成后进 P4 实现、P5 gate、P6 Playwright 实跑（**重点验证风险 1**：private entry iframe cookie 携带）。
