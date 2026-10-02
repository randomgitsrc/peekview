# P8-dispatch-context-implementer — TPV0101

---
phase: P8
task_id: TPV0101
role: implementer
mode: P8-release
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

作为 **releaser**（implementer 的 P8 模式），为 TPV0101 执行**发布准备**，产出 `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P8-release.md`。

**你只做发布准备方案**：确定 bump_type + 受影响 package + 版本号变更方案 + CHANGELOG 条目文本 + 发布检查命令清单 + 债务清单确认（`debt_check`）+ 临时资源清单 + Lessons Learned。
**你不得执行** `git commit` / `git tag` / `make bump-version` / `make publish`，**不得修改** `VERSIONS.json` / `CHANGELOG.md` / `backend/pyproject.toml` / `frontend-v3/package.json` 等任何版本文件（这些由主 Agent 在 gate 通过后亲自执行）。

## 角色定义

`~/.agate/v0.77.0/agate/assets/execution-roles/implementer.md`（先读 P8 相关节：多包发布 / 版本 bump / Lessons Learned / 临时资源清单）

## 输入文件

1. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P2-design.md`（§frontmatter `packages` 声明 + gate_commands）
2. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P6-acceptance.md`（验收结果）
3. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P6.5-judge-verdict.md`（judge 复核）
4. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P7-consistency.md`（一致性结论）
5. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P5-test-results/`（技术验证结果）
6. `agate-workspace/debt/tech-debt.md`（DEBT0019 条目状态）
7. `VERSIONS.json`、`CHANGELOG.md`、`Makefile`（版本源 / 变更日志 / 发布命令真相源，只读）

## 客观查证信息（主 Agent 已核实，供你起点核对）

- **任务**：TPV0101，`change_type: refactor`，`domains: [backend]`，`packages: [peekview]`（P2 §frontmatter）。
- **交付内容**（`git diff --stat v0.26.0..HEAD` 实读，排除 `agate-workspace/`）：
  - `backend/peekview/models.py`（25 个 datetime 列显式 `sa_column=Column(DateTime(timezone=False), ...)`）
  - `backend/pyproject.toml`（`sqlmodel>=0.0.14` → `>=0.0.14,<1.0.0`）
  - `backend/tests/test_datetime_naive_compat.py`（新增守卫测试）、`backend/tests/test_dependency_guard.py`（新增依赖守卫）
  - **零前端改动、零 MCP 改动**（`packages/mcp-server/**` 未动）
- **行为性质**：**用户可见行为不变**（P6 回归口径 `regression_pass: true`；BDD-7/17 证明 API 时间字段契约不变）——修复的是**依赖升级导致的内部存储层类型契约缺陷**。→ 版本语义推断：**patch**（`0.26.0 → 0.26.1`）；最终由你判定并给出依据。
- **版本源**：`VERSIONS.json`（`peekview: 0.26.0`，唯一版本源）；`mcp_server: 0.12.0`（本任务**不 bump**——零 MCP 改动）。`make bump-version NEW_VERSION=x.y.z` 会经 `scripts/sync_versions.py --bump-peekview` 同步到 `backend/pyproject.toml` / `frontend-v3/package.json` / `README.md` / `INDEX.md` / `backend/README.md` / `backend/peekview/__init__.py` / `docs/roadmap/improvement-backlog.md`（主 Agent 执行，你不用动）。
- **CHANGELOG**：当前 `[Unreleased]` 为空 → 新条目挂在 `## [0.26.1] - <执行日>` 下，类别用 `### 修复`。**你只给文本方案**。
- **债务清单**：`DEBT0019`（status: open，priority: high，本任务即为其闭环修复）；另注意本任务过程中登记的其它债务（如 `DEBT0018`，见 `tech-debt.md`）。`debt_check` 建议 `reviewed` 并在正文附条目 id 清单；是否将 DEBT0019 置为 resolved 由主 Agent 决定（你只给建议）。
- **roadmap**：`agate-workspace/roadmap/roadmap.md` **不存在** → 无 RM 条目需回写。
- **临时资源**：本任务 P5 创建的隔离 venv `/tmp/ci-repro-venv`（sqlmodel 0.0.47）；无 debug server / 无 E2E（`ui_affected: false`）。生产 `:8080` 与 `~/.peekview/` 全程未触碰（`[PROD_NOT_TOUCHED]`）。

## 产出规格（P8-release.md 必须含）

- `bump_type: major / minor / patch`（frontmatter）
- `debt_check: none / reviewed`（frontmatter；本任务预期 `reviewed`）
- 受影响 package 与「旧版本 → 新版本」；**不 bump** 的包及依据
- CHANGELOG 条目**文本方案**（不放实际修改动作）+ 目标版本标题与日期
- **发布检查命令清单**（从 Makefile 取，主 Agent 会逐条实跑）：至少含 `make lint` + `make test-quick` 这类 CI 强制项；本任务零前端改动，说明是否需 `make typecheck` / `make test-frontend` / `make build-frontend`（给出判断依据，不要机械照搬）
- **临时资源清单**（releaser→主 Agent 交接，供 READY 收尾清理）
- **Lessons Learned**（2-3 条，标类别/来源任务/日期）
- `[PROD_NOT_TOUCHED]` 或 `[PROD_TOUCHED]` 标记

## 约束

- **只读 + 只写 P8-release.md**；不得改版本文件/CHANGELOG/源码；不得 commit/tag/publish
- shell 命令显式带超时；勿碰生产 `:8080` / `~/.peekview/`
- 语言：中文

## 返回给我（重要）

只返回两行：
1. `P8-release.md` 路径 + `bump_type` + 目标版本（`peekview x.y.z → a.b.c`）
2. 一句话：受影响包 + 是否建议同步关闭 DEBT0019

绝对不要返回文件全文。

---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P8

路径：phase-cards/P8-release.md
---
# P8 — 发布

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P8 + internal_only: true + internal_only_reason 已声明 → 跳过，标记 READY
> ⑨ P8 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 releaser subagent（implementer P8 模式）执行发布准备
   1.1 写 P8-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. releaser subagent 产出 P8-release.md，**不执行 git commit/tag**
3. 主 Agent 执行 gate 验证 → 通过后执行 bump-version + CHANGELOG 更新 → 同一 commit + tag
4. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）——**含 canonical 临时产物目录 `<项目根>/.agate-tmp/`**（受限 harness 下的探针/一次性脚本；其四项约定与「存在却未被忽略」的 P8 告警见 `platform-notes.md`「受限 harness 通用约束」，忽略片段见 `assets/templates/gitignore-fragment.txt`）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + P8-release.md，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 READY，不要提前写 DONE——phase = 本 commit 的产出阶段；终态 DONE 收尾随任务终态 commit 一起

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下发布准备步骤：

1. 读取 P2-design.md packages 声明，确定需 bump 的包
2. 为每个 package 执行发布检查命令
3. 更新 CHANGELOG [Unreleased] → 版本号
4. 确认债务清单：读 `{AGATE_WORKSPACE}/debt/tech-debt.md`（若存在），在 P8-release.md 写入 `debt_check:` 字段（TAG0001 Phase 3）
5. 产出 P8-release.md（含 bump_type、版本号变更确认、CHANGELOG 更新确认、debt_check 字段、临时资源清单）

> **注意**：releaser subagent 不执行 bump-version / git commit / git tag，这些由主 Agent 在 gate 验证通过后亲自执行。

## 多包发布拆批（模式 2/3，条件触发）

> 仅当 P2 packages > 1 时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry 见 dispatch-protocol「派发编排机制」并行规则。

多包发布时 P8 可拆批并行（模式 2 静态拆批 / 模式 3 并行）：

1. 每个 package 派一个 releaser subagent（implementer P8 模式），各写 `P8-release-{pkg}.md`
2. 各 releaser 只处理自己包的发布准备（版本 bump 建议 + CHANGELOG 更新 + 发布检查命令）
3. 所有 releaser 返回后，主 Agent 派合并 subagent 整合唯一 P8-release.md
4. 合并 subagent 需交叉核对：各包版本号不冲突、bump_type 汇总一致、CHANGELOG 变更合并无遗漏
5. 主 Agent 在 gate 验证通过后统一执行 bump-version / git commit / git tag

**合并机制**：单包时 releaser 直接产出 P8-release.md（不走合并）；多包时各 releaser 产 P8-release-{pkg}.md，合并 subagent 整合唯一 P8-release.md 供 gate 检查。

## releaser→主 Agent 交接

P8-release.md 中的**临时资源清单**是 releaser→主 Agent 的交接文件：
- releaser subagent 负责写入临时资源清单（本任务启动的临时服务/进程/数据/开发安装）
- 主 Agent 使用该清单执行 READY 收尾检查中的清理工作
- P8-release.md 由 releaser subagent 产出，主 Agent 不直接编写

## 前置条件

- [ ] P7-consistency.md 通过（无 BLOCKER / DESIGN_GAP 已配对）
- [ ] P2-design.md packages 声明（决定哪些包需要 bump）

## 产出规格

P8-release.md 必须包含：
- `bump_type: major / minor / patch`
- `debt_check: none / reviewed`——债务清单确认留痕（TAG0001 Phase 3）：`none` = 本次无关注项（合法选项，不视为失败）；`reviewed` = 已核对，建议正文附条目 id 清单。只查留痕存在，不查内容达标、不阻断发布
- 版本号变更确认（version 文件已修改）
- CHANGELOG [Unreleased] → 新版本号
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装

## gate 规则

```bash
check-gate.py P8 $TASK_DIR
```

- bump_type 字段存在
- `debt_check` 字段存在（缺失 → exit 1；内容任意，含 `none` / 未关闭债务 → 不阻断，BDD-17）
- 暂存区有 version 文件变更
- 暂存区 CHANGELOG 有变更
- 若任务在 `agate-workspace/roadmap/roadmap.md` 有关联 RM 条目（按 `task_id` 反查「关联任务」列），须先回写「状态」列为 `done`，否则阻断（RM-AG0043）

主 Agent **必须亲自执行**以下验证（不可跳过、不可委托 subagent）：
- 从 P2 packages 逐包读取发布检查命令并执行 → 全部 exit 0
- **P5 验证（TAG0016 BDD-14 精简为条件化表述，底线不变——至少一次客观验证动作不可省）**：
  跑 `python3 agate/scripts/check-p6-provenance.py --audit7-only $TASK_DIR`，读 stdout 的
  `AUDIT7_RESULT: <reuse_allowed|reuse_blocked|no_reuse_claim_possible>` 行判定：
  - `AUDIT7_RESULT: reuse_allowed`（exit 0）→ 复用同一份 `P5-test-results/`（不重新执行命令）
  - `AUDIT7_RESULT: reuse_blocked`（exit 1）或 `AUDIT7_RESULT: no_reuse_claim_possible`
    （exit 0 但结果非 reuse_allowed）→ 完整重跑 `gate_commands.P5`（exit 0 + failed==0）
   - **⚠️ 时序注意（DEBT0013）**：若 `gate_commands.P5` 的链路包含
     `check-protocol-consistency.py` 的 CHECK 7（README version badge 与最新 git tag 一致性），
     P5 重跑应安排在 **commit + 创建 git tag 之后** 进行，而非 bump 版本文件后立即重跑——
     bump 已完成、tag 尚未创建的中间状态下，CHECK 7 必然报 `badge vX.Y.A != tag vX.Y.B` ERROR，
     这是设计使然（校验的是"发布完成态"），不是回归。先 tag 后重跑即 0 ERROR。
- `git log v{prev_version}..HEAD --oneline` 对照 CHANGELOG 无遗漏
- 从 P2 packages 验证 version 文件路径

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理。以上检查项无 gate 脚本自动验证（已知缺口），**必须逐项实际执行检查命令**（如 `ps aux | grep debug` 确认服务已停止、`git status` 确认工作区干净），不得仅凭记忆打勾。

**提交前暂存面审查（凭证/临时物防泄漏，RM-AG0077⑤）**：
- [ ] **`git diff --cached --name-only` 已过目**，确认不含未忽略的临时目录/敏感文件
  - 背景：**项目侧** release 命令常直接 `git add -A`（如 `make bump-version`）。某任务实测它会 stage
    **162** 条路径、其中 **158** 条在未忽略的临时目录下、含 **10 个明文 token/cookie** ⇒
    **凭证入 git 历史不可逆**。协议侧无法改项目命令，故把这一步作为**提交前的显式检查**。
  - 若发现非预期路径：先补 `.gitignore`（片段见 `assets/templates/gitignore-fragment.txt`）再 `git reset` 重来，**不要**带着它们提交

**状态与版本**：
- [ ] .state.yaml phase == READY
- [ ] {AGATE_WORKSPACE}/tasks/active-tasks.md 任务行状态已更新
- [ ] git 工作区干净
- [ ] git tag 已创建
- [ ] 若本任务触发复盘（异常模式 / 发现机制缺口 / 高价值任务），复盘产出
  `tasks/{Txxx}/retrospective.md` 基于 `agate/assets/templates/retrospective-template.md`
  模板撰写

**测试环境已清理**：
- [ ] 调试服务/进程已停止
- [ ] 临时数据已删除
- [ ] 测试占用的端口已释放
- [ ] **canonical 临时产物目录 `<项目根>/.agate-tmp/` 已清理**（或确认无需保留物、已空）
  - 自查：`ls -A .agate-tmp 2>/dev/null`；含明文凭证/会话 token 的先删
  - 约束（受限 harness）：该目录须**已被 `.gitignore` 忽略**（`git check-ignore -q .agate-tmp`）、
    内部文件名**不得**匹配测试收集模式——两项均有 `check-gate.py P8` WARNING 兜底，
    完整约定见 `platform-notes.md`「受限 harness 通用约束」、忽略片段见 `assets/templates/gitignore-fragment.txt`

**开发环境已还原**：
- [ ] 开发安装已卸载
- [ ] 系统环境无污染
- [ ] 项目依赖恢复到发布版本

**协议一致性（改造协议自身的任务必做，TAG0001-0003 批次 D4 教训）**：
- [ ] **在干净 checkout 上跑一次 `check-protocol-consistency.py`**（`git clone` 到临时目录或 CI 兜底确认），0 ERROR
  - 原因：本地 worktree 的 `.worktrees` 路径过滤会掩盖任务产出文件的扫描问题，本地 0 ERROR ≠ CI 0 ERROR
  - 若无法干净 checkout，**至少确认 CI 的 consistency job 对本次 PR 通过**
- [ ] **确认任务产出目录（`docs/tasks/` 或 `{AGATE_WORKSPACE}/tasks/`）不被一致性检查器误扫**（若为 dogfooding 任务，任务产出应已在 `NARRATIVE_DIRS` 白名单）

**生产环境无残留**：
- [ ] 无 PROD_TOUCHED 标记（触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`）
- [ ] 生产数据/API 未被测试写入

## 推进条件（全部满足才写 phase: READY）

- [ ] bump-version 完成 + P5 验证全绿（重跑或复用 `P5-test-results/`，见上方「gate 规则」条件化表述）
- [ ] CHANGELOG 已更新
- [ ] git tag 已创建
- [ ] READY 收尾检查全部通过

## 常见错误

1. **不重跑 P5 gate**：bump-version 后直接 tag，不确认测试仍全绿
2. **CHANGELOG [Unreleased] 留在模板状态**：版本 bump 完但 CHANGELOG 没更新
3. **忘记清理测试环境**：debug server 还在跑、临时数据没删 → READY 不干净
4. **临时资源清单遗漏**：P4/P5 阶段启动的服务/安装的包没记录 → 清理时遗漏
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- READY → DONE：任务完成，代码可合并/发布
- 本任务是 agate 链条的终点——P8 完成后任务状态转为 DONE

> 完成 → 任务 DONE
<!-- AGATE_CARD_END -->
