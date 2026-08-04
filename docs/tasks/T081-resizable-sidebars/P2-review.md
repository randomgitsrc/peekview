---
phase: P2
task_id: T081-resizable-sidebars
type: review
parent: P2-design.md
trace_id: T081-P2-20260804
status: approved
created: 2026-08-04
agent: plan-design-review
---

# P2 设计评审（修复轮）：详情页侧边栏可拖拽调整宽度

## 评审对象

- 文件：`docs/tasks/T081-resizable-sidebars/P2-design.md`（修订版）
- 方案：候选方案 A — 独立 composable + CSS 变量驱动
- 上轮 status: needs-revision（3 个 ISSUE）

## 修复轮评审结论

**status: approved**

上轮 3 个 ISSUE 全部已在 P2-design.md「修订说明（P2 修复轮）」章节补充说明，经源码交叉验证确认策略正确。

## ISSUE 逐条确认

### ISSUE-1: overflow-y: auto 丢失（MINOR）— ✅ 已解决

**上轮问题**：移除 scoped `.file-sidebar` 规则块后，`overflow-y: auto` 丢失。

**修订内容**（P2-design.md:217-226）：
- 采用推荐选项 B — 移除 scoped 整个规则块，将 `overflow-y: auto` 补入 layout.css
- 明确说明 toc-sidebar 无此问题（layout.css:127 已有 `overflow-y: auto`）

**源码验证**：
- `layout.css:99-104` `.file-sidebar` 确实无 `overflow-y: auto`（需补）
- `layout.css:127` `.toc-sidebar` 已有 `overflow-y: auto`（无需补）
- `EntryDetailContent.vue:174` scoped `.file-sidebar` 含 `overflow-y: auto`（移除后需迁移）

策略正确，迁移路径清晰。

### ISSUE-2: aside 缺少 position: relative（MINOR）— ✅ 已解决

**上轮问题**：handle 用 `position: absolute`，aside 无 `position: relative`，handle 定位会偏移。

**修订内容**（P2-design.md:228-236）：
- 在 layout.css 改动中给 `.file-sidebar` 和 `.toc-sidebar` 均添加 `position: relative`
- 说明理由：handle 使用 absolute 定位，aside 必须是定位祖先

**源码验证**：
- `layout.css:99-104` `.file-sidebar` 无 `position` 声明（需补）
- `layout.css:121-128` `.toc-sidebar` 无 `position` 声明（需补）

策略正确，两个 aside 均需添加。

### ISSUE-3: BDD-13 滚动阻止机制描述不精确（INFO）— ✅ 已解决

**上轮问题**：原设计写 "pointer-events: none on content-area"，但 pointer-events 阻止点击不阻止滚动。

**修订内容**（P2-design.md:238-248）：
- 澄清 pointer-events: none 描述不精确，已移除
- 实际机制：flex 布局中 mousemove 不直接触发滚动；content-area overflow-y: auto 只响应滚轮/键盘/触控板
- 拖拽期间 user-select: none + cursor: col-resize 提供视觉反馈，用户不会尝试滚动
- P3 测试声明：不模拟 wheel 事件，验证 user-select: none body class 已添加即可

**评估**：澄清准确。flex 布局中 mousemove 确实不触发 overflow 滚动——滚动只在 wheel/keyboard/touchpad 惯性时发生。拖拽期间用户手在按住鼠标，物理上无法操作滚轮。P3 测试声明合理（验证 body class 足够覆盖"独占交互"语义）。

## 评审维度评分（0-10）

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 10/10 | 16 条 BDD 全覆盖，BDD-13 机制已精确澄清 |
| AI Slop 风险 | 9/10 | 具体 px 值、CSS 类名、事件链伪代码明确，无模糊空间 |
| 移动端考虑 | 10/10 | @media 断点清晰，与现有 layout.css:114/146 一致 |
| 可访问性 | 9/10 | role/tabindex/aria-orientation/键盘箭头/focus-visible 全覆盖 |

## BDD 覆盖完整性（对照 16 条）

16/16 全覆盖，无 ⚠️ 无 ❌。

## 环境隔离

[PROD_NOT_TOUCHED]

评审过程仅读取源码文件，未启动服务、未操作数据库、未触碰生产环境。
