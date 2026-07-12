---
phase: P0
task_id: T053
task_name: agent-raw-discovery
type: brief
trace_id: T053-P0-20260712
created: 2026-07-12
status: complete
parent: 用户需求 — Agent 访问 /{slug} 时能自动发现 /raw 结构化 JSON 端点
---

# T053: Agent Raw 端点自动发现

## 任务简报

### 问题

Agent 收到 PeekView URL（如 `https://peek.example.com/xxxx`）后，用 curl/fetch/web-extractor 访问，拿到的是 704 字节 SPA 空壳 HTML，**零线索**指向 `/raw` 结构化 JSON 端点。

实测验证（debug :8888）：

| 访问方式 | `/{slug}` 返回 | Agent 能发现 /raw？ |
|----------|---------------|-------------------|
| curl 默认 (`Accept: */*`) | SPA 空壳 HTML | ❌ 无任何线索 |
| curl + `Accept: application/json` | SPA 空壳 HTML | ❌ 后端不处理 Accept |
| 浏览器 | SPA 空壳（JS 渲染后有内容） | ❌ |
| `/{slug}/raw` | 302 → JSON | ✅ 但 Agent 不知道这个 URL |

当前唯一能让 Agent 获取结构化数据的方式是**事先知道** `/raw` 路径（通过 MCP tool description / 文档 / 人告诉它）。没有任何自动发现机制。

### 方案：三层递进

#### 第 1 层：Content Negotiation（学 GitHub）

`/{slug}` 根据 Accept header 优先级返回 HTML 或 JSON：

```
Accept 中 application/json 优先级 > text/html → 返回 JSON（/raw 的内容）
否则 → 返回 HTML（SPA 页面）
```

GitHub 实测验证：
- `Accept: application/json, text/html` → JSON（JSON 优先）
- `Accept: text/html, application/json` → HTML（HTML 优先）
- `Accept: text/html, application/json;q=0.9` → HTML（q 值 HTML 更高）
- 浏览器完整 Accept → HTML（`text/html` 永远排第一）
- `Accept: */*`（curl 默认）→ HTML（`*/*` 不等于 `application/json`）

**安全**：浏览器永远拿 HTML。`*/*` 不触发 JSON。

#### 第 2 层：HTML 自描述（服务裸 curl Agent）

后端在返回 SPA 空壳时，预注入 `<link rel="alternate">` 到 HTML `<head>`：

```html
<link rel="alternate" type="application/json" href="/api/v1/entries/{slug}/raw" />
```

同时加 HTTP `Link` header 双保险：
```
Link: </api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"
```

Agent curl 拿到 HTML → LLM 解析 `<link>` 或 headers → 发现 /raw → 请求 JSON。

#### 第 3 层：llms.txt（已有，补充内容）

`/llms.txt` 端点已存在（重定向到 GitHub raw），补充 `/raw` API 描述。

### 三层覆盖

| Agent 行为 | 第 1 层 | 第 2 层 | 第 3 层 |
|-----------|--------|--------|--------|
| `Accept: application/json` | ✅ 直接拿 JSON | — | — |
| curl `*/*`，解析 HTML | — | ✅ `<link>` 发现 /raw | — |
| curl `*/*`，只看 headers | — | ✅ `Link` header 发现 /raw | — |
| 主动查 llms.txt | — | — | ✅ |
| MCP tool 调用 | — | — | ✅（tool description） |

## executor_env

```yaml
platform: "opencode"
has_task_tool: true
has_local_runtime: true
network: "full"
```

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 后端 `python3 -m ruff check` + `pytest` CI 强制
- 前端 `npx vue-tsc --noEmit` CI 强制
- Content Negotiation 逻辑需与 GitHub 行为对齐（实测验证）
- Playwright CDP + Vision 分析已验证可用（2026-07-12 自检通过）

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Content Negotiation 误判 | 浏览器意外拿到 JSON | 严格按 RFC 7231 优先级：`text/html` 存在时永远返回 HTML；`*/*` 不触发 JSON |
| SPA catchall slug 误匹配 | `/explore`、`/settings/apikeys` 等前端路由被当作 slug 注入 `<link>` | 维护排除列表（已知前端路由），或只对 DB 中存在的 slug 注入 |
| slug 查询性能 | 每次返回 HTML 前查 DB 判断 slug 是否存在 | 可接受：SQLite 单条查询 <1ms；或用正则排除明显非 slug 的路径 |
| `<link>` 注入修改 HTML | 需要读取 index.html → 修改 → 返回 | 用字符串替换（在 `</head>` 前插入），不需要模板引擎 |

## 裁剪倾向

- P3（TDD）保留：Content Negotiation 优先级解析需要单元测试覆盖各种 Accept 组合
- P6（验收）保留：需 curl 实测验证三层发现机制
- P7（一致性）可裁剪：改动集中在后端 main.py + entries.py，无跨包影响

## packages

- `backend/peekview/`：main.py（SPA catchall 注入 `<link>` + `Link` header + Content Negotiation）、api/entries.py（Content Negotiation 逻辑）、api/files.py（/raw 复用）

## domains

- `content-negotiation`：Accept header 优先级解析 + JSON/HTML 选择
- `html-self-description`：SPA 空壳预注入 `<link rel="alternate">` + HTTP `Link` header
- `llms-txt`：补充 /raw API 描述

## ui_affected

- 无前端 UI 改动（纯后端行为变更）

## gate_commands

```bash
cd backend && .venv/bin/python -m pytest tests/ -v --tb=short
cd backend && python3 -m ruff check peekview/ tests/
cd frontend-v3 && npx vue-tsc --noEmit
```
