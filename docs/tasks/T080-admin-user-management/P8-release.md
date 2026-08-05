---
phase: P8
task_id: T080-admin-user-management
trace_id: T080
type: release
parent: P7-consistency.md
status: draft
agent: releaser
created: 2026-08-06
---

# P8 — 发布准备

## bump_type: minor

**理由**：新增用户可见功能（admin 用户管理 Web UI + disable/enable/promote/demote API + 审计字段 + CLI disable/enable），非破坏性新增能力。`delete_self` 移除 `confirm_username` 旁路统一为 bug 修复语义（最后一个活跃 admin 绝对不可自删，与 disable/demote 语义一致），按 semver minor。

## 版本变更

| package | 当前版本 | 目标版本 | bump |
|---------|---------|---------|------|
| backend/peekview | 0.16.0 | 0.17.0 | minor |
| frontend-v3 | 0.16.0（随 VERSIONS.json） | 0.17.0 | minor |
| packages/mcp-server | 0.10.0 | 0.10.0（不变） | — |

**MCP 不变**：P2 明确声明不暴露 admin 能力，`packages/mcp-server/` 在 T080 期间零改动（`git diff --stat v0.16.0..HEAD -- packages/mcp-server/` 空）。

**版本源**：`VERSIONS.json` 当前 `{"peekview": "0.16.0", "mcp_server": "0.10.0"}`，`make bump-version NEW_VERSION=0.17.0` 通过 `scripts/sync_versions.py` 同步到所有文件（backend `__init__.py`、pyproject.toml、frontend package.json、vite 注入、CLI 等）。

**命令**（主 Agent 执行）：
```bash
make bump-version NEW_VERSION=0.17.0
```

## CHANGELOG 确认

`CHANGELOG.md` 的 `[Unreleased]` 区域已包含 T080 全部变更条目（P4 阶段写入，P7 一致性检查已核对）。主 Agent bump-version 后需将 `[Unreleased]` 标题改为 `[0.17.0] - 2026-08-06` 并在其上方重建空 `[Unreleased]`。

### 当前 [Unreleased] 条目（已核对）

**新增（Added）**：
- Admin 用户管理页面（/admin）：用户列表 + 分页 + 状态 badge + OverflowMenu 操作菜单（禁用/启用/promote/demote/重置密码/删除）
- 后端 disable/enable/promote/demote API 端点（POST /api/v1/admin/users/{id}/{action}）
- 用户禁用审计字段：disabled_at/disabled_by/disabled_reason + migration
- LastAdmin 保护：最后一个活跃 admin 不可被 disable/demote/delete（API 层）
- CLI user disable/enable 子命令
- CLI user demote 补 LastAdmin 保护
- PasswordResetDialog 组件：密码输入 + show/hide + ≥8 字符校验 + alertdialog role
- 路由守卫：/admin meta.requiresAdmin，非 admin 跳 /explore，未登录跳 /
- Toast aria-live 按 variant 动态：error=assertive，其他=polite
- BaseBadge 新增 disabled/admin variant

**变更（Changed）**：
- **破坏性**：DELETE /api/v1/auth/me 移除 confirm_username 旁路——最后一个活跃 admin 绝对不可自删，即使提供 confirm_username 也返回 409
- admin 计数修正：从 COUNT(is_admin=True) 改为 COUNT(is_admin=True AND is_active=True)
- GET /api/v1/admin/users 返回结构从 list[UserResponse] 改为 UserListResponse {items, total, page, per_page}

**修复（Fixed）**——当前 CHANGELOG 未单列 "修复" 节，以下修复已隐含在上述条目中：
- LastAdmin 保护补齐 demote/disable/delete 三者统一（隐含在 "新增 LastAdmin 保护" 条目）
- CLI demote LastAdmin 保护（隐含在 "新增 CLI user demote 补 LastAdmin 保护" 条目）
- `_check_last_active_admin` 增加 `is_active=True` 条件（隐含在 "变更 admin 计数修正" 条目）
- `delete_user` 清理 `disabled_by` FK（P4 重试 #2 CRITICAL 修复，P7 §3 确认 `admin_service.py:468` grep OK）

> 建议：主 Agent 在 bump 时可考虑将 "修复" 项从 "新增/变更" 中拆出独立 "### 修复" 节，提升可读性。当前组织方式准确但偏紧凑。非阻断。

### git log 对照（v0.16.0..HEAD）

```
c59050aa wf(T080-P7): 一致性检查通过，4/4 DESIGN_GAP REVIEWED，BLOCKER=0
5ad86a19 wf(T080-P6): 验收通过 24/24 BDD PASS + vision 证据
dc1e429e wf(T080-P5): 技术验证通过，E2E 27/27 passed
fd2cf289 wf(T080-P4): 实现 admin 用户管理三端，4 DESIGN_GAP + 3 BLOCKER 修复，review approved
163e4c21 wf(T080-P3): TDD 测试设计，24 BDD 1:1 映射，21 红灯确认
85caafe0 wf(T080-P2): 方案设计，候选 A 独立端点 + PasswordResetDialog，review approved
6f54f2b5 wf(T080-P1): 需求基线建立，24 BDD + 8 CONFIRMED 决策，review approved
```

7 个 commit 全部 wf(T080-*) 工作流 commit，无遗漏、无无关 commit。CHANGELOG 条目与 commit 范围一致。

## 发布检查命令（主 Agent gate 执行）

```bash
# P2 packages 发布检查
make test-quick                    # 后端 pytest（venv）
make test-frontend                 # 前端 vitest
make typecheck                     # vue-tsc --noEmit（CI 强制）
make lint                          # ruff（系统 python3）

# bump 后重跑 P5 gate
make test-quick && make test-frontend && make typecheck

# 版本一致性
python3 scripts/sync_versions.py --check
```

## 临时资源清单（releaser → 主 Agent 交接）

| 资源 | 状态 | 清理动作 |
|------|------|---------|
| debug backend :8888 | **仍在运行**（PID 198514，`uvicorn peekview.main:get_app --port 8888`） | 主 Agent 执行 `make debug-stop` 停止 |
| /tmp/peekview-debug/ | **存在**（peekview.db + WAL） | `make debug-stop` 会清理；或手动 `rm -rf /tmp/peekview-debug/` |
| /tmp/p6-bdd14.ts | 存在 | `rm /tmp/p6-bdd14.ts` |
| /tmp/p6-screenshots.ts | 存在 | `rm /tmp/p6-screenshots.ts` |
| /tmp/p6-screenshots2.ts | 存在 | `rm /tmp/p6-screenshots2.ts` |
| 开发安装 | 无（用 backend/.venv，无 break-system-packages） | 无需清理 |
| pipx 生产服务 :8080 | 用户既有，非本任务启动 | **不触碰** |
| MCP server (PID 13186) | 用户既有，非本任务启动 | **不触碰** |

**注意**：dispatch-context 声称 debug backend "已 make debug-stop"，但 releaser 实测 `ps aux` 显示 :8888 仍在运行（PID 198514，启动时间 06:23）。主 Agent 需执行 `make debug-stop` 确认停止后 再 tag。

## [PROD_NOT_TOUCHED]

- 本任务全程使用 debug backend :8888（`/tmp/peekview-debug/` 隔离数据目录）
- 未执行任何触碰 `~/.peekview/` 的操作
- 未执行任何 `pip3 install --break-system-packages` 操作
- 未用 CLI `peekview create` 创建测试 entry（走 debug backend HTTP API）
- 未直接操作生产数据库 `~/.peekview/peekview.db`
- 生产服务 :8080（pipx）和 MCP server 为用户既有进程，未触碰

## releaser 不执行的动作

- `make bump-version NEW_VERSION=0.17.0` — 主 Agent gate 通过后执行
- `git add` / `git commit` — 主 Agent 执行
- `git tag v0.17.0` — 主 Agent 执行
- `git push` — 主 Agent 执行
- `make debug-stop` — 主 Agent READY 收尾执行（见临时资源清单）
