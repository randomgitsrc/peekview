---
phase: P7
task_id: T051
task_name: T051 entry-lifecycle-gaps
type: consistency
agent: main
parent: P6-acceptance.md
trace_id: T051-P7-20260709
status: approved
created: 2026-07-09
---

# T051 P7 一致性检查

## 1. DESIGN_GAP 配对

P4-progress.md 中有一条 DESIGN_GAP：

> [DESIGN_GAP] P2 使用 try/except/pass，ruff SIM105 建议 contextlib.suppress；保持与 P2 一致

[DESIGN_GAP_REVIEWED] 这是 ruff lint 建议（非功能性偏差），P4 选择遵循 P2 设计意图保持 try/except/pass，合理。无需修复。✅

P4 无其他 DESIGN_GAP 标记。完整配对。

## 2. SCOPE+ 闭环

全阶段无 SCOPE_PLUS 标记 → 无需 SCOPE_RESOLVED。✅

## 3. 跨文件一致性检查

### 3.1 P1 BDD 数量 vs P6 验收数量

| 文件 | 计数方式 | 数量 |
|------|---------|------|
| P1-requirements.md | `**A-AC1:**` ~ `**D-AC4:**` | 18 |
| P6-acceptance.md | `- PASS` 行 | 18 |

匹配。✅

### 3.2 P2 方案 vs P4 实现一致性

| P2 选型 | P4 实现 | 一致？ |
|---------|---------|-------|
| A1: lifespan asyncio.Task | `lifespan()` 中 `asyncio.create_task(cleanup_loop())` | ✅ |
| B1: 三个 tab (All/Mine/Archived) | EntryListView.vue `showTabs` computed + setFilter() | ✅ |
| C1: 独立警告 banner | 过期 amber banner, `isExpiredButActive` computed | ✅ |
| D1: 双行 header | `.header-meta-row` + `.header-actions-row` | ✅ |

### 3.3 P2 packages vs 实际改动范围

P2 声明：`packages: [peekview]`（后端）+ frontend domain

- 后端：`main.py` lifespan cleanup_loop + `test_lifespan_cleanup.py` ✅
- 前端：`EntryListView.vue`, `EntryDetailView.vue`, `EntryCard.vue`, `EntryListRow.vue`, `BaseBadge.vue`, `expires.ts`, `variables.css`, `layout.css`, `searchUrl.logic.ts` ✅
- MCP Server：无改动 ✅

一致。✅

### 3.4 P3 测试 vs P4 代码覆盖

- P3 声明 56 个测试用例
- 后端测试 11 (`test_lifespan_cleanup.py`)，前端测试 5 (vitest) — 后端 + 前端 vitest 共 789+818=1607 全绿
- P5 unit.md 确认所有测试通过 ✅

### 3.5 产出文件 agent 字段

| 文件 | agent | 
|------|-------|
| P1-requirements.md | analyst ✅ |
| P2-design.md | architect ✅ |
| P3-test-cases.md | test-designer ✅ |
| P5-test-results/unit.md | main ✅ |
| P6-acceptance.md | verifier ✅ |

> 注：P4 产出是代码文件（非 .md），不在 Header 检查范围内。P4-progress.md 为留痕文件，无 agent 字段要求。

### 3.6 CHANGELOG.md 一致性

CHANGELOG.md [Unreleased] 已有 T051 条目，涵盖所有缺口分类。✅

## 4. 未决项清零

| 标记类型 | 搜索结果 | 结论 |
|---------|---------|------|
| `[BLOCKER]` | 0 处 | ✅ |
| `[DEVIATION-CRITICAL]` | 0 处 | ✅ |
| `[NEED_CONFIRM]` | 仅出现在 P1/P6 dispatch-context 中的模板引用（非实际标记）| ✅ |

## 5. P6 证据完整性

- 18/18 BDD PASS, 0 FAIL ✅
- 每条 PASS 有证据引用 ✅
- 证据文件实际存在（15 张截图 + 2 日志）✅

## 检查结论

**PASS** — 所有一致性检查通过。无 BLOCKER/DEVIATION-CRITICAL。DESIGN_GAP 已 REVIEWED 配对。推进至 P8。
