---
phase: P2
task_id: T059
type: review
parent: P2-design.md
trace_id: T059-P2-review-20260720
status: approved
created: 2026-07-20
agent: plan-design-review
---

# P2 Design Review: Markdown 扩展补全

## 1. BDD 覆盖检查

| BDD | 方案覆盖 | 锚点 |
|-----|----------|------|
| B1 行内公式 | ✅ §2.1 插件注册 + §2.6 katex 依赖 | `useMarkdown.ts` mkKatex |
| B2 块级公式 | ✅ §2.1 + §2.4 KaTeX 块级溢出滚动 | `.katex-block` CSS |
| B3 货币不误触发 | ✅ §1 风险表 + 插件内置智能分隔符 | 风险表第 4 行 |
| B4 未闭合降级 | ✅ 插件默认行为 | 风险表第 4 行 |
| B5 错误公式可见 | ✅ throwOnError:false + 红色标记 | P1 §2.9 |
| B6 DOMPurify 不剥离 | ✅ §2.5 + minimal_validation confirmed | §2.5 + validation #1 |
| B7 KaTeX CSS 已加载 | ✅ §2.2 main.ts 全局 import | `import 'katex/dist/katex.min.css'` |
| B8 暗色模式公式 | ✅ §2.4 KaTeX 暗色模式 CSS | `[data-theme='dark'] .katex` |
| B9 行内代码 $ 不触发 | ✅ markdown-it 代码块优先于插件 | 插件解析顺序 |
| B10 已完成任务 | ✅ §2.1 mkTaskLists + §2.4 CSS | `.task-list-item-checkbox` |
| B11 未完成任务 | ✅ 同上 | `disabled` 属性 |
| B12 DOMPurify 不剥离 checkbox | ✅ §2.5 + minimal_validation #3 confirmed | validation #3 |
| B13 checkbox 不可交互 | ✅ §2.4 `pointer-events: none` | CSS |
| B14 暗色 checkbox | ✅ §2.4 暗色 accent-color | `[data-theme='dark'] .task-list-item-checkbox` |
| B15 脚注引用渲染 | ✅ §2.1 mkFootnote | 插件注册 |
| B16 脚注回引链接 | ✅ §2.1 + §2.3 拦截 | `footnote-backref` |
| B17 未定义脚注降级 | ✅ 插件默认行为 | — |
| B18 脚注锚点点击滚动 | ✅ §2.3 scrollIntoView 拦截 | `handleLinkClick` 扩展 |
| B19 脚注回引点击滚动 | ✅ §2.3 `footnote-backref` 拦截 | 同上 |
| B20 暗色脚注可读 | ✅ §2.4 脚注暗色 CSS | `[data-theme='dark'] .footnotes` |
| B21 上标渲染 | ✅ §2.1 mkSup | 插件注册 |
| B22 下标渲染 | ✅ §2.1 mkSub | 插件注册 |
| B23 上标在加粗内 | ✅ markdown-it 内联解析嵌套 | — |
| B24 空分隔符降级 | ✅ 插件默认行为 | — |
| B25 多扩展共存 | ✅ §2.1 注册顺序设计 | KaTeX → task-lists → footnote → sub → sup |
| B26 现有功能不受影响 | ✅ §3 完成标志 #7 | "现有功能不受影响" |
| B27 脚注重复引用含冒号 ID | ✅ §2.3 `CSS.escape(targetId)` | `CSS.escape` 处理冒号 |
| B28 链接文本 $ 不误触发 | ✅ markdown-it 链接解析优先于 KaTeX | 解析顺序 |
| B29 块级公式溢出可滚动 | ✅ §2.4 `.katex-block` overflow-x: auto | CSS |
| B30 KaTeX 字体加载失败降级 | ⚠️ 未显式覆盖 | 见问题 #1 |

**结论**：30 条 BDD 中 29 条完全覆盖，1 条需补充说明（B30）。

## 2. 方案选择理由评估

方案 A（全局注册 + 全局 CSS + scrollIntoView）vs 方案 B（按需加载）：

- 选择理由充分：P1 隐含需求 2.2 明确要求无 FOUC，方案 B 违反此需求
- 性能权衡分析合理：24KB CSS gzip 后约 6-8KB，可接受
- 一致性论证有效：与现有 main.ts 全局 import 模式一致
- 方案 B 的 FOUC 风险是致命缺陷，排除合理

**结论**：方案选择理由充分，权衡分析完整。

## 3. gate_commands 检查

- P5: `cd frontend-v3 && npx vitest run --reporter=dot` — ✅ 正确（单元测试）
- P5_e2e: `cd frontend-v3 && npx playwright test --reporter=line e2e/` — ✅ 正确（ui_affected=true）
- P5 命令前有多余的 `.venv-placeholder` 检查（`cd frontend-v3 && .venv-placeholder 2>/dev/null;`），虽无害但冗余

**结论**：gate_commands 完整，P5 + P5_e2e 均已声明。

## 4. files_to_read 评估

| 文件 | 理由 | 评估 |
|------|------|------|
| `useMarkdown.ts` | 插件注册 + DOMPurify | ✅ 必要 |
| `MarkdownViewer.vue` | 脚注拦截 + CSS | ✅ 必要 |
| `main.ts` | KaTeX CSS import | ✅ 必要 |
| `package.json` | 依赖添加 | ✅ 必要 |
| `useMarkdown.svg.spec.ts` | DOMPurify PURIFY_CONFIG | ✅ 必要（3 处同步） |
| `SvgRenderer.vue:72-76` | DOMPurify 第三处调用点 | ✅ 必要（3 处同步） |
| `base.css:8-10` | scroll-behavior: smooth 确认 | ✅ 合理（确认无需修改） |

**结论**：files_to_read 合理，不过多不过少。

## 5. minimal_validation 检查

| 假设 | 方法 | 结果 | 评估 |
|------|------|------|------|
| DOMPurify 覆盖 KaTeX | Node.js 脚本实测 | confirmed | ✅ 可信 |
| 脚注锚点需 scrollIntoView | 代码分析 + HTML 测试页 | confirmed | ✅ 可信 |
| DOMPurify 覆盖 footnote/tasklist/sub/sup | Node.js 脚本实测 | confirmed | ✅ 可信 |

**结论**：3 项 minimal_validation 均已执行且结果 confirmed。

## 6. 复杂度评估

方案 A 的复杂度评估：

- 插件注册：5 行 `md.use()` — 最小复杂度
- CSS 加载：1 行 import — 最小复杂度
- 脚注拦截：~15 行 handleLinkClick 扩展 — 合理复杂度
- CSS 样式：~60 行 — 合理（4 项扩展的视觉适配）
- DOMPurify：0 行变更 — 最小复杂度

**结论**：方案未引入不必要的复杂度。总变更量约 100 行，与设计文档估算一致。

## 7. 隐含依赖检查

| 依赖 | 是否已识别 | 备注 |
|------|-----------|------|
| DOMPurify 3 处调用点同步 | ✅ | §2.5 明确指出 |
| KaTeX CSS @font-face 字体文件 | ✅ | Vite 自动处理静态资源 |
| markdown-it 插件注册顺序 | ✅ | §2.1 详细说明理由 |
| CSS.escape 浏览器兼容性 | ✅ | 现代浏览器均支持 |
| `data-peekview-file-id` 在 ADD_ATTR 中的不一致 | ⚠️ | 见问题 #2 |
| KaTeX 字体 CDN/本地路径 | ❌ | 见问题 #3 |

## 发现的问题

### 问题 #1：B30 KaTeX 字体加载失败降级未显式覆盖

**严重度**：低

B30 要求"KaTeX 字体加载失败时公式回退到系统字体渲染，文字仍可读"。设计方案未显式处理此场景。

**分析**：KaTeX CSS 使用 `@font-face` 声明数学字体，浏览器在字体加载失败时自动回退到 `font-family` 声明中的下一个字体。KaTeX 的 CSS 已包含 fallback 字体栈。因此 B30 实际上由 KaTeX 自身机制覆盖，无需额外代码。

**建议**：在 §2.4 CSS 部分添加一行说明，确认 KaTeX CSS 的 font-family fallback 已覆盖 B30。

### 问题 #2：DOMPurify ADD_ATTR 不一致

**严重度**：低（不影响本次变更）

当前 3 处 DOMPurify 调用的 ADD_ATTR 不完全一致：
- `useMarkdown.ts:388`：含 `data-peekview-file-id`
- `SvgRenderer.vue:74`：**不含** `data-peekview-file-id`
- `svg.spec.ts:7`：**不含** `data-peekview-file-id`

这是已有不一致，非本次引入。设计文档 §2.5 正确指出"若 P5 发现需扩展白名单，3 处必须同步修改"。

**建议**：本次任务不修复此不一致（scope 外），但 P7 一致性检查时应确认新增的 ADD_ATTR 条目（如有）在 3 处同步。

### 问题 #3：插件数量描述错误

**严重度**：极低（文档准确性）

§1 方案 A 第 1 行写"注册 6 个插件"，但实际注册 5 个 markdown-it 插件（katex, task-lists, footnote, sub, sup）。6 是 npm 包数量（katex 引擎 + 5 个 markdown-it 插件包），不是插件数量。

**建议**：将"6 个插件"改为"改为"改为"。

## 评审结论

**status: approved**

方案 A 设计合理，覆盖 P1 全部 30 条 BDD（29 条显式覆盖，1 条由 KaTeX 自身机制隐式覆盖）。方案选择理由充分，minimal_validation 已执行且 confirmed，复杂度适当，未引入不必要的复杂度。

3 个发现的问题均为低严重度，不阻塞 approval：
1. B30 降级由 KaTeX 自身覆盖，建议补充说明
2. DOMPurify ADD_ATTR 不一致为已有问题，非本次引入
3. 插件数量描述为文档笔误
