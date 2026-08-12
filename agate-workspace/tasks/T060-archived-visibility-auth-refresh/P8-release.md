---
phase: P8
task_id: T060-archived-visibility-auth-refresh
type: release
parent: P7-consistency.md
trace_id: T060-P8-20260721
status: draft
created: 2026-07-21
agent: implementer
---

# P8 Release: Archived 条目可见性策略 + 登录退出内容刷新

## Bump Type

```
bump_type: patch
```

**判定理由**：非破坏性变更，向后兼容。后端是 bug fix（默认查询排除 archived 条目），前端是体验优化（auth 转换刷新），MCP 是可选参数扩展（向后兼容）。按 semver：bug fix → patch。前端和 MCP 的功能增强属于内部优化和可选参数，不影响现有 API 契约。

## 版本号变更确认

| 包 | 当前版本 | 新版本 | 理由 |
|----|---------|--------|------|
| `peekview` | `0.9.3` | `0.9.4` | patch: backend bug fix + frontend UX enhancement |
| `mcp_server` | `0.9.2` | `0.9.3` | patch: optional `status` parameter (backward compatible) |

版本源文件：`VERSIONS.json`
版本同步脚本：`scripts/sync_versions.py`（`make bump-version` / `make bump-mcp-version` 时自动同步到各文件）

## CHANGELOG 更新确认

`CHANGELOG.md` 的 `[Unreleased]` 区域已有 T060 条目（3 条）：

```markdown
### 修复

- 归档条目可见性策略修正：All/Mine tab 默认排除 archived 条目，仅 Archived tab 可见归档条目 (T060)
- 登录/退出/Auth 过期后列表自动刷新，权限状态与列表内容保持一致 (T060)
- MCP `list_entries` 增加 `status` 参数支持，非法值返回 422 (T060)
```

### 需主 Agent 执行的 CHANGELOG 操作

1. peekview: 将 `[Unreleased]` → `[0.9.4]`，添加日期 `2026-07-21`
2. mcp_server: 在 `[mcp-v0.9.3]` 下新增 MCP 相关条目（如不存在则创建该节），补充日期

## 发布检查命令（从 P2-design.md §4 gate_commands）

| 包 | 命令 | 用途 |
|----|------|------|
| backend | `cd backend && .venv/bin/python -m pytest tests/ -q --tb=no` | P5 回归测试 |
| frontend | `cd frontend-v3 && npx playwright test e2e/ --reporter=line` | E2E 测试 |
| frontend | `cd frontend-v3 && npx vue-tsc --noEmit` | 类型检查 |
| MCP | `cd packages/mcp-server && npm test` | MCP 单元测试 |

## 上游阶段状态

| 阶段 | 状态 | 备注 |
|------|------|------|
| P5 | ✅ 全绿 | backend 13/13 + frontend 15/15 + MCP 11/11 |
| P6 | ✅ 19/19 BDD PASS | 1 MINOR issue: header says 18 (见 P7-consistency.md §7) |
| P7 | ✅ PASS | 0 BLOCKER, 0 DESIGN_GAP, 1 MINOR (P6 header BDD count) |

## Lessons Learned

1. **多包版本独立管理**：peekview 和 mcp_server 版本号独立，`make bump-version` 和 `make bump-mcp-version` 分开执行。P8 需确保两个版本号都更新。
2. **semver 判定边界**：可选参数扩展（MCP `status` 参数）在严格 semver 下是 minor bump，但向后兼容且不影响现有调用者可视为 patch。本次选择 patch 兼顾务实。
3. **CHANGELOG 双路径**：主包和 MCP 包在同一个 CHANGELOG.md 中分段管理（`[x.y.z]` vs `[mcp-vx.y.z]`），P8 需确认两段都更新。

## 临时资源清单

| 类型 | 详情 | 清理方式 |
|------|------|----------|
| 调试服务 | `make debug` 启动的 backend (127.0.0.1:8888) | `make debug-stop` |
| 调试数据 | `/tmp/peekview-debug/peekview.db` | `make debug-stop` 自动清理 |
| 调试目录 | `/tmp/peekview-debug/` | `make debug-stop` 自动清理 |

> **注意**：以上临时资源清单基于 T060 任务执行期间可能启动的 debug 环境。主 Agent 执行 READY 收尾时按此清单逐项检查清理。
>
> **未涉及**：生产服务 (:8080) 未被触碰；生产数据库 (`~/.peekview/peekview.db`) 未被触碰；pipx 正式安装未受影响。
