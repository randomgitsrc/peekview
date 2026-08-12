# P8 派发指引 — T075 releaser（发布准备）

## 目标

为 T075 做发布准备：产出 `P8-release.md` + 更新 CHANGELOG。**不执行 bump-version / git commit / git tag**（主 Agent 在 gate 验证后亲自执行）。

## 任务背景

T075 structured-data-viewer 已完成 P0-P7：
- 53 BDD 全 PASS，全量验证通过（backend 1008 + frontend 1177 + E2E 84/84）
- 新增功能：TableView（CSV/TSV）+ TreeView（JSON/YAML/XML）+ 源码/渲染切换 + 格式检测修正
- 当前版本：peekview v0.13.1, mcp_server v0.10.0

## 版本 bump 判定

- **bump_type: minor**（v0.13.1 → v0.14.0）
- 理由：新增用户可见功能（结构化数据富渲染 + 统一切换机制），非破坏性，向后兼容

## 约束

- 只产出 P8-release.md + 更新 CHANGELOG.md
- **不执行** make bump-version / git commit / git tag（主 Agent 执行）
- 不修改代码文件
- P2 packages = [backend, frontend]——frontend 是内部构建（static 内嵌），版本源是 VERSIONS.json 的 peekview 字段；MCP server 无改动不 bump

## 上游关联

- P2-design.md：packages 声明 + gate_commands
- P7-consistency.md：一致性检查通过
- CHANGELOG.md：当前无 [Unreleased] 段，T075 改动需记录

## 输入文件

1. `docs/tasks/T075-structured-data-viewer/P2-design.md`（packages + gate_commands）
2. `CHANGELOG.md`（现有记录）
3. `VERSIONS.json`（版本源）
4. `docs/tasks/T075-structured-data-viewer/P6-acceptance.md`（验收结果，作为 CHANGELOG 内容依据）

## 产出

1. `docs/tasks/T075-structured-data-viewer/P8-release.md`
   - bump_type: minor
   - 版本号变更确认（0.13.1 → 0.14.0）
   - CHANGELOG [Unreleased] → [0.14.0] 确认
   - **临时资源清单**：本任务启动的临时服务/进程/数据/开发安装（debug backend :8888、debug seed 数据、npm 依赖 @tanstack/vue-table + js-yaml + @types/js-yaml）
   - Lessons Learned（2-3 条关键教训）
2. 更新 `CHANGELOG.md`：新增 `## [0.14.0] - 2026-08-01` 段，记录 T075 改动

## CHANGELOG 内容（T075 改动，供参考）

### 新增
- 结构化数据富渲染：CSV/TSV 文件渲染为可分页/排序/筛选/横向滚动的表格（TableView，TanStack Table v8 headless + 复用 Pagination.vue）(T075)
- JSON/YAML/XML 文件渲染为递归树视图（TreeView，展开/折叠/类型标签/路径搜索/点击复制）(T075)
- 源码/渲染统一切换机制：所有富渲染格式（含 Markdown）支持源码 ↔ 渲染视图切换，文件切换时重置为渲染视图 (T075)
- 截断保护：CSV >50000 行 / JSON/YAML/XML >2MB 显示截断提示 + 下载完整文件按钮 (T075)

### 修复
- 后端 language.py 扩展名映射修正：`.tsv` 从错误的 `'csv'` 修正为 `'tsv'`，TSV 文件可正确渲染为表格（tab 分隔）(T075)
- 解析失败降级：CSV/JSON 解析失败时显示错误提示 + 自动降级源码视图，页面不崩溃 (T075)
- 文件切换时 parse-error 残留：TreeView 空 content（加载中）不再误报解析失败 (T075)

### 依赖
- 新增 @tanstack/vue-table + js-yaml（前端结构化数据解析/表格渲染）(T075)

## 门槛

- P8-release.md 存在且含 bump_type: minor
- CHANGELOG.md 新增 [0.14.0] 段
- 临时资源清单完整
- Lessons Learned 2-3 条

## 返回给主 Agent

只返回两行：产出路径 + 一句话摘要（bump_type + 版本号）。

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
