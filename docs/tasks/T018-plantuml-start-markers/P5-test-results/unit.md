---
phase: P5
task_id: T018
task_name: plantuml-start-markers
type: test_results
trace_id: T018-P5-2026-06-21
created: 2026-06-21
status: pass
parent: docs/tasks/T018-plantuml-start-markers/P0-brief.md
---

# P5 技术验证报告：PlantUML 起止标记通用化

## 1. 验证总结

| 项 | 结果 |
|----|------|
| 总体状态 | **PASS** |
| 前端单元测试 | PASS（17/17，含 P3 新增 6 用例全部转 GREEN）|
| 前端构建 | PASS（`✓ built in 11.44s`）|
| 生产环境隔离 | 未触碰 `~/.peekview/`（无 [PROD_TOUCHED]）|

P5 门禁放行至 P6 验收。功能性 BDD（BDD-1~BDD-6 验证器逻辑）已在 P5 单元测试实跑通过；交互性 BDD（BDD-7 Playwright 真实渲染）留 P6 做端到端逐条实跑。

## 2. 逐项验证结果

### 2.1 前端单元测试

**命令**：
```bash
cd frontend-v3 && npx vitest run src/composables/__tests__/usePlantUML.spec.ts
```

**结果**：17 passed / 0 failed / exit 0

**用例分布**：

| 分组 | 数量 | 覆盖 BDD | 状态 |
|------|------|----------|------|
| 原有用例（含 P3 [SCOPE+] 软化断言 2 处） | 11 | BDD-4/5/6 回归保护 | PASS |
| P3 新增 RED 用例（P4 转 GREEN） | 6 | BDD-1/2/3/6 + 边界 | PASS |

**P3 新增 6 用例转 GREEN 明细**（对照 P4 `notes.md` §预期测试转 GREEN）：

| # | 用例 | 对应 BDD | 状态 |
|---|------|----------|------|
| 1 | `@startmindmap/@endmindmap 通过校验` | BDD-1 | PASS |
| 2 | `@startgantt/@endgantt 通过校验` | BDD-2 | PASS |
| 3 | `@startnwdiag/@endnwdiag 通过校验` | BDD-3 | PASS |
| 4 | `有 @start* 但无 @end* 拒绝` | BDD-6 | PASS |
| 5 | `@start* 数量多于 @end* 拒绝` | BDD-6 衍生 | PASS |
| 6 | `@startmindmap(filename) 带文件名参数通过校验` | BDD-1 衍生 | PASS |

### 2.2 前端构建

**命令**：
```bash
cd frontend-v3 && npm run build
```

**结果**：`✓ built in 11.44s`，无 typecheck 错误，无 TS 报错。

### 2.3 生产环境隔离

所有 P5 验证在 `/tmp/peekview-debug/` 进行，**未触碰** `~/.peekview/`。无 [PROD_TOUCHED]。

## 3. 发现的问题

无。P5 阶段未发现新问题。

## 4. BDD 覆盖对照

### 4.1 P5 已验证（实跑通过）

| BDD | 标题 | P5 验证方式 | 结论 |
|-----|------|-------------|------|
| BDD-1 | `@startmindmap/@endmindmap` 通过验证 | 单元测试用例 #1 | PASS |
| BDD-2 | `@startgantt/@endgantt` 通过验证 | 单元测试用例 #2 | PASS |
| BDD-3 | `@startnwdiag/@endnwdiag` 通过验证 | 单元测试用例 #3 | PASS |
| BDD-4 | `@startuml/@enduml` 向后兼容不回归 | 原有「有效源码通过校验」用例 | PASS |
| BDD-5 | 非法输入（无 @start*）仍拒绝 | 原有「纯文本拒绝」用例 | PASS |
| BDD-6 | 起止数量不配对仍拒绝 | 单元测试用例 #4/#5 | PASS |

### 4.2 留 P6 端到端验收

| BDD | 标题 | P6 需补 |
|-----|------|---------|
| BDD-7 | Playwright 确认真实渲染 | debug backend + Playwright CDP 实跑：含 mindmap/gantt/nwdiag 的 entry 页面，验证 `page.on('console')` 无 `'PlantUML source invalid: missing @startuml'`，三个 mountPoint 各含 `<svg>` |

## 5. 结论

**P5 门禁：PASS**

- 单元测试 17/17 全绿（含 P3 新增 6 用例全部转 GREEN）
- 构建 + typecheck 零错误
- 生产数据库未触碰

**遗留至 P6**：BDD-7 Playwright 真实渲染端到端实跑（mindmap/gantt/nwdiag 三种图类型在真实浏览器中渲染出 SVG）。

**建议**：放行至 P6 验收。
