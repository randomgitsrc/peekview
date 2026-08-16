---
phase: P8
task_id: TPV0093-star-lifecycle
type: release
parent: P7-consistency.md
trace_id: TPV0093-P8-20260816
status: draft
created: 2026-08-16
agent: implementer
# ── v2.0 机器字段 ──
bump_type: minor
debt_check: reviewed
---

# P8 发布准备 — TPV0093 星标功能与内容生命周期管理

> 状态标记：`[PROD_NOT_TOUCHED]`（只读 + 产出文件，未执行 git commit/tag/bump-version，未触碰 :8080 / ~/.peekview/）
> 本文件为 releaser→主 Agent 交接记录，**所有版本变更动作（bump-version + CHANGELOG + commit + tag）由主 Agent gate 通过后亲自执行**。

## 发布判定

- **bump_type**: `minor`
- **受影响包**: `peekview`（PyPI `peekview`，VERSIONS.json 唯一版本源）。期望版本变更 **0.20.0 → 0.21.0**
- **MCP 包** `@peekview/mcp-server`（VERSIONS.json `mcp_server: 0.11.0`）**不 bump**（本任务对 packages/mcp-server 零代码改动，P2 §2.2「不改什么：MCP（packages/mcp-server）」）
- **判定理由**：新增用户可见功能（星标/豁免删除/墓碑/Starred tab/管理页）+ 新增 API 端点（POST/DELETE /{slug}/star、GET/DELETE /api/v1/stars、list `starred` 参数）+ 数据库 schema 变更（新表 entry_stars/entry_tombstones + entries.archive_delete_at 列）。全部为向后兼容增量（响应字段增量 C1），非破坏性变更 → **minor**

## packages 声明（P2 frontmatter + §2.1）

| P2 声明 | 发布层面 | 是否随版本发布 |
|---------|----------|----------------|
| `backend/peekview` | models/database/entry_service/admin_service/star_service/API/main | ✓ 发布产物（pip 包） |
| `frontend-v3` | 前端产物打进 backend static（`make build-frontend`） | ✓ 随 pip 包发布 |
| `packages/mcp-server` | 零改动（P2 §2.2 明确不碰） | ✗ 不 bump（保持 mcp_server 0.11.0） |

> [SCOPE_GAP] 检查：P2 packages 含 backend + frontend 两包；MCP 按 P1 M2/M3 无代码改动、不参与 bump（P7 §3.1 预期声明一致）。无遗漏。

## 版本变更确认

- 当前 `VERSIONS.json`：`peekview: 0.20.0`，`mcp_server: 0.11.0`（已确认 `backend/pyproject.toml` / `backend/peekview/__init__.py` 均 0.20.0，与 VERSIONS.json 一致）
- **期望变更**：`peekview` 0.20.0 → **0.21.0**（主 Agent 执行 `make bump-version NEW_VERSION=0.21.0`）
- `mcp_server` 0.11.0 **保持不变**（本任务不触碰 MCP）
- **注意**：`make bump-version` 会同步 `scripts/sync_versions.py` 到所有文件（含 `backend/peekview/__init__.py`、`pyproject.toml`、frontend 等），版本源为 VERSIONS.json

## 未发布变更范围（对照 `git log v0.20.0..HEAD`）

- TPV0093 P1-P7（8 commit）：星标/豁免/墓碑/权限/Starred tab/管理页/迁移（本版本主体）
- TPV0092 后置 docs（4 commit）：AGENTS.md 多实例基础设施沉淀（a495e1fc）、debug-extra 保护（d3dfcc6d）、TPV0092 复盘（2bc20edd）、MCP 三 README 重写（8b235cf0/e0f866f9）——纯文档，无代码影响，随 0.21.0 一并发布
- 发布检查对照命令：`git log v0.20.0..HEAD --oneline`（16 commit，均已映射）

## CHANGELOG 更新确认

当前 `CHANGELOG.md` 的 `[Unreleased]` 区域为**空**（模板状态）。bump 后主 Agent 需：

1. 在 `[Unreleased]` 下新增 TPV0093 条目，建议内容（新增 + 修复 + 已知限制）：

```markdown
## [Unreleased]

### 新增

- 星标功能：登录用户可对 entry 星标/取消星标（`POST/DELETE /api/v1/entries/{slug}/star`），同用户只计 1 次（部分唯一索引防刷量 + IntegrityError 幂等），公开实时 star_count；archived 条目星标后暂停归档删除倒计时（`archive_delete_at` 绝对到期点，暂停=清理跳过、恢复=零重算零漂移）(TPV0093)
- 星标豁免删除：归档删除判定增加星标豁免（NOT EXISTS 活星标）——只要 ≥1 用户星标，系统绝不自动删除；取消星标恢复剩余倒计时（剩余>0 缓冲期、≤0 下个清理周期删除）(TPV0093)
- 作者删除优先 + 墓碑：作者删除强制覆盖星标豁免，同一事务生成 `EntryTombstone`（entry_slug/title/deleted_by/deleted_at/reason=author_deleted）并原子绑定星标；墓碑保留至最后一条引用星标移除（unstar/批量移除/delete_user 后孤儿清扫）(TPV0093)
- 星标用户可读 archived 全文：archived 判定由「状态+星标」组成，详情/raw/文件/download/短链全部同源继承；非星标用户对 archived 仍 404（防 slug 枚举）；share 独立授权通道不受影响 (TPV0093)
- 新 API：`GET /api/v1/stars`（我的星标，活 entry + 墓碑卡片，filter=all/active/expiring/expired）、`DELETE /api/v1/stars`（批量移除）、`GET /api/v1/entries?starred=true`（Starred 列表，active+archived 均含）(TPV0093)
- 前端：详情页星标按钮（桌面 header + 移动端底部栏双落点，乐观更新 + 失败回滚 + 重复星标 Toast 跳转 + 归档 Toast 双文案）；Explore 新增 Starred tab（登录可见，与 owner/status 互斥）；独立星标管理页 `/stars`（分类 tab / 红色倒计时 / 墓碑卡片 / 批量移除 + 二次确认 / 三态）；作者 Archived 豁免标签（「因被 N 位用户星标，已暂停自动删除」+ ❓说明）+ 强制删除二次确认（明示 N）(TPV0093)
- 存量数据迁移：`backfill_archive_delete_at` 数据幂等 backfill——存量 archived 从功能上线日起算倒计时（每次启动重跑幂等，仅 NULL 行命中），不触碰 `PRAGMA user_version`（FTS 独占）(TPV0093)
- a11y：星标按钮 `aria-pressed`/`aria-label`、墓碑「看原因」button、checkbox `aria-label`、红色倒计时语义色 token (TPV0093)

### 修复

- 修复 archived 私有条目 `is_public` 前置检查短路导致的星标用户读取 404（`get_entry` archived 分支短路重构，判定仅由「状态+星标」组成）(TPV0093)
- 修复 ownerless（owner_id=NULL）archived 条目匿名请求可读的既有漏洞（显式匿名守卫 404）；顺带收紧非 archived 私有 + 匿名（None==None 短路）可读漏洞 (TPV0093)

### 已知限制

- backup/restore merge 模式不导入 entry_stars/entry_tombstones 新表，merge-restore 恢复旧备份后星标与墓碑数据丢失（replace 模式整体换库不受影响）——已登记 DEBT0006 追踪 (TPV0093)
```

2. 将 `[Unreleased]` 移到 `[0.21.0] - 2026-08-16` 下
3. `git add CHANGELOG.md && git commit --amend --no-edit`（bump 后按 AGENTS.md 发布流程）

> P8 gate 要求「暂存区 CHANGELOG 有变更」——上述更新由主 Agent 执行后应入同一 commit。

## debt_check

`debt_check: reviewed`

核对记录：`agate-workspace/debt/tech-debt.md` 存在，含 3 条真实债务条目：

- **DEBT0006**（technical, open, medium）——**本任务关联**：backup/restore merge 模式不导入新表（P2 §13 [SCOPE+] → P1 已登记 → 主 Agent 裁定已知限制）。**不阻断发布**（replace 模式不受影响；merge-restore 属运维操作路径，非主功能验收范围），推荐后续任务关闭。
- DEBT0004（technical, open, low）——净化正则双实现（TPV0092 遗留），与本次发布无直接冲突，不阻断。
- DEBT0005（technical, open, medium）——前端移动端 FileTree e2e 3 例预存失败（TPV0092 登记），本次 star.spec.ts E2E 独立作用域，不受影响，不阻断。

结论：无阻断项，本次任务未新增未登记债务（[SCOPE+] 已闭环为 DEBT0006）。

## 发布检查命令（主 Agent gate 需亲自执行）

从 P2 §8 gate_commands 提取：

```bash
make test-quick                                              # P5 backend gate 重跑（bump 后确认全绿）
make test-frontend && make typecheck                         # P5 frontend gate 重跑
E2E_SPEC=e2e/star*.spec.ts make debug-test                   # P5_e2e（需先 make debug-start）
make lint                                                    # CI 强制
git log v0.20.0..HEAD --oneline                              # 对照 CHANGELOG 无遗漏
```

> 主 Agent 发布序列：`make bump-version NEW_VERSION=0.21.0` → 填 CHANGELOG（[Unreleased]→[0.21.0]）→ `git add CHANGELOG.md && git commit --amend --no-edit` → `make pre-publish-quick` → `make publish` → `git push && git push origin v0.21.0` → 人工 `pipx upgrade peekview && sudo systemctl restart peekview`（AGENTS.md 发布流程）

## 临时资源清单（releaser→主 Agent 交接，READY 收尾清理用）

| 资源 | 类型 | 状态 | 清理动作 |
|------|------|------|----------|
| debug backend :8888（uvicorn，PID 906295） | 进程 | **仍在运行** | `make debug-stop`（停止 + 清理 /tmp/peekview-debug/） |
| `/tmp/peekview-debug/`（peekview.db + data/，含 seed alice/bob/carol + 测试 entry） | 临时数据 | 存在 | `make debug-stop` 清理 |
| `/tmp/peekview-debug-8890.log` | 临时文件 | 存在 | 删除（历史 debug-extra 残留日志） |
| `/tmp/pv_minval_stars.py`（P2 最小验证脚本） | 临时脚本 | 存在 | 删除 |
| pytest tmp_path 隔离数据（conftest autouse） | 临时数据 | 测试自动清理 | 无（autouse fixture） |
| Chrome CDP :18800 | 外部常驻服务 | 不属于本任务启动 | **不清理**（注明：外部常驻，非本任务范围） |

> git 工作区现状：dirty 文件为 `agate-workspace/tasks/active-tasks.md` + `backend/peekview/static/index.html` + 3 个 zip 测试产物（既有非本任务变更，P6 环境已有）；未追踪仅 P8-dispatch-context。清理时以主 Agent 判定为准。

## Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 流程 | 发布判定以「P2 packages 声明」为准而非「git diff 文件数」——本任务 git diff 含 TPV0092 后置 MCP README docs，但 MCP 无代码改动、不 bump，避免误 bump | TPV0093 | 2026-08-16 |
| 安全 | archived 权限扩展单点收敛到 `get_entry`（archived 短路 is_public + 显式匿名守卫 + 非 archived 收紧）使所有读取路径（detail/raw/file/download/短链）同源继承，一处修改覆盖全部，防 slug 枚举边界清晰（非星标仍 404） | TPV0093 | 2026-08-16 |
| 数据 | 归档删除倒计时用「绝对到期点 `archive_delete_at`」而非「剩余秒数快照」——暂停=清理跳过、恢复=零重算，天然零漂移；迁移用数据幂等 backfill（仅 NULL 行命中）而非 `PRAGMA user_version`（FTS 独占），避免污染 FTS | TPV0093 | 2026-08-16 |
