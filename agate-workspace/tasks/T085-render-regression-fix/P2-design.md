---
phase: P2
task_id: T085-render-regression-fix
type: design
parent: P1-requirements.md
trace_id: T085-P2-20260802
status: draft
created: 2026-08-02
agent: architect
---

# P2 方案设计 — T085 详情页渲染回归修复

## 影响域分析

### 改什么

| 文件 | 改动 | 缺陷 |
|------|------|------|
| `frontend-v3/src/composables/useEntryDetailComputed.ts` | 新增 `isSvg` computed；`isRichRenderable` 排除 SVG | P1 |
| `frontend-v3/src/components/EntryDetailContent.vue` | 调度链 `isXml` → `isXml && !isSvg`；content-area 加 `overscroll-behavior: y none` | P1/P4 |
| `frontend-v3/src/views/EntryDetailView.vue` | 传递 `isSvg` prop 给 EntryDetailContent | P1 |
| `frontend-v3/src/styles/code.css` | `.code-body` 恢复 `flex: 1; min-height: 0` | P2 |
| `frontend-v3/src/components/MarkdownViewer.vue` | `.markdown-body` scoped style 恢复 padding | P3 |
| `frontend-v3/src/styles/markdown.css` | 全局 `.markdown-body` padding 桌面/移动端 media query | P3 |
| `frontend-v3/src/composables/useResponsiveLayout.ts` | `setupScrollHide` 加底端/顶端边界保护 | P4 |
| `frontend-v3/src/components/TableView.vue` | per-page 原生 select 改自定义下拉组件 | P5 |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | BDD-19/20 改真实点击验证 | P5 |
| `frontend-v3/e2e/render-regression.spec.ts`（新增） | T085 11 BDD 的 E2E 验收 | P1-P5 |

### 不改什么

- 后端 `language.py`（.svg → xml 映射保持）
- MCP Server / CLI / DB schema / 路由
- `useEntryDetailComputed` 的 `isImage` 语义（已正确识别 SVG）
- ImageViewer / TreeView / DataTreeNode / Pagination 组件内部逻辑
- `sourceViewMode` 状态管理逻辑（切文件重置等）
- content-area 的 `overflow-y: auto`（T084 滚动架构核心，保持）

### 风险在哪

| 风险 | 影响 | 缓解 |
|------|------|------|
| isRichRenderable 排除 SVG 后，现有 XML 文件的 toggle 按钮行为 | 普通 XML 仍 isXml=true 且 isSvg=false，不受影响 | BDD-2 守护 |
| .code-body flex:1 可能影响 CodeViewer 在非切换路径的布局 | fallback CodeViewer 共用同一 CSS | BDD-4 + BDD-5 双路径验证 |
| Markdown padding 恢复可能与 content-area padding 叠加 | 双层 padding 导致边距过大 | 方案 B 只改 .markdown-body，content-area padding 不变；P6 测量验证 |
| 自定义下拉组件引入新交互复杂度 | 键盘操作/焦点管理/外部点击关闭 | 参照 OverflowMenuDropdown 模式；BDD-11 键盘验证 |
| scroll-hide 边界保护阈值选择不当 | 正常滚动被误判为边界 | 阈值 5px + 仅锁定状态不切换，不改变已有逻辑 |

---

## §1 候选方案

### 缺陷 P1 — SVG 调度修复

**follows_existing_pattern**: `frontend-v3/src/composables/useEntryDetailComputed.ts`（现有 isImage/isXml 等 computed 模式）

### 方案 A（选择）：新增 isSvg computed + 调度链排除 + isRichRenderable 排除

- `useEntryDetailComputed.ts`：
  - 新增 `isSvg: ComputedRef<boolean> = computed(() => guessMimeType(activeFile.value?.filename ?? '') === 'image/svg+xml')`
  - `isRichRenderable` 改为 `isCsv || isTsv || isJson || isYaml || (isXml && !isSvg) || isMarkdown`
- `EntryDetailContent.vue`：
  - 调度链第40行 `isCsv || isTsv || isJson || isYaml || isXml` → `isCsv || isTsv || isJson || isYaml || (isXml && !isSvg)`
  - 新增 `isSvg` prop
- `EntryDetailView.vue`：传递 `isSvg` prop

**优点**：最小改动，复用现有 computed 模式；isRichRenderable 排除 SVG 使 toggle 按钮对 SVG 隐藏（满足 BDD-3）；SVG 落入 isImage 分支走 ImageViewer。
**风险**：isSvg 同时依赖 filename（mime）和 language（xml），两个维度——但 SVG 文件 language 必为 xml 且 mime 必为 image/svg+xml，逻辑自洽。
**工作量**：~15 行改动。

### 方案 B（否决）：调度链统一用 mime 判断

- 废弃 isXml/isCsv 等 language-based 判断，统一用 `guessMimeType` + 自定义 mime 分类
- 重写整个调度链

**优点**：从根本上消除 language/mime 双维度混用问题。
**风险**：改动面巨大，影响所有富渲染格式调度；现有 84 E2E 断言有回归风险；超出缺陷修复范围。
**否决理由**：P0-brief 已声明"留后续评估"，YAGNI——当前只需修 SVG 一个 case。

---

### 缺陷 P2 — 源码视图滚动

**follows_existing_pattern**: `frontend-v3/src/styles/code.css`（T084 之前的原有 flex 模式）

### 方案 A（选择）：.code-body 恢复 flex:1 + min-height:0（不恢复 overflow:auto）

- `code.css` 第38-39行 `.code-body {}` → `.code-body { flex: 1; min-height: 0; }`
- 不恢复 `overflow: auto`（让 content-area 滚动，符合 DESIGN.md §9）

**优点**：恢复 T084 前的 flex 高度传递；content-area 作为唯一滚动容器；最小改动。
**风险**：min-height:0 允许 flex 子元素收缩，需验证 content-area 滚动因子正确传递。
**工作量**：1 行 CSS。

### 方案 B（否决）：.code-body 恢复 overflow:auto 自行滚动

- `.code-body { flex: 1; min-height: 0; overflow: auto; }`

**优点**：CodeViewer 自行滚动，不依赖 content-area。
**风险**：违反 DESIGN.md §9「Viewer components must not declare overflow-y: auto」；引入双滚动容器；与 T084 架构冲突。
**否决理由**：违反设计规范。

---

### 缺陷 P3 — Markdown 边距

### 方案 A：content-area padding 增大

- content-area `padding: var(--space-6)` (32px) 桌面 / `var(--space-3)` (12px) 移动

**优点**：单点修改。
**风险**：影响所有 viewer（CodeViewer/TableView/TreeView/HtmlViewer/ImageViewer），超出缺陷范围（IM-3）；可能破坏现有布局。
**否决理由**：违反 IM-3「只影响 Markdown」。

### 方案 B（选择）：MarkdownViewer .markdown-body 恢复 scoped padding

- `MarkdownViewer.vue` scoped style：`.markdown-body { padding: var(--space-5); max-width: 900px; margin: 0 auto; }`（var(--space-5) = 2rem = 32px 桌面）
- `markdown.css` 全局：移动端 media query `@media (max-width: 640px) { .markdown-body { padding: var(--space-3); } }`（var(--space-3) = 12px → 需 16px，用 var(--space-4) = 16px）

**优点**：只影响 Markdown 渲染视图（IM-3）；各 viewer 独立管理 padding；符合 DESIGN.md §6「Padding: 32px desktop, 16px mobile」。
**风险**：scoped padding 与全局 markdown.css 的优先级——scoped 有 data-v 属性选择器，优先级高于全局；但 markdown.css 第2行 `max-width: none` 会覆盖 scoped 的 `max-width: 900px`。需确认 padding 不被覆盖。
**工作量**：~5 行 CSS。
**注意**：BDD-6/7 测量的是「渲染内容左/右边缘与所在内容区域左/右边缘的水平距离」——content-area 已有 16px padding，.markdown-body 再加 32px = 总 48px ≥ 32px 满足。移动端 content-area 8px + .markdown-body 16px = 24px ≥ 16px 满足。

---

### 缺陷 P4 — 滚动抖动

### 方案 A（选择）：overscroll-behavior + setupScrollHide 边界保护

- `EntryDetailContent.vue` content-area CSS：`overscroll-behavior: y none;`
- `useResponsiveLayout.ts` setupScrollHide：
  - 底端保护：`if (current + container.clientHeight >= container.scrollHeight - 5) { lastScrollTop = current; return; }`（到底端不再切换）
  - 顶端保护：`if (current <= 5) { metaTagsHidden.value = false; lastScrollTop = current; return; }`（到顶端强制显示）

**优点**：CSS + JS 双层防护；overscroll-behavior 阻止边界弹跳传递；边界保护消除无意义翻转；保持正常滚动行为（IM-4）。
**风险**：阈值 5px 需验证——太小无效，太大误判。5px 是 scroll 事件的常见粒度。
**工作量**：~10 行。

### 方案 B（否决）：仅加 overscroll-behavior，不改 setupScrollHide

**优点**：最小改动。
**风险**：overscroll-behavior 只阻止弹跳传递，不阻止 scroll 事件中的微小 scrollTop 变化触发的状态翻转——P0 根因之一就是 setupScrollHide 无边界保护。
**否决理由**：不完整修复。

---

### 缺陷 P5 — per-page 下拉框

### 方案 A（选择）：自定义下拉组件（参照 OverflowMenuDropdown 模式）

- `TableView.vue`：
  - 移除原生 `<select>`，替换为自定义下拉：触发按钮（显示当前值 + 箭头）+ 弹出选项列表
  - 触达目标 ≥44px（min-height: 44px）
  - 键盘支持：Enter/Space 打开、方向键导航、Enter 选择、Escape 关闭
  - 外部点击关闭（click outside）
  - aria-haspopup="listbox" / role="listbox" / role="option"
- 选项固定 50/100/500，内联在 TableView（不抽独立组件——只有这一处使用，YAGNI）

**优点**：完全可控交互；真实点击可弹出选中；触达目标达标；键盘可操作（BDD-9/10/11）；遵循 DESIGN.md §10 a11y。
**风险**：新增交互逻辑（弹出/关闭/键盘），需充分测试；参照 OverflowMenuDropdown 模式降低风险。
**工作量**：~80 行（template + script + style）。

### 方案 B（否决）：保留原生 select + appearance:none + 自定义箭头

- `appearance: none` 去除原生样式 + 自定义箭头 + `min-height: 44px`

**优点**：改动最小；保留原生 a11y。
**风险**：P0 根因之一是"真实点击无法弹出"——appearance:none 不解决弹出问题；原生 select 弹出行为依赖 OS/浏览器，CDP 环境可能仍有问题；BDD-9 要求真实点击弹出选中，原生 select 在该环境下不可靠。
**否决理由**：不解决核心问题（真实点击无法弹出）。

---

## 声明字段

```yaml
packages:
  - frontend-v3
  - frontend-v3-e2e
domains:
  - frontend
  - test/e2e
ui_affected: true
ui_interactions_to_cover:
  - SVG 文件默认显示图片预览（BDD-1）
  - SVG 文件不显示源码切换按钮（BDD-3）
  - 源码视图纵向滚动到底（BDD-4/5）
  - Markdown 渲染边距 32px/16px（BDD-6/7）—— vision 截图测量
  - 底端滚动不抖动（BDD-8）—— vision 截图对比
  - per-page 下拉框真实点击选中 + 回第1页（BDD-9）—— 禁用 selectOption
  - per-page 触达目标 ≥44px（BDD-10）—— vision 测量
  - per-page 键盘操作（BDD-11）
gate_commands:
  P3_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_frontend: "cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30"
  P5_typecheck: "cd frontend-v3 && npx vue-tsc --noEmit"
  P5_build: "cd frontend-v3 && npm run build"
  P5_e2e: "E2E_SPEC=e2e/render-regression.spec.ts make debug-test"
  project_module: "src/"
```

## env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick (127.0.0.1:8888, 独立数据目录 /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认测试数据在 debug DB"
  prod_not_touched: "[PROD_NOT_TOUCHED]"
```

## files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/composables/useEntryDetailComputed.ts
    why: P1 新增 isSvg computed + 改 isRichRenderable（参照现有 isImage/isXml 模式）
  - path: frontend-v3/src/components/EntryDetailContent.vue:33-52
    why: P1 调度链 + P4 content-area CSS（overscroll-behavior）
  - path: frontend-v3/src/views/EntryDetailView.vue:157-178
    why: P1 传递 isSvg prop + sourceViewMode 重置逻辑确认
  - path: frontend-v3/src/styles/code.css:38-39
    why: P2 .code-body 恢复 flex:1 + min-height:0
  - path: frontend-v3/src/components/MarkdownViewer.vue:124-128
    why: P3 .markdown-body scoped padding 恢复
  - path: frontend-v3/src/styles/markdown.css:1-2
    why: P3 全局 padding + 移动端 media query
  - path: frontend-v3/src/composables/useResponsiveLayout.ts:26-43
    why: P4 setupScrollHide 边界保护
  - path: frontend-v3/src/components/TableView.vue:60-72,165-168,269-307
    why: P5 per-page 自定义下拉组件（参照 OverflowMenuDropdown 模式）
  - path: frontend-v3/src/components/OverflowMenuDropdown.vue
    why: P5 自定义下拉的参照模式（弹出/关闭/样式）
  - path: frontend-v3/src/utils/mime.ts:3
    why: P1 确认 svg → image/svg+xml 映射
  - path: frontend-v3/e2e/structured-data-viewer.spec.ts:139-155
    why: P5 BDD-19/20 改真实点击（现有 selectOption 盲区）
  - path: DESIGN.md:268-276
    why: §9 滚动架构约束（Viewer 不得 overflow-y:auto）
```

## minimal_validation

```yaml
minimal_validation:
  - assumption: "guessMimeType('.svg') 返回 'image/svg+xml'，isImage computed 已识别 SVG"
    method: "读 mime.ts:3 确认映射"
    result: "confirmed"
    note: "mime.ts:3 svg: 'image/svg+xml'；useEntryDetailComputed isImage 第32行检查此值。纯代码逻辑，无外部系统依赖"
  - assumption: "SVG 走 ImageViewer 的 data:image/svg+xml;base64 URI 可渲染"
    method: "读 ImageViewer.vue loadImage() 逻辑"
    result: "confirmed"
    note: "ImageViewer 用 api.getFileAsBase64 + data:mime;base64 拼接，浏览器原生支持 SVG data URI。纯代码逻辑，依赖 api.getFileAsBase64 + guessMimeType"
  - assumption: ".code-body flex:1 + min-height:0 在 flex 容器中正确传递高度给 content-area 滚动"
    method: "CSS flex 布局标准行为"
    result: "not_needed"
    note: "纯代码逻辑，无外部系统依赖。flex:1 填充剩余空间，min-height:0 允许收缩，content-area overflow-y:auto 作为滚动容器"
  - assumption: "overscroll-behavior:none 阻止边界弹跳"
    method: "CSS 标准属性"
    result: "not_needed"
    note: "纯 CSS 标准属性，浏览器原生支持"
  - assumption: "原生 select 在 CDP Chrome 真实点击无法弹出"
    method: "P0-brief 用户反馈 + E2E selectOption 绕过确认"
    result: "confirmed"
    note: "方案 A 改自定义组件绕过原生 select，不依赖原生 select 行为，无需额外验证"
```

## 实现完成的标志

| 缺陷 | 完成标志 | 对应 BDD |
|------|---------|---------|
| P1 | .svg 文件默认显示 ImageViewer 图片预览；普通 .xml 仍显示 TreeView；SVG 无 toggle 按钮 | BDD-1/2/3 |
| P2 | 富渲染源码视图 + 普通 fallback 源码视图均可纵向滚动到底 | BDD-4/5 |
| P3 | 桌面 Markdown 左右留白 ≥32px；移动端 ≥16px | BDD-6/7 |
| P4 | 底端持续滚动不触发头部元信息翻转/弹跳 | BDD-8 |
| P5 | 真实点击 per-page 可弹出并选中；触达目标 ≥44px；键盘可操作 | BDD-9/10/11 |
| 防回归 | 现有 vitest 1177 passed / E2E 84 断言不受影响 | IM-6 |

## [SCOPE+] 检查

无新隐含需求。P1 IM-1~IM-7 均已在方案中覆盖。

## 设计决策记录

1. **isSvg 用 mime 判断而非 language**：SVG 文件 language='xml'（后端映射），但 mime='image/svg+xml'。用 mime 判断 isSvg 与 isImage 的判断维度一致，避免 isSvg 和 isImage 对同一文件得出矛盾结论。

2. **isRichRenderable 排除 SVG 用 `isXml && !isSvg` 而非移除 isXml**：普通 XML 文件（isXml=true, isSvg=false）仍需 toggle 按钮；只有 SVG（isXml=true, isSvg=true）排除。

3. **P3 移动端 padding 用 var(--space-4)=16px 而非 var(--space-3)=12px**：DESIGN.md §6 明确「16px mobile」，var(--space-4)=16px 精确匹配。

4. **P5 不抽独立 PerPageSelect 组件**：只有 TableView 一处使用，YAGNI。内联在 TableView 中降低复杂度。

5. **P4 顶端保护强制 metaTagsHidden=false**：到顶端时用户意图是看头部信息，强制显示符合预期（IM-4 正常滚动行为）。
