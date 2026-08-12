---
phase: P3
task_id: T018
task_name: plantuml-start-markers
type: test_plan
trace_id: T018-P3-2026-06-21
created: 2026-06-21
status: red
parent: docs/tasks/T018-plantuml-start-markers/P1-requirements.md
---

# T018 P3: TDD 测试计划

## 目标

为 `validateSource()` 起止标记通用化（`@startuml`/`@enduml` → `@start\w+`/`@end\w+`）编写 TDD RED 阶段失败测试，覆盖 P1 BDD-1~BDD-6 全部场景。

## 测试文件

`frontend-v3/src/composables/__tests__/usePlantUML.spec.ts`

## 改动内容

### 1. [SCOPE+] 同步更新现有断言（2 处）

| 位置 | 改动前 | 改动后 |
|------|--------|--------|
| `:14` | `toContain('startuml')` | `toContain('start')` |
| `:20` | `toContain('enduml')` | `toContain('end')` |

**理由**：通用化后 `reason` 字符串从 `'missing @startuml'`/`'missing @enduml'` 变为 `'missing @start'`/`'missing @end'`（措辞由 P4 实现）。断言改为更宽松的 `'start'`/`'end'` 子串匹配，避免与 P4 实现强耦合。

### 2. 新增测试用例（6 条）

| 用例 | 覆盖 BDD | 期望状态（P3 RED） | 说明 |
|------|---------|------------------|------|
| `@startmindmap/@endmindmap 通过校验` | BDD-1 | **失败**（当前正则只认 `@startuml`，返回 `{ok:false, reason:'missing @startuml'}`） | 非解 UML 图类型入口 |
| `@startgantt/@endgantt 通过校验` | BDD-2 | **失败** | 同上 |
| `@startnwdiag/@endnwdiag 通过校验` | BDD-3 | **失败** | 同上 |
| `无 @start* 标记的纯文本拒绝` | BDD-5 | **失败**（当前 reason 为 `'missing @startuml'`，不含子串 `'start'`...实际上含，但 ok=false 正确；**校对**：`'missing @startuml'` 包含 `'start'`，此用例当前会通过） | 纯文本拒绝回归保护 |
| `有 @start* 但无 @end* 拒绝` | BDD-6 | **失败**（`@startmindmap` 不被识别为 start，`startumlCount=0` → 返回 `'missing @startuml'`，不含 `'end'`） | 起止不配对 |
| `@start* 数量多于 @end* 拒绝` | BDD-6 | **失败**（`@startmindmap` 不计入 start，1==1 配对通过） | 起止不配对 |
| `@startmindmap(filename) 带文件名参数通过校验` | 边界 | **失败** | PlantUML 支持文件名参数 |

> **BDD-4**（`@startuml` 不回归）已被现有「有效源码通过校验」用例覆盖，不重复。

## RED 阶段失败分析

执行 `npx vitest run src/composables/__tests__/usePlantUML.spec.ts` 后，预期以下用例失败（reason 与实际实现相关）：

- BDD-1/2/3（mindmap/gantt/nwdiag 通过校验）：当前 `startumlCount=0` → `{ok:false}`，期望 `{ok:true}` ❌
- BDD-5 的 `有 @start* 但无 @end* 拒绝`：`@startmindmap` 不被识别 → `startumlCount=0` → `reason='missing @startuml'`，断言 `toContain('end')` 失败 ❌
- BDD-6 的 `@start* 数量多于 @end* 拒绝`：第二个 `@startmindmap` 不被识别 → `startumlCount=1 == endumlCount=1` → `{ok:true}`，期望 `{ok:false}` ❌
- 边界（带文件名）：当前 `@startmindmap(...)` 不被识别 → `{ok:false}`，期望 `{ok:true}` ❌

现有用例（含 [SCOPE+] 修改后）应保持通过：
- 有效源码通过校验 ✅
- 缺少 @startuml 拒绝（断言 `toContain('start')`）✅（`'missing @startuml'` 含 `'start'`）
- 缺少 @enduml 拒绝（断言 `toContain('end')`）✅（`'missing @enduml'` 含 `'end'`）
- 空字符串拒绝 ✅
- `无 @start* 标记的纯文本拒绝`（BDD-5）：`'missing @startuml'` 含 `'start'`，且 `ok=false` ✅

## gate

```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/usePlantUML.spec.ts
```

P3 RED 阶段：应至少 5 个用例失败（BDD-1/2/3 + BDD-6 两个 + 边界 1 个 = 6 个失败，BDD-5 通过）。

P4 实现后转 GREEN：全部 11 个 validateSource 用例通过。

## 约束

- 只改测试文件，不改 `usePlantUML.ts`（P4 工作）
- 不运行测试（主 Agent 跑 `check-tdd-red.sh` 验证）
- 测试用例名使用中文，与现有风格一致
