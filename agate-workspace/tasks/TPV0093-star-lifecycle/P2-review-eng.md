---
phase: P2
task_id: TPV0093-star-lifecycle
type: review
parent: P2-design.md
trace_id: TPV0093-P2-20260816-r3
status: approved
created: 2026-08-16
agent: plan-eng-review
---

# P2 工程评审意见 — plan-eng-review（复核轮 r3，极小复核）

评审对象：`P2-design.md` 修订版 r3（单点守卫：§4.3 archived 分支恢复显式匿名守卫 + else 分支收紧 + §7 补两 P3 用例）
基线：上轮 `P2-review-eng.md`（r2：3 BLOCKER 闭合 + N1-N7 落实，新增 BLOCKER-4 + N8/N9）｜`P1-requirements.md`｜`P0-brief.md`
验证方式：代码逐项复核（entry_service.py:341/344-349/346-347、delete_entry :752-753 ownerless 注释）+ 修订伪代码与 §7 用例逐条比对

## 结论

**approved — BLOCKER-4 闭合确认 + N8/N9 落实确认；本轮复核未发现修订引入新问题。**

复核目标 4 项全部闭合（详见下）。上轮已 approved 基线（3 BLOCKER 闭合 + N1-N7 落实 + design 评审 6 项）不再重复，本轮锁定其继续成立。

---

## 复核目标逐项确认

### 1. BLOCKER-4 ✓ 闭合 — archived 分支恢复显式匿名守卫

- **代码核实**：现有代码 `entry_service.py:346-347` 确有显式匿名守卫 `if current_user_id is None and not is_admin: raise NotFoundError`；:341 is_public 前置检查、:344-349 archived 分支结构属实。ownerless legacy（owner_id=NULL，`delete_entry` :752-753「owner_id=NULL entries can be deleted by admin only」注释证实该数据类存在）下 `None != None` 短路判定属实。
- **修订比照**：r3 §4.3 archived 分支伪代码为：
  ```
  if not is_admin and current_user_id is None:
      raise NotFoundError
  if not is_admin and entry.owner_id != current_user_id and not _has_live_star(session, entry.id, current_user_id):
      raise NotFoundError
  ```
  显式匿名守卫已按评审建议形式恢复（第一行），ownerless archived 匿名 → 第一守卫恒 404；星标/owner/admin 豁免逻辑在第二守卫，与决策 A 一致。
- **不变式文字保持**：§4.3 尾段「匿名（user=None）→ 被 [r3] 显式守卫拦截 → archived 404（BDD-16/E8 不变）」照旧成立，防 slug 枚举（C2）无回归。

### 2. N8 ✓ 落实 — 非 archived 分支收紧

- r3 §4.3 else 分支：`if not entry.is_public and not is_admin and (current_user_id is None or entry.owner_id != current_user_id): raise NotFoundError`。
- `current_user_id is None` 或 `owner_id != current_user_id` 任一命中即 404，修复 ownerless + 私有 active + 匿名 的 None==None 既有漏洞（顺手修复，本任务非引入）。对公开条目、owner、admin 路径无行为变化，属安全收紧。

### 3. P3 用例 ✓ 闭合 — BLOCKER-4/N9 回归锚

- §7 P3 新增链路用例表新增两行：
  - 「ownerless archived（owner_id=NULL）→ 匿名请求详情 → 404」→ BLOCKER-4 回归锚
  - 「转私有后取消星标仍 200（DELETE star 仅需 entry 存在，不误加读校验）」→ N9 回归锚
- §14 实现完成标志同步锚定：权限段「**[r3] ownerless archived 匿名 404（BLOCKER-4）**」+ API 段「**[r3] 转私有后取消星标仍 200（N9，DELETE star 不要求读权限）**」。

### 4. 修订引入新问题检查 — 无

- **无行为回归**：r3 archived 分支对匿名恒 404，与现有 :346-347 完全一致；非星标非 owner 登录用户 404（第二守卫）；owner/admin/星标用户 200（决策 A）。与现有代码全部非星标路径行为等价，仅新增星标扩展路径。
- **_has_live_star 空值安全**：第一守卫拦截 current_user_id=None 后，第二守卫只对非 None 用户调用 `_has_live_star`，无 None 入参风险。
- **BLOCKER-1 不复发**：archived 分支短路 is_public 保留，archived+private+星标用户仍 200。
- **§14/N3/四字段**：candidate_count=6、packages/domains/ui_affected、gate_commands、files_to_read、env_constraints、minimal_validation、dispatch_plan 均未因本轮修订受影响（grep 核实落盘）。

---

## 架构问题（阻塞级）

无。

## 架构问题（非阻塞）

无新增。N8（既有漏洞顺手修复）已落实，N9（DELETE star 语义）已由 P3 用例锚定。

## 测试缺口

无新增。BLOCKER-4 回归锚 + N9 回归锚已入 §7/§14。

## 锁定决策（沿用 r2，全部成立）

- 倒计时模型 = 绝对到期点 `archive_delete_at`（候选 A）；NULL 兜底走 archived_at 旧判定。
- 墓碑 = tombstone_id 事务内绑定（候选 C）；entry_id 纯整型无 FK；部分唯一索引 `WHERE tombstone_id IS NULL`。
- 权限扩展 = get_entry 单点（候选 E）+ §4.6 契约冻结为 backend→frontend 解耦点；archived 分支显式匿名守卫（BLOCKER-4）+ else 分支收紧（N8）。
- 迁移 = 数据幂等 backfill（不复用 user_version，FTS 独占保持）。
- 前端 = Starred tab（不含墓碑）+ /stars 管理页 + 作者豁免标签 + 双落点星标按钮 + §6.5 data-testid 清单。

## 技术债

沿用 DEBT0006（`_restore_merge` 不导入新表），登记不变。

## 推进要求

无需修订。P2 评审闭合，可进入 P3（TDD，风险 high 不可跳）。
