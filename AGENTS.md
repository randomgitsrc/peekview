# PeekView

轻量级代码/文档格式化服务：Agent 通过 API/CLI/MCP 创建条目 → 浏览器查看格式化内容。

## 架构

| 组件 | 路径 | 栈 |
|------|------|----|
| Backend | `backend/peekview/` | FastAPI + SQLite (WAL+FTS5) |
| Frontend | `frontend-v3/` | Vue 3 + Vite + TypeScript + Shiki |
| MCP Server | `packages/mcp-server/` | Node.js/TS + Streamable HTTP |

```
backend/peekview/
├── main.py           # App factory, DI via app.state
├── models.py         # SQLModel Entry/File/User/ApiKey + Pydantic schemas
├── config.py         # Pydantic Settings (PEEKVIEW_* env vars)
├── database.py       # SQLite init, WAL, FTS5, migrations
├── auth.py           # JWT + bcrypt + API key verification
├── storage.py        # Filesystem operations (atomic writes)
├── cli.py            # Click CLI (serve/create/get/list/delete/user/login/apikey/admin)
├── api/              # Routes: entries, files, auth, apikeys, admin, captcha, config
└── services/         # Business logic: entry_service, file_service, apikey_service, admin_service

frontend-v3/src/
├── router.ts         # 路由（不是 src/router/index.ts）
├── views/            # EntryListView, EntryDetailView, ApiKeyListView
└── components/       # CodeViewer(Shiki), MarkdownViewer, MermaidDiagram, FileTree, LoginDialog, ...

packages/mcp-server/src/
├── server.ts         # MCP Server setup, Streamable HTTP transport
├── client.ts         # PeekView API client
├── tools/            # create_entry, publish_files, get/list/delete_entry
└── config/           # Env > file > default, merge logic
```

## 铁律（违反必出事）

1. **严禁** `uvicorn` 直接启动。用 `make debug`（`127.0.0.1:8888`，独立数据目录 `/tmp/peekview-debug/`）
2. **严禁** 停止/触碰用户的 pipx 正式服务（`:8080`）
3. **严禁** 跑会触碰真实 `~/.peekview/` 的测试；MCP/E2E 测试必须用临时 HOME 或 debug backend
4. **严禁** 开发/测试/发布流程中写生产数据库（`~/.peekview/peekview.db`）；测试必须用临时目录或 debug 模式
5. 前端路由：`src/router.ts`（不是 `src/router/index.ts`）
6. 发布流程必须先读 `docs/process/release.md` — 特别是 `bump-version` 后必须手动填 CHANGELOG 再 `--amend`
7. 改代码前先读周围上下文，理解代码风格和现有库选择
8. 不加注释（除非被要求）
9. 完成任务后必须跑 lint/typecheck

## 环境隔离机制（代码层面保障）

- **`PEEKVIEW_DEBUG_MODE=1`**：所有 `PeekConfig()` 无参调用自动隔离到 `/tmp/peekview-debug/`，captcha 自动禁用。pytest 通过 conftest fixture 自动设置。
- **pytest 全局隔离**：`conftest.py` 的 `isolate_config_file` fixture 自动设置 `PEEKVIEW_STORAGE__*` env vars，所有 `PeekConfig()` 无参调用在测试中自动指向 tmp_path。
- **生产数据库**：`~/.peekview/peekview.db`，**调试数据库**：`/tmp/peekview-debug/peekview.db`
- **发布 token**：PyPI 在 `~/.bash_env`，npm 在 `~/.npmrc`，`make publish` 自动读取，不需要手动 export

## 常用命令

```bash
make debug                # 构建+启动+E2E（完整调试流程）
make debug-start          # 仅启动调试服务
make debug-stop           # 停止调试服务

cd backend && make test   # 后端测试
cd backend && make lint   # 后端 lint (ruff check + format --check)
cd backend && make format # 后端自动修复 (ruff check --fix + format)

cd frontend-v3 && npm run build   # 前端构建（自动复制到 static/）
cd frontend-v3 && npm run test    # 前端单元测试

make test-mcp-unit        # MCP 单元测试
make build-mcp            # MCP 构建

make publish              # 发布到 PyPI（自动从 ~/.bash_env 读 token）
make publish-npm          # 发布 MCP Server 到 npm
```

## 技术要点

- **DI 模式**：`request.app.state.entry_service`（非模块级全局变量）
- **认证三层**：JWT httpOnly Cookie (`peekview_token`) + Bearer header + `pv_` API key。优先级：`Authorization` header > Cookie > API key
- **权限模型**：Anonymous→仅公开；Authenticated→公开+自己私有；Admin→全部可见。`get_current_user`(可选) / `require_auth`(必须) / `require_admin`(管理员)
- **配置**：`PEEKVIEW_*` 环境变量，`__` 分隔嵌套（如 `PEEKVIEW_STORAGE__DATA_DIR`）
- **CSP**：`script-src 'self' 'unsafe-eval'`（`unsafe-eval` 为 Mermaid/d3 的 `new Function()` 必需，不可移除）
- **DOMPurify**：清理 markdown 输出。Mermaid 源码不走 DOM（用 `Map` 传递）。含 `-->` 的属性会被 DOMPurify 删除
- **Rate limit**：captcha 端点用 `rate_limit_per_minute`，login/register 用 `rate_limit_login_per_minute`。`default_limits` 兜底其他 API 端点
- **MCP 版本独立**：由 `bump-mcp-version` 管理，主线 `bump-version` 不会碰。doc-sync 脚本已移除了 MCP package.json 同步条目
- **MCP 双模式**：`remote`（A→B→C，暴露 create_entry/get/list/delete）| `local`（A=B→C，暴露 publish_files/get/list/delete）
- **双包发布**：peekview (PyPI) + @peekview/mcp-server (npm)，版本独立管理
- **数据库**：SQLite WAL + FTS5，时间戳 naive UTC

## 安全要点

- local_path 必须 allowlist + symlink 先检查再 resolve（后端拒绝 symlink，MCP 用 realpath 跟随后检查）
- `pv_` API key：HMAC-SHA256 hash 存储，最多 10 个/用户
- Entry 私有访问对非 owner 返回 404（非 403），防止 slug 枚举
- Global API key 中间件跳过 auth 端点，数据端点受保护
- FTS5 查询净化仅转义引号，复杂语法错误被 try/except 静默吞掉返回空结果

## 发布注意事项

- **peekview 和 peekview-mcp 版本独立**：`bump-version` vs `bump-mcp-version`
- 发布完别忘了检查 CHANGELOG.md 是否正确

## 走 agate 工作流（非平凡任务）

**开始前必读 `docs/tasks/active-tasks.md`**，无进行中任务再启动新任务。

非平凡任务走 [agate](https://github.com/randomgitsrc/agate) 工作流（规则在 `~/.agate/`）。主 Agent 只做四件事：写P0-brief、派发 subagent、验 gate、更新状态。不亲自写代码或产出。

**阶段链 P0-P8（默认全走，裁剪须有理由）**：
- **P0** 主 Agent 亲自写 `P0-brief.md`：任务简报 + 环境约束（debug_env）+ 已知风险 + 裁剪倾向
- **P1** 需求基线：质疑需求、识别隐含依赖、BDD 验收条件（Given/When/Then）
- **P2** 方案设计：必须声明 `packages:` `domains:` `ui_affected:` `gate_commands:`（**方案明确才可跳 P2，不是方案不明确才做**）
- **P3** TDD 测试：**默认保留**，仅纯文档/配置或 ≤3 行且有现成覆盖时才跳
- **P4** 代码实现
- **P5** 技术验证：pytest 全绿 + 测试环境隔离正常
- **P6** 验收：**默认保留**，BDD 逐条实跑，翻译成人话；UI 必须 Playwright 实跑+截图
- **P7** 一致性检查（多文件改动时）
- **P8** 发布准备：每个声明的 package 各自 bump + CHANGELOG

**关键约束**：
- **gate 判定**：主 Agent 亲自跑命令，绝不信 subagent 自我报告（`[SCOPE_GAP]`/✅ 仅供参考）
- **[SCOPE+]**：任何阶段发现新隐含需求 → 增补 P1 基线 + 定向回补（不全重跑）
- **[NEED_CONFIRM]**：需求明确就自走；拿不准方向才停下问人
- **[CAPABILITY_GAP]**：P1 检测能力缺口，三态（available/supplementable/GAP），仅 GAP 才停
- **裁剪风险**：涉及 schema 变更/安全/多端 → P6 不可跳；「任务简单」不是合法裁剪理由

## 详细参考

- 完整配置和规范：`CLAUDE.md`
- 开发流程：`~/.agate/WORKFLOW.md`（P0-P8，需求基线+验收闭环，[agate](https://github.com/randomgitsrc/agate)）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 改善清单：`docs/roadmap/improvement-backlog.md`
