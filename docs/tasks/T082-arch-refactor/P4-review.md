---
phase: P4
task_id: T082-arch-refactor
type: review
parent: P4-implementation-backend.md
trace_id: T082-P4-20260730
status: approved
created: 2026-07-30
agent: review-lead
---

# P4 评审汇总 — T082 架构重构

## 评审来源

| 评审 | 产出文件 | agent | status | CRITICAL | BLOCKER | INFO |
|------|----------|-------|--------|----------|---------|------|
| 后端工程评审 | P4-review-eng.md | review | approved | 0 | 0 | 4 |
| 前端设计评审 | P4-review-design.md | design-review | approved | 0 | 0 | 3 |

## 汇总结论

**status: approved**

两个评审均 approved，无 CRITICAL，无 BLOCKER。全票通过。

## 后端评审摘要（P4-review-eng.md）

### 评审范围
R1 DI 统一 / R2 去重 / R3 错误格式统一 / R4 事务修复，共 10 个文件（1 新建 + 9 修改）。

### CRITICAL 检查（Pass 1）— 全部通过

- **R4 事务修复**：flush→commit 时机正确，rollback 覆盖 entry+files，磁盘清理保留。满足 BDD-14。
- **SQL 注入**：全 ORM 参数化查询，无原始 SQL 拼接。
- **竞态条件**：slug 冲突依赖 DB 唯一约束（IntegrityError catch），非 read-check-write。
- **错误处理边界**：`_record_read_async` fire-and-forget 正确，admin_service fallback 可接受。
- **PeekError 基类 details 兼容性**：向后兼容，`getattr(exc, "details", None)` 安全。
- **main.py 初始化顺序**：被依赖 service 先创建，`app.state` 赋值在所有 service 创建后。

### 实现忠实度（R1~R4 对照 P2-design.md）

| 需求 | 忠实度 | 偏差 |
|------|--------|------|
| R1 DI 统一（app.state + 构造注入） | 忠实 | 无 |
| R2 去重（_shared.py 3 函数） | 忠实 | 无 |
| R3 错误格式统一（PeekError 子类 + details） | 忠实 | 无 |
| R4 事务修复（flush→单次 commit） | 忠实 | 无 |

### DESIGN_GAP_REVIEWED（2 项，均合理）

1. `get_entry_service` 删除后更新对应测试 → 改为 `app.state.entry_service` 访问。合理。
2. R3 错误格式统一后 3 个旧测试文件 `["detail"]` → `["error"]["message"]` 同步更新。合理。

### INFORMATIONAL（4 项，均不影响正确性/安全性）

1. `files.py:_resolve_entry` share cookie 回退路径增加 1 次 DB 查询（低频路径）。
2. `entries.py:_check_share_cookie` 仍直接使用 Session（P2 明确标注不在范围内）。
3. `files.py` StorageManager import 仅用于类型注解（正确保留）。
4. `api/auth.py` 仍直接使用 Session（P2 未纳入 R1 范围）。

N+1 检查：download_file 和 get_file_content 各增加 1 次独立 Session 查询（2→3），SQLite 本地查询 <1ms，可忽略。资源泄漏：无。

## 前端评审摘要（P4-review-design.md）

### 评审范围
R5 store 拆分 / R6 EntryDetailView 拆分 / R7 错误格式兼容，共 12 新建 + 6 修改文件。

### 关键检查 — 全部 PASS

- **AI Slop**：无紫色渐变、无泛化文案、布局非模板化。
- **交互状态**：hover/focus-visible/active/loading/error/empty 全部保留迁移。
- **行数约束**：主组件 236 行（< 300），5 个子组件均 < 200 行。

### 实现忠实度（R5/R6/R7 对照 P2-design.md）

| 需求 | 忠实度 | 偏差 |
|------|--------|------|
| R5 store 拆分（2-store + loadSeq + 向后兼容包装器） | 忠实 | 无 |
| R6 组件拆分（5 子组件 + 4 composable + provide/inject） | 忠实 | +2 composable（合理，满足行数约束） |
| R7 错误格式兼容（3 处 .detail → .error.message） | 忠实 | 无 |

### 行为零回归验证

17 项行为逐条对比旧代码与新代码（zen mode、file tree toggle、TOC toggle、mobile drawer、share dialog、delete confirm、expires-in dialog、login dialog、responsive layout、scroll hide、raw link injection、copy/download/pack 等）— 全部行为等价。

### INFO（3 项，均非 BLOCKER）

1. scoped 样式与全局 CSS 重复（`.meta-tags-bar`）— 无行为影响，维护性提示。
2. `onUnmounted` 在 `onMounted` 内注册 — Vue 3 支持，功能正确。
3. `useEntryDetailComputed` 内部直接访问 store — 认知冗余，无行为影响。

### 测试验证
`make test-frontend` 1078 passed | 1 skipped，`make typecheck` pass。

## 生产环境隔离

[PROD_NOT_TOUCHED]

两个评审均确认全程未触碰 :8080 服务和 ~/.peekview/ 生产数据库。所有改动在 worktree 内，测试使用隔离环境。
