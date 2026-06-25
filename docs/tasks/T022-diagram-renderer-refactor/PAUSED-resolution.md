---
phase: P3
task_id: T022-diagram-renderer-refactor
type: resolution
parent: P3-test-cases.md
trace_id: T022-P3-resolution-20260625
created: 2026-06-25
---

# PAUSED 恢复决策 — T022 P3

## 暂停原因
P3 测试代码 subagent 连续 3 轮空返回（组件测试 2 轮 + e2e 1 轮）。

## 人工决策（用户回复）
不降级主 Agent 亲自写。调整 subagent 派发策略：
1. 任务粒度拆得更细——每次 subagent 只做 3-4 个测试点（不是 12-14 个）
2. 给的上下文足够精准——主 Agent 先读参照文件，把"测试骨架代码"落盘成 dispatch-context.md，subagent 按骨架填空而非从零设计
3. 一次写不完可以写多次

## 恢复策略
- recovery_bonus: +1（PAUSED 因 retry 耗尽，恢复后 P3 允许额外重试）
- 调整：主 Agent 先读现有 e2e/组件测试参照文件，提取代码骨架落盘 P3-dispatch-context.md
- e2e 文件 7（8 测试点）拆为 2 个 subagent（各 4 点）
- 组件测试（文件 3-6）作为 P3 增强项，优先级低于 e2e（P3 gate 硬要求是红灯 + Playwright 用例存在，组件测试不阻塞 gate）

## gate 判定
- vitest 红灯：✅ P3b1 已满足（22 断言失败 0 collection error）
- Playwright 用例存在：⏳ 待补 e2e 文件
