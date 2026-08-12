# P8 dispatch-context: releaser

## 目标

产出 P8-release.md，含 bump_type、版本号变更确认、CHANGELOG 更新确认、临时资源清单。不执行 git commit/tag。

## 约束

- releaser 只产出文件，不执行 bump-version / git commit / git tag
- 主 Agent 在 gate 验证通过后亲自执行 bump-version + commit + tag

## 上游关联

- P2-design.md：packages=frontend-v3
- P7-consistency.md：一致性检查通过

## 输入文件

1. `docs/tasks/T081-resizable-sidebars/P2-design.md` — packages 声明
2. `docs/tasks/T081-resizable-sidebars/P7-consistency.md` — 一致性检查通过
3. `VERSIONS.json` — 当前版本 peekview 0.15.0 / mcp 0.10.0
4. `CHANGELOG.md` — 需更新 [Unreleased] 区域

## 版本判定

- T081 新增功能（可拖拽侧边栏 + localStorage 持久化 + 键盘可访问性）
- 加功能 → minor bump
- peekview: 0.15.0 → 0.16.0
- mcp_server: 0.10.0（不变，MCP 无改动）

## CHANGELOG 内容

### [0.16.0] - 2026-08-05

#### 新增
- 详情页侧边栏可拖拽调整宽度：file-sidebar 和 toc-sidebar 各添加 resize handle，支持鼠标拖拽改变宽度 (T081)
- 宽度持久化：拖拽后的宽度存储到 localStorage，刷新后自动恢复 (T081)
- 双击 reset：双击 resize handle 重置为默认宽度 (T081)
- 键盘可访问性：resize handle 支持 Tab 聚焦 + ArrowLeft/ArrowRight 调整宽度 (T081)
- min/max clamp：file-sidebar 160-500px，toc-sidebar 150-400px，防止过度拖拽 (T081)
- 拖拽期间 user-select: none：防止拖拽时选中文字 (T081)
- 移动端不显示 handle：<1024px 时隐藏（已有 drawer 机制）(T081)
- zen mode 兼容：zen mode 隐藏 handle (T081)

#### 修复
- 统一侧边栏宽度定义：移除 EntryDetailContent.vue scoped 硬编码宽度（200px/240px），统一到 CSS 变量 --sidebar-width/--toc-width (T081)
- layout.css .file-sidebar 补全 overflow-y: auto + position: relative (T081)
- T082 BDD-24 子组件行数阈值调整 200→300（T081 合理增加组件复杂度）

## 临时资源清单

- debug backend :8888（PID 1320395，需停止）
- /tmp/peekview-debug/ 数据目录（需清理）
- /tmp/opencode/t081-p6-verify*.cjs 验证脚本（可删除）

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
