---
phase: P4
generated_by: 主 Agent
task_id: T082-arch-refactor
role: implement-review
date: 2026-07-30
---

# T082 实施评审 dispatch-context

## 目标
对 T082 架构重构的已落地代码做独立实施评审。不只看"测试通过"（P5/P6 已验），而是从工程实质角度审查：6 项重构是否真正改善了架构、有没有形式主义（改名不改善）、有没有引入新的结构债、有没有遗漏的边界。

## 约束
- 只审不改——产出评审意见，不碰代码
- 后端 4 项（R1 DI 统一 / R2 去重 / R3 错误格式 / R4 事务修复）
- 前端 2 项（R5 store 拆分 / R6 EntryDetailView 拆分）+ R7 错误格式兼容
- 用 git diff 查看改动，直接读改后代码验证实质

## 审查维度

### R1 DI 统一
- app.state 初始化是否正确注入跨 service 实例（main.py init）
- 构造函数签名变更后，所有实例化点是否已更新
- files.py 是否彻底消除了路由内 StorageManager + Session 手建
- get_entry_service 函数是否已删除或妥善处理

### R2 去重
- _shared.py 中的函数是否与原定义行为一致
- 所有 import 是否已更新为从 _shared.py 导入
- 是否有遗漏的副本

### R3 错误格式统一
- ParameterValidationError(422) 是否只用于 entries.py status 验证
- ValidationError(400) 是否保持不变（9 处 raise 不受影响）
- PeekError details 字段扩展是否正确
- peek_error_handler 是否输出 details
- main.py 基础设施层 HTTPException 是否合理保留

### R4 事务修复
- flush → commit 顺序是否正确
- 文件写入失败时 rollback 是否覆盖 entry row
- 磁盘文件清理逻辑是否保留
- FTS 更新时机是否不受影响

### R5 store 拆分
- entryList.ts / entryDetail.ts 职责是否清晰
- 跨 store 协调（toggleVisibility/deleteEntry）是否正确实现 Pinia action 内引用
- loadSeq 竞态防护是否保留
- entry.ts 是否已删除或改为 re-export

### R6 EntryDetailView 拆分
- 主组件行数 < 300
- 子组件 props/emit 契约是否忠实 P2 设计
- zen mode / file tree / TOC / share dialog 行为是否保留
- provide/inject 是否正确实现

### R7 错误格式兼容
- 3 处 .detail → .error.message 是否正确
- 有无遗漏的 .detail 读取

## 输入
- git diff 5ae03d5d..HEAD -- backend/peekview/ frontend-v3/src/（代码改动）
- docs/tasks/T082-arch-refactor/P2-design.md（方案设计）
- docs/tasks/T082-arch-refactor/P4-implementation-backend.md
- docs/tasks/T082-arch-refactor/P4-implementation-frontend.md
- docs/tasks/T082-arch-refactor/P4-review-eng.md（之前 eng review）
- docs/tasks/T082-arch-refactor/P4-review-design.md（之前 design review）
