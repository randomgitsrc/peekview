---
phase: P2
task_id: T053
type: design
parent: P1-requirements.md
trace_id: T053-P2-20260712
status: complete
created: 2026-07-12
agent: architect
---

# T053: Agent Raw 端点自动发现 — 方案设计

## 影响域分析

### 改什么

| 文件 | 改动 | 说明 |
|------|------|------|
| `backend/peekview/main.py` L468-484 | 修改 `serve_spa_catchall` | 加入 Accept 解析 + slug 存在性查询 + Content Negotiation + `<link>` 注入 + Link header |
| `backend/peekview/main.py` L1-20 区域 | 新增 import | `get_current_user`, `EntryService`, `NotFoundError` 等 |
| `CHANGELOG.md` | 追加 [Unreleased] 条目 | Content Negotiation + HTML 自描述 |

### 不改什么

| 文件/模块 | 原因 |
|-----------|------|
| `api/files.py` | `/raw` 端点逻辑不变，Content Negotiation 直接调用它 |
| `api/entries.py` | 不涉及 |
| `auth.py` | 不涉及，复用现有 `get_current_user` |
| `services/entry_service.py` | 不涉及，复用现有 `get_entry` |
| 前端代码 | `ui_affected: false` |
| 路由注册顺序 | `/{slug}/raw` 仍在 catchall 之前，不受影响 |
| `llms.txt` | NC1 决议：保持 302 重定向，更新 GitHub 静态文件（P4 阶段单独处理） |

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| Accept 解析误判导致浏览器拿 JSON | 用户体验破坏 | GitHub-style 规则：text/html 存在时永远返回 HTML，`*/*` 不触发 JSON |
| slug 查询性能 | 每次非静态文件请求多一次 DB 查询 | SQLite 单条查询 <1ms；前端路由硬编码排除可跳过查询 |
| `<link>` 注入泄露 slug 有效性 | 信息泄露 | I11 评估：可接受，slug 随机空间足够大 |
| catchall 改动破坏现有 SPA 路由 | 前端页面无法加载 | 静态文件检查在 Content Negotiation 之前（I7） |

## §1 候选方案

### 方案 A：catchall 内联实现（推荐）

**核心思路**：在 `serve_spa_catchall` 函数内直接实现所有三层逻辑。catchall 已经是"最后兜底"路由，所有逻辑集中在此。

**数据流**：

```
请求 → catchall
  ├─ path 匹配静态文件 → FileResponse（不变）
  └─ 回退到 index.html
       ├─ 解析 Accept header
       │   ├─ JSON 优先（text/html 不可接受）→ 查 slug 存在性 + 认证
       │   │   ├─ slug 存在 + 可见 → 调用 /raw 逻辑返回 JSON
       │   │   └─ slug 不存在/不可见 → 404 JSON error
       │   └─ HTML 优先（默认）→ 查 slug 存在性
       │       ├─ slug 存在 → 注入 <link> + Link header → HTMLResponse
       │       └─ slug 不存在 → 纯 HTMLResponse（无注入）
       └─ 返回
```

**Accept 解析规则（GitHub-style，非 RFC 7231 全排序）**：

```python
def _prefers_json(accept_header: str) -> bool:
    """JSON only when application/json is acceptable AND text/html is NOT.
    
    GitHub verified behavior:
    - Accept: application/json → JSON
    - Accept: application/json, text/html → HTML (both present, html wins)
    - Accept: application/json;q=1.0, text/html;q=0.1 → HTML (both present, html wins)
    - Accept: */* → HTML (wildcard doesn't count as json)
    - Accept: text/html;q=0, application/json → JSON (html explicitly not acceptable)
    - Missing/empty Accept → HTML (same as */*)
    - Malformed Accept → HTML (safe default)
    """
```

**slug 存在性查询**：

```python
FRONTEND_ROUTES = {"", "explore", "settings/apikeys", "login"}

def _is_frontend_route(path: str) -> bool:
    if path in FRONTEND_ROUTES:
        return True
    if path.startswith("users/"):
        return True
    return False
```

当 path 不是前端路由时，查 DB 判断 slug 是否存在。查询复用 `EntryService.get_entry`（含可见性检查）。

**Content Negotiation JSON 返回**：直接调用 `get_entry_raw` 的核心逻辑（或提取为共享函数）。认证/可见性完全复用 `/raw` 端点的逻辑。

**`<link>` 注入**：读取 index.html → 字符串替换 `</head>` → `<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />\n</head>` → HTMLResponse。

**Link header**：`HTMLResponse(headers={"Link": f'</api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"'})`

**优点**：
- 改动集中在一个函数，影响域最小
- 不引入新文件/新模块
- 调试简单，逻辑流清晰

**风险**：
- catchall 函数变长（约 40-50 行，可接受）
- Accept 解析逻辑内联在 main.py（可提取为模块级函数）

**工作量**：~80 行代码 + ~60 行测试

### 方案 B：中间件拦截

**核心思路**：在 FastAPI 中间件层拦截所有请求，对匹配 `/{slug}` 模式的路径做 Content Negotiation 和 `<link>` 注入。

**数据流**：

```
请求 → 中间件
  ├─ Accept: application/json + slug 存在 → 返回 JSON Response
  └─ 否则 → 放行到路由层
       → catchall 返回 HTML
       → 中间件后处理：注入 <link> + Link header
```

**优点**：
- 与路由层解耦，catchall 不变
- 中间件可统一处理所有响应修改

**风险**：
- 中间件在路由之前执行，但 slug 存在性查询需要 DB 访问——中间件里做 DB 查询是反模式
- 中间件后处理需要拦截 Response、读取 body、修改 HTML、重新构建 Response——性能差且复杂
- 中间件对所有请求生效，需要精确的路径过滤逻辑
- 调试困难，中间件 + 路由双层逻辑

**工作量**：~120 行代码 + ~80 行测试

### 选择理由

**选方案 A**。理由：

1. **影响域最小**：改动只在 catchall 一个函数，不引入新抽象层
2. **性能最优**：无中间件拦截开销，slug 查询只在需要时执行
3. **调试简单**：单函数内逻辑流清晰，无跨层交互
4. **与现有架构一致**：catchall 已经是"兜底处理"的定位，Content Negotiation 是兜底逻辑的自然扩展
5. **方案 B 的中间件后处理**需要读取+修改 Response body，这在 FastAPI 中间件里是已知痛点（需要 `response.body` 读取、解码、修改、重新编码），且对非 HTML 响应（静态文件、API）也需要过滤

## §2 实现导航

### Accept 解析函数

位置：`main.py` 模块级函数（约 25 行）

```python
def _prefers_json(accept_header: str | None) -> bool:
    """GitHub-style: JSON only when text/html is NOT acceptable."""
    if not accept_header:
        return False
    html_acceptable = False
    json_acceptable = False
    for item in accept_header.split(","):
        item = item.strip()
        if not item:
            continue
        media = item.split(";")[0].strip()
        q = 1.0
        for param in item.split(";")[1:]:
            param = param.strip()
            if param.startswith("q="):
                try:
                    q = float(param[2:])
                except ValueError:
                    q = 1.0
        if media == "text/html" and q > 0:
            html_acceptable = True
        elif media == "application/json" and q > 0:
            json_acceptable = True
    return json_acceptable and not html_acceptable
```

### slug 存在性查询

位置：`main.py` 模块级函数

```python
FRONTEND_ROUTES = frozenset({"", "explore", "settings/apikeys", "login"})

def _is_frontend_route(path: str) -> bool:
    if path in FRONTEND_ROUTES:
        return True
    if path.startswith("users/"):
        return True
    return False

def _slug_exists(request: Request, slug: str) -> bool:
    """Check if slug exists in DB (any visibility). For <link> injection only."""
    engine = request.app.state.engine
    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        return entry is not None
```

注意：`<link>` 注入只需判断 slug 是否存在（不检查可见性），因为 `<link>` 只是指路不泄露内容（NC2 决议）。Content Negotiation JSON 返回才需要完整的认证/可见性检查。

### Content Negotiation JSON 返回

复用 `/raw` 端点逻辑。两种实现方式：

**方式 1（推荐）：直接调用 `get_entry_raw` 函数**

将 `api/files.py` 的 `get_entry_raw` 提取为可调用的内部函数（去掉 FastAPI 装饰器依赖），或直接在 catchall 中 import 并调用。

问题：`get_entry_raw` 是 FastAPI 路由函数，依赖 `Depends(get_current_user)` 注入。不能直接调用。

**方式 2（实际采用）：在 catchall 中复用认证逻辑，调用 service 层**

```python
# In catchall, when _prefers_json is True:
current_user = get_current_user(request)  # 直接调用，不用 Depends
# 然后复用 /raw 的认证+可见性逻辑
global_key_auth = _is_global_api_key_auth(request, current_user)
if global_key_auth:
    # 直接查 DB
    ...
else:
    service = get_entry_service(request.app)
    try:
        entry_resp = service.get_entry(slug, current_user_id=..., is_admin=...)
    except NotFoundError:
        # 检查 share cookie
        ...
```

这会导致 catchall 中重复 `/raw` 的认证逻辑。更好的方式：

**方式 3（最终采用）：提取共享函数 `_resolve_entry_for_content_negotiation`**

在 `api/files.py` 中提取一个共享函数，被 `/raw` 端点和 catchall 共同调用：

```python
# api/files.py
async def resolve_entry_raw(request: Request, slug: str) -> Response:
    """Shared logic for /raw endpoint and Content Negotiation.
    
    Returns JSON Response on success, raises NotFoundError on failure.
    Handles all auth/visibility logic identically to /raw endpoint.
    """
    current_user = get_current_user(request)
    # ... (existing /raw logic, extracted from get_entry_raw)
```

catchall 调用：
```python
try:
    return await resolve_entry_raw(request, slug)
except NotFoundError:
    return JSONResponse(status_code=404, content={"detail": "Entry not found"})
```

**选择方式 3**。理由：
- 认证/可见性逻辑只写一次，P7 一致性检查更容易
- `/raw` 端点改为调用 `resolve_entry_raw`，行为不变
- catchall 调用同一函数，安全边界一致

### `<link>` 注入

```python
def _inject_link(html: bytes, slug: str) -> bytes:
    """Inject <link rel="alternate"> into HTML <head>."""
    link_tag = f'<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />'
    return html.replace(b"</head>", f"{link_tag}\n</head>".encode())
```

注意：`</head>` 在 index.html 中只出现一次，替换是安全的。

### 修改后的 catchall 伪代码

```python
@app.get("/{path:path}")
async def serve_spa_catchall(request: Request, path: str):
    if path.startswith("api/") or path.startswith("health"):
        raise HTTPException(status_code=404)
    
    file_path = frontend_dist / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # --- NEW: Content Negotiation + HTML self-description ---
    if not _is_frontend_route(path) and _prefers_json(request.headers.get("accept")):
        try:
            return await resolve_entry_raw(request, path)
        except NotFoundError:
            return JSONResponse(status_code=404, content={
                "detail": "Entry not found",
                "code": "NOT_FOUND",
            })
    
    # Serve index.html (with optional <link> injection)
    index_path = frontend_dist / "index.html"
    html = index_path.read_bytes()
    
    if not _is_frontend_route(path):
        slug_exists = _slug_exists(request, path)
        if slug_exists:
            html = _inject_link(html, path)
            return HTMLResponse(
                content=html,
                headers={"Link": f'</api/v1/entries/{path}/raw>; rel="alternate"; type="application/json"'},
            )
    
    return HTMLResponse(content=html)
```

### 性能分析

| 场景 | 额外开销 |
|------|---------|
| 静态文件请求 | 0（file_path.exists() 在 Content Negotiation 之前） |
| 前端路由（/explore 等） | 0（硬编码排除，不查 DB） |
| 有效 slug + HTML Accept | 1 次 DB 查询（slug 存在性） |
| 有效 slug + JSON Accept | 1 次 DB 查询（含认证/可见性，复用 /raw 逻辑） |
| 无效 slug + HTML Accept | 1 次 DB 查询（slug 不存在，无注入） |
| 无效 slug + JSON Accept | 1 次 DB 查询 → 404 |

SQLite 单条查询 <1ms，对用户体验无影响。

## §3 BDD 映射

| BDD | 方案覆盖 | 实现位置 |
|-----|---------|---------|
| B1 JSON 优先 | `_prefers_json` + `resolve_entry_raw` | catchall |
| B2 HTML 优先 | `_prefers_json` 返回 False | catchall |
| B3 `*/*` 不触发 JSON | `_prefers_json` 规则 | catchall |
| B4 浏览器 Accept → HTML | `_prefers_json` 规则 | catchall |
| B5 q 值 JSON 优先 | ⚠️ 见下方说明 | catchall |
| B6 私有未认证 → 404 | `resolve_entry_raw` 复用 /raw 逻辑 | catchall → files.py |
| B7 私有已认证 → JSON | `resolve_entry_raw` 复用 /raw 逻辑 | catchall → files.py |
| B7b admin → JSON | `resolve_entry_raw` 复用 /raw 逻辑 | catchall → files.py |
| B8 不存在 slug → 404 JSON | `resolve_entry_raw` → NotFoundError | catchall |
| B9 不存在 slug → HTML | `_slug_exists` 返回 False，无注入 | catchall |
| B10 有效 slug `<link>` | `_inject_link` | catchall |
| B10b 私有 slug `<link>` | `_slug_exists`（不检查可见性） | catchall |
| B11 不存在 slug 无 `<link>` | `_slug_exists` 返回 False | catchall |
| B12 前端路由无 `<link>` | `_is_frontend_route` | catchall |
| B13 有效 slug Link header | HTMLResponse headers | catchall |
| B13b 私有 slug Link header | `_slug_exists`（不检查可见性） | catchall |
| B14 不存在 slug 无 Link header | `_slug_exists` 返回 False | catchall |
| B15 llms.txt | NC1 决议：更新 GitHub 静态文件 | P4 单独处理 |
| B16 端到端 Accept | B1 的端到端验证 | P6 |
| B17 端到端 `<link>` | B10 的端到端验证 | P6 |

### ⚠️ B5 修正

P1 BDD B5 声明：
> `Accept: application/json;q=0.9, text/html;q=0.8` → JSON

**这与 GitHub 实际行为不符**。GitHub 实测：当 `text/html` 和 `application/json` 都可接受时，**无论 q 值如何，HTML 总是胜出**。

这是 `[SCOPE+]` 发现：P1 基线 B5 的预期行为与 GitHub 实际行为不一致。

**建议**：修改 B5 预期为 HTML（对齐 GitHub），理由：
1. 安全性更强：浏览器永远不会意外拿到 JSON
2. 规则更简单：`text/html` 存在 → HTML，无需 q 值排序
3. 与 GitHub 行为一致（P0 明确要求"学 GitHub"）

如果 P1 维持 B5 原预期（q 值排序），则需实现 RFC 7231 完整 q 值解析，但这会引入安全风险（构造特定 Accept header 可让浏览器拿到 JSON）。

**[SCOPE+] 发现**：B5 预期与 GitHub 实际行为不一致，需主 Agent 确认是否修改 B5 预期。
影响：P1 基线 B5 需修改；packages 不变。

## §4 完成标准

1. `curl -H "Accept: application/json" http://127.0.0.1:8888/{valid-slug}` 返回 JSON
2. `curl http://127.0.0.1:8888/{valid-slug}` 返回 HTML 含 `<link rel="alternate">`
3. `curl -I http://127.0.0.1:8888/{valid-slug}` 响应含 `Link` header
4. 浏览器访问 `http://127.0.0.1:8888/{valid-slug}` 返回 HTML（非 JSON）
5. `curl -H "Accept: application/json" http://127.0.0.1:8888/{private-slug}` 返回 404
6. `curl -H "Accept: application/json" http://127.0.0.1:8888/explore` 返回 HTML（前端路由不触发 JSON）
7. 所有现有 pytest 测试通过
8. ruff check 通过

## 声明字段

```yaml
packages:
  - backend/peekview

domains:
  - content-negotiation
  # Accept header 优先级解析 + JSON/HTML 选择
  - html-self-description  # SPA 空壳预注入 <link> + Link header
  - security  # Content Negotiation 必须遵守现有认证/可见性边界

ui_affected: false

gate_commands:
  P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
  P6: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no -k 'test_content_negotiation or test_link_injection or test_raw_discovery'"
```

## env_constraints

```yaml
env_constraints:
  debug_env: "make debug-start（:8888, /tmp/peekview-debug/）"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'（验证数据落在 debug DB）"
```

## files_to_read

```yaml
files_to_read:
  - path: backend/peekview/main.py:415-490
    why: SPA catchall 实现 + raw_shortlink 注册 + _setup_static_files，核心改动点
  - path: backend/peekview/api/files.py:140-230
    why: _is_global_api_key_auth + _resolve_entry 实现，Content Negotiation 需复用认证逻辑
  - path: backend/peekview/api/files.py:385-506
    why: get_entry_raw 完整实现，需提取为共享函数 resolve_entry_raw
  - path: backend/peekview/api/entries.py:68-128
    why: _check_share_cookie + _is_global_api_key_auth（entries 版本），理解认证全貌
  - path: backend/peekview/auth.py:137-196
    why: get_current_user 实现，catchall 需直接调用（不用 Depends）
  - path: backend/peekview/services/entry_service.py:313-344
    why: get_entry 可见性逻辑，_slug_exists 查询参考
  - path: backend/peekview/models.py
    why: Entry 模型定义（slug 字段、is_public 字段），_slug_exists 查询需要
  - path: backend/peekview/exceptions.py:55-65
    why: NotFoundError 定义，catchall 需捕获
```

## minimal_validation

```yaml
minimal_validation:
  assumption: "GitHub Content Negotiation 行为：当 text/html 和 application/json 都可接受时，HTML 总是胜出（无论 q 值）；JSON 只在 text/html 不可接受时返回"
  method: "curl 对 github.com/python/cpython 测试 6 种 Accept header 组合"
  result: confirmed
  note: |
    实测结果（2026-07-13，通过 HTTPS 代理）：
    - Accept: application/json → JSON ✅
    - Accept: application/json, text/html → HTML ✅
    - Accept: text/html, application/json → HTML ✅
    - Accept: application/json;q=1.0, text/html;q=0.1 → HTML ✅
    - Accept: */* → HTML ✅
    - Accept: text/html;q=0, application/json → JSON ✅
    
    关键发现：P0-brief 声称"q 值排序决定优先级"与 GitHub 实际行为不符。
    GitHub 规则更简单更安全：text/html 存在 → HTML，不存在 → JSON。
    这意味着 B5（application/json;q=0.9, text/html;q=0.8 → JSON）预期错误，
    应修改为 HTML。已标 [SCOPE+]。
    
    Python 手写 _prefers_json 函数 10 个测试用例全部通过。
    无需引入 accept PyPI 包（未安装在 venv 中）。
```
