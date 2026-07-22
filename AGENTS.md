# PeekView

Agent 写，人看，Agent 也能读。

## 架构

| 组件 | 路径 | 栈 |
|------|------|----|
| Backend | `backend/peekview/` | FastAPI + SQLite (WAL+FTS5), Python ≥3.10 |
| Frontend | `frontend-v3/` | Vue 3 + Vite + TypeScript + Shiki |
| MCP Server | `packages/mcp-server/` | Node.js ≥18/TS + Streamable HTTP |

```
backend/peekview/
├── main.py           # App factory (create_app/get_app), DI via app.state
├── models.py         # SQLModel Entry/File/User/ApiKey + Pydantic schemas
├── config.py         # Pydantic Settings (PEEKVIEW_* env vars, __ nested)
├── database.py       # SQLite init, WAL, FTS5, migrations
├── auth.py           # JWT + bcrypt + API key verification
├── storage.py        # Filesystem operations (atomic writes)
├── cli.py            # Click CLI (serve/create/get/list/delete/user/login/apikey/admin)
├── api/              # Routes: entries, files, auth, apikeys, admin, captcha, config, shares, rate_limit
└── services/         # entry, file, apikey, admin, share, read_tracking, html_render

frontend-v3/src/
├── router.ts         # ⚠️ 不是 src/router/index.ts
├── views/            # Landing, EntryList, EntryDetail, ApiKeyList, NotFound
├── components/       # CodeViewer(Shiki), MarkdownViewer, MermaidDiagram, FileTree, LoginDialog, ...
├── stores/           # Pinia: auth, entry, share, theme
├── composables/      # useShiki, useMermaid, useMarkdown, useToast, useViewMode, useDiagramViewer, usePlantUML, useDebounce, useRelativeTime
├── api/              # Axios HTTP client wrappers
└── types/            # TypeScript interfaces

packages/mcp-server/src/
├── server.ts         # MCP Server setup, Streamable HTTP transport
├── client.ts         # PeekView API client
├── tools/            # createEntry, publishFiles, get/list/deleteEntry, fileNaming, utils
├── config/           # file.ts, merge.ts, validators.ts (Env > file > default)
└── cli/              # config.ts, service.ts (service install/verify)
```

**版本源**：`VERSIONS.json` 是唯一版本源，`bump-version`/`bump-mcp-version` 通过 `scripts/sync_versions.py` 同步到所有文件。两个包版本独立管理。

## 铁律（违反必出事）

1. **严禁** `uvicorn` 直接启动。用 `make debug`（`127.0.0.1:8888`，独立数据目录 `/tmp/peekview-debug/`）
2. **严禁** 停止/触碰用户的 pipx 正式服务（`:8080`）
3. **严禁** 跑会触碰真实 `~/.peekview/` 的测试；MCP/E2E 测试必须用临时 HOME 或 debug backend
4. **严禁** `pip3 install --break-system-packages -e .` 或任何向系统 Python 安装 peekview 的操作——会覆盖 pipx 的 `/home/kity/.local/bin/peekview` 符号链接。开发用 `make dev`（venv 隔离）或 `make debug-start`
5. **严禁** 直接用 sqlite3 操作生产数据库（`~/.peekview/peekview.db`）。如发现测试数据误入，报告用户决定清理方式。如必须清理，用 `peekview delete <slug>`（走应用逻辑），清理后验证 `PRAGMA integrity_check` + `foreign_key_check`
6. **严禁** 用 CLI（`peekview create`）创建测试 entry——CLI 可能加载非 debug 配置导致误写生产 DB。测试 entry 只通过 debug backend HTTP API：`curl -X POST http://127.0.0.1:8888/api/v1/entries ...`
7. **前端 URL 路径是 `/:slug`，不是 `/entries/:slug`**。API 是 `/api/v1/entries`，页面路由是 `/{slug}`。此错误反复导致 Playwright 验证失败
8. **CHANGELOG 及时记录**：用户可见改动完成后，立刻写入 `CHANGELOG.md` 的 `[Unreleased]` 区域，不可延后
9. 不加注释（除非被要求）
10. 完成任务后必须跑 lint/typecheck：`make lint && make typecheck`（ruff 不在 venv，用系统 python3；CI 强制）
11. 长耗时命令（`make bump-version`、`make build`、`make publish`、`make debug`）必须设 `timeout: 300000`（5 分钟）。超时后检查实际执行状态，不盲目重试

## 环境隔离

- **`PEEKVIEW_DEBUG_MODE=1`**：`PeekConfig()` 无参调用且无 `PEEKVIEW_STORAGE__*` env 时，自动隔离到 `/tmp/peekview-debug/`，captcha 自动禁用
- **pytest 全局隔离**：`conftest.py` 的 `isolate_config_file` 是 `autouse=True`，每个测试自动设 `PEEKVIEW_STORAGE__DATA_DIR`/`DB_PATH` 指向 tmp_path
- **生产数据库**：`~/.peekview/peekview.db`，**调试数据库**：`/tmp/peekview-debug/peekview.db`
- **发布 token**：PyPI 在 `~/.bash_env`，npm 在 `~/.npmrc`，`make publish` 自动读取

## 常用命令

```bash
# 开发环境
make dev                  # 创建/更新 backend/.venv（不影响 pipx）

# 后端
make test-quick                                                          # 测试（用 venv，自动检查 venv 是否过期）
make lint                                                                # lint（ruff 不在 venv，用系统 python3）
make lint-fix                                                            # lint 自动修复

# 前端
make build-frontend                                                      # 构建 + 复制到 static/
make test-frontend                                                       # 单测（非 watch 模式，失败会报错）
make typecheck                                                           # 类型检查（CI 强制）

# MCP
make build-mcp            # 构建
make test-mcp-unit        # 单元测试

# Playwright CDP 截图 + vision 分析（Chrome :18800, Windows GPU）
NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx script.ts
# Vision 分析（3 种方式，优先用 ①）
# ① vision-helper subagent（推荐）：Task 工具，subagent_type: vision-helper
# ② vision-analyzer skill：skill 工具加载后按 SKILL.md 使用
# ③ vision-analyze CLI：python3 ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py -i <path> -p "描述"
```

## 调试流程

```
make build-frontend          # 1. 前端构建 → static/（改了前端必须跑，改了后端可跳）
make debug-start              # 2. 启动 :8888 调试服务（自动用 .venv Python）
make debug-seed               # 3. 灌入测试数据（3 用户 + 12 条目：公开/私有/归档/多文件）
make debug-verify-isolation   # 4. 验证数据隔离（依赖 :8080 在线；不在线就用 sqlite3 /tmp/peekview-debug/peekview.db 手动查）
make debug-test               # 5. E2E 测试（或指定单个 spec：E2E_SPEC=e2e/search.spec.ts make debug-test）
make debug-stop               # 6. 停止 + 清理 /tmp/peekview-debug/
```

一键版：`make debug`（= build + start + verify-isolation + test + test-mcp）

测试数据：`make debug-seed` 创建 alice/bob/carol（密码 testpass123）+ 12 个条目（公开 ×9、私有 ×2、归档 ×1），含 Python/Vue/K8s/Mermaid/PlantUML/SQLite/多文件模板等不同类型

## 发布流程

```
make bump-version NEW_VERSION=x.y.z    # 更新 VERSIONS.json + 同步所有文件 + commit + tag
# 填 CHANGELOG（bump 后必须做）：将 [Unreleased] 移到 [x.y.z] 下，git add CHANGELOG.md && git commit --amend --no-edit
make pre-publish-quick                 # 快速检查（不 rebuild）
make publish                           # PyPI（token 从 ~/.bash_env 读）
git push && git push origin vx.y.z     # 推送代码 + tag
# 升级生产（⚠️ 必须人工）：pipx upgrade peekview && sudo systemctl restart peekview
```

MCP 独立发布：`make bump-mcp-version NEW_MCP_VERSION=x.y.z` → 填 CHANGELOG → `make pre-publish-npm` → `make publish-npm`

## 技术要点

- **静态文件双路径**：`main.py:_setup_static_files` 优先 serve `frontend-v3/dist/`（开发），其次 `peekview/static/`（pipx 安装包）。但 `make debug-start` 启动前强制检查 `backend/peekview/static/index.html`，缺失直接退出——所以改前端后必须 `make build-frontend`（不是只 `npm run build`）
- **vite dev 代理陷阱**：`npm run dev`（vite :5173）把 `/api` 代理到 `localhost:8080`（**生产** backend），会读写生产数据会被读写。前端开发走 `make debug`（:8888 隔离数据）
- **DI 模式**：`request.app.state.entry_service`（非模块级全局变量）
- **认证三层**：JWT httpOnly Cookie (`peekview_token`) + Bearer header + `pv_` API key。优先级：`Authorization` header > Cookie > API key
- **权限模型**：Anonymous→仅公开；Authenticated→公开+自己私有；Admin→全部可见。私有 entry 对非 owner 返回 404（非 403），防 slug 枚举
- **配置**：`PEEKVIEW_*` 环境变量，`__` 分隔嵌套（如 `PEEKVIEW_STORAGE__DATA_DIR`）
- **CSP**：主应用 `script-src 'self' 'unsafe-eval'`（Mermaid/d3 的 `new Function()` 必需，不可移除）。HTML render 路由返回独立宽松 CSP + `sandbox="allow-scripts allow-forms"`（无 `allow-same-origin`，iframe opaque origin 无法访问主页面凭据）
- **sibling 注入**：后端 BS4 实现（`html_render_service.py`），CSS/JS/img/favicon 内联注入。前端只传 file IDs，不 fetch 内容
- **DOMPurify**：清理 markdown 输出。Mermaid 源码不走 DOM（用 `Map` 传递）。含 `-->` 的属性会被 DOMPurify 删除
- **MCP 双模式**：`remote`（A→B→C，暴露 create_entry/get/list/delete）| `local`（A=B→C，暴露 publish_files/get/list/delete）
- **数据库**：SQLite WAL + FTS5，时间戳 timezone-aware UTC（`datetime.now(timezone.utc)`）
- **Agent 读路径**：`GET /api/v1/entries/{slug}/raw` 返回结构化 JSON（文本文件含 content；二进制 content=null + file_url）。公开免认证，私有需 API key。短链接 `/{slug}/raw` → 302 重定向
- **Playwright/Vision**：Chrome CDP `localhost:18800`，`connectOverCDP` 模式。脚本必须 `try/finally { page.close() }` + `process.exit(0)`。不要 `browser.close()`（会杀 Chrome）。截图后用 vision-helper subagent 分析
- **`make debug-verify-isolation`**：依赖生产 :8080 在线——不在线就用 `sqlite3 /tmp/peekview-debug/peekview.db "SELECT COUNT(*) FROM entries"` 手动验证
- **`make debug` E2E**：完整 E2E suite 在 CDP 模式下可能超时（>5min）。优先用自定义 Playwright 脚本逐项验证

## 测试注意事项

- **后端**：pytest 用 venv Python（`make test-quick`），conftest autouse 隔离，`factories.py` 提供测试数据构建器
- **前端单测**：vitest + jsdom 环境（`make test-frontend`）。`npm run test` 是 watch 模式会挂住 agent，禁止使用
- **前端 E2E**：Playwright（`make debug-test` 或 `E2E_SPEC=e2e/<spec>.ts make debug-test`）
- **MCP 单测**：vitest + node 环境，`fileParallelism: false`（config 测试会 mutate process.env/HOME，串行避免竞态）。`npm test` = `npm run test:unit`
- **MCP 集成/E2E**：需要 debug backend 在 `127.0.0.1:8888`，绝不能指向生产 `:8080`
- **CI 门禁**（`.github/workflows/ci.yml`）：后端 pytest + 前端 `vue-tsc --noEmit` + 前端 `npm run build` + 文档版本一致性。ruff 不在 CI

## 安全要点

- local_path 必须 allowlist + symlink 先检查再 resolve（后端拒绝 symlink，MCP 用 realpath 跟随后检查）
- `pv_` API key：HMAC-SHA256 hash 存储，最多 10 个/用户
- Entry 私有访问对非 owner 返回 404（非 403），防止 slug 枚举
- Global API key 中间件跳过 auth 端点，数据端点受保护
- FTS5 查询净化仅转义引号，复杂语法错误被 try/except 静默吞掉返回空结果

## 走 agate 工作流（非平凡任务）

**开始前必读 `docs/tasks/active-tasks.md`**，无进行中任务再启动新任务。

**启动 Task 前必须完成环境自检**：`docs/process/env-check-protocol.md`（5 项全 PASS 才进 P1）

非平凡任务走 [agate](https://github.com/randomgitsrc/agate) 工作流（规则在 `~/.agate/`）。主 Agent 只做四件事：写P0-brief、派发 subagent、验 gate、更新状态。不亲自写代码或产出。派发前为每个 subagent 写 `P{N}-dispatch-context-{role}.md`（每个角色独立文件），AGATE_CARD 用 `agate-inject-card.sh` 注入，禁止手写。

**阶段链 P0-P8（默认全走，裁剪须有理由）**：
- **P0** 主 Agent 亲自写 `P0-brief.md`：任务简报 + 环境约束 + 已知风险 + 裁剪倾向
- **P1** 需求基线：质疑需求、识别隐含依赖、BDD 验收条件（Given/When/Then）。评审不可裁（agent≠main）
- **P2** 方案设计：**不可裁剪**。`design_trivial`/`follows_existing_pattern` 可简化（1 候选方案），不可省略
- **P3** TDD 测试：默认保留，仅 risk=low 且满足以下之一时才跳：①配置类任务无可测试行为 ②≤3 行且有现成覆盖。medium/high risk 必须走 TDD 红灯
- **P4** 代码实现
- **P5** 技术验证：pytest 全绿 + 测试环境隔离正常。建议跑全量测试套件；预存失败登记到 `known-failures.md`（WARNING 级，不阻断推进）
- **P6** 验收：**不可裁剪**。BDD 逐条实跑+证据；UI 必须 Playwright 实跑+截图。`no_behavior_change` 可简化，不可省略
- **P7** 一致性检查（多文件改动时）
- **P8** 发布准备：releaser 只产出文件（不 commit/tag）；主 Agent gate 通过后亲自 bump-version + commit + tag。版本/CHANGELOG 双路径检查（暂存区或最近 5 commit，WARNING 级）

**关键约束**：
- **gate 判定**：主 Agent 亲自跑命令，绝不信 subagent 自我报告
- **gate_commands 引用 Makefile**：P2 的 `gate_commands` 建议使用 `make test-quick` / `make debug-test` 等 Makefile target，不手写裸命令。Makefile 是测试命令的唯一真相源
- **[SCOPE+]**：任何阶段发现新隐含需求 → 增补 P1 基线 + 定向回补
- **P4/P7 交叉核对**：P4 的 `[DESIGN_GAP:]` 必须在 P7 被转抄 + 配对 `[DESIGN_GAP_REVIEWED:]`
- **裁剪风险**：涉及 schema 变更/安全/多端 → P6 不可跳；「任务简单」不是合法裁剪理由
- **机制交叉**：≥2 个子系统交互/时序依赖/跨层影响的改动必须走完整 agate，不可裁剪
- **orchestrator-log 必写**：派发前写 NEXT、gate 失败写 GATE FAIL + DIAGNOSIS、subagent 失败写 SUBAGENT FAIL、流程决策写 DECISION——缺任一条视为不合规

## 详细参考

- 完整配置和规范：`CLAUDE.md`
- 前端设计系统：`DESIGN.md`
- 开发流程：`~/.agate/WORKFLOW.md`（P0-P8，需求基线+验收闭环，[agate](https://github.com/randomgitsrc/agate)）
- 预存失败登记模板：`~/.agate/assets/templates/known-failures-template.md`（P5 发现预存失败时拷贝到 `docs/tasks/{Txxx}/known-failures.md`）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 改善清单：`docs/roadmap/improvement-backlog.md`
