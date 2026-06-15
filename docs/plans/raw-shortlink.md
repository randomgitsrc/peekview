# 短链接 Raw 别名方案

> 创建：2026-06-14
> 优先级：🟢 低（体验优化，非功能性需求）

---

## 一、需求

PeekView 的 raw API 路径是 `/api/v1/entries/{slug}/raw`，面向 Agent，路径长且包含 API 版本号。

当用户通过 MCP/CLI 发布内容后，返回的是人类链接 `https://peek.gsis.top/{slug}`。用户想拿 raw 内容时，需要知道完整的 API 路径。

**期望**：在人类链接后直接加 `/raw` 即可，即 `https://peek.gsis.top/{slug}/raw` 等价于 `https://peek.gsis.top/api/v1/entries/{slug}/raw`。

---

## 二、方案

`/{slug}/raw` → 302 Redirect 到 `/api/v1/entries/{slug}/raw`

选择 302 而非内部重写，理由：
- 零代码重复，raw API 逻辑不变
- 语义正确——同一资源的不同地址，redirect 是 HTTP 规范做法
- curl -L / Agent 自动跟 redirect

---

## 三、路由匹配安全性

### 会不会和 API 路由冲突？

**不会。** FastAPI 路由按注册顺序匹配：

1. `/api/v1/entries/{slug}/raw` — `files.py` APIRouter（prefix=`/api/v1/entries`），先注册
2. `/{slug}/raw` — 后注册的短链接路由

请求 `/api/v1/entries/1kef6o/raw` 会被 APIRouter 先拦截，不会走到 `/{slug}/raw`。

### 会不会和 SPA catch-all 冲突？

不会，前提是 `/{slug}/raw` 注册在 `_setup_static_files(app)` 之前（catch-all `/{path:path}` 之后注册的路由无法被匹配到）。

### slug 格式约束

当前 slug 是 6 位字母数字（如 `1kef6o`），不含 `/`。`/{slug}/raw` 只匹配单段路径 + `/raw` 后缀，如 `/1kef6o/raw`。

---

## 四、改动范围

| 文件 | 改动 |
|------|------|
| `backend/peekview/main.py` | `create_app()` 中加一条 redirect 路由，在 `_setup_static_files(app)` 之前 |
| `backend/tests/test_raw_api.py` | 加 1 个 redirect 测试用例 |

**不改**：
- `files.py`（raw API 本身不变）
- 前端路由
- MCP Server

---

## 五、待确认

- MCP `get_entry` 返回的 `raw_url` 字段是否要换成短链接？当前返回的是 `/api/v1/entries/{slug}/raw`，换不换都行，Agent 两种 URL 都能访问
