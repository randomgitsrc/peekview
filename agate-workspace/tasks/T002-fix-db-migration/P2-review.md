---
phase: P2
task_id: T002
task_name: fix-db-migration
type: review
trace_id: T002-P2-20250611-review
created: 2026-06-11
status: approved
parent: T002/P2-design.md
---

# P2：方案评审记录 — 数据库迁移机制修复

## 评审基本信息

| 项目 | 说明 |
|------|------|
| 评审日期 | 2026-06-11 |
| 评审来源 | `docs/reviews/expert-review-T002-db-migration-2026-06-11.md` |
| 评审团 | 技术评审 + 安全评审 + 标准化评审 |
| 设计方案 | `T002/P2-design.md`（已按评审意见修订） |

## 评审结论：✅ 通过

整体评分 **8.2/10**。2 个阻塞项已修复，方案可进入 P3 实现。

## 阻塞修复记录

| ID | 发现 | 严重度 | 修复状态 |
|----|------|--------|----------|
| 1 | `SchemaMismatchError` 继承 `PeekError` 而非 `Exception` | 🔴 高危 | ✅ 已修复（设计文档 §3.1） |
| 3 | `check_schema()` 需跳过未创建的表和虚拟表 | 🟡 中危 | ✅ 已修复（设计文档 §3.1） |

## 建议采纳记录

| ID | 建议 | 处理 |
|----|------|------|
| 2 | 确认 `get_engine()` 调用点不受影响 | ✅ 核查完成，设计文档已追加调用链分析 |
| 4 | 函数名替代行号引用 | ✅ 已修复 |
| 5 | 记录三重 `init_db` 调用链 | ✅ 已追加到设计文档 §3.2 |
| 8 | 错误消息覆盖非 service 启动方式 | ✅ 已追加 "or restart peekview serve" |

## 进入 P3 条件

- [x] 阻塞项全部修复
- [x] 建议项全部处理
- [x] 设计方案更新完成
- [ ] **PM 最终确认通过**
