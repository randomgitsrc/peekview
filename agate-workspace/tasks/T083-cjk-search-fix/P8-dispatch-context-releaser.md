# P8 Dispatch Context — releaser

## 目标
为 T083 产出 P8-release.md：确定 bump_type、更新 CHANGELOG [Unreleased]、列出版本号变更确认 + 临时资源清单。releaser 不执行 git commit/tag。

## 约束
- 不执行 bump-version / git commit / git tag（主 Agent 亲自执行）
- 不执行 make publish（主 Agent 决定何时发布）
- P2 packages: [backend] → 只 bump peekview 版本
- 当前版本：peekview 0.12.2 / MCP 0.10.0

## 上游关联
- P2-design.md：packages = [backend]
- P7-consistency.md：一致性通过
- VERSIONS.json：peekview 0.12.2 / mcp_server 0.10.0

## 输入文件
1. `docs/tasks/T083-cjk-search-fix/P2-design.md` — packages 声明
2. `docs/tasks/T083-cjk-search-fix/P7-consistency.md` — 一致性通过
3. `VERSIONS.json` — 当前版本
4. `CHANGELOG.md` — [Unreleased] 需更新

## 客观查证信息
- 改动文件：text_utils.py(新增) + database.py + entry_service.py + main.py + pyproject.toml + test_cjk_search.py(新增) + test_database.py + test_fts_content.py
- 新增依赖：jieba>=0.42.1
- 测试结果：1001 passed + 2 skipped
- 当前版本：peekview 0.12.2

## bump_type 判定
- 修 bug（中文 tag 过滤 + FTS5 中文搜索 + 连字符复合 tag 搜索盲区）
- 不改公共 API 行为（API 请求/响应格式不变）
- 不改数据库 schema
- → patch（修 bug 不改 API 行为）

## CHANGELOG 内容
### 修复
- 中文 tag 过滤失效：SQLModel JSON ensure_ascii 转义导致 LIKE 匹配失败，改用 SQLite json_each 精确匹配 (T083)
- FTS5 中文子词搜索失效：unicode61 tokenizer 不分词 CJK，改用 jieba 应用层预分词（写入 + 查询端）(T083)
- 连字符复合 tag 搜索盲区：FTS 索引文本连字符→空格，使 `google-gemini` 可被 `gemini` 搜到 (T083)
- FTS trigger 降级为仅 DELETE：消除 trigger 与应用层竞态窗口 + 垃圾 FTS token (T083)
- backfill 版本标记：PRAGMA user_version 确保 FTS 格式变化时全量重建 (T083)
- 新增 jieba>=0.42.1 依赖 (T083)

## 临时资源清单
- 无临时服务/进程启动（纯后端代码改动 + pytest 测试）
- jieba 0.42.1 已在 venv 安装（pyproject.toml 已声明依赖，无需卸载）
- 无临时数据（conftest.py autouse tmp_path 隔离）
- 无端口占用

## 门槛
- P8-release.md 含 bump_type: patch
- CHANGELOG [Unreleased] 已更新
- 版本号变更确认：0.12.2 → 0.12.3
- 临时资源清单

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