---
phase: P2
task_id: T087-code-linenumber-offbyone
type: design
parent: P1-requirements.md
---

# P2-design — T087 代码块行号 off-by-one

## 声明字段

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
ui_interaction_points:
  - "CodeViewer 行号列与高亮列的行数/对齐（BDD-1~6, BDD-9, BDD-10）"
  - "Markdown 代码块行号列与高亮列的对齐（BDD-7, BDD-8）"
  - "源码视图切换后 CodeViewer 行号（BDD-10）"
  - "wrap 模式下 syncLineHeights 配对（.line-number[index] ↔ .line[index]）数量一致（BDD-9）"
gate_commands:
  P3: "cd frontend-v3 && ./node_modules/.bin/vitest run"
  P3_formatter: "vitest.sh"
  P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30"
  P5_formatter: "vitest.sh"
  P5_typecheck: "cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit"
  P5_e2e: "cd frontend-v3 && E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  project_module: "src/"
env_constraints:
  debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；前端单测 make test-frontend（vitest 非 watch）；typecheck: cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit（CI 强制）"
  isolation_check: "测试走 debug backend :8888，严禁 :8080 生产与 ~/.peekview/；vitest 单测不依赖后端；E2E 走 make debug-test（scripts/run-e2e-tests.sh 自带数据隔离保护）"
  prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"
files_to_read:
  - path: frontend-v3/src/composables/useShiki.ts:150-209
    why: "根因代码。renderLineNumbers(150-154) 是 bug 所在；highlight(177-192) 和 highlightCode(194-209) 是两处调用点，需在调用 codeToHtml 和 renderLineNumbers 前对 code 做共享 trim"
  - path: frontend-v3/src/components/CodeViewer.vue:87-106
    why: "消费方。doHighlight() 对空 content 短路（line 88-91，对应 BDD-4）；syncLineHeights 按 .line-number[index] ↔ .line[index] 配对（line 52-75，对应 BDD-9 wrap 对齐）"
  - path: frontend-v3/src/composables/useMarkdown.ts:261-273,376-384
    why: "Markdown 路径。fence renderer 收集 token.content（line 265-273，markdown-it 已 trim 末尾换行）；highlightCode 调用点（line 378）。确认修复后两路径对齐"
  - path: frontend-v3/src/composables/__tests__/useShiki.spec.ts
    why: "现有单测参照。P3 在此文件或新文件加 renderLineNumbers 单测（末尾换行/无换行/空文件/单行/仅换行符/中间空行+末尾换行 case）"
  - path: frontend-v3/e2e/viewer.spec.ts
    why: "P5_e2e 回归 spec。已覆盖 .code-body .line count + wrap 模式，是现有最贴合的 E2E spec"
minimal_validation:
  assumption: "Shiki codeToHtml 与 code.split('\\n') 都不处理末尾换行，都多一个尾部空行（数量对齐）"
  method: "P1 analyst 已实测 Shiki 1.x (^1.10.0) codeToHtml 行为"
  result: "confirmed"
  note: "P1 实测结果（直接采信，P2 不重做）：\"a\\nb\\n\" → codeToHtml .line 数=3, split('\\n') 数=3, replace(/\\n$/,'').split('\\n') 数=2。结论：只改 renderLineNumbers 会引入错位（行号 N-1 vs .line N），trim 必须同时作用于 codeToHtml 输入和 renderLineNumbers 输入。本方案为纯代码逻辑（字符串 trim + split），无外部系统依赖，依赖的内部函数：useShiki.ts 的 highlight/highlightCode/renderLineNumbers + Shiki codeToHtml（P1 已验证行为）。"
follows_existing_pattern:
  - frontend-v3/src/composables/useShiki.ts
follows_existing_pattern_reason: "renderLineNumbers 是 useShiki.ts 内的纯函数，highlight/highlightCode 是同文件的现有函数。修复方式是在这两个现有函数内部对入参 code 做末尾换行 trim，再传给同文件已有的 codeToHtml 和 renderLineNumbers 调用。不新增函数、不改函数签名、不改调用方，完全沿用现有数据流（code → codeToHtml + renderLineNumbers → 拼接返回）。单候选方案。"
```

## 1. 影响域分析

### 改什么

| 文件 | 函数/区域 | 改动 |
|------|----------|------|
| `frontend-v3/src/composables/useShiki.ts` | `highlight()` (line 177-192) | 在 line 185 `codeToHtml` 调用前、line 190 `renderLineNumbers` 调用前，对 `code` 做末尾换行 trim，使两列输入一致 |
| `frontend-v3/src/composables/useShiki.ts` | `highlightCode()` (line 194-209) | 同上（line 202 + line 207） |
| `frontend-v3/src/composables/useShiki.ts` | `renderLineNumbers()` (line 150-154) | **不改**（见下"不改什么"） |

### 不改什么

- **`renderLineNumbers` 函数体不改**：P1 实测证明，Shiki `codeToHtml` 与 `split('\n')` 都多一个尾部空行（数量对齐）。只改 `renderLineNumbers` 内部 split 逻辑会导致行号 N-1 vs `.line` N 错位。正确做法是在**调用方**（highlight/highlightCode）对 `code` 做 trim，让 trim 后的 code 同时喂给 `codeToHtml` 和 `renderLineNumbers`，两列输入一致 → 输出自然对齐。`renderLineNumbers` 保持原样（`code.split('\n')`），因为它收到的 code 已经被 trim 过。
- **`CodeViewer.vue` 不改**：`doHighlight()` 对空 content 短路逻辑（BDD-4）保持不变；`syncLineHeights` 按 index 配对逻辑（BDD-9）保持不变（两列数量一致即可正确配对）。
- **`useMarkdown.ts` 不改**：markdown-it fence renderer 收集 `token.content`（markdown-it 已 trim 末尾换行），传给 `highlightCode`。修复在 `highlightCode` 内部，Markdown 路径自动受益。
- **后端/MCP/CLI/路由/权限/数据库**：均不涉及（content 原样透传）。

### 风险在哪

1. **共享 trim 漏改一处调用点**：`highlight` 和 `highlightCode` 两个函数都要改，漏改一个会引入路径间不一致。P7 须交叉核对两处 trim 逻辑一致。
2. **边界 case 处理**：空文件（`""`）、仅换行符（`"\n"`）、单行无换行（`"a"`）、中间空行+末尾换行（`"a\n\n"`）。trim 只去末尾 `\n`，不去中间空行。P3 须覆盖这些 case。
3. **wrap 模式配对**：`syncLineHeights` 按 `.line-number[index] ↔ .line[index]` 配对，两列数量必须一致。修复后两列数量一致（都=逻辑行数），配对正确。
4. **markdown-it trim 与手动 trim 叠加**：markdown-it 已 trim 末尾换行，`highlightCode` 内再 trim 是 no-op（`"\n"` 不在末尾时 replace 无效），安全。

## 2. 候选方案（单候选，follows_existing_pattern）

### 方案 A（选定）：调用方共享 trim

**参照文件**：`frontend-v3/src/composables/useShiki.ts`（`highlight`/`highlightCode` 现有结构）

**实现**：

在 `highlight()` 和 `highlightCode()` 内部，对入参 `code` 做末尾换行 trim，再用 trim 后的 code 分别调用 `codeToHtml` 和 `renderLineNumbers`。

trim 方式：`code.replace(/\n$/, '')`

- `"a\nb\n"` → `"a\nb"`（2 行，正确）
- `"a\nb"` → `"a\nb"`（no-op，2 行，正确）
- `"a"` → `"a"`（no-op，1 行，正确）
- `""` → `""`（no-op，但 CodeViewer 对空 content 短路不渲染，此路径不触发 renderLineNumbers；纯函数层 `"".split('\n')` = 1 行号，与 `codeToHtml("")` 1 个 `.line` 对齐，符合 P1 [SUGGEST]）
- `"\n"` → `""`（1 行号 + 1 `.line`，对齐，符合 BDD-5）
- `"a\n\n"` → `"a\n"`（2 行号 + 2 `.line`，对齐，中间空行保留为第 2 行，符合 BDD-6）

伪代码（`highlight`，`highlightCode` 同理）：

```ts
async function highlight(code, lang, theme) {
  const highlighter = await getHighlighter()
  const effectiveLang = await ensureLanguage(highlighter, lang)
  const trimmedCode = code.replace(/\n$/, '')   // ← 新增：共享 trim
  const html = highlighter.codeToHtml(trimmedCode, { lang: effectiveLang, theme })
  const lineNumbersHtml = renderLineNumbers(trimmedCode)   // ← 用 trimmedCode
  return `<div class="code-container">${lineNumbersHtml}${html}</div>`
}
```

**为什么 trim 在调用方而非 `renderLineNumbers` 内部**：
P1 实测证明 `codeToHtml` 和 `split('\n')` 都不处理末尾换行（都多一个尾部空行，数量对齐）。若只在 `renderLineNumbers` 内 trim split 结果，行号变 N-1 但 `.line` 仍 N → 引入错位。必须让 trim 后的 code 同时喂给 `codeToHtml` 和 `renderLineNumbers`，两列输入一致 → 输出对齐。`renderLineNumbers` 保持原样（它收到的 code 已被 trim）。

**为什么用 `replace(/\n$/, '')` 而非 `trimEnd()`**：
`trimEnd()` 会去掉所有尾部空白（含空格、`\r`、`\t`），可能误伤代码末尾的有意义空格（如 Python 末尾缩进、Markdown 末尾两个空格=硬换行）。`replace(/\n$/, '')` 只去末尾单个 `\n`，精准匹配 POSIX 末尾换行语义。若末尾是 `\r\n`，`/\n$/` 不匹配 `\r`——但前端 content 来自后端 `read_bytes()` 原样透传，Linux 文件换行符为 `\n`，CRLF 文件极少且 Shiki/codeToHtml 对 `\r\n` 的处理已由 Shiki 内部统一，此处保持与 P1 实测条件一致（`\n`）。

**为什么不在 `renderLineNumbers` 内 pop 末尾空字符串**：
split 后 pop 只改行号列，不改 `.line` 列（codeToHtml 输入未变），引入错位。等价于"只改 renderLineNumbers"的错误路径。

### 权衡（follows_existing_pattern 单候选，此处记录否决的替代方向）

- **否决：在 `renderLineNumbers` 内 trim split 结果** — P1 实测证明会引入行号/高亮错位（行号 N-1 vs `.line` N）。
- **否决：在 `renderLineNumbers` 内 `replace(/\n$/,'').split('\n')`** — 同上，只改一列。
- **否决：Shiki transformer 后处理 `.line`** — 引入 Shiki transformer 依赖，复杂度高于字符串 trim，且 transformer API 版本耦合 Shiki 主版本。YAGNI。
- **否决：`trimEnd()` 替代 `replace(/\n$/,'')`** — 误伤末尾有意义空格（见上）。

## 3. 实现完成的标志

- [ ] `useShiki.ts` 的 `highlight()` 和 `highlightCode()` 内部都对 `code` 做 `replace(/\n$/, '')`，且 trim 后的 code 同时传给 `codeToHtml` 和 `renderLineNumbers`
- [ ] `renderLineNumbers` 函数体不变
- [ ] `CodeViewer.vue` / `useMarkdown.ts` / 后端均不改
- [ ] P3 单测覆盖 6 case：末尾换行 / 无换行 / 空文件 / 单行 / 仅换行符 / 中间空行+末尾换行
- [ ] P5 vitest 全绿 + typecheck 全绿
- [ ] P5_e2e viewer.spec.ts 回归通过
- [ ] P6 Playwright 截图验证：CodeViewer 路径 + Markdown 代码块路径，行号列与高亮列逐行对齐（BDD-1 + BDD-7）

## 4. UI 测试稳定标识清单（data-testid）

本任务不改组件结构，行号/高亮的 DOM 选择器沿用现有 class（`.line-number` / `.line` / `.code-body` / `.code-container`），不新增 `data-testid`。

P6 截图验证可用的稳定选择器：
- `.code-body .line-number` — 行号列每个行号
- `.code-body .line` — Shiki 高亮列每行
- `.code-body .line-numbers` — 行号列容器
- `.code-container` — 行号列 + 高亮列的包裹容器

P3 单测断言锚点（renderLineNumbers 输出 HTML 解析）：
- `.line-numbers .line-number` 的 count == 预期逻辑行数
- `highlight`/`highlightCode` 返回的 HTML 中 `.line` count == `.line-number` count（需 mock codeToHtml 或用真实 Shiki）

## 5. BDD → 实现映射

| BDD | 路径 | 验证方式 |
|-----|------|---------|
| BDD-1 末尾换行 | CodeViewer `highlight()` | P3 单测（`"a\nb\n"` → 2 行号 + 2 `.line`）+ P6 截图 |
| BDD-2 无换行 | CodeViewer `highlight()` | P3 单测（`"a\nb"` → 2+2） |
| BDD-3 单行 | CodeViewer `highlight()` | P3 单测（`"a"` → 1+1） |
| BDD-4 空文件 | CodeViewer `doHighlight()` 短路 | P3 单测（现有 CodeViewer.spec.ts 已覆盖空 content 短路，确认不回归） |
| BDD-5 仅换行符 | CodeViewer `highlight()` | P3 单测（`"\n"` → 1+1） |
| BDD-6 中间空行+末尾换行 | CodeViewer `highlight()` | P3 单测（`"a\n\n"` → 2+2，中间空行保留） |
| BDD-7 Markdown 代码块对齐 | `useMarkdown` → `highlightCode()` | P3 单测（`highlightCode("a\nb\n")` → 2+2）+ P6 截图 |
| BDD-8 Markdown 多代码块不回归 | `useMarkdown` → `highlightCode()` | P5_e2e viewer.spec.ts 回归 |
| BDD-9 wrap 对齐 | CodeViewer `syncLineHeights()` | P5_e2e viewer.spec.ts TC-003 wrap toggle 回归 + P6 截图 wrap 模式 |
| BDD-10 源码视图切换 | EntryDetailContent → CodeViewer | P5_e2e viewer.spec.ts 回归（CodeViewer 路径覆盖） |

## 6. P3 单测设计指引（供 test-designer）

在 `frontend-v3/src/composables/__tests__/useShiki.spec.ts` 或新文件加 `renderLineNumbers` / `highlight` / `highlightCode` 的单测：

**renderLineNumbers 纯函数测试**（需 export 或通过 highlight/highlightCode 间接测）：
- `renderLineNumbers` 当前未 export。P3 可选择：(a) export 它以便单测直接调用；(b) 通过 `highlight`/`highlightCode` 间接测（mock codeToHtml，断言返回 HTML 中 `.line-number` count）。推荐 (b)，避免改函数签名（follows_existing_pattern），但若 (a) 更简洁也可接受——由 P3 决定。

**highlight/highlightCode 集成测试**（mock codeToHtml 返回固定 `.line` 数，断言行号列对齐）：
- case `"a\nb\n"` → `.line-number` count == 2, mock `.line` count == 2
- case `"a\nb"` → 2 == 2
- case `"a"` → 1 == 1
- case `""` → highlight 不触发（CodeViewer 短路）；纯函数层 1 == 1
- case `"\n"` → 1 == 1
- case `"a\n\n"` → 2 == 2

**关键断言**：`.line-number` count == `.line` count（三联对齐的核心），而非只断言行号数。

## 7. 裁剪说明

```yaml
follows_existing_pattern:
  - frontend-v3/src/composables/useShiki.ts
```

单候选方案（附参照文件路径 + 理由，见声明字段 `follows_existing_pattern_reason`）。P2 不可裁剪，已产出四字段 + files_to_read + env_constraints + minimal_validation + 候选方案。

[PROD_NOT_TOUCHED]
