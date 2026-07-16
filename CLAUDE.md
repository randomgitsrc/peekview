# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeekView**: Agent writes, humans view, agents can also read. Agent publishes entries via API/CLI/MCP → humans view formatted content in browser, and agents read raw content back via `/raw` endpoint.

- **Current State:** Backend, frontend, and MCP Server are complete. MCP Server v0.9.2 (Streamable HTTP transport) has been released to npm.
- **Current Version:** v0.7.0 (Backend/Frontend) | MCP Server v0.9.2
- **Architecture:** FastAPI (Python 3.10+; `pyproject.toml` `requires-python>=3.10`, ruff/mypy target `py310`, badges claim 3.12/3.13, build system: hatchling) + SQLite (WAL mode, FTS5) backend, Vue 3 + Vite + TypeScript + Shiki SPA frontend, MCP Server (Node.js ≥18/TypeScript, Streamable HTTP transport)

## Project Structure

```
peekview/
├── docs/
│   ├── guides/          # Deployment, debugging, agent deployment guides
│   ├── notes/           # Lessons learned (frontend/backend/mcp)
│   ├── plans/           # Active plans (mcp-path-namespace, gole-cli-config)
│   ├── reviews/         # Active reviews (workflow-v4, T002 postmortem)
│   ├── decisions/       # Architecture Decision Records
│   ├── process/         # Dev workflow (workflow-v4/ archived, release, gstack-review-guide)
│   ├── tasks/           # Task board (active-tasks.md) + task dirs
│   ├── roadmap/         # improvement-backlog.md
│   └── archived/        # Completed plans, specs, reviews, old workflows
├── backend/             # FastAPI backend
│   ├── peekview/        # Main package (note: package is "peekview", not "peek")
│   │   ├── main.py      # FastAPI app factory with DI via app.state
│   │   ├── models.py    # SQLModel Entry/File/User/ApiKey + Pydantic schemas
│   │   ├── config.py    # Pydantic Settings (PEEKVIEW_* env vars)
│   │   ├── database.py  # SQLite init with WAL + FTS5
│   │   ├── auth.py      # JWT auth (Bearer header + httpOnly cookie), bcrypt hashing, API key verification
│   │   ├── storage.py   # Filesystem operations (atomic writes)
│   │   ├── cli.py       # Click CLI (serve/create/get/list/delete/user/login/apikey)
│   │   ├── api/         # FastAPI routes (entries, files, auth, apikeys, admin, captcha, config)
│   │   └── services/    # Business logic (entry_service, file_service, apikey_service, admin_service)
│   └── tests/           # pytest suite with shared conftest.py fixtures
├── frontend-v3/         # Vue 3 + Vite + TypeScript + Shiki SPA (v3 - CURRENT)
│   ├── src/             # TypeScript/Vue source files
│   ├── dist/            # Build output (copied to backend/peekview/static/)
│   └── e2e/             # Playwright E2E tests
└── packages/
    └── mcp-server/      # MCP Server (@peekview/mcp-server on npm)
        ├── src/         # TypeScript source (server, client, tools, config)
        ├── dist/        # Compiled output
        └── tests/       # Unit, integration, e2e tests
```

**Important:** The frontend router is in `src/router.ts` (NOT `src/router/index.ts`).

**Frontend URL paths:** the page route for an entry is `/{slug}` (e.g. `http://127.0.0.1:8888/my-code`), **NOT** `/entries/{slug}`. Only the API is `/api/v1/entries`. Mismatching the page route is a recurring Playwright failure cause — always navigate to `/{slug}`.

## Key Commands

### Debug Workflow (CRITICAL - MUST READ FIRST)

```bash
# 一键完整调试（构建+启动+验证隔离+测试）
make debug

# 分步调试流程
make debug-build          # 构建并验证 static 文件
make debug-start          # 启动调试服务（:8888，与 pipx 服务隔离）
make debug-status         # 查看调试服务状态
make debug-restart        # 重启调试服务
make debug-verify-isolation  # 验证数据隔离（v0.1.22+ 强制）
make debug-test           # 运行 Playwright E2E 测试（带数据隔离 guard）
make debug-stop           # 停止调试服务

# MCP Server 测试
make build-mcp            # Build MCP Server
make test-mcp-unit        # 运行 MCP 单元测试（无需后端）
make test-mcp             # 运行 MCP 纯单元测试套件（integration/e2e 分离）
```

**严禁**:
- ❌ 直接手动启动 uvicorn（容易用错端口或数据目录）
- ❌ `pip3 install --break-system-packages -e .` 或任何向系统 Python 安装 peekview 的操作——这会覆盖 pipx 的 `/home/kity/.local/bin/peekview` 符号链接，导致生产服务加载源码而非 pipx 隔离 venv 的代码。开发用 `make dev`（venv 隔离）或 `make debug-start`（独立进程）
- ❌ 跳过 E2E 测试直接发布
- ❌ 停止/触碰用户的 pipx 正式服务（:8080）
- ❌ 运行会触碰真实 `~/.peekview/` 的测试；MCP 测试必须使用临时 HOME
- ❌ 用 CLI（`peekview create`）创建测试 entry — CLI 可能加载非 debug 配置导致误写生产 DB。测试 entry 只通过 debug backend HTTP 创建（`curl -X POST http://127.0.0.1:8888/api/v1/entries ...`），创建后验证数据落在 debug DB
- ❌ 直接用 sqlite3 操作生产数据库（`~/.peekview/peekview.db`）。如发现测试数据误入生产 DB，报告给用户决定清理方式，不自行 DELETE。如必须清理，用 `peekview delete <slug>` CLI 命令（走应用逻辑，清理 DB + 存储 + FTS），清理后验证 `PRAGMA integrity_check` + `foreign_key_check`
- ❌ 前端页面路由写成 `/entries/{slug}` — 页面路由是 `/{slug}`（API 才是 `/api/v1/entries`）；反复导致 Playwright 验证失败

### Vision & E2E Skills

**两个全局 skill 可用，不依赖 MCP，任何会话直接调：**

| Skill | 功能 | 调用方式 |
|-------|------|----------|
| **playwright-cdp** | Chrome CDP 截图、DOM 检查、E2E 交互 | `Skill("playwright-cdp")` → 按模板写 CDP 脚本 → `npx tsx` 执行 |
| **vision-analyzer** | 截图/图片分析（支持 anthropic/openai 双格式） | `~/.claude/skills/vision-analyzer/scripts/vision-analyze.py -i /tmp/ss.png -p "描述"` |

**配置**：`~/.env` 文件（全局，所有项目共用）：

```bash
VISION_API_KEY=sk-xxx
VISION_API_BASE_URL=https://api.minimaxi.com/anthropic
VISION_MODEL=MiniMax-M3
VISION_API_FORMAT=anthropic
```

换 provider 只改 `~/.env`，不改代码。

**标准 E2E + Vision 流程**：

```
1. make debug-start                              # 启动隔离 debug backend
2. playwright-cdp skill → CDP 截图             # 真实 Chrome 渲染截图
3. vision-analyzer skill → 分析截图               # 结构化 YAML 输出
4. make debug-stop                               # 停止
```

**运行单个 E2E spec**（`make debug-test` 默认跑 `debug-server.spec.ts`，可通过 `E2E_SPEC` 覆盖）：

```bash
E2E_SPEC=e2e/search.spec.ts make debug-test                     # 单 spec（标准流程+隔离 guard）
E2E_GUARD_ENABLED=1 npx playwright test e2e/search.spec.ts      # 备选：直接跑（确保 debug backend 运行）
```

### Environment Isolation Mechanism (v0.1.57+)

Code-level protection against accidental writes to production data:

- **`PEEKVIEW_DEBUG_MODE=1`**: All bare `PeekConfig()` calls auto-isolate to `/tmp/peekview-debug/` and disable captcha. Set this env var before running CLI commands or scripts that touch the database.
- **pytest global isolation**: `conftest.py` `isolate_config_file` fixture auto-sets `PEEKVIEW_STORAGE__*` env vars, so all `PeekConfig()` calls in tests point to `tmp_path`.

### Coding Style
- **不加注释**（除非被要求）— 代码应自解释
- 完成任务后必须跑 lint/typecheck：后端 `cd backend && make lint`（ruff，本地约定，CI 不跑）；前端 `cd frontend-v3 && npx vue-tsc --noEmit`（CI 强制）
- 长耗时命令（`make bump-version`、`make build`、`make publish`、`make debug`）必须设 `timeout: 300000`（5 分钟）。命令超时后检查实际执行状态（版本号？文件？commit？），不盲目重试或绕过

### Backend Commands (from `backend/`)

```bash
# Setup (venv isolated, does NOT touch system Python or pipx)
make dev                     # Create/update backend/.venv + install editable (hatchling build system)
source backend/.venv/bin/activate  # Activate venv

# Testing
make test                   # pytest tests/ -v --tb=short
make test-cov               # With coverage report
pytest tests/test_apikey.py -v  # Single test file
pytest tests/ --lf -v       # Run only failed tests

# Code quality
make lint                   # ruff check + format --check (local convention; CI does NOT run ruff)
make format                 # ruff check --fix + format
```

**mypy:** a `strict = true` mypy config exists in `pyproject.toml`, but mypy is NOT in the default venv or any Make target and is not a gate. Don't assume type-checks pass; `make lint` (ruff) is the only local lint gate. Frontend type-check (`vue-tsc`) IS CI-enforced.

### Frontend Commands (from `frontend-v3/`)

```bash
npm install
make build-frontend          # Build + copy dist/* → backend/peekview/static/ (REQUIRED for debug: dev-server.sh exits if backend/peekview/static/index.html is missing)
npm run build                # ⚠️ Only outputs frontend-v3/dist/, does NOT copy to static/ — use make build-frontend instead
npm run dev                  # Vite dev server (:5173) — ⚠️ proxies /api → localhost:8080 PRODUCTION backend (writes prod data); prefer `make debug` (:8888 isolated)

# Unit tests — `npm run test` is vitest WATCH mode (no `run` arg → hangs the agent). Always one-shot:
make test-frontend           # = npm run test -- --run (one-shot, safe, run from repo root)
cd frontend-v3 && npx vitest run        # direct one-shot alternative

# E2E tests (Playwright) — there is NO `npm run test:e2e` script in frontend-v3:
make debug                   # full flow: build + start isolated :8888 + verify isolation + run E2E + MCP integration
make debug-test              # run Playwright E2E against an ALREADY-RUNNING debug server (:8888); aborts with a data-isolation guard if not the debug server — run `make debug-start` first, or use `make debug`
cd frontend-v3 && E2E_GUARD_ENABLED=1 npx playwright test e2e/viewer.spec.ts   # direct single spec with isolation guard (needs a running backend)

# Type check (CI-enforced; also runs inside npm run build):
cd frontend-v3 && npx vue-tsc --noEmit
```

### MCP Commands (from `packages/mcp-server/`)

```bash
npm ci
npm run build
npm run test:unit           # Pure unit tests, isolated temp HOME
npm test                    # Alias for pure unit test suite
npm run test:integration    # Requires debug backend and API key(s)
npm run test:e2e:node       # Node/Vitest MCP E2E, requires debug backend
```

### Release Commands

```bash
make bump-version NEW_VERSION=x.y.z        # Bump backend/frontend version + auto-sync docs
make bump-mcp-version NEW_MCP_VERSION=x.y.z  # Bump MCP version independently (主线 bump-version 不会碰 MCP)
make pre-publish                           # Full check (clean build + test)
make pre-publish-quick                     # Quick check (no rebuild)
make publish                               # Build + upload to PyPI (token from ~/.bash_env)
make publish-npm                           # Publish MCP Server to npm (token from ~/.npmrc)
```

**Note:** PeekView (PyPI) and @peekview/mcp-server (npm) have **independent versioning**. `bump-version` only touches backend/frontend; `bump-mcp-version` only touches MCP. After bumping, manually fill CHANGELOG.md then `--amend` the commit (see `docs/process/release.md`).

## Key Architectural Decisions

### DI Pattern
Services are accessed via `app.state` (not module-level globals):
```python
entry_service = request.app.state.entry_service
```

### Static Files Dual-Path
`main.py:_setup_static_files` prioritizes `frontend-v3/dist/` (dev), falls back to `peekview/static/` (pipx install). But `make debug-start` (dev-server.sh) checks `backend/peekview/static/index.html` exists before starting — so after frontend changes, must run `make build-frontend` (not just `npm run build` which only outputs to `frontend-v3/dist/`).

### Vite Dev Proxy Trap
`npm run dev` (Vite :5173) proxies `/api` to `localhost:8080` (**production** backend), which reads/writes production data. Frontend development must use `make debug` (:8888 isolated data), never `npm run dev` against real data.

### Auth Three-Layer Priority
JWT httpOnly Cookie (`peekview_token`) + Bearer header + `pv_` API key. Priority: `Authorization` header > Cookie > API key. Auth helpers: `get_current_user` (optional) / `require_auth` (required) / `require_admin` (admin).

### Data Model
- `entries`: `id`, `slug` (UNIQUE), `summary`, `status`, `tags` (JSON), `expires_at`, `is_public`, `owner_id`
- `files`: `entry_id`, `path`, `filename`, `language`, `is_binary`, `size`, `sha256`
- `users`: `id`, `username` (UNIQUE), `password_hash`, `display_name`, `is_active`, `is_admin`
- `api_keys`: `id`, `user_id`, `name`, `key_prefix`, `key_hash` (UNIQUE), `expires_at`, `last_used_at`
- FTS5 virtual table `entries_fts` for full-text search; query sanitization only escapes quotes, complex syntax errors are silently caught (returns empty results)
- Files stored in `~/.peekview/data/default/{entry_id}/`
- Timestamps are naive UTC
- **Agent read path**: `GET /api/v1/entries/{slug}/raw` returns structured JSON (text files include `content` field; binary files have `content=null` + `file_url`). Public entries need no auth; private entries require API key.

### Security (Critical)
1. **local_path allowlist**: Only paths under configured allowed directories permitted
2. **Symlink check BEFORE resolve**: Check `original.is_symlink()` before `original.resolve()`
3. **Path traversal on `files.path`**: Verify resolved path starts with `base.resolve()`
4. **Global API Key auth**: `PEEKVIEW_SERVER__API_KEY` for service-level auth
5. **User-level API Key auth**: `pv_` prefix keys, HMAC-SHA256 hashed, bound to user, max 10 per user
6. **JWT user auth**: `Authorization: Bearer <jwt>` header OR httpOnly cookie (`peekview_token`) — cookie set on login/register, cleared on logout
7. **Entry visibility**: Anonymous users see only public entries; authenticated users see public + own private entries; admin sees all. Private entries return **404** (not 403) to non-owners, preventing slug enumeration.
8. **MCP local publish_files**: realpath + sensitive blacklist + allowed_paths/cwd boundary; cwd fallback must reject `/`
9. **Global API key middleware**: Skips auth endpoints, protects data endpoints
10. **CSP**: Frontend pages have Content-Security-Policy (script-src includes unsafe-eval for Mermaid/d3 — `unsafe-eval` is required by Mermaid/d3's `new Function()`, cannot be removed); externalized inline scripts. HTML render route (`GET /api/v1/entries/{slug}/files/{file_id}/render`) returns permissive CSP (script-src unsafe-inline unsafe-eval blob data https + frame-ancestors self) for Three.js/WebGL/Canvas. Main app `frame-src 'self' blob:` allows same-origin iframe. Middleware skips X-Frame-Options for render route.
11. **Sibling injection**: Backend BS4 implementation (`html_render_service.py`) inlines CSS/JS/img/favicon. Frontend passes file IDs via `?inject=` query param, does not fetch sibling content.
12. **HTML render sandbox**: Rendered HTML uses `sandbox="allow-scripts"` (no `allow-same-origin`), making iframe run in opaque origin — cannot access main page cookies/localStorage. Initial fetch carries cookie (private entries can load), but JS inside iframe cannot read credentials.
13. **DOMPurify**: Sanitizes markdown output. Mermaid source bypasses DOM (uses `Map` for data passing). Attributes containing `-->` are removed by DOMPurify.

### File Upload Modes
1. **Content inline:** `files[].content` with optional `path`
2. **Local path:** `files[].local_path` - reads from server filesystem (allowlist check)
3. **Directory scan:** `dirs[].path` - recursive scan, respects ignore patterns

### MCP Server Architecture (v0.9.2)
- **Transport**: Streamable HTTP via `@modelcontextprotocol/sdk`
- **Auth**: Two-layer — `pv_` prefix check at initialize, then passthrough to PeekView API
- **Session**: Per-session Server instance with idle timeout cleanup
- **Modes**:
  - `remote` (default, A→B→C): exposes `create_entry`, `get_entry`, `list_entries`, `delete_entry`
  - `local` (A=B→C): exposes `publish_files`, `get_entry`, `list_entries`, `delete_entry`; does **not** expose `create_entry`
- **publish_files**: reads files directly from disk, requires absolute paths, uses `server.allowed_paths` or cwd+tmpdir fallback, `trust_all_paths` option, rejects cwd `/`
- **Service commands**: Auto-detect user/system service mode (`--user`/`--system` flags, default prefers user service)
- **Deployment architecture**: Agent(A机器) → HTTP POST → MCP Server(B机器) → HTTP → PeekView(C机器). B and C may be the same server.
- **Version correspondence:** MCP Server v0.9.2 requires PeekView Backend v0.1.25+

### Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description",
    "details": {}
  }
}
```

## Testing Strategy

- **Backend fixtures:** Shared in `conftest.py` (temp dirs, test DB, async client, factories)
- **Backend factories:** Test data builders in `factories.py`
- **Security tests:** Path traversal, allowlist bypass, symlink attacks in `test_security.py`
- **E2E tests:** Playwright (chromium + Mobile Chrome), includes auth, All/Mine tabs, API Keys
- **MCP unit tests:** Use temp HOME; never rename or touch real `~/.peekview/mcp-config.yaml`
- **MCP integration/e2e tests:** Require debug backend on `127.0.0.1:8888`; must never target production `:8080`
- All backend/frontend tests use temp directories (never touch real `~/.peekview/`)

## Configuration (PEEKVIEW_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `PEEKVIEW_SERVER__HOST` | `0.0.0.0` | Server bind address (`127.0.0.1` for local-only) |
| `PEEKVIEW_SERVER__PORT` | `8080` | Server port |
| `PEEKVIEW_SERVER__BASE_URL` | `""` | External URL (empty = auto-detect) |
| `PEEKVIEW_SERVER__API_KEY` | `""` | Global API key for service-level auth |
| `PEEKVIEW_SERVER__CORS_ORIGINS` | `["http://localhost:5173"]` | CORS allowed origins |
| `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED` | `true` | Enable rate limiting on sensitive endpoints |
| `PEEKVIEW_SERVER__RATE_LIMIT_PER_MINUTE` | `60` | Default rate limit per IP |
| `PEEKVIEW_SERVER__RATE_LIMIT_LOGIN_PER_MINUTE` | `10` | Login/register rate limit per IP |
| `PEEKVIEW_STORAGE__DATA_DIR` | `~/.peekview/data` | File storage directory |
| `PEEKVIEW_STORAGE__DB_PATH` | `~/.peekview/peekview.db` | SQLite database path |
| `PEEKVIEW_STORAGE__ALLOWED_PATHS` | `[]` | Allowlist for local_path reads |
| `PEEKVIEW_STORAGE__HEALTH_DISK_WARNING_MB` | `100` | Health warning threshold for free disk space |
| `PEEKVIEW_STORAGE__IGNORED_DIRS` | `{.git,.svn,__pycache__,node_modules,.venv,venv,.tox,dist,build}` | Ignored dirs for recursive scan |
| `PEEKVIEW_AUTH__SECRET_KEY` | `""` | JWT signing key (empty = auto-generate) |
| `PEEKVIEW_AUTH__TOKEN_EXPIRE_DAYS` | `7` | JWT token validity days |
| `PEEKVIEW_AUTH__ALLOW_REGISTRATION` | `true` | Allow new user registration |
| `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE` | `true` | Allow anonymous entry creation |
| `PEEKVIEW_AUTH__CAPTCHA_ENABLED` | `false` | Enable captcha on register/login |
| `PEEKVIEW_AUTH__CAPTCHA_SITE_KEY` | `"peekview-default"` | Cap site key (public, exposed to frontend) |
| `PEEKVIEW_AUTH__CAPTCHA_SECRET_KEY` | `""` | Captcha JWT signing key (auto-generated if empty) |
| `PEEKVIEW_AUTH__CAPTCHA_VERIFY_URL` | `"http://localhost:3000"` | Cap standalone server URL |
| `PEEKVIEW_AUTH__CAPTCHA_EXEMPT_FIRST_USER` | `true` | First user (admin) bypasses captcha |
| `PEEKVIEW_AUTH__CAPTCHA_BUILTIN_DIFFICULTY` | `2` | PoW difficulty (hex prefix length) |
| `PEEKVIEW_AUTH__CAPTCHA_BUILTIN_CHALLENGE_COUNT` | `10` | Number of PoW challenges per verification |
| `PEEKVIEW_AUTH__CAPTCHA_BUILTIN_CHALLENGE_SIZE` | `32` | Salt size (bytes) per challenge |
| `PEEKVIEW_AUTH__CAPTCHA_BUILTIN_CHALLENGE_TTL_MS` | `600000` | Challenge JWT TTL (ms, 10 min) |
| `PEEKVIEW_AUTH__CAPTCHA_BUILTIN_TOKEN_TTL_MS` | `1200000` | Redeem token TTL (ms, 20 min) |
| `PEEKVIEW_LIMITS__MAX_FILE_SIZE` | `20971520` | Max single file size (20MB) |
| `PEEKVIEW_LIMITS__MAX_CONTENT_LENGTH` | `1048576` | Max inline content length (1MB) |
| `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` | `50` | Max files per entry |
| `PEEKVIEW_LIMITS__MAX_ENTRY_SIZE` | `104857600` | Max total entry size (100MB) |
| `PEEKVIEW_LIMITS__MAX_SLUG_LENGTH` | `64` | Max custom slug length |
| `PEEKVIEW_LIMITS__MAX_SUMMARY_LENGTH` | `500` | Max summary length |
| `PEEKVIEW_LIMITS__MAX_PER_PAGE` | `50` | Max items per page |
| `PEEKVIEW_LIMITS__DEFAULT_EXPIRES_IN` | `"15d"` | Default expiration for new entries |
| `PEEKVIEW_CLEANUP__CHECK_ON_START` | `true` | Check expired entries on startup |
| `PEEKVIEW_CLEANUP__INTERVAL_SECONDS` | `3600` | Cleanup interval seconds (0 = disabled) |
| `PEEKVIEW_LOGGING__LEVEL` | `INFO` | Log level |
| `PEEKVIEW_LOGGING__LOG_FILE` | `None` | Log file path (None = stderr only) |
| `PEEKVIEW_REMOTE__URL` | `""` | Remote CLI server URL |
| `PEEKVIEW_REMOTE__API_KEY` | `""` | Remote CLI API key |
| `PEEKVIEW_REMOTE__TOKEN` | `""` | Remote CLI JWT token |
| `PEEKVIEW_REMOTE__TIMEOUT` | `30` | Remote request timeout seconds |
| `PEEKVIEW_REMOTE__VERIFY_SSL` | `true` | Verify SSL certificates |

**Note:** Use `__` as separator for nested config (e.g., `storage.data_dir` → `PEEKVIEW_STORAGE__DATA_DIR`).

## Development Workflow (agate)

非平凡任务走 [agate](https://github.com/randomgitsrc/agate) 工作流（规则在 `~/.agate/`）。主 Agent 派发 subagent 到独立上下文，自己只读状态/派发/验门槛/更新状态，不亲自写产出。

**阶段链 P1-P8**：P1 需求基线 → P2 设计 → P3 测试 → P4 实现 → P5 技术验证 → P6 验收 → P7 一致性 → P8 发布准备 → READY（人工 make publish）。

**关键约束**：
- **P1** 用 BDD（Given/When/Then）建立需求基线，先质疑需求、识别隐含依赖；需求明确则自走，拿不准方向才标 `[NEED_CONFIRM]` 问人
- **P1 评审不可裁**：所有任务都走独立 requirements-review（agent≠main），与 P2 design-review 对称
- **P2** 必须声明 `packages:` `domains:` `ui_affected:`（漏 packages 导致多包发布漏 bump）。P2 不可裁剪——方案设计是必经阶段，`design_trivial`/`follows_existing_pattern` 可简化（1 个候选方案），不可省略
- **`[SCOPE+]`**：任何阶段发现新隐含需求 → 增补 P1 基线 + 定向回补（不全重跑）
- **P6 验收铁律（T026 教训）**：
  - BDD 条件逐条实跑、翻译成人话；UI 必须 Playwright 实跑+截图，不接受"代码看起来对"
  - **每条 BDD PASS 必须有独立证据**（截图、测试日志、Playwright trace 至少一种）
  - **优先执行 P6 verifier 产出的测试脚本**（不绕过写 CDP 脚本替代）
  - **禁止编造验收结果**：没有实际跑过的 BDD 标 FAIL 或 PAUSED，绝不填 PASS
  - `P6-acceptance.md` 的 PASS/FAIL 标签 ≠ gate 通过——证据文件存在且数量对才是
  - P6 不可裁剪——验收是质量最后防线。`no_behavior_change` 可简化 P6（快速验收），不可省略
- **P4/P7 交叉核对**：P4 的 `[DESIGN_GAP:]` 必须在 P7 被转抄 + 配对 `[DESIGN_GAP_REVIEWED:]`
- **gate 判定**：主 Agent 亲自跑命令，绝不信 subagent 自我报告（`[SCOPE_GAP]`/✅ 仅供参考）
- 微/小任务可裁剪阶段，但裁剪需写理由，P1 需求基线不可跳

## Essential Documentation

- **Active Tasks:** `docs/tasks/active-tasks.md` — 开始任何工作前必读
- **Dev Workflow:** `~/.agate/WORKFLOW.md` — 当前主流程（P0-P8 子 Agent 编排，[agate](https://github.com/randomgitsrc/agate)）
- **gstack Review Roles:** `docs/process/gstack-review-guide.md` — /review /cso /plan-eng-review 等
- **Release Process:** `docs/process/release.md` — 发布前必读
- **Debug Workflow:** `docs/process/debug-workflow.md` — 调试验证
- **Deployment:** `docs/guides/DEPLOYMENT.md`
- **Project Index:** `INDEX.md` — 导航入口
