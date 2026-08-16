# P4 回退修复 r2 — BUG-1（backend）实现报告

- **task**: TPV0093-star-lifecycle
- **trace**: TPV0093-P4-20260816-retreat-r2
- **实现者**: implementer（backend 包）
- **范围**: 仅 `backend/`；BUG-2（frontend）由另一 implementer 处理
- **状态标记**: `[PROD_NOT_TOUCHED]`

## 根因（已复现验证）

**BUG-1 [CRITICAL]** `entry_service.py:590-592` 单列 select 解包崩溃。

```python
starred_rows = session.exec(
    select(EntryStar.entry_id).where(...)
).all()
starred_ids = {rid for (rid,) in starred_rows}   # ← 崩溃
```

- SQLAlchemy 2.x `Session.exec(select(单列))` 返回 **ScalarResult（元素是 int）**，不是 Row 元组。
- `for (rid,) in starred_rows` 对 int 解包 → `TypeError: cannot unpack non-iterable int object` → 500。
- **复现**（写脚本直接调用，非只读代码）：`GET /api/v1/entries`（Bearer token）→ 500，堆栈指向 entry_service.py:592；`GET /api/v1/entries?starred=true` 同样 500。
- 影响面：任何 `current_user_id` 非 None 的列表请求（默认列表 / starred=true / owner 过滤）都会命中单列分支 → P6 BDD-18（Starred tab 空）、BDD-24（archived 列表空）均由次根因导致。

## 修复（最小，一行）

`backend/peekview/services/entry_service.py:592`：

```python
starred_ids = set(starred_rows)
```

单列 exec 的元素直接是标量 entry_id，`set()` 一步到位。双列分支（`star_count_map = dict(star_rows)`）不受影响，未改动。

## 补测试

`backend/tests/test_star_review_fixes.py` 新增 `TestListEntriesIsStarred` 两用例：

1. `test_bug1_default_list_login_user_200_is_starred_correct`：登录用户请求默认列表 → 200；已星标 entry `is_starred=True` 且 `star_count==1`，未星标 entry `is_starred=False`。
2. `test_bug1_starred_true_list_200_only_starred`：登录用户请求 `?starred=true` → 200；仅返回已星标 entry，且 `is_starred=True`。

两用例均覆盖单列 select 解包路径（此前测试只覆盖 star_count，未走列表单列分支——P5 漏网根因）。

## 自跑结果（签名）

| 检查 | 命令 | 结果 |
|------|------|------|
| 新测试 | `.venv/bin/python -m pytest tests/test_star_review_fixes.py -k TestListEntriesIsStarred` | 2 passed |
| 全量回归 | `make test-quick`（repo root，timeout 300s） | **1127 passed, 3 skipped, 0 failed**（39.48s）|
| lint | `python3 -m ruff check peekview/ tests/` | All checks passed! |
| 修复落盘确认 | `grep -n "starred_ids = set" backend/peekview/services/entry_service.py` | `592: starred_ids = set(starred_rows)` |

复现脚本在修复后复验：默认列表 + `starred=true` 均 200（`/tmp/opencode/repro_bug1.py`，临时文件，不落仓库）。

## 结论

BUG-1 已修复（一行），回归测试全绿零回归，lint 通过。backend 部分完成，等待主 Agent gate 验证。

---

# P4 回退修复 r2 — BUG-2（frontend）实现报告

- **task**: TPV0093-star-lifecycle
- **trace**: TPV0093-P4-20260816-retreat-r2
- **实现者**: implementer（frontend 包）
- **范围**: 仅 `frontend-v3/`；BUG-1（backend）由另一 implementer 处理（见本文件上半部分）
- **状态标记**: `[PROD_NOT_TOUCHED]`

## 根因（读码确认，与主 Agent 诊断一致）

**BUG-2 [MEDIUM]** `StarManageView.vue:100` 倒计时标签直接渲染后端浮点：

```vue
<span class="star-countdown">剩余 {{ item.countdown!.remainingDays }} 天</span>
```

- `remainingDays` 来自 `client.ts:47` 透传 `countdown.remaining_days`（后端秒数换算的浮点，如 `2.9998754817708333`）→ 页面显示"剩余 2.9998754817708333 天"，未取整。
- P1 §4.2 / BDD-21 要求整数格式（`/剩余\s*\d+\s*天/`）。
- **显示点排查**（全量 grep `remainingDays`/`剩余`）：仅 `StarManageView.vue:100` 一处渲染倒计时标签；`EntryCard.vue:64` / `EntryListRow.vue:52` 的"星标豁免说明"仅为 aria-label 帮助提示（无剩余天数文本，且 BDD-24 断言卡片不含 `剩余 X 天`）；`expires.ts` / `useRelativeTime.ts` 属 entry expires_in 其他语境。单点修复即可。

## 修复（最小）

`frontend-v3/src/views/StarManageView.vue`：

1. 模板 `:100` 渲染处改用取整函数：`剩余 {{ ceilDays(item.countdown!.remainingDays) }} 天`
2. script setup 新增 `ceilDays` 助手（`Math.ceil`——派发指引推荐，不足 1 天显示"剩余 1 天"更合理）：

```ts
function ceilDays(days: number): number {
  return Math.ceil(days)
}
```

`isExpiring` 过滤逻辑未动（仍用原始浮点值判 `0 < r < 7`，避免改变分类语义）。

## 测试适配

`frontend-v3/src/__tests__/t093-star-manage.test.ts` BDD-21 块新增 2 用例（原有 4 用例不变）：

- **TC-BDD21-05**（BUG-2 回归）：`remaining_days: 2.9998754817708333` → 断言标签文本匹配 `/剩余\s*3\s*天/` 且 **不匹配** `/2\.999/`
- **TC-BDD21-06**：`remaining_days: 0.3`（不足 1 天）→ 断言 `剩余 1 天`（ceil 语义落点）

## 自跑结果（签名）

| 检查 | 命令 | 结果 |
|------|------|------|
| 定向用例 | `npx vitest run src/__tests__/t093-star-manage.test.ts` | 21 passed（原 19 + 新增 2）|
| 前端全量 | `make test-frontend`（timeout 300s） | **98 files / 1290 passed / 4 skipped / 0 failed** |
| 类型检查 | `make typecheck`（timeout 300s） | ✓ vue-tsc --noEmit passed |
| 修复落盘确认 | `grep -n "ceilDays" src/views/StarManageView.vue` | 模板 + script 各 1 处 |

## 结论

BUG-2 已修复（`Math.ceil` 取整显示），回归全绿零失败，typecheck 通过。frontend 部分完成，等待主 Agent gate 验证。
