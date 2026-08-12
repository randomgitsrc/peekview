---
phase: P3
task_id: T084-detail-scroll-architecture
type: test-cases
parent: P2-design.md
trace_id: T084-P3-20260731
status: draft
created: 2026-07-31
agent: test-designer
---

# P3 测试用例 — T084 详情页滚动架构统一

test_code_dir: docs/tasks/T084-detail-scroll-architecture/P3-test-code

## 测试文件清单

| 文件 | 框架 | 覆盖 BDD |
|------|------|----------|
| `P3-test-code/useResponsiveLayout.spec.ts` | vitest (jsdom) | BDD-04, BDD-05, BDD-06 |
| `P3-test-code/t084-scroll-architecture.spec.ts` | Playwright (E2E) | BDD-01, BDD-02, BDD-03, BDD-07, BDD-08, BDD-09, BDD-10 |

## BDD → 测试用例映射

### BDD-01: MarkdownViewer 内容超出视口时由 content-area 滚动

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_01_markdown_content_area_scrolls` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个 markdown 文件，且内容高度超过视口 |
| When | 用户在内容区域向下滚动 |
| Then | `.content-area` 的 `scrollTop` 增大；`.markdown-viewer` 的 `scrollTop` 保持 0 |
| 红灯原因 | 当前 `.markdown-viewer` 有 `height:100%; overflow:auto`，它是独立 scroll container，内部滚动不会改变 `.content-area` 的 scrollTop |

### BDD-02: CodeViewer 内容超出视口时由 content-area 滚动

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_02_code_content_area_scrolls` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个代码文件，且代码行数超过视口高度 |
| When | 用户在内容区域向下滚动 |
| Then | `.content-area` 的 `scrollTop` 增大；`.code-body` 的 `scrollTop` 保持 0 |
| 红灯原因 | 当前 `.code-body` 有 `overflow:auto; flex:1; min-height:0`，它是独立 scroll container |

### BDD-03: CodeViewer 保留横向滚动

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_03_code_horizontal_scroll_retained` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个代码文件，且某行代码宽度超过视口 |
| When | 用户在代码区域横向滚动 |
| Then | 代码内容可以横向滚动查看（`.code-body` 或 `pre` 的 `scrollLeft` 增大） |
| 红灯原因 | 此测试验证的是改动后横向滚动仍然可用。改动前 `.code-body` 是 `overflow:auto`（双向），改后变为 `overflow-x:auto`。此测试在 P3 阶段应该通过（因为当前 `overflow:auto` 也支持横向滚动），但为保持 BDD 覆盖完整性仍包含。实际上此测试在 P3 红灯原因是：测试依赖 `.content-area` 作为唯一纵向滚动容器（先验证纵向滚动在 content-area），而当前 `.code-body` 抢走了纵向滚动，导致前置条件不满足 |

### BDD-04: 移动端向下滚动隐藏 meta-tags-bar

| 字段 | 值 |
|------|-----|
| 测试文件 | `useResponsiveLayout.spec.ts` |
| 测试名 | `test_bdd_04_scroll_down_hides_meta_tags` |
| 类型 | vitest (jsdom) — composable 单测 |
| Given | setupScrollHide 绑定到一个容器，metaTagsHidden 初始为 false |
| When | 容器 scrollTop 从 0 变为 >10 且大于 lastScrollTop（向下滚动） |
| Then | `metaTagsHidden.value` 变为 `true` |
| 红灯原因 | 当前 `setupScrollHide` 使用 `findScrollable` 查找子元素，如果子元素是 scroll container（当前 `.markdown-viewer` 是），则监听的是子元素而非传入的 container。测试直接在传入的 container 上触发 scroll 事件，当前实现不会监听 container 的 scroll 事件（而是监听 findScrollable 找到的子元素），因此 metaTagsHidden 不会变为 true |

### BDD-05: 移动端向上滚动恢复 meta-tags-bar

| 字段 | 值 |
|------|-----|
| 测试文件 | `useResponsiveLayout.spec.ts` |
| 测试名 | `test_bdd_05_scroll_up_restores_meta_tags` |
| 类型 | vitest (jsdom) — composable 单测 |
| Given | setupScrollHide 绑定到一个容器，metaTagsHidden 已为 true |
| When | 容器 scrollTop 减小（向上滚动） |
| Then | `metaTagsHidden.value` 变为 `false` |
| 红灯原因 | 同 BDD-04，当前实现监听的是 findScrollable 找到的子元素而非传入的 container |

### BDD-06: 桌面端不渲染 meta-tags-bar 且 scroll-hide 不触发

| 字段 | 值 |
|------|-----|
| 测试文件 | `useResponsiveLayout.spec.ts` |
| 测试名 | `test_bdd_06_desktop_no_scroll_hide_trigger` |
| 类型 | vitest (jsdom) — composable 单测 |
| Given | setupScrollHide 绑定到一个容器 |
| When | 容器触发 scroll 事件（模拟滚动） |
| Then | `metaTagsHidden.value` 保持 `false`（scroll-hide 逻辑不应改变状态——因为桌面端不渲染 meta-tags-bar，scroll-hide 调用方不应在桌面端调用 setupScrollHide） |
| 红灯原因 | 当前 `setupScrollHide` 不区分桌面/移动端，任何调用都会绑 scroll 事件。改后设计预期桌面端不调用 setupScrollHide（EntryDetailView 的调用逻辑不变，但测试验证 composable 本身在容器滚动时仍会改变 metaTagsHidden——这是 composable 行为，桌面/移动端区分在调用方）。此测试验证的是：改后 setupScrollHide 直接监听 container（而非 findScrollable），scroll 事件正确触发。当前实现因 findScrollable 不监听 container，所以 scroll 事件不触发 metaTagsHidden 变化 → 红灯 |

### BDD-07: 点击 TOC 标题锚点滚动到正确位置

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_07_toc_anchor_jump_correct_offset` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个有多级标题的 markdown 文件，内容超出视口，TOC 可见 |
| When | 用户点击 TOC 中的某个标题 |
| Then | 对应标题可见且不被 sticky header 遮挡（标题顶部距 `.content-area` 顶部的偏移量在 75px-85px 范围内） |
| 红灯原因 | 当前 `.markdown-viewer` 是 scroll container，`scrollIntoView` 在 `.markdown-viewer` 内部滚动，`scroll-margin-top:80px` 参考的是 `.markdown-viewer` 的顶部而非 `.content-area` 的顶部，sticky header 在 `.markdown-viewer` 外部，标题被遮挡 |

### BDD-08: 移动端 markdown 内容只有一层 padding

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_08_mobile_markdown_single_padding` |
| 类型 | Playwright E2E |
| Given | 移动端详情页打开一个 markdown 文件 |
| When | 检查 `.content-area` 和 `.markdown-body` 的 computed padding |
| Then | `.markdown-body` 的 `paddingTop` 为 `0px`（padding 仅由 `.content-area` 单层承担） |
| 红灯原因 | 当前 `.markdown-body` 有 scoped `padding:2rem`（32px），computed paddingTop 为 32px 而非 0px |

### BDD-09: HtmlViewer iframe 仍正确撑满

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_09_htmlviewer_iframe_fills_content_area` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个 HTML 文件 |
| When | 页面渲染完成 |
| Then | iframe 撑满 `.content-area` 的可视区域（iframe 高度等于 `.content-area` 的 clientHeight） |
| 红灯原因 | 此测试验证 HtmlViewer 不受影响。当前 `.html-viewer` 有 `height:100%; overflow:hidden`，iframe 高度等于 `.html-viewer` 高度。改后 HtmlViewer 不变，此测试应该通过。但当前 `.content-area` 有 `padding:var(--space-4)`，iframe 高度等于 content-area clientHeight（含 padding 的 content-box），测试断言 iframe 高度 === content-area clientHeight。当前实现已满足此条件，此测试在 P3 可能绿。为保持 BDD 覆盖完整性包含此测试，如 P3 gate 检测为绿则视为回归保障测试 |

### BDD-10: ImageViewer 图片仍正确显示

| 字段 | 值 |
|------|-----|
| 测试文件 | `t084-scroll-architecture.spec.ts` |
| 测试名 | `test_bdd_10_imageviewer_image_displays_correctly` |
| 类型 | Playwright E2E |
| Given | 详情页打开一个图片文件 |
| When | 图片加载完成 |
| Then | 图片在 `.content-area` 可视区域内居中显示（不塌陷或溢出） |
| 红灯原因 | 同 BDD-09，此测试验证 ImageViewer 不受影响。当前 `.image-viewer` 有 `height:100%; overflow:hidden`，改后不变。测试验证图片元素可见且高度 > 0。当前实现已满足，此测试在 P3 可能绿 |

### BDD-11: 现有前端单测全部通过

| 字段 | 值 |
|------|-----|
| 声明 | **P6 手动验收** — 回归保障，无可测试行为 |
| 验证命令 | `make test-frontend` |
| 期望 | 0 failed |

### BDD-12: 类型检查零错误

| 字段 | 值 |
|------|-----|
| 声明 | **P6 手动验收** — 回归保障，无可测试行为 |
| 验证命令 | `make typecheck` |
| 期望 | 0 errors |

### BDD-13: 前端构建成功

| 字段 | 值 |
|------|-----|
| 声明 | **P6 手动验收** — 回归保障，无可测试行为 |
| 验证命令 | `make build-frontend` |
| 期望 | 构建成功，产物输出到 `backend/peekview/static/` |

### BDD-14: DESIGN.md 包含 Scroll Architecture 决策

| 字段 | 值 |
|------|-----|
| 声明 | **P6 手动验收** — 文档补充，无可测试行为 |
| 验证方式 | 检查 DESIGN.md §9 包含「Scroll Architecture」小节 |
| 期望 | 小节存在且声明 `.content-area` 是唯一纵向滚动容器 |

## vitest mock hoisting 注意事项

本任务的 vitest 测试（`useResponsiveLayout.spec.ts`）不使用 `vi.mock()`（不需要 mock 任何模块），直接导入 composable 进行测试。因此不存在 mock hoisting 反模式风险。

## Playwright viewport 配置

E2E 测试文件中配置两个 viewport：
- 桌面端：1280×800（BDD-01/02/03/07/09/10）
- 移动端：390×844（BDD-08）

截图存入 `docs/tasks/T084-detail-scroll-architecture/evidences/`。
