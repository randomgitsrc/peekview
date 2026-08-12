---
phase: P0
task_id: TPV0077
task_name: timeline-mvp
type: brief
trace_id: TPV0077-P0-20260728
created: 2026-07-28
status: draft
parent: 跨 Agent 信息同步需求 + 时间线方案论证
---

## 任务简述

为 PeekView 新增项目时间线（Timeline）最小可用能力：entry 归属到项目，Agent 通过 `listEntries(project=xxx)` 读取项目演进脉络，等价于 `git log`。

详细论证见 `docs/converse/agents/` 目录下的时间线方案论证文档（已发 PeekView）。

## 背景痛点

1. **离散无脉络**：同一件事的多次产出散落在 entry 列表里，看不出演进过程
2. **跨 Agent 信息断层**：Agent B 想知道 Agent A 最近在做什么，只能逐个 listEntries + 人肉判断
3. **Agent 缺少 git log 级信息同步**：无法快速获取"某件事进展到哪了、最近有什么新产出"

## 任务范围

### A. 后端数据模型

1. **timelines 表**：
   - `slug` (string, PK) — 全局唯一标识，如 `login-refactor`
   - `summary` (string, nullable) — 可选描述
   - `created_at` (datetime, UTC)
   - `updated_at` (datetime, UTC)

2. **entry 表新增字段**：
   - `project_slug` (string, nullable, indexed, FK→timelines.slug)

3. **自动创建逻辑**：首次引用不存在的 project slug 时，自动创建 timeline 记录

### B. MCP project 推断

`publish_files` 调用时自动推断 project 归属：

```
推断优先级：
1. Agent 显式指定 project="xxx"    → 用指定的
2. cwd 下有 .git 且有 remote origin → 用 repo name（如 "org/login-refactor"）
3. cwd basename 是合法名            → 用 cwd basename（如 "login-refactor"）
4. 无锚点                           → project=null
```

**合法名判断**：排除 `tmp`, `home`, `root`, `var`, `etc`, `opt`, `usr`, `srv` 等系统目录名，以及单字符名和 `/` 根路径。

**git remote 提取**：读取 `.git/config` 的 `[remote "origin"]` URL，取 repo name 部分。失败时降级到 cwd basename。

### C. MCP 参数扩展

1. **publish_files**：新增可选 `project` 参数（string），覆盖自动推断
2. **listEntries**：新增可选 `project` 参数（string），按 timeline 过滤，返回按 created_at 排序的 entry 列表

### D. API 扩展

1. **GET /api/v1/entries?project=xxx**：按 project_slug 过滤
2. **GET /api/v1/timelines**：列出所有 timeline（slug + summary + entry count + last entry time）
3. **GET /api/v1/timelines/{slug}**：timeline 详情 + entry 统计

### E. CLI 扩展

1. **peekview list --project xxx**：按 timeline 过滤
2. **peekview timelines**：列出所有 timeline

## 不做

- **前端时间线视图** — Phase 2，Agent 通过 MCP 读即可
- **文件版本保留** — 和 timeline 正交，独立决策（见 roadmap）
- **Timeline 嵌套**（project → 多条 timeline）— 等单层 timeline 验证
- **Entry tag 标签**（code/design/discussion 分类）— 不做，summary 自然包含
- **行级 diff** — 和 git 功能重叠
- **Timeline 生命周期管理**（完成/关闭）— 不做

## 环境约束

- 后端：SQLModel + SQLite，entry 表加字段 + 新建 timelines 表
- MCP：Node.js/TypeScript，publish_files 推断逻辑 + listEntries 过滤参数
- 前端：无改动（Phase 1 不做 UI）
- git remote 读取：MCP Server 本地文件系统读取 `.git/config`，不依赖 git CLI

## 已知风险

- risk=medium：新增数据模型 + MCP 推断逻辑，但不改现有行为
- **同名冲突**：两个无关项目的 cwd basename 相同会错误聚合。有 git remote 时几乎不会撞（repo name 含 org 前缀）；无 git 时接受低概率冲突，人通过前端修正
- **核心假设待验证**：Agent 是否真的读 `listEntries(project=xxx)`？如果不读，timeline 是死数据。MVP 做完观察使用数据
- **推断不准**：Agent 在 `/tmp/` 或 `~/` 下工作时归属不明 → project=null → 不硬凑
- **timelines 表膨胀**：每次新 project slug 自动创建，可能有大量只用一次的 timeline。后续可加清理逻辑（entry_count=0 且超过 N 天的 timeline 自动删除）

## 验证标准

- `publish_files` 不传 project → 自动推断（git remote 或 cwd basename）
- `publish_files` 传 project="xxx" → 用传入值
- 同一 project slug 的多个 entry → `listEntries(project=xxx)` 返回按时间排序
- 不存在的 project slug → 首次 publish 自动创建 timeline
- `/tmp/` 下发布 → project=null（归属不明）
- `GET /api/v1/timelines` → 列出所有 timeline 及 entry- [ ]统计
- CLI `peekview timelines` → 列出 timeline
- 后端测试全绿
- MCP 单元测试全绿
- `make typecheck` 通过
- `make lint` 通过
