---
phase: P7
task_id: TPV0093-star-lifecycle
type: consistency
parent: P2-design.md
trace_id: TPV0093-P7-20260816
status: draft
created: 2026-08-16
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 1
deviation_critical_count: 0
design_gap_count: 4
design_gap_reviewed_count: 4
---

# P7 一致性检查报告 — TPV0093 star-lifecycle

> 对照 P1-P6 全部产出做跨文件一致性审查（只审不写）。输入：P1-requirements.md / P2-design.md / P4-implementation-backend.md + P4-implementation-frontend.md / P6-acceptance.md / P0-brief.md。
> 环境状态：`[PROD_NOT_TOUCHED]` — 本阶段纯文档审查，未触碰生产 :8080 / ~/.peekview/，未运行任何测试。

## 1. DESIGN_GAP 配对（P4 → P7 转抄 + REVIEWED）

P4 共声明 4 处 DESIGN_GAP（backend 1 处 + frontend 3 处），均已 REVIEWED。逐条转抄：

```
[DESIGN_GAP: P3 测试缺陷（backend/tests/test_star_lifecycle.py test_bdd_11_12 / test_bdd_13）——entry 已被物理删除后 _entry_id(session, slug) 查 entry 返回 None → AttributeError，与 BDD-11「作者删除强制物理删除」语义冲突。最小修复：删除前捕获 entry_id、删除后复用，断言语义与数量零改动，镜像同步 P3-test-code/。]
[DESIGN_GAP_REVIEWED: 主 Agent 已确认（P4-implementation-backend.md §改动清单 + [DESIGN_GAP] 声明行内标记）——修复仅捕获时机调整、断言语义零改动。P7 复核：P6§pass BDD-11/12/13 全 PASS（backend/BDD-11.json / BDD-12.json / BDD-13.json）佐证修复有效，无残留。]
```

```
[DESIGN_GAP: frontend TC-BDD2-01/02（t093-star-toggle.test.ts）fixture 与 TC-BDD3/BDD6 冲突——同为 isStarred:true，组件无法区分「重复星标（调 api.star 收 already_starred）」与「取消星标（调 api.unstar）」路径。实现按 P1/P2 标准语义：isStarred→unstar、already_starred 分支落在 star 路径。]
[DESIGN_GAP_REVIEWED: 主 Agent r2 裁决批准 fixture 微调 isStarred→false（P4-implementation-frontend.md DG-1）——TC-BDD2-01/02 转绿，断言不改。P7 复核：r4 自查 t093-star-toggle 全绿 + P6§pass BDD-2 PASS 佐证。]
```

```
[DESIGN_GAP: P2 §6.3 要求批量移除 ConfirmDialog 二次确认，但 P3 测试 TC-BDD22-01/03 点击 stars-batch-remove 即断言 api.removeStars 被调用（ConfirmDialog 被 stub 为 true，无法交互确认）。初版实现取「直接调用 + Toast」。]
[DESIGN_GAP_REVIEWED: 主 Agent r2 裁决打回（DG-2：必须补二次确认）→ r2 已落地 ConfirmDialog 二次确认（批量 + 墓碑单条，t093-star-manage.test.ts 最小适配驱动确认流程，not.toHaveBeenCalled() 前置断言作回归锚）。P7 复核：P6§pass BDD-22/14 PASS（勾选→ConfirmDialog 确认→移除）佐证落地有效。⚠️ 此适配超出「P3 测试文件修改 2 项批准例外」，P4 明示需主 Agent 复核——P7 记为非关键偏差（见 §3.6），P8 gate 主 Agent 复核接受。]
```

```
[DESIGN_GAP: P3 测试文件自身类型问题——t093-star-exempt.test.ts:172 报 TS2571（emitted unknown）、t093-star-manage.test.ts:44 未使用变量 TS6133，致 make typecheck 红（非实现引入）。]
[DESIGN_GAP_REVIEWED: 主 Agent r2 裁决批准类型-only 修复（DG-3）——TS2571 加类型断言、删除未使用变量，断言行为不变。P7 复核：r4 typecheck exit 0 全绿 + P6 全量 PASS 佐证。]
```

**配对结论**：4/4 全部转抄 + 配 [DESIGN_GAP_REVIEWED] 标记，无遗漏（对照 P4-implementation-backend.md [DESIGN_GAP] 1 处 + P4-implementation-frontend.md [DESIGN_GAP] 3 处，rg 计数一致）。

## 2. SCOPE+ 闭环

- **条目**：P2§13 [SCOPE+] 发现——backup/restore `_restore_merge` 不导入 entry_stars/entry_tombstones（现有代码仅处理 entries/files/shares/reads/apikeys），merge-restore 旧备份丢失星标/墓碑。
- **闭环判定**：P1§8 已登记该条（[SCOPE+ from P2]）+ P1 frontmatter `scope_resolved` 字段记录「已知限制 → DEBT0006 登记，不扩大本任务实现范围」；P2§13 同步声明「已登记 DEBT0006，主 Agent 裁定为已知限制，P2 不扩大范围」。P4 backend/frontend 均声明 [SCOPE+] 无（未越界实现新表导入）。
- **结论**：闭环成立——SCOPE+ 条目 → [SCOPE_RESOLVED]（P1§scope_resolved）→ DEBT0006 追踪，实现未扩大范围。

## 3. 跨文件一致性

### 3.1 P2§packages ↔ P4§impl-path ↔ P8 发布范围

- P2 frontmatter `packages: [backend/peekview, frontend-v3]` ↔ P4-backend implementation_dir=`backend/peekview/`、P4-frontend implementation_dir=`frontend-v3/` 完全吻合。
- 前端另有 8 个 P3 测试文件 + E2E spec `e2e/star.spec.ts`（P2§6.5 testid 清单对齐）属测试范围，不入 packages。
- P8 未产出（`ls P8*` 无文件，符合流程 P8 在 P7 后）——**声明预期**：P8 发布 bump 范围应与 P2§packages 一致（backend + frontend 两包），MCP/CLI 按 P1 M2/M3 无代码改动、不参与 bump。P8 gate 主 Agent 核对。

### 3.2 P1§BDD 数量与编号 ↔ P6§pass

- P1§3 BDD-1..28 共 **28 条**（§3.1-3.8；注意 BDD-28「share 独立授权通道」按 REV-1 修订置于 §3.4，编号连续 1-28 无缺号）。
- P6§pass 共 **28 条 PASS、0 FAIL**（frontmatter pass: 28, fail: 0；Summary: 28/28 PASS）。
- 逐条核对编号与内容映射无错位：BDD-1..6 星标操作与计数 ✓；BDD-7..10 豁免删除 ✓；BDD-11..14 作者删除+墓碑 ✓；BDD-15/16/17/28 权限（含 share 通道）✓；BDD-18/19 Starred tab ✓；BDD-20..23 管理页 ✓；BDD-24..26 作者后台 ✓；BDD-27 存量迁移 ✓。BDD-28 在 P6 §4 落位（detail=200 raw=200，share 独立通道语义）与 P1 §3.4 一致。
- 同源继承抽查要求（P1§3.4 REV-4）：P6 BDD-15 已含 download 200 + 短链 302 抽查，满足「download/render/短链其一」。

### 3.3 P4§impl-path ↔ P2§design 方案吻合（重点锚点逐项核）

| P2 设计锚点 | P4 实现落点 | 判定 |
|---|---|---|
| archive_delete_at 绝对到期点（P2§3 候选 A / §4.1 cleanup） | backend models.py `Entry.archive_delete_at`；cleanup 删除判定 deadline + 星标豁免 NOT EXISTS | 吻合 |
| tombstone_id 事务绑定（P2§3 候选 C / §4.2 `_delete_with_tombstone`） | backend `_delete_with_tombstone` 同一事务建墓碑 + UPDATE entry_stars 绑定 tombstone_id | 吻合 |
| get_entry 短路 is_public（P2§4.3 BLOCKER-1 + r3 BLOCKER-4 匿名守卫） | backend entry_service get_entry archived 分支短路 + 显式匿名守卫 + N8 非 archived 收紧 | 吻合 |
| 数据幂等 backfill 不复用 user_version（P2§5 BLOCKER-3） | backend `backfill_archive_delete_at`（ORM sa_update，仅 NULL 行，不触碰 PRAGMA user_version） | 吻合（P6 BDD-27 实证 user_version=2 幂等） |
| star API 前置可读验证（P2§4.6 BLOCKER-2 授权语义） | backend api/entries.py POST /{slug}/star 先经 get_entry 可读验证，不可读 404 | 吻合 |
| countdown 状态语义（P2§4.4：星标时 status=paused） | backend star_service build_countdown is_starred→paused 前置（r2 INFO-1 对齐） | 吻合 |

### 3.4 P2§12 dispatch_plan ↔ P3/P4 实际拆分

- P2 dispatch_plan static-batch（batch-1 backend high / batch-2 frontend high，parallel_limit 2，解耦点=§4.6 API 契约冻结）。
- P4 实际产出两个独立实现文件（backend + frontend），与 batch-1/batch-2 一一对应；两批均未触碰对方包（frontend 明确「未触碰 backend/、packages/」）。E2E（P5_e2e `E2E_SPEC=e2e/star*.spec.ts`）依赖两批齐备后验证，与 P2§12 一致。

### 3.5 P6 验收回退 P4 修复 ↔ P2 设计兼容性

- **BUG-1 [backend, CRITICAL]**：`for (rid,) in starred_rows` 对 ScalarResult 解包崩溃 → 列表 API 500。修复 `starred_ids = set(starred_rows)`（P4-retreat-fix-r2.md）。属 P4 实现级 bug，P2§4.4 starred 过滤语义未变，兼容。
- **BUG-2 [frontend, MEDIUM]**：remaining_days 浮点未取整（"剩余 2.9998 天"）→ Math.ceil 取整。属 P4 展示层 bug，P2§4.4 countdown remaining_days 语义未变，兼容。
- 两处均为 P4 实现细节修复，非 P2 设计偏离；P6 修复后 28/28 全绿。

### 3.6 偏差记录（非关键，需主 Agent 复核）

- **D-1（deviation, non-critical）**：frontend P4 对 P3 测试文件的适配累计超出「2 项批准例外」——r2 DG-2 驱动确认流程 + r3 新增 3 用例（TC-BDD20-05/21-04/2-03）+ r4 t093-star-manage.test.ts 重构（真实 client + mock axios，C1 跨层契约修复必然实现方式）。P4 全程明示披露、无隐性改动，且 P3-test-code 镜像同步。P8 发布前主 Agent 复核接受即可，不构成实现缺陷。

## 4. 未决项清零

- P1§待确认清单：`[NO_NEED_CONFIRM]` x2（行首标记），**无残留 [NEED_CONFIRM]**。
- P1/P2/P4/P6 全文 **无 [BLOCKER] / [DEVIATION-CRITICAL]**（rg 计数=0）。
- P1 frontmatter risk=high / phases 全走 / packages 一致，与 P0-brief 裁剪声明（全阶段不裁）吻合。
- 唯一开放披露：§3.6 D-1（非关键偏差）→ P8 gate 主 Agent 复核。

## 5. 结论

- **BLOCKER=0**：DESIGN_GAP 4/4 配对 REVIEWED（§1）；无 [BLOCKER]/[DEVIATION-CRITICAL]（§4）。
- **CRITICAL=0**：跨文件检查 6 项全部通过（§3.1-3.5 + §4），每项附源文件节名锚点（P2§packages / P1§BDD / P4§impl-path / P6§pass / P2§12 / P2§4.3-4.6）。
- **SCOPE+ 闭环**（§2）：条目 + [SCOPE_RESOLVED]（P1§scope_resolved）+ DEBT0006。
- **deviation_count=1**（§3.6 D-1，非关键，P4 明示披露，P8 主 Agent 复核接受）。
- 结论：**一致性通过**。P7 阶段可推进 P8（P8 发布 bump 范围需覆盖 backend+frontend，见 §3.1 预期声明）。

---
状态标记：`[PROD_NOT_TOUCHED]`
