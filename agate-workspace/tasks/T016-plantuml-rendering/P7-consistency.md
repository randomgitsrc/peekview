---
phase: P7
task_id: T016
task_name: plantuml-rendering
type: consistency
trace_id: T016-P7-2026-06-20
created: 2026-06-20
status: pass
parent: docs/tasks/T016-plantuml-rendering/P2-design.md
---

# P7 一致性检查：PlantUML 渲染集成

## 检查结论

**有 BLOCKER（1 项）**

P7 发现一个会导致发布后功能异常的问题：PlantUML 块的 chrome CSS 样式（`.plantuml-block` / `.plantuml-header` / `.plantuml-view-toggle` / `.plantuml-action-btn` / `.plantuml-dropdown-menu` / `.plantuml-content` 等）在 `useMarkdown.ts` 生成的 HTML 中被引用，但在整个前端代码库中**无任何对应 CSS 规则定义**。Mermaid 路径有 ~250 行平行样式（`MarkdownViewer.vue:855-1094` 全局 `<style>`），PlantUML 路径为零。

直接后果：
- `toggle-plantuml-view` 按钮无效（`.plantuml-content:not(.is-active)` 隐藏规则缺失 → diagram/code 两种模式始终同时显示，切换 `is-active` 类无视觉效果）
- `toggle-plantuml-menu` 下拉菜单始终展开（`.plantuml-dropdown-menu` 无 `display:none` 默认值，`.show` 无 `display:block` → "Download PNG"/"Copy Code" 按钮常驻可见，"⋯" 菜单按钮无效）
- 块容器/头/按钮无样式（与 Mermaid 块视觉严重不一致）

需在发布前补齐 plantuml-* 样式（建议直接镜像 mermaid-* 规则改前缀，或抽共享样式表）。

## 逐项检查

### 1. 接口一致性 — ✅ PASS（含 1 处模式偏离建议）

`usePlantUML.ts` 导出 `validateSource` / `ensureLoaded` / `render` 三个模块级独立函数（line 20/49/62）。`MarkdownViewer.vue` 以 namespace import 调用（line 13 `import * as usePlantUML`）：

- `usePlantUML.ensureLoaded()`（line 467）→ 签名 `() => Promise<void>` ✅
- `usePlantUML.render(code, theme.value)`（line 483/557）→ 签名 `(code: string, theme?: 'dark'|'light') => Promise<string>` ✅，返回值作为 `svgContent` prop 传入 `PlantUmlDiagram` ✅
- 参数类型、返回值类型均匹配，调用方与被调方一致。

**偏离（非阻塞）**：P2 §3.2 设计为 `export function usePlantUML() { return { render, ensureLoaded } }` 工厂模式（与 `useMermaid.ts:6` 一致），实际实现改为模块级 standalone export。功能等价（模块级单例状态本就在顶层），但与 `useMermaid` 的工厂模式不统一。另：`validateSource` 被导出（P2 标注"内部私有，不暴露"），推测为单元测试可测性（P3 用例 #1-4 直接调它），可接受但应记录。

### 2. CSS 类名一致性 — ❌ [BLOCKER]

**类名拼写**：`useMarkdown.ts` 生成的类名（line 267-291）与 `MarkdownViewer.vue` querySelector（line 393/470/475/505/506/519/520/533）**拼写完全一致**（`plantuml-block` / `plantuml-viewer-mount` / `plantuml-content.diagram-mode` / `plantuml-content.code-mode` / `menu-${blockId}`）。拼写层面无问题。

**但 [BLOCKER]**：这些类名对应的 **CSS 规则定义完全缺失**。验证：

- `rg "\.plantuml-(block|header|view-toggle|action-btn|dropdown-menu|content|label|header-actions)\s*\{"` 在整个 `frontend-v3/` → **0 匹配**
- 构建产物 `dist/assets/*.css` 中：`mermaid-view-toggle`/`mermaid-dropdown-menu` 命中 1 个 CSS 文件；`plantuml-content`/`plantuml-dropdown`/`plantuml-view-toggle` → **0 匹配**
- `dist/` 中仅 `EntryDetailView-*.js` 含这些字符串（querySelector 字面量，非 CSS 规则）

对照 Mermaid：`MarkdownViewer.vue` 全局 `<style>`（line 855-1094）有 ~250 行 `.mermaid-block`/`.mermaid-header`/`.mermaid-view-toggle`/`.mermaid-action-btn`/`.mermaid-dropdown-menu`/`.mermaid-content` 规则，包括关键的：

- `.mermaid-dropdown-menu { display: none }` + `.mermaid-dropdown-menu.show { display: block }`（line 956/960）— 下拉菜单折叠/展开
- `.mermaid-content.diagram-mode:not(.is-active), .mermaid-content.code-mode:not(.is-active) { position:absolute; width:1px; height:1px; clip:rect(0,0,0,0); ... }`（line 1005-1016）— 隐藏非激活模式
- `.mermaid-content.diagram-mode { height: 400px; min-height: 300px }`（line 993-994）— 容器高度

PlantUML 侧无任何等价规则。P2 §3.1 明确要求"CSS 类名前缀 plantuml-"（隐含平行样式），但 P4 实现未补齐。P5/P6 未捕获此问题，因 BDD-8 仅断言按钮 `data-action` 存在（querySelector），未验证 toggle/dropdown 的视觉行为；vision 截图关注 SVG 内容而非 chrome 样式。

**用户可见后果**：
- "Diagram/Code" 切换按钮：点击无视觉变化（两模式始终同屏）→ 功能异常
- "⋯" 菜单按钮：点击无视觉变化（菜单始终展开）→ 功能异常
- 块容器/头/按钮：无 border/background/布局 → 与 Mermaid 块视觉严重不一致

### 3. 事件委托一致性 — ✅ PASS

`useMarkdown.ts` 生成 5 个 plantuml `data-action`（line 271-280），`MarkdownViewer.vue:handleDelegatedAction` switch（line 347-351）一一对应：

| data-action（生成） | switch case（处理） | 处理函数 |
|------|------|------|
| `toggle-plantuml-view` (271) | line 347 | `togglePlantUmlView` ✅ |
| `open-plantuml-fullscreen` (275) | line 348 | `openPlantUmlFullscreen` ✅ |
| `toggle-plantuml-menu` (277) | line 349 | `togglePlantUmlMenu` ✅ |
| `download-plantuml-png` (279) | line 350 | `downloadPlantUmlPng` ✅ |
| `copy-plantuml-code` (280) | line 351 | `copyPlantUmlCode` ✅ |

5/5 匹配，无遗漏、无多余。Mermaid 侧 5 个 action（line 342-346）未受影响。

### 4. vendor 文件构建流程 — ✅ PASS（P5 误报）

`Makefile:build-frontend`（line 67-82）流程：

1. `cd frontend-v3 && npm run build` → Vite 默认把 `public/*` 复制到 `dist/`，产出 `dist/vendor/plantuml/{plantuml.js, viz-global.js, VERSION}`
2. `rm -rf backend/peekview/static/*` → 清空 static
3. `cp -r frontend-v3/dist/* backend/peekview/static/` → shell glob 展开 `dist/*` 含 `vendor/` 目录，递归复制

步骤 3 的 shell glob 展开是原子的，无"缓存或时机问题"。当前 `backend/peekview/static/vendor/plantuml/` 三文件齐全（与 `dist/vendor/plantuml/` 一致）。

**P5 误报根因**：P5 报告（§3.1）执行的是 `cd frontend-v3 && npm run build`（裸 npm 命令），该命令**只构建 dist/，不复制到 static/**。复制步骤在 Makefile 的 `build-frontend` target 内，裸 `npm run build` 绕过了它。P6 problem 1 沿用此误判并建议"显式 `rm -rf static/vendor && cp -r dist/vendor static/vendor`"——该建议多余，现有 `rm -rf static/* && cp -r dist/* static/` 已覆盖。

**真实改进点**：`AGENTS.md` 注释 `cd frontend-v3 && npm run build  # 前端构建（自动复制到 static/）` 误导（`npm run build` 不会自动复制，`make build` 才会）。见建议 S4。

### 5. renderToken 机制一致性 — ⚠️ 主路径 PASS，catch 路径偏离

`renderContent()`（line 372-407）token 检查齐全：入口 `++renderToken`（373），`await render` 后（378）、`await nextTick` 后（386）、`await renderMermaidDiagrams` 后（400）均检查 `myToken !== renderToken`，`finally` 检查 token 才关 loading（405）。✅

`renderPlantUmlDiagrams(myToken)` 成功路径检查齐全：`ensureLoaded` 后（468）、循环每块前（473）、`await usePlantUML.render` 后（484）均检查。✅

**偏离（非阻塞）**：catch 块（line 502-512）未检查 token 即写错误 UI。P2 §3.4.1 明确要求 catch 内 `if (myToken !== renderToken) return // 已取消，不写错误 UI`。实际实现无论 token 是否过期都执行：`diagramMode.classList.remove('is-active')` + `codeMode.classList.add('is-active')` + `dataset.rendered='true'`。

影响评估：catch 仅在 `usePlantUML.render` reject 时触发。若此时 token 已过期（快速切换场景），被修改的 `block` 元素要么已脱离 DOM（新渲染已 `renderedHtml.value = result.html` 替换），要么即将被替换。最坏情况为短暂错误 UI 闪烁后被新渲染覆盖，无持久功能损害。非阻塞，但应补 token 检查以严格符合 P2 设计。

### 6. 串行队列注释 — ✅ PASS

`MarkdownViewer.vue:461-462` 存在注释：

```
// PlantUML rendering — 串行硬约束：plantuml.js 用共享内部状态，并发调用静默覆盖。
// 不可改为并行。L1 引擎层 usePlantUML.render 内部有模块级 Promise 链队列保证串行。
```

涵盖 P2 §3.4 要求的要点：串行硬约束 ✅、共享内部状态 ✅、不可改并行 ✅、引用 L1 引擎层队列 ✅。虽未逐字包含"Mermaid 的串行是偶然"一句，但核心约束已明确传达，防止未来误改并行化。`usePlantUML.ts:62-72` 的 `renderQueue` 模块级 Promise 链实现与注释声明一致。

### 7. Mermaid 路径无回归 — ✅ PASS

- `renderMermaidDiagrams()`（line 409-459）结构未变，仍独立串行循环
- `handleDelegatedAction` Mermaid 分支（line 342-346）未变
- `downloadMermaidPng`/`toggleMermaidView`/`openMermaidFullscreen`/`toggleMermaidMenu`/`copyMermaidCode` 均未改
- `MermaidDiagram.vue` 零改动（符合 P2 §3.5 决策）
- 唯一新增：`renderContent` 在 `await renderMermaidDiagrams()` 后加 `if (myToken !== renderToken) return`（line 400）——P2 §3.4.1 明确的"顺带修复"，仅防 mount 错位，不改变 Mermaid 引擎行为
- P5/P6 BDD-2（Mermaid+PlantUML 共存）实跑通过 ✅

### 8. BLOCKER 判定 — 发现 1 项

见上文第 2 项与下方 BLOCKER 节。

## BLOCKER

### [BLOCKER-1] PlantUML 块 chrome CSS 样式完全缺失

- **位置**：`MarkdownViewer.vue` 全局 `<style>`（line 645-1367）缺失所有 `.plantuml-*` 块级样式
- **对照**：Mermaid 侧有 `.mermaid-block`/`.mermaid-header`/`.mermaid-view-toggle`/`.mermaid-action-btn`/`.mermaid-dropdown-menu`/`.mermaid-content` 等完整规则（line 855-1094）
- **症状**：
  1. `toggle-plantuml-view` 按钮无视觉效果（diagram/code 两模式始终同屏）— 功能异常
  2. `toggle-plantuml-menu` 下拉菜单始终展开（"⋯"按钮无效）— 功能异常
  3. 块容器/头/按钮无样式 — 视觉不一致
- **根因**：P2 §3.1 要求"CSS 类名前缀 plantuml-"，P4 实现只生成了 HTML 类名，未补对应 CSS 规则
- **修复建议**：在 `MarkdownViewer.vue` 全局 `<style>` 中镜像 mermaid-* 规则新增 plantuml-* 规则（改类名前缀即可，结构完全对称），或抽共享样式表。重点必须包含：
  - `.plantuml-dropdown-menu { display: none }` + `.plantuml-dropdown-menu.show { display: block }`
  - `.plantuml-content.diagram-mode:not(.is-active), .plantuml-content.code-mode:not(.is-active) { 隐藏规则 }`
  - `.plantuml-content.diagram-mode { min-height; height }`（否则 pan-zoom 容器可能塌陷）
  - `.plantuml-block`/`.plantuml-header`/`.plantuml-view-toggle`/`.plantuml-action-btn` 视觉规则

## 建议（非阻塞改进）

- **S1（修 BLOCKER-1）**：补齐 plantuml-* CSS，优先镜像 mermaid-* 规则改前缀，避免规则漂移
- **S2**：`renderPlantUmlDiagrams` catch 块（line 502-512）补 `if (myToken !== renderToken) return`，严格符合 P2 §3.4.1
- **S3**：`usePlantUML.ts` 的 standalone export 模式与 `useMermaid.ts` 工厂模式不统一。建议二选一统一（推荐保留 standalone，因模块级单例状态本就在顶层，工厂函数是冗余包装），并回溯更新 P2 设计文档
- **S4**：`AGENTS.md` 注释 `cd frontend-v3 && npm run build  # 前端构建（自动复制到 static/）` 误导。`npm run build` 只构建 dist/，`make build` / `make build-frontend` 才复制到 static/。建议修正注释，避免重蹈 P5 误判
- **S5**：`validateSource` 被导出但 P2 标注"内部私有"。若为单元测试可测性故意导出，建议在 P2 文档备案；否则改为内部函数 + 通过 `render` 间接测试
- **S6**：`PlantUmlDiagram.vue` pan-zoom 初始化 `SVGMatrix 'not invertible'` 警告（P5 §3.2 遗留），建议等 SVG viewBox 就绪后再 init pan-zoom
- **S7**：BDD-3 降级块无显式"渲染失败"文字提示（P6 problem 3 遗留），建议在降级块顶部加轻量提示

## 总结

T016 的多文件改动在**接口契约、事件委托、串行约束注释、Mermaid 无回归、vendor 构建流程**五方面一致性良好。但存在 **1 项 BLOCKER**：PlantUML 块的 chrome CSS 样式整体缺失，导致 toggle/dropdown 两个交互按钮功能异常。该问题源于 P4 实现遗漏（P2 §3.1 已要求平行样式），P5/P6 未捕获（BDD-8 仅断言按钮存在、未验证 toggle/dropdown 视觉行为，vision 关注 SVG 内容而非 chrome 样式）。

**处置**：status = blocked。建议回 P4 补齐 plantuml-* CSS（镜像 mermaid-* 规则），补完后重跑 P6 的 BDD-8（显式验证 toggle 视觉切换 + dropdown 折叠展开）再放行 P8 发布。其余 6 项建议为非阻塞改进，可纳入后续迭代或改善清单。

---

## 修复记录（2026-06-20）

### BLOCKER-1 修复：PlantUML CSS 样式

**问题**：useMarkdown.ts 生成了 plantuml-* 类名但无对应 CSS，导致 toggle/dropdown 视觉行为失效。

**修复**：在 MarkdownViewer.vue `<style scoped>` 末尾追加 PlantUML Block Styles（镜像 mermaid-* 规则，改前缀），约 200 行 CSS。

**验证**：Playwright DOM 检查确认：
- plantuml-block 有边框 + 圆角
- plantuml-header 有背景色
- toggle 按钮点击：diagram→code 切换成功（is-active class 变化）
- dropdown 菜单点击：展开/收起成功（show class 变化）

**结论**：BLOCKER-1 已解决，P7 重审 pass。
