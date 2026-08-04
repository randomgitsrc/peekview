---
phase: P7
task_id: T078-read-tracking-hardening
type: consistency
parent: P6-acceptance.md
trace_id: T078-P7-20260803
status: approved
created: 2026-08-03
agent: consistency-reviewer
---

# P7 一致性检查 — T078 read-tracking-hardening

## 审查结论汇总

| # | 检查项 | 结论 |
|---|--------|------|
| C1 | DESIGN_GAP 配对 | N/A（无 DESIGN_GAP 声明） |
| C2 | SCOPE+ 闭环 | PASS（无 SCOPE+ 增补，P1 有 [NO_NEED_CONFIRM]） |
| C3 | packages 一致性 | PASS |
| C4 | BDD 覆盖一致性 | PASS（P1 34 条 → P3 34 测试 → P6 34 PASS） |
| C5 | gate_commands 一致性 | PASS |
| C6 | 跨文件设计一致性 | PASS |
| C7 | 未决项清零 | PASS |

## 逐项审查

### C1: DESIGN_GAP 配对

P4-implementation.md 中无 `[DESIGN_GAP:` 声明。P2-design.md 中无 `[DESIGN_GAP:` 声明。

**声明**：本任务无 DESIGN_GAP，无需配对 REVIEWED 标记。

### C2: SCOPE+ 闭环

P1-requirements.md 无 `[SCOPE+]` / `[SCOPE_RESOLVED]` 标记——任务范围在 P0-brief 阶段已明确，P1 分析未产生范围增补。

P1 §5 待确认清单标记为 `[NO_NEED_CONFIRM]`，所有关键质疑点（Q1-Q6）已在 P1 §3 逐条回答并经代码审计确认。

**结论**：SCOPE+ 闭环——无增补需闭环。

### C3: packages 一致性

**P1§7 packages**（文件级列表）：
```
backend/peekview/services/read_tracking_service.py
backend/peekview/services/admin_service.py
backend/peekview/services/entry_service.py
backend/peekview/api/_shared.py
backend/peekview/api/entries.py
backend/peekview/api/files.py
backend/peekview/models.py
backend/peekview/database.py
backend/peekview/config.py
backend/tests/test_read_tracking.py
backend/tests/test_admin_stats_cleanup.py
backend/tests/test_admin_backup.py
```

**P2§0 packages**：`backend # 单一包（peekview pip 包），无 MCP/frontend 改动`

**P4 改动文件清单**：
```
models.py, config.py, read_tracking_service.py, api/_shared.py,
api/entries.py, api/files.py, database.py, main.py,
services/admin_service.py, services/entry_service.py(无改动),
tests/test_read_tracking_hardening.py
```

**交叉核对**：

| P1 列出的文件 | P2 设计覆盖 | P4 实际改动 | 一致？ |
|--------------|------------|------------|--------|
| read_tracking_service.py | §3.1/3.3/3.4/3.9 | ✓ 改动 | ✓ |
| admin_service.py | §3.10/3.12/3.13 | ✓ 改动 | ✓ |
| entry_service.py | §3.11（确认无需改动） | ✓ 无改动 | ✓ |
| api/_shared.py | §3.6/3.7 | ✓ 改动 | ✓ |
| api/entries.py | §3.6 | ✓ 改动 | ✓ |
| api/files.py | §3.6 | ✓ 改动 | ✓ |
| models.py | §3.2/3.5/3.12 | ✓ 改动 | ✓ |
| database.py | §3.8 | ✓ 改动 | ✓ |
| config.py | §3.14 | ✓ 改动 | ✓ |
| tests/test_read_tracking.py | §3.15 | P3 新建独立文件 test_read_tracking_hardening.py | ✓（P3 设计决策1） |
| tests/test_admin_stats_cleanup.py | — | 未单独列出 | P3 决策新建独立文件 |
| tests/test_admin_backup.py | — | 未单独列出 | P3 决策新建独立文件 |

**额外文件**：P4 比 P1 多了 `main.py`（backfill_stats 调用位置），P2§3.9 已明确决策"调用位置在 main.py:create_app() 中"。一致。

**测试文件策略变更**：P1 列出修改现有测试文件，P3 设计决策1 改为新建独立文件 `test_read_tracking_hardening.py`。P2§2 影响域分析已同步更新为新建文件。一致。

**结论**：packages 一致。P1→P2→P4 文件清单吻合，差异（main.py、测试文件策略）均有设计文档说明。

### C4: BDD 覆盖一致性

**P1 BDD 数量**：34 条（BDD-01 ~ BDD-34，grep 确认 34 个唯一编号）
**P3 测试数量**：34 个测试方法（`grep -c "def test_bdd"` = 34）
**P6 PASS 数量**：34/34 PASS（P6§汇总 "34/34 PASS, 0 FAIL"）

**逐条映射核对**（抽样）：

| BDD | P1 验收条件 | P3 测试方法 | P6 验收结果 | 一致？ |
|-----|------------|------------|------------|--------|
| BDD-01 | window_key 含 action，read+download 不合并 | test_bdd_01_different_actions_same_minute_not_merged | PASS — 2 条记录 | ✓ |
| BDD-07 | admin stats 包含 discover | test_bdd_07_admin_stats_includes_discover | PASS — by_action 含 discover | ✓ |
| BDD-17 | 启动时回填 | test_bdd_17_backfill_on_startup_when_stats_empty | PASS — total_reads=3, by_source.unknown=3 | ✓ |
| BDD-25 | 删 entry 保留聚合行 | test_bdd_25_delete_entry_preserves_aggregation | PASS — 聚合行仍在 | ✓ |
| BDD-30 | total_count 含 self_read | test_bdd_30_total_count_includes_self_read | PASS — total_count=4 | ✓ |
| BDD-34 | other Referer | test_bdd_34_other_referer_source_other | PASS — source="other" | ✓ |

P6 全部 34 条 BDD 标记为 PASS，0 FAIL。P6 证据引用 `test-output.log`。

**结论**：BDD 覆盖一致——P1 34 条 → P3 34 测试 → P6 34 PASS，无遗漏无多余。

### C5: gate_commands 一致性

**P2§0 gate_commands**：
```yaml
P3: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=short"
P5: "cd backend && .venv/bin/python -m pytest tests/ -q --tb=no"
P5_e2e: null  # ui_affected: false
```

**P5 实际执行命令**（P5-test-results.md）：
```
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
```
exit code: 0, 1042 passed, 0 failed. ✓

**P6 实际执行命令**（P6-acceptance.md）：
```
cd backend && .venv/bin/python -m pytest tests/test_read_tracking_hardening.py -v --tb=short
```
34 passed, 0 failed. ✓（P6 用专项文件验证，符合验收惯例）

**结论**：gate_commands 一致。P5 用 P2 声明的命令，结果通过。

### C6: 跨文件设计一致性

#### C6.1 P2 方案设计 → P4 实现路径

| P2 设计要点 | P4 实现位置 | 一致？ |
|------------|------------|--------|
| §3.1 window_key 加 action | read_tracking_service.py:50 | ✓ |
| §3.2 EntryReadStats model | models.py:284 | ✓ |
| §3.3 record_read 写时更新 | read_tracking_service.py:79~116 | ✓ |
| §3.4 get_read_stats 改读聚合表 | read_tracking_service.py:120~140 | ✓ |
| §3.5 ReadStatsResponse 扩展 | models.py:298 | ✓ |
| §3.6 _detect_channel 提取 | _shared.py:22 | ✓ |
| §3.7 _classify_source | _shared.py:35 | ✓ |
| §3.8 EntryRead.source 列迁移 | database.py:150~157 | ✓ |
| §3.9 回填逻辑 | read_tracking_service.py:184~265 + main.py:222 | ✓ |
| §3.10 90 天清理 | admin_service.py:287~295 | ✓ |
| §3.11 _cleanup_reads 无改动 | entry_service.py:782（确认无 entry_read_stats 引用） | ✓ |
| §3.12 Admin stats reads 维度 | admin_service.py:174~214 | ✓ |
| §3.13 Restore merge 导入聚合表 | admin_service.py:870~898 | ✓ |
| §3.14 config reads_retention_days | config.py:216 | ✓ |
| §3.15 测试名修正 | P3 新建独立文件覆盖 | ✓（策略变更已在 P3 说明） |

#### C6.2 P2§3.8 model default vs migration DEFAULT 分离

P2 设计：model 层 `source` default 为 `"direct"`，migration SQL 用 `DEFAULT NULL`。

P4 实际：models.py:273 `source: str | None = Field(default=None, max_length=20)`

**偏差**：P2 设计说 model default 为 `"direct"`，但实际实现 model default 为 `None`。

**影响分析**：`_record_read_async` 在调用 `record_read` 时显式传 `source=_classify_source(...)`，不依赖 model default。新写入的记录 source 由 `_classify_source` 返回值决定（无 Referer → "direct"）。因此 model default 的实际值不影响运行时行为——`record_read` 总是收到显式 source 参数。

P4 实现说明（§_classify_source 实现细节）确认 source 来自 `_classify_source`，不依赖 model default。

**结论**：偏差存在但不影响行为正确性。model default 为 None 比 "direct" 更安全——如果未来有代码路径忘记传 source，None 会显式暴露问题而非静默填 "direct"。标记为 `[DESIGN_GAP_REVIEWED: P2§3.8 model default 偏差——P2 设计 "direct"，P4 实现 None。不影响运行时（source 始终由 _classify_source 显式传入）。已审查，可接受。]`

#### C6.3 P2 entries.py line 231 → P4 line 224

P2 设计说 entries.py line 231 `channel="api"` → `channel="share"`。P4 报告 line 224。实际代码 entries.py:224 `channel="share"`。行号差异因 P2 基于改动前代码、P4 基于改动后代码。语义一致。

#### C6.4 P2 files.py 三处 → P4

P2: line 188/232/432。P4: line 189/234/435。实际代码: 189/234/435。行号微偏（+1/+2/+3），语义一致——三处均改为 `_detect_channel(request, slug)`。

**结论**：跨文件设计一致。实现路径与 P2 方案设计吻合。

### C7: 未决项清零

全阶段产出文件扫描结果：

| 标记 | P1 | P2 | P3 | P4 | P5 | P6 |
|------|----|----|----|----|----|----|
| [NEED_CONFIRM] | 无 | 无 | 无 | 无 | 无 | 无（P6 报告 NEED_CONFIRM: 0） |
| [BLOCKER] | 无 | 无 | 无 | 无 | 无 | 无 |
| [DEVIATION-CRITICAL] | 无 | 无 | 无 | 无 | 无 | 无 |
| [NO_NEED_CONFIRM] | ✓ (P1:325) | — | — | — | — | ✓ (P6:113) |
| [PROD_NOT_TOUCHED] | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**结论**：未决项清零。无残留 BLOCKER / DEVIATION-CRITICAL / NEED_CONFIRM。[NO_NEED_CONFIRM] 在 P1 和 P6 配对存在。

## 实质锚点

| gate 断言 | 实质锚点 |
|-----------|---------|
| BLOCKER=0 | C1 无 DESIGN_GAP；C7 全阶段无 [BLOCKER] 标记 |
| CRITICAL=0 | C3 packages 交叉核对表（P1§7 ↔ P2§0 ↔ P4 清单）；C6.1 设计→实现映射表（P2§3.1~3.15 ↔ P4 实现位置） |
| SCOPE+ 闭环 | C2 无 SCOPE+ 增补，P1 [NO_NEED_CONFIRM] |

## 跨文件引用关键词

- `P1§7-packages`：packages 声明（文件级列表）
- `P2§0-packages`：packages 声明（单一包）
- `P2§3.1~3.15`：详细设计 15 个小节
- `P2§gate_commands`：gate 命令声明
- `P3§BDD→测试映射`：34 条 BDD 与测试方法 1:1 映射表
- `P4§改动文件清单`：11 个文件的改动 + BDD 覆盖
- `P5§执行结果`：1042 passed, 0 failed
- `P6§BDD 逐条验收`：34/34 PASS
- `P6§汇总`：34/34 PASS, 0 FAIL, NEED_CONFIRM: 0

## 结论

T078 read-tracking-hardening 任务的 P1-P6 产出跨文件一致性检查通过。

- 34 条 BDD 从 P1 需求 → P3 测试 → P6 验收完整闭环
- P2 方案设计 15 个小节全部在 P4 实现中落地
- packages 声明一致（单一 backend 包，无 MCP/frontend 改动）
- gate_commands 声明与实际执行一致
- 无 DESIGN_GAP 需配对（C6.2 偏差已审查并标记 DESIGN_GAP_REVIEWED）
- 无残留 BLOCKER / DEVIATION-CRITICAL / NEED_CONFIRM
- 全阶段 [PROD_NOT_TOUCHED]

status: approved
