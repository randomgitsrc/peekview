---
phase: P5
generated_by: agate-inject-card.sh + 主 Agent
task_id: T076
role: test-designer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

修复 T076 e2e spec（`frontend-v3/e2e/entry-card-interaction.spec.ts`）的 12 个失败项——全部是测试侧缺陷（选择器/隔离/数据 setup/CDP hover 限制），实现代码正确不动。修复后 e2e 应全绿（或 BDD-21 按诊断降级处理）。

### 约束

- **只改 e2e spec 测试代码**，不改实现代码（EntryCard.vue 等实现已验证正确）
- **不得削弱 BDD 语义**：每个测试仍验证对应 BDD 的用户可观测行为，只修 selector/隔离/数据 setup，不删断言、不降验证标准
- 修复方向严格参照 `P5-gate-diagnosis.md` 的"修复方向"节
- BDD-21 优先改可靠 hover（page.mouse.move 到元素中心 + waitForTimeout 等 transition）；若 CDP 仍不触发 :hover，降级为 CSS 规则存在性检查，并在产出中说明（主 Agent 会登记 known-failures + P6 vision 补验）
- 自查≠gate：修完自跑 e2e 确认改善（自查），全量重跑由主 Agent 执行

### 上游关联

P5 gate 失败：e2e 28/42，12 失败。主 Agent 独立诊断（见 P5-gate-diagnosis.md）：类别 A（BDD-16~19 选择器 hasText vs title attr）、类别 B（BDD-02/04 `.first()` 命中错误 entry）、BDD-20（匿名 entry 无 username）、BDD-21（CDP hover 限制，实现 CSS 正确）。

### 输入文件

- `docs/tasks/T076-entry-card-interaction/P5-gate-diagnosis.md`（诊断 + 修复方向，核心依据）
- `frontend-v3/e2e/entry-card-interaction.spec.ts`（修复对象）
- `docs/tasks/T076-entry-card-interaction/P1-requirements.md`（BDD 语义，确保修复不削弱）
- `docs/tasks/T076-entry-card-interaction/P3-test-cases.md`（BDD→测试映射）
- 认证模式参考：`frontend-v3/e2e/landing-auth.spec.ts`（register/login API 用法，BDD-20 需拿 token）
</dispatch_guide>

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

**非 pytest 技术栈**：若 P5 gate_commands 包含 check-tdd-red.sh（重跑 TDD 红灯检查），设置 `TEST_RUNNER` 环境变量指向项目实际测试命令（如 `TEST_RUNNER="npm test"`），check-tdd-red.sh 会使用该命令而非默认的 pytest 探测。这是 agate 协议保持技术栈无关的标准接入点。

## 判定规则

- **exit 0 + failed=0**：全通过 → 继续
- **exit ≠0 或 failed>0**：主 Agent 判定
  - 真 bug → 回 P4 修复
  - 环境问题（超时/端口占用/依赖缺失）→ 修复环境重新跑
  - flaky test → 记入 P5-test-results/，三振记录
- **PROD_TOUCHED**：任何生产环境触达 → 立即 PAUSED（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- **E2E 未执行**（ui_affected: true 但未跑 P5_e2e）：视为验证不完整
- **全量测试 WARNING**：P5 阶段建议运行全量测试套件（含非本任务测试），若发现预存失败：
  - 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
  - 主 Agent 判断：修复成本 < 推迟成本 → 立即修复；否则记录到 known-failures.md
  这是 WARNING 级建议，不阻断 P5 推进。

## 产出规格

- P5-test-results/unit.md：标注 failed 数量（verifier subagent 产出）
- P5-test-results/fail-list.txt：verifier subagent 产出，failed 测试 id 逐行列出（`FAILED ` 前缀同上，
  pytest 参考实现），可为空文件（无失败时）。runner 格式无法提取 id 列表时可省略此文件——
  P5 gate 检测到缺失时优雅降级为原有 WARNING-only 行为，不因此新增拦截。
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

## 推进条件

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

**缓解**：主 Agent 在推进前做轻量签名校验——grep test runner 输出签名：

```bash
grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)' P5-test-results/unit.md
```

计数 >0 才视为有效产出。这是轻量验证（确认文件包含真实 test runner 输出格式），不是重跑测试。CI backstop 在 push 后兜底全量验证。

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 按包拆分并行（可选）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 时，P5 可按包拆分并行——各 verifier subagent 跑各包的 gate_commands，各写 P5-test-results/{pkg}/。

拆分判据同 P3。P5 是只读验证，无代码写冲突风险。

**基础设施隔离（并行时强制）**：
- 测试端口：各 verifier 使用独立端口（与 P4 并行时分配的端口一致，或新分配）
- 测试数据库：各 verifier 用独立数据库（与 P4 隔离方案一致），不共享同一 test.db
- 临时输出：各 verifier 写入 `P5-test-results/{pkg}/` 独立目录，不共享同一 unit.md
- E2E 浏览器：Playwright 默认隔离 browser context，但若 E2E 测试启动了本地 server，各 verifier 需用不同端口

主 Agent 在并行派发前应确认每个 verifier 的 dispatch-context 已包含独立的基础设施参数（nudge，同 P4）。

## 下游影响

- P6 验收在 P5 通过的基础上做用户视角验证
- P8 发布时需重跑 P5 gate（确认 bump-version 后测试仍全绿）

> 完成 → 读 phase-cards/P6-acceptance.md
<!-- AGATE_CARD_END -->

<objective_info>
- 环境状态：debug backend http://127.0.0.1:8888（隔离 DB），CDP Chrome 150（http://127.0.0.1:18800）
- e2e 执行命令（verifier 用过）：`cd frontend-v3 && BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/entry-card-interaction.spec.ts --reporter=line --timeout=45000 --retries=1`；或 `E2E_SPEC=e2e/entry-card-interaction.spec.ts make debug-test`（需先 make build-frontend）
- 实现事实（主 Agent 核实，修 selector 依据）：
  - 视图切换按钮：`.view-toggle-btn` 是 SVG icon + `title="List view"` / `title="Card view"` 属性，无 textContent → 用 `[title="List view"]` 或 getByTitle
  - hover CSS 正确：.entry-card 默认 border var(--c-border-strong)=rgba(0,0,0,.13)，:hover border-color var(--c-accent)=#0969da（二者不同，实现无 bug）
  - entry 卡片：.entry-card / .card-title（<a>）/ .meta-username（<a>，仅有 username 时存在）/ .base-tag（<a>）
- 认证 API：POST /api/v1/auth/register + /api/v1/auth/login（参考 landing-auth.spec.ts），返回 token 用于 Authorization: Bearer
- 客观事实：单测 1057 全绿（无需改单测）；只改 e2e spec
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
