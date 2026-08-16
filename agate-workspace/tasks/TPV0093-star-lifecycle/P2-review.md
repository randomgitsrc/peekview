---
phase: P2
task_id: TPV0093-star-lifecycle
type: review
parent: P2-review-eng.md
trace_id: TPV0093-P2-20260816-summary
status: approved
created: 2026-08-16
agent: review-lead
---

# P2 方案设计专家组评审汇总 — TPV0093 star-lifecycle

## 专家组结论

**status: approved（全票无 BLOCKER）**

两名评审专家（plan-eng-review、plan-design-review）均对 `P2-design.md` 修订版给出 **approved**，无 BLOCKER、无分歧。汇总确认通过，P2 闭合，可推进 P3。

`[PROD_NOT_TOUCHED]` 本阶段仅只读文档汇总，未跑测试、未修改任何源码，未触碰生产/调试数据。

## 1. 专家意见汇总

| 专家 | 评审文件 | status | 关键结论 |
|------|----------|--------|----------|
| plan-eng-review | `P2-review-eng.md`（复核轮 r3） | approved | BLOCKER-4 闭合确认（archived 分支显式匿名守卫，`entry_service.py:346-347` 现行为核实）+ N8 落实（非 archived 分支收紧，ownerless+私有+匿名 404）+ N9 落实（DELETE star 不要求读权限，P3 回归锚入 §7/§14）；修订未引入新问题 |
| plan-design-review | `P2-review-design.md`（复核轮 r2） | approved | design-1..6 六项 needs-revision 全部闭合 + 4 项补充建议全部落实；行号与前端源码逐一核实精确；修订未引入新 BLOCKER/CRITICAL，仅 3 条非阻塞建议（Toast action 自动消失、ConfirmDialog testid 透传、loadEntries 传参 P3 断言）已注明处理方向 |

**分歧**：无。两专家结论互不冲突，交叉领域（§6 前端设计、§4.6 API 契约）判定一致。

## 2. 锁定决策清单（两专家共同确认）

1. **倒计时模型** = 绝对到期点 `archive_delete_at`（候选 A）；`archive_delete_at=NULL` 兜底走 archived_at 旧判定。
2. **墓碑** = `tombstone_id` 事务内绑定（候选 C）；entry_id 纯整型无 FK；部分唯一索引 `WHERE tombstone_id IS NULL`。
3. **权限扩展** = get_entry 单点守卫（候选 E）+ §4.6 API 契约冻结为 backend→frontend 解耦点；archived 分支显式匿名守卫（BLOCKER-4）+ else 分支收紧（N8）。
4. **迁移** = 数据幂等 backfill（不复用 user_version，FTS 独占保持）。
5. **前端** = Starred tab（不含墓碑，仅 entries 表）+ /stars 管理页 + 作者豁免标签（footer 条件 `isOwner && archived && star_count>0`，与 BaseBadge 互斥）+ 双落点星标按钮（desktop `toggle-btn` + 移动端 `mobile-star-toggle`，OverflowMenu sheet 兜底）+ §6.5 data-testid 清单 + §6.6 a11y（aria-pressed/语义色 token/对比度 ≥4.5:1）。
6. **DTO 映射** = `client.ts` transformListItem/transformEntry 补 `star_count→starCount`、`is_starred→isStarred`、`countdown→countdown`（design-4）。
7. **归档 Toast 双文案** = active 近到期「将于 X 归档」/ archived「已归档，星标后可长期保存」（design-6）。
8. **管理页 filter 语义表固化** = all/active/expiring(<7d)/expired（含墓碑）四分类（补充 2）。

## 3. BDD 锚点引用

- 权限回归锚：BDD-15 / BDD-16（archived 匿名 404，防 slug 枚举 C2）；BDD-16/E8 不变式经 BLOCKER-4 显式守卫保持。
- 归档 Toast：BDD-23（design-6 双文案）。
- 列表/Starred tab：BDD-18（starred 列表不含墓碑）、BDD-20（filter 语义映射）。
- 迁移：BDD-27（backfill 幂等）。
- P3 回归用例（§7 新增）：ownerless archived 匿名 404（BLOCKER-4 锚）、转私有后取消星标仍 200（N9 锚）。

## 4. 技术债

沿用 DEBT0006（`_restore_merge` 不导入新表），登记不变。

## 5. 遗留项

无。非阻塞建议 3 条（eng 无新增；design 的 Toast action 自动消失 / ConfirmDialog testid 透传 / loadEntries 传参 P3 断言）已由专家注明处理方向，交由 P4/P3 按 §6.5/§7 落实，不构成 P2 阻塞。

## 6. 推进要求

- P2 gate 判定：P2-review.md 存在且 status: approved（agent=review-lead，非 main）✓
- candidate_count=6、四字段（packages/domains/ui_affected/gate_commands）、gate_commands.P5_e2e 均已在 P2-design.md 声明完整（两专家核实）
- 下一步：P3 TDD（risk=high，不可跳；P3 测试用例已按 §7 铺好 BLOCKER-4/N9 回归锚）
