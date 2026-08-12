---
phase: P0
task_id: T052
task_name: Entry Detail header 重新设计
type: brief
trace_id: T052-P0-20260710
created: 2026-07-10
status: draft
parent: "用户反馈现有 header 纵向太高、按钮不精致、移动端布局不合理"
---

# T052: Entry Detail header 重新设计

## 五字段

```yaml
task: "重新设计 Entry Detail 页面 header：桌面从 4 行→2 行（~78px），按钮改为 icon-only + overflow 下拉菜单；移动端底部栏按文件类型动态变化，Files 移回底部栏左侧，ThemeToggle 移入 overflow drawer，FAB 移除"
known_risks:
  - "跨越 5 个文件（EntryDetailView.vue / ThemeToggle.vue / OverflowMenu.vue / layout.css / entry.ts），改动面大"
  - "底部栏按文件类型动态变化需要前端状态感知（isMarkdown / isBinary / canWrap / isMultiFile 等），store 逻辑需确认"
  - "Desktop Files/TOC toggle 按钮的样式和 active 态已确定，但 sidebar 面板的交互未定（左/右 overlay？能否同时打开？是否复用移动端 280px drawer？）→ P2 需补设计"
  - "移动端 overflow bottom sheet 和桌面的 dropdown 共享同一组件（OverflowMenu.vue），需扩展以支持两种渲染模式"
  - "meta 行时间格式（相对时间 vs 绝对时间）有分歧，P1 需确认"
executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full
env_constraints:
  debug_env: "make debug（:8888 隔离数据 /tmp/peekview-debug/），前端测试 cd frontend-v3 && ./node_modules/.bin/vitest run，lint: cd backend && python3 -m ruff check peekview/ tests/"
pruning_tendency: "保守——涉及 UI 重设计 + 移动端动态行为 + 新组件，P2/P3/P6 不可裁剪"
phase_hint: [P1, P2, P3, P4, P5, P6, P7, P8]
```

## 任务简报

### 问题

Entry Detail 页面 header 存在 4 个核心问题：

1. **纵向太高**（桌面 ~116px，4 行）挤压内容区域。当前 layout 是 title-row + header-right（meta-row + actions-row）+ ThemeToggle 独占一行
2. **按钮不够精致**——使用 labeled buttons（34px 高）而非 icon-only，占用大量水平空间导致换行
3. **缺少桌面 Files/TOC 切换**——移动端有 Files drawer 和 TOC drawer，桌面 header 中没有入口
4. **移动端布局不合理**——Files 在 info-bar 加高顶部，ThemeToggle 以 FAB 形式悬浮易误触，底部栏不按文件类型区分

### 设计方向（已通过 v4 原型验证）

**桌面 2 行 header（~78px）**
```
Row 1: [Logo] Title (flex:1)          [Files] [TOC] [Copy] [Share] [More▾] [🌙]
Row 2: @alice · 3h ago · Expires in 12d │ 42 reads · Public · #api #tutorial
```
- icon-only 按钮 32px，tooltip 悬停提示
- Files toggle（仅 multi-file 显示）+ TOC toggle（仅 markdown 显示），active 状态蓝色高亮，点击打开/关闭侧边面板
- More▾ 下拉菜单收纳次要操作（Download/Pack/Raw/Delete）
- meta 行用竖线分隔"身份+时间"和"互动+标签"两组

**移动端动态底部栏**
```
底部栏（48px）：[Files(3)] [____flex____] [TOC/Wrap+Copy] [...]
```
- Files 回底部栏左侧（带文件数 badge）
- `.md` → `[TOC] [...]`
- 文本/代码 → `[Wrap] [Copy] [...]`
- 二进制/图片 → `[...]`
- User+tags 在内容区顶部，随滚动隐藏
- ThemeToggle 在 overflow `[...]` 底部弹窗中

**移动端 overflow drawer（bottom sheet）**
- Lucide SVG icon + label + hint（状态说明）
- Divider 分组：Display → Owner 操作 → 通用操作 → 危险区域
- Dark theme 切换在顶部

### 原型参考

- 本地（task 目录）：`design-prototypes/`（4 个 HTML 文件）
- 在线（PeekView）：https://peek.gsis.top/frsg18

### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/views/EntryDetailView.vue` | 大幅修改 template（header 布局）+ scoped CSS + 动态 bottom bar 逻辑 + overflow 内容 |
| `frontend-v3/src/components/ThemeToggle.vue` | emoji (🌙/☀️) → Lucide SVG icon |
| `frontend-v3/src/styles/layout.css` | 新增 header 布局类（.title-row / .actions-area / .meta-row 等），更新 drawer 样式 |
| `frontend-v3/src/styles/variables.css` | 可能新增 toggle 按钮的 color token（现有 --c-accent-secondary 可能够用） |
| `frontend-v3/src/components/OverflowMenu.vue` | 扩展支持 dropdown（desktop）和 bottom sheet（mobile）两种渲染模式 |
| `frontend-v3/src/stores/entry.ts` | 确认 canWrap/canCopy/canDownload/canPack/isMultiFile 计算属性足够覆盖动态逻辑 |

## 环境自检

```
平台: OpenCode
步骤 1 (工具链): ✅ pytest 9.1.1 / vue-tsc 5.9.3 / vitest 1.6.1 / ruff 0.15.18
步骤 2 (调试服务): ✅ make debug 运行中 (:8888)，数据隔离 OK
步骤 3 (版本): ✅ v0.6.0 / git clean
步骤 4 (CDP/Playwright): ✅ Chrome 149 / Playwright 截图 OK
```
