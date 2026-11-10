---
phase: P2
task_id: TPV0102
type: review
parent: P2-design.md
trace_id: TPV0102-P2-review-20261110
status: approved
created: 2026-11-10
agent: review
role: 专家组组长（P2 汇总，不发表新意见）
review_round: 3
expert_votes: 2/2 approved
blockers: 0
transcribed_constraints: 23
prod_touched: false
---

# P2 专家组汇总 — Explore 列表体验修正

> **本文件性质**：P2 专家组组长**机械汇总**，不含任何新意见。全部结论来自两份专家评审，本文件不新增、不推翻、不补充。
> **输入**：`P2-review-eng.md`（`agent: plan-eng-review`，`status: approved`，`blockers: 0`）+ `P2-review-design.md`（`agent: plan-design-review`，`status: approved`，`review_round: 3`）
> **被评审对象**：`P2-design.md`（1406 行，`candidate_count: 7`，`ui_affected: true`）
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 1. 结论

**status: approved**

**专家票型：2 / 2 approved，0 BLOCKER。**

| 评审 | agent | status | blockers | 轮次 |
|---|---|---|---|---|
| `P2-review-eng.md` | `plan-eng-review` | **approved** | 0 | 第 2 轮复审（rev1） |
| `P2-review-design.md` | `plan-design-review` | **approved** | — （无 CRITICAL） | 第 3 轮复审（rev2） |

两份评审的 frontmatter `status` 与实际结论正文一致，未见自述与字段矛盾（机械核对项）。按组长规则「全票无 BLOCKER → approved」，本汇总结论为 `approved`。

**评审轨迹**（供下游引用）：P2 共 3 轮评审，retry 计数 **2/3**。

- 第 1 轮：eng `needs-revision`（4 阻塞）/ design `needs-revision`（20 项缺陷，视觉 6/10、交互 6/10）
- 第 2 轮（rev1）：eng `approved`（B-1~B-4 闭合）/ design `needs-revision`（D-1~D-5 闭合，视觉 8/10、交互 8/10，但新引入 N-1~N-5）
- 第 3 轮（rev2）：design `approved`（N-1~N-5 全闭合，N-3 改判，视觉 8/10、交互 8/10）

---

## 2. 各专家结论摘要

### 2.1 plan-eng-review（`P2-review-eng.md`）— approved

**总判**：4 个阻塞项（B-1~B-4）**全部真实闭合**，专家逐条独立复验而非采信 architect 自述；上轮确认通过项（数据流、状态机 5 转换、16/34 口径、`## UI 设计` 裸标题、frontmatter）**未被破坏**；架构问题（阻塞级）**无**。

| 阻塞项 | 闭合判据 | 结果 |
|---|---|---|
| **B-1** `P5_e2e` 写死文件名 + legacy 独立 key | 写死文件名无正则 alternation；缺文件能被 exit code 捕获（实测 `No tests found` + exit 1）；legacy 为独立 key（`is_legal_gate_key` = True）且指向的 spec 实测命中 12 tests；§6.3 写明 P3 必须创建该文件名 | **已闭合** |
| **B-2** `P5_e2e_timeout_seconds: 900` + §9 补理由 | 900 已落地；理由含内层超时点（`scripts/run-e2e-tests.sh:92` `E2E_TIMEOUT:-600`）+「外层必须大于内层硬超时」因果链 + 量级论证（30 BDD × 2 project）+ TPV0099 先例；专家独立核对脚本行号与引用一致 | **已闭合** |
| **B-3** 争议裁决：三件事配置是否完整正确 | 在真实执行通路（`agate_common.run_test_with_formatter` → `assets/formatters/pytest.sh` → `check-tdd-red.py::judge_result`）跑 A~G 七格矩阵 | **配置完整正确**（见下） |
| **B-4** `setVisibility` 补 `revokedShares` warning + 单测 | §3.5 成功分支含 `revokedShares > 0` warning toast；明确「不得静默丢弃」；§6.2 补对应单测（含 `>0` 产生 / 为 0 或 undefined **不产生** 两条）；登记面齐全；数据链路真实可达 | **已闭合** |

**B-3 裁决结论（三件事配置完整正确）**——专家独立复现三条各自的必要性：

1. **`--tb=no` → `--tb=short` 必须**：`--tb=no` + formatter 时 `import_errors=[]` 而 `errors=1`（formatter 靠逐行扫 `ModuleNotFoundError` 提取，`--tb=no` 抑制该行）→ 落 A 类分支。
2. **`P3_formatter: "pytest.sh"` 必须**：无 formatter → 走 `_fallback_json`（`import_errors` 空）→ 落 A 类分支。`project_module: "peekview"` 声明了却不被消费（只在 formatter 给出结构化 `import_errors` 时才起作用）。
3. **去 `tail` 必须**：真实全量套件下 `ModuleNotFoundError` 被截到 EOF 30 行之外（`grep -c` = 0），只剩 pytest 缩写形式 → 正则取不到 module → A 类。**只做 ①② 不做 ③ 仍假红。**

**B-3 附带两项专项判定**：`npx vitest run --reporter=dot` 退出码遮蔽风险 → **不成立**（三组实测均落 `classic red-light` exit 0，精度下降但不误判）；`[ $b -eq 0 ] && [ $f -eq 0 ]` 聚合语义 → **正确**（四组合实测，两套测试都会被执行，非 `&&` 短路链）。专家并自我更正上轮「无 formatter → 必然 A 类」的表述**不完整**。

**6 个非阻塞项（上轮建议）全部已处置**：`inFlight` 裸 `Set` → `ref<Set<string>>`；`applyPatch` / `restore` 补签名 + 字段契约表；「当前团队」两来源合并为 `teamId` + `teams` 反查派生；`EntryDetailHeader` prop 统一为 `:date-str`；`P5_fitness` 依赖测试函数名写死；`files_to_read` 补齐（实测 49 条、`os.path.exists` 零缺失）。

**本轮新发现 6 项，全部非阻塞**（已转抄为下方 C 系列约束）：

1. `P5_e2e_legacy_timeout_seconds: 600` 与设计自身「外层 > 内层」规则矛盾 → 建议改 900。
2. `toast` 归属重复 → 双 toast 风险，建议 store 与视图二者只居其一。
3. `[ $b -eq 0 ] && [ $f -eq 0 ]` 把所有非零码折叠为 1（pytest `exit 5` / `exit 4` 也判红灯通过）。
4. §6.2 的 6 个前端单测文件无「必须存在」机制（与 B-1 同源、严重度低）。
5. `useEntryDetailActions.handleToggleVisibility` 在 D6 移除入口后成无触发路径，但 §6.4#10 仍要求改其 toast 文案。
6. `env_constraints` 未登记当前沙箱的预存失败（`tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`，写 `~/.peekview/config.yaml` 只读），按 `AGENTS.md` 属「预存失败 → `known-failures.md` 登记，WARNING 不阻断」，**不是 P2 设计缺陷**。

**专家锁定决策（5+1 条）**：① B-3 三件事配置落定，**P2 固化后 P4-P6 不得改动**；② 序列化契约锁定在叶模型 mixin（A2）；③ tooltip 锁定真实 DOM + `visibility` 切换（C2，`z-index: 10`）；④ 可见性菜单锁定新建 `VisibilityMenu.vue`（B1）；⑤ 16 类/34 字段以遍历口径为准，P3 不硬编码 15/31；⑥ 本评审**不新增 DEBT 条目**。

**对上游两处断言的修正**（专家要求主 Agent 后续引用需用修正版）：① 主 Agent 的「保留 `tail` 会判假绿」在真实执行通路上**不可复现**（`agate_common.py:755-766` 强制前缀 `set -o pipefail;`），保留 `tail` 的真实后果是 **A 类假红**，**结论方向不变**（去 `tail` 仍必须）；② architect 的「18 项机械门槛全 PASS」在实质结论上成立，但 `check-gate.py P2` 在真实 task 目录当前是 exit 1（缺 `P2-review.md`），属**正常流程态**。

### 2.2 plan-design-review（`P2-review-design.md`）— approved

**总判**：**Status approved**。上轮 5 项缺口 N-1~N-5 **5/5 闭合**（其中 **N-3 改判**），复查「上轮判过、不应被破坏」的部分**全部未破坏**，E-1 / E-2 顺带处理**未引入新问题**，**未发现新的阻断级问题**；无 CRITICAL，无架构性返工需求，所有 BDD 均有实现路径与验收口径。

| 项 | 级别 | 结论 |
|---|---|---|
| **N-1** `Team.id` 不存在 | 高 | ✅ **已闭合** —— 改 `entry.team?.slug` 派生（4 处落点逐条实测）；专家复验 `TeamRef` / `Team` / `TeamSummary` **均无 `id`**（前后端双侧），全文 `t.id ===` 仅 2 处且均为否定陈述 |
| **N-2** `variant="sheet"` 切换主体悬空 | 中 | ✅ **已闭合** —— `useResponsiveLayout.ts` 真实存在（既有 2 处使用方），接线写死（`onMounted` add / `onBeforeUnmount` remove 成对）、三处 prop 链全覆盖、落地形态与先例一致；专家同时**纠正自己上轮的事实错误**（「项目无响应式机制」不成立） |
| **N-3** 44px 契约 vs 28×28 实现规格 | 高 | ✅ **本轮改判为闭合** —— 撤回上轮「契约必然在 P6 红」的结论（见下） |
| **N-4** `inline` / `icon` 文案 + `aria-label` 未定义 | 中 | ✅ **已闭合** —— 三态可见文案表 + `aria-label` 覆盖全部变体 + 唯一文案源 `visibilityStatusLabel` 防漂移，文案与源码**逐字**对上 |
| **N-5** §6.4#5 行号与影响面偏差 | 低 | ✅ **已闭合** —— 行号改 `:111-112` 逐行对上，影响面写清为 **3 条**断言（`:135` / `:143` / `:148`）；附带「不能沿用 `.status-tag` 类名定位」的理由实测属实 |

**N-3 改判理由（专家自述）**：① 上轮结论建立在「本版已推翻」的前提上（本版给新按钮单列 44px 媒体查询规则并限定选择器 `.visibility-toggle`，明确**不得**写到 `.card-action-btn` / `.action-btn` 上）；② 「既有 28×28 在范围内」是上轮误读（本版扩为 4 行「新 vs 既有」表，行 4 归属列直接写「既有组件 / 本任务不改」并登记 S2 债务）；③ 不因上轮判了高危而坚持。留下的 44 vs 28 并排密度属**视觉取舍**，不是契约矛盾。

**D-1~D-5（rev1 闭合的 5 个高级别项）**：派发说明记载于 rev1 闭合；本轮 §4 逐条复查了 **D-1 / D-2 / D-4 / D-5** 仍在且未被破坏。§4 另复查 B / C 候选与权衡、§5 两节「维度不适用」、BDD-30 对标 `OverflowMenu`、两项裁决（overflow 移除面 / `visibility-toggle` 沿用无 `visibility-menu-trigger` 残留）、`## UI 设计` 裸标题 —— **全部未破坏**。

**E-1 / E-2 顺带处理**：E-1（`P5_e2e_legacy_timeout_seconds: 600 → 900`）§9 实测读回 900，声明要点改写为「同理且必须等值」，**无新问题**；E-2（双 toast → 视图层唯一发出）§3.5 / §5 / §6.2 **三处一致**，**无新问题**。

**打分轨迹（三轮）**：

| 维度 | 第 1 轮 | 第 2 轮（rev1） | **第 3 轮（rev2）** |
|---|---|---|---|
| **视觉设计**（主分） | 6 / 10 | 8 / 10 | **8 / 10** |
| **交互设计细节**（主分） | 6 / 10 | 8 / 10 | **8 / 10** |
| 交互状态覆盖率 | — | 9 / 10 | **9 / 10** |
| AI Slop 风险（越高＝留白越少） | — | 7 / 10 | **9 / 10** |
| 移动端考虑 | — | 7 / 10 | **9 / 10** |
| 组件完整性 | — | 7 / 10 | **8 / 10** |
| 可访问性 / 键盘可达 | — | 8 / 10 | **9 / 10** |

**主分为何 8 → 8 不涨（专家明写理由）**：① 视觉的扣分中 2 分是「本任务不能修的既有债」——AA 对比度（S1 要改全局 `--c-text-tertiary`）、`status-tag` 的 10px / `1px 6px` 是刻意保持视觉权重的例外，P2 retry 里无论怎么改设计都拿不到分；② 交互的扣分落在「未接入面」（S-1~S-3）而非「已定义面」；③ 本轮的 8 分与上轮的 8 分不是同一质量——进步体现在 7 分项被拉上来（AI Slop 7→9、移动端 7→9、可访问性 8→9），主分天花板由既有债决定。

**本轮 4 项新发现全部判为 SUGGEST（不阻塞）**，集中在「详情页接入契约」+ 两处文档级小偏差，每项均给出**可照抄的 P4 默认路径**：**S-1**（中）`toggleVisibility` 处置未交代；**S-2**（中）详情页 `select` 落地主体未定义；**S-3**（中）详情页 `isOwner` 来源未进 prop 链；**S-4**（低）两处文档级偏差（`OverflowMenu.vue` 行号差 1、`applyPatch` 字段表 `team` 行与澄清块口径不一）。

**为何 approved 而非 needs-revision / rejected（专家自述）**：上轮判 needs-revision 的两条硬理由（N-1 无合法派生路径、N-3 冻结契约自相矛盾）**本轮都已消失**；残留 4 项都有 ≥2 条编译安全分支，最坏后果是 P5 一处可 2 行修掉的 `tsc` 报错或 P4 按默认路径接一处 handler；P2 retry 已到 2/3，用掉最后一个 retry 去换 4 行文档代价高于收益。无 CRITICAL，无架构性返工需求。

**UI 层 ≥2 候选 + 权衡复核**：决策点 B（B1/B2）、决策点 C（C1/C2/C3）、布局维度（§2.2b 三个被排除替代）均带实测结论且非稻草人；视觉维度「配色全部沿用既有变量」为**合理单候选，不扣分**。

---

## 3. 必须转抄给 P4 / P5 / P6 的执行约束

> 本节是本次汇总的**实质价值**：把两份专家评审里分散的结论变成下游可直接照做的清单。每条均标注来源专家小节。**本节不含任何新意见。**

### 3.1 锁定与冻结类

| # | 约束 | 来源 |
|---|---|---|
| **C-1** | **`gate_commands` 在 P2 固化，P4-P6 不得修改**——设计阶段是声明验证契约的唯一窗口 | eng §架构问题（非阻塞）1 + 锁定决策 1；P2 阶段卡「下游影响」 |
| **C-2** | **`P3` 必须同时满足三件事，缺一即假红**：① 用 `--tb=short`（不是 `--tb=no`）② 声明 `P3_formatter: "pytest.sh"` ③ **不使用 `2>&1 \| tail -30` 截断**。三者各自必要，专家已独立复现 | eng **B-3 裁决** + 锁定决策 1 |
| **C-3** | **`P5_e2e` 写死文件名** `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`，**不用正则 alternation**（旧形态命中 0 条本任务用例却 exit 0 = 假绿）。**P3 必须创建该文件名的 spec**；缺文件 → `No tests found` + exit 1 | eng **B-1** |
| **C-4** | **`P5_e2e_legacy` 为独立 key**（`E2E_SPEC=e2e/team-visibility.spec.ts make debug-test`），`team-visibility.spec.ts` 的既有回归**不并入** `P5_e2e`，各自独立跑、独立记录 | eng **B-1**；design rev2 E-1 |
| **C-5** | **`P5_e2e_timeout_seconds: 900` 且 `P5_e2e_legacy_timeout_seconds: 900`**（两者等值）。理由：`scripts/run-e2e-tests.sh:92` 的 `E2E_TIMEOUT:-600` 是**内层**硬超时，**外层命令级超时必须大于内层硬超时**，否则外层先到期会把内层连带杀掉，runner 的 `exit 124` 分支走不到、归因错乱 | eng **B-2** + 非阻塞 1；design rev2 **E-1** |
| **C-6** | **`P5_fitness` 依赖写死的测试文件名 + 测试函数名**：`backend/tests/test_utc_serialization.py` 与 `test_mixin_not_in_table_mro`（`-k` 子串匹配，可加类前缀）。**P3 必须保留该函数名**——`-k` 零命中 pytest exit 5，函数名被改 → `P5_fitness` 假红 | eng §非阻塞 5 + 「6 个非阻塞项处置」；design §9 |
| **C-7** | **P4 硬约束：store 内不得出现 `toast.show` / `useToast`**——`revokedShares` warning 的**唯一发出点是视图层**；store 只 `return { ok, revokedShares }`；对应前端 spec **不断言 toast** | eng 非阻塞 2（双 toast 风险）；design rev2 **E-2**（§5 已裁定三处一致） |

### 3.2 P4 可直接照做的默认路径 —— **P4 无需回问设计**

> 逐条转抄 `P2-review-design.md` §6「P4 默认路径」列原文要点。design 明确：「P4 implementer 请先读 §6 的『P4 默认路径』列（S-1/S-2/S-3 三条），按其中路径实现即可，**不必再回问设计**」。

| # | 项 | P4 默认路径（可直接照做） |
|---|---|---|
| **C-8**（**S-1**，中） | D4「`toggleVisibility` 替代为 `setVisibility`」与 D6「移除 overflow 项」未交代 `useEntryDetailActions.handleToggleVisibility` 的处置 | **保留 `toggleVisibility` 为薄包装**（`toggleVisibility(entry) => setVisibility(entry, entry.isPublic ? {kind:'private'} : {kind:'public'})`）**+ 删除** `useEntryDetailActions.handleToggleVisibility` 及其返回值项与 overflow 项；§6.4#10 **只保留** `EntryListView.vue:640` 一处文案改动。三处动作互不冲突，`tsc` / `noUnusedLocals`（`tsconfig.json:15-16` 已启用）全绿 |
| **C-9**（**S-2**，中） | 详情页 `VisibilityMenu` 的 `select` 落地主体未定义（§3.7 链图只下发 `teams` / `variant` / `teamsFailed`，**不含 `disabled`**） | `EntryDetailView` 加 `handleVisibilityChange(target)`：调 `entryListStore.setVisibility(currentEntry, target)`（store 内已有 `detailStore.syncVisibility`，见 `:645-647`，详情页状态会自动同步），按同一 `SetVisibilityResult` 四态发 toast；`disabled` 用 `entryListStore.inFlight.has(currentEntry.slug)`（store 已把 `inFlight` 做成 `ref<Set>`，`:624`）下发。**与 Explore 侧共用同一函数语义，不新增 API** |
| **C-10**（**S-3**，中） | 详情页 `isOwner` 来源未进 prop 链（`EntryDetailHeader` / `EntryMetaTagsBar` 现有 props 均无 `isOwner`，§3.7 链图也不含） | 在 `EntryDetailView` 已有 `authStore.isOwner(currentEntry?.ownerId ?? null)` 调用（`:37`，用于 `EntryDetailBanners`）处复用，给 header / meta-bar **新增 `:is-owner` prop 下传**（连带在 §6.4 补一条「该 spec 的 props 补 `isOwner`」）。**不要**在子组件内直连 store —— 那会打破 `tpv0095-detail-visibility-tag.spec.ts:18-30` 的 `useAuthStore` mock 契约（该 mock 无 `isOwner`，直连会 `TypeError`） |

**另转抄 S-4（低，文档级偏差，非 P4 实现缺陷）**：① `OverflowMenu.vue` 的 `aria-label` 先例在 **`:15`**（设计与上轮评审均写 `:14`，同文件其余引用 `:6` / `:11-12` / `:13-14` / `:123-126` / `:139-146` / `:148-156` **均准确**，只此一处偏移）→ 行号改 `:15`；② `applyPatch` 字段表 `team` 行（`:678`）标题为「无 `updated` 时」却写 `teamId = <数字 id>`，与紧跟的澄清块（`:680-688`）「乐观路径**不写** `teamId`」口径不一 → 表行该格改为「`teamId` 见下澄清（乐观路径不写，待服务端响应回填）」。

### 3.3 P3 / P4 既有断言更新面

| # | 约束 | 来源 |
|---|---|---|
| **C-11** | **P3 / P4 须显式更新 TPV0095 BDD-40 断言（4 单测 + 1 E2E）**，禁止静默改断言。具体 5 处：① `e2e/team-visibility.spec.ts:137-152`（E2E，团队 entry `visibility-toggle` count = 0 → **≥ 1**）② `src/components/__tests__/tpv0095-entry-card-team.spec.ts:78-90` ③ `src/components/__tests__/tpv0095-entry-list-row-team.spec.ts:75-86` ④ `src/stores/__tests__/tpv0095-entry-list-store-team.spec.ts`（团队 entry `toggleVisibility` 返回 false → `setVisibility` 正常发起请求）⑤ `src/components/__tests__/tpv0095-detail-visibility-tag.spec.ts:111-112`（`statusTagText()` 助手改定位 `[data-testid="visibility-toggle"]`；**改助手即一并覆盖 `:135` / `:143` / `:148` 三条断言**，不要只改一处） | eng 锁定决策 + design §6.4#1~#5 |
| **C-12** | **必须拆掉 `if ((await teamCard.count()) > 0) { … }` 守卫**——改为前置断言 `await expect(teamCard).toHaveCount(1)`，再断言 `visibility-toggle` count ≥ 1。不拆守卫则卡片没渲染时断言同样被跳过 → 翻转后**仍是假绿** | eng 「6 个非阻塞项处置」+ design §6.4#1 |
| **C-13** | **P7 必须记录「TPV0095 BDD-40 被本任务有意取代」**（陷阱 16 / R5）；`visibility-toggle` **沿用不改名**，使 BDD-40 断言语义变为「团队 entry **有** `visibility-toggle`」，只需翻转断言值 | design §6.4 + 裁决 2 + §3.8；eng 复核 |
| **C-14** | **P3 必须创建 §6.2 的 6 个前端单测文件**（其中 `visibility-menu.spec.ts` / `entry-list-visibility.spec.ts` 为新增）。`P5_frontend: make test-frontend` 只跑已发现的 spec，缺文件 → 静默绿（与 B-1 同源，严重度低，`P5` 全覆盖 + P6 逐条 BDD 实跑兜底） | eng 非阻塞 4 |
| **C-15** | **P3 执行者须做附加自检：断言条数 `passed + failed + errors > 0`**。原因：`[ $b -eq 0 ] && [ $f -eq 0 ]` 把所有非零码折叠为 1，pytest `exit 5`（零收集）/ `exit 4`（usage error）也会被记为红灯通过；若用例写进未被收集的文件，P3 仍判红灯通过。**不要求改命令** | eng 非阻塞 3 |

### 3.4 P5 / P6 验收与报告

| # | 约束 | 来源 |
|---|---|---|
| **C-16** | **P6 报告禁令①：不得写「对比度已满足 WCAG AA」**——`--c-text-tertiary` 实测 tertiary 亮 **3.04:1** / 暗 **3.84:1**，低于 AA 4.5:1；S1 未修，属既有债，本任务不改色 | design §7 视觉维度 + §8 判定依据 4 + §8 交接提示 |
| **C-17** | **P6 报告禁令②：不得把既有 28×28 按钮写成「已达标」**——**VC-4 只断言组件一致性节表内第 1 行**（本任务新增 `VisibilityMenu` 移动端 `variant="sheet"` 44×44）；桌面 `variant="icon"` 28×28、`variant="inline"` 沿用 `status-tag`、既有删除按钮 28×28 **均不断言**（行 4 明写「既有，本任务不改」） | design §3 N-3 改判 + §5 组件一致性节 + §8 交接提示 |
| **C-18** | **P6 须在既有两份截图之外加看一处**：`mobile_390x844` 下卡片 `card-actions` 内 **44×44（新 `VisibilityMenu`）与 28×28（既有删除）并排**的垂直对齐与密度表现——VC-1~VC-7 未覆盖（VC-7 只覆盖桌面 `meta-row`）。这不是契约矛盾（行 1 与行 4 的尺寸差异是显式设计） | design §6 末段（视觉判断，供 P6 复核） |
| **C-19** | **0 文件 entry 验收素材须走 debug backend HTTP API 现造**：`curl -X POST http://127.0.0.1:8888/api/v1/entries`（空 `files` 数组）；**禁** `peekview create`（陷阱 14 / I-19）。原因：`scripts/seed-debug.py:183-185` 的 `if not files: SKIP` 使 `seed-data/image-gallery` **不入库**，无现成 0 文件素材 | design §6.3 + §2.4 + `test_data_rule` |
| **C-20** | **P5 必须登记当前沙箱的预存失败**到 `known-failures.md`（WARNING 不阻断）：`tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 在本环境因写 `~/.peekview/config.yaml` 只读而 red（HOME 可写时 exit 0 通过）。**不登记会被误读为本任务回归** | eng 非阻塞 6 |
| **C-21** | **P3/P4 的 `expected_red` 登记**：`backend-serialize` 批的 `tests_filter` 在 P3 红灯基线期**应红**（该批交付面测试先于实现）；`mount-explore` / `mount-detail` 批会因 TPV0095 BDD-40 断言（陷阱 16 / R5）在设计上应红 —— 须在 `P4-evidence/{batch}.log` 的 `expected_red` 键登记 | design §2.4 |

### 3.5 主 Agent 后续引用须用修正版断言

| # | 约束 | 来源 |
|---|---|---|
| **C-22** | ① 主 Agent 的「`--tb=short` + formatter + 保留 `tail` → judge 判**假绿**」在真实执行通路上**不可复现**（`agate_common.py:755-766` 执行命令时强制前缀 `set -o pipefail;`）——保留 `tail` 的真实后果是 **A 类假红**；**结论方向不变**（去 `tail` 仍必须），但**机制依据**须改用 E 格实测。`P2-design.md:993-995` 与 V10 表述与此一致，**无需改**。② architect 的「18 项机械门槛全 PASS」在实质结论上成立，但 `check-gate.py P2` 在真实 task 目录当前是 exit 1（缺 `P2-review.md`）——属**正常流程态，不是缺陷**（本文件产出后消除） | eng「对上游两处断言的修正」 |
| **C-23** | **专家锁定决策（下游沿用，不得回退）**：① 序列化契约锁定在**叶模型 mixin**（A2），`EntryBase` / `UserBase` 保持 `(SQLModel)`，`P5_fitness` 守 MRO ② tooltip 锁定**真实 DOM + `visibility` 切换**（C2），`z-index: 10` ③ 可见性菜单锁定**新建 `VisibilityMenu.vue`（B1）**，业务规则收敛进两个纯函数 ④ **16 类 / 34 字段以遍历口径为准**，P3 不硬编码 15/31，P6 记录差异为预期 ⑤ 本任务**不新增 DEBT 条目**（6 项新发现均为本任务内可一并处理的设计细节或 P5 登记动作） | eng 锁定决策 1~6；design §8 判定依据 5 |

**合计转抄 23 条（C-1 ~ C-23）。**

---

## 4. 专家组分歧

**无分歧。**

- 两份评审 `status` 均为 `approved`，均**无 BLOCKER**（eng frontmatter `blockers: 0`；design 明确「无 CRITICAL，无架构性返工需求」）。
- 两位专家**无相互矛盾的结论**：eng 的 B-3 裁决与 design 的 N-1~N-5 判定作用于不同维度（工程执行通路 vs UI 契约），互不覆盖。
- 两位专家的非阻塞发现**同向收敛、无冲突**：
  - eng 非阻塞 1（`P5_e2e_legacy_timeout_seconds: 600` 与自身规则矛盾）→ design rev2 **E-1 已修正为 900**（组长机械核对：实测 `P2-design.md:1131` 为 `P5_e2e_legacy_timeout_seconds: 900`），该条**已无需再处置**。
  - eng 非阻塞 2（双 toast → 建议保留视图层四态、store 只 `return { revokedShares }`）→ design rev2 **E-2 采用同一方向**并写明「三处一致，无新问题」。
  - eng 非阻塞 5（`useEntryDetailActions.handleToggleVisibility` 无触发路径 / §6.4#10 登记失效）→ design rev2 **S-1 对同一文件的处置给出默认路径**，两者描述同一处代码、结论不冲突。
- design 的 **N-3 改判**与专家上轮自我更正（eng 对自身「无 formatter → 必然 A 类」的更正、design 对「项目无响应式机制」的更正）均为**专家自述的自我更正**，不是两位专家之间的分歧。

按组长规则，无分歧、无 BLOCKER、全票 approved → 交人工复核的「专家组分歧」项为空（`status: approved`）。

---

## 5. 门槛自检

| 项 | 结果 |
|---|---|
| 本文件存在且非空 | ✅ |
| frontmatter `status: approved` | ✅ |
| frontmatter `agent: review`（**非 `main`** —— `check-gate.py P2` 硬拦截 `agent=main` 的 approved） | ✅ |
| 两份专家评审 status 读取、正文字段一致性机械核对 | ✅ 一致 |
| 已转抄 P2 派发指引 §「汇总内容要求」全部条目（S-1~S-3 默认路径 / P6 两条禁令 / `gate_commands` 冻结说明 / BDD-40 断言更新 / 0 文件 entry 素材） | ✅ C-1 ~ C-23 |
| 已声明专家组分歧 | ✅ **无分歧**（§4） |
| `check-frontmatter.py P2-review.md` | 见下方实测行 |
| 只读纪律 | ✅ 未运行任何写类 agate 工具；未执行破坏性 git 命令；唯一写入为本文件 |
| 环境隔离 | ✅ [PROD_NOT_TOUCHED] —— 未触碰 `:8080`、未访问/写入 `~/.peekview/`、未启动任何后端或浏览器实例 |

**实测命令**：`python3 /home/kity/.agate/v0.83.1/agate/scripts/check-frontmatter.py P2-review.md` → **exit 0**
**字段回读**：`agate-md-field-get.py status` → `approved`；`agate-md-field-get.py agent` → `review`

**`git status --porcelain` 核验**：基线 16 项（1 项 `M orchestrator-log.md` + 15 项未跟踪编排侧文件，均为既有），本次唯一新增为
`?? agate-workspace/tasks/TPV0102-explore-card-list-ux/P2-review.md`（本文件）。
**仓库代码区（`agate-workspace/` 之外）无任何改动** —— 零代码写入。
