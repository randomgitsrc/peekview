# 各阶段产出文件模板

> 每个任务目录 docs/tasks/{Txxx}/ 下的标准文件

## 通用 Header（所有文件必须有）
```yaml
---
phase: {P1-P7}
task_id: {Txxx}
type: {problems|design|review|test-cases|...}
parent: {上一阶段文件名，P1 时是外部需求来源}
trace_id: {Txxx}-{Pn}-{YYYYMMDD}
status: {draft|approved|rejected|done}
created: {YYYY-MM-DD}
---
```

## 各阶段文件清单
| 阶段 | 文件 | 关键 Header 字段 |
|------|------|-----------------|
| P1 | P1-problems.md | — |
| P1 | P1-test-strategy.md | — |
| P2 | P2-design.md | — |
| P2 | P2-review.md | **status: approved/rejected**（门槛）|
| P3 | P3-test-cases.md | — |
| P3 | P3-test-code/ | （测试代码目录）|
| P4 | P4-implementation/ | （代码目录）|
| P5 | P5-test-results/unit.md | **failed: N**（门槛）|
| P5 | P5-test-results/manual.md | — |
| P6 | P6-consistency.md | 无 [BLOCKER] 标记（门槛）|
| P7 | P7-release.md | — |

## 门槛字段说明
主 Agent 靠这些字段判定能否进入下一阶段：
- P2-review.md 的 `status` → approved 才能进 P3
- P5 unit.md 的 `failed` → 0 才能进 P6
- P6-consistency.md 有无 `[BLOCKER]` → 无才能进 P7
