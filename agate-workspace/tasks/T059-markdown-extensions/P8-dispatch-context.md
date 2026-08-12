---
phase: P8
task_id: T059
type: dispatch-context
created: 2026-07-20
agent: main
---

# P8 Dispatch Context: T059 Markdown Extensions

## Task Summary
Add KaTeX math, task-list checkbox, footnote, and sub/sup support to PeekView's Markdown renderer.

## Packages to Bump
- **frontend-v3** only (per P2-design.md packages declaration)
- No backend changes, no MCP server changes

## Bump Type
- `bump_type: patch` — This is a feature addition to the frontend markdown renderer, no breaking API changes, backward compatible

## Current Version
- Check `VERSIONS.json` for current peekview version
- Check `frontend-v3/package.json` for current frontend version

## Version Bump Commands
- `make bump-version NEW_VERSION=x.y.z` — updates VERSIONS.json + syncs to all files + commits + tags
- After bump: must re-run P5 gate to confirm tests still green

## CHANGELOG
- CHANGELOG.md already has entry under [Unreleased]:
  - "Markdown 扩展：KaTeX 数学公式（行内 `$...$` + 块级 `$$...$$`）、任务列表 checkbox（`- [x]`/`- [ ]`）、脚注（`[^1]`）、上标/下标（`x^2^`/`H~2~O`）"
- After bump: move [Unreleased] content to new version section

## Temporary Resources (for cleanup checklist)
- Debug backend running on :8888 (PID from `make debug-start`)
- Test data in /tmp/peekview-debug/ (slug: mdext)
- Playwright CDP connection to Chrome :18800

## P5 Gate Commands
- Frontend tests: `cd frontend-v3 && ./node_modules/.bin/vitest run`
- Frontend typecheck: `cd frontend-v3 && npx vue-tsc --noEmit`
- Backend tests: `cd backend && .venv/bin/python -m pytest tests/ -q`

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P8

路径：agate/phase-cards/P8-release.md
---
# P8 — 发布

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P8 + internal_only: true + internal_only_reason 已声明 → 跳过，标记 READY
> ⑨ P8 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 releaser subagent（implementer P8 模式）执行发布准备
2. releaser subagent 产出 P8-release.md（含临时资源清单）
3. 主 Agent 执行 READY 收尾检查（参考 P8-release.md 临时资源清单）
4. 更新 .state.yaml phase=READY → DONE

## 如果是重试

→ 读 agate/rules/state-transitions.md 确认 retry 上限（P8 MAX=2）

## 执行方式

releaser subagent（implementer P8 模式）执行以下发布准备步骤：

1. 读取 P2-design.md packages 声明，确定需 bump 的包
2. 为每个 package 执行发布检查命令
3. bump-version → 重跑 P5 gate（确认版本 bump 后测试仍全绿）
4. 更新 CHANGELOG [Unreleased] → 版本号
5. git commit + git tag
6. 产出 P8-release.md（含 bump_type、版本号变更确认、CHANGELOG 更新确认、临时资源清单）

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
- [ ] 无 PROD_TOUCHED 标记
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
