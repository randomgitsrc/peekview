---
phase: P8
task_id: TPV0093-star-lifecycle
type: release
parent: P7-consistency.md
trace_id: TPV0093-P8-20260816
status: ready
---

# P8 派发上下文 — releaser（implementer P8 模式）

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
4. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）
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

主 Agent **必须亲自执行**以下验证（不可跳过、不可委托 subagent）：
- 从 P2 packages 逐包读取发布检查命令并执行 → 全部 exit 0
- 重跑 P5 gate（gate_commands.P5 exit 0 + failed==0）
- `git log v{prev_version}..HEAD --oneline` 对照 CHANGELOG 无遗漏
- 从 P2 packages 验证 version 文件路径

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理。以上检查项无 gate 脚本自动验证（已知缺口），**必须逐项实际执行检查命令**（如 `ps aux | grep debug` 确认服务已停止、`git status` 确认工作区干净），不得仅凭记忆打勾。

**状态与版本**：
- [ ] .state.yaml phase == READY
- [ ] {AGATE_WORKSPACE}/tasks/active-tasks.md 任务行状态已更新
- [ ] git 工作区干净
- [ ] git tag 已创建

**测试环境已清理**：
- [ ] 调试服务/进程已停止
- [ ] 临时数据已删除
- [ ] 测试占用的端口已释放

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

- [ ] bump-version 完成 + P5 重跑全绿
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

## 目标

为 TPV0093 做发布准备：确定 bump 版本 + CHANGELOG 更新建议 + 发布检查 + 临时资源清单，产出 P8-release.md。**不执行 git commit/tag/bump-version**（主 Agent 在 gate 验证后亲自执行）。

## 上游关联

- `P2-design.md` packages: [backend/peekview, frontend-v3]——发布层面：前端产物打进 backend static，实际 bump 包 = backend（PeekView，PyPI `peekview`）；MCP 包（packages/mcp-server）本任务零改动不 bump
- `P7-consistency.md`（已通过）
- 当前版本：peekview 0.20.0（VERSIONS.json 唯一版本源）
- `AGENTS.md` 发布流程：`make bump-version NEW_VERSION=x.y.z` → CHANGELOG [Unreleased] → [x.y.z] → `make pre-publish-quick` → `make publish`

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0093-star-lifecycle/P0-brief.md`（env_constraints）
2. `agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md`（packages 声明）
3. `agate-workspace/tasks/TPV0093-star-lifecycle/P7-consistency.md`
4. `CHANGELOG.md`（[Unreleased] 现状）
5. `VERSIONS.json`（当前版本）

## 发布准备

1. **bump 判定**（P8 追加规则）：
   - 公共 API 行为变化 / 破坏性变更 → major
   - 加功能 / 内部重构改 API（向后兼容）→ minor
   - 修 bug / 不改 API 行为 → patch
   - 本任务：新功能（星标/墓碑/生命周期豁免）+ 新 API 端点（star/unstar/listStars/removeStars/starred 参数）+ 数据库 schema 变更（新表 + 列）——**建议 minor（0.21.0）**，理由：加功能 + 新 API（向后兼容增量字段），非破坏性
2. **CHANGELOG 更新建议**：[Unreleased] 下新增 TPV0093 条目（功能/变更/修复描述）
3. **发布检查命令**（AGENTS.md）：`make pre-publish-quick` 或 `make test-quick` 确认测试全绿（releaser 可跑检查命令，但 bump 由主 Agent 执行）
4. **债务清单**：读 `agate-workspace/debt/tech-debt.md`，写 `debt_check:` 字段（none / reviewed + 条目 id）
5. **临时资源清单**：本任务启动的临时服务/进程/数据（debug server :8888、/tmp/peekview-debug/ 数据、pytest tmp 等）

## 约束

- **不执行 git commit / git tag / bump-version 命令**——只产出建议
- 不修改源码；可读文件 + 短命令（git log / 读 VERSIONS.json）
- 环境隔离：不触碰生产 :8080 / ~/.peekview/
- 状态标记：`[PROD_TOUCHED]`/`[PROD_NOT_TOUCHED]`

## 产出

`agate-workspace/tasks/TPV0093-star-lifecycle/P8-release.md`

必须含：
- `bump_type: minor` + 理由
- 版本号变更确认（建议 0.20.0 → 0.21.0）
- CHANGELOG 更新确认（[Unreleased] 条目建议）
- `debt_check:` 字段
- 临时资源清单

## 门槛

- P8-release.md 存在且非空；bump_type + debt_check 字段存在
- 版本建议合理（对照 P2 packages）
- 临时资源清单完整（debug server / 临时数据 / 测试端口）
