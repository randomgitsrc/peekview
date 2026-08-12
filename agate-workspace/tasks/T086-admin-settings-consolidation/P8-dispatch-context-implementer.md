---
phase: P8
task_id: T086-admin-settings-consolidation
type: dispatch-context
role: implementer
trace_id: T086-P8-20260807
created: 2026-08-07
---

# P8 派发指引 — implementer（P8 发布准备模式）

## 目标

为 T086 做发布准备：只涉及 `packages: [peekview]`（P2-design.md §5 已声明，不涉及 mcp_server）。产出 P8-release.md，**不执行 git commit / git tag / bump-version**——这些由主 Agent 在 gate 验证通过后亲自执行。

## 约束

- **不执行** `make bump-version`、`git commit`、`git tag`——只产出 P8-release.md 供主 Agent 消费。`make bump-version` 在本项目里是一步完成"改 VERSIONS.json + 同步所有文件 + build-frontend + commit + tag"的原子操作（见 `Makefile:251-274`），你不能碰这个命令，也不要手工改 `VERSIONS.json`（主 Agent 会在 gate 验证通过后统一跑这个命令）
- **可以直接编辑 `CHANGELOG.md`**：把 `[Unreleased]` 区域改写为新版本号区块（`## [0.18.0] - 2026-08-07` 这种格式，日期用今天），这是纯文档编辑，不受上条约束限制，且是 P8 产出规格明确要求的一部分
- **bump_type 建议**：`minor`（理由供你复核：T086 是把此前完全无 UI 入口、只能手敲 URL 访问的 `/admin` 页面，整合进 `/settings` 的可发现 tab，新增了用户可见的功能入口——符合"加功能 / 内部重构改 API（向后兼容）"→ minor 的判定标准；`/admin` 路由删除虽是行为变更，但该路由此前无任何 UI 暴露，实际影响面接近零，不构成需要 major 的破坏性变更；后端 API 零改动）。若你复核后认为应为其他类型，需给出理由
- **当前版本**：`peekview: 0.17.1`（`VERSIONS.json`），mcp_server 不涉及本任务，不需要改动
- **CHANGELOG**：`[Unreleased]` 区域当前为空，需把 T086 的用户可见改动写入新版本号区块（新增/变更两类）：
  - 新增：`/settings` 新增"用户管理"tab（管理员可见，整合原 `/admin` 独立页面的全部功能：用户列表分页/禁用启用/角色升降级/重置密码/删除）；UserMenu 新增管理员可发现入口
  - 变更：`/admin` 独立路由已删除，不再重定向，直接落 404（原路由无 UI 入口，仅限手敲 URL 访问的用户受影响）
- **发布检查命令**：`packages: [peekview]` 对应的检查命令按项目惯例是 `make pre-publish-quick`（不 rebuild，快速检查），供你在产出中列出（不要求你执行，执行由主 Agent 做）

## 上游关联

parent: P7-consistency.md（approved，无 BLOCKER）
祖先: P2-design.md §5（packages 声明）

## 输入文件

1. `docs/tasks/T086-admin-settings-consolidation/P2-design.md`（§5 packages 声明）
2. `docs/tasks/T086-admin-settings-consolidation/P1-requirements.md`（BDD 概览，供撰写 CHANGELOG 用户可见改动描述）
3. `VERSIONS.json`（当前版本号）
4. `CHANGELOG.md`（现有格式惯例，参照最近几个版本的写法）

## 客观查证信息

- P2-design.md packages 声明只有 `[peekview]`，不涉及 `mcp_server`，本次发布准备不需要处理 `packages/mcp-server/`
- 本任务全过程未接触生产环境（P5/P6 verifier 均已确认 `[PROD_NOT_TOUCHED]`）
- 本任务临时资源：`/tmp/peekview-debug/`（debug backend 数据，已在每轮 verifier 完成后 `make debug-stop` 清理）；无额外开发安装

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
