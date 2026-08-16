---
phase: P4
task_id: TPV0093-star-lifecycle
type: review
parent: P4-implementation-frontend.md
trace_id: TPV0093-P4-20260816-design-review-r3
status: approved
created: 2026-08-16
agent: design-review
---

# P4 设计评审（r3 复核轮）— TPV0093 frontend 实现（C1 跨层契约闭合复核）

> 评审对象：`frontend-v3/`（P4-implementation-frontend.md r4 节，C1 + R4-note + 2 minor 修复）
> 对照基线：上轮 P4-review-design.md（r2：C1 CRITICAL + R4-note + 2 minor）+ **后端真实契约**（models.py StarItem/TombstoneResponse/CountdownInfo + star_service.py 序列化/过滤/unstar_batch + entry_service.py 墓碑绑定）
> 环境隔离：`[PROD_NOT_TOUCHED]` — 只读代码与文档，未跑测试、未改源码、未触碰 :8080 / ~/.peekview/

## 0. 评审范围与方法

逐一读取：P4-dispatch-context r3（复核目标 4 项）→ design-review 角色定义 → 上轮 P4-review-design.md（r2）→ P4-implementation-frontend.md（r4 节）→ client.ts / api/types.ts / StarManageView.vue / stores/star.ts / t093-star-manage.test.ts / t093-star-toast.test.ts → **后端契约逐字段核对**（models.py:554-618 + star_service.py:78-103/200-219/337-412 + entry_service.py:877-911）。本轮为增量复核，聚焦 C1 闭合 + R4-note + 2 minor + 新问题，不重复完整评审。

## 1. C1（CRITICAL）闭合确认 — transform 与真实后端契约逐字段对齐

### 1.1 后端真实契约（核实，非转述）

- **`StarItem`**（models.py:585-602）：`type/entry_id/slug/summary/status/is_public/owner_id/username/starred_at/star_count/is_starred/expires_at/archived_at/countdown/tombstone`——**无顶层 `id`**，标识为 `entry_id`；`tombstone` 为嵌套 `TombstoneResponse | None`。
- **`TombstoneResponse`**（models.py:572-582）：`id/entry_id/slug/title/cover/deleted_by/deleted_at/reason`。
- **`CountdownInfo`**（models.py:554-559）：`status(字符串)/remaining_days(float)/archive_delete_at`。
- **tombstone 分支**（star_service.py:343-359）：`entry_id=star.entry_id`（星标行的原始 entry id），`slug=tombstone.slug`，`summary=tombstone.title`，墓碑 5 字段嵌套于 `tombstone=TombstoneResponse(...)`。
- **entry 分支**（star_service.py:374-389）：`entry_id=entry.id`，`username` 批量解析，`countdown=build_countdown(entry, is_starred=True)`。
- **unstar_batch**（star_service.py:200-219）：按 `EntryStar.entry_id.in_(entry_ids)` 匹配；墓碑绑定不改变 entry_id（entry_service.py:906-908 仅置 `star.tombstone_id`，entry_id 保留原值）。

### 1.2 前端修复逐项核实

| 修复项 | 落点核实 | 结论 |
|--------|---------|------|
| C1-① `transformTombstone` | client.ts:205-216：`id: item.entry_id`（= 星标行的原始 entry id，正是 unstar_batch 的匹配键）；title/deletedBy/deletedAt/reason 全部改从 `item.tombstone.*` 取 | **CLOSED** ✓ |
| C1-② `transformStarEntry` | client.ts:218-238：`id: item.entry_id`，独立 transform 不复用 `transformListItem`（star 响应无顶层 id/tags）；countdown 走 `transformCountdown`（remaining_days/archive_delete_at → camelCase） | **CLOSED** ✓ |
| C1-③ 类型嵌套 | api/types.ts:162-198：`StarListItemResponse` 独立契约（顶层 entry_id，无 id/tags/tombstone 固定 null）；`TombstoneNestedResponse` 嵌套 5 字段 + cover/slug/entry_id；`TombstoneItemResponse.tombstone` 嵌套——与 models.py 逐字段核对一致 | **CLOSED** ✓ |
| C1-④ 真实形状集成用例 | t093-star-manage.test.ts 重构：真实 client（api.listStars/api.removeStars）+ mock axios.get/delete，makeStarItem/makeTombstoneItem 为后端真实形状（raw snake_case + entry_id + 嵌套 tombstone）；raw→transform→store→渲染全链路；批量/单条移除断言改从 axios.delete config 读 `entry_ids`（TC-BDD14-04 断言含 101、TC-BDD22-01 断言含 1 和 101） | **CLOSED** ✓ |

### 1.3 影响链修复闭环（逐环核实）

- `starId(item)=item.id`（StarManageView.vue:198-200）→ transform 后恒为 entry_id（entry 与 tombstone 两分支均已核实）→ `starKey` 无 `entry-undefined` 碰撞（:206-208）→ checkbox `selectedIds.includes(entry_id)` 正常 → `removeStars([entry_id])` → DELETE /stars `{entry_ids}` → 后端 `EntryStar.entry_id.in_()` 命中（含墓碑绑定的星标行，entry_id 未变已核实）→ 墓碑卡片标题/水印/原因来自 `tombstone.title/deleted_by/deleted_at/reason`（:73-84, :260-267）。
- 旧缺陷成因已消除：旧 mock 自洽掩盖（顶层扁平 id/title）已被真实形状 mock 取代，client transform 读错字段即红——C1 回归锚成立。

## 2. R4-note 闭合确认

- StarManageView.vue:176-182 `isExpiring`：`status !== 'expired' && remainingDays > 0 && remainingDays < 7`——与后端 `_matches_filter` expiring 分支（star_service.py:405-411 `status != "expired" and 0 < remaining_days < 7`）**逐字对齐**（含新增 `0 <` 下界）。**CLOSED** ✓
- TC-BDD20-06（paused + remaining_days=0 不落入 expiring）已新增并通过（t093-star-manage.test.ts:238-250）。
- 补充核实：后端 `build_countdown`（star_service.py:92-102）确可产出 `status='paused', remaining_days=0.0`（is_starred 优先于 remaining_days<=0），该边缘条目存在，修复有真实锚点。

## 3. 2 minor 闭合确认

| minor | 核实 | 结论 |
|-------|------|------|
| toast 测试注释/字面同步 | t093-star-toast.test.ts:9 注释 + :24/:27/:40 全部为 `/explore?starred=1`（与 StarToggle.vue 实际值一致，r2 指出的 4 处均已改） | **CLOSED** ✓ |
| 桌面 44px 处理 | 保持 44px 触达（a11y 正向收益），未加 media 收窄；r2 评审自身即「可接受」，r4 文档记录主 Agent 倾向接受——处理决策已记录在案 | **CLOSED** ✓（决策已定，无代码改动） |

## 4. 新问题检查（复核目标 4）

未发现新 BLOCKER / CRITICAL。2 条信息性观察（均不阻断，无需改动）：

1. **active tab 客户端公式对 paused+0 的理论差异（死代码）**：前端 active 公式 `!isExpiring && !isExpiredEntry`（StarManageView.vue:192）会接受 paused+0 条目，而后端 active 过滤要求 `remaining_days >= 7`（star_service.py:404）会排除之。但因管理页每次切 tab 都经 `api.listStars({filter})` 后端预过滤（store.load，star.ts:15），后端 active 响应不含 paused+0，客户端公式永远看不到该条目——差异不具现；反向核实后端 active 条目（r>=7 或 countdown null、status!=expired）也全部通过前端公式（r<7 才触发 isExpiring），无条目丢失。安全。
2. **reason='expired' 分支为前瞻性代码**：前端类型 `'author_deleted' | 'expired'`（api/types.ts:188）与墓碑水印/文案的 expired 分支（StarManageView.vue:261-266），当前后端仅创建 `reason="author_deleted"` 墓碑（entry_service.py:902，全仓唯一 EntryTombstone 创建点）。若后端未来发出其他 reason 值，前端水印默认回落「作者已删除」，优雅降级。属 backend 域既有状态，不影响本包正确性。

## 5. 正面确认

- **r4 改动边界干净**：只改 frontend-v3 下 3 个源码文件（api/types.ts / api/client.ts / views/StarManageView.vue）+ 2 个测试文件，未触碰 backend/、packages/（核实 ✓）。
- **测试改造方式合理**：C1-④ 以「真实 client + mock axios」替代「mock 整 client」是验证 entry_id 传递的必然手段（entry_id 只存在于 raw 契约层），非设计偏离（实现文档 :197 说明充分）。
- 单测 1288 passed / typecheck exit 0 为实现文档声明，评审未复跑——P5 主 Agent 验 gate 复跑。
- 生产隔离 `[PROD_NOT_TOUCHED]` ✓。

## 6. 结论

**C1（CRITICAL）闭合确认**：前端 transform 与后端真实契约逐字段对齐（entry_id 标识、tombstone 嵌套、snake_case countdown），影响链（starId/key/checkbox/removeStars/墓碑渲染）全环修复，unstar_batch 命中语义（星标行保留原 entry_id）核实成立，C1-④ 集成用例以真实契约形状覆盖 raw→transform→store→渲染全链路。R4-note（remainingDays > 0 与后端逐字对齐）与 2 minor 全部闭合。未引入新问题（2 条信息性观察，无需改动）。

**判定：approved**（C1 闭合确认 + R4-note + 2 minor 全部闭合）。
