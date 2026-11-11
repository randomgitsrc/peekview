---
phase: P1
task_id: TPV0103
type: review
parent: P1-requirements.md
trace_id: TPV0103-P1-review-20261111
status: approved
created: 2026-11-11
agent: requirements-review
prod_touched: false
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
---

# P1 评审 — TPV0103 时间主显格式修正（第 4 轮 / 终审）

> 结论：**approved**（BLOCKER = 0；无新增阻塞缺陷；2 条非阻塞观察见第九节，均不改变任何 P3/P6 动作）。
>
> **BLOCKER-C 已闭合**，且我**不采信自述、独立复跑**：analyst 的验收探针（`.agate-tmp/r3/final-acceptance.spec.ts`）用仓库内真实 vitest **1.6.1**（`frontend-v3/node_modules/.bin/vitest`，`environment: node`）在三种宿主 `TZ` 下各跑一次，**均为 10 passed**：
>
> | 宿主 `TZ` | 实现输出 | 参考值（不 pin 时区） | 判定 |
> |---|---|---|---|
> | `UTC`（CI 常态） | `2026/11/10 09:43` | `2026/11/10 09:43` | 10 passed |
> | `America/New_York` | `2026/11/10 04:43` | `2026/11/10 04:43` | 10 passed |
> | `Asia/Shanghai`（本机） | `2026/11/10 17:43` | `2026/11/10 17:43` | 10 passed |
>
> 判别力我也单独复验（不是照抄）：`TZ=UTC` 下 `ref`（不 pin）= `09:43` 而 `pinned`（`timeZone:'Asia/Shanghai'`）= `17:43`，**`equal=false`** → 旧模板在该宿主必假 FAIL，方案 1 正是消除了这一不同源；`TZ=Asia/Shanghai` 下二者相等（`equal=true`）→ 证明「本机永远绿」这一隐蔽性描述属实。真实 Playwright 探针 `pw-final.mjs` 在 `TZ=UTC` 下同样全绿（未 pin describe PASS / 已 pin describe PASS / 5 locale 正确实现 5-5 / 错误变体 35-35 全抓）。
>
> **评审基准**：HEAD `17d6c7bc`；`git diff --cached` 为空（P1 阶段尚未 commit，符合阶段语义）；工作树 12 个 untracked 全在任务目录内，`P1-requirements.md` 未跟踪。
> **独立实测环境**：Node v24.22.1（宿主 `Asia/Shanghai` / `locale=zh-CN`）+ 仓库内 vitest 1.6.1 + Playwright 1.60/Chromium。我自己的探针落 `.agate-tmp/review4/`，**收尾已整目录删除**；未在 `backend/tests/` 或 `frontend-v3/src/` 留任何文件（下方第十一节附 `git status --porcelain` 核验）。

---

## 一、终审三项核验（逐条做实，含我自己的复跑）

### ① 「全文是否还有任何地方把 `timeZone` pin 到参考值」→ 无

`grep -n "timeZone:"` 在 804 行正文里命中 **6 处**，逐处归类：

| 行 | 性质 | 判定 |
|---|---|---|
| 56 | retry 3 修订记录，**描述旧缺陷**（「`FIVE_FIELDS` 模板 pin 了 `timeZone:'Asia/Shanghai'`」） | 历史记录，非指令 |
| 181 | 禁令（「参考值模板里**不得出现 `timeZone`**」） | 反向约束 |
| 233 | 「同源两条轴」表，`timeZone` 行**错误写法**列 | 错误示范列 |
| 285 | 「若误把 `timeZone:'Asia/Shanghai'` 写进模板 → 假 FAIL」 | 错误示范 |
| 527 | §5.3 实测记录（「保留 `timeZone:'Asia/Shanghai'` 的旧模板在 `UTC`/纽约下必假 FAIL」） | 历史记录 |
| 637 | §6.1.1 说明「若照旧版把 `timeZone:'Asia/Shanghai'` 写进 `FIVE_FIELDS` → 这三处必假 FAIL」 | 错误示范 |

**没有任何一处是「照此写」的指令**。更关键的是三处**可直接照抄的代码块**（P3 会照抄的地方）我逐字提取确认：

- `FIX-A`（第 191 行）：`const FIVE_FIELDS = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }` —— **无 `timeZone`**
- `FIX-B`（第 212 行）：同款五字段，注释「时区不显式传 → 与实现的『不传 timeZone』同源」—— **无 `timeZone`**
- vitest 块（第 280 行）：同款五字段 + `const LOC = Intl.DateTimeFormat().resolvedOptions().locale` —— **无 `timeZone`**

固定时区的合法手段在三处一致收敛到 `test.use({ timezoneId })`（context 级，第 187/190 行）与进程启动前的 `TZ`（第 287 行），与实现 `useRelativeTime.ts:17-19`（`formatOffsetDate` 的 options 无 `timeZone`）同源。**判定：闭合**。

### ② §6.1.1 #2 及相关表述是否彻底不再教「显式传 timeZone」→ 是

- 第 622 行（§6.1.1 #2 正文）已改写为：「`locale` 取 `resolvedOptions().locale` 后**显式传**；`timeZone` **不传**」，并保留显式禁令「**不要写「显式传 locale+timeZone」**」+ 后果说明（`TZ=UTC` 下 `09:43` vs `17:43` 假 FAIL）。这是把旧错误指令**反转为禁令**，而非静默删除——保留错误示范有利于 P3 不再踩同一坑。
- 第 258 行给出结论句：「**「显式传 `timeZone`」不是正确做法**——实现的 options 里没有 `timeZone`，参考值也不得有。」
- 第 263 行把「显式同源」明确为**两条轴**（locale 轴 = BLOCKER-A、时区轴 = BLOCKER-C），并声明「漏掉任一轴都是判据自身造成的假 FAIL」——把这次的失效类别上升为通则，防第三轴复发。
- 第 778 行（§10 范围声明）与第 716 行（§8 `timezone-controlled-execution` 的 `available` 第 3 条）同口径：「参考值模板：不传 timeZone」。
- 残留的 `locale+timeZone` 字样仅出现在第 57/622 行的**禁令引用**中（引号内标注为「错误指令」），不构成教学。

**判定：闭合**。

### ③ 验收口径「`TZ=UTC` 下 vitest + e2e 全绿」是否写进 P1 → 已写入，且落在判定位置

| 位置 | 内容 |
|---|---|
| 第 289 行（BDD-01 正文末，紧邻判据） | 「**验收口径（P3/P6 必须按此判定，写死在此处防再漂移）**：**`TZ=UTC` 下 vitest 与 e2e 均全绿**」，并说明「本机 `Asia/Shanghai` 与 CI runner 恰好同区的巧合会让时区轴错配在本地永远不显形」「`TZ=Asia/Shanghai` 下的绿**不构成**有效证据」 |
| 第 249–253 行 | 三宿主自跑记录表 + 缺陷版对照行（`UTC`/纽约「假 FAIL 复现」、上海「恰好」） |
| 第 760 行（§9 P5 行） | 「本轮新增验收口径：vitest 与 e2e 必须在 `TZ=UTC` 下均全绿」 |
| 第 761 行（§9 P6 行） | 「e2e 判定同样须在 `TZ=UTC` 下跑一次」 |
| 第 529 行（§5.3） | `ci.yml` 跑不跑 vitest 的实测证据（我复核：`.github/workflows/` 内 `vitest`/`test-frontend` 在 `ci.yml` **零命中**，仅 `publish-npm.yml:38,68` 命中 MCP 单测）→ 支撑「本地绿 ≠ 可移植」 |

**判定：闭合**。验收口径不只写在修订记录里，而是写进了 BDD-01 正文 + 裁剪表 P5/P6 两行，P3/P6 无法绕过。

---

## 二、MINOR-1（7/32 → 8/32）三处引用同步核验

| 引用处 | 行 | 现状 | 判定 |
|---|---|---|---|
| BDD-06 正文 | 363 | 「**8/32 locale 漏判**」+ 列 `bn-IN` → `GMT +০৮:০০`（GMT 与 `+` 间有空格、数字为孟加拉文） | 已改 |
| BDD-12 ③ | 429 | 「**8/32 locale 漏判**」+ 同 8 个 locale 清单含 `bn-IN` | 已改 |
| §5.2 表 | 516 | 「**8/32 locale 漏判**」+ 同清单 | 已改 |

**我自己重算了一遍**（`TZ=UTC`，32 locale，`longOffset` 对 `/GMT[+-]\d{2}:\d{2}/`），漏判恰为 **8** 个：`fr-FR`(`UTC+00:00`) / `fi-FI`(`UTC+00.00`) / `da-DK`(`GMT+00.00`) / `id-ID`(`GMT+00.00`) / `he-IL`(含 bidi) / `ar-EG`（本地化词+阿拉伯数字）/ `fa-IR`（本地化词+波斯数字）/ **`bn-IN`**（`GMT +০০:০০`）。数字与清单**逐条一致**。残留的「7/32」仅在第 58 行修订记录中作为**变更前值**出现（正确用法，非残留错误）。**判定：闭合**。

## 三、MINOR-2（§8 两项增量表）核验

第 727–734 行已是**两项分列表**：#1 ICU/CLDR 版本差异（Node ICU 78.3 vs Chromium 148）/ #2 **时区来源不同源**（Node 进程 `TZ` vs 浏览器 context `timezoneId`），并写明二者**修法不同**（1 靠同引擎现算吸收、2 靠「模板不 pin 时区 + context 统一」），且显式否掉「用 FIX-A 就都解决了」这一错误合并（「FIX-A 只保证同引擎，若模板里仍 pin 了 `timeZone`，FIX-A 照样在 `TZ=UTC` 下假 FAIL」）。第 59 行修订记录同步。**这一项的技术判断我背书**：#2 是判据写法问题而非环境差异，我在 `TZ=UTC` 宿主上实测 `page.evaluate` 内 pin 时区即得 `17:43` vs 实现 `09:43`——与 ICU 版本无关，换任何 Node/Chromium 版本都不自愈。**判定：闭合**。

---

## 四、BDD 逐条评审（12 条，编号 `01`–`12` 连续，与我 grep 的 `#### BDD-NN:` 集合逐条相等）

维度标注：**数据**（格式/边界/缺失/迁移）· **前端**（UI 状态/交互/响应式/可访问性）· **多端**（API↔客户端契约）· **边界**（空值/极大/并发/时区/locale/编码）· **兼容**（旧版本/降级）

| BDD | 主题 | 判定 | 覆盖维度 |
|---|---|---|---|
| **BDD-01** | 主显与该 locale 的五字段参考输出逐字符相等（5 locale 各判一次） | 可二值判定。判据类型（对齐参考输出）与我复跑一致：`TZ=UTC` 下正确实现 10 passed、错误变体不假 PASS。**BLOCKER-C 已闭合**：模板去 `timeZone`，三处代码块实提取确认 | 数据✗ 前端✓ 多端✗ 边界✓（locale×时区×ICU 三条轴） 兼容✓（跨 ICU 稳定性来源已在 §8 表区分「判据性质」vs「写法保证」） |
| **BDD-02** | 主显无秒、tooltip 保留秒（精度分工） | 双向断言（①不含 `17:43:00` ②含 `17:43:00`），可二值判定；Given 固定 `zh-CN`+`Asia/Shanghai`，我实测该字面量成立 | 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓（tooltip 语义不变） |
| **BDD-03** | 已知 UTC 时刻在固定 locale/时区下主显 = `2026/11/10 17:43` | 我实测 `zh-CN`+`Asia/Shanghai` → `2026/11/10 17:43`，字面成立；不外推到任意 locale（姊妹条 BDD-01 分工已写明） | 数据✗ 前端✓ 多端✗ 边界✓（时区换算） 兼容✗ |
| **BDD-04** | `en-US` 12 小时制 `11/10/2026, 05:43 PM`，且否定 `17:43` | 我实测该串逐码点 `…0033 0020 0050 004d`（U+0020 SPACE），正则 `^11\/10\/2026, 05:43[\s\u202f]PM$` 命中；否定项亦成立。**是 `hour12` 唯一守护点**——我独立复现 `hour12:false` 在 `zh-CN`/`de-DE`/`ja-JP`/`sv-SE` 四 locale 逃逸、仅 `en-US` 可辨（4/5） | 数据✗ 前端✓ 多端✗ 边界✓（locale 的 12/24 小时制、U+202F 前瞻） 兼容✗ |
| **BDD-05** | 四个渲染点主显两两相等（含移动视口） | Given 含「当前用户为该 entry 的 owner」（消除私有 entry 不可见的判定歧义），Then 逐点 + 两两相等，可二值判定。四消费方我 grep 复核：`EntryCard` / `EntryListRow` / `EntryDetailHeader` / `EntryMetaTagsBar` | 数据✗ 前端✓ 多端✗ 边界✓（移动视口/flex-wrap） 兼容✗ |
| **BDD-06** | tooltip 三段（相对 · `GMT+08:00` · IANA 名）不回归 | 三段各自二值判定；③ 用「等于运行时 `resolvedOptions().timeZone`」而非形态（`TZ=UTC` 返回 `UTC` 不含 `/`，写形态会假 FAIL）——沿用了 TPV0102 已修正的写法。② 的 `GMT+08:00` 我实测 `zh-CN`+`Asia/Shanghai`+`longOffset` → `2026/11/10 GMT+08:00 17:43:00`，命中；且已按 8/32 漏判证据限定固定 `zh-CN` | 数据✗ 前端✓ 多端✗ 边界✓（locale/非整小时偏移/bidi） 兼容✓（语义保持不变） |
| **BDD-07** | 主显数字段序列是 tooltip 段序列的子序列（4 locale） | 二值判定；**诚实声明了能力边界**（对「主显加回 `second`」与「加回含分钟偏移」返回 true）→ 不冒充 BDD-01 的第二重保护，避免 P6 放松 BDD-01 | 数据✗ 前端✓ 多端✗ 边界✓（locale/偏移位置随 locale 变） 兼容✗ |
| **BDD-08** | 无效时间值不产生 `NaN`（3 类输入分三条独立断言） | 可二值判定。②③ 判「渲染为空串」我核对源码语义成立：`useRelativeTime.ts:67` 是 falsy 守卫，空串/`null` 走 `else` 直接置 `''`，**不会**调用格式化函数 → 判「占位 `—`」会必 FAIL，据实描述是正确选择（且已写明「若产品要占位是新任务」） | 数据✓（缺失/空/null） 前端✓ 多端✗ 边界✓（空值） 兼容✗ |
| **BDD-09** | 相对时间三档不回归 | 三者各自可判定；与 BDD-01 共用 composable，属必要回归锚 | 数据✗ 前端✓ 多端✗ 边界✗ 兼容✓ |
| **BDD-10** | 判据双向（主显不要求偏移/秒/恒绿弱断言；tooltip 偏移判据仍在） + 后端契约绿 | 五项各自可 grep 二值判定。⑤ 我核对 `backend/tests/test_utc_serialization.py` 存在且含 **20** 个 `def test_`，为「后端零改动」这一最无保护的声明提供了零成本既有守护点。②④ 解释了为何检索口径须按**断言对象**而非**断言文本**（这 6 处不含 `GMT` 字样，只 grep `GMT` 会全漏） | 数据✗ 前端✓ 多端✓（⑤ 后端/CLI 契约） 边界✗ 兼容✓ |
| **BDD-11** | CHANGELOG `[Unreleased]` + `upgrading.md` 新节 | ① 可词义判定；② 只判**标题格式** `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+` + 正文语义，把「确切版本号」留给 P8——我核对 `docs/process/upgrading.md:11` 现有 `## v0.26.1 → v0.27.0（…）` 正是该惯例，判据可落地；`CHANGELOG.md` 的 `[Unreleased]` 当前为空区，符合「待写入」前提。这条消解了「P6 断言确切版本号 = 不可判定中间态」的问题 | 数据✗ 前端✗ 多端✗ 边界✗ 兼容✓（已发布行为变更的升级披露） |
| **BDD-12** | seed 后 Explore 页有内容 + 主显合新规则 + tooltip 三段 | ①渲染出 >1 张卡（非空）②主显等于参考文本且不含 `ago`/`just now` ③tooltip 三段（偏移段按参考输出逐字符相等，不写死字面量）。三条各自二值判定；Given 已把 `zh-CN`/`Asia/Shanghai` 定为**默认判定条件**并给出两条验收路径，不再有「不固定 locale 就用字面量」的假 FAIL 口子。满足「人工体验路径」强制节：确实走 `make debug-quick`/`debug-seed` + 登录 + 页面，不以 fixture/单测替代 | 数据✓（seed 数据路径） 前端✓ 多端✗ 边界✓（locale/时区） 兼容✗ |

**格式与反模式**：12 条全部 `#### BDD-NN:`（两位数字、连续、与 `reviewed_bdds` 逐条相等）；每条**只有一个** Given-When-Then（多语境用「① ② ③」项内拆分，不是多场景混编）；Then 均锚在**用户可见文本**或**运行时参考输出**上，不绑 CSS 类名/HTML 属性/组件内部名；无「可读/美观/流畅」类主观词（UX 判据全部量化为「等于参考文本」「四段/三段分段计数」「逐字符相等」）。

---

## 五、隐含需求覆盖

- **数据维度**：✓ 覆盖 `2.1`（无 schema/迁移、无效值降级不回退）+ BDD-08（三类无效输入）+ BDD-12（seed 数据路径）。
- **前端维度**：✓ 覆盖 `2.2` 四项（四处 vs 三处、tooltip 结构不得改、12/24 小时制跟随 locale、文本变短后的溢出/折行）+ VC-1/VC-3 逐条判定（VC-1 不受影响、VC-3 方向相反且「变短的新风险」单列不冒充 VC-3）+ BDD-05/B-04。
- **多端维度**：✓ `2.3` 三项（后端零改动且须**显式声明**、MCP `createEntry.ts:118` ISO 回显保留、CLI `--json`）+ BDD-10 ⑤ 的既有守护点。MCP 侧残余风险（`createEntry.ts:118` 无自动化覆盖）**已诚实登记**为已知残余，由 P7 人工核对兜底，不是空白。
- **边界维度**：✓ `2.4` 四项（午夜 `00:00`/`12:00 AM`、32 locale 无 `24:00`、非整小时偏移 `+05:30`/`+13:45`/`+10:30`、DST）+ **locale 轴**（`sv-SE`/`lt-LT`/`nl-NL`/`en-CA` 的 `-` 分隔符假 FAIL，已纳入 BDD-01 清单）+ **时区轴**（BLOCKER-C 的治本处）+ **ICU 轴**（§8 两项增量表）。
- **兼容维度**：✓ `2.5` 五项（CHANGELOG/upgrading、版本号留 P8、按行号穷举既有断言、不得把「去偏移」扩为「去时区能力」、「三处」表述更正为四处）。

**UI/UX 机制（domains 含 frontend）**：`ui_render_shape: layout` + `ui_ux_dimensions: [布局结构, 交互行为, 视觉呈现]` —— 三者在 `check-gate.py:_FRAMEWORK_DIMS` 分类框架内（我核对常量定义），且三类均在 BDD 标题后缀实际出现（布局结构 4 条 / 交互行为 5 条 / 视觉呈现 3 条）。vision 能力条目 `need: visual / vision 截图分析` 存在、`status: available`（合法三态），并给出可执行调用方式与沙箱只读的注意事项；另三项（browser-automation / locale-controlled / timezone-controlled）均 `available`，**无 GAP**。

---

## 六、裁剪评审

**无裁剪**：`phases: [P1, P2, P3, P4, P5, P6, P7, P8]` = 全集，故不存在「跳过阶段理由是否充分」的判定项。逐阶段保留理由均成立且与风险匹配：

| 阶段 | 保留理由是否充分 |
|---|---|
| P1 | 不可裁（核心） |
| P2 | 充分。虽 `design_trivial: true` + `follows_existing_pattern`（可收敛为 1 候选），但属 UI 可见改动（`layout` + 四处主显文本变更）→ 需 P2 出 UI 设计节 + 承接 `6.4` 的两个耦合点（`TimeDisplay` 只透传 / `filter-tabs`+`expired-warning` 的 mock 恰好已合新形态，勿误改） |
| P3 | 充分。≥9 处主显断言 + 5 处 `FOUR_DIGIT_YEAR` + 3 处常量的反转/替换/删除必须经 TDD 红灯，否则就是「自改标准 + 自判通过」（本任务的性质正是判据反转，这条尤其必要） |
| P4 | 不可裁 |
| P5 | 充分，且**本轮强化**为「vitest 与 e2e 均须在 `TZ=UTC` 下全绿」 |
| P6 | 充分。UI 改动 → 四处渲染点 + tooltip 展开态截图 + vision 核对；e2e 判定同样须在 `TZ=UTC` 下跑 |
| P7 | 充分。跨「生产 1 文件 + 5 测试文件 + 2 文档」且性质是判据反转，「主显断言已删净 / tooltip 断言未误删」是主要风险面 |
| P8 | 充分。已发布行为变更 → CHANGELOG + upgrading + bump（patch/minor 由 P8 判，P1 不预定） |

`risk_level: low` 与实际匹配（纯前端渲染层、无 schema/无 API/无权限变更、`domains: [frontend]` 单域）。`ceremony: standard` 为默认档（非 thin，故不触发四要素 checklist；也非 full，故不触发「phases 必含 P7」审查——不过 P7 本就在列）。

---

## 七、审声明（风险分级 / 裁剪声明 vs diff 证据）

| 声明 | 证据 | 判定 |
|---|---|---|
| `risk_level: low` | 改动面为 `frontend-v3/src/composables/useRelativeTime.ts`（options 少两个字段）+ 5 个测试文件断言 + 2 个文档；无 schema/迁移/权限/API 形状变化 | 匹配 |
| `domains: [frontend]` | 后端仅「须保持全绿」不修改（`test_utc_serialization.py` 存在、20 用例）；MCP/CLI 零改动 | 匹配 |
| `packages: [frontend-v3, docs]` | 同上，无 `backend` / `packages/mcp-server` 包进改动面 | 匹配 |
| `phases` 含 P7 | `ceremony: standard` 非 `full`，无强制要求；P7 仍保留（多文件改动 + 判据反转） | 通过（超要求） |
| `design_trivial` / `follows_existing_pattern` | 结构不变、只调 options，`useRelativeTime.ts` 即模式 | 匹配 |
| `git diff --cached` | **空**（P1 尚未 commit，符合「phase = 本 commit 的产出阶段」语义） | 无冲突 |
| 工作树 | 12 个 untracked 全在 `agate-workspace/tasks/TPV0103-…/` 内；`frontend-v3/`、`backend/` 零改动 | 与本阶段声明一致 |

**「新增脚本登记面」实测要求不触发**：本任务不新增/改名 `agate/scripts/` 下任何文件（扫描 E 与 §10 均无该面）。故该项按机制不适用，不是「推理判不处理」。

---

## 八、P1 纯净性

- **未掺入解决方案设计（作者侧）**：P1 的 Given/When/Then 描述的是**用户可观测输出**（主显文本、tooltip 文本）与**判据如何判定**，未规定实现应如何写（`§3.1` 明文「判据不绑定实现——只要输出正确就相等」）。`§6.1.1` 给出的是 P3 的**断言替换契约**（改哪几行、改成什么判据），属判据反转任务不可避免的一层，且已在前几轮评审中被判为合理范围。
- **未混入实现细节越界**：主显 options 的「五字段」被写成**判据的构成**（参考格式化的字段集合），而非「实现必须照此写哪个 option 名」——`§8` 第 746 行对此有显式澄清（「请勿据本节旧表述反推 BDD-01 仍在用段数判实现」）。文中出现的 `timeZoneName` 取值（`short`/`long`/…）仅用于**实证取数**，`§5.2` 已改成语义表述（MINOR-04 上轮已闭）。
- **本轮新增内容未引入新的实现约束**：BLOCKER-C 的修法是**判据侧**的（模板不 pin 时区），不是实现侧的；MINOR-1/2 是数字与说明的精度修正。
- 无未决 `[NEED_CONFIRM]`：正文有 `[NO_NEED_CONFIRM]`（第 40 行），唯一的 `[SUGGEST:]`（第 462 行，ApiKey 两处不合并）带倾向与理由，属主 Agent 可自行采纳的非阻塞级。

---

## 九、非阻塞观察（2 条，均不要求返工、不改变 P3/P6 动作）

1. **§5.3 第 528 行「运行时改 `process.env.TZ` 无效」的适用域可以再收窄一句**。我实测：在 vitest 环境内（`environment: node`）运行时赋值 `process.env.TZ` 后 `resolvedOptions().timeZone` **确实不变**（`Asia/Shanghai` → 仍是 `Asia/Shanghai`），与 P1 结论一致；但在**裸 `node -e`** 里同样的赋值**会**生效（`TZ=UTC` 宿主赋值 `Asia/Shanghai` 后输出由 `09:43` 变 `17:43`）。即该结论是「测试环境内的真」而非「JS 引擎通例」。**不构成硬缺陷**：P1 给出的动作规则（「vitest 要固定时区只能在进程启动前由环境给定」）正是 vitest 场景下的正确规则，我已实测背书；读者据此采取的动作不会错。若 P3 顺手加一句「（在 vitest worker 内实测；裸 Node 进程内赋值会生效）」会更严密。
2. **§5.1 表内 `zh-CN + UTC + longOffset` 的 8 段与我实测的 7 段（五字段版）/8 段（含秒版）在口径上差一层**。我实测：`zh-CN`+`UTC` 下 `longOffset` 的**五字段**输出 `2026/11/10 GMT+00:00 09:43` 为 **7** 段、**含 second** 版为 **8** 段；表中 256 格口径写的是「`longOffset` → 7 段 × 256」。二者不矛盾（表列的是五字段口径），但该表与「含 `second` 恒 6 段」并置时容易被误读为「8 段不可能」。**不影响判据**：P1 已不再使用段数判定实现，段数只剩「参考值自检（== 5）」这一个用途，且该用途我实测在 32 locale 上 100% 稳定（全 5 段、无 `GMT`/`UTC`）。纯属表述可再加一句脚注。

> 两条均为**精度/表述**层，落点不在任何 BDD 的 Then 里，不产生返工，也不改变 P3/P6 的任何动作 → 按角色定义不升为 MINOR 返工项。放在这里供 P3/P4 顺手处理。

---

## 十、BLOCKER 清单

**0 条。**

前 3 轮的 BLOCKER 处置状态（本轮只核「是否被破坏」，不重新挑刺）：

| 轮次 | BLOCKER | 本轮复核 |
|---|---|---|
| retry 1（7 条） | 01/02/03/04/07 等 | **未被破坏**。BDD-01 判据类型、`sv-SE` 对照、BDD-04 是 `hour12` 唯一守护点、BDD-07 能力边界声明、`FOUR_DIGIT_YEAR` 5 处判定均原样在位 |
| retry 2 | A（locale 轴） | **未被破坏**。FIX-A/FIX-B 三处代码块与实测表均在，且本轮我按字面复跑 5/5 全过 |
| retry 2 | B（段数命题） | **未被破坏**。§5.1 的 256 格分布与「段数不可作实现参数判据」的三条子论证（按取值/按时区/按 locale）均在位 |
| retry 3 | C（时区轴） | **本轮闭合**（见第一节，独立复跑三宿主全绿 + 判别力复验） |

**独立复验的支撑数字**（不采信自述）：

- 32 locale：主显 **5 段 × 32**、含 `second` **6 段 × 32** —— 与 P1 §5.1 一致
- `sv-SE`(`2026-11-10 09:43`) 与 `en-US`(`11/10/2026, 09:43 AM`) **互不相等** → BDD-01 ③ 的对照组选型成立（且 P1 已说明为何**不能**选 `zh-CN`/`ja-JP`——我实测二者均为 `2026/11/10 09:43`，确为相等）
- `hour12: false` 逃逸集合 = `{zh-CN, de-DE, ja-JP, sv-SE}`，仅 `en-US` 可辨 → 第 311 行「4/5、仅 `en-US` 抓到」**表述正确，本轮未改动**
- 8/32 tooltip 漏判清单逐条复核一致
- 行号锚点抽验全部命中（e2e `248/257/258/266/267/290/361/381/394/401/410/425/426/432/438/915`；`time-display.spec:27/29/49/50/79`；`useRelativeTime.spec:39/40/54/55/84/93`；`filter-tabs.test.ts:77/78`；`expired-warning.test.ts:77/78`；`e2e:45/47` 常量声明）

---

## 十一、环境隔离确认

- 未触碰生产 `:8080`，未读写 `~/.peekview/`。`[PROD_NOT_TOUCHED]` / `prod_touched: false`。
- 未跑任何 `uvicorn` 直启、未 `pip install`、未启 backend。
- 我的探针只在 `.agate-tmp/review4/`（复用 analyst `r3/` 的 `impl.ts` + `final-acceptance.spec.ts` + config，`node_modules` 软链到 `frontend-v3/node_modules` 以避开 `~/.npm` 只读缓存），**收尾已 `rm -rf` 整目录删除**；analyst 自行留下的 `.agate-tmp/r3/` 等属其自述产物、已被 `.gitignore:105` 忽略，不在删除授权内故保留。
- `frontend-v3/src/` 与 `backend/tests/` **零新增文件**；`git status --porcelain frontend-v3 backend` 为空。
- 收尾 `git status --porcelain` 共 12 行，全部是任务目录内的 untracked `.md`（含本文件），无仓内代码/测试改动，无 `git add`/`commit`/`checkout`/`stash`/`clean` 操作。

---

## 十二、结论

**status: approved**

判据：BLOCKER-C 已真闭合（模板去 `timeZone` 落地在三处可照抄代码块 + §6.1.1 #2 反转为禁令 + `TZ=UTC` 验收口径写进 BDD 正文与 P5/P6 裁剪表），我以真实 vitest 1.6.1 在 `UTC` / `America/New_York` / `Asia/Shanghai` 三宿主独立复跑**均 10 passed**，并单独验证了缺陷版在 `UTC`/纽约下必假 FAIL（判别力成立）；两个 MINOR 均闭合（8/32 三处同步并经我重算、§8 已改两项增量表且修法说明正确）；12 条 BDD 编号与主题结构、反转方向、决策 D1、BDD-04 的唯一守护点地位、第 311 行的 `4/5` 表述、A/B 判据写法、frontmatter 全部完好。

P1 retry 3/3 预算用尽背景下，本条线**已具备进入 P2 的条件**：需求把「做什么」（主显去偏移去秒、tooltip 全保留）与「怎么判」（对齐同源参考输出、两条轴同源、`TZ=UTC` 为验收宿主）都定到了 P3/P6 可机械执行的程度。建议 P2 承接 §6.4 的两个耦合点，P3 优先建立 `hour12:false` 的 BDD-04 红灯（BDD-01 对此只有 1/5 判别力）。
