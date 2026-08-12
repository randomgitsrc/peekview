---
phase: P8
task_id: T078-read-tracking-hardening
type: release
parent: P7-consistency.md
trace_id: T078-P8-20260803
status: draft
created: 2026-08-03
agent: releaser
---

# P8 发布准备 — T078 read-tracking-hardening

## 1. bump 判定

```yaml
bump_type: minor
current_version: "0.14.2"
target_version: "0.15.0"
package: peekview (backend pip 包)
```

**判定理由**：本任务新增功能——聚合表（`entry_read_stats`）+ `by_action`/`by_source` 新维度 + 来源分类（source 列 + `_classify_source`）+ 90 天自动清理 + admin stats reads 维度 + 启动回填 + restore merge 导入聚合表。属于向后兼容的功能增强，符合 semver minor 标准。

P2 packages 声明：单一 backend 包，无 MCP/frontend 改动。

## 2. 版本号变更确认

| 项目 | 旧版本 | 新版本 | 状态 |
|------|--------|--------|------|
| peekview (VERSIONS.json) | 0.14.2 | 0.15.0 | 待主 Agent 执行 `make bump-version NEW_VERSION=0.15.0` |
| mcp_server | 0.10.0 | 0.10.0（不变） | 本任务无 MCP 改动 |

> **注意**：P8 releaser 不执行 `bump-version` / `git commit` / `git tag`。主 Agent 在 gate 验证通过后亲自执行。

## 3. CHANGELOG 更新

CHANGELOG.md 已更新，在 `[0.14.2]` 之前新增 `[0.15.0] - 2026-08-04` 区域，含以下条目：

### 新增（7 条）
- 读取统计聚合表（`entry_read_stats`）
- `ReadStatsResponse` 新增 `by_action`/`by_source`
- 来源分类（source）+ `entry_reads.source` 列
- 90 天自动清理 + `PEEKVIEW_CLEANUP__READS_RETENTION_DAYS`
- Admin stats `reads` 维度
- 启动时一次性回填
- Restore merge 导入聚合表行

### 修复（5 条）
- window_key 加入 action 维度
- 公开 entry share channel 修正
- files.py 三处 channel 统一 `_detect_channel`
- `_detect_channel` 提取到 `_shared.py`
- 测试名修正

### 变更（2 条）
- `get_read_stats()` 改读聚合表
- 删 entry 保留聚合统计行

## 4. 发布检查命令

P2 声明的 gate_commands：

```bash
# P5 gate（主 Agent 重跑确认）
cd backend && .venv/bin/python -m pytest tests/ -q --tb=no
# 预期：1042 passed, 0 failed

# lint（CI 强制）
cd backend && python3 -m ruff check peekview/ tests/
```

## 5. 受影响文件清单（P2 packages → P4 实际改动）

| 文件 | 改动类型 |
|------|----------|
| `backend/peekview/models.py` | 新增 EntryReadStats/ReadsStats model；扩展 ReadStatsResponse/AdminStatsResponse/RestorePreview/RestoreResult |
| `backend/peekview/config.py` | PeekCleanup 加 reads_retention_days |
| `backend/peekview/services/read_tracking_service.py` | window_key 加 action；record_read 写时更新聚合表；get_read_stats 改读聚合表；新增 backfill_stats |
| `backend/peekview/api/_shared.py` | _detect_channel 提取；_classify_source 新增；_record_read_async 加 source |
| `backend/peekview/api/entries.py` | channel 修复；_detect_channel 改导入；_record_read_async 加 request |
| `backend/peekview/api/files.py` | 三处 channel 统一 _detect_channel；_record_read_async 加 request |
| `backend/peekview/database.py` | _run_migrations 加 source 列迁移 |
| `backend/peekview/main.py` | create_app 中调用 backfill_stats |
| `backend/peekview/services/admin_service.py` | get_stats 加 reads 维度；cleanup_expired 加 90 天清理；_restore_merge 导入聚合表 |
| `backend/tests/test_read_tracking_hardening.py` | 新建：34 个 BDD 测试 |

## 6. [PROD_NOT_TOUCHED]

本任务全阶段（P0-P8）未触碰生产环境：
- 未访问 `~/.peekview/peekview.db`
- 未操作 `:8080` 生产服务
- 所有测试使用 conftest.py autouse 隔离（tmp_path）或 debug backend（`/tmp/peekview-debug/`）
- 未执行 `pip3 install --break-system-packages`

## 7. 临时资源清单

供主 Agent READY 收尾检查参考：

### 临时服务/进程
- 无。P8 阶段未启动任何临时服务（P5/P6 的 debug backend 已在各自阶段结束后由主 Agent 清理）

### 临时数据
- `/tmp/peekview-debug/` — P5/P6 阶段 debug backend 数据目录（如未被早期清理，主 Agent 确认 `make debug-stop` 已执行）
- pytest 临时数据 — conftest.py autouse 隔离自动清理（tmp_path fixture）

### 开发安装
- 无新增开发安装。P4 使用已有 `backend/.venv`（`make dev` 管理），未做 editable install

## 8. SCOPE_GAP 检查

P2 packages 声明：`backend # 单一包（peekview pip 包），无 MCP/frontend 改动`

P8 dispatch-context 要求：处理 backend 包 bump + CHANGELOG。

**结论**：无 SCOPE_GAP。P2 声明的单一 backend 包已在本次 P8 处理。MCP/frontend 无改动，无需 bump。

## 9. DESIGN_GAP 检查

P7 一致性检查（C6.2）发现一处偏差并已标记 `[DESIGN_GAP_REVIEWED]`：
- P2§3.8 model default "direct" → P4 实际实现 None。不影响运行时（source 始终由 _classify_source 显式传入）。

**结论**：所有 DESIGN_GAP 已在 P7 配对 REVIEWED，无遗留。

## 10. Lessons Learned

1. **[架构] 聚合表写时更新优于触发器**：SQLite 触发器无法可靠处理 JSON 字典更新和字符串 `in` 检查，Python 层写时更新更可控且与项目现有模式一致（P2 方案选择）
2. **[测试] 测试名必须与断言语义一致**：`test_..._excludes_self_reads` 断言含 self_read 是隐蔽的语义误导，P1 需求基线应显式声明 total_count 语义边界
3. **[流程] 探针准确性修复必须先于聚合表建设**：先修 window_key/channel 错误再加聚合表，否则聚合的是错误数据（P0 brief 更新的核心洞察）

## 11. 主 Agent 待执行步骤

1. **gate 验证**：
   - `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` → 1042 passed, 0 failed
   - `cd backend && python3 -m ruff check peekview/ tests/` → 0 errors
   - `git log v0.14.2..HEAD --oneline` 对照 CHANGELOG `[0.15.0]` 无遗漏
2. **bump-version**：`make bump-version NEW_VERSION=0.15.0`
3. **CHANGELOG 日期确认**：bump 后检查 `[0.15.0]` 日期为 `2026-08-04`
4. **commit + tag**：`git add -A && git commit && git tag v0.15.0`
5. **READY 收尾检查**：按 §7 临时资源清单逐项确认清理

---

bump_type: minor
version_change: 0.14.2 -> 0.15.0
changelog_updated: true
prod_not_touched: true
