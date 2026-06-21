---
phase: P4
task_id: T018
task_name: plantuml-start-markers
type: implementation
trace_id: T018-P4-2026-06-21
created: 2026-06-21
status: done
parent: docs/tasks/T018-plantuml-start-markers/P1-requirements.md
---

# T018 P4: 实现笔记

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `frontend-v3/src/composables/usePlantUML.ts` | 修改 | `validateSource()` 起止标记通用化 |

## 改动行数

- **改动文件数**：1
- **改动函数**：`validateSource()`（第 20-32 行）
- **改动行数**：6 行（第 24-29 行）

### diff 摘要

```diff
- const startumlCount = (trimmed.match(/^@startuml(\s|$|\()/gm) || []).length
- const endumlCount = (trimmed.match(/^@enduml\s*$/gm) || []).length
+ const startCount = (trimmed.match(/^@start\w+(\s|$|\()/gm) || []).length
+ const endCount = (trimmed.match(/^@end\w+\s*$/gm) || []).length

- if (startumlCount === 0) return { ok: false, reason: 'missing @startuml' }
- if (endumlCount === 0) return { ok: false, reason: 'missing @enduml' }
- if (startumlCount !== endumlCount) return { ok: false, reason: 'unbalanced @startuml/@enduml' }
+ if (startCount === 0) return { ok: false, reason: 'missing @start' }
+ if (endCount === 0) return { ok: false, reason: 'missing @end' }
+ if (startCount !== endCount) return { ok: false, reason: 'unbalanced @start/@end' }
```

## 设计摘要

将 `validateSource()` 的起止标记正则从硬编码 `@startuml`/`@enduml` 通用化为 `@start\w+`/`@end\w+`，仅校验 start/end 总数配对（不校验类型配对），解除对 mindmap/gantt/nwdiag 等 17+ 种 PlantUML 图类型的前端验证拦截。

## 实现要点

1. **正则通用化**：`@start\w+` 匹配 `@startuml`/`@startmindmap`/`@startgantt`/`@startnwdiag` 等所有 PlantUML 图类型起止标记
2. **保留后缀 `(\s|$|\()`**：支持 `@startmindmap(filename)` 带文件名参数的形式（BDD 衍生用例）
3. **reason 措辞软化**：从 `'missing @startuml'`/`'missing @enduml'` 改为 `'missing @start'`/`'missing @end'`，与 P3 已软化的 `toContain('start')`/`toContain('end')` 断言一致
4. **不校验类型配对**：按 P0 风险3 + P1 主 Agent [NEED_CONFIRM] 决策，只校验 start/end 总数相等。`@startuml` + `@endfoo` 数量相等会通过验证（plantuml.js 库自身会拒绝不支持的类型）

## 预期测试转 GREEN 的用例

P3 阶段新增的 6 个 RED 用例，P4 实现后全部转 GREEN：

| # | 用例 | 对应 BDD |
|---|------|----------|
| 1 | `@startmindmap/@endmindmap 通过校验` | BDD-1 |
| 2 | `@startgantt/@endgantt 通过校验` | BDD-2 |
| 3 | `@startnwdiag/@endnwdiag 通过校验` | BDD-3 |
| 4 | `有 @start* 但无 @end* 拒绝` | BDD-6 |
| 5 | `@start* 数量多于 @end* 拒绝` | BDD-6 衍生 |
| 6 | `@startmindmap(filename) 带文件名参数通过校验` | BDD-1 衍生 |

## 验证结果

- **单元测试 gate**：`npx vitest run src/composables/__tests__/usePlantUML.spec.ts` → 17/17 passed（含原 11 用例 + P3 新增 6 用例）
- **构建 gate**：`npm run build` → 通过（见 P5 验证）
