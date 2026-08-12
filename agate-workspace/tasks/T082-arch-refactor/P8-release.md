---
phase: P8
task_id: T082-arch-refactor
type: release
parent: P7-consistency.md
trace_id: T082-P8-20260730
status: draft
created: 2026-07-30
agent: implementer
---

# P8 发布准备 — T082 架构重构

## 1. bump_type

```yaml
bump_type: patch
```

**理由**：T082 是修 bug + 内部重构，不改 API 行为的语义。错误格式统一化（HTTPException → PeekError）是修 bug 方向——使所有端点返回统一格式，前端同步更新读取路径。DI 统一、去重、事务修复、store 拆分、component 拆分均为纯结构重构，行为零回归。无新功能、无 API 契约变更、无数据库 schema 变更。符合语义化版本 patch 判定。

## 2. 版本号变更确认

| 包 | 旧版本 | 新版本 | 是否 bump |
|----|--------|--------|-----------|
| peekview | 0.12.0 | 0.12.1 | 是 |
| mcp_server | 0.10.0 | 0.10.0 | 否（不改） |

**P2 packages 声明**：`[backend, frontend]`（P2-design.md:17-19）。frontend 不是独立版本包，版本源是 VERSIONS.json 的 `peekview` 字段。MCP server 不改（P0-brief.md:54 约束），不 bump `mcp_server` 版本。

**版本变更执行**：主 Agent 在 P8 gate 通过后执行 `make bump-version NEW_VERSION=0.12.1`（VERSIONS.json + 同步所有文件 + commit + tag）。本 subagent 不执行 bump-version。

## 3. CHANGELOG 更新确认

**已更新**：CHANGELOG.md

- `[Unreleased]` → `[0.12.1] - 2026-07-30`
- 在 `[0.12.1]` 下记录 6 项重构（### 重构）+ 1 项修复（### 修复）
- 保留空 `[Unreleased]` 节在 `[0.12.1]` 之前（供下一周期使用）

**CHANGELOG 内容摘要**：

### 重构
1. 后端 DI 统一：三种模式 → `request.app.state.*` + 构造注入 (T082)
2. 后端去重：3 函数 7 份副本 → `api/_shared.py` 单一定义点 (T082)
3. 后端错误格式统一：7 处 HTTPException → PeekError 子类 (T082)
4. 后端事务修复：commit → flush，文件写入失败时 entry row 回滚 (T082)
5. 前端 store 拆分：entry.ts → entryList.ts + entryDetail.ts (T082)
6. 前端 EntryDetailView 拆分：1003 行 → 主组件+5 子组件+4 composable (T082)

### 修复
7. 前端错误格式兼容：3 处 .detail → .error.message (T082)

## 4. 发布检查命令

从 P2-design.md `gate_commands` 读取（P2-design.md:31-34）：

| 命令 | 用途 | P5 结果 | P8 重跑 |
|------|------|---------|---------|
| `make test-quick` | 后端测试 | 0 (985 passed) | 主 Agent gate 验证时重跑 |
| `make test-frontend` | 前端测试 | 0 (1078 passed) | 主 Agent gate 验证时重跑 |
| `make typecheck` | 类型检查 | 0 | 主 Agent gate 验证时重跑 |
| `make lint` | lint | 0 | 主 Agent gate 验证时重跑 |

> P8 subagent 不执行发布检查命令（反馈循环长的脚本验证任务，只写不跑——主 Agent 会跑）。P5 已确认 4 个 gate_commands 全绿（P7-consistency.md:84-87）。

## 5. 临时资源清单

[PROD_NOT_TOUCHED] 全程不触碰 :8080 服务和 ~/.peekview/ 生产数据库。

### 临时服务/进程
- 无（P8 subagent 未启动任何临时服务或进程）

### 临时数据
- 无（P8 subagent 未创建测试数据库或临时文件目录）

### 开发安装
- 无（P8 subagent 未执行任何 editable install 或全局包安装）

### 工作区状态
- T082 代码改动已提交在 `59ab6f7e`（wf(T082-P4): 实现 6 项重构）
- 未提交变更：二进制 zip 测试文件（test artifacts，非 T082 代码）+ node_modules 元数据 + .state.yaml
- CHANGELOG.md 已修改（本次 P8 产出）
- P8-release.md（本次产出）

## 6. 发布流程（主 Agent 执行）

P8 gate 验证通过后，主 Agent 执行以下步骤（AGENTS.md 发布流程）：

```bash
# 1. bump 版本（VERSIONS.json + 同步所有文件 + commit + tag）
make bump-version NEW_VERSION=0.12.1

# 2. CHANGELOG 已在 bump 前 updated（本次 P8 产出），bump 后确认
#    注意：bump-version 会 amend commit，CHANGELOG 改动需在 amend 前暂存

# 3. 快速检查
make pre-publish-quick

# 4. 发布 PyPI
make publish

# 5. 推送代码 + tag
git push && git push origin v0.12.1

# 6. 升级生产（⚠️ 人工）
pipx upgrade peekview && sudo systemctl restart peekview
```

> MCP server 不发布（版本不变）。

## 7. Lessons Learned

1. **架构重构应先统一 DI 再去重**：T082 后端 R1（DI 统一）是 R2（去重）和 R3（错误格式统一）的前置——DI 统一后认证链路集中，共享模块位置确定，错误替换点清晰。如果先去重再统一 DI，共享函数的 import 路径会随 DI 改动而反复调整。
2. **PeekError details 字段扩展需向后兼容**：扩展基类 `__init__` 加 `details` 参数时，已有子类（PayloadTooLargeError/SchemaMismatchError）的 `super().__init__(message)` 调用不传 details，默认 None，向后兼容。避免在基类扩展时破坏已有子类。
3. **Pinia store 拆分的跨 store 协调**：toggleVisibility/deleteEntry 同时操作 list + detail 状态，通过 Pinia action 内引用（`useEntryDetailStore()` 获取 detail store 实例）实现协调，view 层无需感知跨 store 逻辑。syncVisibility 内部检查 slug 匹配，安全处理 detail store 无 currentEntry 的情况。
