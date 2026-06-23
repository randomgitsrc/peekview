---
phase: P7
task_id: T019
task_name: html-viewer-srcdoc-csp
type: consistency-check
trace_id: T019-P7-2026-06-23
created: 2026-06-23
status: pass
parent: docs/tasks/T019-html-viewer-srcdoc-csp/P6-acceptance.md
---

# T019 P7 一致性检查

## 检查范围

| 文件 | 关注点 |
|------|--------|
| `backend/peekview/api/files.py` | `RENDER_CSP` 常量、`render_html_file` 路由、`_resolve_entry`、`_build_sibling_data` |
| `backend/peekview/main.py` | CSP 中间件 `is_render_route` 特判、主应用 CSP `frame-src` |
| `backend/peekview/services/html_render_service.py` | `normalize_ref`、`_BYPASS_PREFIXES`、`inject_resources`、`parse_inject_ids` |
| `frontend-v3/src/components/HtmlViewer.vue` | `countRelativePaths`、`renderUrl` computed、iframe 属性 |
| `frontend-v3/src/views/EntryDetailView.vue` | `siblingFileIds` 提取逻辑 |
| `backend/pyproject.toml` | `beautifulsoup4` 依赖声明 |

---

## 1. CSP 一致性 — PASS

### 1.1 frame-src / frame-ancestors 协调

- 主应用 CSP（`main.py:159`）：`frame-src 'self' blob:` — 允许同源 iframe 加载
- render 路由 CSP（`files.py:34`）：`frame-ancestors 'self'` — 允许被同源嵌入

两侧协调：主应用允许嵌入同源 iframe，render 路由允许被同源嵌入。`blob:` 在主应用 `frame-src` 中保留仅为兼容（当前 render URL 是同源 HTTP，非 blob），无冲突。

### 1.2 RENDER_CSP 指令完整性（对照 BDD-1/BDD-5/BDD-3）

`files.py:24-36` 的 `RENDER_CSP`：

| BDD 要求 | 对应指令 | 值 | 状态 |
|----------|----------|----|------|
| inline script 执行（BDD-1） | `script-src` | `'unsafe-inline' 'unsafe-eval' blob: data: https:` | ✅ |
| inline style（BDD-5 CSS） | `style-src` | `'unsafe-inline' blob: data: https:` | ✅ |
| Google Fonts https（BDD-5） | `font-src` | `blob: data: https:` | ✅ |
| 外部 https 资源连接（BDD-3 模型加载） | `connect-src` | `blob: data: https:` | ✅ |
| Three.js Workers | `worker-src` | `blob:` | ✅ |
| 图片/媒体 data URI | `img-src` / `media-src` | `blob: data: https:` | ✅ |
| 嵌套 iframe 禁止 | `frame-src` | `'none'` | ✅ |
| 表单提交禁止 | `form-action` | `'none'` | ✅ |

所有 BDD 要求指令齐备。

### 1.3 中间件特判条件精度

`main.py:136`：
```python
is_render_route = path.endswith("/render") and "/files/" in path
```

files router 注册的路由（prefix `/api/v1/entries`）：
- `/{slug}/files/{file_id}` — 不以 `/render` 结尾
- `/{slug}/files/{file_id}/content` — 不以 `/render` 结尾
- `/{slug}/files/{file_id}/render` — ✅ 唯一匹配

其他 router（entries/auth/apikeys/admin/config/captcha）均无 `/files/` 路径段，不会误匹配。条件精确，无误匹配风险。✅

### 1.4 特判行为正确性

`main.py:141-143`：render 路由命中 `pass`，不设置 `X-Frame-Options`（避免 DENY 阻止嵌入）也不覆盖 CSP（保留路由自设的 `RENDER_CSP`）。CSP 与 X-Frame-Options 均正确保留。✅

---

## 2. normalizeRef 前后端一致性 — PASS（含设计性差异说明）

### 2.1 跳过前缀列表对比

| 前缀 | 后端 `_BYPASS_PREFIXES`（html_render_service.py:13） | 前端 `countRelativePaths`（HtmlViewer.vue:135-138） | 一致 |
|------|------------------------------------------------------|-----------------------------------------------------|------|
| `http://` | ✅ | ✅（regex `https?:\/\/`） | ✅ |
| `https://` | ✅ | ✅（同上） | ✅ |
| `data:` | ✅ | ✅ | ✅ |
| `blob:` | ✅ | ✅ | ✅ |
| `mailto:` | ✅ | ✅ | ✅ |
| `tel:` | ✅ | ✅ | ✅ |
| `//`（协议相对） | ✅ | ✅ | ✅ |
| `#`（片段） | ✅ | ✅ | ✅ |
| `/`（绝对路径） | ✅ | ✅ | ✅ |

跳过前缀列表**完全一致**。✅

### 2.2 `./` 前缀去除逻辑

| 侧 | 行为 | 目的 |
|----|------|------|
| 后端 `normalize_ref`（line 43-44） | `while ref.startswith("./"): ref = ref[2:]` — 循环剥离所有前导 `./` | 将 `./style.css` 归一化为 `style.css` 以匹配 sibling 文件名 |
| 前端 `countRelativePaths`（line 132-140） | **不剥离** `./`，`./style.css` 计为相对路径 | 检测相对路径数量以触发用户警告 |

**差异**：是，但属**设计性差异**，非缺陷。两函数职责不同：
- 前端：计数相对路径（`./x` 本质是相对路径，应计入警告）
- 后端：归一化引用以匹配 sibling 文件名（`./x` → `x` 才能匹配名为 `x` 的 sibling）

后端剥离 `./` 后，`<link href="./style.css">` 能正确匹配 sibling `style.css` 并注入。前端不剥离则正确反映「该引用是相对路径」。逻辑自洽。✅

---

## 3. 安全边界 — PASS

### 3.1 render 路由可见性检查

`files.py:267`：`entry_id = _resolve_entry(request, slug, current_user)`

`_resolve_entry`（files.py:122-149）对非全局 API key 请求调用 `service.get_entry()`，集中执行可见性逻辑（owner/admin/public）。private entry 对非 owner 返回 `NotFoundError`（404），防止 slug 枚举。✅

### 3.2 inject 参数安全解析

`files.py:280`：`inject_ids = parse_inject_ids(inject, file_id)`

`parse_inject_ids`（html_render_service.py:48-68）：
- 空值/None → `[]` ✅
- 非整数 token → 静默跳过 ✅
- 排除自身（`fid == main_file_id`）✅
- 去重（`seen` set）✅
- 截断上限 50（`_MAX_INJECT_IDS`）✅

DB 查询额外约束（files.py:284-289）：`File.id.in_(inject_ids)` AND `File.entry_id == entry_id` — sibling 必须属于同一 entry，无法跨 entry 注入。✅

### 3.3 binary sibling 大小限制

`files.py:38`：`_BINARY_SIZE_LIMIT = 768 * 1024`

`_build_sibling_data`（files.py:218-219）：
```python
if file_record.is_binary and file_record.size > _BINARY_SIZE_LIMIT:
    return None
```
超限 binary sibling 被静默跳过，不注入 data URI。✅

### 3.4 iframe sandbox

`HtmlViewer.vue:64`：`sandbox="allow-scripts"` — 仅允许脚本，不含 `allow-same-origin`，iframe 运行在 opaque origin，无法访问主页面 cookie/localStorage（BDD-8）。✅

---

## 4. 依赖完整性 — PASS

### 4.1 beautifulsoup4 依赖

`pyproject.toml:40`：`"beautifulsoup4>=4.12.0",` — 已在 `dependencies` 中声明。✅

### 4.2 前端 createObjectURL / srcdoc 残留

- `HtmlViewer.vue`：**无** `createObjectURL` / `revokeObjectURL` / `srcdoc` 残留。iframe 使用 `:src="renderUrl"`（line 63）指向后端 render 路由。✅
- `HtmlViewer.spec.ts:167`：测试断言 `expect(iframe.attributes('srcdoc')).toBeFalsy()` — 反向验证 srcdoc 已移除。✅
- 其他文件中的 `createObjectURL`（EntryDetailView.vue 下载函数、MermaidDiagram.vue、PlantUmlDiagram.vue、MarkdownViewer.vue 导出功能）均为下载/导出场景的合法使用，与 HTML viewer 渲染无关。✅

---

## 5. siblingFileIds 前后端链路一致性 — PASS

前端（EntryDetailView.vue:329-335）：
```js
return currentEntry.value.files
  .filter(f => f.id !== activeFile.value!.id)
  .map(f => f.id)
```
排除当前 HTML 文件，传所有其余文件 ID。

后端 `parse_inject_ids` 二次排除 `main_file_id`（defense-in-depth），且 DB 查询限定 `entry_id`。前端传参格式 `?inject=1,2,3`（HtmlViewer.vue:150）与后端 `Query(None)` 解析匹配。✅

---

## 6. 次要观察（非 BLOCKER）

### [MINOR] 中间件覆盖 render 路由的 Referrer-Policy / Cache-Control

`main.py:138-140` API 分支无条件设置：
- `Cache-Control: no-store` — 覆盖 render 路由的 `no-store, no-cache, must-revalidate`
- `Referrer-Policy: strict-origin-when-cross-origin` — 覆盖 render 路由的 `no-referrer`

影响评估：
- **Cache-Control**：`no-store` 单独足以禁止缓存，功能等价。影响可忽略。
- **Referrer-Policy**：render 路由意图 `no-referrer`（最严格），被覆盖为 `strict-origin-when-cross-origin`（跨域仅发 origin，不发完整 URL）。iframe 元素自身 `referrerpolicy="no-referrer"`（HtmlViewer.vue:65）仅作用于初始导航请求，文档内子资源请求遵循被覆盖后的 header。这是轻微隐私降级，但 `strict-origin-when-cross-origin` 仍是合理策略，不泄露完整路径。

**判定**：非 BLOCKER。CSP（核心安全控制）与 X-Frame-Options 正确保留。如需修复，可在中间件 API 分支对 `is_render_route` 也跳过这两个 header 的设置。

### [MINOR] `_BINARY_SIZE_LIMIT` 常量重复定义

`files.py:38` 与 `html_render_service.py:16` 均定义 `_BINARY_SIZE_LIMIT = 768 * 1024`，值一致。实际生效的是 `files.py` 版本（`_build_sibling_data` 中使用）。`html_render_service.py` 版本当前未被引用（dead code）。建议后续清理为单一来源，不影响正确性。

---

## 结论

**status: pass**

全部 4 项检查通过，无 BLOCKER 级问题。2 个 MINOR 观察项（中间件 header 覆盖、常量重复定义）不影响功能正确性与安全性，可在后续迭代中优化。

| 检查项 | 结果 |
|--------|------|
| 1. CSP 一致性 | PASS |
| 2. normalizeRef 前后端一致性 | PASS（设计性差异已说明） |
| 3. 安全边界 | PASS |
| 4. 依赖完整性 | PASS |
