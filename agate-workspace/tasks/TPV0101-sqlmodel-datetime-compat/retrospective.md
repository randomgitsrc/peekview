---
task_id: TPV0101
mechanism_issues:
  - "任务新增测试文件未纳入 lint 门禁面：agate P2 gate_commands 无 lint key，P5/P6/P7 全程不跑 ruff，直到 P8 发布检查才撞 make lint exit 1（已登记 DEBT0020）"
  - "check-judge-verdict.py 证据引用括号宽度鲁棒性缺口：结论行证据引用括号全角/半角不配对（开 `（` + 闭 `)`）时 regex 不匹配，整行证据被判『未被引用』exit 1，且报错不指向真因（已追加进 DEBT0018 evidence）"
  - "项目发布流程『bump-version 后 git commit --amend』会使 tag 停留在 pre-amend 提交（tag 缺 CHANGELOG 正文）——AGENTS.md 发布流程未含 tag 重指步骤（已登记 DEBT0021）"
  - "check-retrospective.py 的 DEBT 信号代理（机制缺口检测）对本项目 task_id 约定失效：以 `task_id:` 精确匹配 .state.yaml 短 id，而 tech-debt.md 按约定写全名（TPV0101-<slug>）→ 永不命中；本任务登记 DEBT0020/0021 后脚本仍零告警"
execution_issues:
  - "主 Agent 把『lint autofix + 两轮全量 pytest + typecheck』并入同一前台 subagent，长跑被平台中断、零改动；应拆分职责（subagent 只做编辑，长跑验证由主 Agent 执行）"
  - "P4 orchestrator-log 记『ruff 全绿』但本次自查范围未含 backend/tests/，口径与实际 make lint（ruff check peekview/ tests/）不一致"
  - "复盘产出落在 DONE 提交而非 P8/READY 提交（P8 卡将其列入『状态与版本』清单）——无制品影响，与 TPV0100 先例一致"
feedback_ready: true
---

# TPV0101 复盘 — sqlmodel datetime naive 兼容修复

## 一、事实基线

| 项 | 值 |
|----|----|
| 阶段链 | P0 → P1 → P2 → P3 → P4 → P5 → P6 → P6.5 → P7 → P8 → READY |
| 裁剪 | 无（全 8 阶段 + P6.5 全走） |
| 评审轮次 | P1 2 轮 / P2 1 轮（plan-eng-review approved）/ P6.5 1 轮 / P7 1 轮 |
| 重试 | P1 1 次（quality：4 阻塞 M1–M4 修正）；P8 lint 修复 subagent 1 次中断重派（非 gate retry） |
| gate 失败 | P6.5 首跑 exit 1（括号全角/半角不配对，机械修正）；P8 `make lint` exit 1（项目铁律 #10，非 agate gate） |
| 代码改动 | `backend/peekview/models.py`（25 列显式 naive 列类型）+ `backend/pyproject.toml`（上限）+ 2 个新增测试文件 + lint 清理；零前端源改动、零 MCP 改动 |
| 测试 | 后端双环境各 1186 passed / 3 skipped（本地 0.0.38 + 隔离 0.0.47 CI 等价）；`make typecheck` 通过 |
| 版本 | peekview 0.26.0 → 0.26.1（patch）；mcp_server 0.12.0 不动 |
| 提交 | P1–P8 共 10 个 wf/fix commit（+ lint 修复 commit）+ 1 tag `v0.26.1` |
| 生产 | 全程 `[PROD_NOT_TOUCHED]`（:8080 PID 1583302 未动；`~/.peekview/peekview.db` md5 `d68a32c1…` 未变） |

## 二、做得好的 + 可复用模式

- **P0 即建 CI 等价隔离环境**（`/tmp/ci-repro-venv`，sqlmodel 0.0.47 + sqlalchemy 2.0.54 + pytest 9.1.1）：使「CI 红 / 本地绿」的依赖漂移在 P3 就能真红灯复现、P5/P8 双环境各自全绿，根因（`38 failed + 502 errors`）一次定位。→ 去向：**项目资产沉淀**（可复用做法写入 P0-brief 模板/`docs/process/env-check-protocol.md`）
- **P1 requirements-review 抓到真实需求缺陷**（M1 把多个 aware 赋值字段误标 naive + 漏扫等量级 aware 写入面，经 grep 核实）：不放过需求基线错误，round 2 修正后才进 P2。→ 去向：回馈 agate（P1 评审对「字段语义全量扫描」类断言的价值）
- **守卫测试 + 注入漂移实测**：`test_dependency_guard.py` / `test_datetime_naive_compat.py` 非空转；BDD-15 人为注入依赖漂移实测让守卫真变红、恢复后变绿。→ 去向：项目资产（守卫测试模式）
- **生产零触碰的量化留证**：每阶段记录 :8080 PID + DB md5 基线，P6/P8 复核一致。→ 去向：项目资产（`[PROD_NOT_TOUCHED]` 写法）

## 三、发现的问题

| # | 问题 | 归因层面 |
|---|------|---------|
| 1 | **lint 不在 gate_commands**：P2 的 5 个 gate_commands 全为 pytest，无 ruff key；CI 亦不含 ruff。任务新增测试文件含 3×F401 + 1×I001，P3–P7 全程未捕获，直到 P8 发布检查才暴露 `make lint` exit 1 | 机制缺口 |
| 2 | **check-judge-verdict.py 括号宽度不鲁棒**：verdict 结论行证据引用用「全角开括号 + 半角闭括号」时 regex 不匹配，整行证据判『未被引用』exit 1；judge 正文用中文全角标点属自然书写 | 机制缺口 |
| 3 | **发布流程 amend 后 tag 失真**：AGENTS.md 流程为「bump-version（含 commit+tag）→ 填 CHANGELOG → `git commit --amend`」，amend 重写提交后 tag 仍指向旧提交（缺 CHANGELOG 正文）；本次由主 Agent 发现并 `git tag -f` 纠正 | 机制缺口 |
| 4 | 主 Agent 把 lint autofix 与两轮全量测试 + typecheck 并入同一**前台** subagent → 长跑被平台中断、零改动，需重派 | 执行错误 |
| 5 | P4 orchestrator-log 记『ruff 全绿』，实际自查范围未含 `backend/tests/`，口径与 `make lint`（`ruff check peekview/ tests/`）不一致 | 执行错误 |
| 6 | **check-retrospective.py 的 DEBT 信号代理失效**：`_scan_debt_roadmap_signal` 以 `task_id:\s*"?{tid}"?\s*$` 精确匹配 `.state.yaml` 的短 id（`TPV0101`），而 `tech-debt.md` 按项目约定写全名（`task_id: TPV0101-sqlmodel-datetime-compat`）→ 代理永不命中；本任务已登记 DEBT0020/0021 却零告警，「机制缺口检测」实际由人工判断兜底 | 机制缺口 |
| 7 | 复盘产出落在 DONE 提交而非 P8/READY 提交（P8 卡将其列入「状态与版本」清单）；无制品影响，与 TPV0100 先例一致 | 执行错误 |

## 四、改进措施

1. **（项目/协议）** 在 P2-design.md 的 `gate_commands` 增加 lint key（如 `P5_lint: "backend/.venv/bin/ruff check backend/"`），使 P5 技术验证覆盖 lint；或把 ruff 纳入 CI backend job。落点：P2-design.md 模板 / `AGENTS.md` CI 门禁节。→ DEBT0020
2. **（agate 上游）** `check-judge-verdict.py` 增补括号宽度容错（接受全角/半角及其混用），并让「未被引用」的报错指向具体的括号/分隔符问题。→ DEBT0018
3. **（派发纪律）** 编辑类任务与长跑验证拆分：subagent 只做代码编辑 + 秒级自检（`make lint` / `git diff --stat`），全量测试/typecheck 等长跑由主 Agent 亲自执行。落点：派发指引模板。
4. **（项目）** P4 自查范围明确为 `ruff check backend/`（含 `tests/`），与 `make lint` 对齐。
5. **（项目）** 发布流程补 tag 修正步骤：要么「先写 CHANGELOG 正文再 `make bump-version`」，要么在 amend 后执行 `git tag -f vX.Y.Z HEAD`。落点：`AGENTS.md` 发布流程 / `docs/process/release.md`。→ DEBT0021
6. **（agate 上游）** `check-retrospective.py` 的 DEBT 信号匹配改为前缀/包含式（如 `task_id:\s*"?{tid}[-\w]*"?\s*$`），兼容项目常用的 `TPVxxxx-<slug>` 全名约定。落点：`agate/scripts/check-retrospective.py`。→ 计入「## agate 反馈」

## agate 反馈

- **机制缺口-1（P6.5 verdict 括号宽度）**：`check-judge-verdict.py` 的引用提取仅认 ASCII 配对括号；judge 用中文全角标点书写结论行时，开闭括号宽度混用会让整行证据被判未被引用，报错信息不指向真因。TPV0100 已登记同类鲁棒性缺口（DEBT0018：路径前缀/代码块误扫），本次为其**第三例**，建议一并在角色文件明确「结论行证据引用须用 ASCII 半角括号 `(a, b)`」或让脚本容错。→ 已追加 DEBT0018 evidence。
- **机制缺口-2（check-retrospective DEBT 信号代理失效）**：`_scan_debt_roadmap_signal` 用 `task_id:\s*"?{tid}"?\s*$` 精确匹配 `.state.yaml` 的短 id（`TPV0101`），而 `tech-debt.md` 按项目约定写全名（`task_id: TPV0101-sqlmodel-datetime-compat`）→ **永不命中**；本任务已登记 2 条债务，`check-retrospective.py` 仍零告警（EXIT 0），「机制缺口检测」实际失效（仅 roadmap 路径在小 id 行时可能命中）。建议改为前缀匹配。→ 本任务在此记录，供 `agate-feedback.py` 提取。
- **非 agate 缺口（记录备查）**：本任务另有两处属**项目侧**（lint 门禁面、发布流程 tag 修正），已分别登记 DEBT0020 / DEBT0021，非 agate 协议本体问题。

## 技术债登记核对清单

| 机制 | 应该触发？ | 实际触发？ | 未触发后果 | 原因 |
|------|-----------|-----------|-----------|------|
| retry 记录 | 是 | ✅ | — | P1 1 次（`.state.yaml retries`，quality）；P8 subagent 中断重派未计 gate retry（非质量失败） |
| PAUSED | 否 | — | — | 无 retry 超限、无不可逆操作 |
| PROD_TOUCHED | 是 | ✅ | — | `[PROD_NOT_TOUCHED]`（:8080 全程未动、`~/.peekview/` md5 基线未变） |
| SCOPE+ | 否 | — | — | 全程无新增隐含需求（P1 round 2 的修正发生在基线定稿前，非 SCOPE+） |
| SCOPE_RESOLVED | 否 | — | — | 无 `[SCOPE+]` 标注需闭环 |
| DESIGN_GAP | 否 | ✅ | — | P4 确无 `[DESIGN_GAP:]` 声明；P7 核对 0 条未配对 |
| DESIGN_GAP_REVIEWED | 否 | — | — | 无 DESIGN_GAP 需配对 |
| NEED_CONFIRM | 否 | — | — | P6 实跑与 BDD 无偏差 |
| CAPABILITY_GAP | 否 | — | — | 本任务无 UI（`ui_affected: false`），无 vision/browser 依赖 |
| gate 验证（每阶段） | 是 | ✅ | — | P1 exit2 / P2 exit2 / P3 exit0 / P4 exit0 / P5 exit2 / P6 exit0+证据0+溯源0 / P6.5 exit0 / P7 exit0 / P8 exit2 |
| 阶段产出文件（每阶段） | 是 | ✅ | — | 每阶段均有对应产出文件落盘 |
| .state.yaml phase 同步 | 是 | ✅ | — | P0→READY 全程同步（P7/P8 历史条目在 READY 提交补齐） |
| 裁剪条件 + override | 否 | — | — | 全 8 阶段不裁（schema/数据语义/跨子系统，不可裁） |
| capability_requirements | 否 | — | — | 本任务无 UI/浏览器需求，P1 未声明 |
| 分阶段落盘（防 subagent 空返回） | 是 | ✅ | — | 各 subagent 写 `P{N}-progress.md`（P1/P2/P3/P4/P5/P6/P7/P8 均有） |
| phase-产出一致性 | 是 | ✅ | — | pre-commit hook 校验；P8 bump 触发暂存面审查 |
| P6 evidence（含引用 + 溯源） | 是 | ✅ | — | 23 证据文件 + `regression.log` 尾行 `EXIT_CODE: 0`；P6.5 judge 18 条证据交叉核对通过 |
| P2 候选方案 + 权衡（≥2） | 是 | ✅ | — | 3 候选（显式列类型 / 仅依赖治理 / 改 aware 存储），权衡落 P2-design.md |
| P8 internal_only_reason | 否 | — | — | 非 internal-only（对用户可见的存储语义修复，patch 发布） |
| dispatch-context.md | 是 | ✅ | — | P1–P8 各角色独立 dispatch-context + AGATE_CARD 注入（P8 lint 修复含 attempt 2 重建指引） |
| pre-commit hook（gate / 状态转移 / 裁剪） | 是 | ✅ | — | 每次 commit 触发；READY 提交报 `GATE SKIP: 非推进场景` 属预期 |
| CI backstop | 是 | ❌ | push 未执行（沙箱无外网）→ CI 未跑 | 环境限制，非执行错误；联网后 push 即触发 |
| **技术债登记** | 是 | ✅ | — | **DEBT0020**（lint 门禁面缺口，management，medium）+ **DEBT0021**（发布流程 tag 修正，management，medium）；**DEBT0018** 追加第三例证据；**DEBT0019** 本任务已 closed（附 P5/P6 证据） |
