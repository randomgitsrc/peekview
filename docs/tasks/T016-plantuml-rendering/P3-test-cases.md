---
phase: P3
task_id: T016
task_name: plantuml-rendering
type: test_cases
trace_id: T016-P3-2026-06-20
created: 2026-06-20
status: draft
parent: docs/tasks/T016-plantuml-rendering/P2-design.md
---

# P3 测试用例设计

## 测试文件

`frontend-v3/src/composables/__tests__/usePlantUML.spec.ts`

## stub 文件

`frontend-v3/src/composables/usePlantUML.ts`（接口骨架，P4 实现）

## 测试用例对照 BDD

| # | 用例 | BDD | 测什么 | 预期 |
|---|------|-----|--------|------|
| 1 | validateSource 有效源码 | BDD-1 | `@startuml\nA->B\n@enduml` | ok=true |
| 2 | validateSource 缺 @startuml | BDD-3 | `A->B\n@enduml` | ok=false, reason 含 startuml |
| 3 | validateSource 缺 @enduml | BDD-3 | `@startuml\nA->B` | ok=false, reason 含 enduml |
| 4 | validateSource 空字符串 | BDD-3 | `""` | ok=false |
| 5 | render 返回 SVG 字符串 | BDD-1 | 有效源码 + mock plantuml.js | 返回 string 含 `<svg` |
| 6 | render 语法错误 reject | BDD-3 | validateSource 失败的源码 | Promise reject |
| 7 | render 超时 reject | BDD-4 | mock plantuml.js 不响应 | 5s 后 reject |
| 8 | render 串行队列排队 | BDD-7 | 并发3次调用 | 按顺序执行，不并发 |
| 9 | ensureLoaded 首次加载 | BDD-5 | 首次调用 | 触发脚本注入 |
| 10 | ensureLoaded 不重复加载 | BDD-5 | 重复调用 | 不重复触发 |

## TDD 红灯验证

```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/usePlantUML.spec.ts
```

stub 全部 `throw new Error('not implemented')`，测试为 assertion failure / rejected promise = 正确红灯。
