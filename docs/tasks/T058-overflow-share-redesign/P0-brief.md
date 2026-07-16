---
phase: P0
task_id: T058
task_name: overflow-share-redesign
type: brief
trace_id: T058-P0-20260716
created: 2026-07-16
status: draft
parent: UI/UX 重设计 — OverflowMenu 完整重写 + ShareManagementPanel 改为 Popover
---

# T058: OverflowMenu 完整重设计 + ShareManagementPanel Popover 化

## 任务简报

两个前端组件需要从设计层面重新定义，不是修补而是重写。

### 需求 A：OverflowMenu 完整重设计

**问题**：
1. 桌面端 Dropdown 未遵循 DESIGN.md §6 Select/Dropdown 规范（背景/边框/shadow/radius 全部不一致）
2. Light 模式下背景透明导致透传下方页面元素
3. 菜单项对齐混乱（部分居中、部分左对齐）、间距不统一
4. 移动端 Bottom Sheet 与桌面端 Dropdown 是同一组件内 `v-if` 切换，逻辑耦合

**当前代码问题清单**（对比 DESIGN.md）：

| 属性 | DESIGN.md 规范 | 当前实现 | 偏差 |
|------|---------------|---------|------|
| 背景 | `--c-surface` | `--bg-primary` | 变量不一致 |
| 边框 | `--c-border-strong` | `--border-color` | 变量不一致 |
| 圆角 | `8px` | `--radius-md` | 可能不是 8px |
| 阴影 | `0 8px 24px rgba(0,0,0,.16)` | `0 4px 12px rgba(0,0,0,.15)` | 弱于规范 |
| 选项 hover | `--c-surface-lower` | `--c-border` | 语义不同 |
| 菜单项对齐 | 未明确（应为左对齐） | 混合 | 不一致 |

**方案：从设计规范出发完整重写**，而非在现有代码上修补：

1. **严格遵循 DESIGN.md §6 Dropdown 规范**：所有视觉属性使用规范定义的 token
2. **统一菜单项布局**：icon(18px) + label + hint(右对齐, `--c-text-tertiary`)，全部左对齐
3. **Light 模式背景**：`--c-surface` 在 light 下是 `#ffffff`（非透明），根本解决透传问题
4. **代码结构**：Desktop Dropdown 和 Mobile Bottom Sheet 拆为独立子组件，通过 `variant` prop 切换，但各自有完整的 CSS

### 需求 B：ShareManagementPanel Popover 化

**问题**：
1. 当前是页面底部全宽通栏，视觉侵占主内容区
2. 信息密度低（统计行 + checkbox + token prefix + status + views + expires），空间浪费
3. 交互粗糙（checkbox 批量选择 + revoke 按钮），不符合 PeekView 极简设计理念

**方案：Contextual Unified Popover**：
1. **容器**：紧贴分享按钮弹出的 Popover，锚定在按钮下方
2. **状态 A（无活跃分享）**：显示 `[ 生成分享链接 ]` 主按钮
3. **状态 B（有活跃分享）**：
   - 每个活跃链接一行：`token前缀...` + `复制` 图标按钮 + `撤销` 图标按钮
   - 已过期/已撤销链接折叠，点击展开
4. **视觉规范**：复用 DESIGN.md §6 Dropdown 面板样式（与 OverflowMenu 视觉一致）
5. **交互**：点击外部关闭、ESC 关闭、操作后自动刷新列表
6. **移除底部通栏**：EntryDetailView 中删除 `<ShareManagementPanel>` 的全宽渲染

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 前端 `npx vue-tsc --noEmit` CI 强制
- 所有视觉 token 必须来自 DESIGN.md 定义的 `--c-*` 变量

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Popover 定位问题 | 分享按钮在页面顶部，Popover 可能超出视口 | 检测边界自动翻转方向 |
| 移动端 Popover 空间不足 | 小屏幕上 Popover 太窄 | 移动端复用 Bottom Sheet 模式（与 OverflowMenu 一致） |
| 删除通栏后分享管理入口消失 | 用户无法管理已有分享 | 分享按钮旁加 badge 显示活跃链接数，点击打开 Popover |

## 裁剪倾向

- P3（TDD）简化：纯 UI 组件重写，重点在视觉验证而非逻辑测试
- P6（验收）保留：UI 改动必须 Playwright 实跑+截图
- P7（一致性）可裁剪：纯前端改动，无跨包影响

## packages

- `frontend-v3/src/components/OverflowMenu.vue`（重写）
- `frontend-v3/src/components/ShareManagementPanel.vue`（重写为 SharePopover）
- `frontend-v3/src/views/EntryDetailView.vue`（调整引用方式）
- `frontend-v3/src/styles/`（如果需要补充变量）

## domains

- `overflow-redesign`：OverflowMenu 从设计规范出发的完整重写
- `share-popover`：分享管理从通栏改为 Popover

## ui_affected

- 桌面端 Detail Header：OverflowMenu dropdown 外观
- 移动端 Detail Header：OverflowMenu bottom sheet 外观
- 分享交互：从底部通栏改为 Popover
