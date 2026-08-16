---
phase: P4
task_id: TPV0093-star-lifecycle
type: review
parent: P4-implementation-backend.md
trace_id: TPV0093-P4-20260816-review-r2
status: approved
created: 2026-08-16
agent: review
---

# P4 后端实现评审 r2 — TPV0093 star-lifecycle（review / 偏执 Staff Engineer）

## 评审范围与方法

- 只读代码与文档，未跑测试（仅一条 SQLAlchemy Row 语义验证，见下）、未修改任何源码：`[PROD_NOT_TOUCHED]`
- 读入：dispatch-context（复核目标 5 项）、review.md 角色定义、上轮 P4-review-backend.md（r1，rejected）、P4-implementation-backend.md（r2 修订节）、`star_service.py` / `entry_service.py` / `admin_service.py` / `api/entries.py` / `api/stars.py` / `models.py` / `main.py` / `database.py`（backfill）相关改动、新回归测试 `test_star_review_fixes.py`（全文）
- 方法：按 dispatch-context 增量模式，只复核 BLOCKER-1 / CRITICAL-2 / F2 / F3 / 高价值 INFO（1/2/4/6）+ F4 闭合，并做「是否引入新问题」检查
- 一条语义验证（非测试运行）：venv python 实测 SQLAlchemy 2.0.51 下 `dict(Row)` 对 2 列 GROUP BY 结果 → `{id: count}`、单列 Row 解包 → `{rid for (rid,) in rows}` 均正常，INFO-2 批量查询无类型隐患

## 复核结论 — 5 项目标全部闭合

### 1. BLOCKER-1 [HIGH] 时区 TypeError — 闭合 ✓

```
[确认] backend/peekview/services/star_service.py:88-90
  deadline = _naive_utc(entry.archive_delete_at)          # naive UTC
  now = datetime.now(timezone.utc).replace(tzinfo=None)   # 修复：naive UTC
  remaining_days = (deadline - now).total_seconds() / 86400.0
```
- 两端均 naive UTC，`naive - aware` TypeError 消除（r1 已用 python3 验证该异常确定性触发；修复前后对比成立）
- 全部触发面（`_build_response`:1145 / `EntryListItem`:619 / `_build_star_item`:373）均经 `build_countdown` → 修复一处即全链闭合；`admin_service.py:311` deadline 比较本就两端 naive（r1 确认）
- **新回归测试补齐**（`test_star_review_fixes.py::TestCountdownReads::test_blocker1_archived_with_deadline_detail_and_stars_200`）：archived + `archive_delete_at` 已设（2099-01-01）→ owner GET 详情 200 + `countdown.status=running`；星标用户 GET 详情 200 + `paused`；同 fixture `GET /api/v1/stars` 200 + `paused`——正是 r1 要求的测试场景（owner 与星标用户各一），r1「零测试覆盖」缺口已补
- 断言 `remaining_days > 0` / `== 0` 与 `max(remaining_days, 0.0)` 截断语义一致

### 2. CRITICAL-2 删除↔星标并发孤儿星标 — 闭合 ✓（Fix B + Fix C 双保险）

- **Fix B（清扫兜底）**：`admin_service.py:329-334`（cleanup_expired 墓碑清扫处）与 `star_service.py:316-321`（cleanup_orphan_tombstones，delete_user 后清扫也走它，admin_service.py:537-539）双落点：
  `DELETE FROM entry_stars WHERE tombstone_id IS NULL AND entry_id NOT IN (SELECT id FROM entries)` —— 与 r1 建议逐字一致；墓碑绑定行 `tombstone_id NOT NULL` 天然豁免，活星标指向存在 entry 也不受影响
- **Fix C（入口校验）**：`star_service.py:125-126` `session.get(Entry, entry_id) is None → NotFoundError` —— 服务层不再依赖路由前置（同时闭合 INFO-5）
- Fix A（条件 UPDATE）未采用：r1 建议为「按成本排序」的组合，Fix B+C 即推荐双保险，A 为可选优化，不阻塞
- **新回归测试**：`TestOrphanStarSweep` —— cleanup 清扫孤儿（entry_id=99999 删、正常星标保留 1）；`star(99999, 1)` 抛 NotFoundError ✓

### 3. F2 [MEDIUM] DELETE /star slug oracle — 闭合 ✓

```
[确认] backend/peekview/api/entries.py:457-464
  entry = service.get_entry_by_slug(slug); if not entry → 404        # 未知 slug
  if not star_service.has_star(entry.id, current_user.id):
      service.get_entry(slug, ...)                                    # 不可读 → 404
  return star_service.unstar(entry.id, current_user.id)              # 有星标 → 保留 N9
```
- `has_star`（star_service.py:235-240）查活或墓碑绑定星标（find_star 不筛 tombstone_id）——墓碑绑定星标场景（entry 已删）unstar 仍 200 且走墓碑清理（unstar:187-192），语义完整
- 未知 slug / 私有 active / archived 非星标 → 一律 404，存在性 oracle 消除；公开可读无星标 → 200（unstar 幂等，既有语义保留）
- **新回归测试**：`TestDeleteStarOracle` —— 私有 active / archived / 未知 slug → 404；星标用户 archived → 200 + `is_starred=false`（N9 回归）✓

### 4. F3 [MEDIUM] 批量移除上限 — 闭合 ✓

- `models.py:617`：`entry_ids: list[int] = Field(..., min_length=1, max_length=500)`（min_length=1 原已有）
- **新回归测试**：`TestBatchRemoveLimit` —— 501 个 → 422；空列表 → 422 ✓

### 5. 高价值 INFO + F4 — 闭合 ✓

| 项 | 落点 | 核实 |
|----|------|------|
| INFO-1 countdown 优先级 | `star_service.py:92-97`：`if is_starred: status="paused"` 前置，expired 分支隐式 `not is_starred` | 对齐 P2 §4.4；`_matches_filter` expired 分类（:395-398）与 paused 不冲突（星标恒 paused 不入 expired）✓；回归测试 `test_info1_unstarred_past_deadline_shows_expired`（未星标 + deadline 已过 → expired + remaining_days=0）✓ |
| INFO-2 list_entries N+1 | `entry_service.py:569-592`：当前页 `entry_ids` 批量 `SELECT entry_id, COUNT(*) ... GROUP BY`（star_count_map）+ 按 `(entry_id, user_id)` 批量取 starred_ids | 每行 3 查询 → 每页 ~3 查询 ✓；`dict(Row)`/Row 解包语义已实测通过；`is_starred` 依 `current_user_id` 空值分支正确（:601）|
| INFO-4 starred×status 互斥 | `entry_service.py:418`：`if status and not starred` | starred=True 时 status 被忽略（与 owner 同处理）✓ |
| INFO-6 list_starred username N+1 | `star_service.py:275-287`：items 构建后 owner_id 集合批量 `select(User)`，`_build_star_item` 置 `username=None` 由外层回填（:382）| StarItem 为 SQLModel（非 frozen），`item.username = ...` 赋值合法 ✓；owner_id 为 None 时跳过 ✓ |
| F4 stars 限速 | `api/stars.py:15/33`：GET/DELETE `/api/v1/stars` 均 `@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)` | ✓ |

**许可范围内未做（DEBT 已记录于 P4-implementation-backend.md「遗留决策」）**：INFO-3/F5（list_starred 全量加载内存过滤分页）、INFO-2 file_count 每行 1 查询（既有模式）。与派发上下文「可选（可留 DEBT）」一致，不阻塞。

## 引入新问题检查（Pass 1 + Pass 2 增量）

- **INFO-2 批量查询**：SQLAlchemy 2.0.51 实测 `dict()` 对 2 列 Row 序列 / 单列 Row 解包均正常（内存库验证，未碰生产）→ 无 500 风险
- **build_countdown Python 层枚举比较**（`entry.status != EntryStatus.ARCHIVED`，:85）：与 r1 既有写法一致，r1 已确认枚举读回/比较语义（BDD-7/10 通过 + P4 决策 1），r2 未改动该处
- **Fix C 开销**：`star()` 每次多一次 `session.get(Entry)`，单请求级可忽略，无新问题
- **has_star 增加查询**：仅 DELETE /star 路径，2 次轻查询，可接受
- **F2 墓碑场景**：`get_entry_by_slug` 命中 + `has_star=True`（墓碑绑定）→ unstar 200 + 墓碑清理，无 404 误伤
- **r1「其余核验」未受影响**：`_delete_with_tombstone` 同事务墓碑绑定原子性、backfill 幂等、delete_user 顺序、N7 幂等、非星标 404 防枚举——r2 未触及，保持 ✓
- **测试隔离**：`test_star_review_fixes.py` 的 `fix_client` fixture 用 `tmp_path + create_app(data_dir, db_path)` 显式隔离，与 conftest autouse 无冲突，不碰生产 ✓

## 结论

r1 的 1 个 BLOCKER + 1 个 CRITICAL + 6 INFO 中：BLOCKER-1（代码 + 回归测试双闭合）、CRITICAL-2（Fix B+C 双保险 + 测试）、F2/F3（代码 + 测试）全部闭合；高价值 INFO-1/2/4/6 + F4 落实并有测试覆盖（INFO-1/2 例外均有回归用例）；未引入新 BLOCKER/CRITICAL；遗留项均在派发上下文许可的 DEBT 范围。

5 项复核目标全部闭合，无未决 BLOCKER/CRITICAL → **status: approved**。
