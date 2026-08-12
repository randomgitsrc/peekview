---
phase: P7
task_id: T053
type: consistency
parent: P6-acceptance.md
trace_id: T053-P7-20260713
status: draft
created: 2026-07-13
agent: consistency-reviewer
---

# T053 P7 一致性检查

## 1. DESIGN_GAP 配对检查

P4-implementation.md 中无 `[DESIGN_GAP]` 声明（0 条）。

**确认**：P4 §SCOPE+ Items 声明"None discovered during implementation"，P4-implementation.md 全文无 `DESIGN_GAP` 标记。无需配对。✅

## 2. SCOPE+ 闭环检查

| SCOPE+ 来源 | 标记 | 纳入基线 | P6 验收 | 判定 |
|-------------|------|---------|---------|------|
| P2 §3 B5 修正：`application/json;q=0.9, text/html;q=0.8` → HTML（非 JSON） | P1 L149: `[SCOPE+ from P2]` + `[SCOPE_RESOLVED]` | P1 B5 已修改预期为 HTML | B05 PASS | ✅ 闭环 |

**确认**：P1 有 1 处 `[SCOPE_RESOLVED]`（B5 SCOPE+ 修正），P2 有 3 处 `[SCOPE+]` 标记（L363/L372/L454，均指向同一 B5 修正）。B5 已纳入 P1 基线（修改预期为 HTML），P6 按修正后验收 PASS。SCOPE+ 闭环完成。✅

## 3. P1 残留 [NEED_CONFIRM] — DEVIATION

P1-requirements.md L64 仍有残留 `[NEED_CONFIRM]` 文本：

> "这是 [NEED_CONFIRM] 项——涉及行为变更和实现路径选择。"

此标记对应 NC1（llms.txt 实现路径）。NC1 已在 P1 L281 标记为 `[RESOLVED]` 路径 A（保持 302 重定向到 GitHub），且 P6 B15 验收 PASS。**实质已解决**，但 P1 L64 的 `[NEED_CONFIRM]` 标签未被清理。

**判定**：`[DEVIATION]` — P1 文件存在残留 `[NEED_CONFIRM]` 标签未清理。实质已解决（NC1 RESOLVED + P6 PASS），仅为文档清洁度问题。建议清理 P1 L64 的 `[NEED_CONFIRM]` 标签。

## 4. 跨文件一致性检查

### 4.1 BDD 数量匹配

| 来源 | 数量 | 明细 |
|------|------|------|
| P1 §BDD 验收条件 | 20 | B1, B2, B3, B4, B5, B6, B7, B7b, B8, B9, B10, B10b, B11, B12, B13, B13b, B14, B15, B16, B17 |
| P6 验收结果 | 20 | B01-B17（含 B07b, B10b, B13b） |

**判定**：20 = 20，数量匹配。每条 P1 BDD 在 P6 中有对应的 PASS 结果。✅

### 4.2 Packages 一致性

| 来源 | packages | 判定 |
|------|----------|------|
| P0 §packages | `backend/peekview/` | — |
| P1 §范围声明 | `backend/peekview` | ✅ 一致 |
| P2 §声明字段 | `backend/peekview` | ✅ 一致 |
| P4 §implementation_dir | `backend/peekview/` | ✅ 一致 |
| P8 裁剪 | `internal_only: true, no version bump` | ✅ 与单 package 一致 |

**判定**：全程单 package `backend/peekview`，P8 裁剪合理（无公共 API 破坏性变更）。✅

### 4.3 实现路径与 P2 方案设计吻合性

| P2 设计（P2§§1-2） | P4 实现（P4§implementation） | 代码验证 | 判定 |
|---------------------|---------------------------|---------|------|
| 方案 A：catchall 内联实现 | ✅ 在 `serve_spa_catchall` 内实现 | main.py L522-552 | 一致 |
| `_prefers_json` GitHub-style 规则 | ✅ L28-50，含 `application/xhtml+xml` | main.py L46 | 一致（+扩展） |
| `FRONTEND_ROUTES` frozenset | ✅ L25 | main.py L25 | 一致 |
| `_slug_exists` 存在性查询 | ⚠️ 增加 ARCHIVED 过滤 | main.py L66-69 | 偏差（见 §5.1） |
| 方式 3：提取 `resolve_entry_raw` | ✅ files.py L385-489 | files.py L385 | 一致 |
| `get_entry_raw` 改为薄包装 | ✅ files.py L492-498 | files.py L492-498 | 一致 |
| `_inject_link` 字符串替换 | ✅ L75-77 | main.py L75-77 | 一致 |
| catchall try/except NotFoundError | ⚠️ 未包裹，依赖全局 PeekError handler | main.py L534-536 | 偏差（见 §5.2） |
| Link header 格式 | ✅ L543-545 | main.py L543-545 | 一致 |

**判定**：核心设计路径一致，2 处非核心偏差（见 §5）。✅

### 4.4 ui_affected 一致性

| 来源 | ui_affected | 判定 |
|------|------------|------|
| P0 | 无 | — |
| P1 | 无 | ✅ 一致 |
| P2 | false | ✅ 一致 |
| P6 | false | ✅ 一致 |

✅

### 4.5 P4-backend-review CRITICAL 项修复验证

P4-backend-review 标记 2 项 CRITICAL：

| # | 问题 | 修复验证 | 判定 |
|---|------|---------|------|
| 1 | main.py:534-537 404 响应格式不一致 | 代码已改为直接 `return await resolve_entry_raw(request, path)`（L535-536），NotFoundError 由全局 PeekError handler 统一处理，格式一致 | ✅ 已修复 |
| 2 | `_slug_exists` 未过滤 ARCHIVED entries | 代码已增加 `Entry.status != EntryStatus.ARCHIVED`（L68-69） | ✅ 已修复 |

**判定**：P4-backend-review 的 2 项 CRITICAL 均已在代码中修复，P6 验收 20/20 PASS 佐证。✅

### 4.6 P4-cso-review 安全审查结论

P4-cso-review 结论：`status: approved`，0 CRITICAL，2 HIGH（mitigated），0 unmitigated。关键发现：

- `_prefers_json` 规则安全性：✅ PASS
- `resolve_entry_raw` 认证/可见性一致性：✅ PASS（与 `/raw` 端点共享同一函数）
- `<link>` 注入信息泄露：✅ ACCEPTED（LOW，slug 空间足够大）
- SQL 注入：✅ PASS（参数化查询）

**判定**：安全审查通过，无未缓解风险。✅

## 5. 偏差汇总

### 5.1 D1: `_slug_exists` ARCHIVED 过滤偏差

| 维度 | 内容 |
|------|------|
| 源文件节 | P2§2 `_slug_exists` 伪代码 vs main.py L59-72 |
| 偏差 | P2 设计为纯存在性查询（`Entry.slug == slug`），实现增加 `Entry.status != EntryStatus.ARCHIVED` 过滤 |
| 原因 | P4-backend-review CRITICAL #2 要求修复，ARCHIVED entry 对匿名用户返回 404，注入 `<link>` 会造成虚假引导 |
| 方向 | 合理修正（防止虚假引导），与 `resolve_entry_raw` 行为一致 |
| 影响 | ARCHIVED entry 不注入 `<link>` + Link header，Agent 无法通过自描述发现 ARCHIVED entry（与不可访问一致） |
| 判定 | `[DEVIATION]` — 偏差方向正确，与安全审查一致，不阻塞 |

### 5.2 D2: catchall 404 由全局 PeekError handler 处理

| 维度 | 内容 |
|------|------|
| 源文件节 | P2§2 catchall 伪代码 vs main.py L534-536 |
| 偏差 | P2 设计 catchall 包裹 try/except 返回自定义 `{"detail":...}` 格式，实际代码不包裹，NotFoundError 由全局 PeekError handler 返回 `{"error":{...}}` 格式 |
| 原因 | P4-backend-review CRITICAL #1 要求修复，全局格式更一致 |
| 方向 | 合理修正（统一错误格式），与全应用错误处理一致 |
| 影响 | Content Negotiation 404 响应格式与 API 404 格式统一 |
| 判定 | `[DEVIATION]` — 非核心偏差，格式更统一，不阻塞 |

### 5.3 D3: `_prefers_json` 支持 `application/xhtml+xml`

| 维度 | 内容 |
|------|------|
| 源文件节 | P2§2 `_prefers_json` 伪代码 vs main.py L46 |
| 偏差 | P2 伪代码只检查 `text/html`，实现额外检查 `application/xhtml+xml` |
| 原因 | `application/xhtml+xml` 是 HTML 的标准 MIME 类型，浏览器可能发送 |
| 方向 | 合理增强，更全面覆盖 HTML 变体 |
| 判定 | `[EXTENSION]` — 合理增强，不阻塞 |

### 5.4 D4: P1 残留 [NEED_CONFIRM] 标签

| 维度 | 内容 |
|------|------|
| 源文件节 | P1-requirements.md L64 |
| 偏差 | NC1 已 RESOLVED（P1 L281），但 L64 的 `[NEED_CONFIRM]` 标签未清理 |
| 判定 | `[DEVIATION]` — 文档清洁度问题，实质已解决（NC1 RESOLVED + P6 B15 PASS） |

## 6. 僵尸需求/废弃约束检查

| 检查项 | 判定 |
|-------|------|
| P2 方案 B（中间件）的 AC 仍在设计中 | 不存在——P2 明确选了方案 A |
| P2 B5 原预期（q 值排序 → JSON） | 已通过 SCOPE+ 修正为 HTML 优先——P6 按修正后验收 PASS |
| llms.txt 动态服务 | NC1 决议排除，保持 302 重定向——P6 B15 PASS |
| 前端代码改动 | P1 I8 声明无前端改动——实现无前端改动 ✅ |

## 7. 门槛检查

- [x] P7-consistency.md 存在且含合法 Header
- [x] DESIGN_GAP 配对：P4 无 DESIGN_GAP 声明，P7 确认 0 条需配对 ✅
- [x] SCOPE+ 闭环：P1 有 1 处 `[SCOPE_RESOLVED]`（B5 修正），已纳入基线 + P6 验收 PASS ✅
- [x] 跨文件一致性：BDD 数量 20=20 匹配、packages 全程 `backend/peekview` 一致、实现路径与 P2 方案 A 吻合（2 处非核心偏差） ✅
- [x] 未决项：P1 L64 残留 `[NEED_CONFIRM]` 标签标注为 `[DEVIATION]`（D4，实质已解决） ✅
- [x] 无 `[BLOCKER]` ✅
- [x] 无 `[DEVIATION-CRITICAL]` ✅

**P7 门槛状态**：通过

**偏差总计**：4 条（D1 合理修正 + D2 格式统一 + D3 合理增强 + D4 标签残留），均为非阻塞项。

**实质锚点引用**：P2§packages, P2§1-2, P4§implementation, P4§SCOPE+ Items, P1§BDD, P6§BDD 验收结果, P4-cso-review§STRIDE, P4-backend-review§CRITICAL
