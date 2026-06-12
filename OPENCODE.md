# PeekView — 新会话速览

轻量级代码/文档格式化服务：Agent 通过 API/CLI/MCP 创建条目 → 浏览器查看格式化内容。

版本：Backend v0.1.55 | MCP Server v0.8.4

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
4. 前端路由：`src/router.ts`（不是 `src/router/index.ts`）
5. 发布流程必须先读 `docs/process/release.md` — 特别是 `bump-version` 后必须手动填 CHANGELOG 再 `--amend`

## 常用命令

```bash
make debug                # 构建+启动+E2E（完整调试流程）
make debug-start          # 仅启动调试服务
make debug-stop           # 停止调试服务

cd backend && make test   # 后端测试
cd frontend-v3 && npm run build   # 前端构建（自动复制到 static/）
make test-mcp-unit        # MCP 单元测试
make publish              # 发布到 PyPI（自动从 ~/.bash_env 读 token）
```

## 技术要点

- **DI 模式**：`request.app.state.entry_service`（非模块级全局变量）
- **认证**：JWT httpOnly Cookie（`peekview_token`）替代了 localStorage。优先级：`Authorization` header > Cookie > API key
- **CSP**：`script-src 'self' 'unsafe-eval'`（`unsafe-eval` 为 Mermaid/d3 的 `new Function()` 必需）
- **DOMPurify**：清理 markdown 输出。Mermaid 源码不走 DOM（用 `Map` 传递）。含 `-->` 的属性会被 DOMPurify 删除
- **Rate limit**：captcha 端点用 `rate_limit_per_minute`，login/register 用 `rate_limit_login_per_minute`。`default_limits` 兜底其他 API 端点
- **MCP 版本独立**：由 `bump-mcp-version` 管理，主线 `bump-version` 不会碰。doc-sync 脚本已移除了 MCP package.json 同步条目
- **MCP 双模式**：`remote`（A→B→C，暴露 create_entry/get/list/delete）| `local`（A=B→C，暴露 publish_files/get/list/delete）

## 发布注意事项

- `~/.bash_env` 存 `PYPI_API_TOKEN`，`make publish` 自动读取
- npm token 在 `~/.npmrc`，`make publish-npm` 直接用
- **peekview 和 peekview-mcp 版本独立**：`bump-version` vs `bump-mcp-version`
- 发布完别忘了检查 CHANGELOG.md 是否正确

## 走 workflow-v4（非平凡任务）

非平凡任务必走 v4（`docs/process/workflow-v4/`），主 Agent 派发 subagent，自己只读状态/派发/验门槛/更新状态：

- **P1 需求基线**：先质疑需求、识别隐含依赖、用 BDD（Given/When/Then）写验收条件。需求明确就自走，拿不准方向才标 `[NEED_CONFIRM]` 问人
- **P2 设计**必须声明 `packages:` `domains:` `ui_affected:`（漏 packages 会导致多包发布漏 bump）
- **任何阶段发现新隐含需求** → 标 `[SCOPE+]` → 增补 P1 基线 + 定向回补（不全重跑）
- **P6 验收**：BDD 条件逐条实跑，翻译成人话。UI 必须 Playwright 实跑+截图，不接受"代码看起来对"
- **微/小任务可裁剪**阶段，但裁剪要写理由，且 P1 需求基线（哪怕一句话）不能跳
- 开始前必读 `docs/tasks/active-tasks.md`

## 详细参考

- 完整配置和规范：`CLAUDE.md`
- 开发流程：`docs/process/workflow-v4/README.md`（P1-P8，需求基线+验收闭环）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 改善清单：`docs/roadmap/improvement-backlog.md`
