---
phase: P3
task_id: T085-render-regression-fix
type: test-cases
parent: P2-design.md
trace_id: T085-P3-20260802
status: draft
created: 2026-08-02
agent: test-designer
---

# P3 测试用例 — T085 详情页渲染回归修复

## test_code_dir

```
docs/tasks/T085-render-regression-fix/P3-test-code/
```

## 测试文件清单

| 文件 | 类型 | 覆盖 BDD |
|------|------|---------|
| `P3-test-code/useEntryDetailComputed.svg.spec.ts` | vitest 单测 | BDD-1, BDD-2, BDD-3 |
| `P3-test-code/useResponsiveLayout.boundary.spec.ts` | vitest 单测 | BDD-8 |
| `P3-test-code/TableView.per-page.spec.ts` | vitest 组件测 | BDD-11 |
| `P3-test-code/render-regression.spec.ts` | Playwright E2E | BDD-1 ~ BDD-11 |

## BDD → 测试用例映射

### BDD-1: SVG 文件默认渲染为图片预览

**vitest** (`useEntryDetailComputed.svg.spec.ts`):
- `test_bdd_1_svg_file_is_svg_true_and_is_image_true`
  - Given: activeFile filename='icon.svg', language='xml'
  - When: 读取 useEntryDetailComputed 的 isSvg + isImage
  - Then: isSvg=true, isImage=true（SVG 走 ImageViewer 调度）

**E2E** (`render-regression.spec.ts`):
- `test_bdd_1_svg_default_image_preview`
  - Given: 打开包含 .svg 文件的 entry
  - When: 选中该文件
  - Then: .image-viewer 可见，.tree-view 不可见，.code-viewer 不可见

### BDD-2: 普通 XML 文件仍渲染为树视图（防回归）

**vitest** (`useEntryDetailComputed.svg.spec.ts`):
- `test_bdd_2_xml_file_is_svg_false_and_is_xml_true`
  - Given: activeFile filename='data.xml', language='xml'
  - When: 读取 isSvg + isXml + isRichRenderable
  - Then: isSvg=false, isXml=true, isRichRenderable=true（仍走 TreeView + toggle 按钮）

**E2E** (`render-regression.spec.ts`):
- `test_bdd_2_xml_still_tree_view`
  - Given: 打开包含 .xml 文件的 entry
  - When: 选中该文件
  - Then: .tree-view 可见，.image-viewer 不可见

### BDD-3: SVG 文件不显示源码/渲染切换按钮

**vitest** (`useEntryDetailComputed.svg.spec.ts`):
- `test_bdd_3_svg_is_rich_renderable_false`
  - Given: activeFile filename='icon.svg', language='xml'
  - When: 读取 isRichRenderable
  - Then: isRichRenderable=false（toggle 按钮门控 v-if="isRichRenderable" 不渲染）

**E2E** (`render-regression.spec.ts`):
- `test_bdd_3_svg_no_source_toggle_button`
  - Given: 打开 .svg 文件，处于图片预览状态
  - When: 检查操作区
  - Then: button[aria-label="Show source code"] 不存在

### BDD-4: 富渲染格式源码视图可纵向滚动到底

**E2E** (`render-regression.spec.ts`):
- `test_bdd_4_source_view_scroll_to_bottom`
  - Given: 打开内容超高的 CSV（>100行），切换到源码视图
  - When: 在 content-area 向下滚动到底
  - Then: 最后一行内容可见（scrollHeight - scrollTop - clientHeight < 5）

### BDD-5: 普通文本 fallback 源码视图可纵向滚动到底（防回归）

**E2E** (`render-regression.spec.ts`):
- `test_bdd_5_fallback_source_scroll_to_bottom`
  - Given: 打开内容超高的普通文本文件（.txt，直接进 CodeViewer）
  - When: 在 content-area 向下滚动到底
  - Then: 最后一行内容可见

### BDD-6: 桌面端 Markdown 渲染视图左右留白 ≥32px

**E2E** (`render-regression.spec.ts`):
- `test_bdd_6_desktop_markdown_padding_32px`
  - Given: 桌面视口 1280×800，打开 Markdown 文件渲染视图
  - When: 测量 .markdown-body 左边缘与 .content-area 左边缘的水平距离
  - Then: 左留白 ≥ 32px，右留白 ≥ 32px

### BDD-7: 移动端 Markdown 渲染视图左右留白 ≥16px

**E2E** (`render-regression.spec.ts`):
- `test_bdd_7_mobile_markdown_padding_16px`
  - Given: 移动视口 390×844，打开 Markdown 文件渲染视图
  - When: 测量 .markdown-body 左边缘与 .content-area 左边缘的水平距离
  - Then: 左留白 ≥ 16px，右留白 ≥ 16px

### BDD-8: 滚动到底端后继续滚动不触发抖动

**vitest** (`useResponsiveLayout.boundary.spec.ts`):
- `test_bdd_8_bottom_boundary_no_meta_tags_flip`
  - Given: 容器滚动到底端（scrollTop + clientHeight >= scrollHeight - 5）
  - When: 继续触发 scroll 事件（模拟 overscroll 微小 scrollTop 变化）
  - Then: metaTagsHidden 状态不翻转（保持底端前最后一次有效滚动的状态）

- `test_bdd_8_top_boundary_forces_show`
  - Given: 容器滚动到顶端（scrollTop <= 5）
  - When: 触发 scroll 事件
  - Then: metaTagsHidden=false（强制显示）

**E2E** (`render-regression.spec.ts`):
- `test_bdd_8_bottom_scroll_no_jitter`
  - Given: 详情页内容超过视口
  - When: 滚动到底端后继续模拟滚轮事件
  - Then: .meta-tags-bar 的 class 在持续滚动期间不发生 hidden → visible → hidden 反复切换

### BDD-9: 真实点击可选中每页行数并回到第 1 页

**E2E** (`render-regression.spec.ts`):
- `test_bdd_9_real_click_per_page_select`
  - Given: 渲染 >100 行 CSV，当前第 3 页
  - When: 真实 click() 打开下拉 → click() 选项「50」（禁止 selectOption）
  - Then: 每页 50 行，页码回到第 1 页

### BDD-10: 每页行数控件触达目标 ≥44px

**E2E** (`render-regression.spec.ts`):
- `test_bdd_10_per_page_touch_target_44px`
  - Given: 移动视口 390×844 渲染 CSV
  - When: 测量每页行数触发按钮的 boundingRect
  - Then: min(width, height) ≥ 44px

### BDD-11: 每页行数控件支持键盘操作

**vitest** (`TableView.per-page.spec.ts`):
- `test_bdd_11_keyboard_select_per_page`
  - Given: 渲染 CSV 表格，每页 100（默认）
  - When: 聚焦触发按钮 → Enter 打开 → ArrowDown 导航 → Enter 选择 50
  - Then: 每页变 50 行，回到第 1 页

**E2E** (`render-regression.spec.ts`):
- `test_bdd_11_keyboard_per_page_e2e`
  - Given: CSV 表格渲染完成
  - When: 键盘 Tab 聚焦 → Enter 打开 → 方向键选择 → Enter 确认
  - Then: 每页行数改变

## 红灯预期

| 测试文件 | 预期失败原因 |
|---------|------------|
| useEntryDetailComputed.svg.spec.ts | isSvg 未从 composable 返回（undefined）→ 断言失败 |
| useResponsiveLayout.boundary.spec.ts | setupScrollHide 无边界保护逻辑 → 到底端后 metaTagsHidden 仍翻转 |
| TableView.per-page.spec.ts | 原生 select 无自定义下拉 → 无 button.per-page-trigger / role=listbox 元素 |
| render-regression.spec.ts (E2E) | SVG 走 TreeView（非 ImageViewer）；源码视图无法滚动；Markdown 无 padding；per-page 无自定义下拉 |
