---
phase: P4
task_id: T087-code-linenumber-offbyone
type: implementation
parent: P3-test-cases.md
implementation_dir: frontend-v3/src/composables
---

# P4-implementation — T087 代码块行号 off-by-one

## 实现摘要

实现 P2 方案 A（调用方共享 trim）：在 `useShiki.ts` 的 `highlight()` 和 `highlightCode()` 内部对入参 `code` 做 `replace(/\n$/, '')`，trim 后的 code 同时传给 `codeToHtml` 和 `renderLineNumbers`，使行号列与高亮列输入一致，输出自然对齐。

`renderLineNumbers` 函数体未改（P1 实测证明只改一列会引入行号 N-1 vs `.line` N 错位）。

## 改动文件

| 文件 | 函数 | 改动 |
|------|------|------|
| `frontend-v3/src/composables/useShiki.ts` | `highlight()` (line 177-193) | line 185 新增 `const trimmedCode = code.replace(/\n$/, '')`；line 186 `codeToHtml(code)` → `codeToHtml(trimmedCode)`；line 191 `renderLineNumbers(code)` → `renderLineNumbers(trimmedCode)` |
| `frontend-v3/src/composables/useShiki.ts` | `highlightCode()` (line 195-211) | line 203 新增 `const trimmedCode = code.replace(/\n$/, '')`；line 204 `codeToHtml(code)` → `codeToHtml(trimmedCode)`；line 209 `renderLineNumbers(code)` → `renderLineNumbers(trimmedCode)` |

## 未改（按 dispatch-context "不改什么" 清单）

- `renderLineNumbers()` (line 150-154) — 函数体保持原样，它收到的 code 已被调用方 trim
- `CodeViewer.vue` — 空短路 + syncLineHeights 保持
- `useMarkdown.ts` — fence content 走 highlightCode，自动受益
- 后端/MCP/CLI/路由/权限/数据库 — 均不涉及

## 实现细节

### trim 方式：`code.replace(/\n$/, '')`

- `"a\nb\n"` → `"a\nb"`（2 行，BDD-1）
- `"a\nb"` → `"a\nb"`（no-op，2 行，BDD-2）
- `"a"` → `"a"`（no-op，1 行，BDD-3）
- `""` → `""`（no-op，1 行，BDD-4 纯函数层 1==1 对齐）
- `"\n"` → `""`（1 行，BDD-5）
- `"a\n\n"` → `"a\n"`（2 行，中间空行保留为第 2 行，BDD-6）

### 为什么 trim 在调用方而非 renderLineNumbers 内部

P1 实测（P2 minimal_validation 采信）：`codeToHtml` 与 `split('\n')` 都不处理末尾换行，都多一个尾部空行（数量对齐）。若只在 `renderLineNumbers` 内 trim split 结果，行号变 N-1 但 `.line` 仍 N → 引入错位。必须让 trim 后的 code 同时喂给 `codeToHtml` 和 `renderLineNumbers`，两列输入一致 → 输出对齐。

### 为什么用 `replace(/\n$/,'')` 而非 `trimEnd()`

`trimEnd()` 会去掉所有尾部空白（含空格、`\r`、`\t`），可能误伤代码末尾的有意义空格（如 Python 末尾缩进、Markdown 末尾两个空格=硬换行）。`replace(/\n$/, '')` 只去末尾单个 `\n`，精准匹配 POSIX 末尾换行语义。

## 自查结果（≠ P5 gate）

### TDD 红灯基线确认（实现前）

```
Test Files  1 failed (1)
     Tests  5 failed | 4 passed (9)
```
5 红灯（BDD-1/5/6/7/7b 换行 case）+ 4 绿灯（BDD-2/3/4/7b 单行 not-broken 回归 case），与 P3-test-cases.md 预期一致。

### 自查测试（实现后）

命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/composables/__tests__/useShiki.linenumber.spec.ts`

```
Test Files  1 passed (1)
     Tests  9 passed (9)
```

9 测试全绿（5 红灯转绿 + 4 绿灯保持绿）。

### 现有测试回归检查

命令：`cd frontend-v3 && ./node_modules/.bin/vitest run src/composables/__tests__/useShiki.spec.ts`

```
Test Files  1 passed (1)
     Tests  18 passed | 1 skipped (19)
```

现有 useShiki.spec.ts 无回归。

> 自查通过 ≠ P5 gate 通过。P5 由主 Agent 派 verifier 执行 gate_commands.P5（`cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot` + `vue-tsc --noEmit` + E2E）。

## 边界 case 处理对照

| BDD | 输入 | trim 后 | split('\n') | 预期行号 | 预期 .line | 状态 |
|-----|------|---------|-------------|---------|-----------|------|
| BDD-1 | `"a\nb\n"` | `"a\nb"` | `["a","b"]` | 2 | 2 | ✅ |
| BDD-2 | `"a\nb"` | `"a\nb"` | `["a","b"]` | 2 | 2 | ✅ |
| BDD-3 | `"a"` | `"a"` | `["a"]` | 1 | 1 | ✅ |
| BDD-4 | `""` | `""` | `[""]` | 1 | 1 | ✅ |
| BDD-5 | `"\n"` | `""` | `[""]` | 1 | 1 | ✅ |
| BDD-6 | `"a\n\n"` | `"a\n"` | `["a",""]` | 2 | 2 | ✅ |
| BDD-7 | `"a\nb\n"` (highlightCode) | `"a\nb"` | `["a","b"]` | 2 | 2 | ✅ |
| BDD-7b | `"a"` (highlightCode) | `"a"` | `["a"]` | 1 | 1 | ✅ |
| BDD-7b | `"\n"` (highlightCode) | `""` | `[""]` | 1 | 1 | ✅ |

## SCOPE_GAP 检查

对照 P2-design.md 改动清单（§1）与 packages 声明（frontend-v3）：
- P2 声明改 `useShiki.ts` 的 highlight + highlightCode，renderLineNumbers 不改 → 本次实现完全匹配
- P2 packages 仅 frontend-v3 → 本次实现仅改 frontend-v3 文件
- 无 [SCOPE_GAP]

## DESIGN_GAP 检查

实现严格按 P2 方案 A 伪代码执行，无自主决策偏差。无 [DESIGN_GAP]。

## SCOPE+ 检查

实现中未发现 P1/P2 未覆盖的新隐含需求。无 [SCOPE+]。

## CLARIFY

无疑问。无 [CLARIFY]。

## 生产环境隔离

[PROD_NOT_TOUCHED]

本次实现仅改 `frontend-v3/src/composables/useShiki.ts`（前端源码），未触碰后端/MCP/CLI/路由/权限/数据库。vitest 单测不依赖后端，未启动 debug server，未触 :8080 生产，未触 ~/.peekview/。
