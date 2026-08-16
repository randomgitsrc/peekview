---
phase: P4
task_id: TPV0093-star-lifecycle
type: implementation
parent: P2-design.md
trace_id: TPV0093-P4-20260816-backend
status: ready
agent: implementer-backend
---

# P4 实现记录 — backend 包（TPV0093 star-lifecycle）

## implementation_dir

`backend/peekview/`（代码改动）+ `backend/tests/test_star_lifecycle.py`（P3 测试缺陷最小修复，见 [DESIGN_GAP]）

## 改动清单

| 文件 | 改动 | 对应 P2 设计 |
|------|------|-------------|
| `backend/peekview/models.py` | `Entry` 加 `archive_delete_at` 列；新表模型 `EntryStar`（entry_id 纯整型无 FK / user_id FK CASCADE / tombstone_id 可空）+ `EntryTombstone`（deleted_by username 快照非 FK / reason 默认 author_deleted）；新 schema：`CountdownInfo` / `StarResponse` / `TombstoneResponse` / `StarItem` / `StarListResponse` / `StarBatchRemoveRequest`；`EntryResponse`/`EntryListItem` 加 `star_count`/`is_starred`/`countdown` | §3 数据模型 |
| `backend/peekview/database.py` | `_run_migrations`：entries 加 `archive_delete_at` 列 + entry_stars/entry_tombstones 表 IF NOT EXISTS 兜底（含索引）；`_setup_indexes`：部分唯一索引 `ux_live_star ON entry_stars(entry_id, user_id) WHERE tombstone_id IS NULL`；新函数 `backfill_archive_delete_at(engine, retention_days)`（数据幂等：UPDATE WHERE status=ARCHIVED AND archive_delete_at IS NULL，**不触碰 PRAGMA user_version**，用 ORM `sa_update` 规避枚举存储名/值差异） | §5 迁移与 backfill（BLOCKER-3） |
| `backend/peekview/services/star_service.py`（新） | `StarService`：`star`（IntegrityError → rollback → 读现有行 → `{created:false}`，N7）/`unstar`/`unstar_batch`/`get_star_count`/`is_starred`/`list_starred`（含可见性过滤 + filter 分类）/`cleanup_orphan_tombstones`；模块级助手 `find_live_star`/`count_live_stars`/`build_countdown` 供 entry_service 复用（无 N+1） | §4.5 StarService 接口 |
| `backend/peekview/services/entry_service.py` | `get_entry` 权限重构：**archived 分支短路 is_public 前置检查**（BLOCKER-1）+ **显式匿名守卫**（BLOCKER-4）+ 非 archived 分支收紧 `(current_user_id is None or owner_id != current_user_id)`（N8）；`delete_entry`/`delete_entry_by_api_key` 统一走私有 `_delete_with_tombstone`（有活星标 → 建墓碑 + UPDATE 绑定 tombstone_id，同一事务；deleted_by 取值 JWT=当前用户名 / API-key=owner username 快照）；`list_entries` 加 `starred` 参数（跳过默认 archived 排除 + 可见性 `is_public OR own OR archived` + 活星标 EXISTS，与 owner/status 互斥）；`update_entry` 双 reactivation 路径清 `archive_delete_at`（N2）；`_build_response` 加 star_count/is_starred/countdown | §4.1/4.2/4.3/4.4 + N2 |
| `backend/peekview/services/admin_service.py` | `cleanup_expired` 重写：active→archived 写 `archive_delete_at`；删除判定 = status=archived AND NOT EXISTS(活星标) AND (deadline 到点 OR NULL 兜底 archived_at<=cutoff)；孤儿墓碑清扫；`delete_user` **先删用户行 commit → 再孤儿墓碑清扫**（N1 顺序）；`__init__`/`_get_star_service` 接入 star_service | §4.1 + N1 |
| `backend/peekview/api/entries.py` | `list_entries` 加 `starred` 查询参数（匿名 + starred → 401）；新 `POST /{slug}/star`（require_auth + **先经 get_entry 可读验证，不可读 404**，BLOCKER-2）+ `DELETE /{slug}/star`（require_auth + 仅需 entry 存在，N9） | §4.6 API 契约 |
| `backend/peekview/api/stars.py`（新） | `GET /api/v1/stars`（我的星标：活 entry + 墓碑卡片，filter 分类）+ `DELETE /api/v1/stars`（body `{entry_ids}` 批量移除 + 墓碑清理） | §4.6 API 契约 |
| `backend/peekview/main.py` | app factory：`StarService` 注册到 `app.state.star_service`；启动调 `backfill_archive_delete_at(engine, config.cleanup.archive_retention_days)`（与 backfill_fts_content 同位置）；`AdminService` 传入 star_service；注册 stars_router | §2.1 + BLOCKER-3 |
| `backend/tests/test_star_lifecycle.py` | P3 测试缺陷最小修复（两处 entry_id 捕获时机，断言语义零改动），镜像同步至 P3-test-code/ | [DESIGN_GAP] 见下 |

## 自查结果

- `make test-quick` 等价（`backend/.venv/bin/python -m pytest tests/`）：**1118 passed, 3 skipped, 0 failed**（含 23 个 test_star_* 全绿 + 既有测试零回归）
- `python3 -m ruff check peekview/ tests/`：**All checks passed**
- 环境隔离：全程 pytest tmp_path 隔离（conftest autouse），未触碰生产 :8080 / ~/.peekview/ —— 状态 `[PROD_NOT_TOUCHED]`

## 实现中的关键决策

1. **枚举存储差异**：SQLModel 的 `EntryStatus` 枚举在 SQLite 按**名称**（`'ARCHIVED'`）存储而非值（`'archived'`）——初版 backfill 用裸 SQL `WHERE status='archived'` 匹配 0 行，改为 ORM `sa_update` 后正确。cleanup 删除判定同理用 ORM `Entry.status == "archived"`（ORM 比较层会正确处理）。
2. **countdown 时区**：`archive_delete_at` 存 naive UTC；`build_countdown` 读回后统一 `_naive_utc` 归一化再与 `now`（aware UTC）比较，剩余天数用 `(deadline-now)/86400`，负数截 0。
3. **star 响应字段**：`POST /{slug}/star` 返回 `StarResponse{star_count, is_starred, already_starred, created, created_at}`；`DELETE` 返回 `{star_count, is_starred:false}`——测试断言逐一匹配。
4. **list_starred 可见性**：活 entry 过滤 `is_public OR owner==me OR status==archived`（N4：转私有 active 条目从列表隐藏，星标/豁免/计数仍在）；墓碑卡片恒展示。
5. **孤儿墓碑清扫双兜底**：`unstar`/`unstar_batch` 即时清理 + `cleanup_expired` 周期清扫 + `delete_user` 后清扫（N1）。

## [DESIGN_GAP]

```
[DESIGN_GAP: P3 测试缺陷（backend/tests/test_star_lifecycle.py test_bdd_11_12 / test_bdd_13）：
在 entry 已被物理删除后调用 _entry_id(session, slug) 查 entry（BDD-11 强制物理删除——测试自身也断言详情 404，
删除后 entries 表不再有该行，_entry_id 返回 None → AttributeError）。断言意图正确（星标行存活并绑定 tombstone_id），
但查找机制与 BDD-11 物理删除语义冲突。已做最小修复：entry_id 在删除前捕获、删除后复用（test_bdd_11_12 在 setup 块
捕获后传给 _insert_star 与后续断言；test_bdd_13 删除 setup 块后重复的 _entry_id 重赋值，复用先前已捕获值），
断言语义与数量零改动；镜像同步至 P3-test-code/backend/test_star_lifecycle.py。]
```

> 该修复符合派发约束「不修改 P3 测试文件本身（除非发现测试断言与 P1 BDD 矛盾 → 标 [DESIGN_GAP]）」的例外条款：
> 测试的查找机制与 BDD-11 的物理删除要求直接冲突，不修无法在任何正确实现下通过。

[DESIGN_GAP_REVIEWED: 已确认（主 Agent）— P3 测试查找机制与 BDD-11 物理删除语义冲突，修复仅捕获时机调整、断言语义零改动，镜像已同步 P3-test-code]

## [SCOPE+]

- 无。全部改动均在 P2 设计范围内。

## [SCOPE_GAP]

- 无。P2 声明的 backend 改动全部落实。

## [CLARIFY]

- 无。

---

# r2 修订记录（评审修复）

trace_id: TPV0093-P4-20260816-backend-r2 — 对应 `P4-review-backend.md`（1 BLOCKER + 1 CRITICAL + 6 INFO）+ `P4-review-cso.md`（1 HIGH + 2 MEDIUM + 5 LOW）。

## 修复清单

| 评审项 | 级别 | 修复 | 落点 |
|--------|------|------|------|
| BLOCKER-1 / F1 | HIGH | `build_countdown` 时区归一化：`now = datetime.now(timezone.utc).replace(tzinfo=None)`（deadline 同为 naive UTC），消除 `naive - aware` TypeError | `star_service.py:89` |
| INFO-1 | — | countdown status 优先级：`is_starred → paused` 前置（星标豁免优先于 expired/running，对齐 P2 §4.4「星标时 status=paused」） | `star_service.py:93-98` |
| CRITICAL-2 Fix B | CRITICAL | 孤儿星标清扫：`DELETE FROM entry_stars WHERE tombstone_id IS NULL AND entry_id NOT IN (SELECT id FROM entries)`——admin `cleanup_expired` 墓碑清扫处 + `StarService.cleanup_orphan_tombstones`（delete_user 后清扫同样覆盖）双兜底 | `admin_service.py:329-335` + `star_service.py:311-321` |
| CRITICAL-2 Fix C / INFO-5 | CRITICAL | `StarService.star()` 入口 `session.get(Entry, entry_id)` 校验 entry 存在，不存在 → `NotFoundError`（合并 INFO-5：服务层不再依赖路由前置） | `star_service.py:130-132` |
| F2 | MEDIUM | DELETE `/{slug}/star`：先查当前用户星标行（活或墓碑绑定，新增 `StarService.has_star`）；有 → unstar（保留 N9）；无 → 回退 `get_entry` 可读性校验，不可读 → 404（消除 slug oracle） | `api/entries.py:457-464` + `star_service.py:235-240` |
| F3 | MEDIUM | `StarBatchRemoveRequest.entry_ids` 加 `max_length=500`（min_length=1 已有） | `models.py:617` |
| F4 | LOW | GET/DELETE `/api/v1/stars` 加 `@limiter.shared_limit(entries_rate_limit, scope="entries_write")` | `api/stars.py:13/31` |
| F6 | LOW | cleanup TOCTOU 语义文档化：候选 SELECT 与删除之间窗口内新星标不丢失——`_delete_with_tombstone` 同事务重读活星标并建墓碑绑定（数据以墓碑卡片保留） | `admin_service.py:308-313` 注释 |
| INFO-2 / F8 | — | `list_entries` N+1：当前页 `entry_ids` 批量 `SELECT entry_id, COUNT(*) ... GROUP BY entry_id` 取 star_count；is_starred 按 `(entry_id, user_id)` 批量取（每行 3 查询 → 每页 ~3 查询） | `entry_service.py:575-594` |
| INFO-4 | — | `starred=True` 与 `status` 互斥：`if status and not starred`——starred 时忽略 status（与 owner 同处理） | `entry_service.py:421` |
| INFO-6 | — | `list_starred` username N+1：当前页 owner_id 集合批量 `select(User)`（`_build_star_item` 不再逐行 `session.get(User)`） | `star_service.py:267-280` |

## 新增回归测试（`backend/tests/test_star_review_fixes.py`，7 用例）

- BLOCKER-1：archived + `archive_delete_at` 已设 → `GET /api/v1/entries/{slug}` 200 且 countdown 正确（owner=running / 星标用户=paused，各一）；同 fixture `GET /api/v1/stars` 200 + countdown=paused
- INFO-1：未星标 + deadline 已过 → countdown status=expired、remaining_days=0
- CRITICAL-2：cleanup 清扫孤儿星标（指向不存在 entry 的活星标被删，正常星标保留）；`StarService.star()` 对不存在 entry 抛 NotFoundError
- F2：非星标用户对私有 active / archived / 未知 slug 调 `DELETE /star` → 404；星标用户对 archived → 200（N9 回归）
- F3：批量移除 501 个 / 空 `entry_ids` → 422

## r2 自查结果

- `backend/.venv/bin/python -m pytest tests/`：**1125 passed, 3 skipped, 0 failed**（上轮 1118 → +7 新回归，零回归）
- `python3 -m ruff check peekview/ tests/`：**All checks passed**
- 环境隔离：全程 pytest tmp_path 隔离（conftest autouse），未触碰生产 :8080 / ~/.peekview/ —— 状态 `[PROD_NOT_TOUCHED]`

## 遗留决策（本轮未做，记录在案）

- INFO-3 / F5（list_starred 全量加载 + 内存过滤分页）：未修复——按派发上下文「可选（可留 DEBT）」保留，filter 分类未下推 SQL
- INFO-2 file_count 批量（既有模式）：未做——依派发上下文可选，file_count 保持每行 1 查询

## [SCOPE+]

- 无。r2 全部改动均在评审修复目标内。
