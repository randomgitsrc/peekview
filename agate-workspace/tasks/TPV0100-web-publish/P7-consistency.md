---
phase: P7
task_id: TPV0100
type: consistency
parent: P2-design.md
trace_id: TPV0100-P7-20261002
status: approved
created: 2026-10-02
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 3
design_gap_reviewed_count: 3
code_map_new_files_count: 0
code_map_reviewed_count: 0
---

# P7 一致性检查 — TPV0100 网页发布入口

> 审查对象：`P1-requirements.md` / `P2-design.md` / `P3-test-cases.md` / `P4-implementation.md` / `P6-acceptance.md` / `P6.5-judge-verdict.md`。
> 本阶段**只审不改**；未修改任何上游产出或代码。证据均来自实读源文件 + `grep`（命令显式带 `timeout`）。
> `[PROD_NOT_TOUCHED]`——全程只读仓库与 agate 工作区，未起服务、未触碰生产 `:8080` 与 `~/.peekview/`。

---

## 1. DESIGN_GAP 配对（硬门）— 3/3 转抄 + REVIEWED

源：`P4-implementation.md` 逐行计数 `grep -cE '^\[DESIGN_GAP:'` = **3**，`grep -cE '^\[DESIGN_GAP_RESOLVED:'` = **2**。
以下逐条转抄 P4 声明，并核对主 Agent 裁决事实与源码落地。

### 1.1 DESIGN_GAP #1 — §2.5 limits 双拼写（`P4-implementation.md:64`）

[DESIGN_GAP: P2 §4.5/M8 未规定纯校验函数接收的 limits 形状。P3 vitest 以原始 API 形状（snake_case：max_entry_files/max_slug_length/...）直接调用 validatePublishForm/buildEntryPayload/computePayloadFingerprint，而 M6 声明的 PublishLimits 是 camelCase。实现中让校验层接受双拼写（snake_case 优先，兼容 camelCase），api.getLimits() 仍返回 M6 的 camelCase PublishLimits，两侧均可工作。]

[DESIGN_GAP_REVIEWED: 主 Agent 裁决「校验层接受 snake_case 优先、兼容 camelCase 双拼写；`getLimits()` 返回 camelCase」已落地。实读 `frontend-v3/src/composables/usePublishValidation.ts`：`LimitsInput` 同时声明 `max_entry_files?/maxEntryFiles?` 与 `max_slug_length?/maxSlugLength?`，内部归一 `maxEntryFiles: limits.maxEntryFiles ?? limits.max_entry_files`（L63）、`maxSlugLength: limits.maxSlugLength ?? limits.max_slug_length`（L65）；`frontend-v3/src/api/client.ts:224` `async getLimits(): Promise<PublishLimits>` 返回 camelCase。两侧均可工作，与 P2 §4.5 M8 契约缺口闭合。]

### 1.2 DESIGN_GAP #2 — §2.6 既有 UserMenu 单测与 M2 冲突（`P4-implementation.md:69`）

[DESIGN_GAP: M2 要求在 UserMenu 下拉新增 Publish 项，但既有 src/components/__tests__/UserMenu.spec.ts 硬断言下拉恰有 3 项(.dropdown-item)且文本为 ['Teams','Settings','Logout']。新增任何 .dropdown-item 都会使该 8 条既有用例回归。为满足「既有单测不回归」硬门槛且不改测试，实现中给 Publish 项使用独立类名 dropdown-item-publish（样式与 .dropdown-item 等价，视觉一致），使其不被既有 `.dropdown-item` 选择器计入；E2E BDD-1 通过 data-testid 定位不受影响。若认为应让 Publish 复用 .dropdown-item 并同步更新既有 UserMenu 单测，请主 Agent 裁决。]

[DESIGN_GAP_REVIEWED: 主 Agent 裁决「Publish 项回归 `.dropdown-item`（附 `.dropdown-item-publish` 语义类），下拉 3→4；同步更新 `UserMenu.spec.ts`/`T079-entry-detail-header.spec.ts` 断言」已落地。实读 `UserMenu.vue:10` `class="dropdown-item dropdown-item-publish" data-testid="user-menu-publish-item"`（原取巧独立类名已移除，`:159` 保留 `.dropdown-item-publish` 加粗语义）；`UserMenu.spec.ts` 4 处 `toBe(4)`（L102/117/132/147）、`T079-entry-detail-header.spec.ts` 2 处 `toBe(4)`（L184/214）。与 P4 §2.6/§4 裁决一致，`make test-frontend` 1364 passed 无回归。]

### 1.3 DESIGN_GAP #3 — §4 BDD-22 端点（`P4-implementation.md:99`）

[DESIGN_GAP: BDD-22 用例断言 GET /entries/{slug}/raw 的 body.owner_id，但 raw 端点 schema（EntryRawResponse, models.py:776-785）不含该字段，导致该用例在任何正确的前端实现下都必失败。前端已正确以登录用户归属创建 entry（POST/GET 响应 owner_id 均为 alice id=1）。需主 Agent 裁决：要么修 P3 测试改用 GET /entries/{slug} 或 POST 响应，要么（违反后端零改动）扩 raw schema。本条测试缺陷不在 P4 可修范围。]

[DESIGN_GAP_REVIEWED: 主 Agent 裁决「BDD-22 端点由 `/raw` 改为 `GET /api/v1/entries/{slug}`（`EntryResponse` 含 `owner_id`），业务意图不变」已落地。实读 `frontend-v3/e2e/tpv0100-publish.spec.ts:558` `request.get(.../api/v1/entries/${actualSlug})` + `:562` `expect(body.owner_id, 'BDD-22: owner_id 须等于 alice 的 id')`，原 `/raw` 断言已去除；后端零改动。修后 E2E 40/40 全绿，P6 evidence 中 `screenshots/bdd-22-ownership.png` + `assert-bdd-22.json` 佐证。]

### 1.4 P4 另 2 条 `[DESIGN_GAP_RESOLVED]`（主 Agent 裁决已落地）转抄 + REVIEWED

[DESIGN_GAP_RESOLVED: 主 Agent 裁决授权修测试。Publish 项改为复用 `.dropdown-item`（附加 `.dropdown-item-publish` 语义类做加粗），下拉项由 3 → 4；同步更新既有 `UserMenu.spec.ts`（4 处 `toBe(3)`→`toBe(4)` + 文本数组 `['Teams','Settings','Logout']`→`['Publish','Teams','Settings','Logout']` + Settings/Logout 索引 +1）与 `T079-entry-detail-header.spec.ts`（2 处）。`make test-frontend` 复跑 1364 passed 全绿。原取巧类名已移除。]

[DESIGN_GAP_REVIEWED: 与 §1.2 DESIGN_GAP #2 同源配对（RESOLVED 标记为裁决落地态），源码证据同上——`UserMenu.vue:10` 双类名、两 spec 各 4/2 处 `toBe(4)`。已落地。]

[DESIGN_GAP_RESOLVED: 主 Agent 裁决授权修测试。BDD-22 端点由 `GET /entries/{slug}/raw` 改为 `GET /api/v1/entries/{slug}`（响应含 owner_id），业务意图不变（断言 created entry 归属登录用户 alice）。修后 E2E 40/40 全绿，含该用例在 chromium + Mobile Chrome 两个 project。后端零改动。]

[DESIGN_GAP_REVIEWED: 与 §1.3 DESIGN_GAP #3 同源配对（RESOLVED 标记为裁决落地态），源码证据同上——`tpv0100-publish.spec.ts:558/562` 用 `GET /api/v1/entries/{slug}` 断言 `owner_id`。已落地。]

**配对结论**：P4 声明的 3 条 `[DESIGN_GAP]` 全部转抄并配对 `[DESIGN_GAP_REVIEWED]`；2 条 `[DESIGN_GAP_RESOLVED]` 一并转抄并配对 REVIEWED（与其对应 DESIGN_GAP 同源）。
`design_gap_count=3`，`design_gap_reviewed_count=3`（RESOLVED 为落地态标记，不另计 design_gap 数）。

---

## 2. SCOPE+ 闭环

- **P1 侧**：`grep -nE '^\s*\[(NEED_CONFIRM|BLOCKER|DEVIATION-CRITICAL|SCOPE\+|SCOPE_RESOLVED)' P1-requirements.md` → **零命中**。P1 仅有 `[NO_NEED_CONFIRM]`（§4/§7，非 SCOPE+ 触发体），故 **P1 无 `[SCOPE_RESOLVED]`** 属正确——闭环要求由「P1 存在行首 `[SCOPE+]`」触发，本任务 `[SCOPE+]` 产生在 P2 §9 而非 P1，故 P1 无需 SCOPE_RESOLVED 标记。与派发指引已知事实一致，**记录为通过（非缺陷）**。
- **P2 §9 的 2 处 `[SCOPE+]`**（`P2-design.md:587/590`）：
  1. **R3 错误体形状**：spec/BDD-26 称"含 detail"，实测 400 为 `{"error":{"code","message"}}` → 前端按 `error.message` 提取。
  2. **R4 结果态链接源**：`CreateEntryResponse.url` 为服务端 `base_url`，非当前源 → 前端用 `window.location.origin` 自拼。
- **吸收核对**：
  - ①在 P2 设计中吸收：`P2§4.6` 错误体形状表（400 `error.message` vs 422 `detail[].msg` 拼接，`extractApiErrorMessage` 统一）+ `P2§4.3`/§4.11 链接构造（不用 `response.url`）。
  - ②在 P4 实现中吸收：`P4§2.3` `extractApiErrorMessage` 依次 429→`data.error.message`(400)→`data.detail` 字符串/数组(422)→兜底；`frontend-v3/src/api/client.ts:218-219` `pageLink/rawLink` 用 `window.location.origin`（**非** `response.url`）。P4-review.md:119 亦复核确认。
  - ③**未新增 BDD**：P1 保持 30 条（`grep -c '^#### BDD-' P1-requirements.md` = 30），与派发指引已知事实一致。
- **SCOPE+ 闭环结论**：2 处 `[SCOPE+]` 均已在 `P2§设计` + `P4§实现` 吸收，未新增 BDD；P1 无 `[SCOPE_RESOLVED]` 符合触发规则。**通过**。
  > 说明：gate 卡「SCOPE+ 闭环」硬要求 P1 有 `[SCOPE_RESOLVED]`，本任务因 `[SCOPE+]` 落在 P2 而非 P1，闭环以 P2 §9 声明 + P4 吸收证据满足；此为规则适用性判定，非缺漏。

---

## 3. 跨文件一致性

### 3.1 BDD 数量三对齐

| 来源 | 事实 | 证据 |
| :--- | :--- | :--- |
| `P1§BDD` | 30 条（标题数） | `grep -c '^#### BDD-' P1-requirements.md` = 30，编号连续 BDD-1..BDD-30 |
| `P6§验收` | 30 PASS / 0 FAIL | `grep -c '^- PASS BDD-' P6-acceptance.md` = 30；frontmatter `pass: 30, fail: 0` |
| `P6.5 judge` | criteria_total=30, passed=30 | `P6.5-judge-verdict.md` frontmatter `criteria_total: 30` / `criteria_passed: 30` / `partial: false` |

**结论**：P1 BDD 数（30）== P6 PASS 数（30）== P6.5 criteria_total（30）。**一致**。

### 3.2 M1–M14 落点 vs P4 改动清单

实读存在性核对（15 个文件全部 `OK`）：`router.ts`(M1) / `UserMenu.vue`(M2) / `EntryListView.vue`(M3) / `api/client.ts`(M4) / `api/types.ts`(M5) / `types/index.ts`(M6) / `composables/useFileEncoding.ts`(M7) / `composables/usePublishValidation.ts`(M8) / `views/PublishView.vue`(M9) / `components/FileDropZone.vue`(M10) / `components/PublishFileList.vue`(M11) / `components/PublishResultPanel.vue`(M12) / `DESIGN.md`(M13) / `e2e/tpv0100-publish.spec.ts`(M14)。

- `P2§1.1` 声明 M1–M14 全部落点 = `P4§1` 改动清单 1–13（源文件）+ M14（E2E，P4 注由 P3 提供）。
- P4 清单额外含 #14 `UserMenu.spec.ts` / #15 `T079-entry-detail-header.spec.ts` / #16 `tpv0100-publish.spec.ts`（E2E 修订）——均为 `§1.4` 两条 `[DESIGN_GAP_RESOLVED]` 的**主 Agent 裁决授权修测试**落点，不属 P2 M1–M14 的设计新增文件范围，计入 authorized deviation（见 §3.4）。
- `P4§1` 标注 `[SCOPE_GAP]`：无。**吻合**。
- `P2§follows_existing_pattern` / UI 维度候选落点（§2.x L1/R1/E1）在 P4 实现中可核对：`PublishView.vue` 单列 720px 容器、结果态 `v-if` 替换主区、`PublishFileList` 内联行编辑（path 输入 + `:key=fileId`）——与 `P2§2.x.1/2.x.2/2.x.3` 采用项一致。

**结论**：`P2§1.1 M1–M14` 与 `P4§1` 改动清单吻合；额外 3 个测试文件修订有主 Agent 裁决背书。**一致**。

### 3.3 `P2§packages` vs P8 bump 范围

- `P2§frontmatter` `packages: [peekview-frontend, docs]`；`P1§range声明 §7` 同声明；`domains: [frontend]`。
- 本任务**不 bump 版本**：`VERSIONS.json` 仍为 `peekview: 0.25.0` / `mcp_server: 0.12.0`，git log 最新为 P6.5 commit，无 bump commit。P4 §5 确认后端/MCP 零改动（仅 `backend/peekview/static/` 构建产物）。
- 实际改动范围 = `frontend-v3/**` + `DESIGN.md`（docs）→ 与 `P2§packages` 声明的 `peekview-frontend + docs` 一致。P2 未声明 MCP/backend 包，实际亦无。
- `P8§发布准备` 预期仅产出文件（releaser 不 commit/tag），bump 若发生须由主 Agent 裁决——**与 packages 声明无冲突**。

**结论**：`P2§packages`（`peekview-frontend, docs`）与本任务实际改动范围及 P8 预期发布范围一致；本任务不 bump 版本，MCP/后端零改动。**一致**。

### 3.4 P4 实现路径 vs P2 方案设计吻合度（含 authorized deviation 登记）

| 维度 | P2 设计 | P4 实现（实读证据） | 判定 |
| :--- | :--- | :--- | :--- |
| 编码规则 | §4.4：NUL→binary / 严格 UTF-8 失败→binary / 0 字节→文本 | `useFileEncoding.ts` `TextDecoder('utf-8',{fatal:true})` | 吻合 |
| 幂等键 | §4.2：载荷指纹变则换键 | `computePayloadFingerprint` + `watch` 重置 | 吻合 |
| 错误提取 | §4.6：400 `error.message` / 422 `detail[].msg` | `extractApiErrorMessage`（P4§2.3） | 吻合 |
| 结果态链接 | §4.3：`window.location.origin`，不用 `response.url` | `client.ts:218-219` | 吻合 |
| a11y | §3.4：`aria-describedby`+`aria-invalid`+`role="alert"` | `P4§2.7` 按契约 | 吻合 |
| fileErrors key | §4.5 rev1：`Record<fileId,msg>` | P4§1 #8 「fileErrors 以稳定 fileId 为键」 | 吻合 |

- **authorized deviation 登记（2 项，均非 BLOCKER/CRITICAL）**：
  1. 测试文件修订（`UserMenu.spec.ts` / `T079-entry-detail-header.spec.ts` / `tpv0100-publish.spec.ts`）——主 Agent 裁决授权，见 `P4§1.4` + `[DESIGN_GAP_RESOLVED]`。
  2. limits 双拼写容器（`usePublishValidation.ts` 接受 snake_case + camelCase）——主 Agent 裁决，见 `P4§2.5` `[DESIGN_GAP]` + REVIEWED。
- 二者均已由主 Agent 裁决并在源码落地，**不构成 DEVIATION-CRITICAL**（`deviation_critical_count: 0`）。

**结论**：`P4§实现路径` 与 `P2§方案设计` 吻合；仅存的实现细节偏差均已走 DESIGN_GAP 裁决闭环。**一致**。

---

## 4. 未决项清零

- `P1-requirements.md`：`grep -nE '^\s*\[(NEED_CONFIRM|BLOCKER|DEVIATION-CRITICAL)'` → **零命中**。P1 仅 `[NO_NEED_CONFIRM]`（正常闭合态）。
- `P6-acceptance.md`：`pass: 30 / fail: 0`，无残留 `[NEED_CONFIRM]`/`[BLOCKER]`。
- `P4-implementation.md`：无 `[BLOCKER]`/`[DEVIATION-CRITICAL]`；3 条 DESIGN_GAP 已 REVIEWED。

**结论**：`P1§待确认清单` 清零，`P6§验收` 无未决项，`P4§实现` 无 BLOCKER。**通过**（`blocker_count: 0`，`deviation_critical_count: 0`）。

---

## 5. CODE-MAP 核对

`agate-workspace/agents/CODE-MAP.md` **不存在**（该目录仅含 `project.md`）→ CODE-MAP 机制未采用，**跳过**。
`code_map_new_files_count: 0`，`code_map_reviewed_count: 0`（按契约留 0）。
> 不产出 `[CODE_MAP_DRIFT:]`/`[CODE_MAP_SYNC:]` 标记。

---

## 6. 决策落点核对

`agate-workspace/decisions/` **不存在**（`ls` 报"没有那个文件或目录"）→ 无跨任务架构决策需核对，**跳过**。
本任务未证伪任何既有决策，无「已过时」标注需求。

---

## 7. 逐项检查结果汇总

| # | 检查项 | 结论 | 关键锚点 |
| :--- | :--- | :--- | :--- |
| 1 | DESIGN_GAP 配对（硬门） | ✅ 3/3 转抄 + REVIEWED；2 条 RESOLVED 一并 REVIEWED | `P4§2.5/§2.6/§4` |
| 2 | SCOPE+ 闭环 | ✅ P2 §9 两处已吸收，未新增 BDD；P1 无 SCOPE_RESOLVED 属规则正确 | `P2§9` / `P4§2.3/§4.3` |
| 3.1 | BDD 数量三对齐 | ✅ 30 == 30 == 30 | `P1§BDD` / `P6§验收` / judge |
| 3.2 | M1–M14 vs P4 清单 | ✅ 吻合（+3 测试文件授权修订） | `P2§1.1` / `P4§1` |
| 3.3 | packages vs P8 bump 范围 | ✅ `[peekview-frontend, docs]` 一致，不 bump 版本 | `P2§packages` / `VERSIONS.json` |
| 3.4 | 实现路径 vs 方案设计 | ✅ 吻合（2 项 authorized deviation 已裁决） | `P4§impl-path` |
| 4 | 未决项清零 | ✅ 无 NEED_CONFIRM/BLOCKER/DEVIATION-CRITICAL | `P1§待确认清单` |
| 5 | CODE-MAP 核对 | ⏭ 机制未采用（CODE-MAP.md 不存在），留 0 | `agents/` 仅 project.md |
| 6 | 决策落点核对 | ⏭ decisions/ 不存在，跳过 | `agate-workspace/decisions/` |

## 8. 结论

**PASS** —— 无 `[BLOCKER]`、无 `[DEVIATION-CRITICAL]`；DESIGN_GAP 全部配对 REVIEWED（3/3）；SCOPE+ 已闭环；`P1§BDD`/`P6§验收`/judge 数量三对齐；`P2§packages` 与实现/发布范围一致。

- `blocker_count: 0`
- `deviation_count: 0`
- `deviation_critical_count: 0`
- `design_gap_count: 3`，`design_gap_reviewed_count: 3`（配对率 100%）
- `code_map_new_files_count: 0`，`code_map_reviewed_count: 0`（机制未采用）

**放行至 P8**（发布准备）。
