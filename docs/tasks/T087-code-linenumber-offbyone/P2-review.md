---
phase: P2
task_id: T087-code-linenumber-offbyone
type: review
parent: P2-design.md
agent: plan-design-review
status: approved
---

# P2-review — T087 代码块行号 off-by-one 设计评审

## 评审结论

**Status: approved**

方案 A（调用方共享 trim）正确吸收 P1 实测结论，trim 点精确到行号，6 个边界 case 全覆盖，否决方向堵死实现歧路。1 个 MINOR 观察（markdown-it trim 措辞偏差，不影响实现）+ 2 个 INFO（提示性，非阻断）。

## 评分维度（0-10）

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 9 | empty（BDD-4 短路）/ edge（BDD-5,6）/ loading（isHighlighting 已有，不改）全覆盖；error 路径走 fallback `<pre><code>` 不触发 renderLineNumbers，天然无错位，但未显式声明 |
| AI Slop 风险 | 10 | trim 点精确到 line 185/190/202/207，伪代码用 `trimmedCode` 变量两次引用无歧义；`replace(/\n$/,'')` 非 `trimEnd()` 理由成立；4 个否决方向全列，实现者无自由发挥空间 |
| 移动端考虑 | 9 | 本任务不改布局只改行数，`syncLineHeights` 按 index 配对（源码 line 52-75 验证 `.line-number[index]↔.line[index]`）数量一致即可正确配对；未显式声明"移动端无影响"但隐含可推断 |
| 可访问性 | 9 | `renderLineNumbers` 源码 line 153 `aria-hidden="true"`，设计声明"不改函数体"隐式保持；未显式列为验收锚点 |
| 组件完整性 | 10 | CodeViewer（input props.content/language/theme → output highlightedCode，BDD-1~6,9,10）+ useMarkdown（token.content → highlightCode，BDD-7,8）两消费方 input/output 完整，BDD 映射全覆盖 |

总分 47/50。

## 评审重点逐项

### 重点 1：方案 A 共享 trim 是否正确吸收 P1 实测结论 — PASS

P1 实测结论（P1-requirements.md line 30-32）：`codeToHtml` 与 `split('\n')` 都不处理末尾换行，都多一个尾部空行（数量对齐）。用户拍板的"只改 renderLineNumbers"会引入错位（行号 N-1 vs `.line` N）。

方案 A 的吸收方式（P2-design.md line 68, 112-113）：在调用方（`highlight`/`highlightCode`）对 `code` 做 `replace(/\n$/,'')`，trim 后的 code **同时**传给 `codeToHtml` 和 `renderLineNumbers`，两列输入一致 → 输出对齐。

**源码验证**：
- `highlight`（useShiki.ts line 185 `codeToHtml(code,...)` + line 190 `renderLineNumbers(code)`）：当前两处都用原始 `code`。方案 A 在 line 185 前 trim + line 190 用 trimmedCode，正确。
- `highlightCode`（line 202 + line 207）：结构相同，方案 A 同理。
- 伪代码（P2-design.md line 101-109）用 `trimmedCode` 变量名在 codeToHtml 和 renderLineNumbers 两处引用，与"两列输入一致"的语义严格匹配。

**结论**：P1 实测结论被正确吸收。trim 同时作用于两列输入，非只改一列。这是方案 A 的核心正确性，已验证。

### 重点 2：renderLineNumbers 不改的决策是否合理 — PASS

方案选择不改 `renderLineNumbers` 函数体，在调用方 trim（P2-design.md line 68, 113）。

**关键验证：有无其他调用方绕过 highlight/highlightCode 直接调 renderLineNumbers？**

```
grep renderLineNumbers src/ e2e/
  useShiki.ts:150  (定义)
  useShiki.ts:190  (highlight 内调用)
  useShiki.ts:207  (highlightCode 内调用)
```

`renderLineNumbers` 是模块私有函数（未 export），仅有 2 个调用点，均在 `useShiki.ts` 内部，都经过 `highlight`/`highlightCode`。**无外部调用方绕过 trim**。

`highlight` 的外部调用方：仅 `CodeViewer.vue:95`（1 处）。
`highlightCode` 的外部调用方：`useMarkdown.ts:363,365,367,378`（4 处，均传 `codeBlock.code` 原值）。

**结论**：决策合理。所有路径都经 highlight/highlightCode，trim 在这两函数内部即可全覆盖。若未来新增绕过 highlight 直接调 renderLineNumbers 的路径，会漏 trim——但当前不存在此路径，且 renderLineNumbers 未 export（无法外部调用）。设计可加一条 INFO 提示："未来若 export renderLineNumbers 供外部直接调用，需重新评估 trim 位置"，但不阻断。

### 重点 3：replace(/\n$/,'') vs trimEnd() — PASS

方案选 `replace(/\n$/,'')`（P2-design.md line 90, 115-116），理由：`trimEnd()` 会去掉所有尾部空白（含空格、`\r`、`\t`），可能误伤代码末尾有意义空格（Python 末尾缩进、Markdown 末尾两空格=硬换行）。

**审查**：
- `replace(/\n$/,'')` 只去末尾单个 `\n`，精准匹配 POSIX 末尾换行语义。正确。
- `\r\n` 情况：`/\n$/` 不匹配 `\r`（因 `$` 前是 `\n`，`\r` 在 `\n` 前）。设计已说明"前端 content 来自后端 `read_bytes()` 原样透传，Linux 文件换行符为 `\n`，CRLF 极少且 Shiki 内部已统一处理"。此权衡成立——P1 实测条件就是 `\n`，保持一致。
- Python 末尾缩进 / Markdown 硬换行两空格的误伤场景真实存在，`trimEnd()` 确有风险。

**结论**：权衡成立。`replace(/\n$/,'')` 是正确选择。

### 重点 4：边界 case 全覆盖 — PASS

6 case（P2-design.md line 92-97）：

| case | trim 后 | 行号数 | `.line` 数 | 对齐 | BDD |
|------|---------|--------|-----------|------|-----|
| `"a\nb\n"` | `"a\nb"` | 2 | 2 | ✓ | BDD-1 |
| `"a\nb"` | `"a\nb"`（no-op） | 2 | 2 | ✓ | BDD-2 |
| `"a"` | `"a"`（no-op） | 1 | 1 | ✓ | BDD-3 |
| `""` | `""`（no-op） | 1（纯函数层） | 1 | ✓ | BDD-4（组件层短路，不触发） |
| `"\n"` | `""` | 1 | 1 | ✓ | BDD-5 |
| `"a\n\n"` | `"a\n"` | 2 | 2 | ✓ | BDD-6（中间空行保留为第 2 行） |

每个 case 都有 trim 后结果 + 行号数 + `.line` 数 + 三联对齐验证。BDD-4 的双层说明（组件层短路 vs 纯函数层 1==1）清晰。中间空行保留（`"a\n\n"` → `"a\n"` → 第 2 行是空行）语义正确。

**结论**：6 case 全覆盖，无遗漏。

### 重点 5：gate_commands — PASS

```yaml
P3: "cd frontend-v3 && ./node_modules/.bin/vitest run"
P5: "cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30"
P5_typecheck: "cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit"
P5_e2e: "cd frontend-v3 && E2E_SPEC=e2e/viewer.spec.ts make debug-test"
```

- P3/P5 vitest：前端单测，正确。
- P5_typecheck：vue-tsc --noEmit，CI 强制，正确。
- P5_e2e：`viewer.spec.ts`。已验证 `e2e/viewer.spec.ts` 存在且引用 `.line-number`/`.line`/`.code-body`（grep 命中）。dispatch-context 已确认无 `code-viewer.spec.ts`，viewer.spec.ts 是最贴合的现有 E2E spec。`E2E_SPEC=` + `make debug-test` 符合 AGENTS.md 的 `E2E_SPEC=e2e/<spec>.ts make debug-test` 模式。

**结论**：gate_commands 合适，P5_e2e spec 选择正确。

### 重点 6：files_to_read — PASS（1 MINOR）

设计列出 5 个文件（P2-design.md line 35-45）：

1. `useShiki.ts:150-209` — 根因代码 + 两处 trim 点。**必要**。
2. `CodeViewer.vue:87-106` — 空短路（BDD-4）+ syncLineHeights 配对（BDD-9）。**必要**。源码 line 87-106 已验证（doHighlight + escapeHtml），syncLineHeights 在 line 52-75（设计引用 87-106 偏后，但 line 52-75 在同文件，implementer 会读到，可接受）。
3. `useMarkdown.ts:261-273,376-384` — fence renderer 收集 + highlightCode 调用点。**必要**。源码验证 line 267 `token.content`、line 378 `highlightCode(codeBlock.code,...)`。
4. `useShiki.spec.ts` — 现有单测参照。**必要**（P3 加测试的参照）。
5. `viewer.spec.ts` — P5_e2e 回归 spec。**必要**。

**MINOR**：设计第 3 项 why 说"markdown-it 已 trim 末尾换行"（line 41, 70），但源码 `useMarkdown.ts:267` `token.content` 是 markdown-it 原始 fence content，markdown-it **不自动 trim** `token.content`（token.content 是 token 原始内容）。此措辞偏差**不影响实现**——因为 trim 在 `highlightCode` 内部做，无论 markdown-it 是否预 trim，`replace(/\n$/,'')` 都能处理。但措辞易误导 P4 implementer 以为 markdown 路径不需要 trim。建议 P2 修正为"markdown-it `token.content` 保留末尾换行（未自动 trim），由 highlightCode 内部 trim 统一处理"。**非阻断**，因实现约束（highlightCode 内 trim）已覆盖此路径。

**结论**：files_to_read 无遗漏无冗余。1 个 MINOR 措辞偏差，不影响实现正确性。

## MINOR / INFO 汇总

### MINOR-1：markdown-it trim 措辞偏差（重点 6）

设计 line 41, 70 称"markdown-it 已 trim 末尾换行"。实际 `useMarkdown.ts:267` `token.content` 是 markdown-it 原始 fence content，不自动 trim。

**影响**：不影响实现正确性。trim 在 `highlightCode` 内部做，无论 markdown-it 是否预 trim 都覆盖。但措辞易误导 P4 implementer。

**建议**：P2 修正措辞为"markdown-it `token.content` 保留末尾换行（未自动 trim），由 highlightCode 内部 trim 统一处理"。非阻断，P4 implementer 读源码即可澄清。

### INFO-1：error 路径未显式声明（维度 1）

`doHighlight` catch 走 fallback `<pre><code>${escapeHtml(content)}`（CodeViewer.vue line 99-100），fallback 不含行号列（无 `.line-number` / `.code-container`），天然无错位风险。设计未显式提 error 路径，但实现约束（fallback 不触发 renderLineNumbers）已保证。非阻断。

### INFO-2：renderLineNumbers 未来 export 风险（重点 2）

`renderLineNumbers` 当前模块私有未 export，所有调用经 highlight/highlightCode。若未来 export 供外部直接调用，会绕过 trim。建议 P2 加一条提示："未来若 export renderLineNumbers，需在函数内部或新调用点补 trim"。非阻断（当前不存在此路径）。

## 设计锚点引用核对

- 方案 A（P2-design.md line 82-110）：共享 trim，两列输入一致 — **正确**
- trim 点（line 185/190/202/207，伪代码 line 105-107）：精确到行号 — **正确**
- 边界 case 1-6（line 92-97）：全覆盖 — **正确**
- 否决方向（line 122-126）：renderLineNumbers 内 trim / pop / trimEnd / Shiki transformer — **全合理否决**
- 不改 renderLineNumbers（line 68）：模块私有，无外部调用方绕过 — **正确**

## 自检

- [x] Header `status: approved`
- [x] agent: plan-design-review（非 main）
- [x] parent: P2-design.md
- [x] 设计锚点引用：方案 A / trim 点 line 185/190/202/207 / 边界 case 1-6 / 否决方向 4 项 / 不改 renderLineNumbers — 均引用具体锚点，非裸 approved
- [x] 源码交叉验证：renderLineNumbers 私有 + 2 调用点 + highlight 1 外部调用方 + highlightCode 4 外部调用方 + CodeViewer 空短路 + syncLineHeights index 配对
- [x] [PROD_NOT_TOUCHED] 只读评审，未触生产

## 返回

File: /home/kity/oclab/peekview/docs/tasks/T087-code-linenumber-offbyone/P2-review.md
Status: approved
