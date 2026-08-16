---
phase: P2
task_id: TPV0093-star-lifecycle
type: review
parent: P2-design.md
trace_id: TPV0093-P2-20260816-r2
status: approved
created: 2026-08-16
agent: plan-design-review
---

# P2 设计评审（前端）— plan-design-review — 复核轮 r2

评审对象：`P2-design.md` r2 修订版 §6 前端设计（design-1..6 + 4 项补充建议）
上一轮：`P2-review-design.md`（r1，needs-revision，6 项 + 4 建议）
本轮模式：增量复核——只验 r1 的 6 项 needs-revision + 4 项补充建议是否闭合 + 修订是否引入新问题。前端源码逐条代码核实。

`[PROD_NOT_TOUCHED]`

## 1. 复核结论总表

| # | 项 | r1 意见 | r2 修订落点 | 代码核实 | 结论 |
|---|----|---------|-------------|----------|------|
| design-1 | 移动端星标落点 | StarToggle 只挂 desktop title-row；mobile-sticky-header 无 actions 区 | §6.1：EntryDetailMobileBar 底部栏加 `mobile-star-toggle`（复用 toggle-btn + toggle-badge，badge 显 star_count），空间不足落 OverflowMenu sheet 兜底；§6.5 testid 含 `mobile-star-toggle`；§7/§14 P3 链路 + 完成标志 | EntryDetailMobileBar.vue mobile-bottom-bar + data-testid 按钮模式 + toggle-btn/toggle-badge(:3-27) + OverflowMenu sheet(:42) 均属实；EntryDetailHeader.vue desktop actions-area(:21-50) 有 toggle-btn/aria-pressed 模式，mobile-sticky-header(:3-10) 无 actions 区（r1 判断正确） | ✅ 闭合 |
| design-2 | 管理页三态 + Starred tab 空态 + 批量禁用 + 移除确认 | §6.3 三态全缺、批量边界未写 | §6.3 三态（加载 skeleton / 错误+重试 / 四分类空态文案全列出）+ 批量按钮 `disabled`（无勾选）+ ConfirmDialog 明示移除 N 条；§6.2 Starred tab 空态「暂无星标内容」（emptyStateHeading 分支）；§6.5 testid `stars-loading/stars-error/stars-empty-*` | EntryListView.vue emptyStateHeading(:282) 现无 starred 分支，需新增——设计已点名该触点 | ✅ 闭合 |
| design-3 | E1 跳转入口二选一 | Toast 无 action 能力，P1 E1 无法落地 | 选型明确：**扩展 Toast 支持可选 `action:{label,to}`**（缺省不渲染、既有调用零改动）；跳转 `/?starred=1`；§2.1 Toast.vue/useToast.ts 改造行 + §2.3 回归风险 + §6.5 `star-toast-action` testid + §7 P3 用例 | useToast.ts(:13-21) 现无 action、Toast.vue 无 action 按钮（r1 判断正确）；扩展为可选参数确实零回归 | ✅ 闭合 |
| design-4 | client.ts transform 新字段映射 | transformListItem/transformEntry 未列映射，P4 漏接则 StarToggle/豁免标签失效 | §2.1 显式：`transformListItem`/`transformEntry`（:43-92）补 `star_count→starCount`、`is_starred→isStarred`、`countdown→countdown`；§9 files_to_read 含 client.ts:43-92；§7 P3 用例 | client.ts:43-92 双函数现无三个新字段映射（r1 判断正确），映射为必需改动 | ✅ 闭合 |
| design-5 | a11y 显式说明 | 语义/对比度/键盘/❓/checkbox 全未定 | §6.6 新 a11y 节：星标按钮 `aria-pressed`+`aria-label`（桌面+移动同一语义）；红色倒计时语义色 token `var(--c-error)` + 对比度 ≥4.5:1（不足加深变体）；墓碑「看原因」`<button>` 键盘可达；❓ 可点击 + aria-label/aria-describedby；checkbox `aria-label`；ConfirmDialog 复用 role=alertdialog + 焦点管理 | variables.css:57 `--c-error:#ff7b72` 存在（对 --c-surface 对比度约 6.6:1，达标）；ConfirmDialog.vue role=alertdialog(:7)+focus(:45-50) 属实；BaseBadge private 变体用 var(--c-error)，"与 8 变体之一对齐"表述成立 | ✅ 闭合 |
| design-6 | 归档 Toast 双文案 | 统一"将于 X 归档"对 archived（expires_at=None）不成立 | §6.1 双文案：`status==='active' && 距 expires_at<7d` →「该内容将于 X 月 X 日归档…」；`status==='archived'` →「该内容已归档，星标后可长期保存」（明示已归档 expires_at=None 不适用"将于"）；§7 BDD-23 + P3 用例 | 语义与 r1 建议一致 | ✅ 闭合 |
| 补充 1 | Starred tab 不含墓碑 | 设计隐含未显式声明 | §6.2 显式：`starred=true` 列表只查 entries 表，墓碑仅现管理页（GET /api/v1/stars）；BDD-18 只验收 entry | 与 §4.4 list_entries 过滤、§4.6 API 契约一致 | ✅ 闭合 |
| 补充 2 | filter 语义表固化 | all/active/expiring/expired 与 BDD-20 映射未列表固化 | §6.3 语义表：all=全部（活+墓碑）/ active=有效 / expiring=即将失效（remaining_days<7）/ expired=已失效或已删除（含墓碑） | 四分类边界无歧义，P4 不会误拆"已失效"与"已删除" | ✅ 闭合 |
| 补充 3 | 豁免标签 footer 条件 | 现仅 `isOwner||isExpiredButActive`，需确认条件扩展 + BaseBadge 互斥 | §6.4：footer 渲染条件扩展 `isOwner && archived && star_count>0` 渲染豁免标签，与 BaseBadge 互斥（替换常规 archived badge，不叠加） | EntryCard.vue:55 footer 条件 + :57 archived BaseBadge 属实，扩展与互斥可落地 | ✅ 闭合 |
| 补充 4 | URL 态耦合触点点名 | 只写 currentStarred 状态，未点名多触点 | §6.2 点名：`restoreFromURL`(:458)、`onBeforeRouteUpdate`(:486)、`emptyStateHeading`(:282 加 starred 分支)、`setFilter`(:340，扩三参 `(owner,status,starred)`)，明示"P4 须同步这 4 处，不能只加状态" | EntryListView.vue 四处行号逐一精确（grep 证实），耦合认识到位 | ✅ 闭合 |

## 2. 修订是否引入新问题（复核目标 8）

逐项检查 r2 修订的连带影响，**无新增 BLOCKER / CRITICAL**：

1. **design-3 与 Toast 自动消失的交互**：useToast.ts(:19-21) 3s 自动消失；带 action 的 Toast 3s 后消失，用户可能来不及点「查看星标」。属 UX 打磨级，非设计缺陷（跳转入口另有 `/?starred=1` 可复用 URL 态）。**建议（非阻塞）**：实现时若带 action 可延长自动消失或允许手动关闭，P4 自由裁量。
2. **`force-delete-confirm` / 管理页确认按钮 testid**：ConfirmDialog.vue 现无 testid prop（r1 组件完整性已提）。§6.5 已列出 `force-delete-confirm` testid，P4 需给 ConfirmDialog 加可选 `testid` prop 透传——实现级小事，设计已给出目标标识，不构成缺口。
3. **loadEntries 多点传参**：设计点名 4 处状态触点，但 EntryListView.vue 另有若干 loadEntries 调用点（:316/323/360/419/443/454/483/503）需随 `starred` 参数透传。均为机械性跟随（与 effectiveOwner 同模式），设计已明示"不能只加状态"且 files_to_read 覆盖 :20-36/270-345/458-504。**建议（非阻塞）**：P3 补 `starred=true` 时列表请求参数断言用例。
4. **匿名移动端星标**：§6.1 匿名→LoginDialog 仅点名桌面，移动端复用语义隐含一致（§6.6 桌面+移动同一 a11y 语义已写明）。非缺口。
5. **setFilter 三参签名变更**：现有 owner-tabs 三处 `@click="setFilter(null,null)"` / `("me",null)` / `(null,'archived')`（EntryListView.vue:24/29/34）需同步为三参——向后兼容的签名扩展，非破坏性。

## 3. 五维度复评分（r1 → r2）

| 维度 | r1 | r2 | 依据 |
|------|-----|-----|------|
| 交互状态覆盖率 | 6 | 9 | 管理页三态 + 四分类空态 + 批量禁用 + 移除确认（design-2）、Starred tab 空态、归档 Toast 双文案（design-6）均已补 |
| AI Slop 风险 | 5 | 8.5 | 红色倒计时色板 token（var(--c-error)）+ 对比度要求、四分类空态文案逐条给定、filter 语义表固化、StarToggle 依赖的 transform 映射显式声明；残留：墓碑"水印"视觉仍未定（低危） |
| 移动端考虑 | 3 | 8.5 | 移动端底部栏 `mobile-star-toggle` 落点明确 + OverflowMenu sheet 兜底（design-1）；管理页沿用 SettingsView mobile-stacked 范式；❓ 触屏 click 兜底；红倒计时对比度 |
| 可访问性 | 4 | 9 | §6.6 独立 a11y 节全量覆盖（aria-pressed/aria-label/语义 token/对比度/button 键盘/❓/checkbox aria-label/alertdialog 焦点管理）（design-5） |
| 组件完整性 | 6 | 8.5 | StarToggle 输入依赖（transform 字段）已点明、Toast action 契约明确；残留：StarToggle props/emits 清单仍留 P4（低危，双落点语义已定） |

## 4. 结论

r1 的 6 项 needs-revision 全部闭合（design-1/2/3/4/5/6），4 项补充建议全部落实（Starred tab 无墓碑 / filter 语义表 / 豁免标签 footer 条件 / URL 触点 4 处点名）；行号引用与前端源码逐一核实精确；修订未引入新 BLOCKER/CRITICAL，仅 3 条非阻塞建议（Toast action 自动消失、ConfirmDialog testid 透传、loadEntries 传参 P3 断言）已注明 P4/P3 处理方向。`candidate_count=6`、四字段、`P5_e2e` 声明保持完整。

Status: **approved**
