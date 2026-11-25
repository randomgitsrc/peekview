---
phase: P5
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: verifier
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

执行 `P2-design.md` 的 **`gate_commands.P5*`（11 条）**，逐条判定通过/失败，产出：
- `P5-test-results/unit.md`（标注 failed 数量 + 预存失败说明）
- `P5-test-results/fail-list.txt`（逐行 `FAILED <id>`，无失败则为空文件）
- `P5-test-results/e2e.md`（`ui_affected: true`，Playwright 实跑结果 + 截图路径）

### ⚠️ 必读：两条环境事实（会决定你的判定对错）

**1. debug 实例选择**
- **`:8888` 与 `:8890` 当前都跑新代码**（我实测两端口都有 `peekview-inject-report` 报表块、`maxInjectIds: 40`）。`make debug-test` 默认打 `:8888`（`scripts/run-e2e-tests.sh` 用 `PORT=` 注入）。
- **⚠️ 不要用响应头 `cache-control` 判断新旧代码**：`main.py:265-269` 的中间件对所有 `/api` 路由统一覆写 `Cache-Control: no-store`，覆盖了 `files.py:427` 的值 → 新旧代码响应头**相同**。判据只能用**行为特征**（报表块存在、`maxInjectIds: 40`）。
- **服务存活跟随"起它的那条调用"**：若 E2E 跑到一半服务没了，先探活（`curl -sf http://127.0.0.1:8888/health`），**掉线即报告主 Agent**（由我重启，你不要裸启 uvicorn——项目铁律：后台长驻服务一律走 make）。

**2. E2E 基线（P1 已实测，你按此判"失败集不劣于基线"）**
| spec | 改动前基线 |
|---|---|
| `viewer.spec.ts` | **18 failed / 20 passed** |
| `t091-mobile-detail-visual-polish.spec.ts` | **12 failed / 12 passed** |
| `tpv0099-fullscreen-link-auth.spec.ts` | **6 passed / 0 failed** |

- 前两者失败根因 = `markdown-test` 归 `frontend-team` 致匿名 404（**TPV0095 遗留，非本任务引入**）。
- **BDD-50 要求的是「迁移后 `firstFileId` 字面量 == 0 且失败集合不劣于基线」，不是全绿**。P4 已把 9 处 `firstFileId` 全迁移为 `file`。
- → 判定口径：`P5_e2e_legacy_*` 的**失败集必须 ⊆ 基线失败集**（无新增失败）。**若失败数少于基线是好事（本任务修了东西），不算问题。**

### 执行方式（按 P5 卡推荐，用 `agate-run.py`）

```bash
python3 {agate_root}/scripts/agate-run.py --task <TASK_DIR> "<P2 声明的命令原文>"
```
- 它按 `gate_commands` 白名单执行、把输出写 `<TASK_DIR>/runs/<k>.log`、追加账本事件、**退出码如实传播**
- 命令必须与 P2 的 `gate_commands` 值**逐字一致**（`agate-run.py` 会校验白名单）
- 各 key 的 `{key}_timeout_seconds` 见 P2（`P5` 600s / `P5_e2e*` 600-900s）

### 11 条命令清单（逐条执行，不挑跑）

| key | 命令 | 预期 |
|---|---|---|
| `P5` | `make test-quick` | 后端全量。**基线 1221P / 1F（预存 `test_cli_remote::test_config_set_remote_api_key`，根因 `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'` 沙箱只读）/ 3S** → 应仍是这 1 个预存失败 |
| `P5_frontend` | `make test-frontend` | **基线 127 files / 1514P / 4S / 0F** → 应全绿 |
| `P5_typecheck` | `make typecheck` | exit 0 |
| `P5_lint` | `make lint` | exit 0 |
| `P5_docs` | `make check-docs` | exit 0 |
| `P5_e2e` | `E2E_SPEC=e2e/tpv0104-viewer-hardening.spec.ts make debug-test` | **本任务新 spec，应全绿** |
| `P5_e2e_mobile_widths` | `E2E_SPEC=e2e/tpv0104-mobile-bar-widths.spec.ts make debug-test` | **本任务新 spec，应全绿** |
| `P5_e2e_legacy_viewer` | `E2E_SPEC=e2e/viewer.spec.ts make debug-test` | 失败集 ⊆ 基线 18F |
| `P5_e2e_legacy_t091` | `E2E_SPEC=e2e/t091-mobile-detail-visual-polish.spec.ts make debug-test` | 失败集 ⊆ 基线 12F |
| `P5_e2e_legacy_tpv0099` | `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` | 基线 6P/0F，应仍全绿 |

> **注意**：上表是 10 条；`P2` 的 `gate_commands` 共 **11 个 `P5*` 执行键**（`P5` + `P5_frontend` + `P5_typecheck` + `P5_lint` + `P5_docs` + 5 个 e2e + …），**以 `P2-design.md` 的实际声明为准，逐条跑完**。

### 判据（P5 卡）

- **exit 0 + failed=0** → 通过
- **exit ≠ 0 或 failed > 0** → 你判定归因：
  - **真 bug** → 报告主 Agent（回 P4 修）
  - **环境问题**（超时/端口占用/依赖缺失）→ 报告主 Agent（修环境重跑）
  - **预存失败**（P5 之前就存在、与本任务无关）→ 标注 + 我会登记 `known-failures.md`
  - **flaky** → 记入 `P5-test-results/`，**三振记录**
- **`PROD_TOUCHED`**：任何生产环境触达 → 立即报告（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- **E2E 未执行**（`ui_affected: true` 但没跑 `P5_e2e*`）→ 视为验证不完整
- **全量测试**：必须跑全量（含非本任务测试）

### 环境隔离（强制，项目铁律）

- **严禁**接触生产 `:8080`（实测不可达 000）、**严禁**触碰 `~/.peekview/`
- 状态标记二值：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`
- 造/删测试 entry **只经 debug HTTP API**（`:8888` 或 `:8890`），**禁 CLI**（`peekview create` 可能加载非 debug 配置误写生产 DB）；用完即删（**DELETE 用 slug 不用 id**；匿名造的 entry 需 admin 才能删）
- **造件须同时给 `path` 与 `filename`**（只给 `path` 会得 `filename=untitled`、`language=null` → 前端退化 CodeViewer、`.toc-list` 为空）
- **`make debug-test` 自带安全检查**（`scripts/e2e-safety-check.sh`），不要绕过
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**，per-call tmpfs 跨调用不可见）
- **不要 commit**
- **不要改实现代码与测试**

### 截图与证据

- 截图存 `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/evidences/`（P3 已定）
- E2E 产出的 Playwright 报告路径记入 `e2e.md`
- 本轮 `P5-test-results/` 是 P5 gate 的产出，**必须落盘**

### 产出规格

- `P5-test-results/unit.md`：11 条命令的逐条结果（exit code / passed / failed / 判定）+ 预存失败标注 + 全量测试声明
- `P5-test-results/fail-list.txt`：`FAILED <id>` 逐行（无失败则空文件）
- `P5-test-results/e2e.md`：Playwright 实跑结果 + 截图路径 + 与基线的失败集对比

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（**`gate_commands` 是权威命令清单**；另见 §5.1 的 P3 说明、D6 预算、D9 测试标识）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P3-test-cases.md`（测试设计 + 截图命名约定）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-implementation.md`（实现摘要 + 5 条 `[DESIGN_GAP]` + 1 条 `[SCOPE+]`）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P4-review.md`（**approved**，含 3 条 CRITICAL 的修复验证 + 残留 MINOR）
- `{project_root}/AGENTS.md`（**铁律：多实例/端口/服务保活/生产隔离，必读**）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（54 条 BDD）

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
4. `git rev-parse HEAD` 取当前（父）提交哈希，写入 `.state.yaml` 的 `p5_pass_commit` 字段（TAG0016 BDD-12：供 P6/P8 判定"引用 P5 证据、不重跑"，字段可选、写入时机见 `state-machine.md`「每任务独立状态文件」）
   ⚠️ **P5 commit 不得混入非产出文件改动**（真实反例：`5bdcd90` 混入了 `agate-debt-check.py` 的真实修复）——若发现顺手修复的必要性，应先回 P4 走正常流程，不要混入 P5 commit（R9 缓解措施，P2-design.md §3.2/§1.3）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P5 产出，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P5，不要提前写 P6——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P5): {摘要}"（phase=P5，P5 产出含 P5-test-results/fail-list.txt）
7. P5 commit 完成后进入 P6：**phase 推进 P6 随 P6 产出 commit 一起**（P6-acceptance.md + P6-evidence/ 就绪后），不是单独 phase commit
   ⚠️ P5→P6 是唯一硬拦边界：P6 的 self-authored gate 拦截"非证据文件"，
      P5 的 .txt/.json 等合法产出必须在 phase=P5 的 commit 里提交，不能带进 phase=P6
   ⚠️ 不要"先 commit 产出再单独 commit 改 phase"（state-machine.md:431 明确禁止）——
      phase 与产出同 commit，P6 产出就绪时 phase 一并写 P6

## 如果是重试

→ 修复后重跑 gate_commands.P5 **全量**（T027 教训：修复可能引入回归，不能只检查修复项）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P5 MAX=2）

## 前置条件

- [ ] P4 代码已 commit（暂存区含代码文件）
- [ ] gate_commands.P5 命令在 P2 已声明（这是 gate 会执行的命令清单）

## 执行方式

verifier subagent 从 P2-design.md 读取 gate_commands.P5 并执行。

> **执行入口（推荐，RM-AG0102 采纳）**：`python3 {agate_root}/scripts/agate-run.py --task <TASK_DIR> "<命令>"`。
> 它按 **P2 的 `gate_commands` 白名单**执行（未声明命令**拒绝执行**）、把输出写
> `<TASK_DIR>/runs/<k>.log`（**证据入库**）并追加账本事件 `cmd_run`——使「谁跑了什么」**可审计**，
> 而不是只有自述。退出码**如实传播**（POSIX 开 pipefail，`cmd | tail` 不吞左侧失败）。
> 直接 bash 执行也能跑，但**没有**白名单/证据/账本这三样。

```bash
# 示例（实际命令取决于 P2 声明；下面写法与 P2 的 gate_commands 值**逐字一致**）
agate-run.py --task <TASK_DIR> "pytest -q --tb=no"          # 后端单元测试
agate-run.py --task <TASK_DIR> "vitest run --reporter=verbose"   # 前端单元测试
agate-run.py --task <TASK_DIR> "playwright test --reporter=line tests/e2e/"  # E2E（ui_affected: true 时）
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

> **known-failures.md 只登预存失败**（P5 之前就存在的、与当前任务无关的）。当前任务引入的失败用 P5-test-results/ 记录。

1. 在 `{AGATE_WORKSPACE}/tasks/{Txxx}/known-failures.md`（从 `{agate_root}/assets/templates/known-failures-template.md` 拷贝模板）登记：
   - 测试文件、失败数、根因、是否与当前任务相关
2. 在 P5-test-results/unit.md 标注"预存失败：X（与本次改动无关）"
3. 主 Agent 按修复成本判断：修复成本 < 推迟成本 → 立即修复；否则记录推迟
4. 即使不立即修复，债务也可见、可追踪——不会因为"与本任务无关"而默默累积

## gate 规则

check-gate.py P5 → exit 2。主 Agent 验 gate（检查 P5-test-results/ 存在 + failed 计数），CI backstop 兜底。

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
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 时，P5 可按包拆分并行——各 verifier subagent 跑各包的 gate_commands，各写 P5-test-results/{pkg}/。

拆分判据同 P3。P5 是只读验证，无代码写冲突风险。

**但"无写冲突"不等于可以随便并行**：`gate_commands.P5` 常是全量测试套件（含 xdist 多进程）或 E2E 浏览器命令，属**资源密集型默认串行**——按 dispatch-protocol.md「派发编排机制」并行规则第 4 条处理，即使包间无依赖也默认改为串行；要并行必须先按下方「基础设施隔离」为每批分配独立端口/数据库/临时目录，无法隔离即串行（安全默认值）。判据细节见该节，本卡片不重复展开。

**环境准备职责边界（本阶段落地）**：verifier subagent **默认不自行启动环境**——debug server、测试数据库、临时端口等由主 Agent（或 P0-brief 声明的单一责任方）统一准备好，通过 dispatch-context 注入访问方式；多个并行 verifier 共享同一环境时更是如此，不允许各自启动。环境验证失败时的可重试/不可重试分类、批处理要求与止损轮次，一律按 dispatch-protocol.md「verification_env 失败处理协议」与「环境准备职责边界」执行，本卡片只做落地引用，不重复展开规则。

**⚠️ 服务可能「活着启动、用前已死」**：受限 harness（DSH 等）在调用/后台 job 结束时回收其派生的整个进程树——`&`/`nohup`/`setsid` 均不保活。**每个使用服务的步骤前须探活**（端口/健康检查，不是 pidfile），掉线即重启；**不要靠加长 `sleep` 托底**（实测逐次加长到 12h 仍被跨越 4 次，每次白跑一轮）。完整四步做法见 `platform-notes.md`「受限 harness 通用约束」。（TAG0041 / RM-AG0075）

**基础设施隔离（本阶段特定，并行时强制）**：
- 测试端口：各 verifier 使用独立端口（与 P4 并行时分配的端口一致，或新分配）
- 测试数据库：各 verifier 用独立数据库（与 P4 隔离方案一致），不共享同一 test.db
- 临时输出：各 verifier 写入 `P5-test-results/{pkg}/` 独立目录，不共享同一 unit.md
- E2E 浏览器：Playwright 默认隔离 browser context，但若 E2E 测试启动了本地 server，各 verifier 需用不同端口

主 Agent 在并行派发前**必须**为每个 verifier 的 dispatch-context 分配独立的基础设施参数（同 P4，未分配导致冲突时计为重试）。

## 下游影响

- P6 验收在 P5 通过的基础上做用户视角验证
- P8 **交付收尾后**重跑 P5 gate（确认交付收尾后测试仍全绿）

> 完成 → 读 phase-cards/P6-acceptance.md
<!-- AGATE_CARD_END -->

<objective_info>
- **环境状态（主 Agent 2026-11-25 实测）**：
  - `:8888` **在线**（health 200）+ 已 seed（`alice 22 / anon 15`），**跑新代码**（报表块有、`maxInjectIds: 40`）
  - `:8890` **在线** + 已 seed（anon 15），**跑新代码**
  - 生产 `:8080` **不可达（000）**，`~/.peekview/` 内容 mtime 仍是 11月12日 → **全程零接触**
  - 两个实例都在**后台 job 托底**下运行（`sleep 28800`）；**若掉线立即报告主 Agent，不要裸启**
- **测试基线（改动前，用于零回归判定）**：
  | 项 | 基线 |
  |---|---|
  | `make test-quick` | **1205P / 1F / 3S** → P4 后 **1221P / 1F / 3S**（+16 新用例，唯一失败仍是预存 `test_cli_remote`） |
  | `make test-frontend` | **1456P** → P4 后 **1514P / 4S / 0F**（127 files） |
  | `make typecheck` / `make lint` / `make check-docs` | exit 0 |
  | `make build-frontend` | exit 0（dist 7 文件已同步 `backend/peekview/static/`） |
  | E2E `viewer` / `t091` / `tpv0099` | **18F/20P** / **12F/12P** / **6P/0F**（前两者根因 TPV0095 遗留的 `markdown-test` 团队归属 → 匿名 404） |
- **P4 已修的 3 条 CRITICAL（你验证时可能碰到相关行为）**：
  - C1 总预算记账改 `len(data.content.encode("utf-8"))`（与 `record.size` 同字节口径）；实测 12 个中文 CSS → `inlined=4 / skipped=8 / {total_budget:8}` / 响应 7.67 MiB
  - C2 `_append_inject_report` 改 `re.finditer(r"</body\s*>", ..., re.IGNORECASE)` 取 `matches[-1]`（保 `rfind` 语义）
  - C3 `not_injectable` 补 `file_id`（旁路 map 关键字可选参数 `file_ids`）
  - 另修 2 MAJOR（`overflow` 无界 → `inject` 加 `max_length=4096`；`owners` 拆 text/binary 双命名空间）
- **关键实测事实**：
  - `_MAX_INJECT_IDS` = **40**、单文件文本 **2 MiB**、总字节 **8 MiB**（P2 冻结值）
  - `REASONS` 六元闭集：`count_limit`/`file_too_large`/`binary_too_large`/`total_budget`/`not_found`/`not_injectable`
  - 冻结计数：`= inject_resources(` **13**、`_process_css_refs(` **8**（P4 已核未变）
  - 前端契约：`EntryDetailView.vue` **295 行**（<300）、`entryDetail.ts` **145 行**（<150）（t082 既有行数契约）
  - TOC 的 `:activeId="null"` 是**硬编码**，全仓无 scroll-spy → **TOC active 态不会自然出现**（若你要验 active 色，需 DOM 注入 `.active` 后**等 ≥400ms** > 150ms 过渡）
- 环境坑：`npx tsx` 不可用 → `/home/kity/oclab/deepseek-harness/node_modules/.bin/tsx` + `NODE_PATH=$(npm root -g)`；临时产物落 `.agate-tmp/`（不用 `/tmp`）。
</objective_info>
