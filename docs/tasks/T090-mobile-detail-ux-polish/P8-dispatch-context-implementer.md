---
phase: P8
task_id: T090-mobile-detail-ux-polish
role: implementer
---

# 派发指引 — T090 P8 发布准备（releaser 模式）

## 目标

产出 P8-release.md（发布准备文档），**不执行** `bump-version`/`git commit`/`git tag`——这些由主 Agent 在 gate 验证通过后亲自执行。你只负责：确定 bump 范围、跑发布前检查、更新 CHANGELOG、列出临时资源清单。

## 上游关联

- P7-consistency.md（approved）已核实 `packages: [frontend-v3]`（P2 §0 声明）与 P4 实际改动范围一致，`DESIGN.md` 是已知的文档类例外（不影响包版本判定）
- 本任务只改了 `frontend-v3`（对应 `peekview` 主包的前端部分），**未触碰** `packages/mcp-server/` 任何文件——`VERSIONS.json` 里的 `mcp_server` 版本**不应**改动，只需 bump `peekview`
- 当前版本：`VERSIONS.json` 里 `peekview: 0.18.0`，`mcp_server: 0.10.0`
- CHANGELOG.md 的 `[Unreleased]` 区域已有 3 条 T090 相关记录（P4 阶段已写入），待你在本阶段把 `[Unreleased]` 标题连同这 3 条一起移动到新版本号段落下（不是重写内容，是移动 + 加日期）

## bump_type 判断

本任务是移动端详情页三处 UI/交互 bug 修复（滚动跳变消除、底部栏定位修复、边距缩减），不新增功能、不改变任何公开 API（前端组件内部实现改动，无对外接口变化）。按 AGENTS.md「版本 bump 判定」惯例（"修 bug / 不改 API 行为 → patch"），倾向 `bump_type: patch`（0.18.0 → 0.18.1）。请你核实这个判断是否成立（尤其确认 DESIGN.md 的行为反转是否构成"新功能"而非"修复"——参考：用户报告的是现有交互体验差/有 bug，本任务是修复这些问题，不是新增能力，倾向仍是 patch），如有不同判断请说明理由。

## 必读输入文件

1. `docs/tasks/T090-mobile-detail-ux-polish/P2-design.md`（§0 packages 声明）
2. `docs/tasks/T090-mobile-detail-ux-polish/P7-consistency.md`（§3.1 packages 与改动范围核对结论）
3. `VERSIONS.json`（当前版本）
4. `CHANGELOG.md`（`[Unreleased]` 区域现状）
5. `Makefile`（发布检查命令，如 `pre-publish-quick` 等目标，供你确认有哪些发布前检查可跑——但不要执行 bump-version/publish 本身）

## 执行步骤

1. 确认 bump 范围：只 `peekview`，不动 `mcp_server`
2. 跑发布前检查（不含 bump-version 本身）：`make lint && make typecheck`（若之前阶段已跑过，可重跑确认无退化）
3. 更新 `CHANGELOG.md`：把 `## [Unreleased]` 下的 3 条 T090 记录连同标题一起改为 `## [0.18.1] - {今天日期}`（若你判断 bump_type 不是 patch，用对应版本号），在其上方保留一个空的 `## [Unreleased]` 标题（后续任务继续往里加）
4. 列出临时资源清单：本任务全程使用的 debug backend（127.0.0.1:8888）、测试数据 entry（`t090-long-markdown`/`t090-long-code`/`t090-md-multifile`/`t090-py-multifile`）等，供主 Agent 后续清理参考
5. 产出 P8-release.md

## 环境隔离（强制）

严禁执行 `bump-version`/`git commit`/`git tag`/`make publish`。严禁触碰生产 :8080。

## 产出（路径约束，硬约束）

`docs/tasks/T090-mobile-detail-ux-polish/P8-release.md`

Header：
```
---
phase: P8
task_id: T090-mobile-detail-ux-polish
type: release
parent: P7-consistency.md
trace_id: T090-P8-20260810
status: draft
created: 2026-08-10
agent: implementer
---
```

必须包含字段：
```yaml
bump_type: patch   # 或你核实后的判断
packages_to_bump: [peekview]
current_version: "0.18.0"
target_version: "0.18.1"   # 按 bump_type 计算
```

## 门槛（什么算完成）

- `bump_type` 字段声明 + 理由
- CHANGELOG.md `[Unreleased]` → 新版本号段落已改好（工作区改动，未 commit）
- 临时资源清单完整
- 未执行 bump-version/commit/tag/publish

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
