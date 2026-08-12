---
phase: P1
task_id: T009
parent: P0-brief.md
trace_id: T009-P1-20260615
P1_simplified: true
---

## 需求复述

在 main.py 的 `create_app()` 中添加 `/{slug}/raw` 路由，302 redirect 到 `/api/v1/entries/{slug}/raw`。

## 隐含需求识别

逐维度过检：

- **数据**：无。不涉及数据模型变更或迁移。
- **前端**：无。短链接是服务端 redirect，前端无改动。
- **多端**：MCP `get_entry` 返回的 `raw_url` 当前是 `/api/v1/entries/{slug}/raw`，raw-shortlink.md 提到"换不换都行"。本任务不改 MCP，保持现状。若未来需要短链接 raw_url，另开任务。
- **边界**：
  1. slug 不存在时，redirect 目标 `/api/v1/entries/{slug}/raw` 会返回 404，行为正确，无需额外处理。
  2. 私有 entry 的 `/{slug}/raw` redirect 后，目标路由自行处理认证（返回 401/404），无需短链接路由额外鉴权。
  3. `/{slug}/raw` 路由注册位置必须在 `_setup_static_files(app)` 之前，否则被 SPA catch-all `/{path:path}` 吞掉（P0-brief 已识别）。
- **兼容**：不破坏现有行为。`/api/v1/entries/{slug}/raw` 不变，仅新增一条 redirect 路由。

## BDD 验收条件

### AC1: 公开 entry 短链接 redirect 到 raw API

```gherkin
Given 一个公开 entry 的 slug 为 "abc123"
When GET /abc123/raw
Then 返回 302 状态码
And Location header 为 "/api/v1/entries/abc123/raw"
```

### AC2: 不存在的 slug 短链接仍 redirect（由目标路由返回 404）

```gherkin
Given 不存在 slug 为 "noexist"
When GET /noexist/raw
Then 返回 302 状态码
And Location header 为 "/api/v1/entries/noexist/raw"
```

> 注：redirect 路由不做 slug 存在性检查，由目标路由处理 404。这避免了短链接路由对数据库的依赖，保持零耦合。

### AC3: 私有 entry 短链接 redirect 后目标路由处理认证

```gherkin
Given 一个私有 entry 的 slug 为 "priv01"
When 未认证 GET /priv01/raw
Then 返回 302 状态码
And Location header 为 "/api/v1/entries/priv01/raw"
And 跟随 redirect 后目标路由返回 401 或 404
```

## 待确认清单

无。方案已在 raw-shortlink.md 中完全确定，MCP raw_url 保持现状不做改动。

## 裁剪说明

```yaml
phases: [P1, P4, P5, P8]
```

- **P2 跳过**：方案已在 raw-shortlink.md 中完全确定（302 redirect），无设计空间。
- **P3 跳过**：改动 ≤ 5 行（1 条路由 + 1 个测试），测试在 P4 实现时同步编写。
- **P6 跳过**：BDD 条件可通过 pytest 直接验证，无需 Playwright 截图；无 UI 变更。
- **P7 跳过**：仅改 1 个文件（main.py）+ 1 个测试文件，无多文件一致性风险。

## 范围声明

```yaml
packages:
  - peekview (backend)
domains:
  - backend/api
  - backend/tests
```

## 能力需求声明

```yaml
capability_requirements: []
```
