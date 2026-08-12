---
phase: P8
task_id: T067-detail-page-framework
type: release
parent: P7-consistency.md
trace_id: T067-P8-20260723
status: draft
created: 2026-07-23
agent: releaser
---

# P8 Release — T067 detail-page-framework

## bump_type

```yaml
bump_type: patch
```

理由：
- 本任务加前端功能（品牌字标+Sign in 入口+Explore 导航+zen mode 修复+reads 统一+底栏文案修正）
- 不改后端 API 契约，纯前端改动
- 无 breaking change
- 0.10.0 → 0.10.1

## 版本号变更确认

```yaml
current:
  peekview: "0.10.0"
  mcp_server: "0.9.3"
target:
  peekview: "0.10.1"
  mcp_server: "0.9.3"  # 不变，纯前端改动
```

版本文件路径（P2 packages 声明）：
- `VERSIONS.json` — 唯一版本源
- `backend/peekview/__init__.py` — `__version__`
- `backend/pyproject.toml` — `version`
- `packages/mcp-server/package.json` — 不变

## packages 声明

```yaml
packages_affected:
  - name: peekview
    bump: true
    version: "0.10.0" → "0.10.1"
    files:
      - VERSIONS.json
      - backend/peekview/__init__.py
      - backend/pyproject.toml
  - name: mcp_server
    bump: false
    reason: "纯前端改动，MCP 无变更"
```

## CHANGELOG 条目草案

以下条目应写入 CHANGELOG.md `[Unreleased]` 区域（bump 后移至 `[0.10.1]` 下）：

```markdown
## [0.10.1] - 2026-07-23

### 新增

- 详情页桌面端 header 新增品牌字标 "PeekView"（logo 旁，高度 ≤36px）(T067)
- 详情页桌面端 header 新增 Sign in 按钮（匿名用户可见，点击弹出 LoginDialog，登录后响应式消失）(T067)
- 详情页桌面端 header 新增 Explore 导航按钮（Compass icon + tooltip，指向 /explore）(T067)
- 详情页移动端 sticky-header 新增品牌字标 + Sign in 入口（≤380px 切换为 icon-only）(T067)
- 详情页移动端 bottom-bar 新增 Explore 入口 (T067)
- 首页 Sign in 按钮视觉权重提升：btn-ghost → BaseButton variant=primary，≤380px 不再消失 (T067)

### 修复

- 详情页 zen mode 未隐藏移动端 sticky-header 和 bottom-bar（新增 v-show + CSS 规则）(T067)
- 详情页移动端 reads 计数格式不统一：改为条件复数 + readStats 为 null 时不显示 (T067)
- 详情页移动端底栏文案 "Files N" 改为 "N files"（数量在前，files 小写）(T067)
```

## 发布检查命令

```bash
# P2 gate_commands.P5
make test-frontend && make typecheck

# P2 gate_commands.P5_e2e
E2E_SPEC=e2e/detail-framework.spec.ts make debug-test

# lint
make lint

# 后端回归（纯前端改动，但确认无破坏）
make test-quick
```

## 临时资源清单

```yaml
temporary_resources:
  - type: process
    name: debug-backend
    detail: "make debug-start 启动的 :8888 调试服务"
    cleanup: "make debug-stop"
  - type: data
    name: debug-database
    detail: "/tmp/peekview-debug/peekview.db"
    cleanup: "make debug-stop 自动清理"
  - type: data
    name: debug-storage
    detail: "/tmp/peekview-debug/data/"
    cleanup: "make debug-stop 自动清理"
```

## 主 Agent 交接事项

1. **bump-version**：`make bump-version NEW_VERSION=0.10.1`
2. **CHANGELOG**：将上述条目从 `[Unreleased]` 移至 `[0.10.1]` 下
3. **commit**：`git add CHANGELOG.md && git commit --amend --no-edit`（合并到 bump commit）
4. **P5 重跑**：`make test-frontend && make typecheck && make test-quick`
5. **tag**：`git tag v0.10.1`
6. **READY 收尾检查**：确认 debug 服务已停止、临时数据已清理、git 工作区干净
