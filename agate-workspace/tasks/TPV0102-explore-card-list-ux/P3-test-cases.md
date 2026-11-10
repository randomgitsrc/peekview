---
phase: P3
task_id: TPV0102
type: test-cases
parent: P2-design.md
trace_id: TPV0102-P3-20261110
status: draft
created: 2026-11-10
agent: test-designer
test_code_dir: backend/tests/ frontend-v3/src/ frontend-v3/e2e/ scripts/
bdd_count: 30
prod_touched: false
---

# P3 测试设计 — TPV0102：Explore 卡片/列表时间显示、可见性菜单与文件数显隐

> 上游输入：`P1-requirements.md`（**30 条 BDD**，`BDD-01`~`BDD-30`）、`P2-design.md`（§3 详细设计 / §6 测试策略 / §3.8 稳定测试标识 / §9 gate_commands）、`P2-review.md`（C-1~C-23）。
> 口径：**功能任务 TDD 真红灯**（`change_type` 缺省 = feature）。每条 BDD 至少一个用例，测试名引用 BDD 编号。

## 0. 测试代码目录声明（`test_code_dir`）

| 目录 | 内容 | 说明 |
|---|---|---|
| `backend/tests/` | `test_utc_serialization.py`（新增，文件名写死） | 后端序列化契约 BDD-07~11；`P5_fitness` 依赖本文件名 + `test_mixin_not_in_table_mro` 函数名 |
| `frontend-v3/src/composables/__tests__/` | `useRelativeTime.spec.ts`（新增） | 时间格式化纯函数契约 |
| `frontend-v3/src/utils/__tests__/` | `visibility-options.spec.ts` / `visibility-target.spec.ts`（均新增） | 可见性菜单两个纯函数 |
| `frontend-v3/src/components/__tests__/` | `time-display.spec.ts` / `visibility-menu.spec.ts` / `entry-card-file-count.spec.ts`（均新增） | 组件级交互与文件数三态 |
| `frontend-v3/src/stores/__tests__/` | `entry-list-visibility.spec.ts`（新增） | `setVisibility` store 契约 |
| `frontend-v3/e2e/` | `tpv0102-explore-card-list-ux.spec.ts`（新增，**文件名写死**） | UI 交互 BDD；`gate_commands.P5_e2e` 直接引用该路径 |
| `scripts/` | `audit-utc-semantics.py`（新增，一次性审计脚本，**不进 pytest 套件**） | BDD-12 的载体（理由见 §4） |

**新增文件共 10 个**，无对既有测试文件的修改（§6.4 的 11 项既有断言更新面属 **P4** 的实现连带改动，不归 P3 静默改——见 §7）。

## 1. 用例总览（30 条 BDD → 1:1 映射）

| BDD | 用例名（测试名引用 BDD 编号） | 载体 | 断言要点 |
|---|---|---|---|
| BDD-01 | `BDD-01: 主显为绝对时间且含 GMT±N` / `test_bdd_01_...` 见下 | vitest `useRelativeTime.spec.ts` + e2e `bdd01_*` | `formatFullDate` 输出匹配 `/GMT[+-]\d/` 且含 4 位年份、不匹配 `ago`/`just now` |
| BDD-02 | `BDD-02: tooltip 三段（相对+完整偏移+IANA 时区名）` | vitest `time-display.spec.ts` + `useRelativeTime.spec.ts` + e2e `bdd02_*` | tooltip `textContent` 含 ①相对时间 ②`GMT±HH:MM` ③IANA 名 == `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| BDD-03 | `bdd03_detail_and_mobile_meta_time_rules_match` | e2e（列表卡片 / 详情桌面头部 / 详情移动元信息条三处） | 三处主显均 `GMT±N`；三处悬停 tooltip 均含相对+绝对时间 |
| BDD-04 | `bdd04_shanghai_timezone_shows_plus8_wallclock` | e2e（`test.use({ locale:'zh-CN', timezoneId:'Asia/Shanghai' })`） | 含 `17:43:00` 与 `GMT+8`，不含 `09:43:00` |
| BDD-05 | `BDD-05: 无效时间值不产生 NaN` | vitest ×2 文件 + e2e `bdd05_*` | 任何时间文本不含 `NaN`；`formatFullDate` 无效 → `—`；`formatRelativeTime` 无效 → `''` |
| BDD-06 | `BDD-06: 未来时间的相对时间方向正确` | vitest `useRelativeTime.spec.ts` + e2e `bdd06_*` | 未来 24h → 匹配 `/^in \d+/`，非 `just now`，不含 `NaN` |
| BDD-07 | `test_bdd_07_all_leaf_models_json_datetime_ends_with_z` | pytest | 遍历「非 table 且不被任何 table 模型继承」的类 → 每 datetime 字段 `model_dump(mode="json")` 以 `Z` 结尾 |
| BDD-08 | `test_bdd_08_table_models_python_dump_still_datetime` | pytest | `Entry`/`User` 的 `model_dump()` 值 `isinstance(datetime)` 且 `str()` 不以 `Z` 结尾 |
| BDD-09 | `test_bdd_09_leaf_models_python_dump_still_datetime` | pytest | 叶模型 python 模式仍为 `datetime`（非 `str`） |
| BDD-10 | `test_bdd_10_remote_parsed_time_is_aware_utc` | pytest | `parse_iso("...Z")` → aware、`utcoffset()==timedelta(0)`；remote 客户端读到的时间为 aware UTC |
| BDD-11 | `test_bdd_11_cli_json_datetime_has_tz_marker` | pytest | CLI `create -j` / `list -j` / `get -j` 的每个非 null 时间值以 `Z` 或 `+00:00` 结尾 |
| BDD-12 | `bdd12_count_future_created_at`（脚本函数，非 pytest 用例） | `scripts/audit-utc-semantics.py` | debug DB 中 `created_at > 当前 UTC` 的行数为 0 |
| BDD-13 | `BDD-13: 1 文件 entry 不显示文件数` | vitest `entry-card-file-count.spec.ts` + e2e | 元信息区无 `/1 files?/` 匹配 |
| BDD-14 | `BDD-14: 0 文件 entry 不显示文件数` | vitest + e2e | 元信息区无 `/\d+ files?/` 匹配 |
| BDD-15 | `BDD-15: 3 文件 entry 显示 "3 files"` | vitest + e2e | 卡片与列表均出现 `3 files` |
| BDD-16 | `BDD-16: 菜单不包含当前可见性状态项` | vitest `visibility-options.spec.ts` + e2e | public 态 → `items` 无 `public`，含 `private` + Team 入口 |
| BDD-17 | `BDD-17: 无团队时菜单不渲染 Team 入口` | vitest + e2e（mock `listTeams` 返回空，**不**用请求失败构造） | `teams: []` → 无 team 入口 |
| BDD-18 | `BDD-18: Team 恒为子菜单且排除当前团队` | vitest + e2e | 子菜单不含 Team A、含 Team B；Team 入口项本身无 `onSelect` |
| BDD-19 | `BDD-19: 升 Public 需二次确认` | vitest `visibility-target.spec.ts` + `visibility-menu.spec.ts` + store + e2e | 确认前不发请求；payload `{is_public:true, team_id:null}`；确认后 `isPublic=true` 且 `team=null` |
| BDD-20 | `BDD-20: 降级可见性不弹二次确认` | vitest ×3 + e2e | `needsConfirm` 为 false；无 `.confirm-dialog`；`isPublic=false` |
| BDD-21 | `BDD-21: 切换失败状态保持原值并提示失败` | vitest store + `visibility-menu.spec.ts` + e2e | 失败后三字段完全回滚（`isPublic`/`teamId`/`team`）；出现失败提示 |
| BDD-22 | `BDD-22: 非 owner 三处无可见性菜单入口` | vitest `entry-card-file-count.spec.ts`（card/row 两处）+ e2e（三处） | `[data-testid="visibility-toggle"]` `count == 0`（非 `not.toBeVisible()`） |
| BDD-23 | `bdd23_detail_page_has_visibility_entry` | e2e（桌面头部 + 移动元信息条） | 两档 viewport 下 detail 页均出现 `visibility-toggle` |
| BDD-24 | `BDD-24: 请求进行中不可重复触发` | vitest store + `visibility-menu.spec.ts` + e2e | `inFlight` 期间第二次调用返回 `{ok:false}` 且不发第二个请求；`disabled` 时点击无事件 |
| BDD-25 | `bdd25_zero_file_entry_shows_dedicated_empty_state` | e2e | `empty-no-files` 可见且文本 ≠ `empty-select-file` 文本 |
| BDD-26 | `bdd26_seeded_explore_renders_new_rules` | e2e（seed 数据 + seed 用户登录） | >1 卡片；每卡时间含 `GMT±N` 且无 `ago`；`unicode-filenames`/`multi-format-demo` 显示 `N files`，`yaml-docker-compose` 不显示 |
| BDD-27 | `BDD-27: Private → Team A` | vitest `visibility-target.spec.ts` + e2e | payload `{team_id:'proj-a'}`；结果 `isPublic=false` 且 `team.slug === 'proj-a'` |
| BDD-28 | `BDD-28: Team A → Team B` | vitest + e2e | payload `{team_id:'<B>'}`；`team.slug === B` 且无确认框 |
| BDD-29 | `BDD-29: Team A → Private` | vitest + e2e | payload `{is_public:false, team_id:null}`；`isPublic=false` 且 `team === null` |
| BDD-30 | `BDD-30: Escape 关闭菜单且焦点回触发入口` | vitest `visibility-menu.spec.ts` + e2e | 菜单项不可见 + `document.activeElement` == 触发按钮 |

**覆盖自查**：`01..30` 全部有对应用例，无遗漏、无「挑验」。

## 2. 后端 pytest 设计（`backend/tests/test_utc_serialization.py`）

### 2.1 红灯形态（**预期 B 类**，非 A 类假红）

模块顶部 `from peekview.timefmt import parse_iso, utc_iso_z` + `from peekview.models import UtcSerializeMixin` —— 二者**均尚不存在**（P2 §1.1 A1/A2 为新增），故当前为 **collection ImportError**，formatter 提取 `module` 命中 `peekview` 前缀 → `check-tdd-red.py` 判 **B 类红灯 exit 0**（P2 §8 V10 的 E 格已实测该形态）。

这是**有意设计**：BDD-07/08/09/10/11 的契约全部落在 `timefmt` + `UtcSerializeMixin` 上，P4 实现这两个符号前，模块 import 必失败。

### 2.2 用例表

| 用例 | BDD | 断言 | 为何当前必红 |
|---|---|---|---|
| `test_bdd_07_all_leaf_models_json_datetime_ends_with_z` | 07 | ①遍历 `peekview.models` 中 `inspect.isclass` 且 `issubclass(BaseModel)` 且 `__module__` 属于 `peekview.models` 的类；②排除 `table=True`；③排除被任何 `table=True` 模型继承的类（`cls in table_cls.__mro__`）；④只保留含 `datetime` / `datetime \| None` 字段的类；⑤`model_construct(**{字段: T0})` → `model_dump(mode="json")` → 每个 datetime 字段值 `endswith("Z")`；⑥命中类数 > 0（防空跑假绿） | `UtcSerializeMixin` 不存在 → 叶模型尚未挂 serializer → 值无 `Z` |
| `test_bdd_07_leaf_scan_is_not_vacuous` | 07 | 遍历命中类数 ≥ 10 且字段总数 ≥ 20（下限保护，**不**硬编码 15/31；P2 §R6 已定遍历口径为准，实测命中 16/34） | 同上 |
| `test_bdd_07_response_model_classes_covered` | 07 | 扫 `peekview/api/*.py` 的 `response_model=(\w+)` 指名类（正则读文件），对其含 datetime 字段的类断言其在 §①的覆盖集合内 | 覆盖集合为空（mixin 未落地）→ 断言失败 |
| `test_bdd_08_table_models_python_dump_still_datetime` | 08 | `Entry` / `User` 的 `model_construct` + `model_dump()`（python 模式）：`created_at`/`updated_at`/`expires_at`/`archived_at`/`archive_delete_at`（`User` 为 `disabled_at`）逐一 `isinstance(v, datetime)` 且 `not str(v).endswith("Z")` | 需 `UtcSerializeMixin` 存在（import）；且断言本身反向保护「mixin 不得污染表模型」 |
| `test_bdd_08_mixin_not_in_table_mro` | 08 / 适应度 | 遍历 `table=True` 模型，断言 `UtcSerializeMixin not in cls.__mro__`；且断言至少有一个叶模型**确实**继承了 mixin（防空跑） | `UtcSerializeMixin` 不存在 |
| `test_mixin_not_in_table_mro` | 适应度（P2 §9 `P5_fitness`） | 同上断言的**独立函数**（`-k mixin_not_in_table_mro` 定向跑）——**函数名写死不可改** | 同上 |
| `test_bdd_09_leaf_models_python_dump_still_datetime` | 09 | `EntryResponse.model_construct(...)` → `model_dump()`：`created_at`/`updated_at`/`expires_at` 均为 `datetime`，非 `str` | 同上 |
| `test_bdd_10_remote_parsed_time_is_aware_utc` | 10 | `parse_iso("2026-11-10T09:43:00Z")` → `tzinfo is not None` 且 `utcoffset() == timedelta(0)`、`year/month/day/hour == 2026/11/10/9`；`parse_iso("2026-11-10T09:43:00+00:00")` 同值；remote 客户端 `_parse_dt` 语义（以 `parse_iso` 为准）对带 `Z` 字符串不抛异常 | `peekview.timefmt` 不存在 |
| `test_bdd_10_z_suffix_parity_with_offset` | 10 | `parse_iso("...Z") == parse_iso("...+00:00")`（`Z` 与 `+00:00` 等值解析） | 同上 |
| `test_bdd_11_utc_iso_z_contract` | 11 | `utc_iso_z(None) is None`；naive `datetime(2026,11,10,9,43)` → `"2026-11-10T09:43:00Z"`；aware `+08:00` 同一时刻 → 同一 `Z` 字符串（时区归一）；`utc_iso_z` 对非 UTC aware 值不得产出 `+08:00` 后缀 | `peekview.timefmt` 不存在 |
| `test_bdd_11_cli_json_datetime_has_tz_marker` | 11 | `CliRunner` 跑 `create -s ... --slug ... -j`、`list -j`、`get <slug> -j`；从输出中提取 JSON（**从第一个 `{` 起**——`jieba` 会向 stdout 打初始化噪声，实测）；断言每个非 null 时间值 `endswith("Z")` 或 `endswith("+00:00")` | 当前 CLI 输出 `"2026-11-10T12:00:13.017700"`（naive，无时区标记，**已实测**）→ 断言失败 |

> **BDD-07 不硬编码 15/31**：按 P2 §R6 与 C-23④，遍历口径为准，实测命中 **16 类 / 34 字段**（P1 附录的 15/31 未含经继承命中的 `ShareCreateResponse`）。用例只断言「类数 > 0」与「每个字段带 Z」，**不断言具体数字**；`test_bdd_07_leaf_scan_is_not_vacuous` 的下限（≥10 类 / ≥20 字段）只是防空跑，不是清单。

### 2.3 BDD-12 为何不是 pytest 用例（P2 §6.1 约束 3，强制）

`backend/tests/conftest.py` 的 `isolate_config_file` 是 `autouse=True`，每个测试都把 `PEEKVIEW_STORAGE__DB_PATH` 指向 `tmp_path` —— 在此 DB 上统计「未来 `created_at` 行数」**必然 0**，是恒绿假象。

BDD-12 的载体改为一次性审计脚本 `scripts/audit-utc-semantics.py`：

- 入口函数 `bdd12_count_future_created_at(db_path) -> int`；CLI 用法 `python3 scripts/audit-utc-semantics.py --db <debug db>`
- 默认 DB 路径**运行时拼接**（`os.sep, "tmp", "peekview-debug", "peekview.db"`），不写字面量（平台假设 R4）
- 排除天然未来列（`expires_at` / `archive_delete_at`），只比 `created_at`
- exit 0 = 计数 0；exit 1 = 有异常行（打印明细）
- **不进 pytest 套件**（文件名不以 `test_` 开头，`python_files = ["test_*.py", "*_test.py"]` 不收集）
- P5 对 debug DB（`127.0.0.1:8888` 数据目录）实跑并留输出证据

## 3. 前端单测设计（vitest）

### 3.1 `src/composables/__tests__/useRelativeTime.spec.ts`

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-01: formatFullDate 主显含 GMT±N 与 4 位年份` | 01 | `formatFullDate('2026-11-10T09:43:00Z')` 匹配 `/GMT[+-]\d/` 与 `/\d{4}/`，且不匹配 `/ago|just now/`；**不硬编码 `GMT+8`**（BDD-01 不限定 locale/时区） |
| `BDD-01: formatFullDate 使用 shortOffset 且禁止 dateStyle/timeStyle` | 01 | 以 `vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')`/包装 `toLocaleString` 捕获 options：`timeZoneName === 'shortOffset'`，且 `dateStyle`/`timeStyle` 均未出现（二者与 `timeZoneName` 共存会 `TypeError`） |
| `BDD-02: formatTooltip 三段结构` | 02 | 返回串按 `' · '` 分隔为 3 段：段 1 匹配相对时间；段 2 匹配 `/GMT[+-]\d{2}:\d{2}/`（**longOffset 完整偏移**）；段 3 === `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `BDD-05: formatRelativeTime 无效值返回空串` | 05 | `formatRelativeTime('not-a-date')` === `''`、`formatFullDate('not-a-date')` === `'—'`、`formatTooltip('not-a-date')` === `'Invalid date'`；三者均不含 `NaN` |
| `BDD-06: 未来时间方向正确` | 06 | `formatRelativeTime(未来 +24h)` 匹配 `/^in \d+[mhdw]|^in \d+mo|^in \d+y/`（即 `/^in /`），不等于 `just now`，不含 `NaN`；未来 90 分钟 → `/^in 1h$/` 或 `/^in \d+h$/`（方向与量级） |
| `BDD-06: 过去时间仍为 ago 形态` | 06 | 过去 2 小时 → `/^2h ago$/`（方向对照，防"改成 in 就全绿"） |
| `BDD-02: useRelativeTime 返回 absolute 字段` | 02 | `useRelativeTime(ref(str))` 返回对象含 `relative`/`full`/`absolute` 三个 ref；`absolute.value === formatFullDate(str)` |

> `useRelativeTime` 用 `onMounted` 起 60s 定时器 → 用 `vi.useFakeTimers()` + 挂载一个宿主组件（`defineComponent`）或直接测三个**纯函数**（`formatRelativeTime`/`formatFullDate`/`formatTooltip`）+ 一个 `absolute` 字段断言（后者用 `mount` 的宿主组件，`afterEach` 里 `vi.useRealTimers()`）。

### 3.2 `src/components/__tests__/time-display.spec.ts`

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-01: TimeDisplay 根节点带 data-testid="time-display"` | 01 | `wrapper.find('[data-testid="time-display"]').exists()`；主显文本匹配 `/GMT[+-]\d/` 且 `/\d{4}/` |
| `BDD-01: 根节点主显不含相对时间` | 01 | `[data-testid="time-display"]` 的直接文本不匹配 `/ago|just now/` |
| `BDD-02: tooltip 为真实 DOM 元素且 role="tooltip"` | 02 | `wrapper.find('[data-testid="time-tooltip"]').attributes('role') === 'tooltip'`；tooltip 节点存在（非 `title` 属性、非 CSS `::after`） |
| `BDD-02: tooltip 文本三段可读` | 02 | tooltip `textContent` 含相对时间 / `GMT±HH:MM` / 当前 IANA 时区名 三段 |
| `BDD-02: tooltip 默认隐藏用 visibility 而非 opacity` | 02 | tooltip 的存在性与隐藏方式：挂载后 `wrapper.find('[data-testid="time-tooltip"]').attributes('style')` 或其类名不含 `opacity: 0`（`opacity:0` 在 Playwright 下 `isVisible()` 仍 true，见 P2 §8 V6）——单测层只断言 DOM 存在 + 不依赖 `title` 属性 |
| `BDD-05: 无效时间不产生 NaN` | 05 | `mount(TimeDisplay, { props: { dateStr: 'not-a-date' } })` 的 `wrapper.text()` 不含 `NaN` |

### 3.3 `src/utils/__tests__/visibility-options.spec.ts`（BDD-16/17/18）

纯函数签名（P2 §3.5 / N-1 冻结）：

```ts
buildVisibilityOptions({ isPublic, currentTeamSlug, teams, teamsFailed? })
  -> { items: VisibilityTarget[], teamSubmenu: TeamOption[], teamsFailed: boolean }
```

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-16: public 态 items 不含 public，含 private 与 team 入口` | 16 | `{isPublic:true, currentTeamSlug:null, teams:[A]}` → `items` 的 kind 集合不含 `'public'`，含 `'private'`；`teamSubmenu` 非空（Team 入口存在） |
| `BDD-16: private 态 items 不含 private` | 16 | `{isPublic:false, currentTeamSlug:null}` → 不含 `'private'`，含 `'public'` |
| `BDD-16: team 态 items 同时含 public 与 private` | 16 | `{isPublic:false, currentTeamSlug:'a'}` → 含 `'public'` 与 `'private'`（三态判定口径 P2 §3.5 规则 5） |
| `BDD-17: teams 为空数组时无 Team 入口` | 17 | `{teams: []}` → `teamSubmenu` 为 `[]` 且 `items` 不含 `'team'`；`teamsFailed === false` |
| `BDD-18: 子菜单排除当前团队（按 slug）` | 18 | `{currentTeamSlug:'a', teams:[A,B]}` → `teamSubmenu` 的 slug 集合不含 `'a'`、含 `'b'` |
| `BDD-18: 找不到当前团队时不排除任何项` | 18 | `{currentTeamSlug:'ghost', teams:[A,B]}` → 子菜单含 A 与 B（P2 §3.5「找不到按无当前团队处理」） |
| `teamsFailed: Team 位不静默消失` | 17 / R11 | `{teams: [], teamsFailed: true}` → 返回值 `teamsFailed === true`（供组件渲染禁用项）；`{teamsFailed: true, teams:[A]}` 时 `items` 仍含 `'team'` 入口 |

### 3.4 `src/utils/__tests__/visibility-target.spec.ts`（BDD-19/20/27/28/29）

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-19: public 的 payload 两字段同传` | 19 | `toPatchPayload({kind:'public'})` 深等于 `{is_public:true, team_id:null}`（**两字段都必须出现**，P2 §3.5） |
| `BDD-19: public 需要二次确认` | 19 | `needsConfirm({kind:'public'}) === true` |
| `BDD-20: private 的 payload 含 team_id:null` | 20 | 深等于 `{is_public:false, team_id:null}`；`needsConfirm({kind:'private'}) === false` |
| `BDD-27: team 的 payload 只传 team_id(slug)` | 27 | `toPatchPayload({kind:'team', teamSlug:'proj-a', teamName:'Proj A'})` 深等于 `{team_id:'proj-a'}`；**不含** `is_public` 键（交后端强制 false） |
| `BDD-27: team 不需要二次确认` | 27 | `needsConfirm(teamTarget) === false` |
| `BDD-28: Team A→Team B 的 payload 指向新团队` | 28 | 对 `{teamSlug:'b'}` 的 payload `team_id === 'b'` |
| `BDD-29: Team A→Private 清团队且保持非公开` | 29 | `toPatchPayload({kind:'private'})` 的 `team_id` 为 `null`（显式出现在 body，后端 `team_id_set` 才成立）且 `is_public === false` |

### 3.5 `src/components/__tests__/visibility-menu.spec.ts`（BDD-19/20/21/24/30）

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-19: 选择 Public 在确认前不发 select 事件` | 19 | 打开菜单 → 点 `[data-testid="visibility-item-public"]` → `wrapper.emitted('select')` 为 `undefined`；`.confirm-dialog`（`attachTo: document.body` 内）存在 |
| `BDD-19: 确认后才 emit select` | 19 | 点确认按钮 → `emitted('select')[0][0]` 深等于 `{kind:'public'}` |
| `BDD-20: 选择 Private 直接 emit，无确认框` | 20 | 点 `visibility-item-private` → `emitted('select')[0][0]` 为 `{kind:'private'}`；`document.body.querySelector('.confirm-dialog')` 为 `null` |
| `BDD-21: confirm-cancel 路径` | 21 | 确认框中点取消 → `emitted('confirm-cancel')` 存在、**无** `select`、菜单重开（`visibility-menu` 可见）、`document.activeElement` 为触发按钮 |
| `BDD-24: disabled 时菜单项不响应点击` | 24 | `props.disabled = true` → 点 `visibility-item-private` 后 `emitted('select')` 为 `undefined`；触发按钮 `disabled` 属性存在 |
| `BDD-30: Escape 关闭菜单且焦点回触发入口` | 30 | 打开菜单后 `document` 上派发 `keydown{key:'Escape'}`（或对菜单 `trigger`）→ `visibility-menu` 不再是 visible（`v-if`/`v-show` 由 `isOpen` 驱动）且 `document.activeElement === trigger` |
| `BDD-16/17/18: teams 为空时不渲染 Team 项` | 16/17/18 | `props.teams = []` → `[data-testid="visibility-item-team"]` count 0 |
| `BDD-18: Team 入口不直接切换` | 18 | 点 `visibility-item-team` 后 `emitted('select')` 为 `undefined`，且子菜单容器 `[data-testid="visibility-team-submenu"]` 出现 |
| `R11: teamsFailed 时 Team 位为禁用 + 失败文案` | 17 / R11 | `props.teamsFailed = true` → `visibility-item-team` 存在且 `disabled`，文本或 `title` 含「团队列表加载失败」 |

### 3.6 `src/stores/__tests__/entry-list-visibility.spec.ts`（BDD-19/21/24）

`vi.mock('@/api/client')` 的回调中**只用字符串字面量**（T079 mock hoisting 反例，角色定义强制），动态行为放 `beforeEach` 的 `vi.mocked(api.updateEntry).mockResolvedValue(...)`。

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-19: setVisibility 成功写三字段` | 19 | 目标 `public` + 服务端返回 `{is_public:true, team_id:null, team:null, revoked_shares:0}` → entry 三字段为 `true`/`null`/`null`；返回 `{ok:true, revokedShares:0}` |
| `BDD-19: revokedShares > 0 原样回传` | 19 (B-4) | 服务端 `revoked_shares: 2` → 返回 `{ok:true, revokedShares:2}`；**不断言 toast**（E-2：toast 归视图层，store 内不得有 `toast.show`） |
| `BDD-19: revoked_shares 为 null/undefined 时返回 0` | 19 | 返回 `revokedShares === 0` |
| `BDD-21: 失败时三字段完全回滚` | 21 | `updateEntry` reject → entry 的 `isPublic`/`teamId`/`team` 与操作前逐一相等；返回 `{ok:false, revokedShares:0}` |
| `BDD-24: inFlight 期间第二次调用不发请求` | 24 | 首次调用挂起（未 resolve 的 Promise）→ 第二次调用立即返回 `{ok:false}` 且 `api.updateEntry` 只被调用 1 次 |
| `BDD-27/28/29: 三次转换的 payload 透传` | 27/28/29 | 分别断言 `api.updateEntry` 收到 `{team_id:'a'}` / `{team_id:'b'}` / `{is_public:false, team_id:null}` |

### 3.7 `src/components/__tests__/entry-card-file-count.spec.ts`（BDD-13/14/15/22）

挂载既有 `EntryCard.vue` / `EntryListRow.vue`（`t031-*` spec 的 mount 方式，`vue-router` mock 用 `vi.hoisted`）。

| 用例 | BDD | 断言 |
|---|---|---|
| `BDD-13: fileCount=1 卡片不显示文件数` | 13 | 卡片文本不匹配 `/1 files?/` |
| `BDD-13: fileCount=1 列表行不显示文件数` | 13 | 列表行文本不匹配 `/1 files?/` |
| `BDD-14: fileCount=0 两处无任 N files 文本` | 14 | 卡片与列表行均不匹配 `/\d+ files?/` |
| `BDD-15: fileCount=3 两处均显示 "3 files"` | 15 | 卡片文本与列表行文本均含 `3 files` |
| `BDD-22: isOwner=false 时卡片无 visibility-toggle` | 22 | `count === 0`（非 `not.toBeVisible`） |
| `BDD-22: isOwner=false 时列表行无 visibility-toggle` | 22 | 同上 |

> 当前 `EntryCard.vue:44` / `EntryListRow.vue:20` 是 `v-if="entry.fileCount"` → `fileCount=1` 渲染 `1 file`，**BDD-13 断言失败（红）**；`fileCount=0`/`3` 两态当前已符合预期（属正向保护，非红灯）。

## 4. E2E 设计（`frontend-v3/e2e/tpv0102-explore-card-list-ux.spec.ts`，文件名写死）

### 4.1 纪律（P2 §6.3 + dispatch-context，逐条强制）

1. `test.use({ locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })` 只用于 BDD-04 的 describe 块（P2 §6.3）；其余块不限定 locale/时区（用形态匹配）。
2. BDD-01/02/03/26 **不得**硬编码 `GMT+8` → 用 `/GMT[+-]\d/` + `/\d{4}/`。
3. BDD-02 Then ③ 的 IANA 名断言 === 运行时 `Intl.DateTimeFormat().resolvedOptions().timeZone`（**不写**「形如 Area/City」——UTC 下无斜杠）。
4. tooltip 断言只走「自定义 DOM 元素 + `visibility` + `role="tooltip"`」：`await expect(tip).toBeVisible()`（悬停后）+ `textContent` 可读；悬停前 `toBeHidden()`。**不**用 `getByText` 命中原生 `title` / `::after`。
5. BDD-22 用 `toHaveCount(0)`（未渲染 ≠ 渲染后隐藏），三处载体：Explore 卡片、Explore 列表行、详情页（桌面头部 + 移动元信息条）。
6. 双 viewport：`chromium`（Desktop Chrome 1280×800）/ `Mobile Chrome`（Pixel 5 390×844）两个既有 project 天然覆盖；`mobile` 专属断言（VC-4 触达高度 ≥44）只在 `Mobile Chrome` 下生效（用 `test.skip(testInfo.project.name !== 'Mobile Chrome')` 守卫）。
7. **创建型用例清理钩子（强制）**：`createdEntries: string[]` 队列，创建即 push，`test.afterEach` 无条件 `DELETE`，接受 `200/204/404`；**不因响应非 2xx 中止删除**。
8. 0 文件 entry **必须现造**：`POST /api/v1/entries`（空 `files`），**禁** `peekview create` CLI；`image-gallery` 不是 0 文件素材（`seed-debug.py:183-185` `if not files: SKIP`）。
9. 组 fixture 走 debug HTTP API：`POST /api/v1/teams` + `POST /api/v1/teams/{slug}/members`；团队 slug 带 `Date.now()` 后缀避免与 seed 的 `frontend-team` / `backend-solo` 及 `team-visibility.spec.ts` 的 `proj-a` 冲突。
10. 生产防护：`beforeAll` 检查 `BASE_URL` 含 `:8080` / `prod` 即 `throw`（沿用 `team-visibility.spec.ts:24-30` 惯例）。

### 4.2 用例表

| 用例 | BDD | 关键断言 |
|---|---|---|
| `bdd01_card_and_list_show_absolute_time_with_offset` | 01 | 卡片模式与列表模式（点 `.view-toggle-btn[title="List view"]`）下，`[data-testid="time-display"]` 文本均匹配 `/GMT[+-]\d/` 且 `/\d{4}/`，且不匹配 `/ago|just now/` |
| `bdd02_hover_tooltip_shows_relative_absolute_and_iana` | 02 | 悬停 `[data-testid="time-display"]` → `[data-testid="time-tooltip"]` `toBeVisible()`；`textContent` 含 ①相对时间 ②`/GMT[+-]\d{2}:\d{2}/` ③`===` 运行时 `resolvedOptions().timeZone`；移开鼠标后 `toBeHidden()` |
| `bdd03_detail_and_mobile_meta_time_rules_match` | 03 | 列表卡片 / 详情桌面头部（`.meta-row`）/ 详情移动元信息条（`[data-testid="meta-tags-bar"]`）三处 `time-display` 文本均含 `GMT±N`；三处悬停 tooltip 均含相对+绝对时间 |
| `bdd04_shanghai_timezone_shows_plus8_wallclock` | 04 | `test.use({locale:'zh-CN', timezoneId:'Asia/Shanghai'})` 的子 describe：已造 `created_at` 固定为 `2026-11-10T09:43:00Z` 的 entry（用 `PATCH` 无法改 created_at → 改用「以已知时刻创建」+ 读取实际 `createdAt` 的**等价断言**：主显文本的 HH:MM:SS 与 `new Date(createdAt)` 在 Asia/Shanghai 下的墙上时间一致），文本含 `GMT+8` 且不含 `09:43:00`（当且仅当该 entry 的 UTC 时刻确为 09:43；否则断言 `GMT+8` + 墙上时间 = UTC+8） |
| `bdd05_invalid_time_no_nan_text` | 05 | 以 `created_at` 无法解析的 entry（API 造不出 → 用 `page.route` 拦截 `**/api/v1/entries**` 注入一条 `created_at: 'not-a-date'` 的记录）→ 卡片与 tooltip 文本均不含 `NaN` |
| `bdd06_future_time_direction` | 06 | 同上用 `page.route` 注入 `created_at` 为未来 24h 的记录 → tooltip 文本匹配 `/in \d+/` 且不匹配 `/just now/`、不含 `NaN` |
| `bdd13_single_file_entry_hides_file_count` | 13 | `yaml-docker-compose`（1 文件）卡片与列表行文本均不匹配 `/1 files?/` |
| `bdd14_zero_file_entry_hides_file_count` | 14 | 现造 0 文件 entry → 卡片与列表行均不匹配 `/\d+ files?/` |
| `bdd15_three_file_entry_shows_3_files` | 15 | 现造 3 文件 entry → 卡片与列表行均含 `3 files` |
| `bdd16_menu_excludes_current_state` | 16 | 打开 public entry 的菜单 → `visibility-item-public` count 0；`visibility-item-private` 与 `visibility-item-team` 存在 |
| `bdd17_no_teams_hides_team_entry` | 17 | 用**无团队用户**（现注册 `carol2`-style 随机用户，或 `dave`）登录 → 菜单中 `visibility-item-team` count 0（P2 §3.5：加载失败降级 ≠ 无团队，故用真无团队用户而非"请求失败"） |
| `bdd18_team_is_submenu_excluding_current_team` | 18 | 造 Team A + Team B 两个团队并把 entry 归 A → 打开菜单 + 点 `visibility-item-team` → `visibility-team-submenu` 内不含 `visibility-team-option-{A}`、含 `{B}`；点 Team 入口本身后 entry 归属未变（无 PATCH 请求） |
| `bdd19_public_requires_confirmation` | 19 | 团队 entry 点 `visibility-item-public` → `.confirm-dialog` 可见，**此时** `GET /api/v1/entries/{slug}` 的 `is_public` 仍为 false（确认前未发请求）；确认后 `is_public === true` 且 `team === null` |
| `bdd20_downgrade_has_no_confirmation` | 20 | public entry 点 `visibility-item-private` → `.confirm-dialog` count 0；PATCH 后 `is_public === false` |
| `bdd21_failed_switch_rolls_back` | 21 | `page.route('**/api/v1/entries/**', route => route.fulfill({status: 500}))` 拦 PATCH → 点 `visibility-item-private` → 卡片/详情状态仍为 `Public`（`aria-label` 或 badge 断言）且出现失败提示（`[data-testid="toast"], .toast` 文本匹配 `/失败|error|Failed/i`） |
| `bdd22_non_owner_has_no_visibility_entry` | 22 | 以**非 owner**（bob）登录看 alice 的 entry：Explore 卡片 `toHaveCount(0)`、列表行 `toHaveCount(0)`、详情页桌面 `toHaveCount(0)`、移动元信息条 `toHaveCount(0)` |
| `bdd23_detail_page_exposes_visibility_entry` | 23 | 本人 entry 详情页：桌面 `.meta-row` 内 `visibility-toggle` 可见；`Mobile Chrome` 下 `meta-tags-bar` 内 `visibility-toggle` 可见 |
| `bdd24_no_double_trigger_while_in_flight` | 24 | `page.route` 给 PATCH 加 300ms 延迟并计数 → 快速点两次 `visibility-item-private` → 收到的 PATCH 请求数 === 1 |
| `bdd25_zero_file_entry_dedicated_empty_state` | 25 | 现造 0 文件 entry → 详情页 `[data-testid="empty-no-files"]` 可见，且其文本 ≠ 有文件 entry 未选中文件时 `[data-testid="empty-select-file"]` 的文本 |
| `bdd26_seeded_explore_renders_new_rules` | 26 | 按文档 `make debug` seed 后 alice 登录 → `.entry-card` count > 1；每卡时间含 `GMT±N` 且不含 `ago`；`unicode-filenames`（8）/`multi-format-demo`（4）卡片出现 `N files`，`yaml-docker-compose`（1）不出现 |
| `bdd27_private_to_team_a` | 27 | private entry 选 Team A → API 回读 `is_public === false` 且 `team.slug === A`（**两字段都断言**） |
| `bdd28_team_a_to_team_b` | 28 | Team A entry 选 Team B → `team.slug === B`（不再是 A）、`is_public === false`，且 `.confirm-dialog` 未出现 |
| `bdd29_team_a_to_private` | 29 | Team A entry 选 Private → `is_public === false` 且 `team === null`（**两字段都断言**，防「团队清空但被误置 public」） |
| `bdd30_escape_closes_menu_and_returns_focus` | 30 | 打开菜单 → 按 `Escape` → `visibility-menu` 不可见 + `document.activeElement` 为 `visibility-toggle` |

### 4.3 视觉契约（P2 UI 设计节 VC-1~VC-7，P3 写用例、P5/P6 跑）

以 `bdd_visual_contracts` describe 实施，**全部 DOM 度量**：

| 契约 | 断言 |
|---|---|
| VC-1 | tooltip 不横向溢出：`box.x >= 0 && box.x + box.width <= viewport.width + 1` |
| VC-2 | 菜单不遮挡触发按钮：`menuBox.y >= triggerBox.y + triggerBox.height - 1` |
| VC-3 | 卡片元信息行不溢出：`scrollWidth <= clientWidth + 1` |
| VC-4 | **仅 Mobile Chrome**：`visibility-toggle` 高度 `>= 44`（既有 28×28 删除按钮**不断言**，C-17） |
| VC-5 | 主显时间与 `@username` 基线对齐：`abs(delta) <= 2` |
| VC-6 | 列表行动作区不与标题重叠：`actionsBox.x >= titleBox.x + titleBox.width - 1` |
| VC-7 | 详情 `.meta-row` 高度 `<= 两行 + 1` |

> 截图命名按角色规范（`desktop_1280x800.png` / `mobile_390x844.png`）由 P6 产出；P3 的 E2E 用例**不**写死截图路径到任务 `evidences/`（避免 P5 重跑覆盖 P6 证据），仅在失败时由 Playwright `only-on-failure` 自动留存。

## 5. 红灯原因自查（每个红灯必须是「被测模块未实现」）

| 文件 | 当前失败原因 | 归类 |
|---|---|---|
| `backend/tests/test_utc_serialization.py` | `ModuleNotFoundError: No module named 'peekview.timefmt'`（+ `peekview.models.UtcSerializeMixin` 不存在） | **B 类**（项目内模块未实现） |
| `src/composables/__tests__/useRelativeTime.spec.ts` | `formatTooltip` 未导出 + `absolute` 字段不存在 | B 类（被测模块未实现该导出） |
| `src/components/__tests__/time-display.spec.ts` | `Failed to resolve import '@/components/TimeDisplay.vue'` | B 类（组件未创建） |
| `src/utils/__tests__/visibility-options.spec.ts` | `Failed to resolve import '@/utils/visibility-options'` | B 类（模块未创建） |
| `src/utils/__tests__/visibility-target.spec.ts` | `Failed to resolve import '@/utils/visibility-target'` | B 类（模块未创建） |
| `src/components/__tests__/visibility-menu.spec.ts` | `Failed to resolve import '@/components/VisibilityMenu.vue'` | B 类（组件未创建） |
| `src/stores/__tests__/entry-list-visibility.spec.ts` | `store.setVisibility is not a function` | B 类（store 方法未实现） |
| `src/components/__tests__/entry-card-file-count.spec.ts` | BDD-13 断言失败（`1 file` 仍渲染，`v-if="entry.fileCount"`） | B 类（被测模块行为未实现） |
| `frontend-v3/e2e/tpv0102-...spec.ts` | 页面/组件/Tooltip 未实现 + 服务未起 | 预期（E2E 断言失败属红） |

**明确的非红灯（正向保护，允许当前为绿）**：BDD-14 / BDD-15 / BDD-20 的单测部分 / BDD-06 的「过去时间仍为 ago」对照——这些断言验证的是**已正确的既有行为不被改坏**，属回归护栏而非新功能红灯。

**「A 类」风险已排除**：全部测试文件的 import 只依赖 `peekview` / `@/...` 项目内路径与既有第三方（`pytest` / `vitest` / `@vue/test-utils` / `pinia` / `@playwright/test`）；无语法错；无对不存在第三方包的 import。

## 6. 断言条数自检（C-15）

`P3` 命令的 `[ $b -eq 0 ] && [ $f -eq 0 ]` 会把 pytest `exit 5`（零收集）折叠为 1 → 必须人工确认 `passed + failed + errors > 0`：

- pytest：新增文件有 10 个 `test_` 函数；当前以 **collection error** 形式产生 `errors=1`，`failed_tests` 非空，`total = 0 + 0 + 1 > 0` ✅
- vitest：7 个新 spec 文件，全部被 `include` 默认 glob（`src/**/*.spec.ts`）收集；当前至少 7 个文件级失败 ✅

## 7. 显式不做（边界声明）

| 不做 | 理由 |
|---|---|
| 不改 `§6.4` 的 11 项既有断言（TPV0095 BDD-40 翻转、`title` → tooltip、`vi.mock` 补 `absolute` 等） | 它们是 **P4** 实现连带的断言更新面；P3 静默改会让「测试先于实现」的语义消失。P4/P7 按 C-11/C-13 登记「TPV0095 BDD-40 被本任务有意取代」 |
| 不在 `backend/tests/` 写 BDD-12 的 pytest 用例 | P2 §6.1 约束 3：autouse 隔离下必然恒绿 → 假用例 |
| 不写 `test_architecture_fitness.py` | P2 §6.1 未要求；`P5_fitness` 直接跑 `test_utc_serialization.py -k mixin_not_in_table_mro` |
| 不留任何 scratch 探针在 `backend/tests/` / `frontend-v3/src/` | dispatch-context 强制；临时脚本一律落 `.agate-tmp/` |

## 8. 平台假设扫描自查（强制）

扫描目标（仅新增文件）：

```
python3 {agate_root}/scripts/check-platform-assumptions.py \
  backend/tests/test_utc_serialization.py scripts/audit-utc-semantics.py
```

- **0 命中**为目标；R4（系统临时目录字面量）在 `scripts/audit-utc-semantics.py` 用 `os.sep` 运行时拼接规避
- ⚠️ **扫描面限定**：该脚本只扫 `.bats/.bash/.sh/.py` —— **`.ts` 的 vitest / Playwright 用例不在扫描面内**，跑它恒绿不代表 TS 侧无平台假设（DEBT0048 已知缺口）。TS 侧的平台无关性由「不写绝对路径 / 不依赖 `process.platform` / 截图路径不落仓库」三条人工纪律兜底（见 §4.1 第 7、10 条）。

## 9. gate 命令对照（P2 冻结，P3 不自改）

```
P3:  ( cd backend && .venv/bin/python -m pytest tests/ -n auto -q --tb=short ); b=$?; ( cd frontend-v3 && npx vitest run --reporter=dot ); f=$?; [ $b -eq 0 ] && [ $f -eq 0 ]
P3_formatter: pytest.sh
P5_fitness:  cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro
P5_e2e:      E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test
```

三件事缺一即假红：`--tb=short` + `P3_formatter: pytest.sh` + **无 `| tail`**。P3 自跑验证红灯时同样用该形态。

## 10. 环境隔离声明

`[PROD_NOT_TOUCHED]` — 本阶段只写测试文件与一次性审计脚本，未启动任何服务、未访问 `:8080`、未读写 `~/.peekview/`、未执行 `peekview` CLI 对生产 DB 的操作；实测探针一律落在 `.agate-tmp/`，pytest 侧全部依赖 `conftest.py` 的 autouse 隔离（`tmp_path` DB）。
