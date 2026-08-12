# P5 修复派发指引 — T075 test-designer（E2E spec 缺陷 4 项）

## 目标

修正 `frontend-v3/e2e/structured-data-viewer.spec.ts` 的 4 个 spec 缺陷（BDD-18/20/30/52），使其断言与真实数据/实现一致。修复后重跑 E2E 全绿。

## 任务背景

P5 E2E 74/84 通过，4 个失败是 **spec 缺陷**（测试断言/数据/选择器错误，实现正确）：
- BDD-18：filter 'user5' 期望 6 行实际 11 行（CSV_120 中 'user5' 匹配 user5+user50~59）
- BDD-20：120 行 per_page=100 仅 2 页，无第 3 页（点击 .page-num '3' 超时）
- BDD-30：`[aria-live="polite"]` 匹配到空 sr-only span，应定位 `.search-match-count`
- BDD-52：t075-csv 只有 3 列在 390px 不横向溢出，应改用 CSV_WIDE（同 BDD-21）

BDD-42（真 bug）已由 implementer 修复并通过。

## 约束

- 只改 `frontend-v3/e2e/structured-data-viewer.spec.ts`
- **同步更新规范副本** `docs/tasks/T075-structured-data-viewer/P3-test-code/structured-data-viewer.spec.ts`（diff 必须为空）
- 不改实现代码
- 修复方向 = 让断言符合真实数据/实现语义，不削足适履

## 上游关联

- P5-test-results/e2e.md：失败定性
- frontend-v3/e2e/structured-data-viewer.spec.ts：需修复

## 修复清单

### 1. BDD-18 `test_bdd_18_filter_contains`（L124-133）

**问题**：filter 'user5' → CSV_120 中 'user5' 是 'user5'/'user50'~'user59' 的子串 = 11 行，断言 6 错误。

**修复方向**：改 filter 值使其匹配数可预测。如 filter 'user11' → 匹配 user11+user110~119 = 11 行（同样不确定）；更简单：改断言为实际 11 行（循环 i<11），或换 filter 值 'user5,' 不现实。**推荐**：filter 'user1' → 匹配 user1 + user10~19 + user100~119 = 1+10+20=31 行（也不整）。实际最清晰：改数据源或断言。
- 方案 A：filter 'user5' 断言改为 11（`rows.count()).toBe(11)`，循环 i<11 每行 toContainText('user5')——真实匹配数
- 方案 B：新建专用 entry 小数据（如 5 行），filter 断言精确

**推荐方案 A**（最小改动，真实语义）。注意循环断言 `rows.nth(i)).toContainText('user5')` 对 11 行全部成立（都是 user5*）。

### 2. BDD-20 `test_bdd_20_per_page_switch_page_one`（L145-153）

**问题**：CSV_120 = 120 数据行，per_page=100 → 2 页（100/20），无第 3 页。

**修复方向**：CSV_120 改为 ≥300 行（如 CSV_300，300 行 → 3 页各 100）。或改断言走第 2 页。
- **推荐**：新增 `CSV_300` 常量（300 行），BDD-20 用 CSV_300，第 3 页 100 行，切 50 后 50 行 + 回第 1 页。注意第 3 页点击 `.page-num '3'` 需存在。
- 若用 CSV_300，BDD-19（默认 100 行）也成立。

### 3. BDD-30 `test_bdd_30_search_highlight`（L224-232）

**问题**：`[aria-live="polite"].first()` 匹配到空 sr-only span（无文本），断言 /\d+/ 失败。

**修复方向**：定位专用播报元素。检查 TreeView.vue 的 aria-live 元素 class（如 `.search-match-count`），用该选择器断言。若 TreeView 有多个 aria-live（sr-only + 计数），改用 `.search-match-count`。

### 4. BDD-52 `test_bdd_52_mobile_responsive`（L432-448）

**问题**：t075-csv 3 列在 390px 可能不横向溢出（列少），断言 scrollable true 失败。

**修复方向**：改用 `t075-csv-wide`（CSV_WIDE 多列，同 BDD-21）验证横向滚动。切换按钮和 expand-toggle ≥44px 部分不变。

## 自查命令

```bash
# E2E 需 debug backend :8888（已启动）+ CDP Chrome :18800
cd frontend-v3 && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test 2>&1 | tail -20
```

注意 E2E 全跑 ~3 分钟（含 BDD-22 50000 行）。可先只跑修复的 4 个测试验证，再全量。

## 门槛

- 4 个 spec 缺陷修复落盘
- 两处副本 diff 为空（frontend-v3/e2e/ 与 P3-test-code/）
- E2E 全量通过（或仅剩非 spec 缺陷）
- 不改实现代码

## 返回给主 Agent

只返回两行：修改文件路径 + 一句话摘要（4 项 spec 修复完成，E2E 结果）。

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P5

路径：phase-cards/P5-verification.md
---
# P5 — 技术验证

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> P5 不可裁剪（核心阶段）
> ⑨ P5 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 verifier subagent（P5 模式）执行 gate_commands.P5
   1.1 写 P5-dispatch-context-verifier.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 逐条判定通过/失败
3. 若失败：判定是真失败还是环境问题 → 真失败回 P4，环境问题修复环境
4. git commit
5. 更新 .state.yaml phase=P5 → P6

## 如果是重试

→ 修复后重跑 gate_commands.P5 **全量**（T027 教训：修复可能引入回归，不能只检查修复项）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P5 MAX=2）

## 前置条件

- [ ] P4 代码已 commit（暂存区含代码文件）
- [ ] gate_commands.P5 命令在 P2 已声明（这是 gate 会执行的命令清单）

## 执行方式

verifier subagent 从 P2-design.md 读取 gate_commands.P5 并执行：

```bash
# 示例（实际命令取决于 P2 声明）
pytest -q --tb=no                    # 后端单元测试
vitest run --reporter=verbose        # 前端单元测试
playwright test --reporter=line tests/e2e/  # E2E（ui_affected: true 时）
```

紧凑输出模式：用工具的汇总模式（pytest --tb=no / vitest --reporter=dot / go test | tail -30）。只保留通过/失败汇总+失败清单，不逐项 traceback。

**技术栈无关**：gate_commands.P5_formatter 声明 formatter 脚本（可选），将测试输出标准化。见 `assets/formatters/README.md` 速查表。不提供 formatter 时退化为 exit-code-only。

## 判定规则

- **exit 0 + failed=0**：全通过 → 继续
- **exit ≠0 或 failed>0**：主 Agent 判定
  - 真 bug → 回 P4 修复
  - 环境问题（超时/端口占用/依赖缺失）→ 修复环境重新跑
  - flaky test → 记入 P5-test-results/，三振记录
- **PROD_TOUCHED**：任何生产环境触达 → 立即 PAUSED（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- **E2E 未执行**（ui_affected: true 但未跑 P5_e2e）：视为验证不完整
- **全量测试**：P5 阶段应运行全量测试套件（含非本任务测试）。发现预存失败时：
  - 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
  - 主 Agent 判断：修复成本 < 推迟成本 → 立即修复；否则记录到 known-failures.md
  全量测试不阻断 P5 推进，但未运行全量测试时须在 P5-test-results/unit.md 标注"未运行全量测试"。

## 产出规格

- P5-test-results/unit.md：标注 failed 数量（verifier subagent 产出）
- P5-test-results/fail-list.txt：verifier subagent 产出，failed 测试 id 逐行列出（`FAILED ` 前缀同上，
  pytest 参考实现），可为空文件（无失败时）。使用 gate_commands.P5_formatter 声明的 formatter 提取（与 baseline 捕获一致）。无 formatter 时可省略此文件——P5 gate 检测到缺失时优雅降级为 WARNING-only 行为，不因此新增拦截。
- UI 任务：P5-test-results/e2e.md（Playwright 实跑结果 + 截图路径，verifier subagent 产出）

## 预存失败的处理

若 verifier subagent 发现改动前就存在的失败（预存失败），按以下流程登记：

1. 在 `docs/tasks/{Txxx}/known-failures.md`（从 `{agate_root}/assets/templates/known-failures-template.md` 拷贝模板）登记：
   - 测试文件、失败数、根因、是否与当前任务相关
2. 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
3. 主 Agent 按修复成本判断：修复成本 < 推迟成本 → 立即修复；否则记录推迟
4. 即使不立即修复，债务也可见、可追踪——不会因为"与本任务无关"而默默累积

## gate 规则

check-gate.sh P5 → exit 2。主 Agent 验 gate（检查 P5-test-results/ 存在 + failed 计数），CI backstop 兜底。

**external-output-gate vs self-authored-gate**：P5 的 gate 是 external-output-gate——主 Agent 验证的是 verifier subagent 的产出（P5-test-results/），而非自己跑的命令结果。这与 P4（主 Agent 自己写代码、自己跑 lint）的 self-authored-gate 不同。external-output-gate 的信任链依赖 subagent 隔离 + CI backstop 双重保障。

## 推进条件（全部满足才写 phase: P6）

- [ ] gate_commands.P5 全部命令 exit 0 + failed=0
- [ ] UI 任务：gate_commands.P5_e2e 已执行且通过
- [ ] 无 PROD_TOUCHED 标记
- [ ] 测试环境隔离正常（对比测试前后生产库状态）

## 常见错误

1. **不跑 E2E**：UI 任务只跑单元测试和类型检查 → 端到端行为未验证。T046 教训：38 个单元测试全绿 + vue-tsc OK，但浏览器里图片是破的
2. **把测试绿了当作功能正确**：单元测试通过 ≠ 用户看到的功能正常。P5 是代码正确性验证，P6 才是用户视角验收
3. **修复后不重跑全量**：只跑修复的那一个测试 → 修复引入的回归没被发现

## P5 commit→push 窗口残余风险（N5）

**残余风险**：verifier subagent 产出 P5-test-results/ 后，主 Agent commit 并推进到 P6，但 push→CI 之前存在时间窗口。伪造的 P5-test-results 可在此窗口内流向下游。

**缓解**：主 Agent 在推进前**必须**执行签名校验——grep test runner 输出签名：

```bash
grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)' P5-test-results/unit.md
```

计数 >0 才视为有效产出，计数=0 视为假完成，计为重试。这不是重跑测试（CI backstop 在 push 后兜底全量验证）。

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 时，P5 可按包拆分并行——各 verifier subagent 跑各包的 gate_commands，各写 P5-test-results/{pkg}/。

拆分判据同 P3。P5 是只读验证，无代码写冲突风险。

**基础设施隔离（并行时强制）**：
- 测试端口：各 verifier 使用独立端口（与 P4 并行时分配的端口一致，或新分配）
- 测试数据库：各 verifier 用独立数据库（与 P4 隔离方案一致），不共享同一 test.db
- 临时输出：各 verifier 写入 `P5-test-results/{pkg}/` 独立目录，不共享同一 unit.md
- E2E 浏览器：Playwright 默认隔离 browser context，但若 E2E 测试启动了本地 server，各 verifier 需用不同端口

主 Agent 在并行派发前**必须**为每个 verifier 的 dispatch-context 分配独立的基础设施参数（同 P4，未分配导致冲突时计为重试）。

## 下游影响

- P6 验收在 P5 通过的基础上做用户视角验证
- P8 发布时需重跑 P5 gate（确认 bump-version 后测试仍全绿）

> 完成 → 读 phase-cards/P6-acceptance.md
<!-- AGATE_CARD_END -->
