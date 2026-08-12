# P8 Dispatch Context — implementer（releaser P8 模式）

## 任务目标

为 TPV0089（unicode-filename-link-fix）做发布准备：产出 `P8-release.md`（含 bump_type、版本号变更确认、CHANGELOG 更新确认、临时资源清单）。**不执行 git commit/tag/bump-version**——这些由主 Agent gate 验证后亲自执行。

## 上游关联

- 输入文件（必读）：
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P0-brief.md`（环境约束）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P2-design.md`（packages 声明 + gate_commands）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P5-test-results/`（验证结果）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P6-acceptance.md`（验收结果）
  - `docs/tasks/TPV0089-unicode-filename-link-fix/P7-consistency.md`（一致性结论）
  - `AGENTS.md`（发布流程 + 版本管理约定）

## 已确认事实

- 当前版本：peekview 0.18.2 / mcp_server 0.10.0（VERSIONS.json 是唯一版本源）
- P2 packages 声明：`[peekview]`（仅前端单文件改动，MCP 无改动）
- 改动类型：bug 修复（非 ASCII 文件名链接解析）→ **bump_type: patch → 0.18.3**
- 本项目发布流程（AGENTS.md）：`make bump-version NEW_VERSION=x.y.z` 更新 VERSIONS.json + 同步所有文件 + commit + tag；CHANGELOG [Unreleased] 移到 [x.y.z] 下

## 执行步骤（releaser 只做准备，不执行）

1. 确认 bump 范围：仅 peekview（0.18.2 → 0.18.3），MCP 不动
2. 起草 CHANGELOG 更新内容（[Unreleased] → [0.18.3]，含 TPV0089 修复描述）——**只起草，不落盘**（主 Agent gate 后亲自改）
3. 产出 P8-release.md：
   - `bump_type: patch` + 理由
   - 版本号变更确认（0.18.2 → 0.18.3，仅 peekview）
   - CHANGELOG 更新计划
   - 临时资源清单（本任务启动的临时服务/进程/数据）

## 约束

- **不执行** `make bump-version` / `git commit` / `git tag`——由主 Agent 执行
- 不修改任何文件（P8-release.md 除外）
- 临时资源清单要如实列出：debug backend（:8888）、CDP Chrome 连接、build-frontend 产物等

## 产出要求

`docs/tasks/TPV0089-unicode-filename-link-fix/P8-release.md`

文件 Header（直接复制）：
---
phase: P8
task_id: TPV0089-unicode-filename-link-fix
type: release
parent: P7-consistency.md
trace_id: TPV0089-P8-20260811
status: draft
created: 2026-08-11
agent: implementer
# ── v2.0 机器字段 ──
bump_type: patch
packages: [peekview]
---

## 返回给主 Agent

两行：产出文件路径 + 一句话摘要（bump 计划，不超过 30 字）

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
5. 更新 .state.yaml phase=READY → DONE

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下发布准备步骤：

1. 读取 P2-design.md packages 声明，确定需 bump 的包
2. 为每个 package 执行发布检查命令
3. 更新 CHANGELOG [Unreleased] → 版本号
4. 产出 P8-release.md（含 bump_type、版本号变更确认、CHANGELOG 更新确认、临时资源清单）

> **注意**：releaser subagent 不执行 bump-version / git commit / git tag，这些由主 Agent 在 gate 验证通过后亲自执行。

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
- 版本号变更确认（version 文件已修改）
- CHANGELOG [Unreleased] → 新版本号
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装

## gate 规则

```bash
check-gate.sh P8 $TASK_DIR
```

- bump_type 字段存在
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
- [ ] active-tasks.md 任务行状态已更新
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

<objective_info>
- 环境状态：当前 peekview 0.18.2 / mcp_server 0.10.0；P1-P7 全部通过
- 关键标识：bump 范围 [peekview]；bug 修复 → patch → 0.18.3
- 查证结果：P6 13/13 PASS；P7 BLOCKER=0
</objective_info>
