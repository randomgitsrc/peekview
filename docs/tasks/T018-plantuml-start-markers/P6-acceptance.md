---
phase: P6
task_id: T018
task_name: plantuml-start-markers
type: acceptance
trace_id: T018-P6-2026-06-21
created: 2026-06-21
status: pass
parent: docs/tasks/T018-plantuml-start-markers/P1-requirements.md
---

# P6 BDD 验收报告：PlantUML 起止标记通用化

## 验证环境

- Debug server: http://127.0.0.1:8888（`make debug-start`，数据目录 `/tmp/peekview-debug/`）
- Playwright CDP: 127.0.0.1:18800 + vision 截图分析
- 前端单元测试：`frontend-v3` vitest（`usePlantUML.spec.ts`）
- 测试 entry：用户原始 10 图示例（slug: `m4i7rb`），含时序/类/组件/活动/状态/部署/用例 7 种 UML 图 + mindmap/gantt/nwdiag 3 种非 UML 图

---

## 1. 验收总结

**结果：PASS — 7/7 BDD 全部通过**

| BDD | 名称 | 验证方式 | 状态 |
|-----|------|----------|------|
| BDD-1 | `@startmindmap/@endmindmap` 通过验证 | P5 单元测试 | ✅ |
| BDD-2 | `@startgantt/@endgantt` 通过验证 | P5 单元测试 | ✅ |
| BDD-3 | `@startnwdiag/@endnwdiag` 通过验证 | P5 单元测试 | ✅ |
| BDD-4 | `@startuml/@enduml` 向后兼容不回归 | P6 Playwright DOM | ✅ |
| BDD-5 | 非法输入（无 @start*）仍拒绝 | P5 单元测试 | ✅ |
| BDD-6 | 起止数量不配对仍拒绝 | P5 单元测试 | ✅ |
| BDD-7 | Playwright 确认真实渲染 | P6 Playwright DOM + vision | ✅ |

---

## 2. 逐条 BDD 验收结果

### BDD-1 @startmindmap/@endmindmap 通过验证

- **验证方式**：P5 单元测试
- **状态**：✅ 通过
- **证据**：`usePlantUML.spec.ts` 用例 #1 `@startmindmap/@endmindmap 通过校验` PASS
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'@startmindmap\n+ foo\n@endmindmap'` ✅
  - When 调用 `validateSource(code)` ✅
  - Then 返回 `{ ok: true }` ✅

### BDD-2 @startgantt/@endgantt 通过验证

- **验证方式**：P5 单元测试
- **状态**：✅ 通过
- **证据**：`usePlantUML.spec.ts` 用例 #2 `@startgantt/@endgantt 通过校验` PASS
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'@startgantt\n[Task] lasts 5 days\n@endgantt'` ✅
  - When 调用 `validateSource(code)` ✅
  - Then 返回 `{ ok: true }` ✅

### BDD-3 @startnwdiag/@endnwdiag 通过验证

- **验证方式**：P5 单元测试
- **状态**：✅ 通过
- **证据**：`usePlantUML.spec.ts` 用例 #3 `@startnwdiag/@endnwdiag 通过校验` PASS
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'@startnwdiag\nnetwork foo {}\n@endnwdiag'` ✅
  - When 调用 `validateSource(code)` ✅
  - Then 返回 `{ ok: true }` ✅

### BDD-4 @startuml/@enduml 向后兼容不回归

- **验证方式**：P6 Playwright DOM 检查（用户原始 10 图示例）
- **状态**：✅ 通过
- **证据**：
  - Block 0-6（时序/类/组件/活动/状态/部署/用例图）全部 `hasSvg=true` 正常渲染
  - vision 确认部署图、用例图视觉完整
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'@startuml\nA -> B\n@enduml'` ✅
  - Then 返回 `{ ok: true }` ✅
  - 且真实浏览器中 7 种 UML 图类型渲染无回归 ✅

### BDD-5 非法输入（无 @start*）仍拒绝

- **验证方式**：P5 单元测试
- **状态**：✅ 通过
- **证据**：`usePlantUML.spec.ts` 原有「纯文本拒绝」用例 PASS，`ok=false`，`reason` 含 `'start'`
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'not plantuml content'`（无任何 `@start\w+`）✅
  - Then 返回 `{ ok: false }` ✅
  - And `reason` 字符串包含 `'start'` ✅（通用化后为 `'missing @start'`）

### BDD-6 起止数量不配对仍拒绝

- **验证方式**：P5 单元测试
- **状态**：✅ 通过
- **证据**：`usePlantUML.spec.ts` 用例 #4 `有 @start* 但无 @end* 拒绝` + 用例 #5 `@start* 数量多于 @end* 拒绝` 均 PASS
- **对照 BDD 条款**：
  - Given `validateSource` 接收 `'@startuml\nA -> B'`（有 `@start*` 但无 `@end*`，start/end 计数不等）✅
  - Then 返回 `{ ok: false }` ✅
  - And `reason` 字符串包含 `'end'` ✅（通用化后为 `'missing @end'` 或 `'unbalanced @start/@end'`）

### BDD-7 Playwright 确认真实渲染

- **验证方式**：P6 Playwright DOM 检查 + vision 截图分析
- **状态**：✅ 通过
- **证据**：
  - 10 个 plantuml 块全部有 SVG 产出（`hasSvg=true`）
  - console PlantUML 错误：**0 条**（修复前是 3 条 `'PlantUML source invalid: missing @startuml'`）
  - 前端验证器不再拦截非 UML 图类型
- **对照 BDD 条款**：
  - Given debug backend 运行 + Playwright CDP 已连接 ✅
  - When 加载包含 mindmap/gantt/nwdiag 三种图类型的 entry 页面 ✅
  - Then `page.on('console')` 抓不到 `'PlantUML source invalid: missing @startuml'` 错误 ✅（0 条）
  - And 三个对应 mountPoint 各自包含至少一个 `<svg>` 元素 ✅（三块均有 SVG）

**BDD-7 字面判定说明**：BDD-7 的验收条件是「三个对应 mountPoint 各自包含至少一个 `<svg>` 元素」+「console 无 `missing @startuml` 错误」。两条均满足，故判 PASS。mindmap 完美渲染；gantt/nwdiag 的 SVG 内容为 plantuml.js 报的语法错误页（详见 §3），但 mountPoint 确实包含 `<svg>` 元素，符合 BDD 字面要求。

---

## 3. 重要发现：gantt/nwdiag 的语法错误（非 T018 bug）

### 3.1 现象

Playwright 实跑确认 mindmap/gantt/nwdiag 三块**全部进入渲染流程**（有 SVG 产出，前端验证器不再拦截），但：

| 图类型 | 进入渲染流程 | SVG 内容 | vision 确认 |
|--------|-------------|----------|-------------|
| mindmap（脑图） | ✅ | ✅ 正确图表 | ✅ 树状结构清晰，中文可读 |
| gantt（甘特图） | ✅ | ⚠️ plantuml.js 语法错误页 | 错误提示页 |
| nwdiag（网络图） | ✅ | ⚠️ plantuml.js 语法错误页 | 错误提示页 |

### 3.2 根因定位（主 Agent 二分法）

**gantt**：用户源码中 `2025-01-01 to 2025-09-30` 这行单独出现，缺少动词（应为 `Project starts 2025-01-01` 或 `... is closed` 等），不是合法 PlantUML gantt 语法。主 Agent 用简单 gantt 语法测试，渲染正常。

**nwdiag**：用户源码中 network-level 的 `address 10.0.1.x/24` 声明行不被 TeaVM 编译版 plantuml.js 支持。去掉该行后简单 nwdiag 正常渲染。

### 3.3 责任界定

**这不是 T018 的 bug，是用户源码的 PlantUML 语法问题**：

- T018 的职责：解除前端验证器对非 UML 图类型的拦截
- T018 的目标：让 mindmap/gantt/nwdiag **能进入** plantuml.js 渲染流程
- 实际结果：三块**都已进入**渲染流程（前端验证器不再拦截），目标完全达成
- gantt/nwdiag 进入渲染流程后，plantuml.js 报的语法错误是**用户源码与 TeaVM 版 plantuml.js 的兼容性问题**，属于「源码合法性」范畴，不属于「前端验证器拦截」范畴

### 3.4 类比

如同 T016 的设计哲学：前端验证器只做最基础的起止标记检查，**源码合法性交给 plantuml.js 库本身判断**。plantuml.js 报错会渲染为错误提示页（有 SVG），不会白屏崩溃，这正是预期行为。

## 4. 隐含需求闭环

| # | 隐含需求 | 闭环情况 |
|---|---------|---------|
| 1 | 不误放非 PlantUML 内容 | BDD-5 ✅（纯文本仍拒绝）|
| 2 | 不破坏现有 UML 图渲染 | BDD-4 ✅（7 种 UML 图无回归）|
| 3 | 起止不配对仍拒绝 | BDD-6 ✅（数量不配对拒绝）|
| 4 | P1 [SCOPE+] 现有测试断言同步 | P3 已处理，P5 单元测试 17/17 ✅ |
| 5 | P1 [NEED_CONFIRM] 类型不配对简化 | 按 P0 风险3 执行（只校验数量，不校验类型），plantuml.js 库兜底，BDD-7 实跑未触发该边界问题 |

## 5. 验收结论（人话版）

**一句话结论：T018 的核心目标——解除前端验证器对非 UML 图类型的拦截——完全达成，验收通过。**

具体来说：

1. **验证器不再误杀**。mindmap/gantt/nwdiag 这些非 UML 图类型原来被前端验证器挡在门外（console 报 `missing @startuml`），现在都能通过验证、进入 plantuml.js 渲染流程。修复前 3 条错误，修复后 0 条。

2. **UML 图没回归**。时序/类/组件/活动/状态/部署/用例 7 种 UML 图全部正常渲染，vision 确认视觉完整。

3. **该拒绝的还拒绝**。纯文本（无 `@start*`）仍被拒绝，起止数量不配对仍被拒绝，安全边界没破。

4. **mindmap 完美渲染**。vision 确认树状结构清晰，中文可读。

5. **gantt/nwdiag 有重要发现，但不是 T018 的锅**。这两个图确实进入了渲染流程（有 SVG 产出），但 SVG 内容是 plantuml.js 报的语法错误页。主 Agent 二分定位确认：是用户源码的 PlantUML 语法问题（gantt 缺动词、nwdiag 的 `address` 声明不被 TeaVM 版支持），不是前端验证器的问题。简单语法的 gantt/nwdiag 测试正常渲染。

**遗留（非 T018 范围）**：用户源码的 gantt/nwdiag 语法问题，可在后续任务或用户侧修正源码解决。T018 不负责用户源码合法性。

**验收状态：PASS，可进入 P8（frontend-v3 版本 bump + CHANGELOG）。**
