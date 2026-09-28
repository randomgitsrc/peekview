---
phase: P3
task_id: TPV0099
type: test-cases
parent: P2-design.md
trace_id: TPV0099-P3-20260928
status: draft
created: '2026-09-28'
agent: test-designer
test_code_dir: frontend-v3/e2e + frontend-v3/src/composables/__tests__
packages:
- frontend-v3
domains:
- frontend
ui_affected: true
---

# P3 测试设计 — 全屏模式链接 `/{slug}/f`（TPV0099）

> 上游：`P1-requirements.md`（19 条 BDD 基线，BDD-1~BDD-19 连续）+ `P2-design.md`（M1~M9 改动清单 + §1.1 锁死态接口最终规格 + §6.1 E2E 键→spec→BDD 映射，**事后不得改**）
> 环境：debug backend `http://127.0.0.1:8888`（v0.24.1，`/health` 200）；Chrome CDP `:18800`；`[PROD_NOT_TOUCHED]`

## 0. `test_code_dir` 声明

本任务测试跨两处，**分别声明**（P3 卡要求 `test_code_dir`，本项目先例 TPV0096 用单一路径；本任务因分层跨目录故并列声明）：

```yaml
test_code_dir: frontend-v3/e2e + frontend-v3/src/composables/__tests__
```

| 层 | 文件 | 用例数 | 覆盖 BDD |
|---|---|---|---|
| 单测（vitest / jsdom） | `frontend-v3/src/composables/__tests__/useZenMode.spec.ts`（**新建**） | **7** | BDD-4 / 5 / 6 / 12（+ 接口形态 2 条 + M9 翻转 1 条，见 §2） |
| E2E（匿名可达） | `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（**新建**） | **16** | BDD-1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18, 19 |
| E2E（需登录/自建） | `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts`（**新建**） | **3** | BDD-9, 10, 15 |
| **合计** | 3 个测试文件 | **26** | **19 条 BDD 全覆盖**（1:1，无缺号/重号） |

**切分轴 = 认证前提**（照 P2 §6.1 固化，非按技术层切）：匿名可见 15 条 seed 与 team-scoped 3 条（`markdown-test` / `mermaid-charts` / `csv-employees`，`is_public: true` 但带 `team_id` → 匿名 404，P1 §2.4 末两行已实测）必须分离，否则登录 cookie 在同一 browser context 内污染匿名用例。

**gate 键对应**（P2 §6，不得修改）：`P3` = `make test-frontend` + `P3_formatter: vitest.sh`；`P5_e2e` / `P5_e2e_auth` / `P6_e2e` / `P6_e2e_auth` 分别指向上述两个 E2E spec（**一律 `E2E_SPEC=<spec> make debug-test` 定向**，防 R-07 的"裸调用只跑 debug-server.spec.ts"假绿）。

---

## 1. BDD → 测试用例 1:1 映射表（19 条全覆盖）

| BDD | 测试文件 | 测试用例名 | Given 前提（seed / 认证 / 视口） |
|---|---|---|---|
| BDD-1 | `tpv0099-fullscreen-link.spec.ts` | `test_bdd_1_fullscreen_link_enters_content_only_view` | `dsh-architecture` 匿名 / 桌面 1280×800 |
| BDD-2 | 同上 | `test_bdd_2_content_area_fills_viewport` | 同上 |
| BDD-3 | 同上 | `test_bdd_3_no_full_width_top_bar` | 同上（**硬约束 4 钉定非归档 seed**） |
| BDD-4 | 同上 | `test_bdd_4_f_key_does_not_change_view` | 同上 |
| BDD-5 | 同上 | `test_bdd_5_escape_does_not_change_view` | 同上 |
| BDD-6 | 同上 | `test_bdd_6_no_exit_route_announced` | 同上 |
| BDD-7 | 同上 | `test_bdd_7_locked_mode_does_not_swallow_embedded_escape` | `tsv-server-metrics` 匿名 / 桌面 |
| BDD-8 | 同上 | `test_bdd_8_file_switch_keeps_fullscreen` | `unicode-filenames` 匿名 / 桌面 |
| BDD-9 | `tpv0099-fullscreen-link-auth.spec.ts` | `test_bdd_9_toc_hidden_and_anchor_scroll_works` | `markdown-test` + **alice 登录** + `?firstFileId`（**动态解析**，勿硬编码 43）/ 桌面 |
| BDD-10 | 同上 | `test_bdd_10_private_entry_share_token_fullscreen` | **alice 登录取 token → 建私有 entry（`e2e-` 前缀）→ 建 share → 匿名带 token → 登录删除**（`afterEach` 清理队列）/ 桌面 |
| BDD-11 | `tpv0099-fullscreen-link.spec.ts` | `test_bdd_11_plain_slug_page_unchanged` | `dsh-architecture` 匿名 / 桌面（`/{slug}` 无 f） |
| BDD-12 | 同上 | `test_bdd_12_existing_f_key_zen_unchanged` | `dsh-architecture` 匿名 / 桌面（f 键 zen 控制组） |
| BDD-13 | 同上 | `test_bdd_13_existing_slug_fullscreen_not_route_notfound` | `dsh-architecture` 匿名 / 桌面 |
| BDD-14 | 同上（Mobile describe） | `test_bdd_14_mobile_fullscreen_no_chrome_and_fills_viewport` | `dsh-architecture` 匿名 / **移动 390×844** |
| BDD-15 | `tpv0099-fullscreen-link-auth.spec.ts` | `test_bdd_15_mermaid_renders_and_builtin_viewer_works` | `mermaid-charts` **alice 登录** / 桌面 |
| BDD-16 | `tpv0099-fullscreen-link.spec.ts` | `test_bdd_16_seeded_fullscreen_link_has_content` | `dsh-architecture` 匿名 / 桌面 + **截图留证** |
| BDD-17 | 同上 | `test_bdd_17_standalone_svg_renders_in_fullscreen` | `svg-icons` 匿名 / 桌面 |
| BDD-18 | 同上 | `test_bdd_18_nonexistent_slug_fullscreen_not_route_notfound` | `nonexistent-slug-xyz`（不存在）匿名 / 桌面 |
| BDD-19 | 同上 | `test_bdd_19_mid_path_segment_not_matching_entry` | `dsh-architecture/f/xyz` 匿名 / 桌面 |

**无缺号、无重号**（BDD-1~BDD-19 连续，19 条各命中一条用例）。单测的 4 条 BDD 编号与 E2E 的对应编号**是同一 BDD 的双层覆盖**（单测管 composable 层状态语义，E2E 管真实浏览器行为），不构成重复编号缺陷——P2 §6.6 已声明本任务 TDD 红灯落在单测层，E2E 层是回归确认。

---

## 2. 单测层（M9）用例清单（7 条）

文件：`frontend-v3/src/composables/__tests__/useZenMode.spec.ts`

| # | 用例名 | 覆盖 | 断言要点 |
|---|---|---|---|
| 1 | `test_bdd_4_locked_f_key_keeps_state_unchanged` | BDD-4 | 锁死态 `zenMode===true`；按 `f`/`F`/`Ctrl+f` 后 `zenMode` 与公告文本均不变；三个事件 `defaultPrevented===false` |
| 2 | `test_bdd_5_locked_escape_keeps_state_unchanged` | BDD-5 | 按 `Escape` 后 `zenMode` 仍 `true`、公告文本不变、`defaultPrevented===false`（BDD-7 的 composable 层等价判据：短路须整函数 return） |
| 3 | `test_bdd_6_locked_aria_announces_no_exit_route` | BDD-6 | 公告文本非空；不含 `Press f or Escape to exit` / `按 f 退出`；不含子串 `Escape` / `exit` |
| 4 | `test_bdd_12_non_locked_zen_shortcuts_and_announcement_unchanged` | BDD-12 | 非锁死态：初始 `false` → 按 `f` 变 `true` 且 `preventDefault===true`、公告含 `Escape` → 按 `Escape` 回落 `false` |
| 5 | `test_locked_interface_shape_has_no_update_zen_aria` | BDD-4/5/6（接口形态） | 返回对象**无** `updateZenAria` 键；键集合恰为 `['handleZenKeydown','zenAriaText','zenMode']` |
| 6 | `test_locked_default_argument_is_thunk_defaulting_to_false` | BDD-4/5（签名） | 省略入参 → `false`；传 `() => true` → `true`（证明入参是**被读取**的 thunk，非被忽略的裸值） |
| 7 | `test_m9_zen_derivation_follows_reactive_route_meta` | M9（BDD-12/BDD-11 结构性拦截） | **见 §3 硬约束 1** |

---

## 3. 四条硬约束的逐条落实说明

### 硬约束 1：M9 翻转用例**必须用 reactive 源**（eng-review NB-1，本轮最高价值项）✅ 已落实

**做法**（`useZenMode.spec.ts` 文件头 + `test_m9_*` 用例内**双重显式注释**）：

1. thunk 读的是 `reactive<{meta:{zen?:string}}>({meta:{}})` 构造的 **route 替身**，不是非响应式局部变量：
   ```ts
   const route = reactive({ meta: { zen: initialZen } })
   const thunk = () => route.meta?.zen === 'locked'   // ← 可选链 + reactive 源，二者缺一不可
   ```
2. 用例内**不重新调用** `useZenMode()`——单实例驱动 `false → true → false` 三相，覆盖组件复用场景（P2 §4 V3：`onMounted` 仅 1 次、DOM 节点同一）。
3. 断言含**三元组形态**：`expect([s0.zen, s1.zen, s2.zen]).toEqual([false,true,false])`，并断言公告文本随态切换/回落。

**判别力实测（P3 独立自证，非采信 P2 自述）**——`.agate-tmp/p3-flip-discrimination.cjs`（真实 vue `reactive`+`computed`，三个实现并排跑同一断言）：

| 实现 | `zenMode` 三元组 | 公告文本三元组 | 断言结果 |
|---|---|---|---|
| **正确实现**（thunk 读 reactive + `computed`） | `[false,true,false]` | `['Zen mode off.','Full screen view','Zen mode off.']` | **PASS** |
| 禁止变体（签名是 thunk 但 setup 期一次性快照） | `[false,false,false]` | 恒定 | FAIL |
| 现状实现（无参、`zenMode` 为 `ref`） | `[false,false,false]` | 恒定空串 | FAIL |

→ **仅正确实现通过**，判据有区分力（不是"看起来对"）。

**为什么必须 reactive**（写进 spec 注释防后人误改）：用非响应式局部变量驱动时 `computed` 不会重算，**正确实现也返回 `[false,false,false]`** → 会**误红正确实现**。eng-review NB-1 已实测确认此陷阱。

### 硬约束 2：实现形态以 **§1.1 最终规格表 + `:47` M3 为唯一权威** ✅ 已落实

| 规格项 | 测试侧落实 |
|---|---|
| 签名 `useZenMode(locked: () => boolean = () => false)` | 用例 6 显式传 thunk、显式省略入参，双向验证 |
| 调用点 thunk `() => route.meta?.zen === 'locked'` | 单测 `lockedFrom()` helper 逐字复刻该形态（含 `?.` 可选链） |
| 内部一律 `locked()` | 用例 6 的 `() => true` 分支证明入参被**调用**而非被当作裸值快照 |
| 返回对象**无 `updateZenAria`** | 用例 5 断言 `hasOwnProperty('updateZenAria') === false` + 键集合恰为规格三项 |
| 断言**不依赖** `updateZenAria` | 全文件零处调用 `updateZenAria`（含非锁死态用例——用 `handleZenKeydown` 驱动而非直接写 `.value`） |
| `:610` 散文用 `route.meta.zen`（无 `?.`）是**行为描述、非实现规格** | 测试**不据此写断言**；所有 thunk 均带 `?.` |
| `:98`(N13) 的"既有 DEBT" = TPV0097/TPV0098（非 DEBT0012） | E2E 键**全部指向本任务新建 spec**，不含 `viewer.spec.ts` 等既有 spec（不碰既有红灯） |
| `:97`(N14) 的 300 行上限 spec 路径 = `frontend-v3/src/components/t082-error-format.spec.ts`（无 `__tests__/` 层） | 测试**不修改**该断言；本任务不新增长行数文件 |

**附加类型纪律（P3 自主发现，防 P5 误红）**：单测首版用 `@ts-expect-error` 抑制"现状无参签名"的类型错，但 `tsconfig.json` 的 `include: ["src/**/*.ts"]` 会把该 spec 纳入 `make typecheck`（vue-tsc）——**P4 实现新签名后 `@ts-expect-error` 会变成"未使用指令"（TS2578）而打红 P5 typecheck**，属自伤性假红。故改为 `zenApi()` 类型化包装（对旧/新签名**均可编译**），实测 `vue-tsc --noEmit` **exit 0**（P3 时点与 P4 后均不翻转）。

### 硬约束 3：E2E 用例必须有区分力，禁止恒真断言 ✅ 已落实

**BDD-10（三结果互不相同）**——`tpv0099-fullscreen-link-auth.spec.ts` 先以 API 层确立基线（真 token 200 / 无 token 404 / 伪 token 404），再在浏览器层**逐态采样**并断言三者互异：

```ts
expect([noTokenVisible, fakeTokenVisible, realTokenVisible],
  '三态结果必须互不相同（应为 [false,false,true]）').toEqual([false, false, true])
```
若三者相同（如实现让私有 entry 无条件可读，或让伪 token 也放行）→ 断言立即 FAIL；若三态都不可见（实现对 token 路径也 404）→ 同样 FAIL。**不为"恒真假绿"留缝**。

**BDD-3（A/B 两组排除规则不可简化）**——逐字照抄 P1 BDD-3 的两组不对称规则（**不合并、不统一为"祖先/后代"**）：

- **A 组**（`html`/`body`/`#app`/`.entry-detail`）：逐元素向上遍历 `parentElement` 全链入排除集 = 「自身 + 全部祖先」，**不含后代**
- **B 组**（`.detail-content`/`.content-area`/`.markdown-viewer`/`.code-viewer`/`.table-view`/`.image-viewer`/`.html-viewer`/`.empty-state`/`.error-state`/`.loading-state`）：逐元素自身入集 + `querySelectorAll('*')` 全量入集 = 「自身 + 全部后代」

**P3 独立三态实测自证**（`.agate-tmp/p3-bdd3-traversal.cjs`，桌面 1280×800，CDP 实跑，脚本化遍历可复现；与 P1 rev2 数字逐一吻合）：

| 态 | 构造方式 | 可见元素总数 | 排除集大小 | 候选集 | **命中数** | 判定 |
|---|---|---|---|---|---|---|
| ① 正确实现 | `dsh-architecture` + **f 键 zen**（控制组，`/{slug}/f` 路由尚未实现） | 529 | 439 | 1 | **0** | PASS ✅ |
| ② 失败态 A | 强制 `.detail-header{display:flex!important}` | 530 | 439 | 52 | **3**（`header.detail-header` 1280×107 top=0 / `.title-row` 1232×44 / `.meta-row` 1232×26） | FAIL ✅ 拦截力在 |
| ③ 失败态 B | 注入 `#bespoke-bar`（1280×40, top=0，未纳入隐藏集） | 530 | 439 | 2 | **1** | FAIL ✅ 拦截力在 |

→ **①0 / ②3 / ③1 构成闭环**：判据对正确实现放行、对两种失败态判 FAIL，**非恒真**。另在 spec 内加了 `expect(candidateCount).toBeGreaterThan(0)` 作为"排除规则未退化为排除整个文档"的前置自证。

**凡"集合为空/元素不存在"型断言，均给出负向对照或恒真排除说明**（逐条落在 spec 注释中）：

| 断言 | 为何不恒真（负向对照） |
|---|---|
| BDD-1「chrome 均不可见」 | 同 spec BDD-11 在**非全屏态**断言 `.detail-header` **可见**、内容区 `top > 0`；BDD-12 提供 `none→flex` 三段实测（P3 探针确认） |
| BDD-3「候选集内 0 个满宽横条」 | §上三态实测 0/3/1 |
| BDD-6「公告文本不含 Escape/exit」+「退出词表命中为空」 | 非锁死态下同一作用域的可聚焦元素计数 **24**（P3 实测）、公告文本含 `Escape` → 分母非 0；BDD-12 显式断言非锁死态公告**必须**含 `Escape`（正向对照） |
| BDD-7「浮层关闭」 | P3 实测**普通 zen 态**下同一操作是"浮层关闭 **且 zen 退出**" → 被拦截的是 `zenClass===true`（zen 保持）；若实现写成 document **capture + stopPropagation**，浮层不会关闭 → 立即 FAIL |
| BDD-13「`.not-found` 计数为 0」 | P3 实测**实现前** `/dsh-architecture/f` → `.not-found`=1 + `Page not found`（FAIL）；实现后转 PASS → 随实现翻转 |
| BDD-18「`.not-found` 计数为 0」 | 同一判据在 `/nonexistent-slug-xyz`（单段）上给出 `.not-found`=0 + `.entry-detail`=1（PASS），在 `/nonexistent-slug-xyz/f` 上给出 `.not-found`=1（FAIL）→ 两条路径结论**不同**，非恒真 |
| BDD-19「不渲染该 entry 内容」 | 同 spec BDD-13 在 `/{slug}/f` 上断言 `.entry-detail` **存在** → 两条判据互斥成立；P2 §4 V2 实测 `/{slug}/f/xyz` resolve 到 `not-found` 而 `/{slug}/f` resolve 到 `detail-zen-locked` |
| BDD-14「三类移动端 chrome 不可见」 | 同一用例**先**在非全屏态断言三者均可见（实测 sticky 56px / bottom 64px / meta 89px），再做全屏断言 |
| BDD-17「`.fullscreen-btn` 计数为 0」 | 同 spec BDD-15（需登录组）断言 `.fullscreen-btn` 计数 **1** → 同一选择器在两条 BDD 上结论相反，非恒真 |
| BDD-9「`.content-area.scrollTop` 增加」 | P3 实测点击后 `scrollTop` 0 → **13691**；同时显式断言 `window.scrollY` 恒为 0（若判据误绑 window 则正确实现与失败态都判 0 → 恒真失效，此处已排除该读法） |

### 硬约束 4：BDD-1/2/3 的 E2E 必须钉定非归档、非过期 seed ✅ 已落实

**做法**：spec 内 `SLUG_ARCH = 'dsh-architecture'` 常量 + 文件头 ⚠️ 块 + `test_bdd_3_*` 用例注释**三处**写明理由与禁令：

> BDD-3 的 Given 是 **entry 无关的**（只规定"桌面视口 1280×800，全屏视图已加载完成"，未指定 slug）。若挑到 archived/expired entry（如 `legacy-deploy`），BDD-3 会在一个**与本任务无关的既有条件**（`.archived-banner` 不在 zen 隐藏集 → 1280×49 满宽横条、top=0）上判 FAIL，被误读成"TPV0099 实现错了"。**禁止**用 `legacy-deploy` 或任何 `status: archived` / 已过期 entry 跑 BDD-1/2/3。

**P3 独立复核**（debug :8888 实测，与 P2 §6.5 / §4 V7 结果 C 一致）：

- `dsh-architecture` 匿名 `raw` = **200**（BDD-1/2/3 钉定对象，非归档非过期）
- `legacy-deploy` 匿名 `raw` = **404**（archived + 匿名不可达）；`markdown-test` / `mermaid-charts` 匿名 = **404**（team-scoped）
- BDD-1/2/3/13/16/19 全部只用 `dsh-architecture`（单一常量集中定义，便于后续核验）

---

## 4. 双视口钉定（P2 §6.1 硬约束）✅ 已落实

`playwright.config.ts:20-40` 的两个 project 默认视口是 `devices['Desktop Chrome']` = **1280×720**、`devices['Pixel 5']` = **393×727**，**两个都不是 BDD 要求的档位** → 两个 spec 均**显式** `test.use({ viewport })`：

| spec / describe | 钉定 | 范式先例 |
|---|---|---|
| `tpv0099-fullscreen-link.spec.ts` → `TPV0099 Desktop 1280x800` | `test.use({ viewport: { width: 1280, height: 800 } })` | `tpv0091-unicode-preview-download.spec.ts:66`、`t084-scroll-architecture.spec.ts:68`、`render-regression.spec.ts:67` |
| `tpv0099-fullscreen-link.spec.ts` → `TPV0099 Mobile 390x844` | `test.use({ viewport: { width: 390, height: 844 } })` | `tpv0091...spec.ts:132`、`t084...spec.ts:221`、`render-regression.spec.ts:263` |
| `tpv0099-fullscreen-link-auth.spec.ts` → `TPV0099 Auth 1280x800` | `test.use({ viewport: { width: 1280, height: 800 } })` | 同上 |

**不依赖 project 默认视口**。BDD-1/2/3/4/5/6/7/8/9/10/11/12/13/15/16/17/18/19 落桌面 1280×800；**BDD-14 落移动 390×844**（P1 明确：BDD-1 按桌面判、移动端口径由 BDD-14 单独承担——因 `.meta-tags-bar` 在桌面端本就不渲染，不指明视口该子句会恒真）。

---

## 5. 测试分层与 TDD 红灯形态

### 5.1 红灯所在层

**P3 的 TDD 红灯落在单测层**（`useZenMode.spec.ts`），依据 P2 §6.6 的 `P3_e2e` 不声明说明：
- 本任务的可单测行为 = "锁死态按键不改变状态 + 公告文本不宣称退出方式 + 非锁死态行为不变" → 纯 composable 逻辑，vitest 直接可测
- E2E 层需 `/{slug}/f` 路由已存在才能跑，无法先于实现构成**有信息量**的红灯（会红在"路由不存在"而非"行为不对"）→ E2E 验证职责由 `P5_e2e` / `P5_e2e_auth` 承担

### 5.2 实测红灯（P3 时点，实现未写）

`npx vitest run src/composables/__tests__/useZenMode.spec.ts` →

```
Tests  6 failed | 1 passed (7)
```

| 用例 | 结果 | 失败原因 |
|---|---|---|
| `test_bdd_4_*` | × FAIL | 断言失败：现状 `useZenMode()` 忽略 thunk → `zenMode` 为 `false`（期望 `true`） |
| `test_bdd_5_*` | × FAIL | 断言失败：同上 |
| `test_bdd_6_*` | × FAIL | 断言失败：现状 `zenAriaText` 初始为 `''`（长度 0） |
| `test_bdd_12_*` | ✓ PASS | **预期绿**：该用例断言的正是"既有行为不变"，现状实现本就正确——它是 BDD-6/BDD-4 判据的**正向对照**，不是恒真断言 |
| `test_locked_interface_shape_*` | × FAIL | 断言失败：现状返回对象含 `updateZenAria` |
| `test_locked_default_argument_*` | × FAIL | 断言失败：`() => true` 被忽略 → `zenMode` 为 `false` |
| `test_m9_*` | × FAIL | 断言失败：`m9_2` 期望 `true` 实得 `false`（computed 未引入） |

**红灯归因 = B 类（断言失败），非 A 类**：
- `npx vue-tsc --noEmit` → **exit 0**（零类型错、零语法错 ⇒ 无 A 类风险）
- 失败输出全部为 `AssertionError: ...: expected X to be Y` 形态（vitest 的 `FAIL` + 断言 diff），无 `SyntaxError` / `Cannot find module` / `Failed to load url`
- `P3_formatter: vitest.sh` 将解析出 `{"failed":6,"passed":1,"errors":0,"syntax_errors":[],"import_errors":[]}` → `check-tdd-red.py` 走 `failed > 0` 分支 → **exit 0（classic red-light）**

**类型纪律**（见 §3 硬约束 2 末段）：spec 不使用 `@ts-expect-error`（否则 P4 实现后变 TS2578 打红 P5 typecheck），改用对旧/新签名均可编译的 `zenApi()` 包装——实测 typecheck exit 0，P3→P5 无类型翻转。

### 5.4 ⚠️ `check-tdd-red.py` 的红灯判定需任务级 formatter（P3 实测的 gate 基础设施缺陷）

**现象**：直接跑 `check-tdd-red.py $TASK_DIR` 曾得到 **exit 1（A 类假红灯）**，而测试实际是纯断言失败：

```
TDD_CHECK: A-class error (command string itself has syntax error, runner never started)
CHECK_TDD_RED_EXIT=1
```

**根因链（P3 逐步实测定位，**与本任务测试代码无关、系预存缺陷**）**：

1. `make test-frontend` 的全量输出约 **1.5 MB**（主体是**既有** spec 的 `[Vue warn]` / `at <VTUROOT>` 组件树噪声，非本任务引入）
2. agate 内置 `assets/formatters/vitest.sh:6-8` 做 `OUTPUT="$(cat)"` 后 `export OUTPUT`，把整份输出作为**环境变量**传给 `python3` → 超过 `execve` 上限（`MAX_ARG_STRLEN = 131072`）→ `bash: /usr/bin/python3: 参数列表过长`（formatter **exit 126**）
3. `agate_common.run_test_with_formatter` 见 formatter 非 0 → 回退 `_fallback_json(raw_output=<全量输出>)`
4. `judge_result` 命中 `exit_code == 2 and raw_output 含 /syntax error|unexpected|matching|…/` 分支——**`matching` 来自既有 spec 的 `No diagram type detected matching given configuration`**（15 处命中）→ 判为 **A 类错误**

**预存性证明（关键：不是本任务引入）**：

| 输入 | 字节数 | 内置 formatter 结果 |
|---|---|---|
| **剔除恶本任务新 spec 后的基线输出**（`npx vitest run --exclude '**/useZenMode.spec.ts'`，1343 passed / 4 skipped） | **1,509,387** | **同样 exit 126 → 同样误判** |
| 含本任务 spec 的全量输出（1344 passed / 6 failed） | 1,516,131 | exit 126 → 误判 |

→ 基线（**零本任务文件**）已触发完全相同的误判 ⇒ **预存 gate 基础设施缺陷**。

**处置（P3 已落地，走 agate 官方扩展点）**：在 **`agate-workspace/tasks/TPV0099-fullscreen-link/.agate/formatters/vitest.sh`** 放一份**判定语义与内置版逐字等价**、仅把输出改经**临时文件**交给 `python3`（绕开参数/环境长度限制）的 formatter。该路径正是 `agate_common.resolve_formatter` 的第一优先级（`$task_dir/.agate/formatters/` > `$agate_root/assets/formatters/`），故**不需要修改 agate 本体**。

**修复后实测**：

```
$ python3 {agate_root}/scripts/check-tdd-red.py agate-workspace/tasks/TPV0099-fullscreen-link
TDD_CHECK: classic red-light (assertion failures only)
exit 0                    ← 真红灯（B 类，断言失败）
```

formatter 解析结果：`{"exit_code":2,"total":6,"passed":0,"failed":6,"errors":0,"failed_tests":[],"import_errors":[],"syntax_errors":[]}` → `failed > 0` → exit 0。

**⚠️ 对 P5 / P6 的传递影响（重要）**：

- `P3` 键为 `make test-frontend`——**同一命令**也被 `P5` / `P6` 键沿用。若主 Agent 后续把 `P3_formatter` 去掉或改回内置 `vitest.sh`，同样的误判可能重现（表现为"gate 报 A 类错误"而非"pytest 失败"）。**保留任务级 formatter 即可持续规避。**
- **另需注意**：`make debug-test` 的 Check 6 静态产物新鲜度检查用 `find frontend-v3/src -newer backend/peekview/static/index.html`——**只要 P4 在 `frontend-v3/src/` 下改动任一文件（含新增测试文件），`make debug-test` 会以 `✗ FATAL: frontend 源码比 static 产物新` 拒绝运行**。P3 已踩此坑（新增单测文件即触发），解法是 `make build-frontend-fast`（实测 14.7s / 388 static files）。**P5/P6 跑 `P5_e2e*` / `P6_e2e*` 前须先重建 static。**

### 5.3 E2E 层的红灯形态说明

E2E spec 在 P3（路由未实现）时同样为红，但**刻意设计为断言失败而非超时**：`openFullscreen()` **不硬等 `.entry-detail`**（那会以 `waitForSelector` timeout 收场、归因含混），而是等 `#app` 挂载 + 任一终态标记后，用 `expect(locator(CONTENT_AREA)).toHaveCount(1)` **断言**内容区存在。故 P3 时每个 E2E 用例的首个失败是"Given 不成立"的**断言失败**。

**实跑结果（P3，逐条已核失败原因）**：

| 用例 | P3 现状 | 失败原因（P4 后应转 PASS） |
|---|---|---|
| BDD-1/2/3/4/5/6/16 | FAIL | `给定「全屏视图已加载完成」不成立：内容区不存在`——`/{slug}/f` 落 catch-all NotFoundView（路由未实现） |
| BDD-7/8/14/17 | FAIL | 同上（Given 不成立） |
| BDD-13 | FAIL | `.not-found` 计数 = 1（**判据随实现翻转**，非 Given 问题） |
| BDD-18 | FAIL | `.not-found` 计数 = 1（现状落路由级 NotFoundView） |
| **BDD-11** | **PASS（预期绿）** | 回归项——`/{slug}` 现状行为本就正确，是"实现后仍须绿"的基线守卫 |
| **BDD-12** | **PASS（预期绿）** | 同上（既有 f 键 zen 现状正确） |
| **BDD-19** | **PASS（预期绿）** | 现状（catch-all）与实现后（段数严格）**均**满足 Then——本条拦的是"实现把 `/:slug/f` 写成前缀/通配匹配"的回归，故现状绿属正常 |
| BDD-9/10/15（auth spec） | FAIL | BDD-9/15：Given 不成立（路由未实现）；BDD-10：同上（含三态区分力断言未达） |

→ **16 条中 13 条为真红灯、3 条为有意保留的回归基线（BDD-11/12/19）**。TDD 红灯由**单测层**承担（§5.2 的 6 failed），E2E 层是回归确认（P2 §6.6 已声明不设 `P3_e2e`）。

---

## 6. 环境与纪律

| 项 | 状态 |
|---|---|
| debug backend `:8888` `/health` | **200**（开工前探测，本任务第 4 次探活首探即活） |
| Chrome CDP `:18800` | 在线（P3 探针全部经 `connectOverCDP`） |
| 生产 `:8080` / `~/.peekview/` | **未触碰** → `[PROD_NOT_TOUCHED]` |
| `uvicorn` 直接启动 / `make debug` / `npm run dev` | **未执行**（vite :5173 会代理到生产） |
| 临时探针位置 | 全部落 `.agate-tmp/`（`p3-probe-*.cjs` / `p3-bdd3-traversal.cjs` / `p3-flip-discrimination.cjs` / `alice-token-0099.txt`），**零个**落在 `frontend-v3/` 下（防 `vitest.config.ts` 未设 `include` 而把探针 `*.spec.ts` 收进收集面、抬高基线） |
| 命令超时 | 全部 `timeout 180s`（E2E 900s） |
| 探针脚本纪律 | `connectOverCDP` + `try/finally { page.close() }` + `process.exit(0)`，**未** `browser.close()` |
| 前端基线（实测） | 全量 `make test-frontend` = **111 files / 1344 passed \| 4 skipped (1354)**，其中 **6 failed 全部来自本任务新增的 `useZenMode.spec.ts`**（基线 110 files / 1343 passed \| 4 skipped，逐字吻合派发指引给定基线）→ **无附带回归** |
| E2E 实跑（P3 红灯确认） | 匿名 spec：chromium **13 failed / 3 passed**（绿者为 BDD-11/12/19——后两条现状本就满足，见 §5.3 说明）；含 Mobile Chrome project 时 26 failed / 6 passed。auth spec：**6 failed / 0 passed**（两 project × 3 用例）。**全部失败均为断言失败**（`expect(...).toHaveCount` / `toEqual` / `toBe` 的断言 diff），无 timeout-归因、无语法/import 错 |
| 创建型测试清理 | BDD-10 自建 entry 走 **alice 登录创建 → 登录建 share → 登录删除**；`afterEach` 清理队列存 `{slug, share_id}` 二元组；清理判据落在**结果**上（删除后 alice 复查 `raw` = **404**）；不因任何非 2xx 中止删除 |
| 子派发 | 未启用 |

**P3 探针实测并已清理的临时数据**：`.agate-tmp/` 内一次 BDD-10 机制验证曾创建 `e2e-tpv0099-probe-<ts>`（私有 + share），**已同轮 alice 删除并复查 `raw`=404**，无残留。

---

## 7. 覆盖边界与已知取舍

1. **BDD-16 的截图**：落 `test-results/tpv0099-bdd16-desktop_1280x800.png`（该目录已 gitignore），供 P6 视觉验收消费。P1 明确 BDD-16 **不得**只用 fixture 或单测断言替代——本 spec 用真实 seed + 真实浏览器 + 截图。
2. **BDD-9 / BDD-15 的 `firstFileId` 动态解析**：`resolveFileId()` 现场从 `raw` 响应解析，**未硬编码** `43`（P2 §8 硬约束：该序号随 DB 重建失效）。
3. **BDD-15 不要求 Escape 关闭弹层**：P1 rev1 必修 5 明确——当前实现无该能力，且 `t022` 的 Escape 断言所依赖选择器（`.mermaid-action-btn` / `.diagram-modal-overlay`）在 TPV0096 已判定为死选择器。本用例只用既有关闭路径（`.diagram-modal .close-btn`）。
4. **BDD-17 显式断言 `.fullscreen-btn` 计数为 0**：P3 实测 `svg-icons` 走 `ImageViewer` 路径，不渲染图表工具栏全屏按钮（该能力属 BDD-15 的图表渲染组件路径）→ 该断言同时充当 BDD-15 的互斥对照。
5. **BDD-7 的浮层触发路径**：`TableView` 的 `.per-page-trigger` 是 `@click` 开浮层、元素级 `@keydown` 消费 Escape。P3 实测点击后需**把焦点移入浮层内元素**（`[role="option"]`）再按 Escape，否则 Escape 落在 `body` 上不触发元素级分支——此细节已写进用例（否则会误红）。
6. **不修改既有 E2E spec**：`viewer.spec.ts` 当前 **18 failed / 20 passed** 属预存红灯（TPV0095 引入的 seed 语义回归，归属 TPV0097/TPV0098「用例可信治理」，**不归 DEBT0012**）→ 不进本任务 gate、不在本次修复；本任务 E2E 键全部指向新建 spec。
7. **本任务不改 `frontend-v3/src/styles/layout.css`**（N4 零 CSS 改动）→ 无 CSS 相关测试面。
