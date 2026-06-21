---
phase: P0
task_id: T017
task_name: theme-media-query-fix
type: brief
trace_id: T017-P0-2026-06-21
created: 2026-06-21
status: ready
parent: 用户报告主题切换 bug
---

# P0 Brief：主题切换 @media 冲突修复

## 任务简报

修复 github-markdown-css v5.9.0 的 `@media (prefers-color-scheme: dark)` 越权问题——它绕过 PeekView 的 `data-theme` 控制，导致系统黑夜时用户切 light 模式内容区仍为黑色。

## executor_env

```yaml
platform: opencode
has_task_tool: true
has_local_runtime: true
network: full
```

## env_constraints.debug_env

- 调试服务：`make debug`（127.0.0.1:8888，CSP `script-src 'self' 'unsafe-eval'`）
- 前端构建：`cd frontend-v3 && npm run build`
- 前端测试：`cd frontend-v3 && npx vitest run`
- Playwright 验证：连本地 Chrome CDP `:18800`，`page.emulateMedia({ colorScheme: 'dark' })` 模拟系统黑夜
- 严禁直接 uvicorn，严禁触碰 `~/.peekview/`

## known_risks

- github-markdown-css 升级时 patch 可能丢失（升级流程需文档化）
- Shiki 代码高亮 / PlantUML / Mermaid 的主题跟随需同步验证
- CSS 变量覆盖不完整可能导致部分元素仍割裂

## pruning_tendency

保守——涉及 UI 主题切换，P6 必须 Playwright 实测系统黑夜场景。但 P2 方案已明确（patch @media），可跳；P7 单文件改动可跳。

## phase_hint

[P1, P3, P4, P5, P6, P8] — 跳过 P2（方案明确）、P7（单文件改动无多文件一致性风险）

## 关键技术决策（方案 A 已定）

patch `frontend-v3/public/css/github-markdown.css`：
- `@media (prefers-color-scheme:dark){.markdown-body,[data-theme=dark]{...}}` → `[data-theme=dark] .markdown-body{...}`（去 @media 包裹，去 .markdown-body 裸选择器）
- `@media (prefers-color-scheme:light){.markdown-body,[data-theme=light]{...}}` → `.markdown-body{...}`（light 作默认）+ `[data-theme=light] .markdown-body{...}`（显式 light 防系统黑夜时拿不到）

## gate_commands

- `cd frontend-v3 && npm run build` — 构建含 typecheck
- `cd frontend-v3 && npx vitest run` — 前端测试
- `make debug` + Playwright `emulateMedia({colorScheme:'dark'})` + vision — 真实 CSP 下系统黑夜场景验证
