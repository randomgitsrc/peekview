---
phase: P1
task_id: TPV0102
type: review
parent: P1-requirements.md
trace_id: TPV0102-P1-review-20261110
status: approved
created: 2026-11-10
agent: requirements-review
reviewed_bdds:
- '01'
- '02'
- '03'
- '04'
- '05'
- '06'
- '07'
- '08'
- '09'
- '10'
- '11'
- '12'
- '13'
- '14'
- '15'
- '16'
- '17'
- '18'
- '19'
- '20'
- '21'
- '22'
- '23'
- '24'
- '25'
- '26'
- '27'
- '28'
- '29'
- '30'
---

# P1 评审（复审轮 / 第 2 轮）— TPV0102 Explore 列表体验修正

> 结论：**approved**。上轮 3 BLOCKER + 1 MINOR + 1 WARNING **全部真解决**（逐条独立实测复核，
> 不采信 analyst 自述）；上轮已确认通过的 7 类项**未被破坏**；30 条 BDD 格式与计数同步**全绿**。
> 另记录 2 条 INFO 级观察（不阻塞，供 P2 知悉）。

**复审基准**：上轮本文件（status: needs-revision，3 BLOCKER + 1 MINOR + 1 WARNING）。
**核对对象**：`P1-requirements.md`（618 行 / 57033 字节，较上轮 562 行 / 26 条 BDD 增长）。
**基线**：HEAD `8ab8f58b`；`git diff --cached` 为空（P1 无代码改动，符合预期）；工作树仅
`M orchestrator-log.md` + 8 个 untracked `.md`（含被评审文件与我自己的产出）。本任务不新增/改名
`agate/scripts/` 下任何文件 → 「新增脚本登记面」实测要求不触发。

---

## 一、3 个 BLOCKER 逐条判定（已解决 / 未解决 + 证据）

### M1 — BDD-02 Then ③ 的 IANA 时区名判据 → ✅ **已解决**

| 核验点 | 独立实测证据 | 判定 |
|---|---|---|
| ① 新判据在 `UTC` 与 `Asia/Shanghai` 两种环境下**都**可二值判定 | 自己跑 node（v24.22.1）：`TZ=UTC` → `Intl.DateTimeFormat().resolvedOptions().timeZone` = `"UTC"`；`TZ=Asia/Shanghai` → `"Asia/Shanghai"`。BDD-02 Then ③ 现为「等于该浏览器运行时 `resolvedOptions().timeZone` 的返回值」，并显式加注「在 UTC 时区下该值为 `UTC`，同样成立」→ 两环境均得确定答案，无中间态 | ✅ 通过 |
| ② 是否**没有**为过测试而放宽「tooltip 必须含浏览器实际时区名」的语义 | 判据从「形态匹配 `Area/City`」改为「**值相等**于运行时解析值」——这是**收紧**（原来 `Asia/Shanghai` 形态的任意串都能过，现在必须精确等于实际时区名），不是放宽。BDD-02 的 Given 同时补了 `locale` 前提，未删除 ①②③ 任一项 | ✅ 通过（语义未削弱，反而更精确） |
| ③ Given 补的 locale 前提是否引入新的不可满足条件 | Given 现为「浏览器 locale 为 `en-US`（Playwright 默认值，本 BDD 不限定时区）」。实测 Playwright 默认 locale 确为 `en-US`（`frontend-v3/node_modules/playwright-core/lib/coreBundle.js:47579` → `locale: "en-US"`），且 `frontend-v3/playwright.config.ts` 的 `use` 块未设 `locale` → **该前提是环境既有事实，无需额外配置即可满足**，不引入新约束。同时 BDD-02 的 Then ①②③ 均为 locale 无关断言（相对时间形态、`GMT+HH:MM` 完整偏移、时区名值相等）→ 固定 `en-US` 也不会与判据冲突 | ✅ 通过 |

> 补充实测：BDD-02 的 Then ② 要求「含 `GMT+HH:MM` 或 `GMT-HH:MM` 完整偏移」。实测 `longOffset`
> 在 `en-US` / `zh-CN` / `ja-JP` / `de-DE` / `hi-IN` / `ru-RU` 下均产 `GMT±HH:MM`（如
> `11/10/2026, 05:43:00 PM GMT+08:00`）→ 与 P0-brief:109 的 tooltip 用 `longOffset` 决策一致，
> 判据可满足。

### M2 — BDD-04 的 `17:43:00` 字面量随 locale 变 → ✅ **已解决**

| 核验点 | 独立实测证据 | 判定 |
|---|---|---|
| ① BDD-04 固定 locale 后判据可二值判定 | 自己跑 node（`TZ=Asia/Shanghai`，`shortOffset`，`2026-11-10T09:43:00Z`）：`zh-CN` → `2026/11/10 GMT+8 17:43:00`（含 `17:43:00`、含 `GMT+8`、不含 `09:43:00`，三项断言全部可满足）。BDD-04 的 Given 现显式写「浏览器时区固定为 `Asia/Shanghai`，浏览器 locale 固定为 `zh-CN`」 | ✅ 通过 |
| ② §8 的 `locale-controlled-execution` 条目 status 三态合法 + 补充方式可执行 | 该条目 `status: available`（合法三态之一）；`available` 列表给出两条**可执行**方式：「Playwright context 的 `locale` 选项（每个 test 显式 `test.use({ locale: 'zh-CN' })`；仓库已有 `test.use({ viewport })` 同款先例）」+「配置文件 `use.locale` 全局固定（会影响既有 42 个 spec，不推荐）」。实测 `test.use({ viewport: ... })` 先例确实存在（`e2e/structured-data-viewer.spec.ts:103,473,566,599`、`e2e/unicode-filename-link.spec.ts:25,103` 等）→ **同款写法可复制，不需新增能力**。yaml 解析通过（4 个条目全部 `available`，无 GAP） | ✅ 通过 |
| ③ I-24 是否真消除 I-11 与 BDD-04 的矛盾（而非把矛盾写成两句并存） | I-24（§2.2 第 99 行）显式做**层次切分**：「**需求侧**：显示仍跟随浏览器 locale，不引入服务端 locale 配置、不强制某种格式……**验收侧**：凡断言墙上时间字面量的 BDD 必须在 Given 显式固定 locale……**两者不矛盾——前者是产品语义，后者是判定手段**」。这是把「产品行为约束」与「验收判定手段」拆成两个不同层面，属**真消解**而非并存。§1 第 1 条也同步加了「locale 仍跟随浏览器（不强制某种格式），但断言墙上时间字面量的验收须固定 locale（见 I-24）」→ 两处口径一致 | ✅ 通过 |
| ④ 是否**未改 I-11 原文**（避免动已通过项） | I-11（第 94 行）原文实测：「时区标识不能用 `short`，且不可字符串拼接」——只讲 `short`/`shortOffset` 与禁拼接，**本就不含 locale 语义**。上轮评审把它误当为「`undefined` 跟随浏览器 locale → 接受」的载体；实测该语义实际位于 §1 第 1 条与 §8。analyst 未改 I-11 而用 I-24 统一裁决是**正确的处置**（改动面最小、不动已通过项） | ✅ 通过（且上轮我的定位有偏差，此处更正） |
| ⑤ BDD-01/03（`GMT±N` + 4 位年份形态）是否仍不受 locale 影响 | 自己跑 10 个 locale × 3 个 TZ 的扫描：`en-US` / `zh-CN` / `ja-JP` / `de-DE` / `hi-IN` / `ru-RU` / `th-TH` 下 `GMT±N` + 4 位年份**均成立**（含项目 E2E 默认 `en-US` 与 CI 默认 `UTC`）→ 上轮结论**仍成立** | ✅ 通过（另见第五节 INFO-2） |

> **关于 analyst 否决「`new Date(本地化文本)` 反解」替代方案**：我独立复核了这条，结论**支持 analyst**。
> 实测（`Asia/Shanghai` + `shortOffset`）：`zh-CN` / `en-US` 反解正确，但 `ja-JP`
> （`2026/11/10 17時43分00秒 GMT+8`）→ **`NaN`**，`de-DE`（`10.11.2026, 17:43:00 GMT+8`）→
> **`2026-10-11T09:43:00.000Z`（错月份）**。用不可靠解析作判据会引入假 PASS，否决正确。
> 这也说明「固定 locale + 字面量」方案（方案②）在可靠性上优于方案①，analyst 的选择有实测支撑。

### M3 — 5 个可见性转换中 3 个无 BDD → ✅ **已解决**

| 核验点 | 独立实测证据 | 判定 |
|---|---|---|
| ① 三条新 BDD 的 Then 是否**真的**断言 `is_public` 与 `team` 两字段 | 逐条读原文（§3.7，第 285–298 行）：BDD-27 Then「该 entry 的可见性状态变为 `is_public=false` 且 `team` 为 Team A（两字段均须断言）」；BDD-28 Then「`is_public=false` 且 `team` 为 Team B（`team` 不再是 Team A），且未出现确认对话框」；BDD-29 Then「`is_public=false` 且 `team` 为空（两字段均须断言），且未出现确认对话框」→ **三条均落在状态两字段上**，不是「菜单关了」/「toast 出现」这类间接信号 | ✅ 通过 |
| ② 是否与 P0-brief:159-163 后端语义逐条对齐 | 读 P0-brief 第 159–163 行原文：`Private → Team A` = `PATCH { team_id: "A" }`「后端强制 `is_public=false`」→ BDD-27 断言 `is_public=false` + `team=A` **吻合**；`Team A → Team B` = `PATCH { team_id: "B" }`「直接改归属，无清理动作」→ BDD-28 断言 `team=B`（不再 A）+ `is_public=false` + 无确认框 **吻合**；`Team A → Private` = `PATCH { team_id: null }`「**只清团队，不改 is_public**（保持 private）」→ BDD-29 断言 `team` 空 + **停在 `is_public=false`** **吻合**（P1 另加注引用 `entry_service.py:809-818` 作为依据，归因正确）。`Team A → Public` 的「必须两字段同传」由 BDD-19 承接（`is_public=true` + `team` 空）**吻合** | ✅ 通过（5/5 对齐） |
| ③ 5 个转换是否全覆盖且无重复断言/矛盾 | 覆盖矩阵：Public→Private = BDD-20；Private→Team A = BDD-27；Team A→Team B = BDD-28；Team A→Private = BDD-29；Team A→Public = BDD-19 → **5/5 全覆盖，无遗漏**。交叉核对矛盾：BDD-18 只断言**子菜单构造**（不含 A、含 B、入口不直接切换），BDD-16 只断言**菜单项构造**（不含当前态项），BDD-27/28/29 断言**转换结果** → 三者层次分明（构造 / 结果），**无重复断言、无 Then 矛盾**。BDD-19（升 Public 需确认）与 BDD-20/27/28/29（降级/平移不需确认）方向对立但 Given 状态互斥（`Team A` vs `Public` vs `Private`）→ 不矛盾 | ✅ 通过 |
| ④ BDD-29 与 BDD-20 是否重复 | BDD-20 Given = 「当前为 **Public**」→ 选 Private；BDD-29 Given = 「当前归属 **Team A**」→ 选 Private。起始状态不同、断言字段不同（BDD-20 只断 `is_public`，BDD-29 断两字段含 `team` 清空）→ **不是重复**，是同一动作在两个起始态下的不同后端路径（`is_public:false` vs `team_id:null`），必须分别验收 | ✅ 通过 |

---

## 二、1 MINOR + 1 WARNING 逐条判定

### m1（MINOR）BDD-07 硬编码 15 模型清单 vs §6.10「机械遍历」 → ✅ **已解决**

| 核验点 | 独立实测证据 | 判定 |
|---|---|---|
| ① 新遍历条件是否与 §6.10 的拦截声明一致（不再自相矛盾） | BDD-07 When 现为「遍历 `backend/peekview/models.py` 中**所有非 `table=True` 且不被任何 `table=True` 模型继承的类**（不硬编码模型名单）」，§6.10 首行为「遍历 `models` 模块，断言『每个非 table 类中的每个 datetime 字段』在 JSON 输出中带 `Z`（机械清单式，新模型自动纳入，不靠人工维护清单）」→ **矛盾已消除**：BDD-07 不再点名任何模型，15 模型清单降为 Then 后的「当前基线清单（附录，非判据主体；随模型增删由遍历自动更新）」 | ✅ 通过（残留措辞见 INFO-1） |
| ② 「不被任何 `table=True` 模型继承」排除条件是否**必要且充分**（自己 AST 验一遍） | 我自己写 AST 脚本（`.agate-tmp/ast_check_models.py`，仓外可丢弃）遍历 `backend/peekview/models.py`：`table=True` 模型 **11 个**（`User`/`Team`/`TeamMember`/`ApiKey`/`Entry`/`EntryShare`/`EntryRead`/`EntryStar`/`EntryTombstone`/`EntryReadStats`/`File`）；「非 table 且含 datetime」**17 个类**；被 table 模型继承者 = **`EntryBase`(3 字段) / `FileBase`(0 datetime 字段) / `UserBase`(1 字段)**。因 `FileBase` 无 datetime 字段，不落在 17 个之内 → **17 − `EntryBase` − `UserBase` = 15 类 / 31 字段**，与 P1 §6.9 附录逐项吻合（我另跑合计校验：15 行字段数 1+2+1+1+1+3+4+4+1+2+2+3+2+1+3 = **31**）。**必要性**：缺该排除条件会误抓 `EntryBase`/`UserBase`（I-2 明令严禁在此加 serializer，会污染表模型）；**充分性**：加上后精确命中 15 类、无遗漏无多抓 → 条件**必要且充分** | ✅ 通过（analyst 声称的 17−2=15 经我独立 AST 复现，数值与类名集合完全一致） |
| ③ 附录清单与 §6.9 是否逐项吻合 | 附录 15 个模型名 + 字段数与 §6.9 表逐项比对：`ReadStatsResponse`(1) / `ReadEventResponse`(2) / `CountdownInfo`(1) / `StarResponse`(1) / `TombstoneResponse`(1) / `StarItem`(3) / `EntryResponse`(4) / `EntryListItem`(4) / `EntryRawResponse`(1) / `CreateEntryResponse`(2) / `UserResponse`(2) / `ApiKeyResponse`(3) / `ApiKeyCreateResponse`(2) / `EntryStats`(1) / `ShareResponse`(3) → **15/15 名称与字段数全对**。附录另注明「`ShareCreateResponse` 继承 `ShareResponse`，经继承即得覆盖」——实测 `models.py:1196` `class ShareCreateResponse(ShareResponse)` 成立，且它自身只加 `share_url: str` 无 datetime → 该说明正确 | ✅ 通过 |

### W2（WARNING）新增复合菜单控件零 a11y 覆盖 → ✅ **已解决**

| 核验点 | 独立实测证据 | 判定 |
|---|---|---|
| ① BDD-30 是否可二值判定、是否**没绑** `aria-expanded` 之类属性名 | BDD-30 Then =「菜单关闭（菜单项不再可见），且当前焦点回到打开该菜单的触发入口元素」→ 两个用户可观测结果，均可二值判定（菜单项可见性 / `document.activeElement` 是否等于触发入口），无中间态。G/W/T 行 grep `aria-` / `role=` / `class=` / `data-testid` / `.vue` / `v-if` = **0 命中**（`aria-`/`.vue` 仅出现在 BDD-30 的说明性注释块中作为先例引用，非判据行）→ **未绑属性名** | ✅ 通过 |
| ② §9 的显式声明是否足够（「不代填 roadmap 编号」算不算达标） | §9（第 603 行）现为**双向声明**：**纳入**范围 = 键盘可达性（验收条件 BDD-30，按 `OverflowMenu.vue:140-155` 惯例）；**不纳入** = 完整 ARIA 菜单角色树（`role="menu"`/`menuitem`、方向键、`aria-haspopup`/`aria-controls`），「留作独立任务，**待登记 roadmap**（当前 `docs/roadmap/improvement-backlog.md` 最大编号为 #58，本 P1 阶段不代填编号，由 P2/P8 按当时编号追加）」，并给出**不做理由**（属独立 a11y 专项、需读屏实测、与本任务四项缺陷不同源）。我实测 `docs/roadmap/improvement-backlog.md` 最大编号确为 **#58**（`grep` 得 56/57/58，58 为最大）→ 声明中的编号引用**准确**。**判定：达标**——上轮我要求的是「补 BDD **或** 显式声明不做并登记 roadmap」，此处**两条都做了**（BDD-30 覆盖最低门槛 + 剩余部分显式声明 + 编号登记延后到 P2/P8 有明确责任人与触发点）。「不代填编号」不构成沉默跳过：声明点名了文件、当前最大编号、后续登记责任阶段，比凭空占号更可靠（P1 占号会在 P2-P8 期间与其它任务撞号） | ✅ 通过 |
| ③ `OverflowMenu.vue:140-155` 的既有惯例是否真的存在（自己读） | 逐行读源码：`handleKeydown` 在 **139-145** 行（`if (e.key === 'Escape' && isOpen.value) { close() }`），`close()` 在 **123-126** 行（`isOpen.value = false; triggerRef.value?.focus()`），`onMounted` 绑定在 **148-151** 行，`onUnmounted` 解绑 **153-156** 行。P1 引用区间 `140-155` 覆盖了 `Escape` 分支 + `close()` 调用点 + 监听器注册/解绑，**核心惯例（Escape → close() → triggerRef.focus()）确实存在** | ✅ 通过（引用区间略窄，`close()` 定义在 123-126 不在 140-155 内——属引用精度问题，不影响惯例成立的判定，见 INFO-3） |

---

## 三、上轮已确认通过项是否被破坏（逐条复查，复审核心）

**结论：全部未被破坏。** 逐项独立复核（不采信 analyst 的「未丢失」自述）：

| # | 上轮通过项 | 本轮独立复核结果 | 判定 |
|---|---|---|---|
| 1 | 15 个叶响应模型行号（514/523/716/724/734/754/791/817/854/913/1026/1083/1094/1108/1185） | 我 AST 脚本输出的行号与 §6.9 表**逐个吻合**（514/523/716/724/734/754/791/817/854/913/1026/1083/1094/1108/1185） | ✅ 未破坏 |
| 2 | 31 个 datetime 字段计数 | AST 独立统计 = **31**；§6.9 表合计列求和 = **31**；BDD-07 附录 = **31** → 三处一致 | ✅ 未破坏 |
| 3 | 全部组件/store 行号引用 | 逐行读源码核对：`EntryCard.vue:43` = `<span class="meta-time" :title="fullTime">{{ relativeTime }}</span>` ✅；`EntryCard.vue:44-47` = `<template v-if="entry.fileCount">` … `</template>` ✅；`EntryListRow.vue:19`/`20-23` 同形态 ✅；`EntryDetailHeader.vue:62` = `<span :title="fullTime">{{ relativeTime }}</span>` ✅、`66-73` = 只读 `status-tag` 三态块（`team` / `isPublic ? 'Public' : 'Private'`）✅；`EntryMetaTagsBar.vue:4` = `<span class="meta-dot"></span><span>{{ relativeTime }}</span>` ✅、`6-13` = 只读 `status-tag` ✅；`EntryDetailContent.vue:59-61` = `<div v-else class="empty-state">` ✅；`entryList.ts:45` = `async function toggleVisibility(entry: Entry)` ✅；`entryDetail.ts:101` = `function syncVisibility(slug: string, isPublic: boolean)` ✅；`team.ts:13` = `const allTeams = computed<Team[]>(...)` ✅ | ✅ 未破坏（9/9 全对） |
| 4 | seed 事实（image-gallery 0 文件不入库、三团队归属、BDD-26 的 8/4/1 文件数） | 实测 `scripts/seed-data/image-gallery/` 仅 `meta.json`（151 字节，0 内容文件）→ `seed-debug.py:183-185` `if not files: print("SKIP ... no content files"); continue` ✅；含 `team_id` 的 seed 恰 3 个：`csv-employees`=`backend-solo`(owner carol)、`markdown-test`=`frontend-team`(owner alice)、`mermaid-charts`=`frontend-team`(owner alice) ✅；文件数实测 `unicode-filenames`=8、`multi-format-demo`=4、`yaml-docker-compose`=1 ✅ | ✅ 未破坏 |
| 5 | 第 7 节 3 处 `[P0_STALE]` 的归因表述（上轮已确认正确） | `grep -c "[P0_STALE:"` = **3**，三条原文未改动：①image-gallery 归因「主 Agent 在 P1 dispatch-context 的 objective_info」②backend-solo 归因同上 ③cli.py 行号漂移归因「**P0-brief 自身**的配套改动清单第 2 行」。独立复验归因：`grep -c "image-gallery\|backend-solo\|objective_info" P0-brief.md` = **0** ✅；`P0-brief.md:191` 实测 = `` | 2 | **CLI 输出统一 helper** | `cli.py:378/443/561`… `` ✅ | ✅ 未破坏（3/3 原文与归因均正确） |
| 6 | 同类扫描 10 小节 | `### 6.1`…`### 6.10` 十个小节齐在，标题与上轮一致（含 §6.3「已确认只此一处**不成立**」、§6.6 行号漂移记录） | ✅ 未破坏 |
| 7 | 裁剪声明（phases 全 8 个、medium、standard、verification_env） | frontmatter 实测：`risk_level: medium`、`ceremony: standard`、`phases: [P1..P8]` 全 8 个、`pruned` 未声明（与「无跳过」一致，`phases ∪ pruned == phase_universe` 恒检成立）、`packages: [peekview, frontend-v3, docs]`、`domains: [backend, frontend, api, cli]`；`verification_env` + `verification_env_budget` 占位行仍在（第 584-589 行）；`ui_render_shape: layout` + `ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]` 仍在 | ✅ 未破坏 |
| 8 | P1 纯净性（不掺解决方案设计） | BDD 段落 G/W/T 行 grep 实现绑定（`class=`/`data-testid`/`.vue`/`v-if`/`className`/`aria-`/`role=`/`getByTestId`）= **0 命中**；§1 只定义问题 + 语义澄清（三态模型属需求语义）；新增的 I-24 是**判定手段说明**而非设计方案；BDD-02/04/07/27-29/30 的「修订说明」块均为**判据依据论证**（引用实测数据），非实现步骤 | ✅ 未破坏（新增内容未越界） |

**附加复查**（上轮实测过的行号，本轮抽查）：`cli.py` `.isoformat()` 7 处 → 实测 **378/443/444/564/571/2287/2318** ✅ 与 §6.6 一致；`admin_service.py` 3 处 → 实测 **643/644/645** ✅；`backend/peekview/client.py:89` = `return datetime.fromisoformat(v) if v else None` ✅ 裸调用仍在（破坏性变更前提未失效）；MCP `createEntry.ts:121` / `publishFiles.ts:551` = `new Date(entry.expires_at)` ✅ 两处均吻合；`frontend-v3/e2e/*.spec.ts` = **42** 个 ✅；TPV0095 被取代断言：`tpv0095-entry-card-team.spec.ts:79` 与 `tpv0095-entry-list-row-team.spec.ts:76` 均实测断言 `findAll('[data-testid="visibility-toggle"]')` `toHaveLength(0)` ✅，E2E `team-visibility.spec.ts:136-153` BDD-40 吻合 ✅。

---

## 四、30 条 BDD 全量格式与计数同步

### 4.1 编号与结构机械检查（全绿）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 编号 `#### BDD-NN:` 两位零填充、`01`–`30` 连续且顺序正确 | ✅ | `grep "^#### BDD-"` 得 **30** 条，编号序列 `01 02 03 … 29 30` **连续、单调递增、无跳号无乱序**（与主 Agent 实测一致，我独立复核） |
| 每条只有一条 Given-When-Then | ✅ | awk 逐条统计：**30/30 每条 G=1 W=1 T=1**，无多场景混装 |
| 无主观形容词 | ✅ | BDD 段落（L125–315）grep `美观\|流畅\|平滑\|自然\|响应灵敏\|清晰\|可读\|友好\|优雅\|合理\|适当\|良好\|优秀` = **0 命中** |
| 无实现绑定反模式 | ✅ | G/W/T 行 grep `class=\|data-testid\|\.vue\|v-if\|className\|aria-\|role=\|getByTestId` = **0 命中** |
| BDD 编号引用一致性 | ✅ | 引用集合 − 定义集合 = `{40}`，其中 `BDD-40` 是 **TPV0095 外部引用**（`team-visibility.spec.ts:137` 的 BDD-40，见 I-23），属预期，非本文件漏定义 |
| UX 类别后缀 | ✅ | 30/30 标题均带类别前缀（`布局结构` × 7：01/04/07/08/09/12 + …；`交互行为` × 17；`视觉呈现` × 6），落在分类框架内，无扩展维度未声明的情形 |
| frontmatter 合法性 | ✅ | `check-frontmatter.py P1-requirements.md` → **exit 0**（我独立跑） |

### 4.2 计数同步 5 处逐处核对

| # | 同步点 | 实测 | 判定 |
|---|---|---|---|
| 1 | §3 开头「共 **30 条**（BDD-01 ~ BDD-30，编号连续）」 | 第 **127** 行原文吻合 | ✅ |
| 2 | §5 裁剪说明 P1 / P6 两行的 BDD 条数 | 第 **341** 行「含 30 条 BDD + 权限边界 + 同类扫描，须评审」；第 **346** 行「30 条 BDD 逐条实跑 + UI 截图 + before/after 倒计时对比」 | ✅ |
| 3 | §6.10 回归拦截映射表含新 BDD 编号 | 表中现有 8 行，其中「可见性转换结果」行 → `BDD-19/20/27/28/29`、「菜单键盘可达性」行 → `BDD-30` → 新编号**已入表** | ✅ |
| 4 | 顶部提示块 UX 类别后缀清单 | 第 **41** 行 = `BDD-01/02/03/13/16/19/25/27/28/29/30`，含 27/28/29/30 | ✅ |
| 5 | 残留「26 条」表述 | `grep "26 条\|26条\|共 26"` = **0 命中**；其余含 `26` 的行（§6.9 行号列、`useRelativeTime.ts:24-26`、模型名列表）均与 BDD 计数无关 | ✅ |

### 4.3 新增 BDD 的逐条判定（01–30 全量）

> 维度口径：数据 / 前端 / 多端 / 边界 / 兼容。`✓`=覆盖，`-`=不涉及。

| BDD | 判定 | 覆盖维度 | 本轮变化 |
|---|---|---|---|
| **BDD-01** 卡片与列表时间主显绝对时间含 `GMT±N` | ✅ 可二值判定（形态匹配 + 负向排除 `ago`） | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-02** 悬停同显相对+绝对+IANA 名 | ✅ 可二值判定（M1 已解决） | 数据- 前端✓ 多端- 边界✓ 兼容- | Then③ 改「值相等」+ Given 补 locale |
| **BDD-03** 三处（列表/详情桌面/移动条）一致 | ✅ 可二值判定 | 数据- 前端✓ 多端- 边界- 兼容✓ | 未变 |
| **BDD-04** Asia/Shanghai + locale zh-CN 下 +8 小时 | ✅ 可二值判定（M2 已解决） | 数据✓ 前端✓ 多端- 边界✓ 兼容- | Given 固定 locale |
| **BDD-05** 无效时间不产生 `NaN` | ✅ 纯负向断言 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-06** 未来时间方向正确 | ✅ 负向断言（非 `just now`、非 `NaN`） | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-07** 叶响应模型 datetime 均以 `Z` 结尾 | ✅ 可二值判定（m1 已解决，遍历式） | 数据✓ 前端- 多端✓ 边界- 兼容- | When 改遍历，清单降附录 |
| **BDD-08** 表模型 python 模式不被污染 | ✅ 实测 `Entry(EntryBase, table=True)` 继承链成立 | 数据✓ 前端- 多端- 边界- 兼容- | 未变 |
| **BDD-09** 叶模型 python 模式仍为 datetime | ✅ 防 `when_used='always'` 回归 | 数据✓ 前端- 多端- 边界- 兼容- | 未变 |
| **BDD-10** CLI remote 解析带 `Z` 字符串 | ✅ 实测 `client.py:89` 裸 `fromisoformat(v)` | 数据- 前端- 多端✓ 边界- 兼容✓ | 未变 |
| **BDD-11** CLI `--json` 时间带时区标记 | ✅ 接受 `Z` 或 `+00:00`，与 BDD-07 形态冲突已规避 | 数据- 前端- 多端✓ 边界- 兼容✓ | 未变 |
| **BDD-12** 存量 UTC 审计 0 异常行 | ✅ 排除天然未来列的条件已写明 | 数据✓ 前端- 多端- 边界- 兼容✓ | 未变 |
| **BDD-13** `fileCount=1` 不显示文件数 | ✅ 实测 `v-if="entry.fileCount"` 对 1 为真 → 缺陷真实 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-14** `fileCount=0` 不显示 | ✅ 与 BDD-13 互补，三态齐备 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-15** `fileCount=3` 显示 `3 files` | ✅ 正向断言，锁住不误伤 | 数据- 前端✓ 多端- 边界- 兼容- | 未变 |
| **BDD-16** 菜单不含当前状态项 | ✅ 三态构造表与 P0 决策 3 一致 | 数据- 前端✓ 多端- 边界- 兼容- | 未变 |
| **BDD-17** 无团队不渲染 Team 入口 | ✅ 实测 `allTeams = [...owned, ...joined]` 为空即不渲染 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-18** Team 一律子菜单且排除当前团队 | ✅ 菜单**构造**正确（结果由 BDD-27/28/29 承接） | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-19** 升 Public 二次确认 + team 清空 | ✅ 锁定「两字段同传」硬约束 | 数据✓ 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-20** 降级不弹确认 | ✅ 二值明确 | 数据- 前端✓ 多端- 边界- 兼容- | 未变 |
| **BDD-21** 失败保持原值 + 提示 | ✅ 错误路径覆盖 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-22** 非 owner 三处均无菜单 | ✅ 权限边界覆盖，三处渲染点齐全 | 数据- 前端✓ 多端✓ 边界- 兼容- | 未变 |
| **BDD-23** 详情页桌面+移动双入口 | ✅ 实测 `EntryDetailHeader.vue:66-73` 与 `EntryMetaTagsBar.vue:6-13` 均需改造 | 数据- 前端✓ 多端- 边界- 兼容✓ | 未变 |
| **BDD-24** 请求中不可重复触发 | ✅ 并发边界覆盖 | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-25** 0 文件专用空态且可区分 | ✅ 实测现状落 `EntryDetailContent.vue:59-61` | 数据- 前端✓ 多端- 边界✓ 兼容- | 未变 |
| **BDD-26** 按文档 seed 后 Explore 有内容 | ✅ 人工体验路径 BDD（P1 卡强制节）；8/4/1 文件数实测吻合 | 数据✓ 前端✓ 多端- 边界- 兼容✓ | 未变 |
| **BDD-27** Private → Team A（保持非公开） | ✅ 两字段断言；与 P0:160 对齐 | 数据✓ 前端✓ 多端- 边界✓ 兼容- | **新增** |
| **BDD-28** Team A → Team B（保持非公开） | ✅ 两字段断言 + 无确认框；与 P0:161 对齐 | 数据✓ 前端✓ 多端- 边界✓ 兼容- | **新增** |
| **BDD-29** Team A → Private（团队清空、保持非公开） | ✅ 两字段断言 + 停在 `is_public=false`；与 P0:162 对齐 | 数据✓ 前端✓ 多端- 边界✓ 兼容- | **新增** |
| **BDD-30** 菜单可被键盘关闭且焦点回归 | ✅ 两个可观测结果，未绑属性名 | 数据- 前端✓ 多端- 边界- 兼容✓ | **新增** |

**统计**：30 条中 **30 条通过**（上轮 23 通过 / 2 阻塞 / 1 需修 → 本轮 30/30）。

---

## 五、隐含需求覆盖（五维度）

| 维度 | 覆盖 | 覆盖条目编号 | 说明 |
|---|---|---|---|
| **数据** | ✅ 覆盖 | I-1, I-2, I-3, I-4, I-5, I-6 | 15 模型 / 31 字段**逐项 AST 实测吻合**；`when_used='json'` 陷阱、`fromisoformat` 破坏性变更均已登记 |
| **前端** | ✅ 覆盖（含可访问性，上轮缺口已补） | I-7, I-8, I-9, I-10, I-11, I-12, I-13, I-14, I-15, **I-24** | UI 状态/交互/响应式齐备；**a11y 由 BDD-30 + §9 双向声明补齐**（上轮 W2 缺口闭合）；新增 I-24 补 locale 判定手段 |
| **多端** | ✅ 覆盖 | I-16, I-17, I-18 | MCP 2 处「不改代码但需验证」判断正确（`createEntry.ts:121` / `publishFiles.ts:551` 实测）；API 无端点变更（`client.ts:203` 已支持两字段）；CHANGELOG/升级说明已列 |
| **边界** | ✅ 覆盖（含时区 + locale） | I-19, I-20, I-21, I-22, I-23, **I-24** | 0 文件素材现造（`seed-debug.py:183-185` 实测 SKIP）、两空态可区分、倒计时数值变化、E2E 不得硬编码 `GMT+8`、TPV0095 BDD-40 有意取代；**locale 边界由 I-24 补上** |
| **兼容** | ✅ 覆盖 | I-18, I-21, I-23 | 响应格式破坏性变更的 CHANGELOG/升级说明、倒计时数值变化不作回归、旧测试断言取代登记 |

**隐含需求条目编号清单（23 条，全部有正文承载）**：I-1 ~ I-24（I-24 为本轮新增，I-1..I-23 沿用）。
其中「数据」6 条（I-1..I-6）、「前端」10 条（I-7..I-15 + I-24）、「多端」3 条（I-16..I-18）、
「边界/兼容」6 条（I-19..I-23，I-21/I-23 跨边界与兼容）。

---

## 六、跨条一致性

| 检查点 | 结果 |
|---|---|
| 同场景多 BDD 的 Then 是否矛盾 | ✅ 未发现矛盾。重点复核三组：① BDD-07（`Z` 结尾）vs BDD-11（`Z` **或** `+00:00`）——Given 出口不同（API JSON vs CLI 输出），有意区分，不矛盾；② BDD-19（升 Public 需确认）vs BDD-20/27/28/29（降级/平移不需确认）——Given 起始态互斥，方向对立但条件不重叠；③ BDD-18（子菜单构造）vs BDD-27/28/29（转换结果）——构造层与结果层分离，无重复断言 |
| 保护优先级是否显式 | ✅ BDD-24（请求中禁用）与 BDD-21（失败回滚）层次分明；后端「team 未清空无法变 public」硬约束在 BDD-19 的 Then 显式锁定；「非 null team 强制 `is_public=false`」在 BDD-27 显式锁定 |
| 测试数据设计是否考虑环境约束 | ✅ **上轮 ❌ 已转 ✅**：BDD-04 显式固定时区 + locale；BDD-02 Given 声明 locale 为 `en-US`（Playwright 默认）且不限定时区；§8 补齐 `timezone-controlled-execution` + `locale-controlled-execution` 两条能力声明（均 `available`，补充方式可执行）；I-24 给出统一裁决规则（凡断言墙上时间字面量的 BDD 必须固定 locale）→ 后续新增 BDD 有可循判据 |
| BDD 与 P0 验收基线的对应 | ✅ P0 的 12 条验收基线全部有承接（1→01/02/03、1b→07、1c→04、1d→08、2→13、3→15、4→25、5→16、6→17、7→18、8→19、9→20、10→22、11→23、12→21），另 P0 决策 3 的 5 个转换 → BDD-19/20/27/28/29 |

---

## 七、裁剪评审

**无阶段跳过**（`phases: [P1..P8]` 全 8 个，`pruned` 未声明 → `phases ∪ pruned == phase_universe` 恒检成立）。

| 阶段 | 判定 | 理由充分性 |
|---|---|---|
| P1 | 保留 | 不可裁（核心阶段）→ 合规 |
| P2 | 保留 | 三处复用的组件契约是设计核心；domains 含 backend+frontend → 机械映射 plan-eng-review + plan-design-review |
| P3 | 保留 | 理由具体（时间格式化两处边界缺陷、文件数三态、菜单三态笛卡尔子集、序列化覆盖均有可单测行为）→ 非空话 |
| P4 | 保留 | 不可裁 → 合规 |
| P5 | 保留 | 含全端点序列化验证 + 存量 UTC 一次性审计 → 充分 |
| P6 | 保留 | **30 条 BDD**（计数已同步）+ UI 截图 + before/after 倒计时对比 → 充分 |
| P7 | 保留 | 多文件 + 三处复用 + 跨层契约 → 充分 |
| P8 | 保留 | 用户可见改动 + 响应格式破坏性变更 → 充分 |

**`risk_level: medium` 与实际风险匹配** ✅：含权限边界（可见性三态 + owner 判定 + 团队归属）、跨层契约变更（响应序列化影响 frontend / CLI / MCP 三类消费方）、三处组件复用、已量化的 8 小时偏移风险。未虚报 high（无 schema 迁移、无安全认证改动），也未低报到 low（`domains` 跨 4 个域）。

**`ceremony: standard`** ✅：未声明 thin → 无需 `coupling_checklist` / `跳过风险` 四要素；standard 与 medium 风险匹配。

**`capability_requirements` 三态判断** ✅（4 条全部 `available`，yaml 解析通过，无 GAP）：
- `visual / vision 截图分析` = `available`（列 8 个可用模型 + vision-engine skill）→ 合法，frontend 任务的视觉能力条目已声明
- `browser-automation` = `available` → 合法
- `timezone-controlled-execution` = `available` → 合法
- **`locale-controlled-execution` = `available`（本轮新增）** → 合法，`available` 列表给出两条可执行方式，其中 `test.use({ locale })` 与仓库既有 `test.use({ viewport })` 同款 → 不构成 GAP

**`verification_env` 使用正确** ✅：debug backend + 数据目录属**环境**问题，已按判断树走 `verification_env` 而非误标 `supplementable`；`verification_env_budget` 占位行已保留（止损轮次 2，独立计数）。

---

## 八、审声明（风险分级 / 裁剪声明 vs 证据）

| 声明 | 证据 | 判定 |
|---|---|---|
| `risk_level: medium` | `git diff --cached` **为空**（P1 阶段无代码改动，符合预期）；实际改动面按 §9 为 `peekview` + `frontend-v3` + `docs` 三个包、`backend`/`frontend`/`api`/`cli` 四个域 | ✅ **匹配**——medium 由**声明的范围**支撑（跨层序列化契约 + 权限边界 + 三处复用） |
| `ceremony: standard` | 未声明 thin → 不触发四要素 checklist；standard 为缺省档 | ✅ **匹配** |
| `phases` 含 P7 | `phases` 显式列出 P7；且本任务非 `ceremony: full`（full 才强制 P7）→ P7 在 standard 下亦已保留 | ✅ **通过** |
| `domains: [backend, frontend, api, cli]` | `rules/review-mapping.md` 只认 backend/frontend/mcp/security | ⚠️ **非阻塞观察（沿用上轮 INFO）**：`api`/`cli` 不在映射表内，不触发额外评审角色；backend+frontend 已触发所需两角色 → 功能无影响，P2 不必改动 |
| `packages: [peekview, frontend-v3, docs]` | 与 §9 改动清单逐项对应 | ✅ 匹配 |
| `reviewed_bdds` 声明 | 本文件已更新为 `01..30`（30 项，与 P1 的 `#### BDD-NN:` 集合逐项相等） | ✅ 匹配（gate 判据：集合严格相等） |
| 声明与实际是否一致 | 上轮 M1/M2/M3/m1/W2 五项均为「BDD 判据与机制不一致」，本轮**已全部改正且经独立实测确认** | ✅ 无不一致 → 取 **approved** |

---

## 九、P1 纯净性（本轮含新增内容复核）

**结论：通过。新增内容未引入解决方案设计。**

- **新增 BDD-27/28/29** 只描述用户动作 + 状态结果（`is_public` / `team` 两字段），未提 API 调用名或组件名 → 纯净。
- **新增 BDD-30** 只断言两个用户可观测结果（菜单关闭 + 焦点回归），未绑 `aria-*`/`role` → 纯净；`OverflowMenu.vue:140-155` 只出现在**说明块**作为惯例依据，非判据。
- **新增 I-24** 是「产品语义 vs 判定手段」的层次说明，属需求侧判定规则，不是设计方案。
- **新增 §8 `locale-controlled-execution`** 是**能力需求声明**（P1 卡要求的三态声明），列出 Playwright `locale` 选项属**能力可用性证据**而非实现步骤 → 与既有 `timezone-controlled-execution` 条目同性质，不越界。
- **BDD-02/04/07 的「修订说明」块**均为判据依据论证（引用实测数据与源码行号），未写实现代码。
- **§9 可访问性范围声明**含 `role="menu"`/`aria-haspopup` 等属性名，但这是**范围排除项的命名**（说明「不做哪些」），不是验收判据 → 不构成实现绑定。
- **无 PASS/FAIL 预判**：§3 只写 Given/When/Then，未写「预期通过」类判定 → 符合 `check-p6-provenance.py` 审计要求。

---

## 十、P0-brief 时效性与归因核对

### 归因表述未被改动（上轮已确认正确）✅

| 核对项 | 本轮实测 |
|---|---|
| `P0-brief.md` 中 `image-gallery` / `backend-solo` / `objective_info` 命中数 | **0**（`grep -c` = 0）→ 归因指向 dispatch-context 正确 |
| P1 第 7 节第 1/2 条 `[P0_STALE]` 归因 | 原文未动，仍明写「主 Agent 在 **P1 dispatch-context** 的 objective_info」（L536、L538） |
| 第 3 条 `[P0_STALE]` 归因 | 原文未动，仍明写「**P0-brief 自身**的配套改动清单第 2 行」；实测 `P0-brief.md:191` 内容确为 `` `cli.py:378/443/561` `` → 归因正确 |

### 三判据核对（沿用上轮结论，本轮抽查未变）

| 判据 | 判定 |
|---|---|
| 1. `task` 目标方案是否仍成立 | ✅ 四项缺陷前提仍在（`useRelativeTime.ts:24-26` 裸 `toLocaleString()`、`EntryCard.vue:44` `v-if` 对 1 为真、`EntryCard.vue` 团队空占位、`EntryDetailContent.vue:59-61`） |
| 2. `executor_env` 平台前提是否仍成立 | ✅ branch `main`、HEAD `8ab8f58b`（与 P0 一致） |
| 3. `known_risks` 的「已解决前提」是否实际未解决 | ✅ 无命中：`client.py:89` 仍裸调用、`EntryBase` 仍被 `Entry` 继承、naive=UTC 仍成立 |

**结论：不命中严重 3 条 → 不阻塞。3 处 `[P0_STALE]` 按「轻微」处理并已更新字段，处置合规。**

---

## 十一、本轮新增观察（INFO，均不阻塞）

| ID | 级别 | 位置 | 观察 | 建议 |
|---|---|---|---|---|
| **INFO-1** | INFO | §6.10 映射表首行 vs BDD-07 When | §6.10 首行仍写「断言『每个**非 table 类**中的每个 datetime 字段』」，未带 BDD-07 When 已精确化的「**不被任何 `table=True` 模型继承**」排除条件。判据主体（BDD-07）已精确，§6.10 属拦截手段的概括表述 → 不影响 P3/P6 判定，仅措辞不精确 | 可选：P2 顺手对齐措辞。不构成打回理由 |
| **INFO-2** | INFO | BDD-01 / BDD-03 形态判据 | 实测 `GMT±N` + 4 位年份形态在 `ar-EG` / `fa-IR` / `bn-IN` 等使用**非拉丁数字**的 locale 下不成立（如 `ar-EG` → `غرينتش+٨`）。项目 E2E 默认 `en-US`、CI 默认 `UTC`，两者均成立 → **当前环境无假 FAIL 风险**；且 I-24 已确立「凡断言墙上时间字面量的 BDD 必须固定 locale」的通用规则，可覆盖未来扩展 | 无需改动。若未来 E2E 引入 RTL/非拉丁 locale，按 I-24 固定 locale 即可 |
| **INFO-3** | INFO | BDD-30 说明块 / §9 | 引用 `OverflowMenu.vue:140-155`，其中 `Escape` 分支在 139-145、监听器注册/解绑在 148-156，但 `close()` 定义（含 `triggerRef.value?.focus()`）在 **123-126**，不在引用区间内。核心惯例确实存在，仅引用区间略窄 | 可选：P2 引用改为 `OverflowMenu.vue:123-156` 更完整。不构成打回理由 |

---

## 十二、问题汇总

| ID | 级别 | 上轮状态 | 本轮状态 |
|---|---|---|---|
| **M1** | BLOCKER | BDD-02 Then③ 在 TZ=UTC 下必然假 FAIL | ✅ **已解决**（判据改「值相等」，UTC/Asia-Shanghai 双环境实测可判定，语义收紧未放宽） |
| **M2** | BLOCKER | BDD-04 `17:43:00` 随 locale 变 + 与 I-11 矛盾 | ✅ **已解决**（Given 固定 locale + §8 补能力条目 + I-24 层次切分；反解方案经我独立复测确认不可靠，否决正确） |
| **M3** | BLOCKER | 3/5 可见性转换无 BDD | ✅ **已解决**（BDD-27/28/29 均断言两字段，与 P0:159-163 五条逐条对齐，5/5 全覆盖且无重复断言） |
| **m1** | MINOR | BDD-07 硬编码清单 vs §6.10 | ✅ **已解决**（遍历式 + 排除条件；我独立 AST 复现 17−2=15 类/31 字段，附录与 §6.9 逐项吻合） |
| **W2** | WARNING | 复合菜单零 a11y 覆盖 | ✅ **已解决**（BDD-30 可二值判定且不绑属性名 + §9 双向声明；backlog 最大编号 #58 实测准确；`OverflowMenu` 惯例实测存在） |
| **INFO-1/2/3** | INFO | — | 本轮新增 3 条非阻塞观察（措辞精度 / 非拉丁 locale 形态 / 引用区间） |

**BLOCKER = 0，MINOR = 0，WARNING = 0，INFO = 3（+ 沿用上轮 domains 语义分组观察 1 条）。**

**「上轮已通过项是否被破坏」结论：未破坏**（8 类逐条复核全绿，见第三节；附加抽查 `cli.py` 7 处 /
`admin_service.py` 3 处 / `client.py:89` / MCP 2 处 / E2E 42 spec / TPV0095 断言 均吻合）。

---

## 十三、本轮通过的锚点汇总（供后续阶段引用）

1. BDD 全量 30 条格式与结构（`#### BDD-NN:`、`01..30` 连续单调、每条单场景、UX 类别后缀齐备）—— 全绿
2. 反模式（主观词 0、G/W/T 行实现绑定 0）—— 全绿
3. 15 叶响应模型行号 + 31 datetime 字段 —— **AST 独立实测逐项吻合**
4. `EntryBase`/`UserBase` 严禁加 serializer 判断 —— **AST 实测正确**（17 个非 table 含 datetime 类中仅此二者被 table 模型继承，`FileBase` 无 datetime 字段故不在 17 内）
5. BDD-07 遍历条件「非 table 且不被 table 模型继承」—— **必要且充分**（缺之则误抓 EntryBase/UserBase）
6. `cli.py` 7 处 / `admin_service.py` 3 处 / `client.py:89` / MCP 2 处 —— **行号全对**
7. 全部组件/store 行号引用（9 处）—— **全对**
8. seed 事实（image-gallery 不入库 + `seed-debug.py:183-185`、三团队归属、文件数 8/4/1）—— **全对**
9. TPV0095 4 单测 + 1 E2E 被取代登记 —— **文件与断言均实测存在**
10. 同类扫描 10 小节（含主动否定「只此一处」）—— **达标**
11. 裁剪声明（无跳过、medium、standard、verification_env、ui_render_shape + 3 维度）—— **合规**
12. `capability_requirements` 4 条全 `available`，含新增 `locale-controlled-execution` 且补充方式可执行 —— **合规**
13. P0 归因修正（3 处 `[P0_STALE]` 指向 dispatch-context / P0-brief:191）—— **未改动，仍正确**
14. 计数同步 5 处（§3:127 / §5:341,346 / §6.10 表 / 顶部:41 / 「26 条」残留 0）—— **全部同步**
15. P1 纯净性（含新增 BDD-27~30、I-24、§8 条目、§9 声明的越界复核）—— **通过**
16. `check-frontmatter.py P1-requirements.md` → **exit 0**

---

**状态标记：[PROD_NOT_TOUCHED]**

> 评审期间未运行任何写仓命令（无 `git checkout/restore/reset/stash/clean/add/commit/switch`），
> 未对真实仓库运行 `agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` /
> `agate-task-init.py`，未触碰生产 `:8080` 与 `~/.peekview/`，未启动 debug 服务，未修改
> `P1-requirements.md`（唯一写操作是本文件覆盖写 + `P1-review-progress.md` 追加）。
> 仓外验证脚本：`.agate-tmp/ast_check_models.py`（已 gitignore，可丢弃）、`.agate-tmp/cap.yaml`
> （capability yaml 解析副本）。所有验证均为只读 grep / read / python AST / node 表达式求值。
