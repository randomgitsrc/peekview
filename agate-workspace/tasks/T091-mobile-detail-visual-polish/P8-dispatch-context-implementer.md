---
phase: P8
task_id: T091-mobile-detail-visual-polish
role: implementer
---

# 派发指引 — T091 P8 发布准备（releaser 模式）

## 目标

产出 `P8-release.md`（发布准备文档），**不执行任何 git commit/tag/bump-version 命令**——这些由主 Agent 在你的产出通过 gate 验证后亲自执行。你的任务只是准备信息、确认发布前置条件、更新 CHANGELOG.md 内容（写入文件，但不 commit）。

## 背景

T091 是修正 T090（v0.18.1）移动端视觉缺陷的任务，已完整走完 P0-P7（含一次 P6→P5→P4 的规范回退修复真实 CSS 缺陷），P7 一致性检查通过无 BLOCKER。现在进入发布准备。

## 你要做的事

1. **读取 `P2-design.md` 第 0 节 `packages: [frontend-v3]`**，确认本次发布只涉及 `frontend-v3` 包（对应主包 `peekview`，PyPI 版本），不涉及 `packages/mcp-server`（MCP Server 版本独立管理，本任务未改动 MCP 相关代码）

2. **确定 `bump_type`**：本任务是纯 bug 修复 + UX 打磨（meta-tags-bar 留白/换行、markdown 正文边距、底部栏 padding 对称性 bug 修复、Copy/Wrap 按钮图标化、外加本轮修复的遗留 CSS 冲突 bug），无新功能、无破坏性变更 → `bump_type: patch`。当前 `VERSIONS.json` 里 `peekview` 版本是 `0.18.1`，patch bump 后应为 `0.18.2`（不需要你自己改 VERSIONS.json，只需在 P8-release.md 里写明推荐的目标版本号，实际执行 `make bump-version` 由主 Agent 做）

3. **更新 `CHANGELOG.md`**：把 `[Unreleased]` 区域填入本次变更条目（可以直接编辑文件写入内容，但不要 git commit）。参考现有 `[0.18.1]` 条目的格式风格（"变更"分类 + 简短用户可见描述 + `(T091)` 任务标记）。本次变更条目应涵盖：
   - meta-tags-bar 移动端留白改善（padding 16px + 自然换行，不再横向滚动裁切标签）
   - markdown 正文移动端边距恢复到合理留白（16px padding，总 24px）
   - 底部操作栏 padding 上下对称性 bug 修复
   - Copy/Wrap 按钮改为图标化风格，与 DESIGN.md 规定的按钮体系保持一致
   - （可选，若认为值得单独提及）修复了 meta-tags-bar 与遗留全局 CSS 规则冲突导致的高度坍缩问题
   
   请写完整句子，不要用技术术语堆砌（面向用户可读，参考现有 CHANGELOG 条目的语气）。

4. **发布前置检查**：
   - 运行 `cd frontend-v3 && npx vue-tsc --noEmit` 确认类型检查通过
   - 运行 `make lint` 确认 ruff 通过（虽然本任务未改动 backend，但发布前检查是标准步骤）
   - 确认 `git log v0.18.1..HEAD --oneline` 列出的提交都已被 CHANGELOG 条目覆盖（不要遗漏任何用户可见改动）

5. **临时资源清单**：列出本任务全程启动的临时服务/进程/数据（debug backend :8888、`/tmp/peekview-debug/` 数据目录、本轮验证中创建的任何临时 entry 等），供主 Agent 在 READY 收尾检查时清理参考

## 产出规格（P8-release.md 必须包含）

```yaml
bump_type: patch
target_version: 0.18.2  # peekview 主包，MCP server 不涉及
```
- 版本号变更确认（说明当前 VERSIONS.json 状态，不要自己改这个文件）
- CHANGELOG [Unreleased] 更新确认（贴出你写入的具体条目文字）
- 发布前置检查结果（vue-tsc/lint 是否通过，commit 覆盖核对结果）
- 临时资源清单

## 约束

- **不执行** `git commit`、`git tag`、`make bump-version`、`git push` 等任何写入 git 历史的命令
- **可以**编辑 `CHANGELOG.md` 文件内容（写入 `[Unreleased]` 区域），但不要 commit 它
- 不改动任何源代码文件（本任务的代码改动已在 P4/P4重试#1 完成并通过全部验证，P8 不应有代码变更）

## 完成后向我报告

P8-release.md 路径、推荐的 bump_type/target_version、CHANGELOG 条目内容摘要、发布前置检查是否都通过，一句话总结，不要贴全文。

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
