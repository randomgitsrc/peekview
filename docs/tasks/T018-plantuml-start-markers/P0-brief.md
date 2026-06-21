---
phase: P0
task_id: T018
task_name: plantuml-start-markers
type: brief
trace_id: T018-P0-2026-06-21
created: 2026-06-21
status: ready
parent: docs/tasks/T017-theme-media-query-fix/P8-release.md
---

# T018: PlantUML 起止标记通用化

## 任务一句话

`usePlantUML.ts` 的 `validateSource()` 只认 `@startuml`/`@enduml`，导致 `@startmindmap`/`@startgantt`/`@startnwdiag` 等非 UML 图类型被挡在门外；改为通用 `@start\w+`/`@end\w+` 模式即可修复。

## 触发原因

用户报告 PlantUML 综合示例中第 8/9/10 个图（mindmap/gantt/nwdiag）不渲染。主 Agent Playwright 实测确认：
- console 3 条 `PlantUML source invalid: missing @startuml` 错误
- mountPoint 空白，无 SVG
- plantuml.js 库本身支持这些图类型（源码有 `mindmapDiagram`/`ganttDiagram`/`nwdiagDiagram` 注册）
- 纯前端验证器误杀，库能渲染但被前置验证拦截

## 根因

`frontend-v3/src/composables/usePlantUML.ts` 第 24-29 行：

```typescript
const startumlCount = (trimmed.match(/^@startuml(\s|$|\()/gm) || []).length
const endumlCount = (trimmed.match(/^@enduml\s*$/gm) || []).length

if (startumlCount === 0) return { ok: false, reason: 'missing @startuml' }
if (endumlCount === 0) return { ok: false, reason: 'missing @enduml' }
if (startumlCount !== endumlCount) return { ok: false, reason: 'unbalanced @startuml/@enduml' }
```

只认 `@startuml`，不认其他 17+ 种 PlantUML 起止标记。

## 已知风险

- **风险 1（低）**：通用化后可能放过一些非 PlantUML 内容（如用户误标 `plantuml` 代码块但内容是 `@startfoo`）。影响小——plantuml.js 库本身会抛 "Unsupported diagram type"，渲染失败显示错误提示，不会崩溃。
- **风险 2（低）**：PlantUML 支持嵌套（`@startuml` 内含 `@startsub`），但 `\w+` 匹配不会误判嵌套——`@startsub` 不在行首独立出现。已确认。
- **风险 3（极低）**：起止标记不配对（如 `@startmindmap` + `@enduml`）。原代码 start/end 独立计数不配对检查已能覆盖此情况——只要 start 总数 == end 总数即可，类型不必配对。

## executor_env

```yaml
platform: opencode
has_task_tool: true
has_local_runtime: true
network: full
```

## env_constraints

```yaml
debug_env:
  start: make debug-start  # 127.0.0.1:8888, /tmp/peekview-debug/
  stop: make debug-stop
  test_entry_create: peekview --debug-mode create /path/to/file.md
  playwright_cdp: 127.0.0.1:18800
  verify_console_errors: Playwright page.on('console') 抓 'PlantUML render failed'
```

## pruning_tendency

**偏裁剪**，理由：

1. **改动范围极小**：1 个函数约 10 行，单文件单点修改
2. **方案明确**：正则 `@start\w+`/`@end\w+` 已通过 plantuml.js 源码交叉验证（库内部用 `^[@\\]start[^%s{}%g]+` 识别，我们用更宽松的 `\w+` 即可）
3. **已有 T016 测试基础**：T016 已有 plantuml 渲染测试，可复用
4. **BDD 验收条件清晰**：mindmap/gantt/nwdiag 三种类型能渲染出 SVG

建议裁剪：
- **P2 跳过**：方案明确，正则替换无需设计文档
- **P3 保留**：TDD，为新行为写测试（验证 `@startmindmap` 通过 validation）
- **P6 保留**：Playwright 实跑确认 mindmap/gantt/nwdiag 真实渲染出 SVG（这是 T016 的教训——不能只信 unit test）
- **P7 跳过**：单文件改动无多文件一致性风险

## phase_hint

[P1, P3, P4, P5, P6, P8]

## 验收标准（预填，P1 细化）

1. `validateSource('@startmindmap\n+ foo\n@endmindmap')` 返回 `{ok: true}`
2. `validateSource('@startgantt\n[Task] lasts 5 days\n@endgantt')` 返回 `{ok: true}`
3. `validateSource('@startnwdiag\nnetwork foo {}\n@endnwdiag')` 返回 `{ok: true}`
4. `validateSource('@startuml\nA -> B\n@enduml')` 仍然 `{ok: true}`（不回归）
5. `validateSource('not plantuml')` 仍然 `{ok: false}`（不误放）
6. Playwright 实测：用户原始 10 图示例中 8/9/10 能渲染出 SVG
