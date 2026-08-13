---
phase: P8
task_id: TPV0091-unicode-download-header-fix
type: release
parent: P7-consistency.md
trace_id: TPV0091-P8-20260813
status: draft
created: 2026-08-13
agent: releaser
---

# P8 发布准备 — 中文/日文文件名下载与图片预览 500 修复

## bump_type

```
bump_type: patch
```

- 本次改动为用户可见 bug 修复（非 latin-1 文件名下载 500 + 图片预览 500），语义化版本 `patch` 恰当。
- 目标版本：peekview **0.18.4 → 0.18.5**（VERSIONS.json 当前 `peekview: "0.18.4"`）。
- **MCP server 不 bump**：P7-consistency.md 确认「MCP 无牵连」；P2-design.md §0 不改 MCP 相关文件。`mcp_server: "0.10.0"` 保持。

### 受影响包（P2 packages 声明）

| package | 版本变化 | 说明 |
|---------|---------|------|
| peekview（PyPI 单一包） | 0.18.4 → **0.18.5** | P2 packages `[backend/peekview/api/files.py, backend/tests, frontend-v3/src/api/client.ts, frontend-v3/src/components/ImageViewer.vue]` 全部隶属该包；改后端 API + 前端预览路径 + 测试 + 新增 e2e spec |
| mcp_server（npm） | 0.10.0 → 不动 | 无牵连（P7 §0 确认） |

> 注：P2 packages 含 `ImageViewer.vue`，但按 P2-design §0 设计该文件**未改**（属受影响面非修改面，P7 §3.1 已确认），前端唯一改动为 `client.ts`。

## 版本号变更确认

- [x] VERSIONS.json 当前值已核对：`peekview: "0.18.4"`、`mcp_server: "0.10.0"`（VERSIONS.json:2-3）
- [x] 目标：`peekview: "0.18.5"`（MCP 不动）——**由主 Agent 执行 `make bump-version NEW_VERSION=0.18.5`**，releaser 不执行
- [x] P7-consistency.md 结论 BLOCKER=0 / DEVIATION-CRITICAL=0，可推进发布
- 注：P7 §8 建议（可选）修订 P2-design.md:157 e2e spec 旧前缀 `t091-` → `tpv0091-`（仅文档陈旧，链路已用 tpv0091- 跑通）。releaser 不修改 P2 文档，提示主 Agent 酌情处理。

## CHANGELOG 更新确认

- [x] CHANGELOG.md [Unreleased] 区已补写 TPV0091 条目（原为空），格式沿用现有条目风格（`### 修复` + 描述 + `(TPV0091)` 后缀）
- [x] **[Unreleased] 未改为 [0.18.5]**——版本号变更由主 Agent bump-version 后统一处理（releaser 不执行 bump-version）
- 新增条目内容摘要：
  > 修复文件名含非 ASCII 字符（中文/日文）时下载返回 500 的问题：`Content-Disposition` 改用 RFC 5987 `filename*=UTF-8''` 编码 + ASCII fallback，ASCII 文件名 header 字节级不变（零回归）；同时图片预览改走 `/content` 端点（语义为读取而非下载，修复图片 500），预览与 download header 解耦 (TPV0091)

## debt_check

```
debt_check: none
```

- 已读 `agate-workspace/debt/tech-debt.md`：文件内容为**模板 + 示例条目**（DEBT0001-0003 均为示例占位，无真实登记债务），无任何 open/in_progress 条目涉及本项目。
- 本次任务无未关闭债务关联，登记簿无关注项 → `debt_check: none`（TAG0001 Phase 3 合法选项）。
- P5 已知预存失败 `tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter` 已在 `known-failures.md` 登记（非本任务引入，TPV0090 待办），本次全量 pytest 未触发（1072 passed）。

## 发布检查命令结果（P2 packages 逐包）

| 命令 | 结果 |
|------|------|
| `cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short`（全量） | ✅ 1072 passed, 3 skipped, 0 failed（27.6s） |
| `make typecheck`（frontend） | ✅ vue-tsc passed |
| `make lint`（ruff；系统 python3 兜底） | ✅ `python3 -m ruff check peekview/ tests/` → All checks passed |

## 临时资源清单（releaser → 主 Agent 交接）

> 由主 Agent 在 P8 gate 通过后、READY 收尾检查时按此清理。

| 资源 | 状态 | 清理动作 |
|------|------|---------|
| debug backend `:8888`（/tmp/peekview-debug/） | 运行中（本任务 P4-P6 使用，勿停——P8 期间仍可用于复验） | `make debug-stop`（停 + 清理 /tmp/peekview-debug/） |
| debug 日志 `/tmp/peekview-debug.log` | 存在 | 随 debug-stop 清理 |
| 临时文件 `/tmp/tpv0091-*.log`、`/tmp/env-check/`、`/tmp/e2e-results/` | 存在 | 确认无后续需要后删除 |
| CDP Chrome `:18800`（chrome-agent.service） | 系统服务 | **不清理**（常驻服务） |
| 工作区未提交变更（非本任务代码，测试/build 产物） | `backend/peekview/static/index.html`（build 产物，mtime 08:45 > client.ts 08:34，**fresh**）、`backend/zip-{entry,export,extract}-test.zip`（pytest 测试运行写回 fixtures） | 确认是否随本次 release commit 一起提交（static 需提交以含新前端；zip fixtures 建议 `git checkout` 还原，避免噪声入库） |

**PROD 隔离**：全程未触碰 `:8080` 生产服务、`~/.peekview/` 生产数据库、pipx 安装。生产库 mtime 未变（P7 §6 已核）。

## 发布后回归提示（主 Agent）

- `make debug-quick` 后访问 `:8888` 的 `unicode-filenames` entry 复核中文/日文图片预览（P6 已 8/8 PASS，此处仅发布前快速抽验可选）。
- BDD-8（markdown 内联 5 图）走 `/content` 不受影响，无需额外验证。

## Lessons Learned

1. **流程**：P2-design.md 中 gate_commands 的 e2e spec 文件名与最终实现前缀不一致（`t091-` vs `tpv0091-`），虽在 P3/P4/P5 链路内闭环，但 P2 文档保持陈旧——建议 P2 阶段就强制统一命名前缀（TPV 前缀），避免 P7 为「文档陈旧」打非阻塞偏差。
2. **架构**：download 与 preview 语义分离（读 ≠ 下载）通过端点点位变更（`/content`）一次解决，且与 read tracking 口径对齐（`download`→`read`）——「预览」这类语义边界问题应定位到语义正确的端点上，而非在 download 端点上叠加兼容逻辑。
3. **测试**：ASCII 分支字节级零回归是通过「ASCII 名保持现格式 header 不动」的设计保证 + 现有 test_api.py / test_security.py 无需改动即保持绿来验证的——纯增量改动（新增 helper + 一行 URL）比修改既有逻辑的回归面小得多，发布风险可压低到 patch 级别。

## 结论

- bump_type: **patch**
- debt_check: **none**
- 版本确认：peekview 0.18.4 → 0.18.5（mcp_server 0.10.0 不动）
- CHANGELOG：Unreleased 区已含 TPV0091 条目（未改版本号，由主 Agent bump 处理）
- 发布检查：backend 全量 pytest 1072 passed / frontend typecheck + lint 全绿
- **未执行** bump-version / git commit / git tag / make publish（主 Agent gate 后亲自执行）
- [PROD_NOT_TOUCHED]
