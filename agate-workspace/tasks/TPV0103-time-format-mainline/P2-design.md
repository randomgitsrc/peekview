---
phase: P2
task_id: TPV0103
type: design
parent: P1-requirements.md
trace_id: TPV0103-P2-20261111
status: draft
created: '2026-11-11'
agent: architect
candidate_count: 1
packages:
- frontend-v3
- docs
domains:
- frontend
ui_affected: true
ui_design_section: true
design_trivial: true
follows_existing_pattern:
- frontend-v3/src/composables/useRelativeTime.ts
ui_design:
  shape: layout
  dimensions:
    布局:
      status: covered
    交互:
      status: covered
    视觉:
      status: covered
dispatch_plan:
  mode: single
  parallel_limit: 1
prod_touched: false
---

# P2 方案设计 — 时间主显格式修正（去时区偏移 + 去秒）

> **本文件的性质**：不是探索方案，而是把 P1 已锁死的结论（`design_trivial: true` + `follows_existing_pattern`）写成可执行、可判定、可机械验收的设计。生产代码改动面只有 1 处 3 行；本文件的重量落在**影响面边界**、**断言反转契约**、**gate 命令固化**与**UI 契约实测**上。
>
> **上游**：P0 `17d6c7bc` / P1 `bfec8d25`（12 条 BDD，四轮评审 approved）。
>
> **可复核性**：本文件所有「实测」数字均来自本轮真跑（探针在 `.agate-tmp/p2/`，收尾已删；真实 vitest 1.6.1 + 真实 playwright-core 1.60 + 真实 debug 站点 `:8888`）。凡引用 P1 数据处均标注来源节号，不重复劳动。

---

## 1. 影响面梳理（写于候选方案之前）

先定边界再定方案——本任务的风险不在「怎么改」，而在「改到哪为止」。

### 1.1 改什么（Modify）

#### 1.1.1 生产代码：1 文件 / 1 函数

| # | 文件:落点 | 改动 | 关联 BDD |
|---|---|---|---|
| M1 | `frontend-v3/src/composables/useRelativeTime.ts:3-10`（`FULL_DATE_OPTIONS` 常量） | 拆成两个常量：`MAIN_DATE_OPTIONS`（五字段，无 `second`）+ `TOOLTIP_DATE_OPTIONS = { ...MAIN_DATE_OPTIONS, second: '2-digit' }` | BDD-01 / BDD-02 |
| M2 | `frontend-v3/src/composables/useRelativeTime.ts:47-51`（`formatFullDate`） | 不再经 `formatOffsetDate`；改为 `date.toLocaleString(undefined, MAIN_DATE_OPTIONS)`——**不传 `timeZoneName`、不传 `second`、不加 `hour12`** | BDD-01 / BDD-02① / BDD-03 / BDD-04 / BDD-05 |
| M3 | `frontend-v3/src/composables/useRelativeTime.ts:17-19`（`formatOffsetDate`） | **签名与调用点不变**（仍只服务 tooltip），内部把 `FULL_DATE_OPTIONS` 换成 `TOOLTIP_DATE_OPTIONS`——纯常量改名，输出逐字符不变 | BDD-02② / BDD-06 |

> M3 是「为了 M1 拆常量」的连带项，**不是行为改动**：`TOOLTIP_DATE_OPTIONS` 的字段集合与现行 `FULL_DATE_OPTIONS` 完全相同（`year/month/day/hour/minute/second`），Options 键序对 `Intl` 无影响。本轮实测：改动后拼装形态的 `formatTooltip` 输出 `19h ago · 2026/11/10 GMT+00:00 09:43:00 · UTC`，与现行实现逐字符一致（§8 V4）。

#### 1.1.2 测试断言：5 个文件 / 19 个落点（P3 执行，P2 固化契约）

P1 §6.1 / §6.1.1 已给出逐行清单，本轮 grep 独立复核**逐条命中、0 偏差**（§8 V5）：

| 类别 | 处数 | 落点（本轮实 grep） | 处置 |
|---|---|---|---|
| 主显**偏移**断言 | 8 | `time-display.spec.ts:49`、`useRelativeTime.spec.ts:54`、`e2e:257`、`e2e:266`、`e2e:381`、`e2e:425`、`e2e:438`、`e2e:915` | 反转为「主显 === 同源参考文本」 |
| 主显**秒级**断言 | 1 | `e2e:401`（`toContain(expected)`，`expected` 由 `:387-397`/`:394` 现算 `HH:MM:SS`） | 反转为 `not.toContain(expected)`（保留原浏览器内现算） |
| 主显 **4 位年份**断言 | 5 | `time-display.spec.ts:50`、`useRelativeTime.spec.ts:55`、`e2e:258`、`e2e:267`、`e2e:426` | 替换为参考文本相等（P1 §6.1.1 五条逐条判定） |
| **常量声明** | 3 | `time-display.spec.ts:27`(`SHORT_OFFSET`)、`:29`(`FOUR_DIGIT_YEAR`)、`useRelativeTime.spec.ts:39`(`SHORT_OFFSET`)、`:40`(`FOUR_DIGIT_YEAR`)、`e2e:45`(`GMT_OFFSET`)、`e2e:47`(`FOUR_DIGIT_YEAR`) | 删除（`FULL_OFFSET` 三处声明保留） |
| **tooltip 断言** | 5 | `time-display.spec.ts:79`、`useRelativeTime.spec.ts:84`、`:93`、`e2e:290`、`e2e:432` | **保留不动**（BDD-06 / BDD-10③ 的守护点） |

> 常量声明行的实计数：`SHORT_OFFSET`/`GMT_OFFSET`/`FOUR_DIGIT_YEAR` 三类关键词在受影响三文件中**共 18 行命中**（`time-display.spec.ts` 4 + `useRelativeTime.spec.ts` 4 + e2e 10）。其中声明 6 行、使用 12 行——与上表「常量 3 处声明」的差异在于「同一常量名在本文件内既有声明又有使用」，计数口径不同，两处都对齐 P1 落点清单。

#### 1.1.3 文档：2 文件

| # | 文件 | 改动 | 关联 BDD |
|---|---|---|---|
| D1 | `CHANGELOG.md` 的 `[Unreleased]` | 新增一条「时间主显去掉时区偏移与秒」的变更条目 | BDD-11① |
| D2 | `docs/process/upgrading.md` | 新增一节 `## vX.Y.Z → vX.Y.Z`（版本号占位），正文明确「**悬停提示的偏移与时区名保持不变**」 | BDD-11② |

### 1.2 不改什么（Not Modify）

这一栏比「改什么」更容易被 implementer 顺手扩大——逐条给理由。

| # | 范围 | 为什么**不**改 |
|---|---|---|
| N1 | `formatTooltip` 的任何行为（秒 / 完整偏移 / IANA 名） | 这是本次「信息分层」的**配套保留物**，不是待删冗余。删它等于把缺陷修成另一个缺陷（BDD-02② / BDD-06 反向守护）。本轮实测其输出与现状逐字符一致（§8 V4） |
| N2 | `formatRelativeTime`（相对时间 `Nm ago` / `in Nh`） | 不在需求范围；与主显共用同一 composable 属巧合，BDD-09 只作回归守护 |
| N3 | `TimeDisplay.vue`（模板 / `visibility` 机制 / DOM 结构 / `data-testid`） | 它只透传 `absolute`/`full`，参数一改即全生效。改 DOM 会连带破坏 tooltip 可断言性（TPV0102 已付过代价：`opacity:0` 会被 `isVisible()` 判可见） |
| N4 | `useRelativeTime.ts:66-76` 的 **falsy 守卫** `if (dateStr.value)` | 空串 / `null` 走 `else` 直接置 `''`，**不调用**格式化函数。BDD-08②③ 据此判「渲染为空串」（据实描述现状）；改成显示 `—` 是另一次行为变更 |
| N5 | 后端 / API / MCP / CLI（含 `timefmt.py`、`createEntry.ts:118` 的 ISO 回显） | 机器读出口**需要**偏移，与「人读界面不要偏移」是同一条原则的两面。`backend/tests/test_utc_serialization.py` 是该声明的既有守护点——**只跑不改**（BDD-10⑤） |
| N6 | `filter-tabs.test.ts:77` / `expired-warning.test.ts:77` 的 `absolute: '2026-07-07 14:30'` 及其断言 | 两处是 `vi.mock` 提供的 `absolute` 值，**已合新形态**（无偏移、无秒）。P1 §6.4 明示：改它们是无谓改动 |
| N7 | `header-layout.test.ts:72-76`（TC-D02） | 只断言 `toBeTruthy()` + `typeof === 'string'`，新形态下仍绿，无需改 |
| N8 | `ApiKeySettingsTab.vue` / `ApiKeyListView.vue` 的本地 `formatRelativeTime` | 只输出相对时间、不显示任何绝对时间，与主显格式无交集（P1 决策 D3：本轮不合并，另立任务） |
| N9 | `PublishResultPanel.vue:56` 的默认 `toLocaleString()` | 发布结果页的一次性确认信息，无偏移、无投诉；P1 §6.1 已 SUGGEST 另立任务 |
| N10 | `FULL_OFFSET` 常量及其 5 处 tooltip 断言 | tooltip 判据依赖，删掉会让 BDD-06 失去机器守护点（BDD-10③） |
| N11 | `frontend-v3/src/**` 与 `backend/tests/**` 下的任何 scratch 探针 | 环境隔离硬约束；P2 探针一律落 `.agate-tmp/p2/`（本文件所有实测均如此） |

### 1.3 风险在哪（Risk）

| # | 风险 | 触发条件 | 缓解措施（可执行） |
|---|---|---|---|
| R1 | **`TZ=UTC` 假 FAIL**（参考值 pin 了 `timeZone`） | 参考值模板写 `timeZone:'Asia/Shanghai'`，而实现不传 `timeZone` → CI runner（UTC）上 `09:43` vs `17:43` | 参考值模板**不出现 `timeZone`**；固定时区只能靠 `test.use({ timezoneId })`（e2e context 级）或**进程启动前**的 `TZ`（vitest）。**强制机制**：`gate_commands.P5_tz_utc` + `P5_e2e_tz_utc`（本机宿主是上海，「恰好同区」会让该错配在本地永不显形） |
| R2 | **`hour12` 守护点错位**（以为 BDD-01 抓得住） | 实现者顺手加 `hour12: false` | 实测确认 `hour12:false` 在 zh-CN/de-DE/ja-JP/sv-SE **4/5 locale 逃逸**，仅 `en-US` 可辨（§8 V6 独立复现）。守护点归 **BDD-04**（固定 `en-US` 正断言 `05:43 PM`）；BDD-01 只提供 1/5 判别力。P3 必须建 BDD-04 的红灯 |
| R3 | **既有断言静默假绿**（`FOUR_DIGIT_YEAR` 5 处） | 新形态 `11/10/2026` 命中 `/\d{4}/` → 断言恒真，覆盖静默丢失 | 5 处**全部替换**为参考文本相等（P1 §6.1.1 逐条判定，非保留非删除）。**强制机制**：`gate_commands.P5_fitness_dead_assertions`（关键词归零，exit code 可判） |
| R4 | **`zh-CN`/`ja-JP` 输出相同**导致对照无效 | BDD-01③ 用这两个 locale 做对照 | 实测二者五字段输出**均为** `2026/11/10 …`（相同）→ ③ 只能选 `sv-SE` vs `en-US`（本轮实测 `2026-11-10 09:43` ≠ `11/10/2026, 09:43 AM`）。设计把它写成 helper，避免 P3 手抄时改 locale 对 |
| R5 | **E2E 基于过期静态产物跑**（P4 改完 src 没重建） | `make debug-test` 的 Check 6 检测 `frontend-v3/src` 比 `backend/peekview/static/index.html` 新 → 直接 FATAL | 该陷阱**自带硬拦截**（本轮实测：`touch` 任一 src 文件后 `e2e-safety-check.sh --test-mtime` exit 1）。P4 改完必须 `make build-frontend-fast`（或 `make build-frontend`）。已写入 §9 完成标志 |
| R6 | **全量后端套件有 1 个预存失败**（与本任务无关） | `make test-quick` → `tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 失败：`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'` | 本轮实测：单跑该用例同样失败（**非竞态、非本任务引入**，1205 passed）。缓解：P5 的后端门禁取**定向命令** `tests/test_utc_serialization.py`（BDD-10⑤ 的实际守护点）；若主 Agent 要跑全量，按项目约定登记 `known-failures.md`（P5 阶段动作，不在本阶段） |
| R7 | **主显变短引发布局塌陷**（TPV0102 是「变长溢出」，本次是「变短」） | `flex` 容器元素收缩后出现新空隙/对齐偏移 | 已在真实站点四渲染点 × 两档 viewport × 两 locale 实测（§8 V7）：间距值集合改前改后**完全一致**、0 溢出、0 重叠。唯一量化变化是 en-US 卡片少一行、移动 tags-bar 高度跨 locale 收敛到 107px。详见 `## UI 设计` 的视觉契约 |
| R8 | **断言反转方向搞反**（把 tooltip 的偏移判据一并删掉） | 粗暴 `grep GMT` 批量删 | BDD-10 是**双向**判据：主显侧归零、tooltip 侧保留。**强制机制**：`P5_fitness_dead_assertions`（主显三类归零）+ `P5_fitness_tooltip_retained`（`FULL_OFFSET` ≥5 处）两条独立 key，各自 exit code |

> **架构适应度检查（判据三）**：本任务的架构约束是「主显断言只允许一种形态判据（= 同源参考文本相等），且 tooltip 的机器守护点不得丢失」。已落为 `P5_fitness_dead_assertions` + `P5_fitness_tooltip_retained` 两个独立 key（见 §5）。项目侧无其它适用于本改动的架构约束（无依赖方向 / 分层 / 循环依赖变化——改动在单个 composable 内部）。

---

## 2. 候选方案

> `candidate_count: 1`。依据 P1 frontmatter 的 `design_trivial: true` + `follows_existing_pattern: [frontend-v3/src/composables/useRelativeTime.ts]`——**结构不变，只调 options**。本节的重量因此放在「被排除的方向」上：单候选不等于不比较，而是**比较结果在 P1 四轮实测中已经收敛**。

### 2.1 候选方案 A（采用）：拆常量 + 主显走五字段直调

```ts
const MAIN_DATE_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
} as const

const TOOLTIP_DATE_OPTIONS = { ...MAIN_DATE_OPTIONS, second: '2-digit' } as const

function formatOffsetDate(date: Date, timeZoneName: 'shortOffset' | 'longOffset'): string {
  return date.toLocaleString(undefined, { ...TOOLTIP_DATE_OPTIONS, timeZoneName })
}

export function formatFullDate(dateStr: string): string {
  const date = parseDate(dateStr)
  if (!date) return '—'
  return date.toLocaleString(undefined, MAIN_DATE_OPTIONS)
}
```

- **优点**：① 主显路径**物理上不可能**再带 `timeZoneName`（不再经过带 `timeZoneName` 的函数）；② 两个常量各自被一处消费，语义自解释（谁带秒一眼可见）；③ 不动 `formatOffsetDate` 签名与 `formatTooltip` 任何一行，N1 边界由代码结构保证；④ 无效值降级 `—` 的分支逐字符不变（BDD-08）。
- **风险**：多一个常量名。若未来有人只改 `MAIN_DATE_OPTIONS` 而不动 `TOOLTIP_DATE_OPTIONS`，会让主显/tooltip 的日期部分**不同源**——但二者本来就**不必**同源（精度分工是需求，BDD-02），故这不是缺陷。
- **工作量**：3 行生产代码 + 常量拆分；TS 已验证 `as const` + spread 在 `--strict` 下编译通过（§8 V8）。

### 2.2 被排除的方向（不计入 `candidate_count`）

| 方向 | 为什么不选 |
|---|---|
| **B1：保留单一 `FULL_DATE_OPTIONS`，在 `formatFullDate` 里 `delete` 掉 `timeZoneName`/`second`** | `delete` 需要 `Record<string, unknown>` 类型逃逸，且「缺字段」是运行时状态而非类型契约；后续任何人把 `FULL_DATE_OPTIONS` 当完整形态用都会踩到被删字段的语义歧义。可读性与可判定性都劣于 A |
| **B2：给 `formatOffsetDate` 加第三个可选参数（如 `includeSecond?: boolean`）** | 「不传」变成「传一个假值」，主显的正确性依赖参数默认值；且函数名 `formatOffsetDate` 对主显路径本来就是误导（主显不输出 offset）。A 方案让主显根本不去碰这个名字 |
| **B3：给主显加 `hour12: false`（强制 24 小时制）** | P1 决策 D1 已否决，三条理由均可核验：与本次立论（本地习惯即正确语境）自相矛盾；会让同一界面出现两个口径（主显 24h / tooltip 跟随 locale）；用户原始质疑只针对 `GMT+8`。守护点 = BDD-04 |
| **B4：主显改用 `dateStyle`/`timeStyle` 组合（更简洁）** | 实测 `dateStyle`/`timeStyle` 与 `timeZoneName` 共存抛 `TypeError: Invalid option`（P1 §5.3 复测），且它会引入「短/中/长」这一层额外可变性，与「五字段参考文本相等」的判据形态不兼容。BDD-08 的兜底就是针对这条 |

### 2.3 权衡与选择理由

- **取舍的核心不在「少传哪两个字段」**（P1 已定），而在**「主显路径要不要继续经过 `formatOffsetDate`」**。选 A 即选「不经过」——这是 B1/B2 与 A 的唯一实质分叉。
- **选择 A 的理由**：本任务最大的现实风险（§1.3 R8/R2）是「后来者顺手改回去」。判据层面由 BDD-01 的逐字符相等挡住；**代码层面**则由「主显路径不经过带 `timeZoneName` 的函数」挡住。两层防护不同源、互不替代，A 是唯一同时给两层的形态。
- **B3 排除后的豁免声明**：`hour12` 在本设计中**完全不出现**，既不加 `true` 也不加 `false`。这不是遗漏——任何显式值都会覆盖 locale 的地区习惯，而 BDD-04 正是为「不加」立的锚。

---

## 3. 详细设计与实现契约

### 3.1 生产代码（P4 唯一改动面）

见 §2.1 代码块。约束：

1. **`formatFullDate` 的 options 只含五个数值字段**，不得出现 `second` / `timeZoneName` / `hour12` / `timeZone`。
2. **`formatOffsetDate` 签名不变**（`(date, timeZoneName)`），仅内部常量改名。
3. **无效值分支逐字符不变**：`parseDate` 返回 `null` → 返回 `—`。
4. 不加注释（项目铁律 9）。

### 3.2 参考值的两条轴必须与实现同源（**P3 必读，本任务的核心约束**）

实现的 locale 来源是 `toLocaleString` 首参**硬编码 `undefined`**（跟随运行时 locale），时区来源是 options **不含 `timeZone`**（跟随运行时时区）。因此参考值：

| 轴 | 实现来源 | 合法写法 | 错误写法及其后果 |
|---|---|---|---|
| locale | 运行时 locale | e2e：`page.evaluate` 内不传 locale（取 context locale）；vitest：`Intl.DateTimeFormat().resolvedOptions().locale` 取到后**显式传** | vitest 侧直写 `undefined` → 取 Node 进程 locale ≠ 目标 locale → 假 FAIL |
| timeZone | 运行时时区 | **模板里不写 `timeZone`**；要固定就固定 context（`test.use({timezoneId})`）或进程启动前的 `TZ` | 模板 pin `timeZone:'Asia/Shanghai'` → `TZ=UTC` 宿主上正确实现假 FAIL（§8 V3 实测 `equal=false`） |

**验收口径（P3/P5/P6 一致）**：`TZ=UTC` 下 vitest 与 e2e 均全绿；`TZ=Asia/Shanghai` 下的绿**不构成**有效证据（本机宿主恰为上海，同区巧合让该错配永不显形；且 `ci.yml` 不跑 vitest）。

### 3.3 断言反转契约（P3 逐落点执行）

#### 3.3.1 vitest（`useRelativeTime.spec.ts`）

```ts
const LOC = Intl.DateTimeFormat().resolvedOptions().locale      // 与 impl 的 undefined 同源
const MAIN_FIELDS = { year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit' } as const
const refMain = (iso: string) => new Date(iso).toLocaleString(LOC, MAIN_FIELDS)  // timeZone 不传
```

- `:52-56` 用例改名为「主显等于五字段参考文本」，断言 `expect(formatFullDate(KNOWN_UTC)).toBe(refMain(KNOWN_UTC))`；删除 `SHORT_OFFSET`(`:39`)、`FOUR_DIGIT_YEAR`(`:40`) 及其注释（`:19,38,52`）。
- `:84` / `:93` tooltip 的 `toMatch(FULL_OFFSET)` **保留**；`:37` `FULL_OFFSET` 声明保留。
- 文件头注释 `:12`（描述旧契约「`toLocaleString(…六字段, timeZoneName:'shortOffset')`」）改为新契约描述。

#### 3.3.2 vitest（`time-display.spec.ts`）

- `:49-50` 用例「主显文本含 GMT±N 与 4 位年份」→ 改为「主显等于五字段参考文本」，断言 `toBe(refMain(KNOWN_UTC))`（同样 `LOC` + 不传 `timeZone`）。
- 删 `SHORT_OFFSET`(`:27`)、`FOUR_DIGIT_YEAR`(`:29`)；保留 `FULL_OFFSET`(`:28`) 与 `:79`。

#### 3.3.3 e2e（`tpv0102-explore-card-list-ux.spec.ts`）

新增两个 spec 内 helper（放文件顶部常量区）：

```ts
const MAIN_FIELDS = { year:'numeric', month:'2-digit', day:'2-digit',
                      hour:'2-digit', minute:'2-digit' } as const

// FIX-A：参考值在与实现同一个浏览器 JS 环境内现算；locale 与 timeZone 均不传 → 同源
async function mainRef(page: Page, createdAt: string): Promise<string> {
  return page.evaluate(
    ([iso, five]) => new Date(iso).toLocaleString(undefined, five),
    [createdAt, MAIN_FIELDS] as [string, typeof MAIN_FIELDS],
  )
}

// BDD-01③：参考值对 locale 敏感（证明期望值不是 locale 无关常量）
async function assertLocaleSensitive(page: Page, createdAt: string): Promise<void> {
  const differs = await page.evaluate(
    ([iso, five]) => {
      const d = new Date(iso)
      return d.toLocaleString('sv-SE', five) !== d.toLocaleString('en-US', five)
    },
    [createdAt, MAIN_FIELDS] as [string, typeof MAIN_FIELDS],
  )
  expect(differs).toBe(true)
}
```

逐落点：

| 落点 | 现状 | 改为 |
|---|---|---|
| `:257-258`（卡片） | `toMatch(GMT_OFFSET)` + `toMatch(FOUR_DIGIT_YEAR)` | `expect(cardText).toBe(await mainRef(page, iso))` + `assertLocaleSensitive`；`:259` 的 `not.toMatch(/ago\|just now/)` 保留。`iso` 取自该 entry 的 API（同 `:379-384` 的既有取法：`createEntry` 返回的 slug → `getEntryJson`） |
| `:266-267`（列表行） | 同上 | 同上（同一 entry，同一次 `mainRef`） |
| `:381`（BDD-04 describe，已固定 `zh-CN`/`Asia/Shanghai`） | `toContain('GMT+8')` | `expect(mainText).toBe(await mainRef(page, iso))`；并保留一条 **locale 固定下**合法的补充断言 `expect(mainText).not.toMatch(/GMT\|UTC/)`（仅在本 describe 的 `zh-CN` 前提下有效，P1 §5.2 已确立该限制） |
| `:387-397` / `:394` + `:401` | 浏览器内现算 `HH:MM:SS` 后 `toContain(expected)` | **保留** `:387-397` 的现算（它算的是「秒级形态」这一事实，与 locale/时区已固定一致），把 `:401` 反转为 `expect(mainText).not.toContain(expected)`（BDD-02①：主显无秒） |
| `:425-426`（详情页） | `toMatch(GMT_OFFSET)` + `toMatch(FOUR_DIGIT_YEAR)` | 同 `:257`（`mainRef` + `assertLocaleSensitive`） |
| `:438`（详情页内复查列表侧） | `toMatch(GMT_OFFSET)` | 与详情页同 entry，`expect(listText).toBe(await mainRef(page, iso))` |
| `:915`（BDD-26 seed 循环） | `for (text of timeTexts) toMatch(GMT_OFFSET)` | 改为**按卡片**迭代：对每张卡取其 `a.card-title` 的 `href` → slug → `getEntryJson` 取 `created_at` → `expect(cardMainText).toBe(await mainRef(page, iso))`；最多前 5 张（控制运行时长）。`not.toMatch(/ago\|just now/)` 保留 |
| `:45` / `:47` | `GMT_OFFSET` / `FOUR_DIGIT_YEAR` 声明 | 删除；`FULL_OFFSET`(`:46`) 保留 |

> **`e2e:248` / `e2e:410` 两个 describe 既无 `locale` 也无 `timezoneId`**（P1 §6.1.1 表）：参考值由 `mainRef` 在**同一 context** 内现算，因此跟随 runner 时区，`TZ=UTC` 下两侧同为 `09:43`。**绝不可**给 `MAIN_FIELDS` 补 `timeZone`（§1.3 R1）。

### 3.4 文档改动契约

- `CHANGELOG.md`：`[Unreleased]` 下新增 `### 变更` 条目，一句话说明主显去偏移去秒 + tooltip 不变。
- `docs/process/upgrading.md`：顶部（`## v0.26.1 → v0.27.0` 节之上）插入新节，标题用项目既有格式 `## vX.Y.Z → vX.Y.Z`（占位可），正文必须含「悬停提示的偏移与时区名**保持不变**」（BDD-11②）。版本号确切值留 P8。

---

## 4. 测试与验证策略（P3 / P5 / P6 分工）

| 阶段 | 做什么 | 判据 |
|---|---|---|
| P3 | 按 §3.3 逐落点改断言（先于实现）→ 跑 `gate_commands.P3`，确认 **2 spec 文件红**（impl 仍带 offset/秒） | 红灯必须来自断言失败（classic red-light），不是 import/syntax 错 |
| P3 | 优先建 **BDD-04**（`hour12`）红灯 | 它对「顺手加 `hour12:false`」有 5/5 判别力；BDD-01 只有 1/5 |
| P5 | 实现后跑 §5 全部 key，**`TZ=UTC` 的两个 key 是验收口径** | 全部 exit 0 |
| P6 | 四处渲染点 + tooltip 展开态截图；BDD 逐条二值判定 | 见 `## UI 设计` 的视觉契约 |

**P3 的 BDD → 测试落点映射**（供 test-designer 直接取用）：

| BDD | 层 | 落点 |
|---|---|---|
| 01 | vitest + e2e | `useRelativeTime.spec.ts:52`（单 locale 相等）、`time-display.spec.ts:49`、e2e `:257/:266/:425`（5 locale 参数化由 e2e 的 `test.use({locale})` 承担） |
| 02 | vitest + e2e | 主显 `not.toContain('17:43:00')`（e2e `:401` 反转）；tooltip `toContain('17:43:00')` 新增一条（zh-CN + Asia/Shanghai 下） |
| 03 | vitest | 固定 `zh-CN`+`Asia/Shanghai` 的绝对形态 —— **vitest 无法固定 locale/时区**（Intl 缓存）→ 落到 e2e 的 `BDD-04` describe，断言 `toBe('2026/11/10 17:43')` |
| 04 | e2e | `:361` describe 内新增：主显匹配 `^11\/10\/2026, 05:43[\s\u202f]PM$`，且 `not.toBe('11/10/2026, 17:43')` |
| 05 | e2e | 四处 `mainRef` 相等 + 两两相等（`:257/:266/:425` + 移动端 `meta-tags-bar`） |
| 06 | vitest + e2e | tooltip 三段：`parts.length === 3`、`parts[1]` 匹配 `GMT[+-]\d{2}:\d{2}`、`parts[2] === resolvedOptions().timeZone`（原有 5 处保留即可覆盖） |
| 07 | vitest | 段序列子序列关系（4 locale 用 vitest 的 `formatFullDate`/`formatTooltip` 各算一次；同源自动成立） |
| 08 | vitest | 三类无效输入：`'not-a-date'` → `—`/`Invalid date`；`''`/`null` → 均 `''`；全部 `not.toContain('NaN')` |
| 09 | vitest | 三档相对时间（保留现有用例） |
| 10 | 静态审计 | `P5_fitness_dead_assertions` + `P5_fitness_tooltip_retained` + `P5_backend`（⑤） |
| 11 | 文档 | 人工/脚本核对 CHANGELOG + upgrading 标题格式与语义 |
| 12 | e2e | `bdd26` 改后（按卡片取 API `created_at` 现算参考）+ 非空卡片数 > 1 |

---

## 5. gate_commands（P3/P5/P6 固化，后续不得修改）

gate_commands:
  P3: "make test-frontend"
  P3_formatter: "vitest.sh"
  P5: "make test-frontend"
  P5_tz_utc: "TZ=UTC make test-frontend"
  P5_e2e: "E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test"
  P5_e2e_tz_utc: "TZ=UTC E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test"
  P5_backend: "bash -c 'cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short'"
  P5_fitness_dead_assertions: "bash -c 'set -o pipefail; test 0 -eq $(grep -rho -e SHORT_OFFSET -e GMT_OFFSET -e FOUR_DIGIT_YEAR frontend-v3/src frontend-v3/e2e | wc -l)'"
  P5_fitness_tooltip_retained: "bash -c 'set -o pipefail; test 5 -le $(grep -rho -e FULL_OFFSET frontend-v3/src frontend-v3/e2e | wc -l)'"
  P5_lint: "make lint"
  P5_typecheck: "make typecheck"
  P5_docs: "make check-docs"
  P5_timeout_seconds: 120
  P5_tz_utc_timeout_seconds: 120
  P5_e2e_timeout_seconds: 900
  P5_e2e_tz_utc_timeout_seconds: 900
  P5_backend_timeout_seconds: 120
  P5_fitness_dead_assertions_timeout_seconds: 60
  P5_fitness_tooltip_retained_timeout_seconds: 60
  P5_lint_timeout_seconds: 60
  P5_typecheck_timeout_seconds: 120
  P5_docs_timeout_seconds: 60
  project_module: "src/"
**声明要点**：

- **`P3` 用 `make test-frontend`**（vitest 全量非 watch）。TDD 红灯必须来自断言失败；`P3_formatter: vitest.sh` 让 `check-tdd-red.py` 拿到结构化 JSON（否则退化为 exit-code-only）。
- **`P5` 与 `P5_tz_utc` 是同一命令的两种宿主环境**：后者是 P1 §3.1 写死的验收口径。**本机宿主是 `Asia/Shanghai`，只有 `TZ=UTC` 那次能证明判据可移植**（`ci.yml` 不跑 vitest，本地绿不构成证据）。
- **`P5_e2e` 必须定向 `E2E_SPEC=`**：裸调 `make debug-test` 只跑 `e2e/debug-server.spec.ts` 一个 spec（`run-e2e-tests.sh:78` 的 `${E2E_SPEC:-e2e/debug-server.spec.ts}`），是本任务最大的假绿陷阱。本轮实测定向后为 `Total: 64 tests in 1 file`（`npx playwright test --list`），全跑 **61 passed / 3 skipped / exit 0**。
- **`P5_e2e_tz_utc`**：P1 §9 要求「e2e 判定同样须在 `TZ=UTC` 下跑一次」。本轮实测 `TZ=UTC E2E_SPEC=… make debug-test` → exit 0。该 key 与 `P5_tz_utc` 构成时区轴的**双覆盖**（单元 + 端到端）。
- **`P5_backend`**：BDD-10⑤ 的定向门禁（`tests/test_utc_serialization.py`，20 用例）。**不用 `make test-quick`**——本轮实测全量后端有 1 个与本任务无关的预存失败（§1.3 R6），单跑同样复现，属环境性已知失败，不应让它冒充本任务的红灯。
- **架构适应度（判据三）**：`P5_fitness_dead_assertions`（主显三类常量关键词归零，exit 1 = 仍有残留）+ `P5_fitness_tooltip_retained`（`FULL_OFFSET` 命中 ≥5 处，守护 tooltip 判据不被误删）。两条独立 key，**不串在 `&&` 链里**。
- **无 `P3_xxx` 检测键**（`check-tdd-red.py` 只收精确 `P3`）。`P3_formatter` 属元键白名单。
- **`project_module: "src/"`**：vitest 项目的 B 类 import 错误检测前缀。本任务改的是 `@/composables/useRelativeTime`（构建时解析到 `frontend-v3/src/…`），而 `import_errors[].module` 报的是**模块说明符**而非仓库相对路径，故前缀取 `src/`。
- **超时**：单元 120s（实测前端全量 24-36s）、E2E 900s（`> runner 内层 600s`；实测定向 e2e 40s，留足 CDP/重试余量）、构建类 600s（本任务无构建类 gate——`make build-frontend-fast` 是 P4 的**前置动作**而非 gate，见 §9）、lint/typecheck/docs 各 60-120s（实测 0.2s / 4.8s / 0.9s）。
- 每条命令都是**单条**，不含 `&&` 串联；需要切目录的用 `bash -c '…; …'`（分号，非短路链）。

---

## 6. files_to_read（P4 implementer 的上下文地图）

```yaml
files_to_read:
  - path: frontend-v3/src/composables/useRelativeTime.ts:1-30
    why: 唯一生产改动点——常量区（:3-10）与 formatOffsetDate（:17-19）
  - path: frontend-v3/src/composables/useRelativeTime.ts:47-59
    why: formatFullDate（:47-51 本次改）与 formatTooltip（:53-59 禁止改）
  - path: agate-workspace/tasks/TPV0103-time-format-mainline/P1-requirements.md
    why: §3.1 BDD-01「判定方法」的 FIX-A/FIX-B 代码块 + §6.1.1 五处 FOUR_DIGIT_YEAR 逐条判定——参考值两轴同源的唯一权威，勿凭本文复述转写
  - path: agate-workspace/tasks/TPV0103-time-format-mainline/P1-requirements.md
    why: §6.1 改动面清单（行号）与 §10 不改清单——P3/P4 的落点账本
  - path: frontend-v3/src/composables/__tests__/useRelativeTime.spec.ts:33-56
    why: SHORT_OFFSET/FOUR_DIGIT_YEAR 声明与主显用例（:52-56）的替换落点
  - path: frontend-v3/src/composables/__tests__/useRelativeTime.spec.ts:80-95
    why: tooltip 两处 FULL_OFFSET 断言——必须原样保留
  - path: frontend-v3/src/components/__tests__/time-display.spec.ts:24-52
    why: 主显断言（:49-50）与三类常量声明（:27-29）的替换/删除落点
  - path: frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts:40-50
    why: 常量声明区（:45 GMT_OFFSET / :47 FOUR_DIGIT_YEAR 删，:46 FULL_OFFSET 留）+ 新 helper 插入位置
  - path: frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts:245-300
    why: 卡片/列表两处主显断言（:257-258 / :266-267）与 tooltip 保留项（:290）
  - path: frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts:357-407
    why: 固定 zh-CN/Asia/Shanghai 的 BDD-04 describe——:381 反转、:387-397 保留、:401 反转
  - path: frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts:410-440
    why: 详情页 describe——:425-426 替换、:432 保留、:438 替换
  - path: frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts:900-930
    why: BDD-26 seed 循环（:915）——改为按卡片取 API created_at 现算参考
  - path: frontend-v3/src/components/TimeDisplay.vue:1-15
    why: 确认「不改」的边界：只透传 absolute/full，DOM 与 testid 是断言锚点
```

**不列**（避免上下文爆炸）：`EntryCard.vue` / `EntryListRow.vue` / `EntryDetailHeader.vue` / `EntryMetaTagsBar.vue`（本任务不改，布局结论已在 `## UI 设计` 量化给出）；`backend/**`（零改动，只需跑 `P5_backend`）。

---

## 7. env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick（build-fast + debug-start + debug-seed，~20-60s）或 make debug-start + make debug-seed；站点 http://127.0.0.1:8888；数据目录 /tmp/peekview-debug/（含 peekview.db）；seed 用户 alice/bob/carol（密码 testpass123）"
  prod_env: "不在 agate 范围内；严禁触碰 :8080 与 ~/.peekview/"
  isolation_check: "① E2E 必须经 make debug-test（其 e2e-safety-check.sh 检查运行方式/服务在线/独立 DB/数据隔离）；② 收尾 git status --porcelain 只应有任务目录内的 .md 变更，frontend-v3/ 与 backend/ 零 scratch 文件；③ 状态标记二值 [PROD_NOT_TOUCHED]"
  static_freshness: "改 frontend-v3/src 后必须先 make build-frontend-fast（或 build-frontend）再跑 E2E——否则 e2e-safety-check.sh Check 6 直接 FATAL（实测 exit 1）。这不是建议，是硬拦截"
  probe_location: "/home/kity/oclab/peekview/.agate-tmp/p2/（本轮全部探针实际落点，收尾已删）；严禁在 frontend-v3/src/ 或 backend/tests/ 留探针。注意 vitest 默认 include 不扫 .agate-tmp/，故探针需自带 config 并把 node_modules 软链到 frontend-v3/node_modules"
  command_timeout: "所有 bash 命令外层必须 timeout（单元 120s / E2E 900s / 构建 600s）"
  tz_acceptance: "验收口径 = TZ=UTC 全绿；本机宿主 TZ=Asia/Shanghai，其绿不构成可移植性证据（ci.yml 不跑 vitest）"
  readonly_home: "本会话沙箱下 ~/.peekview/ 只读（Errno 30）——任何写该路径的测试（如 test_cli_remote.py::test_config_set_remote_api_key）在本环境必然失败，属环境性失败，不是本任务红灯（详见 §1.3 R6）"
```

> 边界提醒：以上是**声明性**字段，本身不被执行。真正有强制力的落点是 `gate_commands`（`P5_tz_utc` / `P5_e2e_tz_utc` / 两条 fitness key）与 `e2e-safety-check.sh` 的 Check 6。

---

## 8. minimal_validation

> **本方案依赖浏览器与 Node 的 ICU/Intl 行为**，不能声明「纯代码逻辑」。以下 8 项**均本轮真跑**（探针 `.agate-tmp/p2/`，收尾删除；未触碰 `:8080` 与 `~/.peekview/`）。

```yaml
minimal_validation:
  - id: V1
    assumption: "去 timeZoneName + 去 second 后，各 locale 的主显恒为 5 个数字段且不含 GMT/UTC"
    method: "真实 vitest 1.6.1（environment: jsdom，config 指向前端源码）在 TZ=UTC 下跑 zh-CN/en-US/sv-SE/de-DE/ja-JP 五字段格式化"
    result: confirmed
    note: "TZ=UTC：zh-CN 2026/11/10 09:43 / en-US 11/10/2026, 09:43 AM / sv-SE 2026-11-10 09:43 / de-DE 10.11.2026, 09:43 / ja-JP 2026/11/10 09:43，全部 5 段、0 命中 GMT|UTC"

  - id: V2
    assumption: "TZ=UTC 下 impl 与不 pin 时区的 ref 同源（P1 验收口径的核心）"
    method: "vitest 跑 ref = new Date(iso).toLocaleString(resolvedOptions().locale, MAIN_FIELDS)（不传 timeZone），与 impl 形态比对；再换 TZ=America/New_York / Asia/Shanghai 各跑一次"
    result: confirmed
    note: "TZ=UTC 09:43===09:43、New_York 04:43===04:43、Shanghai 17:43===17:43，三宿主 equal=true（7/7 用例全绿 × 3）"

  - id: V3
    assumption: "pin timeZone 的参考值在非上海宿主上会假 FAIL（即 P1 BLOCKER-C 的真实性）"
    method: "同一次运行内同时算 ref（不 pin）与 pinned（timeZone:'Asia/Shanghai'）"
    result: confirmed
    note: "TZ=UTC：ref=2026/11/10 09:43 vs pinned=17:43 → equal=false（假 FAIL 复现）；TZ=Asia/Shanghai：二者相等（正好同区，故本机不可见）；浏览器侧同结论"

  - id: V4
    assumption: "formatTooltip 在该改动下输出逐字符不变（三段 / 含秒 / 完整偏移 / IANA 名）"
    method: "直接 import 仓库源码 formatTooltip 跑 KNOWN_UTC"
    result: confirmed
    note: "输出 '19h ago · 2026/11/10 GMT+00:00 09:43:00 · UTC'（TZ=UTC）；parts.length===3、parts[1] 命中 GMT[+-]\\d{2}:\\d{2} 且含 \\d{2}:\\d{2}:\\d{2}、parts[2]===resolvedOptions().timeZone"

  - id: V5
    assumption: "既有主显断言的改动方向可以机械分类，且 P1 §6.1 的行号清单与仓库现状一致"
    method: "grep 三类常量关键词 + 逐落点核对，并用新形态字符串套用四类现存判据"
    result: confirmed
    note: "关键词 18 行命中（time-display.spec 4 / useRelativeTime.spec 4 / e2e 10），与 P1 清单逐条对齐、0 偏差。方向分类实测：GMT_OFFSET 在新形态下 5/5 locale 全 fail（**必红，需反转**）；FOUR_DIGIT_YEAR 在 5/5 locale 全 pass（**恒真死断言，需替换**）；notRelative 恒 pass（**保留**）；FULL_OFFSET 在 tooltip 上恒 pass（**保留**）"

  - id: V6
    assumption: "hour12:false 的守护点不在 BDD-01（仅 1/5 locale 可辨）"
    method: "真实 playwright-core 1.60 + 本地 Chromium，context 固定 Asia/Shanghai，5 locale 各比 correct 与 hour12:false"
    result: confirmed
    note: "逃逸 4/5（zh-CN/de-DE/ja-JP/sv-SE 输出与正确形态完全相同），仅 en-US 抓到（05:43 PM vs 17:43）——与 P1 数字一致，独立复现"

  - id: V7
    assumption: "主显文本变短不会在四处渲染点产生新空隙/错位/溢出"
    method: "真实 debug 站点 :8888（make debug-quick + seed），真实 Chromium，登录后逐个渲染点用 page.evaluate 把主显 textContent 换成新形态字符串，比对改前/改后的 getBoundingClientRect 度量（桌面 1280×800 / 移动 390×844 × zh-CN/en-US/sv-SE）"
    result: confirmed
    note: "四渲染点全部：scrollWidth<=clientWidth（0 溢出）、同行 gap>=4px（0 重叠）、间距值集合改前改后完全一致（卡片 4 / 列表行 11 / 详情 meta-row 4,8 / 移动 tags-bar 4,8）。主显宽度 zh-CN 178.7→114.4px（-36%）。唯二形态变化均向好：桌面 en-US 卡片 meta 行 2 行→1 行（43→19.5px）；移动 tags-bar en-US 99→107px（与 zh-CN/sv-SE 的 107 收敛）"

  - id: V8
    assumption: "候选方案的 TypeScript 写法在 --strict 下可通过（常量 spread + as const）"
    method: "npx tsc --noEmit --strict 编译候选实现片段"
    result: confirmed
    note: "exit 0，无错误"
```

**未做的验证及理由**：P2 不跑 `make debug-test` 作为「验证」（那是 P5 gate）；本轮为确认 `P5_e2e` 的定向命令有效性跑过一次基线（61 passed / 3 skipped / exit 0，见 §5），**不构成对新实现的验证**（此时生产代码尚未改）。

---

## 9. 实现完成的标志（供 P4/P5 判定）

- [ ] `useRelativeTime.ts` 的 `formatFullDate` 路径不含 `timeZoneName` / `second` / `hour12` / `timeZone` 任一字样（`grep` 该函数体为 0 命中）
- [ ] `formatTooltip` 与 `formatOffsetDate` 的**行为**逐字符不变（§8 V4 的形态仍成立）
- [ ] §3.3 的 19 个断言落点全部处理：8 反转为参考相等、1 反转为 `not.toContain`、5 替换、6 处常量声明删除（3 类）、5 处 tooltip 断言保留
- [ ] `P5_fitness_dead_assertions` exit 0（`SHORT_OFFSET|GMT_OFFSET|FOUR_DIGIT_YEAR` 在 `frontend-v3/{src,e2e}` 归零）
- [ ] `P5_fitness_tooltip_retained` exit 0（`FULL_OFFSET` ≥5 处）
- [ ] `TZ=UTC make test-frontend` 全绿（**验收口径**）
- [ ] `TZ=UTC E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` 全绿
- [ ] **改完 `src/` 后已跑 `make build-frontend-fast`**（否则 Check 6 会拦，见 §1.3 R5）
- [ ] `P5_backend` 全绿（`tests/test_utc_serialization.py` 20 用例）
- [ ] `make lint` / `make typecheck` / `make check-docs` 全绿
- [ ] `CHANGELOG.md` `[Unreleased]` 有条目；`docs/process/upgrading.md` 有新节且正文含「悬停提示的偏移与时区名保持不变」
- [ ] 收尾 `git status --porcelain` 无 `frontend-v3/` 与 `backend/` 下的 scratch 文件

---

## UI 设计

### 渲染形态声明（必填，与 P1 形态声明一致）

- 渲染形态: `layout`（布局型）——四渲染点均为常规流内布局（flex 元信息行），无 Canvas/WebGL/图表/模型等渲染组件，也无时序动效
- 适用维度: 布局结构 / 交互行为 / 视觉呈现

### 布局 checklist（布局结构维度）

- [x] **页面/组件层级结构已描述**：`EntryCard`（`.card-meta-text`）/ `EntryListRow`（`.entry-meta`）/ `EntryDetailHeader`（`.meta-row`）/ `EntryMetaTagsBar`（`.meta-tags-bar`）四个消费点共用 `TimeDisplay.vue`（`.time-display` > `.time-display__main` + `.time-display__tip`）。**本次不改层级**，改的是 `.time-display__main` 的文本内容
- [x] **关键区域占位关系已描述**：主显是元信息行内的**行内**元素，与 `@username` / `·` 分隔点 / `N files` 同行共处一个 `display:flex; flex-wrap:wrap; gap:4px` 容器（`EntryCard.vue:301-310`、`EntryDetailHeader.vue:198`、`EntryMetaTagsBar.vue:58`）。`TimeDisplay` 在卡片/列表行带 `flex-shrink:0`（`.meta-time`），故收缩压力落在分隔点/文本换行而非压缩时间文本
- [x] **桌面与移动两档 viewport 布局均说明**：1280×800 与 390×844 均实测（§8 V7），两档的 0 溢出/0 重叠结论一致；移动档唯一形态变化为 en-US tags-bar 高度 99→107px（向 zh-CN 收敛）

**本任务布局结论（可量化）**：

| 渲染点 | 条高（改前→改后） | 行数 | 间距值集合 | 溢出 |
|---|---|---|---|---|
| Explore 卡片（zh-CN） | 19.5 → 19.5px | 1 → 1 | {4} = {4} | 无 |
| Explore 卡片（en-US，桌面） | **43 → 19.5px** | **2 → 1** | {} → {4} | 无 |
| Explore 列表行（zh-CN/en-US） | 19.5 → 19.5px | 2 → 2 | {11} = {11} | 无 |
| 详情页 `.meta-row` | 26 → 26px | 1 → 1 | {4,8} = {4,8} | 无 |
| 移动 `meta-tags-bar`（zh-CN/sv-SE） | 107 → 107px | 3 → 3 | {4,8} = {4,8} | 无 |
| 移动 `meta-tags-bar`（en-US） | **99 → 107px** | 3 → 3 | {4,8} = {4,8} | 无 |

> en-US 移动档 +8px 的根因已定位：时间变短后 44×44 的 `visibility-menu-root` 从第 2 flex 行回到第 1 行，第 1 行行高由 18px 撑到 44px。这是**跨 locale 收敛**（zh-CN/sv-SE 改前改后都是 107px），不是新回归；行数、tag 行数、溢出、重叠四项均不变。

### 交互 checklist（交互行为维度）

- [x] **键盘可达性**：本次不改 DOM 与焦点顺序。tooltip 的 `:focus-within` 可见性机制（`TimeDisplay.vue:45-48`）不变——Tab 焦点进入 `.time-display` 时 tooltip 展开，回车不产生动作（时间文本非交互控件）
- [x] **输入态变化**：**无输入态用例**。时间主显由 `createdAt` prop 单向派生，无用户输入路径
- [x] **反馈（loading/error/empty/disable）**：③ 空/无效三态均有既有定义且本次不改——`'not-a-date'` → 主显 `—` / tooltip `Invalid date`；`''` / `null` → 两者均空串（falsy 守卫，`useRelativeTime.ts:67`）；无 loading/disable 态（时间不参与异步）
- [x] **输入态变化类用例**：本任务无此类用例，**无需人工复核**（对应 P6 输入态复核项：声明不适用）
- [ ] **手势/动作交互**：渲染组件型才适用 → **维度不适用**（布局型无旋转/缩放/拖拽语义）

### 视觉 checklist（视觉呈现维度）

> **视觉契约（单源定义）**：断言只收**可量化 DOM 度量**——宽度 / 高度 / 对齐 / 重叠 / 溢出五类，用 `getBoundingClientRect` / `scrollWidth` / `clientWidth` 采集。主观视觉（美观/协调/留白观感）不构成可断言契约，归 P6 截图人工复核。

- [x] **颜色/对比度**：本次**不改任何颜色**。主显沿用 `.card-meta-text` / `.meta-row` / `.meta-tags-bar` 的既有 `color: var(--c-text-tertiary|secondary)`；DOM 结构与 class 不变 → 对比度结论与 TPV0102 一致（W3C AA 由既有设计系统保证，本任务无增量）
- [x] **字体层级与间距节奏**：字号/字重/字体族全部不变（元信息行 `13px` / 详情 `var(--font-xs)` / `var(--font-mono)`）；**间距节奏实测不变**（上表「间距值集合」逐渲染点相等，均为设计 token：`--space-1 = 4px` 与列表行的 `gap: 11px` 实测值）
- [x] **组件一致性**：`TimeDisplay.vue` 的四消费点共用同一实现，四处主显文本由 BDD-05 逐点判定「两两相等」；本次无圆角/阴影/图标改动

**本次视觉契约（VC-N，P6 可照抄断言）**：

| 契约 | 可量化判据 | 实测（改后口径） |
|---|---|---|
| **VC-9（新增）** 四处渲染点元信息容器不横向溢出 | `container.scrollWidth <= container.clientWidth + 1` | 四渲染点 × 两 viewport × 两 locale：**全部通过** |
| **VC-10（新增）** 主显与相邻元信息**不重叠** | 同一 flex 行内相邻元素 `next.left - prev.right >= 4`（即 ≥ `--space-1`，0 负值） | 全部 `≥4`，无负值（0 重叠） |
| **VC-11（新增）** 主显变短后**不产生新空隙** | 容器内所有同行相邻间距的**取值集合**与改前**逐值相等** | 卡片 `{4}`、列表行 `{11}`、详情 `{4,8}`、移动 tags-bar `{4,8}`——四处集合改前改后完全相等 |
| **VC-12（新增）** 详情页 `meta-row` 高度不超两行 | `height <= lineHeight * 2 + 1` | 26px（1 行）→ 通过（既存 `vc07` 用例已覆盖，本次不改其判据） |
| **VC-1（沿用 TPV0102）** tooltip 不横向溢出 viewport | `box.x >= 0 && box.x + box.width <= viewport.width + 1` | **不受影响**（不改 tooltip 内容/结构/样式）；既存 `vc01` 用例保留 |
| **VC-3（沿用 TPV0102）** 卡片元信息行不因时间文本**变长**溢出 | `scrollWidth <= clientWidth + 1` | **方向相反**：本次是变短（zh-CN 178.7→114.4px），VC-3 的压力被解除；「变短的新风险」不冒充 VC-3，单列为上面的 VC-11。既存 `vc03` 用例保留 |

---

## 10. 状态标记

[PROD_NOT_TOUCHED]

- 未触碰生产 `:8080`；未读写 `~/.peekview/`（本会话沙箱下该路径只读，任何写入会被内核拒绝——见 §1.3 R6）。
- 本轮实测全部在 `/home/kity/oclab/peekview/.agate-tmp/p2/` 下的临时脚本中进行（`p2-probe.spec.ts` / `vitest.p2.config.mjs` / `fixa.mjs` / `fixa2.mjs` / `hour12.mjs` / `dirs.mjs` / `gaps2.mjs` / `tagsbar.mjs` / `tags_detail.mjs` / `tsprobe/a.ts` / `fmtest.md` / `gc-test.md` / `gc.yaml`，`node_modules` 为指向 `frontend-v3/node_modules` 的软链），**收尾整目录删除**；未在 `frontend-v3/src/` 或 `backend/tests/` 留下任何探针。
- 调试站点用 `make debug-quick`（`:8888`，数据目录 `/tmp/peekview-debug/`），收尾已 `make debug-stop`；未执行 `uvicorn` 直启、未执行任何 `pip install`。
- 工作树改动仅本任务目录内的 `.md` 文件（`git status --porcelain` 已核对）；`frontend-v3/` 与 `backend/` 零改动。
