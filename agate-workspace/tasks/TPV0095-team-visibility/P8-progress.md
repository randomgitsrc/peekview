---
phase: P8
task_id: TPV0095-team-visibility
type: progress
agent: implementer (releaser P8 模式)
created: 2026-09-03
---

# P8-progress — TPV0095 发布准备

> 状态标记：`[PROD_NOT_TOUCHED]`（只读 VERSIONS.json / CHANGELOG.md / Makefile / git 日志 + 任务目录；未触碰生产 :8080 / ~/.peekview/ / pipx；未执行 bump/commit/tag）。

## 关键步骤

1. 读 dispatch-context + implementer 角色（P8 节）+ P0-brief：bump 建议 = peekview 0.21.0→0.22.0（minor，新功能+schema）+ mcp 0.11.0→0.12.0；frontend 不独立 bump。
2. 读 P2-design.md packages（3 包）+ §13 版本备注 + P7-consistency.md（BLOCKER=0，DESIGN_GAP 8/8）。
3. 实测版本锚：`VERSIONS.json` 0.21.0/0.11.0；`sync_versions.py --check` exit 0；tag v0.21.0 / mcp-v0.11.0 存在。
4. 读 CHANGELOG.md：[Unreleased] 现含 DEBT0005 测试修复 + 仓库整理两节（非 TPV0095）；[0.21.0] 节为空（tag 时即空，历史问题）；TPV0095 全链未写 CHANGELOG → P8 一次性补条目。
5. 读 Makefile bump targets：bump-version :251（含 build-frontend-fast）/ bump-mcp-version :295（含 npm lock + MCP dist）。
6. 债务核对：tech-debt.md DEBT0004（关联不加剧）/DEBT0005（closed）/DEBT0006（关联开放，SCOPE+3 裁定不改）/DEBT0007（无关）→ `debt_check: reviewed`，无阻断。
7. 临时资源清点：debug :8888 仍在运行（P5 起 bash job 持住）+ /tmp/peekview-debug 数据 + Downloads 两个 retry 验证脚本 + /tmp/pv-bdd34-home + git 工作树非干净项。
8. 产出 `P8-release.md`（bump_type: minor / debt_check: reviewed / 每包旧→新版本 / CHANGELOG 计划 / 临时资源清单 / Lessons Learned 3 条 / [PROD_NOT_TOUCHED]）。

## 产出

- `agate-workspace/tasks/TPV0095-team-visibility/P8-release.md`（P8 gate 输入）

## 交接提醒（主 Agent）

- bump 顺序：先 `make bump-version NEW_VERSION=0.22.0` + amend CHANGELOG（§4.2/§4.3），再 `make bump-mcp-version NEW_MCP_VERSION=0.12.0` + amend（§4.4）；tag 创建后按卡片 DEBT0013 时序安排 P5 重跑。
- READY 收尾：按 P8-release.md §8 清单执行 `make debug-stop`（:8888 仍在运行）；docs/roadmap/improvement-backlog.md #48 回写 done（agate-workspace/roadmap/roadmap.md 不存在，关联 RM 在 improvement-backlog）。
