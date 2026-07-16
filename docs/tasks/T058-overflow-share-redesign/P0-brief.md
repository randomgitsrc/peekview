---
phase: P0
task_id: T058
task_name: overflow-share-redesign
type: brief
trace_id: T058-P0-20260716
created: 2026-07-16
status: draft
parent: UI/UX 重设计 — OverflowMenu 完整重写 + ShareManagementPanel 改为 Popover/Sheet
---

# T058: OverflowMenu 完整重设计 + 分享交互重设计

## 任务简报

两个前端组件需要从设计层面重新定义，不是修补而是重写。

### 需求 A：OverflowMenu 完整重设计

**问题**：
1. 桌面端 Dropdown 未遵循 DESIGN.md §6 Select/Dropdown 规范（背景/边框/shadow/radius 全部不一致）
2. Light 模式下背景透明导致透传下方页面元素
3. 菜单项对齐混乱（部分居中、部分左对齐）、间距不统一
4. 移动端 Bottom Sheet 与桌面端 Dropdown 是同一组件内 `v-if` 切换，逻辑耦合

**当前代码与 DESIGN.md 规范的偏差**：

| 属性 | DESIGN.md 规范 | 当前实现 | 偏差 |
|------|---------------|---------|------|
| 背景 | `--c-surface` | `--bg-primary` | 变量不一致 |
| 边框 | `--c-border-strong` | `--border-color` | 变量不一致 |
| 圆角 | `8px` | `--radius-md` | 可能不是 8px |
| 阴影 | `0 8px 24px rgba(0,0,0,.16)` | `0 4px 12px rgba(0,0,0,.15)` | 弱于规范 |
| 选项 hover | `--c-surface-lower` | `--c-border` | 语义不同 |
| 菜单项对齐 | 左对齐 | 混合 | 不一致 |

**方案：从 DESIGN.md 规范出发完整重写**：

1. **严格遵循 DESIGN.md §6 Dropdown 规范**：所有视觉属性使用规范定义的 token
2. **统一菜单项布局**：icon(18px) + label + hint(右对齐, `--c-text-tertiary`)，全部左对齐
3. **Light 模式背景**：`--c-surface` 在 light 下是 `#ffffff`（非透明），根本解决透传问题
4. **代码结构**：Desktop Dropdown 和 Mobile Bottom Sheet 拆为独立子组件，通过 `variant` prop 切换，各自有完整的 CSS

### 需求 B：分享交互重设计

**问题**：
1. 当前 ShareManagementPanel 是页面底部全宽通栏，视觉侵占主内容区
2. 信息密度低（统计行 + checkbox + token prefix + status + views + expires），空间浪费
3. 交互粗糙（checkbox 批量选择 + revoke 按钮），不符合 PeekView 极简设计理念
4. 创建分享（ShareDialog）和管理分享（ShareManagementPanel）是两个独立入口，割裂

**方案：统一入口 + 双模式容器**

#### 入口设计

**唯一入口：分享按钮。** 所有分享操作（创建、管理、复制、撤销）都从这个入口进入。

分享按钮上加 badge 显示活跃链接数（0 时不显示），让用户知道"已经有分享链接了"。

#### 桌面端：Popover（280px 浮动层）

点击分享按钮后弹出 Popover，锚定在按钮正下方。

**无活跃链接时**：

```
┌──────────────────────────────┐
│  Share                     ✕ │
│──────────────────────────────│
│                              │
│  No active share links       │
│                              │
│  [   Create share link   ]   │  ← 主按钮，--c-accent 背景
│                              │
└──────────────────────────────┘
```

**有活跃链接时**：

```
┌──────────────────────────────┐
│  Share Links              ✕  │
│──────────────────────────────│
│                              │
│  ┌───────────────────────┐   │
│  │ https://peek.example  │ 📋│  ← 链接行，monospace，截断
│  │ .com/abc?share=xA4b  │   │     📋 复制按钮
│  └───────────────────────┘   │
│  2 views · Expires 7d   [🗑] │  ← 状态行 + 撤销按钮(--c-error)
│                              │
│  ┌───────────────────────┐   │
│  │ https://peek.example  │ 📋│
│  │ .com/abc?share=kR7m  │   │
│  └───────────────────────┘   │
│  5 views · Permanent   [🗑]  │
│                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  + Create new link           │  ← 文字按钮，创建新链接
│                              │
└──────────────────────────────┘
```

**创建视图**（点击"Create share link"后 Popover 内切换）：

```
┌──────────────────────────────┐
│  ← Back       Create Link  ✕ │
│──────────────────────────────│
│                              │
│  Expires in                  │
│  [  7 days            ▾  ]   │  ← 下拉选择：1h / 1d / 7d / 30d / Never
│                              │
│  Max views (optional)        │
│  [  Unlimited          ▾  ]  │  ← 下拉选择：Unlimited / 10 / 50 / 100
│                              │
│  [     Create link      ]    │  ← 主按钮
│                              │
└──────────────────────────────┘
```

**过期/撤销链接**：折叠到"已过期链接 (2)"可展开区域，展开后显示同格式但 opacity 降低。

#### 移动端：Bottom Sheet

移动端不用 Popover——屏幕太窄。用 Bottom Sheet（与 OverflowMenu 移动端一致的模式），从底部滑出，占屏幕 60-70%。

```
┌─────────────────────────────────┐
│         ───── 拖拽条 ─────      │
│  Share Links                 ✕  │
│─────────────────────────────────│
│                                 │
│  https://peek.example.com/abc   │  ← 链接占满宽度
│  ?share=xA4b...           [📋] │  ← 复制按钮在右侧
│  2 views · Expires 7d     [🗑]  │
│                                 │
│  https://peek.example.com/abc   │
│  ?share=kR7m...           [📋] │
│  5 views · Permanent      [🗑]  │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  + Create new link              │
│                                 │
└─────────────────────────────────┘
```

移动端创建视图同样在 Sheet 内切换。

#### 桌面端 vs 移动端对比

| 属性 | 桌面端 Popover | 移动端 Bottom Sheet |
|------|---------------|-------------------|
| 容器 | 锚定在按钮下方的浮动层 | 从底部滑出的全宽面板 |
| 宽度 | 固定 280px | 100% 屏幕宽度 |
| 链接显示 | 输入框式（一行，复制按钮在框内右侧） | 两行（链接 + 操作行），复制按钮在右侧 |
| 关闭方式 | 点击外部 / ESC | 点击背景遮罩 / 下拉关闭 / ESC |
| 创建表单 | Popover 内切换视图 | Sheet 内切换视图 |
| 视觉 | DESIGN.md §6 Dropdown 面板样式 | DESIGN.md §6 Bottom Sheet 样式 |

#### 组件架构

```
ShareDialog.vue (统一入口组件)
├── variant="popover"  → 桌面端 Popover 容器
├── variant="sheet"    → 移动端 Bottom Sheet 容器
└── ShareDialogContent.vue (共享内容逻辑)
    ├── 列表视图：链接列表 + 创建入口
    └── 创建视图：过期时间选择 + max_views + 确认按钮
```

`ShareDialogContent` 是共享的，两个容器只负责定位和动画。

#### 交互细节

- **复制按钮**：点击后图标从 📋 变为 ✓（`--c-success` 色），1.5s 后恢复
- **撤销按钮**：使用 `--c-error` 色，hover 时加深；点击后无需确认直接撤销（toast 提示"链接已撤销"，类似 GitHub 的即时操作）
- **创建成功**：自动切换回列表视图，新链接出现在列表顶部，带 `--c-success` 边框闪烁 0.5s
- **链接截断**：monospace 字体，超长链接中间截断显示 `...`
- **Popover 滚动**：最大高度 `calc(100vh - header高度 - 20px)`，超出可滚动

## executor_env

```yaml
platform: "claude-code"
has_task_tool: false
has_local_runtime: true
network: "full"
```

## 环境约束

- debug_env: `make debug-start`（:8888, /tmp/peekview-debug/）
- 前端 `npx vue-tsc --noEmit` CI 强制
- 所有视觉 token 必须来自 DESIGN.md 定义的 `--c-*` 变量

## 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Popover 超出视口 | 高度不够显示所有链接 | 固定 280px 宽度，最大高度 `calc(100vh - header - 20px)`，超出可滚动 |
| 移动端空间不足 | Popover 太窄 | 移动端不用 Popover，用 Bottom Sheet（全宽、60-70% 屏幕高） |
| 删除通栏后入口消失 | 用户无法管理已有分享 | 分享按钮是唯一入口，badge 显示活跃链接数；Popover/Sheet 内完成所有操作 |
| Popover 与分享按钮的定位偏移 | 页面滚动后锚点位置变化 | Popover 用 `position: absolute` 相对于分享按钮的父容器定位，不依赖视口坐标 |

## 裁剪倾向

- P3（TDD）简化：纯 UI 组件重写，重点在视觉验证而非逻辑测试
- P6（验收）保留：UI 改动必须 Playwright 实跑+截图
- P7（一致性）可裁剪：纯前端改动，无跨包影响

## packages

- `frontend-v3/src/components/OverflowMenu.vue`（重写）
- `frontend-v3/src/components/ShareDialog.vue`（新建，替代 ShareManagementPanel）
- `frontend-v3/src/components/ShareDialogContent.vue`（新建，共享内容逻辑）
- `frontend-v3/src/components/ShareManagementPanel.vue`（删除）
- `frontend-v3/src/views/EntryDetailView.vue`（调整引用：删除通栏，分享按钮加 badge + Popover/Sheet 触发）
- `frontend-v3/src/styles/`（如果需要补充变量）

## domains

- `overflow-redesign`：OverflowMenu 从 DESIGN.md 规范出发的完整重写
- `share-redesign`：分享交互统一入口 + Popover/Sheet 双模式重设计

## ui_affected

- 桌面端 Detail Header：OverflowMenu dropdown 外观 + 分享按钮触发 Popover
- 移动端 Detail Header：OverflowMenu bottom sheet 外观 + 分享按钮触发 Bottom Sheet
- 详情页主体：移除底部 ShareManagementPanel 通栏
