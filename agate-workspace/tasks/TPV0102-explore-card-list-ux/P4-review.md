---
phase: P4
task_id: TPV0102
type: review
parent: P4-implementation.md
trace_id: TPV0102-P4-review-20261110
status: approved
created: 2026-11-10
agent: review
role: 专家组组长（P4 汇总，不发表新意见）
expert_votes: 2/2 approved
blockers: 0
transcribed_constraints: 26
prod_touched: false
---

# P4 专家组汇总 — Explore 卡片列表体验修正

> **本文件性质**：P4 专家组组长**机械汇总**，不含任何新意见。全部结论来自两份专家评审，本文件不新增、不推翻、不补充。
> **输入**：`P4-review-backend.md`（`agent: review`，`status: approved`，`critical_count: 0`）+ `P4-review-design.md`（`agent: design-review`，`status: approved`，`review_round: 2`）
> **被评审对象**：`P4-implementation.md`（6 节：backend-serialize / frontend-shared / mount-explore / mount-detail / docs-changelog / rev1-fix / rev2-fix），工作树未 commit（HEAD `20fd76b3`）
> **状态标记**：[PROD_NOT_TOUCHED]

---

## 1. 结论

**status: approved**

**专家票型：2 / 2 approved，0 BLOCKER。**

| 评审 | agent | status | 计数 | 轮次 |
|---|---|---|---|---|
| `P4-review-backend.md` | `review` | **approved** | `critical_count: 0` / `informational_count: 2` | 单轮 |
| `P4-review-design.md` | `design-review` | **approved** | `findings_blocking: 0` / `findings_suggest: 4` | 第 2 轮复审（rev1 → rev2） |

两份评审的 frontmatter `status` 与实际结论正文一致（机械核对项）。按组长规则「全票无 BLOCKER → approved」，本汇总结论为 `approved`。

---

## 2. 各专家结论摘要

### 2.1 review（`P4-review-backend.md`）— approved（后端域）

**范围**：`backend-serialize` 批 6 文件（`timefmt.py` 新建 / `models.py` / `client.py` / `cli.py` / `services/admin_service.py` / `tests/test_utc_serialization.py`）。

**总判**：**0 个 CRITICAL**，2 个 INFORMATIONAL（均「不改也不错、但建议登记」级别，不阻断）。四条 P2 硬约束**全部落实**且经实跑反证：

| # | P2 硬约束 | 结论 |
|---|---|---|
| ① | `field_serializer` 必须显式 `when_used='json'` | ✅ 落实（`models.py:91`；`EntryResponse.model_dump()` 仍返回 `datetime` 实体） |
| ② | `response_model` 按声明类重校验后 Z 不丢 | ✅ 无风险（TestClient 实测 `/admin-stats` `/users` `/me` 均输出 `"...Z"`） |
| ③ | `AwareDatetime` 不可用于 `table=True` 模型 | ✅ 未触碰 |
| ④ | `EntryBase`/`UserBase` 严禁加 serializer | ✅ 未触碰（AST 探针 `VIOLATION = []`；表模型 11 个全无 mixin） |

**dispatch-context 点名的两个核心疑点，专家均给出明确结论**：

1. **`parse_iso` 的 `replace("Z", "+00:00")` 安全** —— ISO 8601 时间主体仅由数字与 `- : . +` 组成、不含字母 `Z`，结构上不可能误伤中间字符；对抗性输入（`'...ZZ'` / `'ZZZZ'` / `'Z'` / `'...+00:00Z'`）**全部抛 `ValueError`**，即畸形输入只会快速失败、不存在「替换后仍解析成功但语义错误」的静默腐蚀路径。
2. **15 个叶模型无一错换** —— 逐个核对（AST 静态口径 + 运行时 `inspect` 口径双路互证），覆盖实际为 **16 类 / 34 字段**（多出 `ShareCreateResponse`，经 `class ShareCreateResponse(ShareResponse)` 继承命中）。P1 §6.9 第 2 条与 P2 §1.3 R6 均已预登记为**预期差异，非缺陷**。`EntryBase`/`UserBase` 正确排除（若纳入反而会触发 CRITICAL 的表模型污染）。

**额外反证（超出必跑项）**：通配 `field_serializer("*")` 对未来新增字段/子类字段自动覆盖（机制上不可能漏改）；对 `Enum`/`date`/`list`/`dict`/`None`/`int`/`bool`/嵌套模型无不良副作用；未挂 mixin 的嵌套内层模型 datetime **不会**被误加 Z（无跨模型污染）。

**实跑**：`test_utc_serialization.py` 20 passed；`-k mixin_not_in_table_mro` **1 passed（exit 0，非 exit 5）**；`make lint` exit 0；9 个相关测试文件 254 passed / 0 failed。

**2 条 INFORMATIONAL（不阻断，供主 Agent 决定是否回派）**：

- **IN-1（低）**：`cli.py` 的 `apikey create/list` 与 `whoami` 时间显示在 local 与 remote 模式**不对称**（local 为 `str(datetime)` 无时区标记，remote 为服务端透传的带 Z 字符串）。属**属性/字典直接插值**路径，未在 P1/P2 改动清单内（P1 §6.6 只登记 7 处 `.isoformat()` + `admin_service` 3 处）⇒ **不属于本批漏改**，不违反 BDD-11（BDD-11 字面判据是 `--json` 输出）。专家建议：**不在本任务修**，登记 `docs/roadmap/improvement-backlog.md` 作 follow-up。
- **IN-2（低）**：`parse_iso` 对 `+00:00` 与 `Z` 混写（`'...+00:00Z'`）抛错而非容错 —— 这是**非法** ISO 8601 输入，抛错是正确行为，上游是自家服务端不会产生此类值。**不建议改**，仅记录备查。

### 2.2 design-review（`P4-review-design.md`）— approved（前端域，两轮轨迹）

**范围**：4 个新建 + 13 个改动前端文件（P4 rev1 + rev2 修复）。

**两轮轨迹**：

- **首轮 `needs-revision`**：F-1~F-4 四项阻塞（列表末行下拉被裁 / 桌面焦点环被 `opacity:0` 抹掉 / tooltip 文本溢出背景框 / `EntryListRow.spec.ts` 静默失效断言）+ F-5~F-9 五项建议。
- **implementer rev1 修复 → 复审 `approved`**：F-1~F-4 **全部闭合**，且每条均用**真实浏览器 DOM 度量 + 反向对照**验证（非仅读代码）：

| 项 | 闭合证据（专家实测） |
|---|---|
| **F-1** 列表末行下拉被裁 | 裁剪祖先 `[]`（零个）；浮层越出 `.entry-panel` **43px** 仍可 `elementFromPoint` 命中；**反向对照**（临时还原 `overflow:hidden`）→ 可见高 39/82 = **47%**、`Team` 项 `hitSelf=false` ⇒ 该用例对裁剪敏感，非恒绿。圆角/边框未坏（首/末行 13px vs 面板 14px 同心，左右各内缩 1px=border 宽；角点像素命中 `list-content`） |
| **F-2** 桌面焦点环被抹掉 | 真按 `Tab` 实测 `opacity 0→1`、`:focus-visible=true`、焦点环 `2px solid rgb(9,105,218)`、`:hover=false`（排除鼠标参与）；**反向对照**注入 `opacity:0!important` → 回落 0 |
| **F-3** tooltip 文本溢出 | `white-space: normal` 落到基础规则；盒 207×64、文本 152×48、右溢出 **-47px**（文本在框内） |
| **F-4** 静默失效断言 | 守卫已删、改 `[data-testid]` 路径并断到 `target.kind === 'private'`，文件头 7 行登记取代来源；逐条 verbose 实跑 **15/15 passed** |

- **F-7 同时闭合**：`[DESIGN_GAP]` 第 3 条记述已与代码一致。

**3 处额外测试语义改动，专家逐条判定「修正错误断言」而非「降低验证强度」**：

| 项 | 判定 | 依据 |
|---|---|---|
| **bdd25** | **修正（不可达判据）**，附一处软缺口 F-11a | `stores/entryDetail.ts:44-56` 的 `loadEntry` 在 `files.length > 0` 时**恒**把 `activeFile` 置为 `files[0]`（两条分支都兜到 `files[0]`，无 `null` 出口），`selectFile` 也不置空 ⇒ `empty-select-file` 对有文件 entry **不可达**，源码 + 实测双证。BDD-25 的 Then 前半条（0 文件 entry 专用空态）由 `expect(noFiles).toBeVisible()` + 文案非空**保留，强度未动** |
| **bdd04** | **修正且净增强** | 原写法「页面第一张卡 vs `per_page=1` 第一条」是两个独立请求，`fullyParallel: true` 下可能指向不同 entry（实测差 1 秒）⇒ flaky 是**结构性**的。新写法现造 entry + 同 slug 锚定。BDD-04 的四项判据（时区固定 / 含 `GMT+8` / 墙上时间 = UTC+8h / 无 NaN）**一字未改**，「数据同源」维度为增强 |
| **vc06** | **修正，桌面原强度实测仍在执行** | 1280×900 实测 `gridTemplateColumns` = `876.438px 241.562px` → `isTwoColumn=true` → **原断言执行且成立**（`actionsBox.x(1151) >= 956`）；390×844 单列下二维不相交（`overlapX=+76` 但 `overlapY=-81`）。专家证明轴对齐矩形「二维不相交」与「视觉不重叠」**严格等价**，不会放过斜向重叠 |

**第 4 处改动 `vc05`**（rev2 已主动披露于 `P4-implementation.md` 与 `P4-progress.md:56`，非隐瞒）：专家独立判为**修正不可满足断言**，但**修正偏松** ⇒ 登记 **F-11**（不阻塞）。

**六项检查清单复核**：AI Slop ✅（4 个新文件 hex/violet/gradient 零命中）/ Typography ✅ / Spacing ✅（新增 `visibility-toggle` 移动端实测 **44×44**）/ 交互状态 ✅ 四态齐 / 可访问性 ✅ 全项到位（含 Escape 两级关闭、焦点回归 BDD-30、无 `outline:none`）/ 视觉契约 VC-1~VC-8 ✅（VC-3 1280 下 20/20 卡不溢出；VC-7 `meta-row` 26px ≤ 37；VC-8 新增且实测通过）。

**实跑**：E2E `tpv0102-explore-card-list-ux.spec.ts` **61 passed / 3 skipped / 0 failed**（两次复跑 39.5s / 41.7s 一致，无 flaky）；vitest 全量 **119 files / 1456 passed / 4 skipped / 0 failed**，`Errors`/`unhandled`/`Vitest caught` **零命中**；`make typecheck` ✓ / `make lint` ✓；`EntryDetailView.vue` 仍 **289** 行。

**`[DESIGN_GAP]` 复核**：`P4-implementation.md` 现 **13 条**（前端 11 + docs 2，经本组核验 `grep -c` = 13；上轮「12 条」的计数差异已消解）。**11 条前端全部可接受**，上轮唯一不可接受项（第 3 条）已闭合；第 7 条（`teamsFailed` 派生 + 失败后每次重试）标「接受但需跟踪」——**P6 若观察到请求风暴另立条目**，不由本评审阻塞。

---

## 3. 必须转抄给 P5 / P6 / P7 的执行约束与遗留项

> 本节是本次汇总的**实质价值**：把两份专家评审里分散的结论变成下游可直接照做的清单。每条均标注来源专家小节。**本节不含任何新意见。**

### 3.1 P6 两条禁令（沿用 P2，强制）

| # | 禁令 | 来源 |
|---|---|---|
| **T-1** | **不得写「对比度已满足 WCAG AA」**——`--c-text-tertiary` 实测**暗 3.84:1 / 亮 3.04:1，低于 AA 4.5:1**，属既有债（P2 §7 SUGGEST） | design 文件头声明 + §8 禁令① |
| **T-2** | **不得把既有 28×28 按钮写成「已达标」**——既有 `card-action-btn` / `action-btn` 的 28×28 是 P2 §7.1 S2「本任务不改」；**VC-4 只断言新增 `VisibilityMenu` 触发按钮**的移动端 44px | design 文件头声明 + §5.3 + §8 禁令② |

### 3.2 P5 必跑命令（P2 冻结的 `gate_commands`，7 条，不得修改）

| # | key | 命令 |
|---|---|---|
| **T-3** | `P5` | `make test-quick` |
| **T-4** | `P5_frontend` | `make test-frontend` |
| **T-5** | `P5_e2e` | `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` |
| **T-6** | `P5_e2e_legacy` | `E2E_SPEC=e2e/team-visibility.spec.ts make debug-test` |
| **T-7** | `P5_lint` | `make lint` |
| **T-8** | `P5_typecheck` | `make typecheck` |
| **T-9** | `P5_fitness` | `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro` |

**配套超时**（同属冻结声明，一并转抄）：`P5_timeout_seconds: 180` / `P5_frontend_timeout_seconds: 120` / `P5_e2e_timeout_seconds: 900` / `P5_e2e_legacy_timeout_seconds: 900` / `P5_lint_timeout_seconds: 60` / `P5_typecheck_timeout_seconds: 120` / `P5_fitness_timeout_seconds: 120`。

**执行注意**：

- **T-10**：**E2E 需 debug 服务**（`:8888`）——须**挂后台 job 托底**（`( make debug-quick; sleep 3600 )`），且**每次用前探活** `curl :8888/health`（两位专家均按此执行；design 实测返回 **200**）。当前 `:8080` 与 `:8888` **均无监听**（本组核验）。
- **T-11**：`P5_fitness` 的 `-k` 是**子串匹配**，`-k` 零命中时 pytest **exit 5**（非 0）⇒ `test_mixin_not_in_table_mro` 函数名与 `tests/test_utc_serialization.py` 文件名**不得被改**（P2 §9 已冻结）。专家实测该用例 **1 passed, exit 0**。

### 3.3 预存失败登记（**仅此一条**）

| # | 条目 | 处置 |
|---|---|---|
| **T-12** | `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` —— 沙箱 `~/.peekview/` 只读导致写配置失败，**与本任务无关** | P5 须登记任务目录 `known-failures.md`（**WARNING 级，不阻断推进**）。**当前该文件尚不存在**（本组核验），P5 需创建 |

**T-13**：本任务引入的 8 项 E2E 已修至 **0 failed**（design 两次复跑 61 passed / 0 failed 一致）——**不得**把本任务 E2E 登记为预存失败。

### 3.4 已知 fixture 问题（非本任务缺陷）

| # | 事实 | 处置 |
|---|---|---|
| **T-14** | `e2e/team-visibility.spec.ts` 的 **BDD-40** 若因 `proj-a` 团队不存在（创建 **422**）而红，属**既有 spec 的 fixture 缺失**，与 TPV0102 无关 | P5 判读 `P5_e2e_legacy` 结果时按此归因，不得计为本任务缺陷。该 spec 第 138-150 行已登记「BDD-40 已被 TPV0102 有意取代（P2-design §6.4 第 1 项 / 陷阱 16 / R5）」 |

### 3.5 转 P7 的判据瑕疵（3 条，`design-review` §9 列出）

> 均为 **P1/P2 阶段的判据问题**，不是 P4 实现缺陷。P7 须记录并回填。

| # | 判据瑕疵 | 建议处置（专家原文） |
|---|---|---|
| **T-15** | **BDD-25 后半条对有文件 entry 不可测** —— `stores/entryDetail.ts:49-53` 的 `loadEntry` 恒选 `files[0]` ⇒ `empty-select-file` 分支**不可达** | P7 回填 P1，或转「文案不变式由单测保护」 |
| **T-16** | **P2 VC-5 的 `<=2px` 基线几何上不可满足** —— 280px 卡宽（可用 246px）+ `@alice` 42.9 + 点 3 + 主显 **207.3px** 已超；en-US 桌面 **20/20 卡** 全部换行 | P7 修订 VC-5 措辞为「同一视觉行内基线对齐；折行时左对齐」 |
| **T-17** | **`F-12`**：`.entry-detail{overflow:hidden}`（`styles/layout.css:2-7`）是 `inline` 变体浮层的**潜在裁剪祖先**（当前实测无裁剪：`top 96 / bottom 214`，三项 `entryFromPoint` 全命中） | P6 在 **1280×600 或 1024×768** 补一次目视确认；若出现裁剪，按 F-1 同法处置 |

### 3.6 建议级遗留（不阻塞，P7 决定是否登记技术债）

| # | 项 | 内容 |
|---|---|---|
| **T-18** | **F-5** | `icon` 变体触发按钮实测 **16×28**，与相邻 28×28 删除按钮**宽度差 12px**、右上角不齐（建议补 `width:28px`） |
| **T-19** | **F-6** | 详情 `inline` 变体 **14px** 落在 12px 的 `.meta-row` 里，为该行最大字号、破坏 meta-row 层级（P2 例外声明要求沿用 `status-tag` 的 `10px / 1px 6px`） |
| **T-20** | **F-8** | `EntryDetailView.vue` **289 行**，距 `t082` 门槛 `<300` 仅 **11 行余量**；本任务净增编排逻辑方向与拆分目标相反 ⇒ 建议 P7/P8 建 **TECH-DEBT**（下沉出口 `useEntryDetailComputed` / `useEntryDetailActions` 已存在） |
| **T-21** | **F-9** | sheet 内**中英混排**（标题「可见性」+ 项 `Public`/`Private`/`Team` + 「团队列表加载失败」）；项目无 i18n、既有组件同样硬编码中文 ⇒ 不计缺陷 |
| **T-22** | **F-10** | 卡片元信息换行后**分隔点悬空**（`@alice ·` / `· 3 files` 各占一行首尾；en-US 桌面 20/20 卡、zh-CN 9/20 卡）。属纯视觉瑕疵，是 rev2 修 VC-3 溢出的连带产物（根因含 P2「卡片主显完整绝对时间」决定）。专家给 3 个 Fix 方案（约 2~5 行） |
| **T-23** | **F-11** | `vc05` 的 `wrappedToOwnRow` 判据**判别力低**（en-US 桌面 20/20 卡全走 wrapped 分支，不约束 x 对齐）。专家给低成本收紧写法（折行时改为「与用户名左对齐 + 不越右边界」，实测收紧后仍绿） |
| **T-24** | **F-11a** | `bdd25` 的「两文案可区分」依赖**复制常量** `EMPTY_SELECT_FILE_TEXT`（`spec.ts:53` vs `EntryDetailContent.vue:73`）——若日后两处文案被改成相同，常量不漂移、bdd25 仍绿，不变式失去机械保护。建议补一条 `EntryDetailContent` 单测（`activeFile: null` + `currentEntry.files.length > 0`，约 10 行） |

### 3.7 `[DESIGN_GAP]` 配对（P7 强制）

| # | 要求 |
|---|---|
| **T-25** | `P4-implementation.md` 现有 **6 节**、累计 **13 条** `[DESIGN_GAP]`（前端 11 + docs 2，本组 `grep -c` 核验）+ **2 条** `[SCOPE+]` ⇒ **P7 须逐条配对 `[DESIGN_GAP_REVIEWED:]`**（P7 卡片强制要求）。<br>· 前端 11 条专家已全部判「可接受」（design §6），其中**第 3 条已闭合（F-7）**、**第 7 条标「接受但需跟踪」**——P7 仍需逐条显式配对。<br>· docs 2 条（`v0.27.0` 版本号写作、`####` 四级标题）属**文档域**，不在 design-review 范围，**P7 须自行核对**。<br>· 2 条 `[SCOPE+]`（`t031-entry-card`/`t031-entry-list-row` 定位与事件名连带更新；CHANGELOG 第 4 条 overflow 菜单项移除）专家判定「无需回补 P1 基线」，P7 一致性检查须知道其存在 |

### 3.8 F-1 的最终实现取舍（下游需知晓，非缺陷）

| # | 事实 |
|---|---|
| **T-26** | **F-1 选了「去 `.entry-panel` 的 `overflow:hidden`」（备选 ②）而非 Teleport（备选 ①）**。<br>· **技术依据**：P3 契约 spec（`t031-entry-card` / `t031-entry-list-row` / `visibility-menu.spec` 等 **7 文件**）全部用 `wrapper.find('[data-testid="visibility-item-*"]')` 定位菜单项；VTU **2.4.10** 的 `wrapper.find` **不穿透 Teleport**（design 独立复验：`viaWrapper=false, viaDoc=true`）⇒ 选 ① 会一次性打断 7 个已通过的 spec。<br>· **视觉代价实测为零**：首/末行 13px 圆角与容器 14px 圆角同心，行内缩进 1px（border），无溢出、无露白。<br>· **回归兜底**：新增 `vc08` 用例覆盖。<br>· `[DESIGN_GAP]` 第 3 条的记述已相应改正（`P4-implementation.md:123`），且该取舍本身已作为新 `[DESIGN_GAP]` 登记在 `P4-implementation.md:330` |

---

## 4. 专家组分歧

**无分歧。**

两位专家对 `P4-implementation.md` 判定**一致**：均为 `approved`、均无 BLOCKER / CRITICAL、均 `[PROD_NOT_TOUCHED]`、均确认各自的评审链（backend 单轮；design rev1 → rev2）修复闭环且未引入新的阻断级问题。不触发人工仲裁。

**一处需下游知晓的差异（非分歧）**：design 的首轮 `needs-revision` 属**同一评审角色的评审内轮次**（rev1 → rev2），不是两位专家之间的意见冲突。

---

## 5. 组长汇总判定

按组长规则逐条适用：

1. 任一专家标 BLOCKER / status 非 approved → **不满足**（两位均 approved，`critical_count: 0` / `findings_blocking: 0`）
2. 专家分歧 → **不满足**（无分歧，见 §4）
3. 全票无 BLOCKER → **成立**

→ **汇总 status: approved**。`P4-implementation.md` 可进入 P4 gate 与 P5。

剩余 INFORMATIONAL / 建议级遗留 / 判据瑕疵 / `[DESIGN_GAP]` 配对**均不阻断本 gate**，已按 §3 逐条转抄给 P5 / P6 / P7。

---

## 附：环境隔离声明

[PROD_NOT_TOUCHED]
