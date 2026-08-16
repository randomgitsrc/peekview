---
phase: P3
task_id: TPV0093-star-lifecycle
type: test-cases
parent: P2-design.md
trace_id: TPV0093-P3-20260816-backend
status: ready
package: backend/peekview
---

# P3 测试用例 — 星标功能与内容生命周期（backend 包）

## test_code_dir 声明

- **测试代码实际位置（被 pytest 发现并运行）**：`backend/tests/`（4 个新文件：`test_star_api.py` / `test_star_visibility.py` / `test_star_lifecycle.py` / `test_star_migration.py`）
- **任务目录镜像**：`agate-workspace/tasks/TPV0093-star-lifecycle/P3-test-code/backend/`（与 backend/tests/ 内容一致，供归档）
- **运行方式**：`make test-quick`（等价 `backend/.venv/bin/python -m pytest tests/`）；针对性运行 `backend/.venv/bin/python -m pytest tests/test_star_*.py -v`
- **当前状态**：23 个用例红灯（全部为"被测模块未实现"导致的 B 类失败），4 个回归锚绿灯（既有行为，P4 重构后必须保持）；既有测试套件 1095 passed 零回归
- **环境隔离**：全部测试走 conftest autouse `isolate_config_file`（tmp_path）+ 局部 `create_app(data_dir=tmp_path)` fixture；未触碰生产 :8080 / ~/.peekview/（状态 `[PROD_NOT_TOUCHED]`）

## 红灯语义（P3 自检结论）

| 红灯类别 | 数量 | 失败点 | 判定 |
|----------|------|--------|------|
| 端点未实现（405/404） | 8 | POST/DELETE `/{slug}/star`、`GET /api/v1/stars`、`DELETE /api/v1/stars` 路由不存在 | B 类真红灯 ✓ |
| `EntryStar` import 失败 | 7 | models.py 无 EntryStar 模型/表 | B 类项目内 import 失败 ✓ |
| `archive_delete_at` 列缺失 | 5 | entries 表无该列（UPDATE 报 OperationalError） | B 类表结构未实现 ✓ |
| `backfill_archive_delete_at` import 失败 | 2 | database.py 无此函数 | B 类项目内 import 失败 ✓ |
| 行为漏洞（N8） | 1 | ownerless 私有 active 匿名可读（断言 404 vs 实际 200） | 被测行为未实现（P4 修复 N8）✓ |

> 无断言与测试数据矛盾（T075 教训项）：所有魔数断言均与 fixture 构造数据一一核对过（star_count=1/2/0、tombstone 计数、deadline ≈ now+retention±5min、legacy archived 条数=3）。

## 用例清单（1:1 映射 P1 BDD + 评审链路用例）

### A. 星标 API（test_star_api.py）

| 用例 | 映射 | Given/When/Then 摘要 | 当前状态 |
|------|------|----------------------|----------|
| `test_bdd_1_login_user_star_public_entry_count_increments` | BDD-1 | 登录 A 星标公开 E → 200，star_count=1，is_starred=true | 🔴 405 |
| `test_bdd_2_repeat_star_keeps_count_and_marks_already_starred` | BDD-2 | A 重复星标 → star_count 不变，already_starred=true | 🔴 405 |
| `test_bdd_3_unstar_decrements_count_and_is_starred_false` | BDD-3 | A 取消星标 → star_count=0，is_starred=false | 🔴 405 |
| `test_bdd_4_anonymous_star_rejected_401` | BDD-4 | 匿名星标 → 401（需登录） | 🔴 405≠401 |
| `test_bdd_5_two_users_each_count_once` | BDD-5 | A、B 各星标 → 详情 star_count=2（同用户不重复计） | 🔴 405 |
| `test_blocker2_star_requires_readable_entry` | BLOCKER-2 | owner 星标私有 E → 200；非 owner 星标私有 → 404；未知 slug → 404（防自授权绕过 + 防 slug 探测） | 🔴 405 |
| `test_n9_unstar_after_make_private_still_200` | N9 | 公开→星标→转私有(active)→取消星标 → 200（DELETE star 仅需 entry 存在） | 🔴 405 |
| `test_n7_concurrent_star_never_500` | N7 | 并发两次星标（asyncio.gather）→ 均 200 且 star_count=1（IntegrityError 幂等，非 500） | 🔴 405 |

### B. 权限（决策 A，test_star_visibility.py）

| 用例 | 映射 | Given/When/Then 摘要 | 当前状态 |
|------|------|----------------------|----------|
| `test_bdd_15_star_user_reads_archived_detail_raw_file` | BDD-15 | archived E + 星标 A → A 详情/raw/文件内容三处 200 且正文完整 | 🔴 EntryStar import 失败 |
| `test_bdd_16_non_star_user_archived_404_all_endpoints` | BDD-16 | archived E，非星标 C → 详情/raw/文件内容三处 404（防枚举） | 🟢 回归锚 |
| `test_bdd_17_owner_and_admin_read_archived_200` | BDD-17 | owner/admin 读 archived 恒 200 | 🟢 回归锚 |
| `test_blocker1_star_survives_private_and_archive` | BLOCKER-1 | 公开→星标→转私有(active)→归档 → 星标用户 200 / 非星标 404 | 🔴 EntryStar import 失败 |
| `test_blocker4_ownerless_archived_anonymous_404` | BLOCKER-4 | ownerless archived → 匿名详情 404（防 slug 枚举） | 🟢 回归锚 |
| `test_n8_ownerless_private_active_anonymous_404` | N8 | ownerless 私有 active → 匿名详情 404（非 archived 分支收紧） | 🔴 行为漏洞（当前 200） |
| `test_bdd_28_archived_entry_with_valid_share_readable` | BDD-28 | archived E + 有效 share → share 读取 200（独立授权通道回归保护） | 🟢 回归锚 |

### C. 生命周期（test_star_lifecycle.py）

| 用例 | 映射 | Given/When/Then 摘要 | 当前状态 |
|------|------|----------------------|----------|
| `test_bdd_7_starred_archived_entry_survives_cleanup` | BDD-7 | archived E（deadline 已过）+ 星标 → cleanup 不删，仍 archived | 🔴 EntryStar import |
| `test_bdd_8_starred_before_expiry_exempt_after_archive` | BDD-8 | active E + 星标 + 过期 → cleanup 归档 → 再 cleanup 不删（豁免） | 🔴 EntryStar import |
| `test_bdd_9_unstar_restores_remaining_countdown` | BDD-9 | archived E + 星标 + deadline 未来（剩余>0）→ 取消星标 → cleanup 不删（缓冲期） | 🔴 EntryStar import |
| `test_bdd_10_last_unstar_with_past_deadline_deleted` | BDD-10 | archived E + 唯一星标 + deadline 已过 → 取消星标 → cleanup 物理删除 | 🔴 EntryStar import |
| `test_bdd_11_12_author_delete_overrides_and_creates_tombstone` | BDD-11/12 | 星标 E → 作者删除 → 详情 404（正文立即清除）+ 墓碑 reason=author_deleted、slug/title 快照、星标行绑定 tombstone_id | 🔴 EntryStar/EntryTombstone import |
| `test_bdd_13_tombstone_cleared_when_last_star_removed` | BDD-13 | A、B 星标 → 作者删除建墓碑 → A 移除 → 墓碑在 → B 移除 → 墓碑清理 | 🔴 EntryStar import + DELETE /stars 404 |
| `test_n1_delete_user_sweeps_orphan_tombstones` | N1 | 作者删除建墓碑 + A 绑定 → admin 删用户 A（星标 CASCADE）→ 孤儿墓碑清扫（tombstone 表空） | 🔴 EntryStar import |
| `test_n2_expires_in_reactivation_clears_archive_delete_at` | N2 | archived E（deadline 已设）→ PATCH expires_in → status=active 且 archive_delete_at=NULL | 🔴 列缺失 |
| `test_n2_status_param_reactivation_clears_archive_delete_at` | N2 | archived E（deadline 已设）→ PATCH status=active → archive_delete_at=NULL | 🔴 列缺失 |
| `test_n4_privatized_active_entry_hidden_from_star_list` | N4 | A 星标公开 E → 转私有(active) → GET /api/v1/stars 不含该 entry（豁免/计数仍在） | 🔴 GET /stars 404 |

### D. 迁移与 backfill（test_star_migration.py）

| 用例 | 映射 | Given/When/Then 摘要 | 当前状态 |
|------|------|----------------------|----------|
| `test_bdd_27_legacy_archived_countdown_from_launch_date` | BDD-27 | 存量库含 3 条 archived_at 早于上线日 200 天的 archived E → backfill(90) → 全部 archive_delete_at ≈ now+90d（上线日起算） | 🔴 函数不存在 |
| `test_blocker3_backfill_keeps_user_version_and_is_idempotent` | BLOCKER-3 | 存量库 user_version=2 → backfill → 生效且 user_version 仍 2 → 再跑一次结果不变（幂等） | 🔴 函数不存在 |

## 覆盖矩阵核对

- 后端可测 BDD 全映射：**BDD-1/2/3/4/5/7/8/9/10/11/12/13/15/16/17/27/28 ✓（17 条全有）**
- 评审链路用例：BLOCKER-1/2/3/4、N1/N2/N4/N7/N8/N9 ✓（10 条全有）
- P1 §3.4 同源继承说明：BDD-15/16 三处端点（详情/raw/文件内容）逐一断言；download/render/短链同源继承由 P6 抽查（P1 REV-4 口径，后端单测覆盖三处主端点即可）
- MCP/CLI 行为继承（M2/M3）：无代码改动，P5/P6 回归验证（不在本批单测范围）
