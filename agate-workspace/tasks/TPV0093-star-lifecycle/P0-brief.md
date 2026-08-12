---
phase: P0
task_id: TPV0093
task_name: star-lifecycle
trace_id: TPV0093
created: 2026-08-12
status: pending
parent: docs/specs/peekview-star-function-20260812.md（V2.0 需求文档，待评审→本任务立项）
---

# P0-brief — T093 星标功能与内容生命周期管理

## task

实现星标（Star）功能 + 内容生命周期改造：星标作为"豁免删除令牌"，保护用户收藏资产；作者删除优先；墓碑占位；Explore 加 Starred tab + 完整星标管理页。

## 需求来源

`docs/specs/peekview-star-function-20260812.md`（V2.0 最终全量版）——星标豁免删除 + 热度计数 + 墓碑 + 作者后台豁免提示。

## 核心业务逻辑（需求文档 §3）

1. **星标豁免**：只要 ≥1 用户星标，系统绝不自动删除（暂停归档倒计时）
2. **取消星标**：恢复剩余倒计时（非立即删除，给缓冲）
3. **作者删除优先**：最高优先级，强制覆盖星标豁免，生成墓碑
4. **星标计数**：公开实时（延迟<1min），同用户只计 1 次
5. **生命周期**：有效 → 归档（90 天倒计时）→ 物理删除；星标暂停倒计时

## 关键决策（已与用户定稿，P1/P2 直接采用）

| # | 决策点 | 结论 | 依据 |
|---|--------|------|------|
| A | archived 可见性 | **星标用户可读全文，非星标不可见**（现有 owner/admin 权限扩展为 owner/admin/星标用户） | 星标="留存契约"；X 书签作者删=收藏消失的教训反向设计 |
| B | 墓碑 schema | **独立 `EntryTombstone` 表**（entry_slug/title/cover/deleted_by/deleted_at/reason[expired\|author_deleted]），作者删除 + 倒计时归零都建 | X 无墓碑=用户困惑；PeekView 需 Agent 可读占位 |
| C | Explore 入口 | **Explore 页面加 `[Starred]` tab**（复用现有 tabs 机制，登录可见）；完整星标管理页（分类/墓碑/批量清理）为独立增强页 | 现有 `[All][Mine][Archived]` tabs 范式 |
| D | 存量 archived | **起倒计时**，但从**功能上线日**起算（非 archived_at），避免存量瞬间被清；存量已星标的直接豁免 | 规则统一 + 缓冲 |

## known_risks

- **权限模型改动**（决策 A）：archived 内容读取从"owner/admin"扩展为"owner/admin/星标用户"——详情 API / raw API / 文件内容 API 三处都要认星标用户身份，安全边界要仔细（防 slug 枚举：非星标用户对 archived 仍 404）
- **归档倒计时是新增概念**：现在只有 expires_at/archived_at，没有"归档后 90 天倒计时 + 暂停/恢复"——清理逻辑要重构（cleanup 任务需查 star 表 + 计算暂停状态）
- **倒计时暂停/恢复实现**：需记录"剩余秒数快照"或"暂停点"，P2 设计（避免重复计算漂移）
- **墓碑生命周期**：墓碑保留多久？用户移除星标后墓碑删除？需 P1 确认（倾向：墓碑随最后一个星标用户移除而清理，或长期保留轻量占位）
- **schema 变更**：新表 EntryStar + EntryTombstone + 迁移——涉及数据库变更，P6 不可裁
- **前端多页**：详情页星标按钮 + Explore tab + 完整管理页 + 作者后台——前端改动面大
- **无现成测试覆盖**：星标/豁免/墓碑/倒计时全无测试 → P3 不可跳
- 不触碰生产 :8080 / ~/.peekview/

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，隔离）；数据库迁移走项目迁移机制（database.py）；测试用户 alice/bob/carol 可模拟多用户星标"
lint: "make lint && make typecheck（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/（生产 DB 有存量数据，迁移需谨慎——P8 发布时评估）"

## 裁剪倾向

- P1：BDD 覆盖「星标/取消星标/计数」「豁免删除（有星标不过期删）」「取消星标恢复倒计时」「作者删除优先+墓碑」「星标用户读 archived / 非星标 404」「Explore Starred tab」「星标管理页分类/批量清理」「作者后台豁免标签+强制删除」
- P2：跨端大改动（schema + 后端服务 + 前端多页），多候选方案（倒计时暂停实现 / 墓碑保留策略），不可单候选
- P3：**不可跳**——零现成覆盖
- P5：后端 pytest 全量 + 前端 typecheck + 迁移测试
- P6：**不可裁**——schema 变更 + 多用户权限 + 前端交互，需 debug 实测多用户场景
- P7：**不可裁**——跨 schema/后端/前端多文件
- 风险：**high**（schema 变更 + 权限模型改动 + 生命周期逻辑重构，影响所有 entry）

## 排期

TPV0093：大任务，可独立启动。建议在 TPV0090/TPV0091/TPV0092 之后（那些是已暴露的 bug/摩擦，本任务是新功能）。
