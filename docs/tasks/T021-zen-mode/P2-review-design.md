---
phase: P2
task_id: T021
task_name: zen-mode
type: review
parent: P2-design.md
trace_id: T021-P2-design-review-20260625
status: approved
created: 2026-06-25
reviewer: plan-design-review
round: 2
---

# P2 设计评审（二审） — T021 zen-mode

## BLOCKER 解决确认

### B1：焦点管理 — ✅ 已解决

修正方案完整补充了焦点重定向设计：

- §2.2：`.content-area` 添加 `tabindex="-1"`，附标准模式说明（不加入 Tab 序列，仅允许 programmatic focus）
- §2.4：`redirectFocusIfHidden()` 函数，检测 `document.activeElement` 是否在 `.detail-header, .file-sidebar, .toc-sidebar, .mobile-actions` 内，若是则重定向到 `.content-area`
- §2.4：`handleZenKeydown` 中进入 zen 时调用 `redirectFocusIfHidden()`
- 风险点 #4 显式标注 B1 并指向 §2.4
- BDD 覆盖表新增"焦点重定向（B1）"行
- P3 测试计划包含 3 个 `redirectFocusIfHidden` 测试用例（header 内→重定向、content-area 内→不动、body→不动）
- 完成标志包含焦点重定向检查项

设计合理，`tabindex="-1"` 是焦点管理的标准做法，`closest()` 选择器与 CSS 隐藏目标一致。

### B2：aria-live 通知 — ✅ 已解决

修正方案完整补充了屏幕阅读器通知设计：

- §2.1：`zenAriaText` ref + `<span class="sr-only" aria-live="polite">{{ zenAriaText }}</span>`
- §2.1：`updateZenAria(zen: boolean)` 函数，进入时 "Zen mode on. Press f or Escape to exit."，退出时 "Zen mode off."
- §2.1：`polite` vs `assertive` 选择有论证（非紧急通知，不打断当前朗读）
- 复用项目已有 `.sr-only` class（base.css:116）
- 风险点 #5 显式标注 B2 并指向 §2.1
- BDD 覆盖表新增"aria-live 通知（B2）"行
- 完成标志包含 aria 通知检查项

通知文本包含退出方式提示（"Press f or Escape to exit."），对屏幕阅读器用户友好。

## 建议项采纳确认

| 建议项 | 采纳 | 位置 |
|--------|------|------|
| S1：loading/error/empty 下 zen 行为声明 | ✅ | §2.9 Edge case 声明 + BDD 覆盖表 |
| S2：zen + slug watch 侧边栏可见性分析 | ✅ | §2.9 第二段，完整链路分析 |
| S3：Esc + ConfirmDialog 交互声明 | ✅ | §2.4 末段，声明为期望行为 |
| S4：mobile-actions CSS 规则必要性说明 | ✅ | §2.3 标注为防御性规则，附理由 |

## 二审评分

| 维度 | 分数 | 变化 | 说明 |
|------|------|------|------|
| 交互状态覆盖率 | 9/10 | +2 | loading/error/empty、slug watch、entry 加载完成瞬间均已显式声明 |
| AI Slop 风险 | 9/10 | = | 无变化，仍精确 |
| 移动端考虑 | 9/10 | +1 | mobile-actions 防御性规则已说明理由 |
| 可访问性 | 9/10 | +4 | aria-live 通知完整、焦点重定向完整、tabindex 标准用法、通知文本含退出提示 |

## 判定

**approved**。B1（焦点管理）和 B2（aria-live 通知）均已完整补充到方案中，设计合理且有论证。S1-S4 建议项全部采纳。方案可进入 P3。
