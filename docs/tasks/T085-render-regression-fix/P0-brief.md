---
phase: P0
task_id: T085
task_name: render-regression-fix
type: brief
trace_id: T085-P0-20260801
status: draft
created: 2026-08-01
agent: main
---

# P0 任务简报 — T085 详情页渲染回归修复

## 1. 任务背景

T075（structured-data-viewer v0.14.0）上线后，用户在实际使用中发现 5 个用户可见的渲染缺陷。经排查，3 个是 T084（detail-scroll-architecture）的回归，2 个是 T075 新增功能引入的缺陷（SVG 调度链 + per-page 下拉框）。这些缺陷在 T075 的 53 BDD 验收中未被覆盖——根因是测试数据丰富度不足 + E2E 用程序化方法（selectOption）绕过真实交互。

## 2. 问题清单

### P1: SVG 被渲染为 TreeView 而非 ImageViewer

**现象**：`.svg` 文件在详情页显示为 XML 树视图，而非图片预览。

**根因**：后端 `language.py` 将 `.svg` 映射为 `'xml'`（合理——SVG 是 XML）。前端 `useEntryDetailComputed` 新增了 `isXml` computed（T075），调度链中 `isCsv || isTsv || isJson || isYaml || isXml` 分支在 `isImage` 之前，导致 SVG 的 `isXml=true` 截获了渲染，永远到不了 `isImage`。

**举一反三**：完整映射矩阵核对后，真正受影响的只有 `.svg` 一个扩展名。`.plist`（也映射到 xml）的文本格式走 TreeView 可接受，二进制 plist 会解析失败降级 CodeViewer（行为不理想但不崩溃）。其余图片扩展名（png/jpg/gif/webp/bmp/ico）language=None，不会落入富渲染分支。

**修复方向**：
- 方案 A（最小）：`useEntryDetailComputed` 新增 `isSvg` computed（`guessMimeType(filename) === 'image/svg+xml'`），调度链 `isXml` 条件改为 `isXml && !isSvg`
- 方案 B（根本）：调度链统一用「文件类型」判断（mime + language 联合），而非两个维度混用——改动面大，留后续评估

### P2: 源码视图竖向无法滚动

**现象**：任何富渲染格式（CSV/JSON/YAML/XML/Markdown）通过 `<>` 按钮切换到源码视图（CodeViewer）后，内容超出视口时无法竖向滚动。

**根因**：T084 将 `.code-body` 从 `overflow: auto; flex: 1; min-height: 0` 改为空规则（移除了 flex/overflow/min-height）。T084 的设计意图是"content-area 唯一纵向滚动容器"——但 `.code-viewer` 有 `overflow: hidden; display: flex; flex-direction: column`，在 flex 容器里 `.code-body` 没有高度约束时，内容超出被 `overflow: hidden` 裁剪，且 content-area 的滚动因子元素高度约束未正确传递而不生效。

**影响面**：所有富渲染格式切源码视图的公共路径（CodeViewer），不只 TreeView。

**修复方向**：`.code-body` 恢复 `flex: 1; min-height: 0`（让 flex 子元素正确传递高度），但不恢复 `overflow: auto`（让 content-area 滚动）。需要验证 content-area 滚动在 CodeViewer 高度正确传递后是否生效。

### P3: Markdown 渲染视图边距丢失

**现象**：Markdown 渲染视图左右边距几乎为零，内容紧贴容器边缘，无呼吸空间。移动端更严重（8px 左右）。

**根因**：T084 移除了 MarkdownViewer 的 `.markdown-body { padding: 2rem }` scoped 样式和 markdown.css 全局 `.markdown-body { padding: var(--space-5) }`。T084 设计意图是"padding 归属 content-area 单层"——但 content-area 的 `padding: var(--space-4)` = 16px，远小于原来的 32px（2rem）。移动端 content-area `padding: var(--space-3) var(--space-2)` = 12px/8px，更窄。

**DESIGN.md 对照**：
- §6 间距：`Padding: 32px desktop, 16px mobile`——当前 16px/8px 不达标
- §9 滚动架构：`Viewer components must not declare overflow-y: auto`——只约束 overflow，没说 padding

**修复方向**：
- 方案 A：content-area padding 增大到 `var(--space-6)` (32px) 桌面 / `var(--space-3)` (12px) 移动——但会影响所有 viewer（CodeViewer/TableView/TreeView 也有边距变化）
- 方案 B：MarkdownViewer 的 `.markdown-body` 恢复 scoped padding（`var(--space-5)` 桌面 / 移动端 media query）——只影响 Markdown，不影响其他 viewer
- 推荐 B：各 viewer 独立管理自身 padding，content-area 只提供基础边距

### P5: TableView per-page 下拉框不符合 DESIGN.md 且真实点击无法选中

**现象**：TableView 底部"每页行数"下拉框（`select.per-page-select`，50/100/500）：
1. 使用原生 `<select>` 元素，样式简陋，无设计感——未遵循 DESIGN.md 的组件规范
2. 真实浏览器点击无法弹出选项列表，无法选中——"选不中"

**根因**：
1. **原生 select 未样式化**：直接用了 `<select>` 裸元素，仅加了少量 padding/border，没有遵循 DESIGN.md 的交互组件规范（自定义下拉、触达目标 ≥44px 等）
2. **E2E 测试用 `selectOption()` 程序化方法**：Playwright 的 `selectOption()` 直接设置 select 值并触发 change，**不经过真实用户点击**——所以 E2E 显示 PASS，但真实点击无法弹出。这是测试盲区

**E2E 测试盲区确认**：
- `frontend-v3/e2e/structured-data-viewer.spec.ts` 的 `test_bdd_20_per_page_switch_page_one` 用 `page.locator('select.per-page-select').selectOption('50')`——程序化设置，绕过真实 UI 交互
- 同文件 `test_bdd_19_default_per_page_100` 用 `toHaveValue('100')`——只验证初始值，不验证下拉交互
- 所以 P6 验收 53/53 PASS 但用户真实点击仍然失败

**修复方向**：
- 方案 A（推荐）：用自定义下拉组件（如 BaseSelect / 复用现有 Dropdown 模式）替代原生 select，遵循 DESIGN.md 交互规范（触达目标 ≥44px、hover/focus 状态、选项列表样式）
- E2E 测试改为真实点击流程（`click()` 打开 → `click()` 选项），不再用 `selectOption()` 绕过
- 或保留原生 select 但增加 `appearance: none` + 自定义箭头 + 足够触达区域

**P6 验收要求**：per-page 下拉框必须通过真实点击验证（点击弹出 → 点击选项 → 行数变化 → 回到第一页）

### P4: 滚动到底端抖动

**现象**：在详情页内容区滚动到底端后继续滚动（滚轮/触控板），页面出现抖动/弹跳。

**根因**：`useResponsiveLayout.setupScrollHide` 的 scroll 事件处理缺少边界保护——滚到底端后浏览器的橡皮筋效果/overscroll 产生微小 scrollTop 变化，可能触发 `current < lastScrollTop` → metaTagsHidden 切换 → header 高度变化 → content-area 高度变化 → 抖动。

**缺失**：
1. content-area 无 `overscroll-behavior: none` 阻止边界弹跳
2. setupScrollHide 无底端边界保护（如 `scrollTop + clientHeight >= scrollHeight - 5` 时不切换）

**修复方向**：
- `.content-area { overscroll-behavior: y none; }` 阻止边界弹跳
- setupScrollHide 加底端/顶端边界保护（到底端后不再切换 metaTagsHidden）

## 3. 环境约束

```yaml
debug_env: "make debug-quick (127.0.0.1:8888, 独立数据目录 /tmp/peekview-debug/)"
isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认测试数据在 debug DB"
prod_not_touched: "[PROD_NOT_TOUCHED]"
```

## 4. 已知风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| P2 修复可能引入 CodeViewer 在非切换路径（fallback）的高度问题 | fallback CodeViewer 也用同一 CSS | 两个路径都要验证 |
| P3 padding 修复可能与其他 viewer 的 padding 冲突 | TableView/TreeView 也有边距 | 方案 B 只改 MarkdownViewer 不影响其他 |
| P1 SVG 修复后 isImage 分支需要验证 SVG 的特殊渲染 | SVG 既是图片又是代码 | ImageViewer 已有 SVG 支持（可切换代码/预览） |
| P5 下拉框修复可能引入新组件依赖 | 自定义下拉组件 vs 原生 select | 优先复用现有 Dropdown/BaseSelect 模式 |
| 5 个修复可能互相影响 | content-area padding + overflow + scroll-hide + select 联动 | P6 必须 Playwright 实跑验收（真实点击，非 selectOption） |

## 5. 裁剪倾向

```yaml
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
```

理由：
- 涉及前端核心渲染链（EntryDetailContent 调度链），改动影响所有详情页
- 有跨组件交互（content-area 滚动 + CodeViewer flex + Markdown padding + scroll-hide 联动）
- T084 的回归说明这类改动必须 P6 实跑验收
- 用户明确反馈了 4 个用户可见问题，需要 vision 验证
- 不可裁剪 P2（设计不可裁）+ P6（验收不可裁）

## 6. 范围声明

### 改什么

| 文件 | 改动 | 问题 |
|------|------|------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | 新增 isSvg computed | P1 |
| `frontend-v3/src/components/EntryDetailContent.vue` | 调度链 isXml 排除 SVG | P1 |
| `frontend-v3/src/styles/code.css` | .code-body 恢复 flex:1 + min-height:0 | P2 |
| `frontend-v3/src/components/MarkdownViewer.vue` | .markdown-body scoped padding 恢复 | P3 |
| `frontend-v3/src/styles/markdown.css` | 全局 padding 移动端 media query 恢复 | P3 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | setupScrollHide 边界保护 | P4 |
| `frontend-v3/src/components/EntryDetailContent.vue` | content-area overscroll-behavior | P4 |
| `frontend-v3/src/components/TableView.vue` | per-page 下拉框改自定义组件 + E2E 改真实点击 | P5 |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | BDD-19/20 改真实点击验证 select | P5 |

### 不改什么

- 后端（language.py .svg → 'xml' 映射不变——SVG 确实是 XML）
- MCP Server
- 数据库 schema
- TableView/TreeView/DataTreeNode 组件内部逻辑
- 路由

### 测试数据需求

seed-data 已有 `svg-standalone` entry（独立 SVG 文件）、`svg-icons` entry（多 SVG）、`markdown-test` entry（长 Markdown 318 行+）、`product-screenshots` entry（PNG+SVG 混合）。这些数据足够覆盖 4 个修复的验证路径。
