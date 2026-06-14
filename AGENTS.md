# PeekView

轻量级代码/文档格式化服务：Agent 通过 API/CLI/MCP 创建条目 → 浏览器查看格式化内容。

版本：Backend v0.1.58 | MCP Server v0.8.5

## 架构

| 组件 | 路径 | 栈 |
|------|------|----|
| Backend | `backend/peekview/` | FastAPI + SQLite (WAL+FTS5) |
| Frontend | `frontend-v3/` | Vue 3 + Vite + TypeScript + Shiki |
| MCP Server | `packages/mcp-server/` | Node.js/TS + Streamable HTTP |

## 铁律（违反必出事）

1. **严禁** `uvicorn` 直接启动。用 `make debug`（`127.0.0.1:8888`，独立数据目录 `/tmp/peekview-debug/`）
2. **严禁** 停止/触碰用户的 pipx 正式服务（`:8080`）
3. **严禁** 跑会触碰真实 `~/.peekview/` 的测试；MCP/E2E 测试必须用临时 HOME 或 debug backend
4. **严禁** 对生产数据库做任何写操作（包括 DELETE、UPDATE）除非用户明确要求，且必须先备份再操作
5. 前端路由：`src/router.ts`（不是 `src/router/index.ts`）
6. 发布流程必须先读 `docs/process/release.md` — 特别是 `bump-version` 后必须手动填 CHANGELOG 再 `--amend`
7. 改代码前先读周围上下文，理解代码风格和现有库选择
8. 不加注释（除非被要求）
9. 完成任务后必须跑 lint/typecheck

## 环境隔离机制（代码层面保障）

- **`PEEKVIEW_DEBUG_MODE=1`**：所有 `PeekConfig()` 无参调用自动隔离到 `/tmp/peekview-debug/`，captcha 自动禁用。pytest 通过 conftest fixture 自动设置。
- **pytest 全局隔离**：`conftest.py` 的 `isolate_config_file` fixture 自动设置 `PEEKVIEW_STORAGE__*` env vars，所有 `PeekConfig()` 无参调用在测试中自动指向 tmp_path。
- **不再有生产路径警告**（v0.1.58 移除）：CLI 命令操作生产数据是正常行为，不需要警告。隔离靠代码强制（conftest + debug mode），不靠人看到警告。

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

## 运行时注意

- **Python 命令是 `python3`**，不是 `python`（本机无 `python`）
- **测试用 `python3 -m pytest`**，不要用 `pip install` 装全局 pytest
- **生产数据库**：`~/.peekview/peekview.db`，**调试数据库**：`/tmp/peekview-debug/peekview.db`
- **发布 token**：PyPI 在 `~/.bash_env`，npm 在 `~/.npmrc`，`make publish` 自动读取，不需要手动 export

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

## 走 workflow-v4（非平凡任务）

非平凡任务必走 v4（`docs/process/workflow-v4/`），主 Agent 派发 subagent，自己只读状态/派发/验门槛/更新状态：

- **P1 需求基线**：先质疑需求、识别隐含依赖、用 BDD（Given/When/Then）写验收条件。需求明确就自走，拿不准方向才标 `[NEED_CONFIRM]` 问人
- **P2 设计**必须声明 `packages:` `domains:` `ui_affected:`（漏 packages 会导致多包发布漏 bump）
- **任何阶段发现新隐含需求** → 标 `[SCOPE+]` → 增补 P1 基线 + 定向回补（不全重跑）
- **P6 验收**：BDD 条件逐条实跑，翻译成人话。UI 必须 Playwright 实跑+截图，不接受"代码看起来对"
- **gate 判定**：主 Agent 亲自跑命令，绝不信 subagent 自我报告
- **微/小任务可裁剪**阶段，但裁剪要写理由，且 P1 需求基线（哪怕一句话）不能跳
- 开始前必读 `docs/tasks/active-tasks.md`

## 详细参考

- 完整配置和规范：`CLAUDE.md`
- 开发流程：`docs/process/workflow-v4/README.md`（P1-P8，需求基线+验收闭环）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 管理能力计划：`docs/plans/admin-capability-improvements.md`
- 改善清单：`docs/roadmap/improvement-backlog.md`
