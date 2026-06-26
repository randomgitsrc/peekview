---
phase: P7
task_id: T022-diagram-renderer-refactor
type: dispatch-context
parent: P6-acceptance.md
trace_id: T022-P7-dispatch-20260626
created: 2026-06-26
---

# P7 一致性检查 — 派发上下文

## 任务信息
- 任务：T022-diagram-renderer-refactor
- 当前阶段：P7（实现 vs 设计 一致性检查）
- 主 Agent 已查证的信息如下，subagent 无需重复查证。

## P6 已通过的验收结果
- 29/29 BDD PASS
- vision-helper blocker_count = 0
- 关键证据图：`/tmp/peekview-debug/p6-screenshots/06-theme-switched.png`

## P2 设计的量化目标（来自 P2-design.md 第 1.1 节）
| 文件 | 行数目标 | 实际（已知） |
|------|---------|------------|
| BaseDiagram.vue | < 400 | **531 行**（超目标 131 行）|
| MermaidDiagram.vue | < 150 | 77 行 ✅ |
| PlantUmlDiagram.vue | < 150 | 69 行 ✅ |
| SvgDiagram.vue | < 150 | 57 行 ✅ |
| useCodeBlockRenderer.ts | < 200 | 162 行 ✅ |
| useMarkdown.ts | ~300 | 297 行 ✅ |
| MarkdownViewer.vue 脚本 | < 300 | 236 行 ✅ |

## 关键架构决策（来自 P2-design.md）
1. **目录组织**：新建 `src/components/diagrams/` 子目录承载基类+三薄包装
2. **数据流**：markdown → useMarkdown → 占位符 → DOMPurify → v-html → 挂载组件
3. **composable**：useCodeBlockRenderer 持有 cache/sourcesMap/renderToken/instances
4. **emit 迁移**：去掉 data-action 字符串协议，子组件用标准 Vue emit
5. **行为保真 9 维度**：渲染输出/按钮交互/状态/性能/安全/响应式/主题/CSP/错误处理
6. **I3 差异矩阵**：15 case emit handler 分族差异必须保留（plantuml 无 refresh/无 toggle-text/无 Copied）

## 一致性检查需关注的偏差
- **BaseDiagram.vue 531 行 vs 目标 <400**：可能包含 P2 设计未列的额外功能（refresh 类、touch handler 等），需要 subagent 判断是 [DEVIATION]/[EXTENSION]/[OK]
- **P2 第 2 节** 列了 `data-block-id/data-mode` 属性、`is-active` 切换机制：subagent 应确认 DOM 实际包含这些属性
- **P2 第 5 节** useMarkdown 注册模式：subagent 应确认 `rendererRegistry.get(lang)` 查表路由真实存在（不是 if-else 三分支）
- **P2 第 6 节** MarkdownViewer emit handler：subagent 应确认已去掉 data-action 字符串协议 + closest()，改用 emit('event-name')

## P6 BDD 行为保真事实
- mermaid/svg/plantuml 三族共存 OK
- 9 维度行为全部 PASS
- 无僵尸 BDD（无 DEVIATION 触发）

## 一致性检查执行约束
- subagent 仅读取 `docs/tasks/T022-diagram-renderer-refactor/P2-design.md` + 实际代码 + P6-acceptance.md
- 不要重跑测试或截图（已在 P5/P6 完成）
- 输出文件：`docs/tasks/T022-diagram-renderer-refactor/P7-consistency.md`
- 偏差必须用 `[BLOCKER]` / `[DEVIATION]` / `[EXTENSION]` / `[OK]` 标记
- 不允许使用中间态；任何偏差明确分类

## 环境
- 前端目录：`frontend-v3/`
- 关键文件：
  - `frontend-v3/src/components/MarkdownViewer.vue`
  - `frontend-v3/src/components/diagrams/BaseDiagram.vue`
  - `frontend-v3/src/components/diagrams/{Mermaid,PlantUml,Svg}Diagram.vue`
  - `frontend-v3/src/composables/useCodeBlockRenderer.ts`
  - `frontend-v3/src/composables/useMarkdown.ts`