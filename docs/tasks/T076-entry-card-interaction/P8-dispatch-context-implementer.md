---
phase: P8
generated_by: agate-inject-card.sh + 主 Agent
task_id: T076
role: implementer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

作为 P8 releaser（implementer P8 模式），为 T076 做发布准备：判定 bump_type、更新 CHANGELOG [Unreleased]、核对版本文件、列临时资源清单，产出 `docs/tasks/T076-entry-card-interaction/P8-release.md`。**不执行 bump-version / git commit / git tag**（主 Agent 在 gate 通过后亲自执行）。

### 约束

- 读 P2-design.md packages 声明（[frontend-v3]）确定 bump 范围：T076 是纯前端改动，但前端构建打包进 peekview 后端包（static/），所以 bump **peekview** 包（mcp_server 不动，保持 0.10.0）
- bump_type 判定（semver）：T076 含新用户可见功能（Tags 可点击跳转 + Explore tag 过滤 UI + tag-overflow tooltip）+ 交互修复（card `<a>` 拆分）。有功能新增（向后兼容）→ 倾向 **minor**。请复核 CHANGELOG 历史的版本风格后确定，并写明理由
- CHANGELOG 更新：在 `[Unreleased]` 追加 T076 条目（保留现有 T074 + ruff lint 条目，它们将随本次一起发布）。条目按 Keep a Changelog 分类（新增/修复/变更），标 (T076)
- **不执行** `make bump-version` / `git commit` / `git tag`（主 Agent 职责）
- 临时资源清单：本任务启动的临时服务/进程/数据/开发安装（供主 Agent READY 收尾清理）
- 声明 `[PROD_NOT_TOUCHED]`（全程隔离 DB，未触碰生产）

### 上游关联

P7 一致性检查通过（BLOCKER=0，实现忠实 P2 方案 A）。P6 验收 21 BDD 全 PASS。当前版本 peekview=0.11.2 / mcp=0.10.0。CHANGELOG [Unreleased] 已有 T074（display_name null）+ ruff lint 残留两条（未发布，随本次发布）。

### 输入文件

- `docs/tasks/T076-entry-card-interaction/P2-design.md`（packages=[frontend-v3]）
- `docs/tasks/T076-entry-card-interaction/P0-brief.md`（任务性质：交互修复 + tag 过滤新功能）
- `CHANGELOG.md`（版本历史 + [Unreleased] 现有条目）
- `VERSIONS.json`（当前版本源）
- `AGENTS.md`（发布流程：make bump-version + CHANGELOG 填写规范）
</dispatch_guide>

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
3. 主 Agent 执行 gate 验证 → 通过后执行 bump-version → commit + tag
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

仍须主 Agent 手动确认：
- 从 P2 packages 逐包读取发布检查命令并执行
- 重跑 P5 gate（gate_commands.P5 exit 0 + failed==0）
- git log 对照 CHANGELOG 无遗漏
- 从 P2 packages 验证 version 文件路径

## READY 收尾检查（P8 gate 通过后）— 主 Agent 亲自执行（不派发 subagent）

参考 P8-release.md 临时资源清单执行清理：

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

## 推进条件

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
- 当前版本：VERSIONS.json peekview=0.11.2, mcp_server=0.10.0
- CHANGELOG [Unreleased] 现有条目（保留，随本次发布）：
  - 修复：Account Settings 清空 display_name 发送 null (T074)
  - 修复：ruff lint 残留（cli.py N806 noqa + scripts import 排序）
- T076 改动摘要（供 CHANGELOG 条目）：
  - 变更：EntryCard/EntryListRow card-body `<a>` 拆分为 `<div>`，title/username/tag 各自独立 `<a>`（修复右键复制链接混乱 + hover 全下划线）
  - 新增：BaseTag 可点击跳转 /explore?tags={tag} 过滤页
  - 新增：Explore 页 URL ?tags= 过滤 + 可移除 FilterChip 指示
  - 新增：tag-overflow +N tooltip（hover/tap 显示全部 tags）
- bump-version 命令（主 Agent 执行）：`make bump-version NEW_VERSION=x.y.z`（更新 VERSIONS.json + 同步所有文件 + commit + tag）；CHANGELOG [Unreleased]→[x.y.z] 在 bump 后 git commit --amend
- 临时资源（本任务启动，供 READY 清理）：
  - debug backend http://127.0.0.1:8888（PID 282214，make debug-stop 停止 + 清理 /tmp/peekview-debug/）
  - 隔离 DB /tmp/peekview-debug/（debug-stop 自动清理）
  - 临时脚本 /tmp/opencode/*.ts + /tmp/e2e-results/（可删）
  - CDP Chrome :18800 是外部环境（非本任务启动，不清理）
  - 无开发安装（未 pip install / npm link）
- 客观事实：全程 [PROD_NOT_TOUCHED]（隔离 DB，未触碰 :8080 / ~/.peekview/）
</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.sh` 审计失败。
