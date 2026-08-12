---
phase: P4
task_id: T087-code-linenumber-offbyone
type: review
parent: P4-implementation.md
agent: design-review
status: approved
---

# P4-review — T087 代码块行号 off-by-one（design-review）

## 评审范围

纯逻辑 bug fix（行号列与高亮列对齐），无 UI 视觉/交互改动。按 dispatch-context 5 项评审重点审，AI Slop / Typography / Spacing / 交互状态维度不适用（本任务不改组件结构/CSS/布局）。

## 评审方法

- 读取 P4-implementation.md + P2-design.md + useShiki.ts:150-211 + P3 测试文件
- 独立复跑 P3 测试（9/9 全绿）+ 现有 useShiki.spec.ts（18 passed | 1 skipped，无回归）
- git diff HEAD 核对实际改动（6 insertions, 4 deletions，与 P4-implementation.md 声明一致）
- git diff 确认 CodeViewer.vue / useMarkdown.ts 未改
- 独立 node 验证 trim 正则在 11 个 case 上的行为

## 评审重点逐项

### 1. 行号对齐视觉正确性 — PASS

代码锚点：
- `useShiki.ts:185` `highlight()` 内 `const trimmedCode = code.replace(/\n$/, '')`
- `useShiki.ts:203` `highlightCode()` 内 `const trimmedCode = code.replace(/\n$/, '')`
- trimmedCode 同时传给 `codeToHtml`（line 186 / 204）和 `renderLineNumbers`（line 191 / 209）
- `renderLineNumbers`（line 150-154）未改，收到的 code 已被调用方 trim

两列输入一致 → 输出自然对齐。BDD-9 wrap 模式 `syncLineHeights` 按 `.line-number[index] ↔ .line[index]` 配对，两列数量一致即正确配对。修复保证了一致性（trimmedCode 同源喂给两列）。

P3 测试 9/9 全绿（独立复跑确认），三联断言 `.line-number count == .line count == 逻辑行数` 全部通过。

无 BLOCKER。

### 2. 无回归 — PASS

- `CodeViewer.vue` git diff 为空（未改）— 空短路 + syncLineHeights 保持
- `useMarkdown.ts` git diff 为空（未改）— fence content 走 highlightCode，自动受益
- 现有 `useShiki.spec.ts`：18 passed | 1 skipped（独立复跑确认，无回归）
- 改动局限在 `highlight`/`highlightCode` 内部，函数签名、返回结构（`<div class="code-container">...`）不变，下游消费方无感知

无 BLOCKER。

### 3. trim 方式（`replace(/\n$/,'')` vs `trimEnd()`）— PASS

独立 node 验证 11 case，关键确认：

| 输入 | replace(/\n$/,'') | 说明 |
|------|-------------------|------|
| `"a\nb\n"` | `"a\nb"` | BDD-1，2 行 |
| `"a\nb"` | `"a\nb"` | BDD-2，no-op |
| `"a"` | `"a"` | BDD-3，no-op |
| `""` | `""` | BDD-4，no-op |
| `"\n"` | `""` | BDD-5，1 行 |
| `"a\n\n"` | `"a\n"` | BDD-6，中间空行保留 |
| `"a\n\n\n"` | `"a\n\n"` | 只去单个末尾 \n，不去全部 |
| `"a  \n"` | `"a  "` | **末尾有意义空格保留**（Python 缩进/Markdown 硬换行安全） |
| `"line1  \nline2  \n"` | `"line1  \nline2  "` | 多行末尾空格保留 |

`replace(/\n$/,'')` 只去末尾单个 `\n`，精准匹配 POSIX 末尾换行语义。`trimEnd()` 会误伤末尾空格/`\r`/`\t`，选 `replace(/\n$/,'')` 正确。

无 BLOCKER。

### 4. 边界 case 视觉表现 — PASS

6 个 BDD case + 3 衍生 case 对照 P4-implementation.md 边界表，逐行核对一致。每个 case 在 P3 测试中均有断言：

| BDD | 输入 | trim 后 | 行号 | .line | 测试断言 |
|-----|------|---------|------|-------|---------|
| BDD-1 | `"a\nb\n"` | `"a\nb"` | 2 | 2 | ✓ |
| BDD-2 | `"a\nb"` | `"a\nb"` | 2 | 2 | ✓ |
| BDD-3 | `"a"` | `"a"` | 1 | 1 | ✓ |
| BDD-4 | `""` | `""` | 1 | 1 | ✓（纯函数层，CodeViewer 短路不触发） |
| BDD-5 | `"\n"` | `""` | 1 | 1 | ✓ |
| BDD-6 | `"a\n\n"` | `"a\n"` | 2 | 2 | ✓（中间空行保留为第 2 行） |
| BDD-7 | `"a\nb\n"` (highlightCode) | `"a\nb"` | 2 | 2 | ✓ |
| BDD-7b | `"a"` / `"\n"` (highlightCode) | `"a"` / `""` | 1 | 1 | ✓ |

无 BLOCKER。

### 5. 实现与 P2 设计一致 — PASS

P2 方案 A 伪代码：
```ts
const trimmedCode = code.replace(/\n$/, '')
const html = highlighter.codeToHtml(trimmedCode, ...)
const lineNumbersHtml = renderLineNumbers(trimmedCode)
```

实际代码（highlight line 185-191 + highlightCode line 203-209）逐行匹配伪代码，两处对称。

P2 "不改什么" 清单核对：
- `renderLineNumbers` 函数体不改 ✓（line 150-154 未变）
- `CodeViewer.vue` 不改 ✓（git diff 空）
- `useMarkdown.ts` 不改 ✓（git diff 空）
- 后端/MCP/CLI/路由/权限/数据库 不改 ✓（仅改 frontend-v3 一个文件）

无 [SCOPE_GAP] / [DESIGN_GAP] / [SCOPE+]。

无 BLOCKER。

## 不适用维度

- **AI Slop**：无新 UI，不适用
- **Typography**：无字号改动，不适用
- **Spacing**：无布局改动，不适用
- **交互状态**：无 hover/focus/disabled 改动，不适用

## 代码锚点汇总

- `frontend-v3/src/composables/useShiki.ts:185` — highlight() 内 trimmedCode 新增
- `frontend-v3/src/composables/useShiki.ts:186` — codeToHtml(trimmedCode)
- `frontend-v3/src/composables/useShiki.ts:191` — renderLineNumbers(trimmedCode)
- `frontend-v3/src/composables/useShiki.ts:203` — highlightCode() 内 trimmedCode 新增
- `frontend-v3/src/composables/useShiki.ts:204` — codeToHtml(trimmedCode)
- `frontend-v3/src/composables/useShiki.ts:209` — renderLineNumbers(trimmedCode)
- `frontend-v3/src/composables/useShiki.ts:150-154` — renderLineNumbers 未改

## 独立验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| P3 测试 | `vitest run useShiki.linenumber.spec.ts` | 9 passed (9) |
| 现有测试回归 | `vitest run useShiki.spec.ts` | 18 passed | 1 skipped (19) |
| trim 正则行为 | node 11 case 验证 | ALL_OK |
| CodeViewer/useMarkdown 未改 | `git diff HEAD` | 空 |
| 实际改动与声明一致 | `git diff HEAD~1 useShiki.ts` | 6 insertions, 4 deletions，匹配 |

## 结论

5 项评审重点全部 PASS，无 BLOCKER，无 CRITICAL，无 NEEDS-REVISION 项。

实现严格遵循 P2 方案 A，trim 方式精准（不误伤末尾有意义空格），两处调用点对称改动，renderLineNumbers 保持原样，下游消费方零感知。P3 测试 9/9 全绿 + 现有测试无回归。

**status: approved**

## 生产环境隔离

[PROD_NOT_TOUCHED]

本次评审为只读评审，未触碰生产环境/生产数据库/生产 API/`:8080` 服务/`~/.peekview/`。仅运行 vitest 单测（不依赖后端）和 node 正则验证。
