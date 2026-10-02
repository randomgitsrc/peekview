# Lessons Learned

> 沉淀各任务的关键教训。字段：类别 / 教训 / 来源任务 / 日期。

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 测试 | **任务新增的测试文件必须进同一 lint 面**。P3 新增的 2 个测试文件含 3 处 F401 + 1 处 I001，P4 自查只跑 `ruff check peekview/`、`gate_commands` 无 lint key，导致 4 项 lint 错误全程未被 gate 捕获，直到 P8 才发现 `make lint` 红灯。任务新增测试文件须纳入 `ruff check peekview/ tests/`（或把 lint 纳入 gate_commands）。 | TPV0101 | 2026-10-03 |
| 架构 | **依赖"上游推断"的列类型是隐性契约，应显式化**。裸 `datetime` 的存储语义随 sqlmodel 版本从 naive 变为 tz-aware，属上游可随时改动的推断行为。显式 `sa_column=Column(DateTime(timezone=False))` + 可机械校验的依赖上限守卫，是跨版本稳定且可静态核验的正解；守卫须"注入漂移可变红"，否则形同虚设。 | TPV0101 | 2026-10-03 |
| 流程 | **本地与 CI 双环境全量必须都跑**。本任务根因正是「本地 0.0.38 全绿但 CI 拉到 0.0.47 后 38 failed + 502 errors」——单靠本地全绿会掩盖依赖漂移缺陷。修复验证须在本地版本与 CI 等价隔离版本上各跑一次全量。 | TPV0101 | 2026-10-03 |
