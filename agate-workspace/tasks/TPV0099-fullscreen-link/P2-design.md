---
phase: P2
task_id: TPV0099
type: design
parent: P1-requirements.md
trace_id: TPV0099-P2-20260928
status: draft
created: '2026-09-28'
agent: architect
candidate_count: 3
packages:
- frontend-v3
- docs
domains:
- frontend
ui_affected: true
ui_design_section: true
dispatch_plan: {mode: single}
---

# P2 方案设计 — 全屏模式链接 `/{slug}/f`（TPV0099）

> 上游：`P1-requirements.md`（19 条 BDD，BDD-1~BDD-19 连续；`[NO_NEED_CONFIRM]`；经 3 轮独立评审闭合）
> 上游约束：`P0-brief.md`（三个 P0 决策已被用户裁决锁定，本阶段不重开）
> 环境：debug backend `http://127.0.0.1:8888`（v0.24.1）；Chrome CDP `:18800`；工作区无 `agate-workspace/decisions/`（无既有跨任务架构决策需对齐，已核）

---

## 0. 导语：本任务的性质与「零 CSS 改动」的边界

本任务的实现面**极窄**——一句话：**新增一条路由 + 让 `zenMode` 由路由派生 + 锁死键盘短路 + 换掉公告文本 + 同步文档**。P1 已实核确认「meta 条隐藏早已存在」（`EntryDetailView.vue:260`，自 T082 起），故 **预期零 CSS 改动**；"zen 外观统一"不存在取舍。

但**验证面极宽**：19 条 BDD 中 15 条落在真实浏览器行为（路由归属、DOM 可见性、几何度量、键盘分发、滚动容器），故本任务的风险重心不在"写多少代码"，而在"**判据是否真的能拦住失败态**"与"**验证契约是否可执行**"。

---

## 1. 影响面梳理（强制节，写在候选方案之前）

### 1.1 改什么（Modify）

落点均到"哪个文件的哪个小节/函数"。

| # | 文件 : 落点 | 改动内容 | 关联 BDD |
|---|---|---|---|
| M1 | `frontend-v3/src/router.ts` : `routes` 数组第 48-52 行 `/:slug` 之后、第 53-57 行 `/:pathMatch(.*)*` **之前** | 新增 `{ path: '/:slug/f', name: 'detail-zen-locked', component: () => import('./views/EntryDetailView.vue'), props: true, meta: { zen: 'locked' } }` | BDD-1/13/18/19 |
| M2 | `frontend-v3/src/composables/useZenMode.ts` : `useZenMode()` 函数体（全文 36 行） | ① 新增 **`locked: () => boolean` 入参**（默认 `() => false`）；锁定态为**只读派生**（computed），**不落 ref、不落任何可变状态**（**文中不存在 `lockedMode` 这个状态变量**）；② `zenMode` 由 `ref(false)` 改为 **`computed(() => locked() \|\| manualZen.value)`**（**读取 thunk 一律写 `locked()`**，禁止写成 `lockedMode.value` / `locked.value`）；③ **移除 `updateZenAria`**（并从返回对象一并移除该键；全仓非测试代码零消费方，已核）；`zenAriaText` 改为 **`computed`**，锁死文案分支由该 computed 承载（**不给只读 computed 加任何赋值分支**）；④ `handleZenKeydown` 顶部加锁死短路 | BDD-4/5/6/12；BDD-1/2/14（外观由 zenMode 承载） |
| M3 | `frontend-v3/src/views/EntryDetailView.vue` : `<script setup>` 第 155 行（`useZenMode()` 调用处） | 传入 **`() => route.meta?.zen === 'locked'`**（**thunk 形态 + `?.` 可选链，二者缺一不可**；**严禁传裸值** `route.meta.zen === 'locked'`——裸值在**调用点**求值、早于 composable mock 拦截，会让既有两 spec 挂载即抛 `TypeError`）；`provide(ZenModeKey, zenMode)`（第 158 行）与 `:class="{ 'zen-mode': zenMode }"`（第 2 行）**写法不变**（computed 与 Ref 在模板/注入侧等价，已类型验证） | BDD-1/2/3/14 |
| M4 | `DESIGN.md` : 第 210-211 行「Zen Mode」节 | 补全屏链接入口说明（既有 f 键语义不变） | BDD-1（文档承诺面） |
| M5 | `CHANGELOG.md` : `[Unreleased]` 的「新增」区 | 记录用户可见功能（铁律 8） | — |
| M6 | `docs/roadmap/improvement-backlog.md` : 第 388-401 行 #56 条目 | 状态改已完成 + 更正**已被证伪的前提**（"zen 外观统一…同时影响现有 f 键 zen，P1 确认"） | — |
| M7 | `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（**新建**） | 16 条匿名可达 BDD 的 E2E | BDD-1/2/3/4/5/6/7/8/11/12/13/14/16/17/18/19 |
| M8 | `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts`（**新建**） | 3 条需登录前提的 E2E（BDD-10 含 alice **登录创建**私有 entry + **登录建 share** + **登录删除**，`afterEach` 存 `{slug, share_id}`） | BDD-9/10/15 |
| M9 | `frontend-v3/src/composables/__tests__/useZenMode.spec.ts`（**新建**） | 锁死态单测：锁死下 f/Escape 不改状态、公告文本不含退出词、非锁死态行为不变；**另须补一条「锁定态派生随 route meta 翻转」用例**（传入 `() => route.meta?.zen === 'locked'` 形态的 thunk，令其返回 `false → true → false`，断言 `zenMode` 随之翻转、`zenAriaText` 随之切换，且**全程不重新调用 `useZenMode()`**） | BDD-4/5/6/12 |

**关键落点说明（M2 的三个子点，须逐个实现，不可只做其一）**：
1. `zenMode` 必须是 **computed**（不是 ref）——理由见 §3.2 的实测反证；
2. `handleZenKeydown` 的锁死短路必须是**整个函数 `return`**（不 `preventDefault`、不 `stopPropagation`）——理由见 §3.3；
3. `zenAriaText` 必须是 **computed**（不是 ref），锁死文案（不得含 `Escape` / `exit` 子串，BDD-6 词表为闭集）由该 computed 承载；**`updateZenAria` 须整体移除**（含返回对象中的键）——理由：`zenAriaText` 一旦为 computed，任何对其 `.value` 的赋值都会触发 `TS2540`（只读属性不可赋值），打红 `P5_typecheck`。

**⚠️ 锁死态接口的最终规格（P4 照此实现，不得自行变体）**：

| 面 | **唯一形态** |
|---|---|
| composable 签名 | `useZenMode(locked: () => boolean = () => false)` |
| 调用点（M3） | `useZenMode(() => route.meta?.zen === 'locked')` |
| 读取方式 | 在 composable 内一律 `locked()` |
| 返回对象 | `{ zenMode, zenAriaText, handleZenKeydown }`（**无 `updateZenAria`**） |

**`route.meta` 访问方式：二选一已定，取「钉定可选链」**（**不留待决定**）：

- ✅ **本任务采用**：`route.meta?.zen` **带可选链**。→ 既有两处 `useRoute` mock（`t031:164-168` / `t067:173-177`）**无需改动、不进 M 栏**；`route.meta` 在真实 router 下恒存在，可选链不改变任何正确路径的语义，成本为零。
- ❌ **不采用**：不加可选链 → 则**必须**把上述两处 mock 补 `meta: { zen: 'locked' }` 并把这两个 spec **列入 §1.1 的 M 栏**（修订面更大）。本设计**不取此分支**。

**禁止的三个变体**（改任一项都会打红本任务自己的 gate 键，或制造假绿）：
- ❌ 传裸值 `useZenMode(route.meta.zen === 'locked')` → 调用点求值、早于 mock 拦截 → 既有两 spec 挂载即抛 `TypeError`（打红 `make test-frontend`）；
- ❌ 把 `zenAriaText` 保留为 `ref` 而给 `updateZenAria` 加锁死分支 → `TS2540`（打红 `make typecheck`）；
- ❌ 把签名改成 `locked: boolean`（配合可选链可**同时**通过 `make typecheck` 与 `make test-frontend`）→ 锁定态被固化为 **setup 期一次性快照**，组件复用下（§4 V3：`onMounted` 仅 1 次、DOM 节点同一）**离开 `/{slug}/f` 后 `zenMode` 残留 `true`** → 违反 §2.4/§3.2 声明的"不落 ref、随 route 响应式翻转"不变量，**是最坏一类假绿**。M9 新增的"随 route meta 翻转"单测即为此变体的唯一可执行拦截。

### 1.2 不改什么（Not Modify）

> 这一栏是 P4 implementer 的**范围边界依据**，比"改什么"更容易越界。

| # | 范围 | 为什么不改 |
|---|---|---|
| N1 | **死选择器 `.mobile-actions`**（`layout.css:652` 隐藏规则 + `layout.css:133-162` 样式 + `zen-shortcut.ts:16` 的 `closest()` 焦点判断） | **P1 §4.3 第 1 条已判定"本次不处理"**——删除会同时触碰两处与本任务无关的逻辑，且保留无功能危害。**P4 不得顺手删除**（违反 P1 范围声明） |
| N2 | **重复的 `zen-shortcut.spec.ts` 两文件**（`src/utils/zen-shortcut.spec.ts` 180 行 + `src/utils/__tests__/zen-shortcut.spec.ts` 238 行） | **P1 §4.3 第 2 条已判定"本次不处理"**——`zen-shortcut.ts` 本身不改（`shouldHandleZenShortcut` 是纯函数、不持 zen 状态，锁死短路落在 `useZenMode` 调用方）。**P4 不得顺手合并/删除**。⚠️ 唯一例外：若实现期因任何原因改动 `zen-shortcut.ts`，两处 spec 须同步 |
| N3 | **`t052-header-redesign.test.ts:141` 的恒真假绿测试**（断言体 `expect(true).toBe(true)`）+ `layout.css:480` 的 `.meta-tags-bar.hidden{opacity:0}` 死 CSS | **P1 §4.3 第 3 条已判定"本次不处理"**——与本任务无关，改动属范围外。**P4 不得顺手修复** |
| N4 | `frontend-v3/src/styles/layout.css` **全文** | **零 CSS 改动**（P0 `[P0_STALE]` 更正后结论）：zen 隐藏集已完整覆盖 8 项（§2 已实测逐一确认） |
| N5 | `frontend-v3/src/composables/entryDetailKeys.ts` | **`ZenModeKey` 类型声明不变**（`InjectionKey<Ref<boolean>>`）——computed 可直接 provide（实测类型通过，见 §4）。**不新增 `ZenLockedKey`**（无消费方，YAGNI） |
| N6 | `frontend-v3/src/utils/zen-shortcut.ts` | `shouldHandleZenShortcut` / `redirectFocusIfHidden` **签名与实现均不改**——纯函数不持 zen 状态，短路正确位置是 `useZenMode` 调用方（P1 §4.1 已判定） |
| N7 | `frontend-v3/src/components/EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` | 两者的 `v-show="!zenMode"`（第 3/13 行、第 2 行）**兜底机制不改**——它们 inject 的 `zenMode` 变成 computed 后自动跟随（响应式等价） |
| N8 | **后端 `backend/peekview/` 全部**（含 `main.py` 的 `FRONTEND_ROUTES` / `_is_frontend_route` / `serve_spa_catchall` 与 `api/files.py` 的 `resolve_entry_raw`） | **R1 决策 = 不处理**（§5）。保持 P0 的"后端零改动"结论 |
| N9 | `frontend-v3/src/components/EntryDetailContent.vue` / `stores/entryDetail.ts` 的 `selectFile` / `composables/useMarkdown.ts` 的链接生成 | P1 §2.3 必修 8 把"`selectFile`/`useMarkdown` 是否需改"留给 P2 → **P2 结论：不需要改**。理由：实测（§4 V8/V9）证明锁死路由下文件间链接可点、点击后 path 保留 `/f` 后缀、`router.replace({path: route.path, query:{}})` 也保留 `/f` → 保态天然成立，无需植入任何模式传递逻辑 |
| N10 | MCP（`packages/mcp-server/`） | P1 §2.5 已判定"本次不处理"：全屏链接是**人看**入口，Agent 读路径承诺 `/{slug}/raw`。把 `/f` 纳入 `parseEntryRef` 反而扩大契约面。**此处显式登记以免被当漏项** |
| N11 | `entryDetailStore.selectFile` 的 router 解耦现状（纯 store 操作） | 同上，保态已天然成立，不改 |
| N12 | **`.archived-banner` / `.expired-warning-banner` 的可见性**（`EntryDetailBanners.vue`） | 二者**不在** zen 隐藏集（§1.3 风险 R-04 详载）。**本任务不处理**——见下方 `[P1_CORRIGENDUM]` 与 §1.3 R-04 的完整论证。**P4 不得顺手给它们加 zen 隐藏规则** |
| N14 | **`EntryDetailView.vue` 的 300 行上限**（`frontend-v3/src/components/__tests__/t082-error-format.spec.ts:9-16` 断言 `lineCount < 300`） | **既有不可越过约束**（实测当前 **265 行**，M3 预计 +1~2 行，额度充裕）。**登记理由**：P4 不得在 `EntryDetailView.vue` 内顺手展开逻辑（如内联 share/auth 分支）而越线——**若确需大改，正确动作是拆子组件，不是改这条断言** |
| N13 | 既有 E2E spec 中涉及 zen / detail chrome 者（`viewer.spec.ts` / `t052-header-redesign.e2e.spec.ts` / `t058-share-redesign.e2e.spec.ts` / `star.spec.ts` / `t079-auth-consistency.spec.ts` / `t069-settings-refresh-guard.e2e.spec.ts` / `raw-api.spec.ts`） | 本任务不改它们的断言。⚠️ 其中 `viewer.spec.ts` **当前预存红灯 18 failed**（§6.3 详载），属既有 DEBT，**不进本任务 gate、也不在本次修复** |

**[P1_CORRIGENDUM]**（主 Agent 裁决 2(b) 授权登记，**不改 P1 文件**——P1 已 approved + committed）：
> `P1-requirements.md:359`（§4.2 补登行）写「当前 seed 无过期/归档 entry，故不构成本任务 BDD 失败」——**该句为假**，且与 P1 自身 §5 line 403 自相矛盾（line 403 明确写着 `legacy-deploy` "确实在 debug DB 中……`status=archived`"，系 `seed-debug.py:204-209` 的有意设计）。
> **更正为**：「seed 中存在 **1 条** archived entry（`legacy-deploy`，alice 可达 / 匿名 404），其 `.archived-banner` **不在 zen 隐藏集内**，故 zen 态下仍可见；因无任何 BDD 引用该 slug，不构成本任务的 BDD 失败，但**该项必须在验证时规避**（见 §6.5）」。
> 性质：**非方向性事实更正**，不重开 P1 基线（任务目标 / URL 方案 / 锁死语义 / 后端零改动四项前提均不变）。

### 1.3 风险在哪（Risk）

每条配缓解。R-01~R-03 是实现期回归风险（与 P1 §8 R3/R4/R5 对应），R-04~R-08 是本阶段新识别。

| # | 风险 | 证据/场景 | 缓解 |
|---|---|---|---|
| R-01 | **锁死态误写进全局 zen → f 键 zen 一起锁死** | P1 §8 R3：这是 P1 判定的"最可能的实现期回归" | ① `zenMode` 用 **computed 派生**（锁死态不进 ref）；② `locked` 作为**只读 thunk 入参**（`() => route.meta?.zen === 'locked'`），**不落任何状态**、无写入点；③ **BDD-4 与 BDD-12 成对拦截**（前者管锁死态按键无效、后者管 f 键 zen 仍可进出）；④ 单测 M9 显式覆盖"非锁死态下 f/Escape 行为不变" |
| R-02 | **锁死扩大 `preventDefault`/`stopPropagation` 范围 → 吞掉内容区内嵌组件的 Escape** | P1 §8 R4；本次实测确认机制（§3.3） | ① 锁死短路写成**整个函数 `return`**（两个方法都不调用）；② **BDD-7 拦截**（`TableView.vue:227` 分页浮层）；③ §3.3 附 P4 护栏说明，防止 implementer 按 P1 §2.1 原措辞去"避免 preventDefault"而错过真正的坑 |
| R-03 | **隐藏集遗漏 → 全屏下残留 chrome** | P1 §4.2：隐藏集**双文件分布**（`layout.css` 7 项 + `EntryDetailView.vue` 1 项），含易漏的 `.resize-handle`（`layout.css:208`） | **缓解 = 复用 zen 类，不新造隐藏规则**（§2 候选方案 A）。复用后 8 项全部自动继承；已实跑逐一确认 8 项在 zen 下 `display:none`（§4 V4），并从构建产物反查规则来源（§4 补充证据）。**若 P4 偏离方案新造规则，必须覆盖全部 8 项** |
| R-04 | **`.archived-banner`/`.expired-warning-banner` 是"满宽顶部横条"且不在 zen 隐藏集** → 命中 BDD-3 禁项 | **本次实测**（§4 V7）：archived entry（`legacy-deploy`，alice）zen 态下 `.archived-banner` 仍 `display:flex`、**1280×49、top=0**，满足 BDD-3 的拦截条件（宽 ≥ 1152、高 ≥ 8、top < 100）且**不在 BDD-3 的 A/B 排除集内** | **本任务不处理**（N12），双向缓解：① **验证侧规避**：BDD-1/2/3 的 E2E **钉定 `dsh-architecture`**（非归档/非过期），规避非本任务成因的 FAIL（§6.5）；② **产品侧登记**：留待后续任务（见下方 `[SCOPE+]`）。理由见 R-04 详述 |
| R-05 | **`watch` 而非 `computed` → FOUC（chrome 闪现）** | **本次实测**（§4 V2）：`watch` 不带 `immediate` 时首帧 `zenMode=false`、chrome `display:flex`；带 `immediate` 才正确 | 用 **computed**（首帧即正确，实测 `firstRender=true`）。§3.2 候选方案 B 即此风险的具体化，已淘汰 |
| R-06 | **setup 期一次性读 meta 写 ref → 组件复用导致状态残留** | **本次实测**（§4 V3）：`/{slug}` ↔ `/{slug}/f` 客户端导航间组件实例**被复用**（`sameDomNode=true`、`onMounted` 仅 1 次）；一次性写法实测离开锁死路由后 `zenMode` 仍为 `true`、chrome 仍隐藏、**f 键永久失效** | 用 **computed 派生**（随 route 响应式更新）。§3.2 候选方案 C 即此风险的具体化，已淘汰 |
| R-07 | **P5 假绿：`make debug-test` 裸调用只跑 1 个 spec** | `scripts/run-e2e-tests.sh:78`：`spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` → 裸调用只跑与 BDD 无关的健康检查，**19 条 BDD 的 E2E 层整体零覆盖** | `gate_commands` 的每个 E2E 键**一律 `E2E_SPEC=<spec> make debug-test` 定向**（§6.1）；**禁止出现裸 `make debug-test`** |
| R-08 | **拿既有红灯 spec 当回归键 → gate 永红或误判** | **本次实测**（§6.3）：`E2E_SPEC=e2e/viewer.spec.ts make debug-test` → **18 failed / 20 passed**（`markdown-test` 团队限定 → 匿名 404；成因为 **TPV0095 引入的 seed 语义回归**，**不属 DEBT0012**——判定见 §6.3 三维对照） | E2E 键**全部指向本任务新建的 spec**；既有 spec 的红灯归 **TPV0097/TPV0098「用例可信治理」**，**不进本任务 gate** |

**[SCOPE+]** 发现：`.archived-banner` / `.expired-warning-banner` 在全屏视图下仍可见，且构成满宽顶部横条（实测 1280×49）
         必须做的理由：全屏视图的产品目标是"只剩纯内容"（P0 决策 ③）；archived/expired entry 经 `/{slug}/f` 分享后在顶部残留一条 49px 横条，与目标形态冲突；且该范围在 BDD-6 的枚举下含一个可聚焦控件（实测 `["Reactivate"]`）
         影响：若采纳，P1 基线需**新增 1 条 BDD**（"archived/expired entry 在 `/{slug}/f` 下同样无满宽横条且该范围无可聚焦退出控件"）；实现面 = `EntryDetailView.vue` scoped 块增 2 个选择器（+2 行 CSS）；packages 不变
         **本任务处置：不采纳（不扩大范围）**，理由三条：
         ① **视觉增量为零**——`/{slug}/f` 复用 zen 类，banner 在**今天的 zen 态就已可见**（既有行为，早于 TPV0099 立项）。本任务新增的是一个 **URL 入口**，不是一个新的可见状态，故它不是本任务引入的回归；
         ② **分享路径天然不触达**——本任务核心用户故事是"分享链接给接收者"= 匿名场景，而实测 **匿名访问 `legacy-deploy/raw` = 404**（需 alice）；
         ③ **P1 §4.2 已作同类判定**（补登两 banner 时即写明"不构成本任务 BDD 失败"）+ 无任何 BDD 引用该类 entry（已 grep 确认）。
         **唯一必须做的事 = 验证侧规避**（§6.5 已落为硬约束），避免 P6 挑到该 entry 后产生**非本任务成因的 FAIL**。

---

## 2. 候选方案（candidate_count: 3）

### 2.1 方案 A：**路由 meta 驱动 + node 级键盘短路 + 复用 zen 类**（**选定**）

**核心**：`locked` 通过 **thunk 入参**由 `route.meta.zen` 派生（**调用点传 `() => route.meta?.zen === 'locked'`，composable 内 `locked()` 读取**）；`zenMode` 是 `locked() || manualZen` 的 computed；`provide` 面与 `:class` 绑定**写法不变**；锁死时 `handleZenKeydown` 整体 `return`。

```ts
// useZenMode.ts（签名与调用形态为最终规格，P4 照此实现）
export function useZenMode(locked: () => boolean = () => false) {
  const manualZen = ref(false)
  const zenMode = computed(() => locked() || manualZen.value)   // ← 关键：computed
  const zenAriaText = computed(() =>
    locked() ? 'Full screen view'                                // ← BDD-6：不含 Escape/exit
             : (zenMode.value ? 'Zen mode on. Press f or Escape to exit.' : 'Zen mode off.'))

  function handleZenKeydown(event: KeyboardEvent) {
    if (locked()) return                                        // ← 关键：整函数 return
    if (!shouldHandleZenShortcut(event)) return
    /* 既有逻辑不变（updateZenAria 已移除，zenAriaText 由 computed 承载） */
  }
  return { zenMode, zenAriaText, handleZenKeydown }
}
```

> **调用点（`EntryDetailView.vue:155`）同样是最终规格**：`const { zenMode, zenAriaText, handleZenKeydown } = useZenMode(() => route.meta?.zen === 'locked')`——thunk 形态 + `?.` 可选链，**勿传裸值**。二者与上方签名共同构成锁死态接口的**唯一形态**（见 §1.1 的"最终规格"表与三个禁止变体）。

- **优点**：① **单一状态源**——锁死态不落任何可变 ref，物理上无法污染 f 键 zen；② **响应式正确**（组件复用下自动跟随 route）；③ **无 FOUC**（computed 首帧即正确）；④ **隐藏集零改动**（复用 zen 类，8 项自动继承）；⑤ 改动面最小（3 文件 + 2 文档 + 3 测试）；⑥ 类型零破坏（`computed` 可直接 provide/注入，§4 已验证）
- **风险**：① `locked` 作为**函数入参**传入 → `useZenMode` 从"无参"变"带参"。⚠️ **"既有 mock 仍兼容"这一结论仅对 thunk 形态成立**——mocked 时 `useZenMode` 被整体替换，thunk 作为**实参**传入但**从未被调用**，故 mock 无需提供 `route.meta`（`t031:106` / `t067:119` 的 `useZenMode: () => ({...})` 忽略入参，仍兼容）；**裸值形态下该结论不成立**——裸值在**调用点**（`EntryDetailView` 组件代码内）求值，**早于 mock 拦截**，而两处 `useRoute` mock（`t031:164-168` / `t067:173-177`）均无 `meta` 键 → 挂载即抛 `TypeError`。② `zenAriaText` 由 `ref` 变 `computed` → `ZenAriaTextKey`（`InjectionKey<Ref<string>>`）类型仍兼容（computed 是 Ref 子类型，实测通过）；③ 锁死文案是**新增字符串**，须自查不含退出词（已自查，§4 V10）
- **工作量**：小（~30 行产品代码）

### 2.2 方案 B：**`watch` route 监听同步 zenMode ref**

**核心**：保留 `zenMode` 为 `ref`，新增 `watch(() => route.meta.zen, v => { zenMode.value = v === 'locked' }, { immediate: true })`。

- **优点**：`zenMode` 保持 `ref`，对既有类型与 mock 面**零影响**；`manualZen` 与 `locked` 可分开存两个 ref（语义更"显式"）
- **风险（实测已证）**：**不带 `immediate` → 首帧 `zenMode=false`、chrome `display:flex`（FOUC 闪现）**（§4 V2 实测）；带 `immediate` 可修首帧，但引入**两个状态源**（ref + route）→ 存在**时序不同步窗口**（route 变更与 watcher flush 之间），且"离开锁死路由后 `manualZen` 残留"需额外处理。比方案 A 多一个需要论证的不变量
- **工作量**：小（~15 行），但**不变量更多**

### 2.3 方案 C：**setup 期一次性读 meta 写入 ref**

**核心**：`const zenMode = ref(route.meta.zen === 'locked')`，实现最直观。

- **优点**：改动最少（~5 行）；语义最直白；无响应式依赖
- **风险（实测已证，致命）**：`EntryDetailView` 在 `/{slug}` ↔ `/{slug}/f` 间**组件实例被复用**（实测 `sameDomNode=true`、`onMounted` 仅 1 次，§4 V3）→ setup 不重跑 → **离开锁死路由后 `zenMode` 残留 `true`**：实测 chrome 仍隐藏、**f 键永久失效**（既不能进也不能退）。这直接违反 **BDD-11/BDD-12**（回归组），且是"从分享页返回站点后整个详情页卡死"级别的缺陷
- **工作量**：最小，但**不可用**

### 2.4 权衡与选择理由

| 维度 | A（computed） | B（watch ref） | C（一次性 ref） |
|---|---|---|---|
| 状态源数量 | **1**（route） | 2（route + ref） | 1（但只在 setup 期采样） |
| 首帧正确（无 FOUC） | **✅ 实测** | ❌（无 immediate）/ ⚠️（有 immediate） | ✅ |
| 组件复用下正确 | **✅ 实测** | ✅ | ❌ **实测残留 zen + f 键失效** |
| f 键 zen 污染风险（R-01） | **最低**（锁死不落 ref） | 中（两源可能不同步） | 高 |
| 类型/mock 兼容 | ✅ 实测 | ✅ | ✅ |
| 隐藏集覆盖（R-03） | **✅ 复用 zen 类** | ✅ | ✅ |
| 改动行数 | ~30 | ~15 | ~5 |

**选择 A**。理由：① A 是三者中**唯一**同时满足"首帧正确 + 复用正确 + 单状态源"的；② B/C 的缺陷均已被**实测证伪**（§4 V2/V3），不是纸面推演；③ A 的额外成本仅是"多 15 行"，换来的是 R-01/R-05/R-06 三条风险从"需要论证"变成"结构上不可能"；④ 三个方案在**隐藏集覆盖**上等价（都复用 zen 类），故该项不构成区分度——**区分度全部来自状态承载方式**，这正是 P1 §8 R3 要求显式区分的点。

> **关于「布局/视觉维度未给 ≥2 具区分度候选」（评审 N-9 / NB-7，属有理由的等价，非打回项）**：本任务的 UI 维度（布局/视觉）**不改任何东西**——零 CSS 改动（N4）、复用既有 zen 类（8 项自动继承，§4 V7 逐一实测）、内容区几何由既有规则决定。三个候选方案在布局/视觉维度上的产出**完全相同、无一字节差异**，故给出"≥2 个布局候选"只会是**同义包装**（制造虚假区分度），不构成真实取舍。真实取舍**全部落在状态承载方式**上，已由 A/B/C 三方案 + §2.4 权衡表 + §4 V2/V3/V4 实测覆盖（这正是 P1 §8 R3 要求显式区分的点）。**故此处以"等价"结案，不补布局候选。**

**R2 结论（锁死态如何承载）**：**新增 `locked: () => boolean` thunk 入参**（调用点传 `() => route.meta?.zen === 'locked'`，composable 内以 `locked()` 读取），**`zenMode` 变为 `computed(() => locked() || manualZen.value)`**。**显式区分**：`locked` = thunk、只读、路由派生、**不落任何 ref、不落任何状态变量**；`manualZen` = 可写 `ref`、只由 f 键翻转、**仅在非锁死态可被改写**。二者经 `computed` 合成 `zenMode`。**故 f 键 zen 不可能被锁死**（R-01 结构上消除）。

---

## 3. 关键实现决策（R1/R2/R3 三开放点定论）

### 3.1 R1：JSON-accept 404 **不处理**（范围不扩大）

**实测事实**（debug `:8888`，`Accept: application/json`）：

| 路径 | 结果 | `_is_frontend_route` | 说明 |
|---|---|---|---|
| `/{slug}/f` | **404 JSON** | False | 本开放点对象 |
| `/dsh-architecture` | 200 JSON | False | 走 `resolve_entry_raw`（既有设计） |
| `/settings` | **404 JSON** | **False** | ⚠️ 前端路由但**非白名单** |
| `/stars` | **404 JSON** | **False** | 同上 |
| `/teams` | **404 JSON** | **False** | 同上 |
| `/admin` | **404 JSON** | **False** | 同上 |
| `/explore` | 200 HTML | **True** | `FRONTEND_ROUTES` 白名单 |
| `/settings/apikeys` | 200 HTML | **True** | `FRONTEND_ROUTES` 白名单 |
| `/login` | 200 HTML | **True** | `FRONTEND_ROUTES` 白名单 |
| `/users/alice` | 200 HTML | True | `path.startswith("users/")` |
| `/{slug}/raw` | **302** | False | 专用短链路由（`main.py:539`） |

**结论：不处理。** 论据强化到机制层（**不是**"/f 特殊所以不管"）：

1. **JSON-accept 落 `resolve_entry_raw` 是 `FRONTEND_ROUTES` 白名单机制的普遍行为**，不是 `/f` 的独有缺陷。`FRONTEND_ROUTES`（`main.py:25`）= `{"", "explore", "settings/apikeys", "login"}` + `users/` 前缀——**`/settings`、`/stars`、`/teams`、`/admin` 这些前端页面同样返回 404 JSON**（上表实测）。
2. **让 `/{slug}/f` 返回 HTML 等于给它 `/settings` 都没有的待遇** → 属**不一致扩大**：要么同时给 5 条路由开例外（远超本任务范围），要么制造一条特例（增加后续维护者困惑）。二者都不该由"一个分享链接功能"承担。
3. **本任务的读路径承诺在 `/{slug}/raw`**（P0-brief 关键约束）：Agent 读路径本就走 `raw`（302 → 结构化 JSON）；`/f` 是**人看**入口，其 JSON-accept 行为无消费方。
4. **P0 原判"后端零改动"**：选择处理即范围扩大，需 `[BASELINE_CHANGE]` 授权把 `backend/peekview` 加回 `packages`/`domains`（P1 §2.5 已设定该条件）→ 收益（一个无消费方的边缘行为）远小于成本（跨端改动 + 后端评审 + 回归面）。
5. **若未来需要**：正确做法是单独任务给 `FRONTEND_ROUTES` 做**统一收敛**（而非为本任务特例化 `/f`），属独立的架构决策。

> **登记**：`/{slug}/f` 的 JSON-accept 404 行为**与既有前端路由一致**，本任务不改；`packages` 因此**不含** `backend/peekview`。

### 3.2 R2：锁死态承载 = **computed 派生**（详 §2.4）

**显式区分**（P1 §8 R3 的核心要求）：

| 维度 | 锁死态（locked） | zen 态（manualZen） |
|---|---|---|
| 来源 | `() => route.meta?.zen === 'locked'`（**thunk 入参**，composable 内 `locked()` 读取） | f 键翻转（**可写 ref**） |
| 存储 | **不落 ref、不落任何状态变量**（仅 thunk + computed 派生） | `ref(false)` |
| 能写入的场景 | **永不写入**（无写入点） | 仅 `handleZenKeydown` 的 f/F 分支，且**锁死时该分支不可达**（前置 `return`） |
| 退出方式 | **无**（用户明示接受"手动改 URL"，P0 决策 ②） | f / Escape |
| 公告文本 | 不宣告退出方式（BDD-6） | 宣告 `Press f or Escape to exit`（BDD-12） |
| 受影响 BDD | BDD-4/5/6 | BDD-11/12 |

**实测反证**（§4 V2/V3）：候选 C（一次性写 ref）在组件复用下残留 zen 且 f 键永久失效；候选 B（watch 无 immediate）首帧 FOUC。→ **computed 是唯一同时满足"零 FOUC + 零残留 + 单状态源"的写法**。

### 3.3 R3：`preventDefault` 边界 = **锁死时整个 handler `return`**（不调用任何事件方法）

**实测机制澄清（P1 §2.1 的原始归因需要更正）**：

| 相位组合 | `stopPropagation` | 元素级 Escape 是否被执行（实测） |
|---|---|---|
| document **bubble** + `preventDefault` | ❌ 未调用 | **✅ 执行**（`order=[child, parent]`，listbox 关闭） |
| document **bubble** + `preventDefault` + `stopPropagation` | ✅ 调用 | ✅ 执行（child 已在 target 相位跑完） |
| document **capture** + `stopPropagation` | ✅ 调用 | **❌ 被吞**（listbox 保持打开） |

- **P1 §2.1 把"吞掉内嵌 Escape"归因于 `preventDefault`** —— 实测归因应为 **`capture` 相位 + `stopPropagation`**。DOM 事件在 target 元素的监听器**先于** document 的 bubble 监听器执行；`preventDefault` 只设置 `defaultPrevented` 标志、**不阻断任何监听器**。真正能吞掉元素级处理的是"在捕获相位拦截并 `stopPropagation`"。
- **⚠️ P4 护栏（防 implementer 按 P1 原措辞走偏）**：不要为了"避免吞掉内嵌 Escape"而去纠结 `preventDefault`——**`preventDefault` 本身不吞**。要避开的坑是**捕获相位 + `stopPropagation`**。既有实现（`EntryDetailView.vue:216` 的 `document.addEventListener('keydown', handleZenKeydown)`）**未传第三参 → 默认 bubble 相位**，故天然安全。

**实现规格（R3 定论）**：

```ts
function handleZenKeydown(event: KeyboardEvent) {
  if (locked()) return          // ← 整函数 return：不 preventDefault、不 stopPropagation、保持 bubble
  /* …既有逻辑… */
}
```

**为什么"什么都不做"是正确解**：
1. **BDD-5 的判定对象是"视图状态"**（chrome 可见性 / 内容区几何 / URL），不是"事件是否被 `preventDefault`"。锁死下 `return` → 不改 `manualZen` → 视图状态自然不变 → **BDD-5 满足**。
2. **不调用 `preventDefault`** → 元素级 `@keydown`（`TableView.vue:227/243`）照常收到并消费 → 浮层关闭 → **BDD-7 满足**（实测 listbox 关闭 + 视图保持）。
3. **不调用 `stopPropagation`** → 其他 `document` 级监听（`ShareDialog.vue:218` / `OverflowMenu.vue:150`）照常收到事件；但二者**仅在自身 `isOpen` 为真时消费 Escape**，而全屏下其入口在 header / mobile bar（已隐藏）→ 无从打开 → **无冲突面**（P1 §2.1 结论成立）。
4. **`f` / `F` / `Ctrl+f` 同样 `return`** → 不改视图（BDD-4）。`F` 大小写一并覆盖（`shouldHandleZenShortcut` 亦判 `F`，但短路在其之前，故无需依赖）。
5. **不 `preventDefault` 的副作用**：`/`（快速查找）等浏览器默认行为在锁死态下不会被拦截——**这正是期望行为**（BDD-5 只约束"视图状态不变"，不约束浏览器原生功能；P0 也仅要求 f/Escape 无效）。**`f` 键本身无浏览器默认行为**，无副作用。

**与 BDD-6 的边界**：锁死态 `return` 也意味着**不更新 `zenAriaText`**——故文案的锁死分支必须由 `computed` 提供（而非依赖按键时更新），这正是 §3.2 选 computed 的一个附带收益。

---

## 4. minimal_validation（强制实跑，全部在 debug `:8888` + CDP `:18800` 实跑）

> 方案依赖**浏览器行为**（vue-router 路径打分、组件复用、DOM 可见性、事件分发相位、几何度量）→ **已全部实跑**，非"纯代码逻辑"声明。
> 脚本落 `.agate-tmp/p2-arch-*.cjs`；探针均 `try/finally { page.close() }` + `process.exit(0)`，`connectOverCDP`，未 `browser.close()`。

### V1：`/{slug}/f` 当前路由归属（**现状基线**）

- **方法**：CDP 打开 `/yaml-docker-compose/f` 读取 `.entry-detail` / `.not-found` / 页面文本
- **结果（confirmed）**：`path` 保持 `/yaml-docker-compose/f`、**`.entry-detail` 不存在**、`.not-found` 存在、文本含 `Page not found` → **命中 `/:pathMatch(.*)*`**
- **意义**：BDD-13/BDD-18 的现状基线（实现后须翻转）

### V2：候选路由表 resolve（**真实 vue-router 4.6.4**，两种方式交叉验证）

- **方法**：① node 直接 `require('vue-router.cjs')` + `createMemoryHistory` 对候选路由表全路径 `resolve()`；② 在**真实运行页面**上 `router.addRoute({path:'/:slug/f', ...})` 后 `resolve()`
- **结果（confirmed）**：

| 路径 | resolve 命中 | 结论 |
|---|---|---|
| `/{slug}/f`（存在 slug） | `detail-zen-locked` | ✅ BDD-1 |
| `/{slug}/f`（不存在 slug） | `detail-zen-locked` | ✅ **BDD-18**（不落 catch-all；由视图内部控制错误态） |
| `/{slug}/f/xyz` | **`not-found`（catch-all）** | ✅ **BDD-19**（段数严格） |
| `/{slug}/ff` | `not-found` | ✅ 第二段非 `f` 不误匹配 |
| `/f`（slug=f） | **`detail`（`/:slug`）** | ✅ P0 风险登记"slug=f 无冲突"确认 |
| `/{slug}` | `detail` | ✅ BDD-11 |
| /settings/apikeys | redirect 路由 | ✅ 无冲突 |
| /users/alice | `user-entries` | ✅ 无冲突 |
| `/{slug}/raw` | not-found | ✅ 无冲突（`/raw` 是服务端路由） |
| `/f/f` | `detail-zen-locked`（slug=f） | ✅ 边界合理 |

- **补充发现**：① 新增路由**放在 catch-all 之前或之后结果相同**（vue-router 4 按静态段数 + 打分排序，不按注册顺序）——故 M1 声明的插入位置是**可读性约定**而非正确性前提；② 路径匹配**大小写不敏感**（`/dsh-architecture/F` 亦命中 `/f`）——容忍行为，无 BDD 约束；③ `meta: {zen:'locked'}` 与 `params.slug` 在 `resolve()` 结果中均可读（**§3.2 的前提**）

### V3：**组件复用**（R-06 的实证，候选 C 淘汰依据）

- **方法**：真实页面 `router.addRoute` 后 `router.push('/{slug}/f')`，比对 DOM 节点同一性与挂载次数
- **结果（confirmed）**：`sameDomNode=true`、`beforeMark==afterMark`、`onMounted` 计数恒为 1 → **组件实例被复用，setup 不重跑**
- **补充实测（候选 C 的失败态）**：一次性写 ref 的写法下，`push('/{slug}/f')` → `zenMode=true`；`push('/{slug}')` **回到非锁死路由后 `zenMode` 仍为 `true`、chrome 仍 `display:none`**，且此后按 `f` **完全无效**（`val` 恒为 `true`）
- **意义**：**候选 C 淘汰**（违反 BDD-11/BDD-12）

### V4：R2 三变体首帧对比（R-05 的实证，候选 B 淘汰依据）

- **方法**：独立 Vue 3.5.34 + vue-router 4.6.4 页面，初始 location = `/{slug}/f`，三变体各自记录 `setup` 期首帧 `zenMode` 与 DOM 的 `chrome` display
- **结果（confirmed）**：

| 变体 | setup 期 `route.meta.zen` | 首帧 zenMode | chrome display | 判定 |
|---|---|---|---|---|
| **computed** | `'locked'` ✅ | **`true`** | `none` | ✅ **正确** |
| `ref` 从 meta 初始化 | `'locked'` ✅ | `true` | `none` | ✅ 正确（但见 V3：复用下残留） |
| `watch` **无** immediate | `'locked'` ✅ | **`false`** ❌ | **`flex`** ❌ | ❌ **FOUC** |
| `watch` 带 immediate | `'locked'` ✅ | `true` | `none` | ✅（但双状态源） |

- **意义**：`route.meta` 在**任意路由记录**下均可读（含初始直载）；`computed` 与"ref 初始化"首帧均正确，**区分二者的是组件复用（V3）**；`watch` 无 immediate 会 FOUC → **候选 B 淘汰**

### V5：R3 事件分发相位与吞掉机制（**BDD-7 可行性核心**）

- **方法**：① 真实页面（`tsv-server-metrics`，zen 态）打开 `.per-page-listbox`，注入 document 级 bubble 监听 + 元素级监听，比对执行顺序与 `defaultPrevented`；② 独立 DOM 探针直接构造父子节点，三组相位组合逐一比对
- **结果（confirmed）**：

| 探针 | 观测 | 结论 |
|---|---|---|
| 锁死模拟（document **bubble** + `preventDefault`） | element handler **先执行**；document 侧 `defaultPrevented=true`；**listbox 关闭** | **`preventDefault` 不吞元素级** |
| 反证（document **capture** + `stopPropagation`） | **listbox 保持打开** | **捕获相位 + stopPropagation 才吞** |
| 语义探针 A（parent bubble + prevent） | `order=[child, parent:false]` | child 先跑 |
| 语义探针 B（parent **capture** + stop） | `order=[parent:false]`（child **未跑**） | 捕获相位阻断 |
| 语义探针 C（parent bubble + stop） | `order=[child, parent:false]` | child 已跑完 |
| 现状（普通 Escape，zen 态） | listbox 关闭 **且 zen 退出** | = 本任务要拦的实现期回归（BDD-7 的 Then 要求"浮层关闭 + zen **保持**"） |

- **意义**：**R3 = 整函数 `return`**（§3.3）；P1 §2.1 的归因需更正为 capture+stopPropagation

### V6：**候选实现骨架实跑**（独立页真实组件树，验证方案 A 端到端）

- **方法**：独立 Vue+vue-router 页面，`Root` 复刻 `EntryDetailView`（computed zen + provide + document keydown），`Child` 复刻 `EntryDetailHeader`（inject + 显隐）+ 一个元素级 Escape 消费组件
- **结果（confirmed）**：

| 步骤 | 观测 |
|---|---|
| S1 `push('/{slug}')` | `rootZen=false`、chrome `flex`、`locked=false` |
| S2 `push('/{slug}/f')` | `rootZen=true`、chrome `none`、`locked=true`（**计算属性随 route 翻转**） |
| S3 锁死态按 f/F/Ctrl+f | `rootZen` 保持 `true`、chrome 仍 `none`、`lockShortCircuit` 计数 +3、path 不变 → **BDD-4 满足** |
| S4 锁死态按 Escape（焦点在内容区内嵌元素） | **元素级消费计数 +1、浮层关闭**；`rootZen` 仍 `true`、chrome 仍 `none` → **BDD-7 满足**（浮层关闭 + 视图保持） |
| S5 反证（注入 capture + `stopPropagation`） | 元素级消费**被阻断**（计数不变）、浮层**保持打开** → 证明 S4 非恒真 |
| S6 `push('/{slug}')` 返回 | `rootZen=false`、chrome `flex` → **无残留**（R-06 消除） |
| **生命周期计数** | `rootMounted=1`、`childMounted=1` **全程未变** → 证明 S2→S6 是在**组件复用**下完成的，即方案 A 在复用场景下正确 |

- **意义**：方案 A 在"组件复用 + 锁死短路 + 内嵌 Escape 消费"三者叠加下**端到端可行**；S5 为 S4 提供了反证（防恒真判据）

### V7：zen 隐藏集 8 项逐一实测 + **banner 遗漏面发现**

- **方法 A（行为侧）**：`unicode-filenames`（多文件，桌面 1280×800）在 zen 前后逐一测 8 项选择器的 `display` 与高度；移动端 390×844 另测（V9）
- **结果 A（confirmed）**：

| 项 | 选择器 | 位置（P1 §4.2） | 非 zen | zen 态 |
|---|---|---|---|---|
| 1 | `.detail-header` | `layout.css:649` | 107px / flex | **0px / none** ✅ |
| 2 | `.file-sidebar` | `layout.css:650` | 693px / block | **0px / none** ✅ |
| 3 | `.toc-sidebar` | `layout.css:651` | 693px / block | **0px / none** ✅ |
| 4 | `.mobile-actions` | `layout.css:652` | 不存在（死选择器，N1） | 不存在 |
| 5 | `.mobile-sticky-header` | `layout.css:653` | 桌面不渲染 | 移动端 0px / none ✅（V9） |
| 6 | `.mobile-bottom-bar` | `layout.css:654` | 桌面不渲染 | 移动端 0px / none ✅（V9） |
| 7 | `.meta-tags-bar` | `EntryDetailView.vue:260` | 桌面不渲染 | 移动端 0px / none ✅（V9） |
| 8 | `.resize-handle` | **`layout.css:208`** | 683px / block | **0px / none** ✅ |

- **方法 B（规则来源反查）**：grep 构建产物（`backend/peekview/static/assets/*.css`，与 `frontend-v3/dist/` 一致）
- **结果 B（confirmed）**：
  - `index-Ch-pgAwR.css`：`zen-mode .resize-handle{display:none}`（第 8 项）+ `zen-mode .detail-header,.zen-mode .file-sidebar,.zen-mode .toc-sidebar,.zen-mode .mobile-actions,.zen-mode .mobile-sticky-header,.zen-mode .mobile-bottom-bar{display:none}`（6 项）
  - `zsh-Dx9y5tKO.css`：`.entry-detail.zen-mode[data-v-…] .meta-tags-bar{display:none}`（第 7 项 scoped）
  - → **双文件分布 + 8 项全覆盖，与 P1 §4.2 完全一致**
- **⚠️ 结果 C（R-04 的发现）**：`grep` 两个 banner 选择器（`.expired-warning-banner` / `.archived-banner`）在两个 CSS 产物中 **0 命中**，在 `layout.css` 与 `EntryDetailView.vue` 中亦 **0 命中**（唯一定义处 `EntryDetailBanners.vue`）。**实测**（真实 archived entry `legacy-deploy`，alice 登录，桌面 1280×800）：

| 状态 | `.archived-banner` | 几何 | `.content-area` |
|---|---|---|---|
| 非 zen | 存在 | 1280×49，**top=107** | top=107, h=693 |
| **zen** | **仍存在** | 1280×49，**top=0** | top=49, h=751 |

  且该范围内实测有 **1 个可聚焦控件**：`focusableOutsideContent = ["Reactivate"]`
- **意义**：① **R-03 缓解确认**（复用 zen 类 → 8 项自动继承，无需新造规则）；② **R-04 成立**（banner 是满宽横条、不在排除集、不在隐藏集）→ 落为 §1.3 的 `[SCOPE+]`（本任务不采纳）+ §6.5 的验证规避

### V8：**保态**（BDD-8/BDD-10 的关键前提）

- **方法 A**：node 直接对 vue-router 复刻 `EntryDetailView.vue:215` 的 `router.replace({ path: route.path, query: {} })`
- **结果 A（confirmed）**：`/unicode-filenames/f?firstFileId=37` → replace 后 `path='/unicode-filenames/f'`、`name='locked'`、**`meta.zen` 仍为 `'locked'`**；`/dsh-architecture/f?share=tok123` → replace 后同样保留 `/f` 与 params
- **方法 B（真实页面）**：真实页面注入候选路由后，在 `/{slug}/f` 下点击内容区文件间链接
- **结果 B（confirmed）**：`unicode-filenames` 下锁死路由内 `a[data-peekview-file-id]` 计数 = **2**、**均可见可点**；点击第一个后正文由 `README.md` 板块切换为被链接文件正文，且 **`pathname` 保持 `/unicode-filenames/f`**（页面文本实测变化）
- **意义**：① **N9 结论成立**（`selectFile`/`useMarkdown` 不需改动，保态天然成立）；② P1 §2.3 必修 8 的开放点关闭

### V9：移动端几何与 aria（BDD-14 / BDD-6 前提）

- **方法**：390×844，`dsh-architecture`，f 键 zen 前后测量（以既有 f 键 zen 作"正确全屏实现"的控制组——`/{slug}/f` 路由尚未实现）
- **结果（confirmed）**：
  - 非 zen：innerHeight 844、`.mobile-sticky-header` **56px / flex**、`[data-testid="mobile-bottom-bar"]` **64px / flex**
  - zen：`zenClass=true`、`[data-testid="content-area"]` **top=0 / height=844 / width=390**（占满视口 ✅）、sticky header **0px / none**、bottom bar **0px / none**、`.meta-tags-bar` **0px / none** ✅
  - 可滚动性：`scrollHeight=5227 > clientHeight` → 可滚；滚到 `scrollTop=4383(sh=5227)` 后末段仍 `lastVisible=true` ✅
  - 公告区：仅 1 个 `.sr-only[aria-live]`，文本 `Zen mode on. Press f or Escape to exit.`（**含 Escape → 锁死态必须改掉，否则 BDD-6 FAIL**）；**内容区之外可聚焦元素 = 0**
- **意义**：BDD-6 的可执行判据确认为"**公告文本改掉** + 该范围可聚焦元素为 0"；BDD-14 几何可达

### V10：BDD-6 候选文案词表自检

- **方法**：对候选锁死文案 `Full screen view` 按 BDD-6 的闭集词表逐项比对
- **结果（confirmed）**：`containsEscape=false`、`containsExit=false`、退出词表命中 = `[]` → **PASS**
- **意义**：文案选择安全；**P4 若改动该文案，必须重跑此自查**（词表是闭集）

### V11：R1 的 JSON-accept 全路由矩阵实测

- **方法**：`curl -H 'Accept: application/json'` 遍历 11 条路径 + 浏览器 Accept 对照
- **结果**：见 §3.1 表格（confirmed）
- **意义**：R1 结论的**机制层**论据（普遍行为 vs 特例）成立

### V12：类型系统假设验证（**含反证**）

- **方法**：在 `frontend-v3/src/` 放类型探针文件后跑 `npx vue-tsc --noEmit`
- **结果（confirmed）**：
  - 探针 1：`computed(() => boolean)` **可** `provide` 给 `InjectionKey<Ref<boolean>>`（Vue 3.5.34，`ComputedRef extends Ref`）→ vue-tsc **exit=0**
  - 探针 2：`readonly(ref)` 可 provide；`computed` 可赋给 `Ref<boolean>`；`route.meta?.zen` 可选链类型通过 → **exit=0**
  - **反证**：故意写入 `const n: number = "..."` → vue-tsc **exit=2**（`TS2322`）→ **证明 exit=0 非恒真**
- **意义**：N5 结论成立（**`ZenModeKey` 类型声明不需改**，computed 直接兼容）；§3.2 方案 A 的类型前提成立
- **清理**：探针文件已删除（`ls` 确认不存在）

### V13：gate 命令基线实跑（**决定 gate_commands 可声明性**）

| 命令 | 实测结果 | 可否作 gate 键 |
|---|---|---|
| `make test-frontend` | **110 passed / 1343 passed \| 4 skipped（1347）**，**19.2s** | ✅ 绿 |
| `make typecheck` | `✓ type check passed`，**exit=0** | ✅ 绿 |
| `make lint` | `All checks passed!`，**exit=0** | ✅ 绿 |
| `make check-docs` | `✓ 所有文档与代码保持一致`，**exit=0** | ✅ 绿 |
| `E2E_SPEC=e2e/viewer.spec.ts make debug-test` | ❌ **18 failed / 20 passed（2.5m）** | ❌ **预存红灯，不可作 gate 键** |

- **意义**：§6.3 判定依据（`viewer.spec.ts` 红灯成因 = `markdown-test` 团队限定 → 匿名 404，即 P1 §2.4 登记的 team-scoped 前提）；前端单测基线 = **1343 passed**（与派发指引给定基线一致）

---

## 5. 实现完成的标志（供 P3/P5/P6 判定）

1. `frontend-v3/src/router.ts` 含 `/:slug/f` 路由记录（`name: 'detail-zen-locked'`、`meta: { zen: 'locked' }`），位置在 `/:slug` 之后、catch-all 之前
2. `useZenMode` 签名为 `(locked: () => boolean = () => false)`、`zenMode` 是 **computed(() => locked() \|\| manualZen.value)**、调用点传 thunk `() => route.meta?.zen === 'locked'`、返回对象**已移除 `updateZenAria`**；`handleZenKeydown` 首行是锁死短路 `return`（**不含** `preventDefault` / `stopPropagation`）
3. 锁死态 `aria-live` 文本**不含** `Escape` / `exit` 子串
4. 浏览器访问 `/{slug}/f` → chrome 8 项全隐藏、内容区占满视口（桌面 + 移动）
5. `/{slug}/f` 下按 `f`/`F`/`Ctrl+f`/`Escape` → chrome 可见性、内容区几何、URL **三者均不变**
6. `/{slug}/f` 下 `TableView` 分页浮层可开、按 Escape **可关**（且视图保持）
7. `/{slug}`（无 f）与 f 键 zen **行为完全不变**（BDD-11/BDD-12）
8. `/{slug}/f/xyz` **不**渲染 entry 内容；不存在 slug + `/f` **不**落路由级 NotFoundView
9. `DESIGN.md` / `CHANGELOG.md` / `improvement-backlog.md` 三处文档已同步
10. `make test-frontend` + `make typecheck` + `make lint` 全绿；两个新 E2E spec 全绿

---

## 6. gate_commands（P2 固化，P4-P6 不得修改）

> 约束执行：**每个 E2E 键一律 `E2E_SPEC=<spec> make debug-test` 定向**（R-07：裸 `make debug-test` 只跑 `e2e/debug-server.spec.ts`，会让 19 条 BDD 的 E2E 层整体零覆盖 = 最坏一类假绿）；**禁止 `&&` 拼接**（短路会让后半段从不执行）；测试键只允许裸 `P3`（禁 `P3_xxx` 检测键）；全部引用 Makefile target（Makefile 是测试命令唯一真相源）；E2E 档 **900s**（> runner 内层 `E2E_TIMEOUT` 默认 600s，见 `scripts/run-e2e-tests.sh:92`），单测档 120s，构建类未声明（本任务无构建型命令）。

```yaml
gate_commands:
  P3: "make test-frontend"
  P3_formatter: "vitest.sh"
  P3_timeout_seconds: 300
  P5: "make test-frontend"
  P5_timeout_seconds: 120
  P5_typecheck: "make typecheck"
  P5_typecheck_timeout_seconds: 180
  P5_lint: "make lint"
  P5_lint_timeout_seconds: 120
  P5_docs: "make check-docs"
  P5_docs_timeout_seconds: 120
  P5_e2e: "E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test"
  P5_e2e_timeout_seconds: 900
  P5_e2e_auth: "E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test"
  P5_e2e_auth_timeout_seconds: 900
  P6: "make test-frontend"
  P6_timeout_seconds: 120
  P6_typecheck: "make typecheck"
  P6_typecheck_timeout_seconds: 180
  P6_e2e: "E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test"
  P6_e2e_timeout_seconds: 900
  P6_e2e_auth: "E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test"
  P6_e2e_auth_timeout_seconds: 900
  project_module: "src/"   # 协议读取器按此前缀定位前端源码根（实测有效、gate 不拦）；本任务前端源码根 = frontend-v3/src
```

### 6.1 E2E 键 → spec 文件 → BDD 覆盖映射（**P3 据此写用例、P5 据此跑，事后不得改**）

| gate 键 | spec 文件 | 覆盖 BDD | 认证前提 | 用例数 |
|---|---|---|---|---|
| `P5_e2e` / `P6_e2e` | `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（**新建**） | BDD-1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18, 19 | **匿名可达**（全用匿名可见 seed） | **16** |
| `P5_e2e_auth` / `P6_e2e_auth` | `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts`（**新建**） | BDD-9, 10, 15 | **登录创建自建私有 entry + 登录建 share**（BDD-9/15 用 alice 登录读既有 seed） | **3** |

**切分轴 = 认证前提**（**为何这样切**）：

- 该轴来自 **P1 逐条实测出的客观可达性分界**：匿名可见 15 条 seed / 团队限定 3 条（`csv-employees`/`markdown-test`/`mermaid-charts` 虽 `is_public: true` 但带 `team_id` → 匿名 **404**，P1 §2.4 末两行已实测登记）。
- 混在一个 spec 里会让**登录态污染匿名用例**（cookie 在同一 browser context 内共享），产生脆弱且难诊断的失败。
- **⚠️ viewport 钉定（硬约束，P3 须照做）**：`frontend-v3/playwright.config.ts:20-40` 的两个 project 默认视口是 `devices['Desktop Chrome']` = **1280×720**、`devices['Pixel 5']` = **393×727**，**都不等于 BDD 要求的 1280×800 / 390×844**。故两个 spec **必须**按既有范式显式钉定：桌面用 `test.use({ viewport: { width: 1280, height: 800 } })`、移动用 `test.use({ viewport: { width: 390, height: 844 } })`（先例：`tpv0091-unicode-preview-download.spec.ts:66,132`、`t084-scroll-architecture.spec.ts:68,221`、`render-regression.spec.ts:67,263` 等 10+ 处）。**不得**依赖 project 默认视口。
- **不是**按技术层切（非 Vertical Slice 判据二的违反）：两条 spec 各自是"一条端到端可交付能力"——`tpv0099-fullscreen-link.spec.ts` = "匿名分享链接可用"，`...-auth.spec.ts` = "登录态下的全屏链接可用（含私有分享）"。
- **BDD-10 的特殊处置**：它要求"E2E 内自建私有 entry + share token，slug 带 `e2e-` 前缀，`afterEach` 清理"（P1 rev1 建议 13）→ 归入 auth spec（**登录创建 + 登录建 share + 登录删除**，见下"认证配对"注意）。

**⚠️ 认证配对注意（形态唯一，不留待决定）**：BDD-10 的自建 entry 须**认证配对**：

1. **alice 登录**（取 `access_token`）→ 2. **同一 token 创建私有 entry**（`is_public: false`，`e2e-` 前缀）→ 3. **同一 token 创建 share**（`POST /api/v1/entries/{slug}/shares`，收 `share_url`/token）→ 4. **匿名**带 `?share=<token>` 访问 `/{slug}/f`（BDD-10 的 Then）→ 5. **同一 token 删除 entry**（清理）。

- **`afterEach` 清理队列存 `{slug, share_id}` 二元组**（而非仅 slug）——share 记录随 entry 删除失效，故须同存 id 以便断言/兜底撤销。
- **"无残留"的判定 = 清理后以 alice 复查 `GET /api/v1/entries/{slug}/raw` = 404**（把判据落在**结果**上，而非"删除者身份"上）→ 不删或删失败会被该断言捕获。
- **为什么不能"匿名创建 + 匿名删除"**（三条服务端约束，已实测）：① 匿名建 entry 被强制改写 `is_public=True`（`api/entries.py:135-139`）→ **永不产生 share token**，BDD-10 的 Given 不成立；② share 端点全部 `Depends(require_auth)`（`api/shares.py:18-23`）→ 匿名 POST `/shares` **401**；③ 公开 entry 禁建 share（`services/share_service.py:54-55`，**400** `Public entries don't need share links`）。→ 即"匿名创建"与"私有 entry + share token"**不可同时成立**；照旧措辞只有"必红"或"退化为公开 entry 恒真可读"两条错路。
- **⚠️ 不采用"匿名删除"作为清理手段**：实测匿名 DELETE 确返回 200，但该放行**依赖 `config.server.api_key` 为空**（`api/entries.py:476-478` 的 `allow_local = no_server_auth and current_user is None`，`config.py:164-167` 默认 `""`）——是**环境条件的产物、不是稳定契约**；一旦设置 `PEEKVIEW_SERVER__API_KEY`，匿名删将 404 → 恰会制造出静默残留。认证删除与创建**同上下文、与环境配置解耦**，故取认证删除。
- **范本**：`frontend-v3/e2e/t058-share-redesign.e2e.spec.ts:25-95`（注册/登录取 token → `Authorization: Bearer` 建私有 entry → share 列表/撤销清理的既有链路，已列入 §7 `files_to_read`）。
- BDD-9/BDD-15 使用既有 seed（`markdown-test` / `mermaid-charts`），需 alice 登录态——**与 BDD-10 的自建 entry 不得交叉污染**；BDD-10 用 `test.describe` 独立分组 + 独立 `afterEach` 清理队列。

**BDD-10 的区分力判据（防恒真退化）**：三者结果必须**互不相同**——带 `?share=<真实 token>` **可见正文**；**无 token** 与 **伪 token** 均**不可见**。否则该用例退化为恒真假绿。

**P3 红灯命令说明**：`P3: "make test-frontend"` —— 本任务的可单测行为是"锁死态下按键不改变状态 + 公告文本不含退出词 + 非锁死态行为不变"，落在 **vitest 单测层**（M9 的 `useZenMode.spec.ts`），故 P3 用前端单测；`P3_formatter: "vitest.sh"` 使 `check-tdd-red.py` 能标准化解析 vitest 输出（`agate_common.resolve_formatter` → `assets/formatters/vitest.sh`，解析 `Tests N passed/failed` 与 `FAIL <file>`）。E2E 层红灯由 `P5_e2e` 承担（不做 P3_e2e——避免 `P3_e2e` 与裸 `P3` 的红灯语义混淆；本任务 E2E 是回归确认而非 TDD 驱动）。

**`P3_timeout_seconds: 300`** 为静态声明供阅读（P2 卡规则 1：`timeout_seconds` **不覆盖 P3**，P3 运行时走 `AGATE_TDD_TIMEOUT`，默认 120s；实测 `make test-frontend` 19.2s，含 cd/依赖检查余量 300s 充裕）。主 Agent 派发 P3 时如沿用默认 120s 亦可（实测 19.2s << 120s）。

**⚠️ `P5/P6_timeout_seconds: 120` 的适用前提（档位本轮**不改**，只登记前提）**：`make test-frontend` 实测 **17.8~19.2s**，但 `Makefile:173` 的 target 体含 `if [ ! -d node_modules ]; then npm ci` 分支——**`frontend-v3/node_modules` 缺失时该命令退化为 `npm ci`（分钟级）**，120s 会被外层 `timeout` 砍掉并**误报失败**。故：**执行 P5/P6 前须确认 `frontend-v3/node_modules` 已就绪**（本机当前已就绪，实测绿）；干净检出首跑时，由执行方按 P2 卡规则 4 的「预期耗时 ×1.5」临时上调，或先单独跑一次 `make test-frontend` 完成依赖安装。P3 档已是 300s，不受此限。

### 6.2 架构适应度检查（Fitness Functions）

本任务涉及的架构约束与对应检查（均已在 V13 实跑为绿，故声明为 gate 键）：

| 约束维度 | 检查 | 键 |
|---|---|---|
| **类型契约稳定性**（跨层：路由 meta → composable → provide → 组件） | `make typecheck`（`vue-tsc --noEmit`）—— 新增路由 meta / computed provide 的类型改动必须全仓无错 | `P5_typecheck` |
| **后端代码规范未被破坏 + 本任务「理论零后端改动」未被越界** | `make lint`（`Makefile:185` → `ruff check peekview/ tests/`）。⚠️ **该命令只覆盖后端 Python，测不到任何前端越界/适应度**（**不是**前端 lint 门禁）——本任务用它只为探测「后端确实没被动过」；前端侧的类型契约由 `P5_typecheck` 承担，**前端目前无 lint / 适应度检查工具**（`frontend-v3` 无 eslint 配置、CI 亦不跑前端 lint），此空缺属既有状况、不在本任务补 | `P5_lint` |
| **公开文档契约一致性**（M4/M6 改文档 → 与代码/环境变量一致性） | `make check-docs` | `P5_docs` |

**未配置的维度与理由**：① **循环依赖/分层边界**——项目无既有依赖分析工具（`grep` 全仓无 `depcruise`/`madge`/`import-linter` 配置），本任务新增的是**路由表一行 + composable 一个参数**，不引入新模块依赖边；② **公共 API 稳定性**——无对外 API 签名变更（R1 决策 = 后端零改动）。

### 6.3 既有 E2E spec 不作 gate 键的理由（R-08）

实测 `E2E_SPEC=e2e/viewer.spec.ts make debug-test` → **18 failed / 20 passed（2.5m）**：

- **成因**：`viewer.spec.ts:20-25` 的 `openMarkdownFile` 依赖 `markdown-test`（`is_public: true` 但带 `team_id: frontend-team`）→ 匿名 404、页面进错误态 → 断言失败（`viewer.spec.ts:286` 等）
- **性质**：**预存红灯**（与 TPV0099 无关），成因为 **TPV0095 引入的 seed 语义回归**——**归属 TPV0097/TPV0098「用例可信治理」**（E2E 用例与 seed 语义脱节），**不归 DEBT0012**
- **与 DEBT0012 的三维对照**（勿混，两者根因不同）：

  | | DEBT0012 | 本项（`viewer.spec.ts`） |
  |---|---|---|
  | 根因 | `seed-debug.py` 先建 entry 后建 team → 422 → entry **未入库**（数据**缺失**） | TPV0095（`59182590`，2026-09-03）指派 team → **可见性语义变更**（数据**完好**） |
  | 重跑 `make debug-seed` 能否恢复 | **能**（team 已存在即无 422） | **不能**（`team_id` 是 seed 数据本身） |
  | 修复面 | `scripts/seed-debug.py`（时序/重试） | E2E 用例与 seed 语义的**对齐治理**（TPV0097/TPV0098） |

  **判据 = 重跑 `make debug-seed` 能否恢复**。该 spec 最后一次全绿为 `d4b05ee4`（TPV0088，2026-08-12），`git merge-base --is-ancestor d4b05ee4 59182590` 为真。
- **处置**：① **不进本任务 gate**（否则 P5 必红，且红因与本任务无关）；② **不在本次修复**（属范围外，且 `viewer.spec.ts` 的改造已在 P1 §4「同类扫描」的延后判定中）；③ **登记**：**归属 TPV0097/TPV0098「用例可信治理」范围**，本任务不新立条目
- **推论（写入 P5/P6 的护栏）**：本任务的 E2E 键**全部指向新建 spec**；P4/P5 不得为"让 E2E 全绿"而去改既有 spec

### 6.4 BDD-3 的排除集**不可简化**（P4/P6 硬约束）

BDD-3 的排除集是 **A/B 两组互不对称**的规则，**两组不可互换、不可统一写成"祖先/后代"**：

- **A 组（结构链）**：`html`、`body`、`#app`、`.entry-detail` —— 逐元素排除**其自身与其全部祖先**，**不含其后代**
- **B 组（内容流容器链）**：`.detail-content`、`.content-area`、`.markdown-viewer`、`.code-viewer`、`.table-view`、`.image-viewer`、`.html-viewer`、`.empty-state`、`.error-state`、`.loading-state` —— 逐元素排除**其自身与其全部后代**（整棵子树）

**为什么不能统一**（P1 rev2 已实测证伪）：

1. **候选元素含 `html`** → 若 A 组也取"后代"，`html` 的后代 = **整个文档** → 候选集恒为空 → Then **恒真、拦截力归零**（实测：正确实现与两种失败态命中数**均为 0**）。
2. **`.detail-header`/`.title-row`/`.meta-row` 等 chrome 恰是 `.entry-detail` 的后代** → 若 A 组取"后代"，真实横条会被一并排掉 → 同样恒真失效。
3. **P1 已实测的三态闭环**（正确实现命中 0 / 强制恢复 header 命中 3 / 注入未纳入隐藏集的横条命中 1）：统一写法下②③两种失败态命中数**均为 0**，即"应 FAIL 却判 PASS"。

**对本任务方案的约束**：

- **本任务方案不新造锁死隐藏规则**（复用 zen 类，§2.1 方案 A / R-03 缓解）→ 对 BDD-3 排除集**不构成任何影响**（排除集的对象是"页面内可见元素"，"哪些元素可见"由 zen 隐藏集决定，与本任务的状态承载方式无关）。
- **若 P4 偏离方案去新造隐藏规则**：必须覆盖 zen 隐藏集**全部 8 项**（§1.3 R-03 表，含易漏的 `layout.css:208` 的 `.resize-handle`），否则会在全屏视图残留满宽横条 → **BDD-3 命中 ≥ 1 → FAIL**（正是 P1 实测的失败态③）。
- **P6 护栏**：BDD-3 的 E2E 实现必须**逐字照抄 A/B 两组规则**（A 取祖先、B 取后代），**禁止**为实现方便把两组合并为"祖先/后代"或简化为"排除容器链"。

### 6.5 验证执行约束（**P6 硬约束，防非本任务成因的 FAIL**）

> 来源：R-04（V7 结果 C）。`.archived-banner` / `.expired-warning-banner` 在 zen 态下仍是满宽顶部横条（实测 1280×49、top=0），且**不在 BDD-3 的 A/B 排除集内**、**不在 zen 隐藏集内**。

1. **BDD-1 / BDD-2 / BDD-3 的 E2E 必须钉定非归档、非过期的 seed**——**推荐 `dsh-architecture`**（与 P1 rev2 的 BDD-3 自证所用一致，且 P1 已实测匿名 200）。
2. **理由（必须写进 spec 注释，防后人误改）**：BDD-3 的 Given 是 **entry 无关的**（只规定"桌面视口 1280×800，全屏视图已加载完成"，未指定 slug）。若执行者挑到 archived/expired entry（如 `legacy-deploy`），BDD-3 会在**一个与本任务无关的既有条件**（banner 不在 zen 隐藏集）上判 FAIL，而被误读成"本任务实现错了"。
3. **禁止**用 `legacy-deploy` 或任何 `status: archived` / 已过期 entry 跑 BDD-1/2/3。
4. 其余 BDD 的 seed 前提照 P1 各条的实测结论执行（`dsh-architecture` / `tsv-server-metrics` / `unicode-filenames` 匿名；`markdown-test` / `mermaid-charts` 需 alice；BDD-10 由 alice **登录创建**私有 entry + 登录建 share，清理后 alice 复查 404）。

### 6.6 P3_e2e 声明说明

**不声明 `P3_e2e`**。理由：本任务的 TDD 红灯落在**单测层**（`useZenMode.spec.ts`，纯 composable 逻辑可直接单测：锁死态按键不改变状态、公告文本词表、非锁死态行为不变），E2E 层是**回归确认**（19 条 BDD 的真实浏览器验证）而非 TDD 驱动的新行为——E2E 用例需要 `/{slug}/f` 路由已存在才能跑，无法先于实现"红灯"（会红在路由不存在 = 无信息量的红灯）。E2E 的验证职责由 `P5_e2e` / `P5_e2e_auth` 承担。

---

## UI 设计（形态与维度专题节，不参与章节编号）

> `ui_affected: true`。本节按 P2 卡规格产出：渲染形态声明 + 维度选择 + 按形态 checklist（常规布局型 = 布局/交互/视觉三类）。

### 渲染形态声明

- 渲染形态: layout（布局型——本任务改变的是 chrome 的**可见性与布局占位**（header / 侧栏 / 移动端条 / 元信息条 / 拖拽手柄的显隐）与**内容区几何**（占满视口）；不涉及组件内部绘制方式与动画时序，内容渲染能力照常工作、不新增）
- 适用维度: 布局结构 / 交互行为 / 视觉呈现（与 P1 frontmatter `ui_ux_dimensions` 完全一致）

### 布局 checklist（布局结构维度）

- [x] **页面/组件层级结构已描述**：`.entry-detail`（根，承载 `zen-mode` 类）→ 子级为 `EntryDetailHeader`（`.detail-header` / `.mobile-sticky-header`）、`EntryDetailBanners`、`EntryDetailContent`（`.detail-content` → `.file-sidebar` + `.content-area`）、`EntryDetailMobileBar`（`.mobile-bottom-bar`）、`EntryDetailDialogs`。全屏视图下 8 项 chrome 隐藏（V7 已逐一实测），层级结构本身不变
- [x] **关键区域占位关系已描述**：非全屏 = 桌面三栏（header 上方 + 文件侧栏左 + 内容区右，含 `.toc-sidebar`），内容区 1040×693（实测，1280×800 下 top=107）；全屏 = **单区**（仅 `.content-area`，1280×800、top=0）。弹层（分页浮层 / 图表弹层 / 对话框）关系不变，仍浮于内容区之上
- [x] **桌面与移动两档 viewport 布局均已说明**（对应 P3 的 desktop_1280x800 / mobile_390x844 截图）：
  - **桌面 1280×800**（实测）：全屏下内容区 **top=0 / height=800 / width=1280**（BDD-2：顶边差 0 ≤ 1px、高度 800 ≥ 800−1 ✅）；8 项 chrome 中桌面实际渲染的 4 项（`.detail-header`/`.file-sidebar`/`.toc-sidebar`/`.resize-handle`）全 `display:none`
  - **移动 390×844**（实测）：全屏下内容区 **top=0 / height=844 / width=390**（BDD-14 ✅）；`.mobile-sticky-header` / `[data-testid="mobile-bottom-bar"]` / `.meta-tags-bar` 三者全 `display:none`；`scrollHeight=5227 > clientHeight` 可纵向滚动，滚至底部末段正文仍可见（BDD-14 滚动子句 ✅）

### 交互 checklist（交互行为维度）

- [x] **键盘可达性已覆盖**：① **锁死态**：`f`/`F`/`Ctrl+f`/`Escape` **均不改变视图**（BDD-4/BDD-5，V6 S3 实测 `lockShortCircuit` 计数 +3 而视图不变）；② **锁死态内容区内嵌组件**：元素级 Escape 消费**优先且不被吞**（BDD-7，V6 S4 实测浮层关闭 + 视图保持；S5 反证 capture+stopPropagation 才会吞）；③ **非锁死态**：f 键进入 zen、Escape 退出**行为完全不变**（BDD-12，V6 S1/S6 实测）；④ 内容区外可聚焦元素在锁死态为 **0**（V9 实测），BDD-6 枚举范围为 0 项
- [x] **输入态变化已定义**：无文本输入态用例。状态变化仅有"**路由 → zen 态**"一条：`route.meta.zen === 'locked'` 为真 → `zenMode=true` → 8 项 chrome 隐藏 + 内容区占满。该派生用 **computed**，实测在①初始直载②客户端导航③返回非锁死路由三种路径下均正确（V4/V6）
- [x] **反馈态已覆盖**：① **loading**：非锁死态内容区有 `.loading-state` 骨架（`EntryDetailContent.vue:25`），锁死态**照常渲染**（内容区未改）；② **error**：不存在 slug + `/f` → 详情视图错误态（`.error-state` 文案 `Request failed with status code 404`，实测），**不落路由级 NotFoundView**（BDD-18 ✅）；③ **empty**：`Entry not found`（`.empty-state`）——BDD-18 明确**不裁定**用 empty 还是 error（「唯一硬性要求是不落路由级 NotFoundView」），现状走 error 态即符合；④ **disable**：无
- [x] **输入态变化类用例：无**（本任务无输入态用例）→ 无需 P6 输入态人工复核；但 **BDD-16（人工体验路径）不可省**（P1 强制节：真实 seed + 截图，不得以 fixture/单测替代）
- [x] **[渲染组件型可选] 手势/动作交互**：**维度不适用**（layout 形态；无旋转/缩放/拖拽类新交互。既有侧栏拖拽手柄 `.resize-handle` 在全屏下隐藏，其拖拽能力不在本任务范围）

### 视觉 checklist（视觉呈现维度）

> **视觉契约断言 = 可表达子集**：宽度/高度/对齐/重叠/溢出五类 DOM 度量。本任务的视觉断言全部以 `getBoundingClientRect()` 度量表达（见下），不收主观视觉判断。

- [x] **颜色/对比度已说明**：**本任务不改任何颜色**（零 CSS 改动，N4）。全屏视图沿用既有 zen 视觉：背景 `var(--c-bg)`（`.entry-detail`），正文沿用既有 markdown/代码配色。无新增前景/背景组合 → **无新增对比度风险，不需要新的 WCAG AA 断言**（既有配色在本任务前后完全一致）
- [x] **字体层级与间距节奏已说明**：**不改**。全屏下 chrome（标题栏/侧栏/移动端条）隐藏 → 其字体层级自然不参与呈现；内容区字体与间距沿用既有渲染组件。唯一相关间距：移动端 `.entry-detail.zen-mode .content-area { padding-bottom: var(--space-3) }`（`EntryDetailView.vue:262`，`max-width:640px`）——**既有规则，本任务不改**，且实测不影响 BDD-14 的几何判据（内容区仍 top=0 / height=844）
- [x] **组件一致性（圆角/阴影/图标风格）已说明**：**不改**。全屏视图下剩余可见组件（内容区渲染器：`MarkdownViewer`/`CodeViewer`/`TableView`/`ImageViewer`/图表组件）的圆角/阴影/图标**全部沿用既有实现**，本任务不触碰任何组件样式
- [x] **视觉契约（可量化 DOM 度量断言，**本任务的视觉判据全部落在此**）**：
  - **宽度**：内容区左右边界与视口边界之差各 **≤ 1px**（BDD-3 后半句，实测宽度 1280 = 视口 1280 ✅）；全屏视图内**不存在**宽度 ≥ 视口 90%（≥1152px）且高度 ≥ 8px 的满宽横条（BDD-3 主判据）
  - **高度**：内容区高度 **≥ 视口高度 − 1px**（BDD-2/BDD-14，实测桌面 800、移动 844 ✅）；被隐藏 chrome 高度 **= 0**（BDD-1/BDD-14，实测 8 项均 0 ✅）
  - **对齐**：内容区顶边纵坐标与视口顶边之差 **≤ 1px**（BDD-2/BDD-14，实测桌面 top=0、移动 top=0 ✅）
  - **重叠**：无重叠断言（全屏下无 chrome 与内容区争位；弹层浮于内容区之上属既有行为）
  - **溢出**：移动端内容区可纵向滚动至正文末尾（BDD-14，实测 `scrollHeight=5227 > clientHeight=844`，滚至 `scrollTop=4383` 末段仍可见 ✅）

### UI 测试选择器清单（P2 卡建议项 → P3/P4 用稳定标识）

**优先使用既有 `data-testid`（稳定标识），不依赖 class 命名**（class 可重构、testid 不变）：

| 用途 | 选择器 | 性质 | 备注 |
|---|---|---|---|
| 内容区（几何断言主对象） | `[data-testid="content-area"]` | ✅ **稳定** | BDD-2/3/14 的唯一/主要判据对象 |
| 移动端底部条 | `[data-testid="mobile-bottom-bar"]` | ✅ **稳定** | BDD-1/14 |
| 内容区图片 | `[data-testid="image-content"]` | ✅ 稳定 | BDD-17（`svg-icons` 走 ImageViewer） |
| 内容区图片错误态 | `[data-testid="image-error"]` | ✅ 稳定 | BDD-17 反证（须 count=0） |
| 全屏视图根节点 / zen 挂载点 | `.entry-detail` | ⚠️ class（既有，无 testid） | BDD-1/11/12；zen 类断言 |
| zen 类 | `.entry-detail.zen-mode` | ⚠️ class | BDD-1 证据锚点 |
| 路由级 NotFound 根节点 | `.not-found` | ⚠️ class | BDD-13/18/19（**计数须为 0**） |
| 详情视图错误态 | `.error-state` | ⚠️ class | BDD-18 |
| 目录侧栏 | `.toc-sidebar` | ⚠️ class | BDD-9 |
| 文件名（文件树内） | `.file-tree .file-name` | ⚠️ class | 既有 spec 用法（`tpv0091` 先例） |
| 文件间链接 | `a[data-peekview-file-id]` | ✅ **稳定属性** | BDD-8 |
| 分页浮层触发/浮层 | `.per-page-trigger` / `.per-page-listbox` | ⚠️ class（`TableView.vue` 内） | BDD-7 |
| 公告区 | `.sr-only[aria-live]` | ⚠️ class + 属性 | BDD-6 |
| 图表全屏按钮/弹层/关闭 | `.fullscreen-btn` / `.diagram-modal` / `.close-btn` | ⚠️ class | BDD-15（**已对齐 TPV0096 死选择器迁移后的实际 DOM**，勿用已死的 `.mermaid-action-btn`/`.diagram-modal-overlay`） |
| 被隐藏 chrome（8 项） | `.detail-header` / `.file-sidebar` / `.toc-sidebar` / `.mobile-actions` / `.mobile-sticky-header` / `.mobile-bottom-bar` / `.meta-tags-bar` / `.resize-handle` | ⚠️ class | BDD-1/14（P1 §4.2 清单） |

**建议（P3 采纳与否由 P3 决定）**：BDD 断言优先用 `[data-testid]`；确需 class 的项（如 `.entry-detail`）**在 spec 内集中定义为常量**，便于 class 重构时单点更新。

---

## 7. files_to_read（P4 implementer 的实现导航）

> 只列**实现确实需要参考**的文件，大文件标行号范围。**不列**已在本文件内充分展开、无需再读的（如 P1 全文）。

```yaml
files_to_read:
  - path: frontend-v3/src/composables/useZenMode.ts
    why: 【主改动点 M2】全文 36 行；`zenMode` 改 `computed(() => locked() || manualZen.value)`、签名加 `locked: () => boolean = () => false` 入参、`handleZenKeydown` 顶部短路、`zenAriaText` 改 computed、**移除 `updateZenAria` 并从返回对象删键**（形态唯一化见 §1.1「最终规格」表与三个禁止变体）
  - path: frontend-v3/src/views/EntryDetailView.vue:1-10,144-160,209-228,255-265
    why: 【M3】根节点 zen 类绑定（:2）、useZenMode 调用（:155）、provide（:158-160）、document keydown 注册/注销（:216/:226）、scoped 隐藏集（:255-265，本次不改但要确认 8 项）
  - path: frontend-v3/src/router.ts:42-58
    why: 【M1】路由注册位置：/:slug（:48-52）之后、catch-all（:53-57）之前
  - path: frontend-v3/src/composables/entryDetailKeys.ts
    why: 【N5】仅 5 行；确认 ZenModeKey 类型（InjectionKey<Ref<boolean>>）不需改（computed 兼容）
  - path: frontend-v3/src/utils/zen-shortcut.ts
    why: 【N6】仅 20 行；确认 shouldHandleZenShortcut 签名与语义（纯函数、不持 zen 状态）；短路位置在调用方
  - path: frontend-v3/src/components/TableView.vue:55-90,213-261
    why: 【BDD-7 对象】元素级 @keydown 绑定（:68/:77）与 Escape 分支（:227 onTriggerKeydown / :243 onListboxKeydown）；确认锁死短路不吞它
  - path: frontend-v3/src/components/EntryDetailHeader.vue:1-16,140-145
    why: 【N7】v-show="!zenMode" 兜底（:3/:13）+ inject(ZenModeKey)（:142）；确认为何不改
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue:1-5,95-100
    why: 【N7】同上（:2 v-show + :97 inject）
  - path: frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts:1-60
    why: 【E2E 编写规范范本】BASE_URL 护栏、fileId 解析 helper、双 project 适配（desktop/mobile 分支）、证据目录约定
  - path: frontend-v3/e2e/t058-share-redesign.e2e.spec.ts:25-95
    why: 【BDD-10 认证配对范本】注册/登录取 `access_token` → `Authorization: Bearer` 建**私有** entry → share 列表/撤销清理的既有链路；BDD-10 的"登录创建 + 登录建 share + 登录删除"照此实现
  - path: backend/peekview/api/shares.py:18-23
    why: 【BDD-10 前提的契约依据】三个 share 端点（create/list/revoke）均 `Depends(require_auth)` → **说明为何匿名路径不可行**（匿名 POST `/shares` = 401）；配合 `api/entries.py:135-139`（匿名建 entry 被强制转公开）与 `services/share_service.py:54-55`（公开 entry 禁建 share = 400），三条共同证明"匿名创建"与"私有 + share token"不可共存
  - path: frontend-v3/playwright.config.ts
    why: 【E2E 环境】双 project（chromium + Mobile Chrome/Pixel5）、baseURL 默认 :8888、无 webServer 自启
  - path: frontend-v3/src/composables/__tests__/useEntryDetailComputed.svg.spec.ts
    why: 【单测 placement 范本】composables 层单测的存放位置与写法（新建 useZenMode.spec.ts 参照）
  - path: frontend-v3/src/components/__tests__/t031-entry-detail-view.spec.ts:155-175
    why: 【测试 mock 面】现有 vue-router mock 形态（useRoute 只返回 params/query/path，**无 meta**）→ 决定 mock 是否需补 meta
  - path: DESIGN.md:208-214
    why: 【M4】「Zen Mode」节现状（只写 f 进入/Escape 退出）→ 补全屏链接入口
  - path: CHANGELOG.md:1-25
    why: 【M5】[Unreleased] 现状与条目风格（对齐 TPV0096 条目写法）
  - path: docs/roadmap/improvement-backlog.md:386-403
    why: 【M6】#56 条目：状态改已完成 + 更正"zen 外观统一…同时影响现有 f 键 zen，P1 确认"这条已被证伪的前提
  - path: scripts/seed-data/dsh-architecture/meta.json
    why: 【验证 seed 确认】BDD-1/2/3 钉定的 seed（匿名 200）；确认无过期/归档字段
```

---

## 8. env_constraints（确认/细化 P0-brief，**不弱化**）

```yaml
env_constraints:
  debug_env: "debug backend http://127.0.0.1:8888（v0.24.1）——`make debug-quick` 一步到位（build-frontend-fast + debug-start + debug-seed，~20s）；changing frontend REQUIRES `make build-frontend` or `make debug-quick`（static 双路径：优先 frontend-v3/dist，其次 peekview/static）"
  isolation_check: "① 严禁触碰生产 :8080 与 ~/.peekview/；② 严禁 `uvicorn` 直接启动；③ 严禁 `make debug` / `npm run dev`（vite :5173 代理到 :8080 生产，会读写生产数据）；④ E2E 必须经 `make debug-test`（E2E_GUARD_ENABLED 护栏 + BASE_URL 非 8080 断言 + DB 路径须含 /tmp/peekview-debug）；⑤ 状态标记 [PROD_TOUCHED] / [PROD_NOT_TOUCHED]"
  dsh_sandbox: "DSH 沙箱：/tmp 与 ~/.local/share 只读，且 /tmp 跨 bash 调用不共享文件；后台服务须挂持续 running 的 job 托底（前台调用一结束其进程树即被回收）；临时产物落 {project_root}/.agate-tmp/"
  e2e_runner_gotcha: "⚠️ `make debug-test` 裸调用只跑 e2e/debug-server.spec.ts（scripts/run-e2e-tests.sh:78 的 E2E_SPEC 缺省值）→ 所有 E2E 键必须用 E2E_SPEC=<spec> 定向；run-e2e-tests.sh 内层 E2E_TIMEOUT 默认 600s → 外层声明 900s"
  known_red_baseline: "⚠️ 既有 E2E spec viewer.spec.ts 当前 18 failed/20 passed（预存红灯：markdown-test 团队限定 → 匿名 404）→ 不作 gate 键、不在本次修复，归属 TPV0097/TPV0098「用例可信治理」（TPV0095 引入的 seed 语义回归；**不归 DEBT0012**——判据见 §6.3：重跑 make debug-seed 不能恢复）"
  verification_seed_pin: "⚠️ BDD-1/2/3 必须钉定非归档/非过期 seed（推荐 dsh-architecture）——原因见 P2-design §6.5：archived/expired entry 的 banner 是满宽横条且不在 zen 隐藏集/BDD-3 排除集内，会产生非本任务成因的 FAIL"
  auth_premise: "BDD-9(markdown-test；用 `resolveFileId(request, 'rich-markdown.md')` **动态解析** fileId，**勿硬编码** `?firstFileId=43`——该序号随 DB 重建失效，现值为实测正确的时点值) / BDD-15(mermaid-charts) 需 alice 登录（is_public:true 但带 team_id → 匿名 404）；BDD-7(tsv-server-metrics) / BDD-8(unicode-filenames) / BDD-1,2,3,13,18,19(dsh-architecture) 匿名可达；BDD-10 = **登录创建**私有 entry（e2e- 前缀）+ **登录建 share** + **登录删除**（afterEach 存 {slug, share_id}，清理后 alice 复查 raw = 404）"
  seed_counts: "三个口径都对，勿混：seed-data 目录 24 / alice 可见 22 / 匿名可见 15"
  tooling: "Playwright 用全局包（require('/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules/playwright') + connectOverCDP('http://127.0.0.1:18800')）；脚本须 try/finally { page.close() } + process.exit(0)，禁止 browser.close()（会杀 Chrome）"
  timeout_discipline: "所有 bash 命令外层 `timeout Ns`：单测/typecheck 120-180s、E2E/构建 300-600s×1.5；gate 声明取 P2 卡三档基准（单测 120s / E2E 900s——本项目 runner 内层 600s 故上调）"
```

> **边界提醒（P2 卡）**：以上 `env_constraints` 是**声明性**字段，不会被自动执行、也无 gate 校验其成立。真正被强制执行的是 `gate_commands`（§6）与 §6.5 的 *验证执行约束*（已作为 P6 卡 checklist 的输入交给主 Agent——**请主 Agent 确认该项进入 P6 dispatch-context**，否则它只是"写下来的建议"）。

---

## 9. 遗留与需主 Agent 裁决项汇总

| # | 项 | 处置 | 归属 |
|---|---|---|---|
| 1 | `[SCOPE+]`：banner 满宽横条（§1.3 R-04） | **本任务不采纳**（三条理由），仅登记；**验证侧规避已落为硬约束**（§6.5） | 已裁决（主 Agent 已确认） |
| 2 | `[P1_CORRIGENDUM]`：P1 §4.2 line 359 与 §5 line 403 自相矛盾（§1.2 N12 下方） | P2 登记更正，**不改 P1 文件**；主 Agent 同步 orchestrator-log | 已裁决 |
| 3 | 既有 E2E `viewer.spec.ts` 18 failed（§6.3） | 不进本任务 gate、不在本次修复（TPV0095 引入的 seed 语义回归，**不归 DEBT0012**） | **归属 TPV0097/TPV0098「用例可信治理」，本任务不新立条目**（主 Agent 已决定：不立项） |
| 4 | §6.5 验证执行约束须进入 P6 卡 | 已作为声明交付；**请主 Agent 确认转抄进 P6 dispatch-context** | **待主 Agent 确认** |
| 5 | `/{slug}/f` JSON-accept 404（§3.1） | 不处理（R1 结论）；建议未来以"`FRONTEND_ROUTES` 统一收敛"独立任务处理 | 已定论 |
| 6 | `packages`/`domains` 不含 backend | 因 R1 不处理 → 保持 `[frontend-v3, docs]` / `[frontend]`（与 P1 §2.5 口径一致） | 已定论 |
| 7 | P8 `bump_type` | 用户可见功能 + 公开 URL 契约 → **minor**（与 P1 §7「倾向 minor」一致） | 交 P8 |

---

**产出完成标志**：本文件含 3 个候选方案 + 权衡/选择理由、影响面梳理三部分（含 P1 §4.3 三处 + `[P1_CORRIGENDUM]`）、`## UI 设计` 节（形态声明 + 维度选择 + 按形态 checklist 三类）、`gate_commands`（Makefile target、无 `&&`、含 `P5_e2e` + per-key timeout）、`files_to_read`、`env_constraints`、`minimal_validation`（V1-V13 全部实跑）。R1/R2/R3 三开放点均有明确取舍结论（§3.1/§3.2/§3.3）。
