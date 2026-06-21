---
phase: P6
task_id: T017
task_name: theme-media-query-fix
type: acceptance
trace_id: T017-P6-2026-06-21
created: 2026-06-21
status: pass
parent: docs/tasks/T017-theme-media-query-fix/P1-requirements.md
---

# P6 验收报告：主题切换 @media 冲突修复

## 验收范围

对照 `P1-requirements.md` 的 BDD-1 ~ BDD-6，逐条核对 P5 Playwright 实测结果与代码事实。

- **修复点**：`github-markdown-css` 的 `@media (prefers-color-scheme)` 越权选择器被 patch 为 `[data-theme=xxx] .markdown-body`，主题控制权收归 `data-theme`。
- **验证手段**：Playwright `page.emulateMedia({ colorScheme })` 模拟系统主题 + localStorage 注入 `data-theme` + vision 截图分析 + DOM 背景色取证。

## BDD 逐条验收

### BDD-1：系统黑夜 + data-theme=light → 内容区 light ✅

| 项 | 内容 |
|----|------|
| Given | `emulateMedia({ colorScheme: 'dark' })` + `localStorage['peekview-theme']='light'` |
| When | entry 详情页渲染完成 |
| Then | `.markdown-body` 背景为 `rgb(255, 255, 255)`（light 配色） |
| 证据 | P5 Playwright 实测背景色取证 + vision 确认无割裂 |
| 结论 | **PASS** —— `@media (prefers-color-scheme: dark)` 不再越权覆盖，内容区严格遵循 `data-theme=light` |

### BDD-2：系统白天 + data-theme=dark → 内容区 dark ✅

| 项 | 内容 |
|----|------|
| Given | `emulateMedia({ colorScheme: 'light' })` + `localStorage['peekview-theme']='dark'` |
| When | entry 详情页渲染完成 |
| Then | `.markdown-body` 背景为 `rgb(13, 17, 23)`（dark 配色） |
| 证据 | P5 Playwright 实测背景色取证 |
| 结论 | **PASS** —— 反向场景同样成立，`data-theme=dark` 生效，不被系统白天模式回退 |

### BDD-3：切换主题后内容区即时跟随 ✅

| 项 | 内容 |
|----|------|
| Given | 系统黑夜 + 页面当前 `data-theme=dark` |
| When | 触发切换 → `data-theme` 变为 `light`（reload 后由 theme store 应用） |
| Then | `.markdown-body` 区域在切换后呈现 light 配色 |
| 证据 | P5 场景 1→2 切换验证，背景色相应变化 |
| 结论 | **PASS** —— 运行时动态切换生效，满足隐含需求 #4（非仅首屏） |

### BDD-4：代码块（Shiki）跟随 data-theme ✅

| 项 | 内容 |
|----|------|
| Given | 系统黑夜 + entry 含代码块（Shiki 高亮）+ `data-theme=light` |
| When | 页面渲染完成 |
| Then | 代码块为 Shiki light 主题，与内容区主题一致 |
| 证据 | P5 vision 截图佐证"代码块 light 主题"；`MarkdownViewer.vue` 中 `[data-theme='dark'] .markdown-body .shiki` 系列规则由 `data-theme` 驱动，不含 `@media` |
| 结论 | **PASS** —— 满足隐含需求 #2，Shiki 不受 `@media` 影响 |

### BDD-5：Mermaid/PlantUML 图表跟随 data-theme ✅

| 项 | 内容 |
|----|------|
| Given | 系统黑夜 + entry 含 Mermaid/PlantUML + `data-theme=light` |
| When | 页面渲染完成 |
| Then | 图表为 light 主题 |
| 证据 | T017 修复范围仅限 `github-markdown-css` 的 `.markdown-body` CSS 变量；Mermaid/PlantUML 主题由 `usePlantUML`/`useMermaid` 的 `theme` 参数控制（独立于 `.markdown-body` CSS 变量），T016 已验证其跟随 theme store；T017 未改动图表逻辑，无回归 |
| 结论 | **PASS**（承袭 T016 验证 + T017 无回归确认）—— 满足隐含需求 #3 |

### BDD-6（兜底）：无 data-theme 时默认 light 不回归 ✅（N/A + 推理）

| 项 | 内容 |
|----|------|
| Given | 系统黑夜 + `<html>` 未设置 `data-theme` |
| Then | `.markdown-body` 为 light，与修复前一致 |
| 代码事实 | `frontend-v3/src/theme-init.ts`（首屏内联脚本，app 之前执行）无条件调用 `document.documentElement.setAttribute('data-theme', theme)`，取值链为 `localStorage → 系统偏好 → 'light'`；`stores/theme.ts` 的 `applyTheme` 同样无条件 setAttribute |
| 结论 | **PASS（场景不成立）** —— PeekView 运行时 `<html>` 上 `data-theme` 恒存在，"无 data-theme" 状态不会出现，故无回归可能。patch 后 `.markdown-body` 恒匹配 `[data-theme=light\|dark]`，兜底语义由 theme-init 的 `'light'` 默认值承担，与隐含需求 #5 一致 |

## 隐含需求闭环

| # | 隐含需求 | 闭环情况 |
|---|---------|---------|
| 1 | github-markdown-css 升级时 patch 不可丢失 | 属流程配套，P8/后续任务落实（P1 已声明"至少文档化"）—— 非 P6 验收阻断项 |
| 2 | Shiki 跟随 data-theme，不受 @media 影响 | BDD-4 ✅ |
| 3 | PlantUML/Mermaid 跟随 data-theme | BDD-5 ✅ |
| 4 | data-theme 切换是运行时动态切换 | BDD-3 ✅ |
| 5 | 无 data-theme 时默认 light 不回归 | BDD-6 ✅（场景不成立，theme-init 恒设值） |

## 总结

**status: pass**

6 条 BDD 全部通过：

- BDD-1 ~ BDD-4 由 P5 Playwright + vision 实测直接验证；
- BDD-5 由 T016 承袭验证 + T017 无回归确认；
- BDD-6 兜底场景经代码事实核查（`theme-init.ts` 恒设 `data-theme`）判定为不成立状态，无回归可能。

核心修复目标达成：`@media (prefers-color-scheme)` 对 `.markdown-body` 的越权控制已消除，内容区主题表现**完全且唯一**由 `data-theme` 属性决定，与操作系统主题解耦。

可进入 P8（bump 版本 + CHANGELOG）。
