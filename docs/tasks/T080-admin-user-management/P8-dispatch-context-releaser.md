# P8 dispatch-context: releaser

## 目标
发布准备：bump 版本 + CHANGELOG。产出 P8-release.md，不执行 commit/tag。

## packages（P2 声明）
- backend/peekview：0.16.0 → 0.17.0（minor，新增 admin 用户管理 API + CLI disable/enable + 审计字段）
- frontend-v3：随 backend 同版本（VERSIONS.json 统一）
- MCP：不变（0.10.0，未改动）

## bump_type: minor
理由：新增用户可见功能（admin 用户管理 Web UI + disable/enable API + 审计字段），非破坏性（delete_self confirm_username 旁路移除是 bug 修复统一语义），按 semver minor。

## 约束
- releaser 不执行 git commit/tag/push（主 Agent 做）
- 严禁碰生产 :8080/~/.peekview/
- [PROD_NOT_TOUCHED]
- 用 make bump-version NEW_VERSION=0.17.0（VERSIONS.json 同步所有文件）
- CHANGELOG [Unreleased] → [0.17.0]

## 执行
1. 读 P2-design.md packages
2. 确认 bump_type=minor，版本 0.16.0 → 0.17.0
3. 检查 CHANGELOG.md [Unreleased] 区域，整理本任务变更条目：
   - Added: admin 用户管理（/admin 路由 + AdminView + disable/enable/promote/demote API + CLI disable/enable + 审计字段 disabled_at/disabled_by/disabled_reason + PasswordResetDialog）
   - Changed: delete_self 移除 confirm_username 旁路（LastAdmin 绝对拒绝）、list_users 返回 {items,total,page,per_page}、admin 计数 = is_admin AND is_active
   - Fixed: LastAdmin 保护补齐 demote/disable/delete 三者、CLI demote LastAdmin 保护、_check_last_active_admin is_active 条件、delete_user disabled_by FK 清理
4. 产出 P8-release.md（bump_type + 版本变更 + CHANGELOG 确认 + 临时资源清单）
5. 不跑 make bump-version（主 Agent gate 后做）
6. 返回摘要

## 临时资源清单（releaser 填）
- debug backend :8888：P5/P6 用，已 make debug-stop
- /tmp/peekview-debug/：已清理
- /tmp/p6-bdd14.ts 等临时脚本：P6 截图脚本，需清理
- 无开发安装（用 venv，无 break-system-packages）

## 产出
docs/tasks/T080-admin-user-management/P8-release.md
Header: phase=P8, type=release, parent=P7-consistency.md, status=draft, agent=releaser

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