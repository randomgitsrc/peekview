# PeekView 管理能力补全计划

> 创建：2026-06-13
> 来源：思考会话讨论
> 当前版本：Backend v0.1.55 / MCP Server v0.8.4
> 状态：待实施

---

## 背景

PeekView 当前的管理能力存在两方面的不足：

1. **已有功能有 bug** — 管理员权限在部分端点未生效
2. **CLI 管理命令不完整** — 用户管理缺删除/重置密码，系统运维缺统计/清理，API Key 管理不支持本地模式

本计划汇总所有待修复和待新增的管理能力需求，供实施 Agent 按优先级执行。

---

## 问题清单

### BUG-1: 文件下载端点管理员权限缺失

| 项目 | 说明 |
|------|------|
| **问题** | `api/files.py` 的文件下载/内容端点（约 line 77, line 118）只检查 `entry.owner_id != current_user_id`，没有传递 `is_admin` 参数，管理员访问他人私有 entry 的文件会返回 404 |
| **根因** | 文件端点未像 entry 端点那样传递 `is_admin` 参数到 service 层 |
| **影响域** | 后端（`api/files.py` + `services/file_service.py`） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🔴 高 — 管理员权限静默失效，属于安全缺陷 |
| **验证方法** | 以管理员身份请求他人私有 entry 的文件下载，应返回 200 而非 404 |

---

### FEAT-1: `peekview admin stats` 系统统计命令

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview admin stats`，输出系统统计：用户数、entry 数（公开/私有/总数）、磁盘占用、DB 文件大小 |
| **理由** | Agent 和人类管理员都需要快速了解系统状态；目前只能看 `/health` 端点的有限信息 |
| **影响域** | 后端（新增 `GET /api/v1/admin/stats` 端点）+ CLI（新增 `admin stats` 命令） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🟠 近期 |
| **API 端点** | `GET /api/v1/admin/stats`，需 `require_auth` + `is_admin` 检查 |
| **返回示例** | `{"users": 3, "entries": {"total": 42, "public": 30, "private": 12}, "storage": {"data_dir_mb": 128.5, "db_mb": 3.2}}` |
| **CLI 输出** | Rich 表格格式，支持 `--json-output` |

---

### FEAT-2: `peekview user delete` 用户删除命令

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview user delete <username>`，删除用户 |
| **理由** | 用户管理目前只能 create/promote/demote，无法删除，管理闭环缺失 |
| **影响域** | 后端（新增 `DELETE /api/v1/admin/users/{id}` 端点）+ CLI（新增 `user delete` 命令） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🟠 近期 |
| **设计决策** | 被删用户的 entry 有三种处理方式，需在实现前确定： |
| | A. **级联删除** — 用户删除时，其所有 entry 一并删除（简单，但可能丢数据） |
| | B. **转移给 admin** — entry 的 owner_id 改为执行删除操作的管理员（保留数据） |
| | C. **保留为 owner_id=NULL** — entry 变为匿名 entry，仅管理员可管理（保留数据，但 entry 失去归属） |
| | **推荐方案 B**：转移给 admin，数据不丢，归属清晰 |
| **安全** | 仅管理员可执行；不能删除自己；需确认提示 |

---

### FEAT-3: `peekview user password-reset` 密码重置命令

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview user password-reset <username>`，管理员重置用户密码 |
| **理由** | 用户忘记密码时，管理员目前只能删库重建，缺少重置机制 |
| **影响域** | 后端（新增 `POST /api/v1/admin/users/{id}/reset-password` 端点）+ CLI（新增 `user password-reset` 命令） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🟡 中期 |
| **安全** | 仅管理员可执行；`--password` 参数或交互式输入；API 端点需 `require_auth` + `is_admin` |

---

### FEAT-4: `peekview apikey` 本地模式支持

| 项目 | 说明 |
|------|------|
| **需求** | 让 `peekview apikey create/list/revoke/cleanup` 命令在本地模式下也能工作（直接操作本地 SQLite DB） |
| **理由** | 当前 apikey 命令只支持远程模式（需 HTTP API），本地部署用户无法管理 API Key |
| **影响域** | CLI（改造 `apikey` 组命令，本地模式直接操作 DB） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🟡 中期 |
| **实现** | 参照 `user create/list/promote/demote` 的本地模式实现方式，直接用 `apikey_service` 操作本地 DB |
| **注意** | API Key 的 key 生成逻辑（`pv_` 前缀 + 随机部分 + HMAC-SHA256 hash 存储）需在 CLI 中复用 |

---

### FEAT-5: `peekview admin cleanup` 手动清理命令

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview admin cleanup`，手动触发过期 entry 清理 |
| **理由** | 目前清理只靠后台定时器（`cleanup.interval_seconds`），有时想手动触发（如调试、磁盘紧急释放） |
| **影响域** | 后端（新增 `POST /api/v1/admin/cleanup` 端点，复用已有 cleanup service）+ CLI（新增 `admin cleanup` 命令） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🟡 中期 |
| **输出** | 显示清理了多少个过期 entry，释放了多少磁盘空间 |

---

### FEAT-6: `peekview admin disk-usage` 磁盘占用详情

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview admin disk-usage`，按 entry 统计磁盘占用 |
| **理由** | `admin stats` 给总览，`disk-usage` 给明细，排查磁盘问题时更精准 |
| **影响域** | 后端（新增 `GET /api/v1/admin/disk-usage` 端点）+ CLI（新增 `admin disk-usage` 命令） |
| **发布包** | peekview (PyPI) patch |
| **优先级** | 🔵 长期 |
| **输出** | 按 entry 列出文件总大小，支持排序（`--sort size`/`--sort date`）和 `--top N` 限制 |

---

### FEAT-7: `peekview entry update` 更新已有 entry

| 项目 | 说明 |
|------|------|
| **需求** | 新增 CLI 命令 `peekview entry update <slug>`，修改已有 entry 的 summary/tags/visibility |
| **理由** | 目前只能 create 和 delete entry，不能修改元数据 |
| **影响域** | 后端（新增 `PATCH /api/v1/entries/{slug}` 端点）+ CLI（新增 `entry update` 命令）+ 可选：前端（编辑 UI）+ 可选：MCP（`update_entry` tool） |
| **发布包** | peekview (PyPI) patch；若加 MCP tool 则还需 @peekview/mcp-server (npm) minor bump |
| **优先级** | 🔵 长期 |
| **选项** | `--summary` / `--tag` / `--visibility` / `--add-tag` / `--remove-tag` |
| **权限** | entry owner 或管理员可修改 |

---

### IMPL-1: 新增 `require_admin` FastAPI 依赖

| 项目 | 说明 |
|------|------|
| **需求** | 新增 FastAPI 依赖函数 `require_admin`，类似现有的 `require_auth`，用于保护管理员专属端点 |
| **理由** | 当前 admin 检查散落在各 service 方法中手动传 `is_admin`，容易遗漏（BUG-1 就是遗漏的结果）。统一依赖可防止此类问题 |
| **影响域** | 后端（`auth.py` 新增依赖 + 各 admin 端点引用） |
| **发布包** | 随其他 FEAT 一同发布 |
| **优先级** | 🟠 近期 — 建议在修复 BUG-1 时一并实现，防止未来再遗漏 |
| **实现** | `require_admin = Depends(require_auth)` + 检查 `user.is_admin`，否则 raise ForbiddenError |

---

## 实施批次建议

### 批次 1（🔴 紧急 + 🟠 近期，纯 peekview PyPI 包）

| 编号 | 内容 | 依赖 |
|------|------|------|
| BUG-1 | 修复文件下载 admin 404 | 无 |
| IMPL-1 | 新增 `require_admin` 依赖 | 无，建议与 BUG-1 同步 |
| FEAT-1 | `admin stats` 命令 | IMPL-1（使用 `require_admin` 守卫） |
| FEAT-2 | `user delete` 命令 | IMPL-1；需先确定 entry 归属处理方案（推荐方案 B：转移给 admin） |

### 批次 2（🟡 中期，纯 peekview PyPI 包）

| 编号 | 内容 | 依赖 |
|------|------|------|
| FEAT-3 | `user password-reset` 命令 | IMPL-1 |
| FEAT-4 | `apikey` 本地模式支持 | 无后端改动 |
| FEAT-5 | `admin cleanup` 命令 | IMPL-1 |

### 批次 3（🔵 长期，可能跨包）

| 编号 | 内容 | 依赖 |
|------|------|------|
| FEAT-6 | `admin disk-usage` 命令 | IMPL-1 |
| FEAT-7 | `entry update` 命令 + 可选 MCP tool | 后端端点必须；前端/MCP 可后续追加 |

---

## 不在本计划范围内

| 事项 | 说明 |
|------|------|
| Web 管理面板 | 需求不明确 + 离线约束限制 UI 库选择 + 工作量大，待真实用户需求驱动 |
| 前端改动 | 本计划所有功能均通过 CLI + API 实现，不涉及前端 |
| MCP Server 改动 | 批次 1-2 不涉及；批次 3 的 FEAT-7 可选追加 MCP tool |

---

## 验收标准

- BUG-1：管理员可下载他人私有 entry 的文件，返回 200
- IMPL-1：所有新增 admin 端点使用 `require_admin` 依赖
- FEAT-1~7：每个命令有对应的 CLI 命令 + 后端 API 端点 + 测试覆盖
- 所有新端点需在 `peekview api endpoints` 中可见
