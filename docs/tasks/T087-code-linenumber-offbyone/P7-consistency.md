---
phase: P7
task_id: T087-code-linenumber-offbyone
type: consistency
parent: P6-acceptance.md
status: approved
---

# P7 一致性检查 — T087 代码块行号 off-by-one

[PROD_NOT_TOUCHED]

## 检查结论

- BLOCKER=0
- CRITICAL=0
- DESIGN_GAP 未配对=0（P4 无 DESIGN_GAP 声明）
- SCOPE+ 闭环：无 SCOPE+（P1 无 [SCOPE+] 增补）

## 检查清单逐条

### 1. DESIGN_GAP 配对

P4-implementation.md §DESIGN_GAP 检查（line 105-107）声明："实现严格按 P2 方案 A 伪代码执行，无自主决策偏差。无 [DESIGN_GAP]。"

P4 无 [DESIGN_GAP:] 行首标记（grep 确认）。无需配对 REVIEWED。

[DESIGN_GAP_REVIEWED: P4-implementation.md §DESIGN_GAP 检查 声明无 DESIGN_GAP，已核实 — grep P4-implementation.md 无 [DESIGN_GAP: 匹配，P4 实现与 P2 §2 方案 A 伪代码一致（见下跨文件检查 3）]

### 2. SCOPE+ 闭环

P1-requirements.md 无 [SCOPE+] 增补标记（grep 确认行首无 [SCOPE+）。P1 §4 待确认清单为 [NO_NEED_CONFIRM]，无 SCOPE_RESOLVED 需求。

T087 无 SCOPE+ 增补，基线自始至终稳定（P1 retry#1 仅 3 处措辞修订 [BASELINE_CHANGE]，不改语义，已由 requirements-review approved）。

无 SCOPE+，无需 SCOPE_RESOLVED 闭环。

### 3. 跨文件一致性

#### 3.1 P2 packages 与 P4 实现文件 / P8 release bump 范围

P2-design.md §声明字段 packages（line 13-14）：`frontend-v3`，domains：`frontend`。

P4-implementation.md §改动文件（line 19-22）：仅 `frontend-v3/src/composables/useShiki.ts`（highlight + highlightCode 两函数）。

git show e5a98bd6 --stat 确认：P4 commit 改动文件含 `frontend-v3/src/composables/useShiki.ts` + docs/，无 backend/MCP/CLI 文件。

P8 release bump 范围：P2 packages=frontend-v3，P6 §verification_env 声明"生产环境前端构建在 P8 发布时由 bump-version + pipx upgrade 落地"——bump 范围与 P2 packages 一致（frontend-v3 属 backend pipx 包的 static 资产，bump-version 同步 VERSIONS.json + 所有文件）。

一致性：P2§packages = P4§改动文件 = P8 bump 范围，均限 frontend-v3。

#### 3.2 P1 BDD 数（10）= P6 验收数（10 PASS）— 数量 + 内容对照

P1-requirements.md §3 BDD 验收条件：BDD-1 ~ BDD-10（grep `^#### BDD-` = 10 条）。

P6-acceptance.md §BDD 逐条验收：PASS BDD-1 ~ PASS BDD-10（grep `^- PASS BDD-` = 10 条）。

数量匹配：P1=10, P6=10 PASS, 0 FAIL。

内容对照（P1§3 BDD 标题 ↔ P6§BDD 逐条验收）：

| P1 BDD 标题 | P6 PASS 内容 | 一致 |
|-------------|-------------|------|
| BDD-1 末尾带换行 POSIX 文件行号正确 | PASS BDD-1 末尾换行 "a\nb\n" → 3==3 对齐 | ✓ |
| BDD-2 末尾不带换行文件行号正确 | PASS BDD-2 无末尾换行 "a\nb" → 3==3 对齐 | ✓ |
| BDD-3 单行无换行文件行号正确 | PASS BDD-3 单行 "a" → 1==1 对齐 | ✓ |
| BDD-4 空文件不渲染行号 | PASS BDD-4 空文件 "" 纯函数 1==1 + 组件短路 | ✓ |
| BDD-5 仅换行符文件行号正确 | PASS BDD-5 "\n" → trim 后 "" → 1==1 对齐 | ✓ |
| BDD-6 中间空行+末尾换行文件行号正确 | PASS BDD-6 "a\n\n" → 2==2 中间空行保留 | ✓ |
| BDD-7 Markdown 代码块行号与高亮对齐 | PASS BDD-7 Markdown ```python → 2==2 对齐 | ✓ |
| BDD-8 Markdown 代码块不回归 | PASS BDD-8 vitest 1226 passed 含 useMarkdown 无 failed | ✓ |
| BDD-9 wrap 模式下行号与高亮逐行对齐 | PASS BDD-9 wrap → 3==3 对齐 | ✓ |
| BDD-10 源码视图切换后行号正确 | PASS BDD-10 源码视图走 CodeViewer → 2==2 对齐 | ✓ |

10/10 内容匹配，无 BDD 映射到错误验收结果。

#### 3.3 P4 实现路径与 P2 方案设计吻合（方案 A 调用方共享 trim）

P2-design.md §2 方案 A（line 82-110）：在 highlight() 和 highlightCode() 内部对入参 code 做 `code.replace(/\n$/, '')`，trim 后的 code 同时传给 codeToHtml 和 renderLineNumbers；renderLineNumbers 不改。

P4-implementation.md §实现摘要（line 12-13）+ §改动文件（line 19-22）：highlight() line 185 新增 trimmedCode，line 186 codeToHtml(trimmedCode)，line 191 renderLineNumbers(trimmedCode)；highlightCode() line 203/204/209 同理。

实际代码核实（useShiki.ts line 185-191 + line 203-209）：
- line 185: `const trimmedCode = code.replace(/\n$/, '')`（highlight）
- line 186: `highlighter.codeToHtml(trimmedCode, ...)`
- line 191: `renderLineNumbers(trimmedCode)`
- line 203: `const trimmedCode = code.replace(/\n$/, '')`（highlightCode）
- line 204: `highlighter.codeToHtml(trimmedCode, ...)`
- line 209: `renderLineNumbers(trimmedCode)`

renderLineNumbers（line 150-154）未改：`code.split('\n')` 保持原样。

git diff e5a98bd6 确认：仅 useShiki.ts 改动（+trimmedCode 2 处，code→trimmedCode 4 处），renderLineNumbers 函数体无 diff。

P4§impl-path = P2§2 方案 A 伪代码，完全吻合。trim 点在调用方（highlight + highlightCode），不在 renderLineNumbers 内部——与 P2 §不改什么（line 67-68）一致。

#### 3.4 gate_commands 执行一致性

P2-design.md §声明字段 gate_commands（line 23-29）：
- P3: `cd frontend-v3 && ./node_modules/.bin/vitest run`
- P5: `cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30`
- P5_typecheck: `cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit`
- P5_e2e: `cd frontend-v3 && E2E_SPEC=e2e/viewer.spec.ts make debug-test`

P5-test-results/unit.md §命令：`cd frontend-v3 && ./node_modules/.bin/vitest run --reporter=dot 2>&1 | tail -30` → exit 0, 1226 passed | 1 skipped, failed=0。与 P2 gate_commands.P5 一致。

P5-test-results/typecheck.md §命令：`cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit` → exit 0, errors=0。与 P2 gate_commands.P5_typecheck 一致。

P5-test-results/e2e.md §命令：`cd frontend-v3 && E2E_SPEC=e2e/viewer.spec.ts make debug-test` → viewer.spec.ts 预存失败（路由 #/entry/{slug} vs /{slug} + 硬编码 slug 失效）。与 P2 gate_commands.P5_e2e 一致。

viewer.spec.ts 预存失败已登记 known-failures.md（§预存失败 表格 #1），判定依据：git log 显示该文件上次改动 commit 743e2ea2（tag v0.1.22）远早于 T087，T087 改动仅 useShiki.ts 未触碰 viewer.spec.ts/router.ts。P5 用 T087 专用 spec（t087-verify.spec.ts，正确路由 /{slug} + 动态创建 entry）替代验证，6 测试全绿。不影响 T087 验收。

gate_commands 全部执行，预存失败已登记，替代验证通过。

### 4. 未决项清零

P1-requirements.md grep 行首 [NEED_CONFIRM] / [BLOCKER] / [DEVIATION-CRITICAL]：无匹配（NONE FOUND）。

P1 §4 待确认清单为 [NO_NEED_CONFIRM]，声明"空文件边界已用 [SUGGEST] 给出推荐，不阻塞推进"。

P6-acceptance.md 无 [NEED_CONFIRM] / [BLOCKER] / [DEVIATION-CRITICAL]，10/10 PASS 客观二值。

未决项清零。

## 实质锚点汇总

| gate 断言 | 实质锚点 |
|-----------|---------|
| BLOCKER=0 | [DESIGN_GAP_REVIEWED: P4 无 DESIGN_GAP 声明，已核实] |
| CRITICAL=0 | P2§packages = P4§改动文件 = frontend-v3；P1§3 BDD-1~10 = P6§BDD 逐条验收 PASS-1~10（数量+内容对照表）；P4§impl-path line 185/203 = P2§2 方案 A 伪代码；P5 gate_commands 与 P2§声明字段 一致 |
| SCOPE+ 闭环 | 无 SCOPE+（P1 无 [SCOPE+] 增补，无需 SCOPE_RESOLVED） |

## 自检

- [x] 无 [BLOCKER] / [DEVIATION-CRITICAL]
- [x] DESIGN_GAP 全部 REVIEWED 配对（P4 无 DESIGN_GAP，声明 + REVIEWED 标记）
- [x] SCOPE+ 闭环（无 SCOPE+，声明）
- [x] 跨文件检查项引用源文件节名（P2§packages / P2§2 方案 A / P4§改动文件 / P4§impl-path / P1§3 BDD / P6§BDD 逐条验收 / P5 gate_commands）
- [x] P1 BDD=10 = P6 PASS=10（数量 + 内容对照，非裸"一致"）
- [x] viewer.spec.ts 预存失败登记 known-failures.md，非 T087 回归
