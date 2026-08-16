---
phase: P4
task_id: TPV0093-star-lifecycle
type: review
parent: P4-implementation-backend.md
trace_id: TPV0093-P4-20260816-cso-r2
status: approved
created: 2026-08-16
agent: cso
---

# P4 安全复核（cso r2）— TPV0093 star-lifecycle

## 0. 范围与方法

- 复核 P4-implementation-backend.md（r2 节）针对上轮 P4-review-cso.md（needs-revision：F1 HIGH + F2/F3 MEDIUM + F4-F8 LOW）的修复。
- 方法：代码核实 + 回归测试核对；只读审计，未运行测试（[PROD_NOT_TOUCHED]）。

## 1. 结论摘要（r2）

| 严重级别 | 数量 | 是否阻塞 |
|---------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 0（F1 已闭合） | — |
| MEDIUM | 0（F2/F3 已闭合） | — |
| LOW | 2（遗留 DEBT + 计时微泄露，均不阻塞） | 否 |
| 总体 | approved | 不阻塞 |

## 2. STRIDE 矩阵（r2）

| 类别 | 结论 | 说明 |
|------|------|------|
| Spoofing | ✅ | star/unstar/list/batch 全部 require_auth；匿名 + starred → 401（entries.py:148-149） |
| Tampering | ✅ | unstar/unstar_batch 按 user_id 过滤；无跨用户写路径 |
| Repudiation | ✅ | deleted_by username 快照（不变） |
| Information Disclosure | ✅ F2 闭合 | DELETE /{slug}/star 200/404 oracle 已消除；遗留极微计时差 LOW 不计 |
| DoS | ✅ F1/F3/F4 闭合 | 时区 TypeError 消除；批量上限 500；stars 路由限速；F8 批量查询 |
| Elevation of Privilege | ✅ | BLOCKER-2/N8/决策 A 判定逻辑未被动摇 |

## 3. F1-F4 闭合逐条核实

### F1 [HIGH] 时区 TypeError — ✅ 闭合
- 修复：star_service.py:88-89 — deadline 与 now 两侧均 naive UTC；_naive_utc（:36-40）双向归一化。
- 覆盖：全部读路径（get_entry → _build_response :1145、list_entries :619、list_starred :373）汇聚单一 build_countdown，单点修复全覆盖。
- 回归测试：test_star_review_fixes.py::TestCountdownReads — archived + archive_delete_at 已设 → 详情 200（owner=running / 星标=paused）+ /api/v1/stars 200（paused）；未星标 + deadline 已过 → expired + remaining_days=0。

### F2 [MEDIUM] DELETE /star slug oracle — ✅ 闭合
- 修复：api/entries.py:457-464 — get_entry_by_slug（未知 → 404）→ has_star（活+墓碑绑定，star_service.py:235-240）→ 无星标回退 get_entry 可读性校验（不可读 → 404）→ 否则 unstar。
- N9 保留：星标用户对 archived → 200（测试覆盖）。
- 遗留 LOW（信息级）：未知 slug（1 查询）vs 不可读已知 slug（3 查询）微计时差——二进制 oracle 已消除，不阻塞。
- 回归测试：非星标用户对私有 active / archived / 未知 slug → 404；星标用户对 archived → 200（N9）。

### F3 [MEDIUM] 批量 body 无上限 — ✅ 闭合
- 修复：models.py:617 — entry_ids: list[int] = Field(..., min_length=1, max_length=500)。
- 边界核对：500 < SQLite 999 变量上限；limiter 已有（stars.py:33）。
- 回归测试：501 → 422；空 → 422。

### F4 [LOW] /api/v1/stars 限速 — ✅ 闭合
- api/stars.py:15（GET）+ :33（DELETE）均加 @limiter.shared_limit。

## 4. F5-F8 处理确认

| # | 处理 | 核实 |
|---|------|------|
| F5 | 遗留 DEBT（文档化） | list_starred 仍全量载入 + 内存过滤分页；per_page ≤ 100 封顶；username N+1 已修复（INFO-6 批量 :275-287）。已记录。 |
| F6 | 文档化 | admin_service.py:339-341 注释明确 TOCTOU 窗口 + 缓解（_delete_with_tombstone 同事务重读活星标建墓碑绑定，数据以墓碑卡片保留不丢失）。 |
| F7 | 已修复（超预期） | 孤儿星标清扫双兜底：admin cleanup（admin_service.py:329-334）+ cleanup_orphan_tombstones（star_service.py:316-321）；star() 服务层 entry 存在性校验（:125-126，CRITICAL-2 Fix C）。 |
| F8 | 已修复 | entry_service.py:569-592：当前页 entry_ids 批量 GROUP BY 取 star_count + 批量取 starred_ids（每行 3 查询 → 每页 ~3）。 |

## 5. 新安全问题核查

- has_star 按 current_user.id 作用域，无越权。
- 孤儿清扫静态 SQL 无用户输入拼接，无注入。
- 新增批量查询全部有界（per_page ≤ 100 / entry_ids ≤ 500）。
- 无新端点、无新凭据、无日志泄露；limiter 覆盖全部新写路径。
- 结论：未引入新安全问题。

## 6. 遗留（不阻塞）

- LOW-1：list_starred 全量载入 DEBT（F5，已文档化）。
- LOW-2：DELETE /star 未知 vs 不可读 slug 微计时差（信息级）。
- 正面确认：F1-F4 全部闭合，F5-F8 处理完毕，无新问题，建议发布。
