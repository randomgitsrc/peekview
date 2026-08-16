---
phase: P4
task_id: TPV0093-star-lifecycle
type: review
parent: P4-review-backend.md
trace_id: TPV0093-P4-20260816-summary
status: approved
created: 2026-08-16
agent: review-lead
---

# P4 实现专家组评审汇总 — TPV0093 star-lifecycle

## 专家组结论

**status: approved（全票无 BLOCKER）**

三名评审专家（review、design-review、cso）均对 P4 实现给出 **approved**，无 BLOCKER、无分歧。汇总确认通过，P4 闭合，可推进 P5。

`[PROD_NOT_TOUCHED]` 本阶段仅只读文档汇总，未跑测试、未修改任何源码，未触碰生产（:8080）/调试（:8888）/ `~/.peekview/`。

## 1. 专家意见汇总

| 专家 | 评审文件 | status | 关键结论 |
|------|----------|--------|----------|
| review（后端） | `P4-review-backend.md`（复核轮 r2） | approved | BLOCKER-1（时区 TypeError）+ CRITICAL-2（删除↔星标孤儿）+ F2（DELETE /star slug oracle）+ F3（批量移除上限）全部闭合（代码 + 回归测试双闭合）；高价值 INFO-1/2/4/6 + F4 落实且有测试覆盖；未引入新 BLOCKER/CRITICAL |
| design-review（前端） | `P4-review-design.md`（复核轮 r3） | approved | C1（CRITICAL）跨层契约闭合确认：前端 transform 与后端真实契约逐字段对齐（entry_id 标识、tombstone 嵌套、snake_case countdown），影响链（starId/key/checkbox/removeStars/墓碑渲染）全环修复；R4-note（expiring 下界与后端逐字对齐）+ 2 minor 全部闭合；仅 2 条信息性观察（paused+0 死代码差异、reason='expired' 前瞻分支）不阻断 |
| cso（安全） | `P4-review-cso.md`（复核轮 r2） | approved | F1（HIGH 时区 TypeError）/F2（MEDIUM slug oracle）/F3（MEDIUM 批量上限）/F4（LOW 限速）全部闭合；F5-F8 处理完毕（F7 超预期双兜底修复）；STRIDE 矩阵全绿；仅 2 条 LOW 遗留（DEBT 文档化 + 微计时差），不阻塞 |

**分歧**：无。三专家结论互不冲突；review 与 cso 对后端修复的核实（BLOCKER-1/F2/F3 落点）一致，design-review 对前端契约的核实（C1/R4-note）独立成立。

## 2. 修复过程摘要（r1 → r3）

**后端（review：r1 rejected → r2 approved）**
- r1 提出 1 BLOCKER + 1 CRITICAL + 6 INFO：BLOCKER-1（`build_countdown` 时区 naive-aware TypeError，详情 500 全链）、CRITICAL-2（删除↔星标并发孤儿星标，删除即丢星标记录）、F2（DELETE /star 存在性 oracle）、F3（批量移除无上限）。
- r2 修复：
  - BLOCKER-1 → `star_service.py:88-90` deadline/now 双 naive UTC + `_naive_utc` 双向归一化；回归测试 `TestCountdownReads`（archived+deadline → owner running / 星标 paused / stars 200 paused）。
  - CRITICAL-2 → Fix B（清扫兜底：admin cleanup `admin_service.py:329-334` + `cleanup_orphan_tombstones` `star_service.py:316-321`，`DELETE FROM entry_stars WHERE tombstone_id IS NULL AND entry_id NOT IN (...)`）+ Fix C（`star()` 服务层 entry 存在性校验 `star_service.py:125-126`）；回归测试 `TestOrphanStarSweep`。
  - F2 → `api/entries.py:457-464` get_entry_by_slug → has_star（含墓碑绑定）→ 无星标回退 get_entry 可读性校验 → unstar；回归测试 `TestDeleteStarOracle`。
  - F3 → `models.py:617` `entry_ids: max_length=500`；回归测试 `TestBatchRemoveLimit`。

**前端（design-review：r1/r2 needs-revision → r3 approved）**
- r2 提出 C1（CRITICAL）：前端 mock 自洽掩盖后端真实契约，transform 读错字段（顶层扁平 id/title 假设 vs 真实 `entry_id`/嵌套 `tombstone`）。
- r3/r4 修复（implementer r4 节）：C1-① transformTombstone、C1-② transformStarEntry（独立 transform，不复用 transformListItem）、C1-③ 类型嵌套（StarListItemResponse/TombstoneNestedResponse）、C1-④ 真实形状集成用例（真实 client + mock axios，断言从 axios.delete config 读 entry_ids）；R4-note（`remainingDays > 0` 下界与后端逐字对齐）+ toast 测试注释 4 处同步 + 桌面 44px 决策记录在案。

**安全（cso：r1 needs-revision → r2 approved）**
- r1 提出 F1-F8；r2 全部闭合/处理：F1 单点修复覆盖全部读路径、F2 oracle 消除、F3 上限、F4 stars 限速、F5 DEBT 文档化、F6 TOCTOU 注释、F7 双兜底清扫、F8 批量查询。

## 3. 遗留项（无阻塞）

- **DEBT（已文档化，P4-implementation-backend.md「遗留决策」）**：INFO-3/F5 list_starred 全量加载 + 内存过滤分页（per_page ≤ 100 封顶）；INFO-2 file_count 每行 1 查询（既有模式）。
- **LOW-2（cso 信息级）**：DELETE /star 未知 slug（1 查询）vs 不可读已知 slug（3 查询）微计时差——二进制 oracle 已消除，不阻塞。
- **信息性观察（design-review，无需改动）**：前端 active tab 公式对 paused+0 的理论差异为死代码（后端预过滤不具现）；`reason='expired'` 前端分支为前瞻性代码（当前后端仅产出 `author_deleted`）。
- 非阻塞建议处理方向（P2 遗留 3 条）已在 P4 落实：toast 测试字面同步 ✓、ConfirmDialog testid / loadEntries 传参由前端集成用例覆盖。

## 4. BDD 锚点引用

- BLOCKER-1 回归锚：archived + deadline 详情 200（owner running / 星标 paused）+ /stars 200（`TestCountdownReads`，对齐 P2 §4.4 countdown 优先级）。
- CRITICAL-2 回归锚：孤儿清扫 + star 不存在 entry 抛 NotFoundError（`TestOrphanStarSweep`）。
- F2 回归锚：非星标私有/archived/未知 slug → 404；星标用户 archived → 200（N9 保留）。
- F3 回归锚：501 → 422、空列表 → 422（`TestBatchRemoveLimit`）。
- C1 集成锚：TC-BDD14-04（批量 101）/TC-BDD22-01（单条+批量）从 axios.delete config 读 `entry_ids`。
- R4-note 锚：TC-BDD20-06（paused + remaining_days=0 不落入 expiring）。

## 5. 推进要求

- P4 gate 判定：P4-review.md 存在且 status: approved（agent=review-lead，非 main）✓
- 实现声明：单测 1288 passed / typecheck exit 0（design-review 复核声明，未复跑——P5 主 Agent 验 gate 复跑）
- 下一步：P5 技术验证（pytest 全绿 + 测试环境隔离 + `make lint && make typecheck`；预存失败登记 `known-failures.md`）
