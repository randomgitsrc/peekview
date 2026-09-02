---
task_id: TPV0095
generated_by: orchestrator (main)
---
# 维护性反模式登记

> **语义边界**：本文件登记**本次任务 diff 引入的**维护性反模式（god-file 跨越 / fuzzy-boundary
> 新增行），与 known-failures.md（登记预存失败）语义相反——这里登记的是"本任务自己造成的"问题。
> 登记 + 数量对齐 + P4 评审 approve 三者齐全才放行，登记本身不构成放行依据。
> 检测命令（P4 自查 / P6 非阻断复跑）：`python3 agate/scripts/check-maintainability.py $TASK_DIR`。

## 本次引入的反模式

| # | 文件 | 反模式类型 | 违规详情 | 理由 | P4 评审确认 |
|---|------|-----------|---------|------|------------|
| 1 | backend/peekview/models.py | god-file 跨越 | before=997 after=1153 threshold=1000 | TPV0095 新增 Team/TeamMember 表模型 + Entry.team_id + Team schemas（team 功能核心数据模型，天然集中）；P4 review-eng/cso 已审该文件无结构问题，拆分留待后续独立 refactor 任务（既有 T082 架构重构先例） | 是 |
| 2 | frontend-v3/src/views/__tests__/tpv0095-review-fix-entry-list.spec.ts:70 | fuzzy-boundary | matched pattern: :\s*any\b | P4 自检 spec（非 P3 文件）中 mock 回调参数类型标注 `: any`——测试脚手架宽松类型，非生产代码；production 代码 typecheck 全绿无 any | 是 |
