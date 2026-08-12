---
phase: P2
task_id: T021
task_name: zen-mode
type: review
parent: P2-design.md
trace_id: T021-P2-eng-review-20260625
status: approved
created: 2026-06-25
reviewer: plan-eng-review
---

# P2 工程经理评审 — T021 zen-mode

## 架构问题（阻塞级）

无。

## 架构问题（非阻塞）

1. **handleZenKeydown 中 shouldHandleZenShortcut 重复调用**：P2-design.md §2.4 第 169 行 `if ((event.key === 'f' || event.key === 'F') && shouldHandleZenShortcut(event))` 中 `shouldHandleZenShortcut` 已在第 163 行检查过，此处冗余。实现时应简化为 `if (event.key === 'f' || event.key === 'F')`。非阻塞——逻辑正确，仅代码质量。

2. **LoginDialog 援引理由不精确**：P2-design.md §2.4 提到"LoginDialog 没有模态覆盖层但也没有 f 键冲突（LoginDialog 的输入框是 `<input>`，已被 INPUT 排除规则覆盖）"。实际上 LoginDialog 根本不在 EntryDetailView 中（仅在 EntryListView），不存在 f 键冲突场景。`closest('[role="alertdialog"]')` 方案本身正确，但文档中的推理链有误。非阻塞——不影响实现。

3. **onUnmounted 需新增 import**：当前 EntryDetailView.vue:296 仅 import `onMounted`，方案需添加 `onUnmounted`。P2 未显式声明此 import 变更，但属于实现细节，非阻塞。

## 测试缺口

1. **shouldHandleZenShortcut 的 alertdialog 测试需 mock DOM**：P3 单元测试计划中"f 键 + alertdialog 内焦点 → false"需要构造含 `role="alertdialog"` 的 DOM 元素并设置 `document.activeElement`。vitest 默认 jsdom 环境支持 `closest()`，但需确认 `isContentEditable` 属性在 jsdom 中可用。若不可用，测试需 mock。

2. **Esc 键在非 zen 状态下的行为未显式测试**：P3 测试计划列了"Esc 键 → true（无论焦点）"，但 `shouldHandleZenShortcut` 对 Esc 返回 true 仅表示"应处理此快捷键"，`handleZenKeydown` 中 Esc 仅在 `zenMode.value === true` 时才执行 `zenMode.value = false`。非 zen 状态下按 Esc 不触发任何副作用（正确行为），但建议 P3 补充一条：非 zen 状态下按 Esc → zenMode 不变。

3. **CSS 特异性验证**：P3 为纯函数单元测试，无法验证 CSS 特异性覆盖是否生效。需 P6 Playwright 实跑验证 zen 模式下侧边栏确实隐藏（BDD-01/02 已覆盖，此处仅确认测试层级分工）。

## 锁定决策

1. **不用 `!important`**：`.zen-mode .file-sidebar` 特异性 0-2-0 > media query 内 `.file-sidebar` 的 0-1-0，且声明顺序在后，足以覆盖。避免 `!important` 污染。

2. **`closest('[role="alertdialog"]')` 方案锁定**：用 DOM 属性检测模态对话框，松耦合、可扩展。不依赖组件内部 ref（如 `showConfirmDelete`）。

3. **不抽 composable**：逻辑 ~20 行，仅 EntryDetailView 使用，内联更直接。

4. **minimal_validation confirmed**：CSS `display:none` 切换不触发 iframe reload，已通过 Playwright 实验确认。

5. **状态机完整**：4 种转换（off→on/f, on→off/Esc, on→off/f, off→不触发）均有明确处理路径，无遗漏状态。
