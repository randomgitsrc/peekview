---
phase: P7
task_id: T053
type: consistency
parent: P6-acceptance.md
trace_id: T053-P7-20260713
status: complete
created: 2026-07-13
agent: consistency-reviewer
---

# T053 P7 一致性检查

## 方向 1：设计→实现

逐项对照 P2-design.md，标注实现是否一致。

### 影响域

| P2 声明 | 实现状态 | 判定 |
|---------|---------|------|
| 改 `main.py` catchall + 新增模块级函数 | ✅ `_prefers_json`, `_is_frontend_route`, `_slug_exists`, `_inject_link` 已添加；catchall 已修改 | 一致 |
| 改 `api/files.py` 提取 `resolve_entry_raw` | ✅ 已提取，`get_entry_raw` 改为薄包装 | 一致 |
| 不改前端代码 | ✅ 无前端改动 | 一致 |
| 不改路由注册顺序 | ✅ `/{slug}/raw` 仍在 catchall 之前（main.py L475-477） | 一致 |
| 不改 auth.py / entry_service.py | ✅ 复用 `get_current_user` 和 `_check_share_cookie` | 一致 |

### Accept 解析函数 `_prefers_json`

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| 签名 `(accept_header: str \| None) -> bool` | `(accept_header: str \| None) -> bool`（main.py L28） | 一致 |
| `text/html` 和 `application/xhtml+xml` 都视为 HTML 可接受 | ✅ main.py L46: `media in ("text/html", "application/xhtml+xml")` | 一致 |
| `*/*` 不触发 JSON | ✅ 无 wildcard 匹配逻辑，只有精确匹配 | 一致 |
| 空值 → False | ✅ L29-30 | 一致 |
| q 值解析（float） | ✅ L38-45 | 一致 |
| q=0 不可接受 | ✅ `q > 0` 条件 | 一致 |

### `_is_frontend_route`

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| `FRONTEND_ROUTES = frozenset({"", "explore", "settings/apikeys", "login"})` | ✅ main.py L25 | 一致 |
| `users/` 前缀匹配 | ✅ main.py L56 | 一致 |

### `_slug_exists`

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| 直接 DB 查询 `select(Entry).where(Entry.slug == slug)` | ⚠️ 实现增加了 `Entry.status != EntryStatus.ARCHIVED` 过滤（main.py L69） | **偏差** — 见下方分析 |

**`_slug_exists` ARCHIVED 过滤偏差分析**：

P2 设计明确写 `_slug_exists` 的用途是"判断 slug 是否存在（不检查可见性），因为 `<link>` 只是指路不泄露内容（NC2 决议）"。P2 的 SQL 是纯 slug 匹配，无 status 过滤。

实现增加了 `Entry.status != EntryStatus.ARCHIVED` 过滤。这意味着 ARCHIVED entry 不会触发 `<link>` 注入和 Link header。

**偏差合理性评估**：ARCHIVED entry 在 `entry_service.get_entry` 中对非 owner/non-admin 返回 404（entry_service.py L331-335）。如果 `<link>` 指向一个 ARCHIVED slug，Agent 跟踪链接会得到 404——这比没有 `<link>` 更差（虚假引导）。过滤 ARCHIVED 是合理的行为修正，与 Content Negotiation JSON 路径一致（`resolve_entry_raw` 也会对 ARCHIVED 返回 404）。

**判定**：`[DEVIATION]` — 实现与 P2 设计有偏差，但偏差方向合理（防止虚假引导），不阻塞。涉及 P2 核心设计目标"HTML 自描述"的边界情况，建议人工确认。

### Content Negotiation JSON 返回

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| 方式 3：提取 `resolve_entry_raw` 共享函数 | ✅ files.py L385-489 | 一致 |
| `/raw` 端点改为调用 `resolve_entry_raw` | ✅ files.py L492-498 | 一致 |
| 认证/可见性逻辑复用 | ✅ 含 global API key + normal auth + share cookie | 一致 |
| catchall 调用 `resolve_entry_raw` | ✅ main.py L535-536 | 一致 |
| NotFoundError → 404 JSON | ⚠️ 见下方分析 | 偏差 |

**404 JSON 偏差分析**：

P2 设计写 catchall 中 `resolve_entry_raw` 抛 `NotFoundError` 时返回 `JSONResponse(status_code=404, content={"detail": "Entry not found", "code": "NOT_FOUND"})`。

实际实现（main.py L535-536）直接 `return await resolve_entry_raw(request, path)`，未包裹 try/except。但 `resolve_entry_raw` 本身会 raise `NotFoundError`，由 FastAPI 的 `peek_error_handler`（main.py L443-454）统一捕获，返回 `{"error": {"code": ..., "message": ..., "details": null}}` 格式。

**差异**：P2 设计的 404 响应格式是 `{"detail": ..., "code": ...}`，实际格式是 `{"error": {"code": ..., "message": ..., "details": null}}`。

**判定**：`[DEVIATION]` — 响应格式与 P2 设计不同，但与全应用统一的 PeekError handler 格式一致。P2 设计的格式是 catchall 局部自定义，实际遵循全局错误格式更合理。非核心设计目标偏差，不阻塞。

### `<link>` 注入

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| 替换 `</head>` | ✅ main.py L77 | 一致 |
| href 格式 `/api/v1/entries/{slug}/raw` | ✅ main.py L76 | 一致 |

### Link header

| P2 设计 | 实际实现 | 判定 |
|---------|---------|------|
| `</api/v1/entries/{slug}/raw>; rel="alternate"; type="application/json"` | ✅ main.py L543-545 | 一致 |

### catchall 数据流

| P2 设计步骤 | 实际实现 | 判定 |
|------------|---------|------|
| 静态文件检查优先 | ✅ main.py L530-532 | 一致 |
| 非前端路由 + prefers_json → resolve_entry_raw | ✅ main.py L534-536 | 一致 |
| 非前端路由 + slug_exists → inject_link + Link header | ✅ main.py L541-550 | 一致 |
| 否则 → 纯 HTMLResponse | ✅ main.py L552 | 一致 |

### BDD 映射检查

| BDD | P2 覆盖方式 | P6 结果 | 判定 |
|-----|-----------|---------|------|
| B1 JSON 优先 | `_prefers_json` + `resolve_entry_raw` | PASS | 一致 |
| B2 HTML 优先 | `_prefers_json` 返回 False | PASS | 一致 |
| B3 `*/*` 不触发 JSON | `_prefers_json` 规则 | PASS | 一致 |
| B4 浏览器 Accept → HTML | `_prefers_json` 规则 | PASS | 一致 |
| B5 q 值 HTML 优先 | SCOPE+ 修正后 | PASS | 一致 |
| B6 私有未认证 → 404 | `resolve_entry_raw` | PASS | 一致 |
| B7 私有已认证 → JSON | `resolve_entry_raw` | PASS | 一致 |
| B7b admin → JSON | `resolve_entry_raw` | PASS | 一致 |
| B8 不存在 slug → 404 JSON | `resolve_entry_raw` | PASS | 一致 |
| B9 不存在 slug → HTML | `_slug_exists` False | PASS | 一致 |
| B10 有效 slug `<link>` | `_inject_link` | PASS | 一致 |
| B10b 私有 slug `<link>` | `_slug_exists`（不检查可见性） | PASS | 一致 |
| B11 不存在 slug 无 `<link>` | `_slug_exists` False | PASS | 一致 |
| B12 前端路由无 `<link>` | `_is_frontend_route` | PASS | 一致 |
| B13 有效 slug Link header | HTMLResponse headers | PASS | 一致 |
| B13b 私有 slug Link header | `_slug_exists` | PASS | 一致 |
| B14 不存在 slug 无 Link header | `_slug_exists` False | PASS | 一致 |
| B15 llms.txt | NC1 决议 | PASS | 一致 |
| B16 端到端 Accept | B1 端到端 | PASS | 一致 |
| B17 端到端 `<link>` | B10 端到端 | PASS | 一致 |

### 完成标准检查

| P2 完成标准 | P6 验证 | 判定 |
|------------|---------|------|
| 1. curl Accept:json → JSON | B01 PASS | 一致 |
| 2. curl HTML 含 `<link>` | B10 PASS | 一致 |
| 3. curl -I 含 Link header | B13 PASS | 一致 |
| 4. 浏览器访问 → HTML | B04 PASS | 一致 |
| 5. curl Accept:json + private → 404 | B06 PASS | 一致 |
| 6. curl Accept:json + explore → HTML | B12 PASS | 一致 |
| 7. 所有现有 pytest 通过 | P5 通过 | 一致 |
| 8. ruff check 通过 | P4 self-check 通过 | 一致 |

## 方向 2：实现→设计

对照代码变更，检查设计文档中是否有不再适用的要求。

### 检查项

| 代码变更 | 设计文档影响 | 判定 |
|---------|------------|------|
| `_slug_exists` 增加 ARCHIVED 过滤 | P2 §2 的 `_slug_exists` 伪代码未包含 status 过滤，设计文档描述"存在性检查 only，不检查可见性"已不完全准确 | `[DEVIATION]` — 建议更新 P2 描述为"存在性检查，排除 ARCHIVED 状态" |
| catchall 未包裹 try/except，依赖全局 PeekError handler | P2 §2 伪代码含 `try: ... except NotFoundError: JSONResponse(...)` ，实际代码由全局 handler 处理 | `[DEVIATION]` — 建议更新 P2 伪代码移除局部 try/except |
| `_prefers_json` 支持 `application/xhtml+xml` | P2 §2 伪代码只检查 `text/html`，但 P2 §1 Accept 解析规则注释提到"GitHub-style"未明确 xhtml | `[EXTENSION]` — 实现比设计更完善，`application/xhtml+xml` 是合理的 HTML 变体 |
| `resolve_entry_raw` 未被 catchall 包裹 try/except | P2 伪代码中有 `try: return await resolve_entry_raw(...); except NotFoundError: return JSONResponse(...)` | `[DEVIATION]` — 同上，全局 handler 替代了局部错误处理 |

### 僵尸需求/废弃约束检查

| 检查项 | 判定 |
|-------|------|
| P2 方案 B（中间件）的 AC 仍在设计中 | 不存在——P2 明确选了方案 A，方案 B 仅作对比 |
| P2 B5 原预期（q 值排序 → JSON） | 已通过 SCOPE+ 修正为 HTML 优先——P6 按修正后验收 PASS |
| llms.txt 动态服务 | P2 NC1 决议明确排除，保持 302 重定向 |

## P4 [DESIGN_GAP] 配对检查

P4-implementation.md 中无 `[DESIGN_GAP]` 标记。✅ 无需配对。

## P6 BDD 二值规则检查

P6 验收结果中所有 BDD 条件均为 PASS（20/20），NEED_CONFIRM 为 0。无中间态（如"调整/跳过/覆盖"）。✅ 二值规则遵守。

## `_slug_exists` ARCHIVED 过滤专项分析

**P2 设计**：`_slug_exists` 查询为 `select(Entry).where(Entry.slug == slug)`，注释"存在性检查 only，不检查可见性"。

**实际实现**：`select(Entry).where(Entry.slug == slug, Entry.status != EntryStatus.ARCHIVED)`。

**上下文**：
- ARCHIVED entry 对非 owner/non-admin 在 `entry_service.get_entry` 中返回 404（entry_service.py L331-335）
- `resolve_entry_raw` 复用 `entry_service.get_entry`，ARCHIVED entry 会得到 404
- 因此 `<link>` 指向 ARCHIVED slug 时，Agent 跟踪链接只会得到 404——造成虚假引导

**结论**：过滤 ARCHIVED 是合理的安全修正，防止 `<link>` 注入指向不可访问的 entry。但 P2 设计的"不检查可见性"原则被部分违反（ARCHIVED 是一种"不可见"状态）。

**判定**：`[DEVIATION]` — 涉及 P2 核心设计目标"HTML 自描述"的边界情况。偏差方向正确（防止虚假引导），但与 P2 "只检查存在性"的设计意图有张力。需人工确认：是否接受 ARCHIVED entry 不注入 `<link>` 的行为。

## 偏差汇总

| ID | 方向 | 涉及 P2 设计目标 | 类型 | 判定 |
|----|------|----------------|------|------|
| D1 | 设计→实现 | `_slug_exists` 存在性检查 | ARCHIVED 过滤偏差 | `[DEVIATION]` + `[NEED_CONFIRM]` |
| D2 | 设计→实现 | catchall 404 响应格式 | 全局 PeekError handler 替代局部处理 | `[DEVIATION]`（非核心，不阻塞） |
| D3 | 实现→设计 | `_prefers_json` 支持 xhtml | `application/xhtml+xml` 扩展 | `[EXTENSION]`（合理增强） |
| D4 | 设计→实现 | catchall try/except 伪代码 | 全局 handler 替代 | `[DEVIATION]`（非核心，不阻塞） |

## 门槛检查

- [x] 双向检查完成
- [x] 无 `[BLOCKER]`
- [x] 无 `[DEVIATION-CRITICAL]`
- [x] 有 1 条 `[DEVIATION]` + `[NEED_CONFIRM]`（D1：ARCHIVED 过滤）——不硬阻塞，需人工确认
- [x] 无 `[DESIGN_GAP]` 需配对

**P7 门槛状态**：通过（D1 需人工确认但不阻塞 gate）
