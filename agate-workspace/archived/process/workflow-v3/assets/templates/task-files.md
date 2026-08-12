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
| P3 | P3-test-cases.md | 声明 `test_code_dir: {实际路径}` |
| P3 | {test_code_dir}/ | 测试代码目录（项目自定义，如 `backend/tests/`）|
| P4 | P4-implementation.md | 声明 `implementation_dir: {实际路径}` |
| P4 | {implementation_dir}/ | 代码目录（项目自定义，如 `backend/peekview/`）|
| P5 | P5-test-results/unit.md | 明确标注 `failed: N`（仅供参考，gate 以主 Agent 跑 pytest 为准）|
| P5 | P5-test-results/manual.md | — |
| P6 | P6-consistency.md | 无 `[BLOCKER]` 标记（门槛）|
| P7 | P7-release.md | — |

## 路径占位符

P3/P4 的代码路径由产出文件显式声明，不使用固定目录名：

- P3-test-cases.md 必须声明：`test_code_dir: backend/tests/`
- P4-implementation.md 必须声明：`implementation_dir: backend/peekview/`

派发 prompt 引用这些声明而非固定路径，避免模板硬编码项目特定路径。

## 门槛字段说明

主 Agent 不依赖 subagent 产出文件字段判定门槛，而是**亲自跑命令验证**：

- P2-review.md `status` → subagent 评审产出的结论
- P3 → 主 Agent 跑 `scripts/check-tdd-red.sh` 验证
- P5 → 主 Agent 跑 `pytest -q` 验证
- P6 → 主 Agent grep `[BLOCKER]` 验证
- P7 → 主 Agent 跑发布检查命令验证