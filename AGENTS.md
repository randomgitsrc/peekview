# PeekView

Agent 写，人看，Agent 也能读。

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
5. **严禁** `pip3 install --break-system-packages -e .` 或任何向系统 Python 安装 peekview 的操作——这会覆盖 pipx 的 `/home/kity/.local/bin/peekview` 符号链接，导致生产服务加载源码而非 pipx 隔离 venv 的代码。开发测试用 `make dev`（venv 隔离）或 `make debug-start`（独立进程）
6. **严禁** 直接用 sqlite3 操作生产数据库（`~/.peekview/peekview.db`）。如发现测试数据误入生产 DB，报告给用户决定清理方式，不自行 DELETE。如必须清理，用 `peekview delete <slug>` CLI 命令（走应用逻辑，清理 DB + 存储 + FTS），清理后验证 `PRAGMA integrity_check` + `foreign_key_check`
7. **严禁** 用 CLI（`peekview create`）创建测试 entry——CLI 可能加载非 debug 配置导致误写生产 DB。测试 entry 只通过 debug backend HTTP API 创建：`curl -X POST http://127.0.0.1:8888/api/v1/entries ...`，创建后验证数据落在 debug DB
8. 前端路由：`src/router.ts`（不是 `src/router/index.ts`）
9. **前端 URL 路径是 `/:slug`，不是 `/entries/:slug`**。访问 entry 页面用 `http://127.0.0.1:8888/{slug}`（如 `/t022-test`），不要拼 `/entries/{slug}`。创建 entry 的 API 路径是 `/api/v1/entries`，但前端页面路由是 `/{slug}`。此错误反复导致 Playwright 验证失败，务必记住
10. 发布流程必须先读 `docs/process/release.md` — 特别是 `bump-version` 后必须手动填 CHANGELOG 再 `--amend`
11. 改代码前先读周围上下文，理解代码风格和现有库选择
12. 不加注释（除非被要求）
13. 完成任务后必须跑 lint/typecheck：后端 `cd backend && make lint`（ruff，本地约定，CI 不跑；⚠️ ruff 不在 venv 时 `make lint` 会因找不到 `ruff` 命令失败，用 `cd backend && python3 -m ruff check peekview/ tests/` 代替）；前端 `cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制）。后端 mypy strict 配置在 pyproject 但未进任何 target / 默认 venv，非门禁
14. 长耗时命令（`make bump-version`、`make build`、`make publish`、`make debug`）必须设 `timeout: 300000`（5 分钟）。命令超时后检查实际执行状态（版本号？文件？commit？），不盲目重试或绕过

## 环境隔离机制（代码层面保障）

- **`PEEKVIEW_DEBUG_MODE=1`**：`PeekConfig()` 无参调用且无 `PEEKVIEW_STORAGE__*` env 时，自动隔离到 `/tmp/peekview-debug/`，captcha 自动禁用（config.py:374）。`make debug-start` 额外显式设了 STORAGE env，走更直接路径
- **pytest 全局隔离**：`conftest.py` 的 `isolate_config_file` 是 `autouse=True`，每个测试自动设 `PEEKVIEW_STORAGE__DATA_DIR`/`DB_PATH` 指向 tmp_path（不依赖 DEBUG_MODE）
- **生产数据库**：`~/.peekview/peekview.db`，**调试数据库**：`/tmp/peekview-debug/peekview.db`
- **发布 token**：PyPI 在 `~/.bash_env`，npm 在 `~/.npmrc`，`make publish` 自动读取，不需要手动 export

## 常用命令

```bash
make dev                  # 创建/更新 backend/.venv（开发隔离，不影响 pipx 生产环境）
make debug                # 构建+启动+E2E（完整调试流程）
make debug-start          # 仅启动调试服务（自动用 .venv Python）
make debug-stop           # 停止调试服务

cd backend && .venv/bin/python -m pytest tests/  # 后端测试（用 venv；pyproject 已设 -v --tb=short）
cd backend && make lint   # 后端 lint (ruff check + format --check；CI 不跑，本地约定)
cd backend && make format # 后端自动修复 (ruff check --fix + format)

make build-frontend          # 前端构建 + 复制 dist/* → backend/peekview/static/（关键：npm run build 只产出 frontend-v3/dist/，不复制；dev-server.sh 启动前检查 backend/peekview/static/index.html 存在，缺失直接退出）
cd frontend-v3 && ./node_modules/.bin/vitest run   # 前端单测一次性运行（⚠️ npm run test = vitest 无参 = watch 模式，会挂住 agent）
cd frontend-v3 && npx vue-tsc --noEmit             # 前端类型检查（CI 强制；npm run build 内含此步）

make test-mcp-unit        # MCP 单元测试
make build-mcp            # MCP 构建

make publish              # 发布到 PyPI（自动从 ~/.bash_env 读 token）
make publish-npm          # 发布 MCP Server 到 npm

# Playwright CDP 截图 + vision 分析（Chrome :18800, Windows GPU）
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx script.ts
# Vision 分析（3 种方式，优先用 ①）
# ① vision-helper subagent（推荐，最方便）：Task 工具，subagent_type: vision-helper，prompt 传截图路径
# ② vision-analyzer skill：skill 工具加载后，按 SKILL.md 说明使用
# ③ vision-analyze CLI：python3 ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py -i /tmp/screenshot.png -p "描述"
# 配置在 ~/.env（VISION_API_KEY / VISION_API_BASE_URL / VISION_MODEL / VISION_API_FORMAT）
```

## 技术要点

- **静态文件双路径**：`main.py:_setup_static_files` 优先 serve `frontend-v3/dist/`（开发），其次 `peekview/static/`（pipx 安装包）。但 `make debug-start`（dev-server.sh）启动前强制检查 `backend/peekview/static/index.html`，缺失直接退出——所以改前端后必须 `make build-frontend`（不是只 `npm run build`）
- **vite dev 代理陷阱**：`npm run dev`（vite :5173）把 `/api` 代理到 `localhost:8080`（**生产** backend），会读写生产数据。前端开发走 `make debug`（:8888 隔离数据），不要用 `npm run dev` 对真实数据测试
- **DI 模式**：`request.app.state.entry_service`（非模块级全局变量）
- **认证三层**：JWT httpOnly Cookie (`peekview_token`) + Bearer header + `pv_` API key。优先级：`Authorization` header > Cookie > API key
- **权限模型**：Anonymous→仅公开；Authenticated→公开+自己私有；Admin→全部可见。`get_current_user`(可选) / `require_auth`(必须) / `require_admin`(管理员)
- **配置**：`PEEKVIEW_*` 环境变量，`__` 分隔嵌套（如 `PEEKVIEW_STORAGE__DATA_DIR`）
- **CSP（主应用）**：`script-src 'self' 'unsafe-eval'`（`unsafe-eval` 为 Mermaid/d3 的 `new Function()` 必需，不可移除）
- **CSP（HTML render 路由）**：`GET /api/v1/entries/{slug}/files/{file_id}/render` 返回独立宽松 CSP（`script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:` + `frame-ancestors 'self'`），支持 Three.js/WebGL/Canvas 富交互 HTML。中间件特判跳过 `X-Frame-Options: DENY`。主应用 `frame-src 'self' blob:` 允许同源 iframe
- **sibling 注入**：后端 BS4 实现（`html_render_service.py`），CSS/JS/img/favicon 内联注入。前端只传 file IDs，不 fetch 内容
- **DOMPurify**：清理 markdown 输出。Mermaid 源码不走 DOM（用 `Map` 传递）。含 `-->` 的属性会被 DOMPurify 删除
- **Rate limit**：captcha 端点用 `rate_limit_per_minute`，login/register 用 `rate_limit_login_per_minute`。`default_limits` 兜底其他 API 端点
- **MCP 版本独立**：由 `bump-mcp-version` 管理，主线 `bump-version` 不会碰。doc-sync 脚本已移除了 MCP package.json 同步条目
- **MCP 双模式**：`remote`（A→B→C，暴露 create_entry/get/list/delete）| `local`（A=B→C，暴露 publish_files/get/list/delete）
- **双包发布**：peekview (PyPI) + @peekview/mcp-server (npm)，版本独立管理
- **数据库**：SQLite WAL + FTS5，时间戳 naive UTC
- **Agent 读路径**：`GET /api/v1/entries/{slug}/raw` 返回结构化 JSON（文本文件含 content 字段；二进制文件 content=null + file_url）。公开条目免认证，私有条目需 API key
- **Playwright/Vision 验证**：Chrome CDP `localhost:18800`（Windows GPU），Playwright `connectOverCDP` 模式。脚本必须：`NODE_PATH=... npx tsx script.ts`、`try/finally { page.close() }`、`process.exit(0)`、`hardTimer`。不要 `browser.close()`（会杀 Chrome）。移动端模拟用 CDP `Emulation.setDeviceMetricsOverride`。截图后用 vision-helper subagent（Task 工具，subagent_type: vision-helper）分析，或 `python3 ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py -i <path> -p <prompt>` CLI
- **`make debug-verify-isolation`**：依赖生产 :8080 在线——若生产服务未运行会超时。此时可用 `sqlite3 /tmp/peekview-debug/peekview.db "SELECT COUNT(*) FROM entries"` 手动验证隔离
- **`make debug` E2E**：完整 E2E suite 在 CDP 模式下可能超时（>5min）。Agent 派发时优先用自定义 Playwright 脚本逐项验证，避免触发完整 suite 超时

## 安全要点

- local_path 必须 allowlist + symlink 先检查再 resolve（后端拒绝 symlink，MCP 用 realpath 跟随后检查）
- `pv_` API key：HMAC-SHA256 hash 存储，最多 10 个/用户
- Entry 私有访问对非 owner 返回 404（非 403），防止 slug 枚举
- Global API key 中间件跳过 auth 端点，数据端点受保护
- FTS5 查询净化仅转义引号，复杂语法错误被 try/except 静默吞掉返回空结果
- HTML render 路由：`sandbox="allow-scripts"`（无 `allow-same-origin`）使 iframe 在 opaque origin 运行，无法访问主页面 cookie/localStorage。初始 fetch 携带 cookie（private entry 可加载），但 iframe内 JS 无法读取凭据

## 发布注意事项

- **peekview 和 peekview-mcp 版本独立**：`bump-version` vs `bump-mcp-version`
- 发布完别忘了检查 CHANGELOG.md 是否正确

## 走 agate 工作流（非平凡任务）

**开始前必读 `docs/tasks/active-tasks.md`**，无进行中任务再启动新任务。

**启动 Task 前必须完成环境自检**：`docs/process/env-check-protocol.md`（工具链 / 调试服务 / Playwright CDP / Vision 分析 / 端到端截图验证，5 项全 PASS 才进 P1）

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
- 前端设计系统：`DESIGN.md`
- 开发流程：`~/.agate/WORKFLOW.md`（P0-P8，需求基线+验收闭环，[agate](https://github.com/randomgitsrc/agate)）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 改善清单：`docs/roadmap/improvement-backlog.md`
