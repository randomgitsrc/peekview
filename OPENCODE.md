# PeekView — opencode 项目概要

轻量级代码/文档格式化服务：Agent/CLI 创建条目 → 浏览器查看。

## 三组件速览

| 组件 | 路径 | 栈 |
|------|------|----|
| Backend | `backend/peekview/` | FastAPI + SQLite (WAL+FTS5) |
| Frontend | `frontend-v3/` | Vue 3 + Vite + TypeScript + Shiki |
| MCP Server | `packages/mcp-server/` | Node.js/TS + Streamable HTTP |

## 核心规则（新会话必读）

- **严禁** `uvicorn` 直接启动 — 用 `make debug`（port 8888，独立数据目录 `/tmp/peekview-debug/`）
- **严禁** 停止用户的 pipx 正式服务（port 8080）
- 前端路由在 `src/router.ts`（不是 `src/router/index.ts`）
- DI 模式：`request.app.state.entry_service`（无模块级全局变量）

## 常用命令

| 命令 | 用途 |
|------|------|
| `make debug` | 一键构建+启动+E2E 测试 |
| `make debug-start` / `make debug-stop` | 启停调试服务 |
| `make test` (from `backend/`) | 后端 pytest |
| `npm run build` (from `frontend-v3/`) | 前端构建并复制到 static |
| `make test-mcp-unit` | MCP 单元测试（临时 HOME，无需后端） |

## 关键文档

- 开发流程：`docs/process/workflow.md`（P0-P5 检查点驱动）
- 调试流程：`docs/process/debug-workflow.md`
- 发布流程：`docs/process/release.md`
- 完整配置：`CLAUDE.md` 见 PEEKVIEW_* 环境变量表
