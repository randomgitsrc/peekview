---
phase: P1
task_id: T018
task_name: plantuml-start-markers
type: requirements
trace_id: T018-P1-2026-06-21
created: 2026-06-21
status: draft
parent: docs/tasks/T018-plantuml-start-markers/P0-brief.md
---

# T018 P1: 需求基线

## 任务概述

将 `frontend-v3/src/composables/usePlantUML.ts` 的 `validateSource()` 起止标记从硬编码 `@startuml`/`@enduml` 通用化为 `@start\w+`/`@end\w+` 模式，解除对 mindmap/gantt/nwdiag 等 17+ 种 PlantUML 图类型的前端验证拦截。

## domains

- `frontend`（纯前端 composable 改动，无后端/MCP/UI 组件变更）

## packages

- `frontend-v3`

## ui_affected

- `false`（仅改 `validateSource()` 验证器逻辑，无模板/样式/组件结构改动）

## 裁剪说明

遵循 P0 `pruning_tendency: 偏裁剪`：

- **跳 P2**：方案明确（正则 `@start\w+`/`@end\w+` 替换），P0 已含完整设计与风险论证，无需独立方案文档
- **跳 P7**：单文件单函数约 10 行改动，无多文件一致性风险
- **保留 P3**：TDD，为新图类型行为写测试（mindmap/gantt/nwdiag 通过 validation）
- **保留 P4**：代码实现
- **保留 P5**：pytest/vitest 全绿 + 测试隔离
- **保留 P6**：Playwright 实跑确认 mindmap/gantt/nwdiag 真实渲染出 SVG（T016 教训：不信 unit test）
- **保留 P8**：frontend-v3 版本 bump + CHANGELOG

执行阶段链：`[P1, P3, P4, P5, P6, P8]`（与 P0 `phase_hint` 一致）

## BDD 验收条件

### BDD-1: @startmindmap/@endmindmap 通过验证
- **Given** `validateSource` 接收 `'@startmindmap\n+ foo\n@endmindmap'`
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: true }`

### BDD-2: @startgantt/@endgantt 通过验证
- **Given** `validateSource` 接收 `'@startgantt\n[Task] lasts 5 days\n@endgantt'`
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: true }`

### BDD-3: @startnwdiag/@endnwdiag 通过验证
- **Given** `validateSource` 接收 `'@startnwdiag\nnetwork foo {}\n@endnwdiag'`
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: true }`

### BDD-4: @startuml/@enduml 向后兼容不回归
- **Given** `validateSource` 接收 `'@startuml\nA -> B\n@enduml'`
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: true }`

### BDD-5: 非法输入（无 @start*）仍拒绝
- **Given** `validateSource` 接收 `'not plantuml content'`（无任何 `@start\w+`）
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: false }`，且 `reason` 字符串包含 `'start'`（通用化后 reason 从 `'missing @startuml'` 变为类似 `'missing @start'`）

### BDD-6: 起止数量不配对仍拒绝
- **Given** `validateSource` 接收 `'@startuml\nA -> B'`（有 `@start*` 但无 `@end*`，start/end 计数不等）
- **When** 调用 `validateSource(code)`
- **Then** 返回 `{ ok: false }`，且 `reason` 字符串包含 `'end'`
- **注**：按 P0 风险3 设计，验证器只校验 start/end 总数相等，不校验类型配对（`@startmindmap` + `@enduml` 数量相等会通过）。本条仅覆盖「数量不配对」情形。

### BDD-7（可选，P6 实跑）: Playwright 确认真实渲染
- **Given** debug backend 运行（`make debug-start`，127.0.0.1:8888）+ Playwright CDP（127.0.0.1:18800）已连接
- **When** 加载包含 mindmap/gantt/nwdiag 三种图类型的 entry 页面
- **Then** `page.on('console')` 抓不到 `'PlantUML source invalid: missing @startuml'` 错误，且三个对应 mountPoint 各自包含至少一个 `<svg>` 元素

## gate_commands

### P3/P5 单元测试 gate
```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/usePlantUML.spec.ts
```

### P5 构建gate
```bash
cd frontend-v3 && npm run build
```

### P6 Playwright 实跑 gate
```bash
make debug-start
# Playwright CDP 脚本：
#   1. 连接 127.0.0.1:18800
#   2. 打开含 mindmap/gantt/nwdiag 的 entry URL
#   3. page.on('console') 抓 'PlantUML source invalid' → 应为 0 条
#   4. 三个 mountPoint 各 querySelector('svg') → 应非 null
make debug-stop
```

## 隐含依赖检查

### [SCOPE+] 现有测试断言绑定具体标记名

**发现**：`frontend-v3/src/composables/__tests__/usePlantUML.spec.ts` 现有两处断言绑定具体标记名：

- 第 14 行：`expect(result.reason).toContain('startuml')`（"缺少 @startuml 拒绝" 用例）
- 第 20 行：`expect(result.reason).toContain('enduml')`（"缺少 @enduml 拒绝" 用例）

**影响**：通用化后 `reason` 字符串将从 `'missing @startuml'`/`'missing @enduml'` 变为类似 `'missing @start'`/`'missing @end'`（具体措辞由 P4 实现决定）。上述两处断言会失败。

**处理**：P3 阶段必须同步更新这两处断言（改为 `toContain('start')`/`toContain('end')` 或与 P4 实现一致的措辞）。P0 未提及此隐含依赖，P1 增补进基线。

**定向回补**：仅扩展测试断言措辞，不重跑 P1。

### 其他隐含依赖

- 无后端/MCP/数据库依赖
- 无 package.json 依赖变更（不引入新库）
- 无 vendor 资源变更（plantuml.js 已在 T016 vendored，支持这些图类型）
- 无 CSP/路由/构建配置变更

## 能力缺口检测

| 能力 | 状态 | 说明 |
|------|------|------|
| Playwright CDP 验证 | available | T016/T017 已验证可用，env_constraints 已给 `playwright_cdp: 127.0.0.1:18800` |
| plantuml.js 库能力 | available | T016 已 vendored，源码注册了 `mindmapDiagram`/`ganttDiagram`/`nwdiagDiagram` |
| vitest 测试框架 | available | 现有 `usePlantUML.spec.ts` 已用 vitest，可直接扩展 |
| debug backend | available | `make debug-start` 提供 127.0.0.1:8888 隔离环境 |

**结论**：无 [CAPABILITY_GAP]，可直接进入 P3。

## 标记汇总

### [SCOPE+] 现有测试断言需同步更新
- 位置：`frontend-v3/src/composables/__tests__/usePlantUML.spec.ts:14` 和 `:20`
- 详情见上文「隐含依赖检查」节
- 已增补进 P1 基线，P3 阶段处理

### [NEED_CONFIRM] BDD-6 语义与 P0 风险3 的潜在冲突
- **用户 P1 指令原文**：BDD-6「起止不配对仍拒绝（如 @startuml 但 @endfoo）」
- **P0 风险3 设计**：「原代码 start/end 独立计数不配对检查已能覆盖此情况——只要 start 总数 == end 总数即可，**类型不必配对**」
- **冲突点**：`@startuml` + `@endfoo` 是「类型不配对但数量配对」（1 start + 1 end）。按 P0 设计会**通过**验证；按用户 BDD-6 字面应**拒绝**。
- **P1 处理**：本基线 BDD-6 采用 P0 设计（数量不配对才拒绝），把例子改为「有 @start* 但无 @end*」。
- **需主 Agent 确认**：是否接受 P0 风险3 的「类型不必配对」简化？若要求类型严格配对（`@startX` 必须配 `@endX`），则 P3/P4 需额外实现类型配对校验逻辑，P0 风险3 需同步修订。
- **默认倾向**：按 P0 执行（不配对校验类型），因为：(1) P0 是主 Agent 亲自写的设计决策；(2) 类型配对校验增加复杂度且收益低（plantuml.js 库本身会拒绝不支持的图类型）；(3) 风险3 已论证嵌套场景不受影响。

## 验收标准映射

| P0 验收标准 | 对应 BDD |
|------------|----------|
| 1. `@startmindmap/.../@endmindmap` → `{ok: true}` | BDD-1 |
| 2. `@startgantt/.../@endgantt` → `{ok: true}` | BDD-2 |
| 3. `@startnwdiag/.../@endnwdiag` → `{ok: true}` | BDD-3 |
| 4. `@startuml/.../@enduml` 不回归 | BDD-4 |
| 5. `not plantuml` 仍 `{ok: false}` | BDD-5 |
| 6. Playwright 实测 8/9/10 渲染 SVG | BDD-7 |

P0 验收标准 6 条全部被 BDD 覆盖，无遗漏。
