---
phase: P8
task_id: T076-entry-card-interaction
type: release
parent: P7-consistency.md
trace_id: T076-P8-20260730
status: draft
created: 2026-07-30
agent: implementer
---

## bump_type

bump_type: minor

判定理由：T076 含新用户可见功能（BaseTag 可点击跳转 /explore?tags={tag}、Explore 页 URL ?tags= 过滤 + FilterChip、tag-overflow +N tooltip），均为向后兼容的功能新增。按 semver 规则，新增功能（不破坏现有 API/行为）→ minor。复核 CHANGELOG 历史：0.10.0（新增原生 `<a>` 链接 + 骨架屏）、0.11.0 均为功能新增 → minor bump，风格一致。

## 版本号变更

| 包 | 旧版本 | 新版本 | 说明 |
|---|---|---|---|
| peekview | 0.11.2 | 0.12.0 | 前端构建打包进 peekview 后端包（static/），bump peekview |
| mcp_server | 0.10.0 | 0.10.0（不变） | T076 纯前端改动，MCP 无变更 |

主 Agent 执行：`make bump-version NEW_VERSION=0.12.0`

## CHANGELOG 更新确认

[Unreleased] 已追加 T076 条目（保留现有 T074 + ruff lint 条目），按 Keep a Changelog 分类：

### 新增

- BaseTag 可点击跳转 `/explore?tags={tag}` 过滤页 (T076)
- Explore 页 URL `?tags=` 过滤 + 可移除 FilterChip 指示 (T076)
- tag-overflow +N tooltip（hover/tap 显示全部 tags）(T076)

### 变更

- EntryCard/EntryListRow card-body `<a>` 拆分为 `<div>`，title/username/tag 各自独立 `<a>`，修复右键复制链接混乱 + hover 全下划线 (T076)

### 修复（现有条目，随本次发布）

- Account Settings 清空 display_name 时 PATCH 发送 `null` 而非空字符串，与后端语义一致 (T074)
- 修复 ruff lint 残留：cli.py N806 noqa 位置错误 + scripts/ import 排序

bump 后主 Agent 将 [Unreleased] → [0.12.0] 并 `git commit --amend --no-edit`。

## 临时资源清单

供主 Agent READY 收尾清理：

| 资源 | 清理方式 |
|---|---|
| debug backend http://127.0.0.1:8888（PID 282214） | `make debug-stop`（停止 + 清理 /tmp/peekview-debug/） |
| 隔离 DB /tmp/peekview-debug/ | debug-stop 自动清理 |
| 临时脚本 /tmp/opencode/*.ts + /tmp/e2e-results/ | 可删 |
| CDP Chrome :18800 | 外部环境，非本任务启动，不清理 |
| 开发安装 | 无（未 pip install / npm link） |

## Lessons Learned

- **card `<a>` 嵌套问题**：整行 `<a>` 包裹多个可点击子元素（title/username/tag）导致右键复制链接混乱和 hover 全下划线。正确做法是外层用 `<div>`，各可点击元素独立 `<a>` + `@click.prevent` + `router.push` 实现 SPA 导航，同时保留真实 href 供右键菜单。
- **CSS-only tooltip 移动端**：`::after { content: attr(data-tags) }` + `:hover`/`:focus` 触发，移动端 tap 触发 focus 显示 tooltip，无需 JS 事件监听。

## [PROD_NOT_TOUCHED]

全程使用隔离 DB（/tmp/peekview-debug/），未触碰生产 :8080 或 ~/.peekview/。
