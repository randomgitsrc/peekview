---
phase: P3
task_id: T020
parent: .state.yaml
trace_id: T020-P3-resolution-20260624
created: 2026-06-24
---

# PAUSED 恢复决策 — T020 P3

## PAUSED 原因
P3 test-designer（general subagent）2 次空返回。第 1 次整体派发（4 种异构产出），第 2 次拆分后 P3b（测试代码+stub）仍空返回。

## 根因分析
非测试范围问题，是派发失误——P3b prompt 导航不足。subagent 从零想怎么 mock canvas/DOMPurify/svg-pan-zoom，认知负荷过载。

## 恢复决策
不砍测试范围（选项 A 错误，违背项目现有测试模式）。改用：

1. **frontend 专项 subagent**（替代 general）——更擅长 Vue 组件测试
2. **精确导航**——明确指参照文件：
   - `HtmlViewer.spec.ts`（T019 P3 产物，495 行）作为 mount 模式参照：mount 组件 → 断言渲染输出/属性/class/trigger 事件
   - `usePlantUML.spec.ts` 作为外部依赖 stub 模式参照：用依赖注入（`_setPlantUmlRender`）替换外部引擎
3. **recovery_bonus=1**（P3 retry 耗尽 2/2，恢复后额外允许 1 次重试）

## 测试架构（遵循项目模式，不砍范围）
- DOMPurify 净化 → jsdom 里直接能跑，不 mock
- toggle 切换 → mount + trigger click（HtmlViewer 同款）
- PNG 导出 → `vi.spyOn(canvas, 'toBlob')`，不测真实像素
- svg-pan-zoom → `vi.mock('svg-pan-zoom')` 或依赖注入

## 恢复后动作
重派 P3b，prompt 含精确导航 + frontend subagent。成功后继续 P4-P8。
