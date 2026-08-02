---
phase: P7
task_id: T085-render-regression-fix
type: consistency
parent: P6-acceptance.md
trace_id: T085-P7-20260802
status: draft
created: 2026-08-02
agent: consistency-reviewer
---

# P7 一致性检查 — T085 详情页渲染回归修复

## 1. DESIGN_GAP 配对

### P4-implementation.md `[DESIGN_GAP]`（行 132-134）

> P2-design 列出了 `structured-data-viewer.spec.ts` 和 `TableView.spec.ts` 的 BDD-19/20 改真实点击的改动，但 dispatch-context 说"不改测试代码（P3 测试不改，只改实现让测试变绿）"。这两个旧测试断言已移除的 `select.per-page-select`，不更新会导致测试失败。按 P2-design 改动清单执行，更新为自定义下拉的真实点击流程。

**DESIGN_GAP_REVIEWED**：P4-review.md §`[DESIGN_GAP_REVIEWED]`（行 174-178）已评审，结论为「此 DESIGN_GAP 合理。旧测试断言已移除的 `select.per-page-select`，不更新会导致测试失败。implementer 按 P2-design 改动清单执行，更新为自定义下拉的真实点击流程，且全量测试通过。无范围蔓延。」

配对状态：✅ 已配对，REVIEWED 标记存在

### P5-progress.md `[DESIGN_GAP]`（行 67）

> 测试前提错误（150行/100perPage=2页，无page3），实现无法合理修复。需主 Agent 决策。

**DESIGN_GAP_REVIEWED**：经核查，此 DESIGN_GAP 基于 P5 fix implementer 的误诊。实际 E2E 测试文件 `render-regression.spec.ts`（P3-test-code 原版与 frontend-v3/e2e 实际文件完全一致，diff 为空）使用的测试数据是 `t085-csv-300`（300 行 CSV），而非 P5-progress 所述的 `CSV_150`（150 行）。300 行 / 100 perPage = 3 页，page 3 存在，BDD-9 测试前提正确。P6 验收 BDD-9 PASS 证实测试正常运行。此 DESIGN_GAP 为误诊，无需修复，实际未影响实现。

配对状态：✅ 已配对（误诊确认，无实际影响）

## 2. SCOPE+ 闭环

P1-requirements.md 无 `[SCOPE_RESOLVED]` 标记。

检查上下文：
- P2-design.md §`[SCOPE+] 检查`（行 279-281）：「无新隐含需求。P1 IM-1~IM-7 均已在方案中覆盖。」
- P4-implementation.md §`[SCOPE+] 检查`（行 136-138）：「无新隐含需求。」
- P1-requirements.md NC-1 已确认（行 107），`[NO_NEED_CONFIRM]` 存在（行 109）

结论：执行过程中未触发任何 SCOPE+ 增补。P1/P2/P4 均显式声明「无新隐含需求」，NC-1（唯一 NEED_CONFIRM）已在 P1 内闭环。无 SCOPE+ 需要标记 SCOPE_RESOLVED。

闭环状态：✅ 无 SCOPE+ 触发，无需 [SCOPE_RESOLVED]

## 3. 跨文件一致性

### 3.1 P2 packages vs P4 改动 vs P6 BDD 数量

**P2§packages**（行 178-181）：`frontend-v3`, `frontend-v3-e2e`

**P4§改动文件清单**（行 26-35）：8 个文件，全部在 `frontend-v3/` 下

**实际 git diff 文件**（排除 docs/tasks/）：
- `frontend-v3/src/composables/useEntryDetailComputed.ts` — P4 声明 ✓
- `frontend-v3/src/components/EntryDetailContent.vue` — P4 声明 ✓
- `frontend-v3/src/views/EntryDetailView.vue` — P4 声明 ✓
- `frontend-v3/src/styles/code.css` — P4 声明 ✓
- `frontend-v3/src/components/MarkdownViewer.vue` — P4 声明 ✓
- `frontend-v3/src/styles/markdown.css` — P4 声明 ✓
- `frontend-v3/src/composables/useResponsiveLayout.ts` — P4 声明 ✓
- `frontend-v3/src/components/TableView.vue` — P4 声明 ✓
- `frontend-v3/src/components/EntryDetailHeader.vue` — **P4 未声明** ⚠️
- `frontend-v3/e2e/render-regression.spec.ts` — P4 测试文件清单 ✓
- `frontend-v3/e2e/structured-data-viewer.spec.ts` — P4 现有测试适配 ✓
- `frontend-v3/src/components/__tests__/TableView.spec.ts` — P4 现有测试适配 ✓
- `frontend-v3/src/components/__tests__/TableView.per-page.spec.ts` — P4 测试文件清单 ✓
- `frontend-v3/src/composables/__tests__/useEntryDetailComputed.svg.spec.ts` — P4 测试文件清单 ✓
- `frontend-v3/src/composables/__tests__/useResponsiveLayout.boundary.spec.ts` — P4 测试文件清单 ✓
- `frontend-v3/src/composables/__tests__/useResponsiveLayout.spec.ts` — **P4 未声明** ⚠️
- `backend/peekview/static/index.html` — 前端构建产物（`make build-frontend` 自动生成），非源码改动

**差异分析**：
1. `EntryDetailHeader.vue`：P5 fix 阶段将 `.meta-tags-bar` 从 `v-if="isMobile"` 改为 `v-show="isMobile"`（BDD-8 修复——桌面端也需要该元素作为 scroll-hide 状态载体）。P4-implementation.md 未追加此文件到改动清单。**非阻塞**：改动是 P5 fix 的合理衍生，属于 BDD-8 修复范围，不影响 P2 方案一致性。
2. `useResponsiveLayout.spec.ts`：P5 fix 阶段在现有测试中添加 `scrollHeight`/`clientHeight` mock 值以适配边界保护逻辑。P4 未声明。**非阻塞**：测试适配，不影响功能。
3. `backend/peekview/static/index.html`：构建产物，非源码改动。

**一致性判定**：P2 声明的 packages（`frontend-v3`, `frontend-v3-e2e`）与实际改动范围一致。P4 改动清单遗漏 2 个文件（EntryDetailHeader.vue + useResponsiveLayout.spec.ts），均为 P5 fix 阶段的衍生改动，属于 BDD-8 修复范围，不超出 P2 方案设计。**WARNING**：P4-implementation.md 改动文件清单不完整，但非 BLOCKER。

### 3.2 P1 BDD 数量 vs P6 验收结果

**P1§BDD**：11 条（BDD-1 ~ BDD-11），覆盖 5 个缺陷

**P6§验收汇总**：11/11 PASS, 0 FAIL

| P1 BDD | P6 状态 | 证据类型 | 内容匹配 |
|--------|---------|---------|---------|
| BDD-1 SVG 图片预览 | PASS | DOM + screenshot + vision | ✅ SVG 渲染为 ImageViewer（imgNaturalWidth=800），非 TreeView |
| BDD-2 XML 仍树视图 | PASS | DOM + screenshot + vision | ✅ XML 渲染为 TreeView（treeNodeCount=59），非图片 |
| BDD-3 SVG 无 toggle | PASS | DOM 断言 | ✅ toggleBtn=0，isRichRenderable=false |
| BDD-4 源码视图滚动 | PASS | DOM + screenshot + vision | ✅ atBottom=true, lineCount=171 |
| BDD-5 fallback 滚动 | PASS | DOM + screenshot + vision | ✅ atBottom=true, lineCount=203 |
| BDD-6 桌面 Markdown 边距 | PASS | DOM + screenshot + vision | ✅ leftPadding=85px ≥ 32px |
| BDD-7 移动 Markdown 边距 | PASS | DOM + screenshot + vision | ✅ leftPadding=24px ≥ 16px |
| BDD-8 底端不抖动 | PASS | DOM + screenshot + vision | ✅ jitter toggles=0 |
| BDD-9 真实点击 per-page | PASS | DOM + screenshot + vision | ✅ triggerText 变 50/page，rowCount=50，回第1页 |
| BDD-10 触达目标 ≥44px | PASS | DOM 断言 | ✅ minSize=44px |
| BDD-11 键盘操作 | PASS | DOM + screenshot + vision | ✅ 键盘 Tab→ArrowDown→Enter 改变行数 |

一致性判定：✅ P1 的 11 BDD 与 P6 的 11 PASS 数量匹配，内容逐条对应

### 3.3 P4 实现路径 vs P2 方案设计

| 缺陷 | P2§方案 | P4§impl-path | 实际代码 | 一致 |
|------|---------|-------------|---------|------|
| P1 SVG | 方案 A：isSvg computed + isRichRenderable 排除 + 调度链 (isXml && !isSvg) | 同 P2 | `useEntryDetailComputed.ts:25` isSvg computed ✓；`useEntryDetailComputed.ts:27` isRichRenderable 含 `(isXml.value && !isSvg.value)` ✓；`EntryDetailContent.vue:40` 调度链 `(isXml && !isSvg)` ✓ | ✅ |
| P2 滚动 | 方案 A：.code-body flex:1 + min-height:0 | 同 P2 | `code.css:39-42` `.code-body { flex: 1; min-height: 0; }` ✓ | ✅ |
| P3 边距 | 方案 B：.markdown-body scoped padding + 全局移动端 media query | 同 P2 | `MarkdownViewer.vue:125-129` `.markdown-body { max-width: 900px; margin: 0 auto; padding: var(--space-5); }` ✓；`markdown.css:28-30` `@media (max-width: 640px) { .markdown-body { padding: var(--space-4); } }` ✓ | ✅ |
| P4 抖动 | 方案 A：overscroll-behavior + setupScrollHide 边界保护 | 同 P2 | `EntryDetailContent.vue:175` `overscroll-behavior: y none` ✓；`useResponsiveLayout.ts:28-49` atBottom 状态追踪 + isTop 强制显示 ✓ | ✅ |
| P5 下拉框 | 方案 A：自定义下拉组件（参照 OverflowMenuDropdown） | 同 P2 | `TableView.vue:64` button.per-page-trigger ✓；`TableView.vue:76` role="listbox" ✓；`TableView.vue:82` role="option" ✓；`TableView.vue:378` min-height: 44px ✓ | ✅ |

一致性判定：✅ P4 实现忠实落地 P2 方案，5 个缺陷的修复路径完全吻合

### 3.4 P5 测试结果 vs P6 验收

**P5§frontend-unit**：vitest 1198 passed / 1 skipped，vue-tsc 0 errors，build success。E2E 因 CDP 连接不稳定推 P6。

**P6§验收**：11/11 BDD PASS（Playwright CDP 实跑 + vision 截图验证）

一致性判定：✅ P5 单测全绿 + P6 E2E 全绿，测试覆盖无缺口

## 4. 未决项清零

| 检查项 | 结果 |
|--------|------|
| P1-requirements.md `[NEED_CONFIRM]` | NC-1 已确认（行 107），`[NO_NEED_CONFIRM]` 存在（行 109）✅ |
| P2-design.md 残留标记 | 无 `[NEED_CONFIRM]`/`[BLOCKER]`/`[DEVIATION-CRITICAL]` ✅ |
| P4-implementation.md 残留标记 | 无 `[NEED_CONFIRM]`/`[BLOCKER]`/`[DEVIATION-CRITICAL]` ✅ |
| P4-review.md 残留标记 | 无 `[BLOCKER]`，3 个非阻塞建议已记录 ✅ |
| P5-test-results 残留标记 | 无 `[NEED_CONFIRM]`/`[BLOCKER]`/`[DEVIATION-CRITICAL]` ✅ |
| P6-acceptance.md 残留标记 | `[NO_NEED_CONFIRM]` 存在（行 133），无 `[BLOCKER]` ✅ |
| P5-progress.md `[DESIGN_GAP]` | 误诊（见 §1），无实际影响 ✅ |

未决项状态：✅ 全部清零

## 5. 源文件节名引用

- P1§BDD（行 38-103）：11 BDD 定义
- P2§packages（行 178-181）：`frontend-v3`, `frontend-v3-e2e`
- P2§方案（行 52-172）：5 个缺陷的候选方案
- P4§impl-path（行 55-121）：实现细节
- P4§改动文件清单（行 26-35）：8 个源文件
- P6§BDD 逐条验收（行 34-108）：11 PASS
- P5§frontend-unit（行 9-14）：1198 passed

## 6. 总结

| 检查项 | 结果 | 备注 |
|--------|------|------|
| DESIGN_GAP 配对 | ✅ PASS | P4 1 条 DESIGN_GAP 已 REVIEWED；P5 1 条为误诊 |
| SCOPE+ 闭环 | ✅ PASS | 无 SCOPE+ 触发，P1/P2/P4 均声明无新隐含需求 |
| 跨文件一致性 | ✅ PASS | P2 packages = P4 改动范围 = P6 BDD 覆盖；P4 实现忠实 P2 方案 |
| 未决项清零 | ✅ PASS | 无残留 [NEED_CONFIRM]/[BLOCKER]/[DEVIATION-CRITICAL] |

**WARNING**（非阻塞）：
1. P4-implementation.md 改动文件清单遗漏 `EntryDetailHeader.vue`（P5 fix 将 v-if 改为 v-show）和 `useResponsiveLayout.spec.ts`（测试适配），均为 P5 fix 衍生改动，不超出 P2 方案范围
2. P1-requirements.md 无 `[SCOPE_RESOLVED]` 显式标记，但因执行中无 SCOPE+ 触发（P2/P4 均声明「无新隐含需求」），不构成 gate 失败

**无 [BLOCKER]。无 [DEVIATION-CRITICAL]。**

---

status: approved

一致性检查通过。5 个缺陷修复从 P1 需求 → P2 方案 → P4 实现 → P6 验收的链路完整一致，11 BDD 全部 PASS，DESIGN_GAP 全部 REVIEWED，无未决项。2 个 WARNING 为文档完整性问题，不影响功能正确性，不阻碍 P8 发布。
