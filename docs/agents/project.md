# PeekView — project.md（orchestrator 专属操作细节）

> 本项目 orchestrator 专属的操作性事实来源，与面向所有贡献者的 AGENTS.md/CLAUDE.md 分开。
> orchestrator 通过符号链接使用 `~/.agate/orchestrator-template.md`，本文件是唯一应编辑的项目侧文件。

## agate_root / project_root

```
agate_root: /home/kity/oclab/agate/agate
project_root: /home/kity/oclab/peekview
```

## 工作区/环境约束

- 调试环境命令：`make debug`（127.0.0.1:8888，独立数据目录 `/tmp/peekview-debug/`）
- 生产环境路径：严禁直接操作 :8080 生产服务与 `~/.peekview/` 下的生产数据
- 主要包：peekview（PyPI）+ @peekview/mcp-server（npm），版本独立管理（VERSIONS.json 是唯一版本源）
- 长耗时命令（make bump-version/build/publish/debug）必须设 `timeout: 300000`（5 分钟）

## Gate / 测试命令

- `make test-quick`：后端 pytest（用 venv，自动检查 venv 过期）
- `make test-frontend`：前端 vitest 单测（非 watch 模式）
- `make lint`：ruff（不在 venv，用系统 python3）
- `make typecheck`：前端 `vue-tsc --noEmit`（CI 强制）
- `make test-mcp-unit`：MCP 单元测试
- `make debug-test`：Playwright E2E（需先 `make debug-start`；CDP 模式可能超时，优先自定义脚本逐项验证）
- 测试基线：后端 pytest 全绿（当前 ~1068 passed），前端 vitest 全绿（当前 ~1215），lint 0 error，typecheck 通过
- **gate_commands 必须引用 Makefile target，不手写裸命令**（Makefile 是测试命令的唯一真相源）

## 发布约定

- 版本号：语义化（semver），VERSIONS.json 为唯一版本源，`make bump-version NEW_VERSION=x.y.z` 同步所有文件 + commit + tag
- 发布后必须填 CHANGELOG：将 [Unreleased] 移到 [x.y.z] 下，然后 `git commit --amend --no-edit`
- `make publish`（PyPI，token 从 ~/.bash_env 读）+ `make publish-npm`（npm，token 从 ~/.npmrc 读）
- MCP 独立发布：`make bump-mcp-version NEW_MCP_VERSION=x.y.z`
- 升级生产必须人工：`pipx upgrade peekview && sudo systemctl restart peekview`
- 发版检查：`make pre-publish-quick`（快速）或 `make pre-publish`（CI 级，~5-10 min）

## 其他 orchestrator 需要知道但不适合写进 AGENTS.md 的事

- **不跑「完整 `make debug`」的 E2E 全量**：CDP 模式下可能超时（>5min），优先用自定义 Playwright 脚本逐项验证，或用 `make debug-quick`（build-fast + start + seed，~20s，跳过 E2E/MCP/clean）
- **Playwright/Vision**：Chrome CDP `localhost:18800`（connectOverCDP 模式），脚本必须 `try/finally { page.close() }` + `process.exit(0)`，不要 `browser.close()`（会杀 Chrome）；截图后用 vision-engine skill 分析
- **前端 URL 路径是 `/:slug`，不是 `/entries/:slug`**（此错误反复导致 Playwright 验证失败）
- **不跑 `npm run dev`**（vite :5173 代理到 :8080 生产 backend，会读写生产数据）
- **`make debug-verify-isolation` 依赖生产 :8080 在线**——不在线就用 `sqlite3 /tmp/peekview-debug/peekview.db "SELECT COUNT(*) FROM entries"` 手动验证
- **`npm run test` 是 watch 模式会挂住 agent，禁止使用**；用 `make test-frontend`
- 环境自检：启动 Task 前必须跑 `docs/process/env-check-protocol.md`（5 项全 PASS 才进 P1）
- 预存失败登记：P5 发现预存失败时拷贝 `~/.agate/assets/templates/known-failures-template.md` 到 `docs/tasks/{Txxx}/known-failures.md`
