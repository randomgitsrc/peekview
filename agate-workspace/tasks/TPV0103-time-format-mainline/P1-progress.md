# P1 进度 — TPV0103（analyst）

## 步骤 1：读 role 定义 + dispatch-context + P0-brief
- 已读 `{agate_root}/assets/execution-roles/analyst.md`（v0.83.2）
- 已读 `P1-dispatch-context-analyst.md`（含 AGATE_CARD P1 全文 + 主 Agent 追加实测）
- 已读 `P0-brief.md`（139 行，含决策推翻声明三条理由 + locale 实测表 + 风险清单）

关键确认：
- 本任务是**反转 TPV0102 的验收判据**（主显必须含 `GMT±N` → 主显不得含时区偏移），tooltip 判据不变
- 范围内：`formatFullDate` 主显 + 受影响断言 + upgrading.md + CHANGELOG
- 范围外：`formatTooltip` / 相对时间逻辑 / 文件数显隐 / 可见性菜单 / 空态 / 后端 API MCP（零改动）
- 仓库状态：HEAD `17d6c7bc`（P0 已提交），工作树仅 dispatch-context 未跟踪

## 步骤 2：读 current 实现 + TPV0102 反面参照
- `frontend-v3/src/composables/useRelativeTime.ts`（93 行）：
  - `FULL_DATE_OPTIONS` = year/month/day/hour/minute/**second: '2-digit'**（6 字段，无 timeZoneName）
  - `formatOffsetDate(date, timeZoneName)` = `toLocaleString(undefined, {...FULL_DATE_OPTIONS, timeZoneName})`
  - `formatFullDate`（主显）→ 传 `shortOffset` → `2026/11/10 GMT+8 17:43:00`
  - `formatTooltip`（悬停）→ `formatRelativeTime · formatOffsetDate(longOffset) · resolvedOptions().timeZone`
  - 无效日期：`formatFullDate` → `'—'`，`formatTooltip` → `'Invalid date'`
- TPV0102 P1-requirements.md 读到的待反转判据原文：
  - **BDD-01**（要反转）：主显须匹配「含 `GMT+数字`/`GMT-数字`、且含 4 位年份」→ 本次须反向为「不得含偏移」
  - **BDD-02**（**保持不变**）：tooltip 含相对 + `GMT+HH:MM` 完整偏移 + IANA 名，且判据③已修为「等于 `resolvedOptions().timeZone`」（TPV0102 自己已踩过 UTC 假 FAIL 坑）
  - **BDD-03**（要反转）：三处主显「均含 `GMT±N`」→ 反向为「均不含偏移且三处一致」
  - **BDD-04**（要反转 + **字面量陷阱**）：`17:43:00` 含 `GMT+8`，固定 zh-CN/Asia-Shanghai。本次去秒后 `17:43` 仍随 locale 变（en-US → `05:43`）→ **必须继续固定 locale，或改形态匹配**
  - **BDD-26**（要反转）：seed 路径「每张卡片的时间文本含 `GMT±N`」→ 反向
  - BDD-05/06（无效值 / 未来时间）不受影响

## 步骤 3：同类扫描（实测，非推理）
grep A：`toLocaleString|toLocaleDateString|toLocaleTimeString|Intl.DateTimeFormat` @ frontend-v3/src = **9 命中**
  1. useRelativeTime.ts:17-18（formatOffsetDate）→ **本次处理**
  2. PublishResultPanel.vue:56 `new Date(expiresAt).toLocaleString()` → 不处理（默认 options：含秒但**无时区名**；不同界面/不同语义）
  3. ApiKeySettingsTab.vue:270 `toLocaleDateString()` → 不受影响（本来无偏移）
  4. ApiKeyListView.vue:285 同上
  5. UserManagerTab.vue:162 `toLocaleDateString()` → 不处理
  6. ProfileTab.vue:59 `toLocaleDateString(undefined,{year,month,day})` → 不处理（仅日期）
  7. TableView.vue:5 `.toLocaleString()` 于 **number** → 非时间
  8. useRelativeTime.spec.ts:12（注释）→ P3 更新判据载体
  9-… 无更多

grep B：`GMT` @ frontend-v3/{src,e2e} + docs + CHANGELOG（排除 node_modules/dist/backend static）= **7 文件**
  - 测试 5 文件（time-display.spec / useRelativeTime.spec / tpv0102-e2e / filter-tabs / expired-warning）→ **本次处理**
  - CHANGELOG.md:18（v0.27.0 历史条目）→ 不改历史，只加 [Unreleased] 新条目
  - docs/reviews/…retro:146 `P-MGMT-1` → **假命中**（研报复盘条目编号，非时间格式）

grep C：ApiKey 两处的本地 `formatRelativeTime`（ApiKeySettingsTab:273 / ApiKeyListView:288）
  → 只输出 `just now|Nm ago|Nh ago|Nd ago`，**不含绝对时间** → 与主显格式无交集 → **不合并**（TPV0102 已登记技术债）

grep D：其它时间消费方 —— expires.ts（`in 3d`/`expired`）、StarManageView.formatDate（手拼 yyyy-mm-dd）、StarToggle.formatCnDate（`YYYY 年 M 月 D 日`）、EntryDetailHeader `Expires in 3d`
  → 均**不依赖**主显格式，零改动
grep E：backend/MCP —— 零改动；`packages/mcp-server/src/tools/createEntry.ts:118` 打印 API 原始 ISO(Z) → **必须保持**（机器可读场景要偏移，与本次"人读界面不要偏移"同源）

## 步骤 4：实测（Node v24.22.1 / ICU full，非推理）
1. **32 locale × 8 时区 × 4 组 options 的数字串（`\p{Nd}+`）计数矩阵**：
   - 五字段(无秒无时区名) = **5** 串（32/32 locale，0 例外）
   - 六字段(含秒) = **6**；`shortOffset` = **7**；`longOffset` = **8**
   → 「数字串数 == 5」是可二值判定、locale 无关、且能同时排除"含秒"与"含偏移"的判据
2. **陷阱实证**：P0/dispatch 用的「对 `/GMT|UTC|[+-]\d/` 无命中」作为"无偏移"判据，在 **4/32 locale 假 FAIL**
   （`sv-SE`/`lt-LT` → `2026-11-10 17:43`；`nl-NL` → `10-11-2026, 17:43`；`en-CA` → `2026-11-10, 05:43 p.m.`）——日期分隔符 `-` 被算作偏移。
   改用严格 `/GMT|UTC/`：32/32 locale 全无假阴性（任何 ICU locale 的偏移输出必带 GMT/UTC 前缀或本地化词如 `UTC+8`/`غرينتش`；后者实测出现在 fr-FR/ar-EG/fa-IR，会被 `/UTC/` 或 `/GMT/` 漏掉 → 故"无偏移"判据用 `/GMT|UTC/` 在**主显**场景仍完备：主显不带 timeZoneName 时 32/32 无命中）
3. **tooltip 判据的 locale 脆弱性（新发现）**：TPV0102 BDD-02 判据②`/GMT[+-]\d{2}:\d{2}/` 在 **7/32 locale 漏判**：
   fr-FR→`UTC+08:00`；fi-FI/da-DK/id-ID→`GMT+08.00`（点号）；he-IL→`GMT‎+08:00‎`（bidi 不可见字符）；ar-EG/fa-IR→本地化词 + 非 ASCII 数字。
   → 语义不变，但判据②必须在**固定 zh-CN**下判定（本轮 BDD-07 如此写），不能声称"任意 locale 均成立"
4. **`dateStyle/timeStyle` + `timeZoneName` 共存** → 复测仍 `TypeError: Invalid option`（约束仍有效）
5. **午夜边界**：`2026-11-09T16:00:00Z` + Asia/Shanghai → zh-CN `2026/11/10 00:00`、en-US `11/10/2026, 12:00 AM`（数字串仍 5）
6. **`hour12:false` 效果**：en-US `11/10/2026, 05:43 PM` → `11/10/2026, 17:43`（会覆盖用户 locale 习惯）
7. 本机 node: v24.22.1，`Intl` resolvedOptions = `{locale: zh-CN, timeZone: Asia/Shanghai}`；**未复测** Playwright 浏览器默认 locale（TPV0102 声称默认 en-US，本轮不作断言 → 所有 BDD 显式固定 locale）

## 步骤 5：待写入 P1 的关键判定
- 主显 = 五字段（year/month/day/hour/minute，**无** timeZoneName、**无** second），走 `toLocaleString(undefined, {...})`，不拼接
- **不加 `hour12: false`**（决策见 P1 §4 决策 D2）
- 判据形式（避开 TPV0102 三处陷阱）：
  ① 数字串计数 `\p{Nd}+` 全局匹配数 == 5（locale+时区无关，实测 32 locale × 8 时区 0 例外；含秒=6、shortOffset=7、longOffset=8，天然排除两者）
  ② `/GMT|UTC/` 无命中（严格版，不用 P0 的 `/GMT|UTC|[+-]\d/`——后者在 sv-SE/lt-LT/nl-NL/en-CA 假 FAIL）
  ③ 精确字面量断言只在**显式固定 locale + 固定时区**下使用（zh-CN→`2026/11/10 17:43`；en-US→`11/10/2026, 05:43 PM`）
- **新发现（P0/dispatch 未覆盖）**：TPV0102 的 tooltip 偏移判据 `/GMT[+-]\d{2}:\d{2}/` 在 7/32 locale 漏判（fr-FR `UTC+08:00`；fi-FI/da-DK/id-ID `GMT+08.00`；he-IL bidi 字符；ar-EG/fa-IR 本地化词+非 ASCII 数字）→ tooltip BDD 必须固定 locale
- **另一发现**：`/\d{4}/` 年判据在 fa-IR（波斯历 `۱۴۰۵`）下不匹配 → 弃用"4 位年份"，改用数字串计数
- 阻碍标记：无 → 行首 `[NO_NEED_CONFIRM]`

## 步骤 6：P1-requirements.md 产出 + 落盘
- 12 条 BDD（BDD-01 ~ BDD-12），编号连续，格式 `#### BDD-NN:`，UX 类别写入标题后缀
- frontmatter：risk_level=low / ceremony=standard / phases=[P1..P8]（无裁剪）/ packages=[frontend-v3, docs] / domains=[frontend] / ui_render_shape=layout / ui_ux_dimensions=[布局结构,交互行为,视觉呈现] / follows_existing_pattern / design_trivial=true / **prod_touched=false**
- 决策 D1（不加 hour12:false）/ D2（tooltip 保留秒）/ D3（不合并 ApiKey 本地实现，SUGGEST）
- 同类扫描 6.1 扫描 A~E + 6.2 仓内旁证 + 6.3 回归拦截 + 6.4 交 P2 的耦合点
- P0 时效性：无严重漂移 + 1 处轻微漂移 `[P0_STALE: ...]`（行首，含具体漂移点）
- `[NO_NEED_CONFIRM]` 行首声明；2 处 `[SUGGEST:`（不阻塞）
- `[PROD_NOT_TOUCHED]` 状态标记

## 步骤 7：全部 BDD 判据在实测数据上复核通过
- BDD-01：4 locale 参数化 + 全 32 locale（runs==5 且无 GMT/UTC）→ **true**
- BDD-02：zh-CN 主显不含 `17:43:00` / tooltip 含 → **true / true**
- BDD-03：zh-CN === `2026/11/10 17:43` → **true**
- BDD-04：en-US === `11/10/2026, 05:43 PM` → **true**
- BDD-06：tooltip 3 段 + `GMT+08:00` + IANA 相等 → **true**（首次探针 false 是探针自身拼串漏了相对段，非判据问题）
- BDD-07：四 locale 子序列 → **true**
- BDD-08：无效值不产生 NaN → **true**

## 步骤 8：机械门禁实跑
- `check-frontmatter.py P1-requirements.md` → **exit 0**
- `check-pruning.py .` → **exit 0**（RECONCILE 0 mismatches）
- `_gate_p1_vision_capability` → **True**（status: available）
- `_gate_p1_ui_shape` → **True**（layout + 三个框架内维度）
- `check-gate.py P1 .` → exit 1，**仅因缺 P1-review.md**（P1 评审不可裁，属预期；待主 Agent 派 requirements-review）
- 标记计数：NC 阻塞=0 / SUGGEST=2 / NO_NEED=1 / PROD_TOUCHED（裸标记）=0

## 环境隔离确认
- 未触碰 :8080、未读写 ~/.peekview/
- 实测脚本全部落 `.agate-tmp/`（locale-probe.mjs / locale-probe2.mjs / regex-trap.mjs / tooltip-probe.mjs / digit-runs.mjs / tz-runs.mjs / hour-numeric.mjs / midnight.mjs / h24.mjs / subseq.mjs / spacecheck.mjs / final-verify.mjs / bdd06.mjs）
- 未在 `backend/tests/` 或 `frontend-v3/src/` 留任何探针
- 未执行 uvicorn 直启 / pip install

---

# 增量修复轮（retry 1/3）— 2026-11-11

## 步骤 R0：独立复验（不采信评审/主 Agent 自述，全部自跑）
探针：`.agate-tmp/an-ref.mjs` / `an-seg.mjs` / `an-cp.mjs`（Node v24.22.1，ICU full）

- **参考基线逐字符相等判别力**：5 locale（zh-CN/en-US/de-DE/ja-JP/sv-SE）× 7 种 `timeZoneName` × 有/无 second = 65 个错误变体 → **假 PASS = 0**；正确形态 **5/5 PASS**。BLOCKER-06 的替代方案成立。
- **段数**：`Asia/Shanghai` 主显 5 / 含 second 6 / `shortOffset` **6** / `longOffset` **7**（analyst 上轮写 7/8 → 确认错，BLOCKER-05 成立）。
- **非整小时时区** `shortOffset` = **7 段**：`Asia/Kolkata` `GMT+5:30`、`Pacific/Chatham` `GMT+13:45`、`Australia/Adelaide` `GMT+10:30`（与 `longOffset` 7 段重叠 → 「互不重叠」错误）。
- **256 格**（32 locale × 8 时区）主显段数分布：`{5: 256}`，0 例外。
- **旧正则** `/GMT|UTC|[+-]\d/`：zh-CN/en-US/de-DE/ja-JP **false**（假 PASS 侧）、`sv-SE` **true** → BLOCKER-01 成立。
- **U+0020 码点**：`11/10/2026, 05:43 PM` → `...0032 0033 0020 0050 004d`，无 U+202F / U+00A0 → MINOR-02 当前可判。
- **空串**：`useRelativeTime.ts:67` 的 `if (dateStr.value)` falsy 守卫 → 空串三 ref 全置 `''`，不走 `formatFullDate`/`formatTooltip` → BLOCKER-02 成立。
- `backend/tests/test_utc_serialization.py` 存在（20 个 test）→ MINOR-03 的守护锚可用。
- `FOUR_DIGIT_YEAR` 实测 **5 处使用 + 3 处常量声明**（`time-display.spec:29`、`useRelativeTime.spec:40`、`e2e:47`）→ BLOCKER-04 第 2 项成立。

## 步骤 R1：BLOCKER-01 / 05 / 06 闭合（BDD-01 换判据 + BDD-07 论证更正）
- **BLOCKER-06（BDD-01）**：判据改为「与五字段参考格式化输出**逐字符相等**」（参考值运行时现算，随 locale 参数化）。删除原「段数==5 ∧ ¬GMT ∧ ¬UTC」双条件——该判据被实测证伪：`long`/`shortGeneric`/`longGeneric` 在 zh-CN/en-US 下均为 5 段且无 GMT/UTC → 假 PASS。自跑判别力：65 个错误变体假 PASS=0，正确形态 5/5 PASS。
  - 段数检查保留但**对象换成参考值自身**（自检 ②），职责从「判实现」变「判判据没写错」，避免「参考值与实现同错」的假绿。
  - 原「不含 GMT/UTC」断言降级为参考值自检的附带结论，不再作为反推实现参数的判据。
  - 三 locale 互为对照判据 ③：en-US 参考值 ≠ zh-CN 参考值，且各自主显等于自己的参考值 → 同时判「实现正确」与「locale 适配真实发生」。
- **BLOCKER-01**：locale 清单纳入 `sv-SE`（并补 `de-DE`/`ja-JP` 之外原 4 locale 保持）；正文写明 sv-SE 是钉住「判据退化回 `/GMT|UTC|[+-]\d/`」这一失效模式的唯一有效钉子（实测旧正则仅 sv-SE 命中 → 退化即红）。
- **BLOCKER-05**：删除「7/8 段」与「5/6/7/8 互不重叠」两处错误论断（实测 6/7 且 shortOffset 与含 second 同为 6 段）。该段论证已随判据更换整体移除；准确表述（主显 5 段、含 second 或任意 timeZoneName 恒 ≥6 段、非整小时时区 shortOffset 为 7 段）写入 §2.4 边界维度与 §5.1。
- **BLOCKER-06（BDD-07 连带）**：删除「子序列判据能抓住主显多出秒或偏移段」的错误宣称（实测加回 second / longOffset 后仍是子序列 → true）。改为显式声明能力边界：「本条只判两处指同一时刻」，「主显不许多出秒/偏移」由 BDD-01 独担，避免 P6 误以为有双重保护。BDD-05 中对 BDD-01 的引用同步改为新判据。

## 步骤 R2：BLOCKER-02 闭合（BDD-08 空串）
- 选方案 (a)：据实描述现状。实测 `useRelativeTime.ts:67` falsy 守卫 → 空串/null 三 ref 全 `''`，不走 formatFullDate/formatTooltip。
- BDD-08 拆成三条独立断言：① 无法解析 → 主显 `—` / 提示 `Invalid date`（非空占位）②③ 空串/null → 均渲染空串。
- 写明「为何空串判空串」：显示 `—` 会与「解析失败」语义混同；改守卫属行为变更，超出 §10 范围，若未来要改须新开任务。

## 步骤 R3：BLOCKER-03 / 07 闭合（BDD-11 时序、BDD-12 locale）
- **BLOCKER-03（BDD-11 ②）**：改为「标题匹配 `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+`（版本号可为占位值，格式必须匹配）+ 正文含『悬停提示的偏移与时区名保持不变』」。实测 `upgrading.md` 既有两节标题确为此格式（`:11` `## v0.26.1 → v0.27.0（…）`、`:70` `## v0.21.0 → v0.22.0（…）`）。理由写入正文：版本号 P8 才定而 P6 在 P8 前，确切值校验移交 P8 既有版本一致性门禁。
- **BLOCKER-07（BDD-12）**：Given 补固定 `locale: zh-CN` + `timezoneId: Asia/Shanghai`（Playwright 与人工两条路径均给出）；③ 由写死 `GMT±HH:MM` 改为「与 `longOffset` 参考输出逐字符相等」，消除与 BDD-06「7/32 locale 漏判」结论的自相矛盾。② 同步改为与参考文本逐字符相等（不再引用已废弃的双条件）。

## 步骤 R4：BLOCKER-04 闭合（改动面 ≥9 处 + 5 处 FOUR_DIGIT_YEAR 逐条判定）
- §2.5 与 §6.1 改动面改为**分类计数表**：主显偏移断言 8（spec 2 + e2e 6）+ 主显秒级断言 1（`e2e:401`）= **≥9**；常量 3；tooltip 偏移 5；另 `FOUR_DIGIT_YEAR` 5 处单独列。
- `e2e:401` 定性为**秒级断言**（非偏移断言）：`toContain(HH:MM:SS)`，期望值来自 `:394` 的 `second:'2-digit'`。处置改为断言主显**不含** `HH:MM:SS`（与 BDD-02 ① 一致）。
- 新增 **§6.1.1**：5 处 `FOUR_DIGIT_YEAR`（`time-display.spec:50` / `useRelativeTime.spec:55` / `e2e:258,267,426`）逐条判定 → **5 处全部替换**为参考文本相等断言；3 处常量声明（`:29`/`:40`/`:47`）一并删。
- 与 §3 纪律 3 的冲突解决：纪律 3 禁的是「用 `\d{4}` 当形态判据」，而这 5 处虽只作弱存在性断言，但在新形态下**静默恒真**（`11/10/2026` 命中 `\d{4}`）→ 属死断言。全部替换后 `FOUR_DIGIT_YEAR` 在仓库归零，纪律 3 无现存违例。
- 扫描 B 表格三行同步补列（`FOUR_DIGIT_YEAR` 与 `:401`）。
- BDD-10 扩为四项（① 无偏移 ② 无秒 ③ tooltip 仍有偏移 ④ 无 `FOUR_DIGIT_YEAR`），并说明检索口径须按**断言对象**而非断言文本（这 6 处都不含 `GMT` 字样，旧检索式全漏）。

## 步骤 R5：BLOCKER-05 闭合（数字更正）
- §5.1 重写：旧「shortOffset 恒 7 / longOffset 恒 8」+「5/6/7/8 互不重叠」**全部删除**（实测错）。换成自跑实测表：主显 5（256/256 格 0 例外）/ 含 second 6 / shortOffset 整小时 6、非整小时 **7** / longOffset 7。
- 写明可引用的准确命题：「主显恒 5 段；含 second 或任意 timeZoneName 恒 ≥6 段」，并明确 **6 段与 7 段内部不唯一**（shortOffset 与含 second 同为 6；非整小时 shortOffset 与 longOffset 同为 7）。
- §2.4 非整小时时区行补关联：`Asia/Kolkata` `GMT+5:30`/`Pacific/Chatham` `GMT+13:45`/`Australia/Adelaide` `GMT+10:30` → shortOffset 为 7 段（同一 option 段数随时区变，是「段数不可作参数判据」的又一实证）。
- §3 判据纪律扩为 4 条：纪律 2 从「别用旧正则」升级为「别用文本特征反推实现参数」（覆盖两个方向的失效），纪律 4 新增「段数只能用于自检/弱存在性」。
- §5.2 判据陷阱表补一行（段数+¬GMT 假 PASS，把评审 7 BLOCKER-06 的反例表并入）；§5.3 补空格码点与参考相等判别力（65/65）两项实测。

## 步骤 R6：MINOR-02 处理（BDD-04 空格码点）
- BDD-04 Then 由字面 `toBe` 改为正则 `^11\/10\/2026, 05:43[\s\u202f]PM$`，同时接受 U+0020 与 U+202F。
- 自跑码点确认（`an-cp.mjs`）：当前输出 `...0032 0033 0020 0050 004d`，即 U+0020，无 U+202F/U+00A0 → 当前可判；正则防的是 ICU 升级后的假 FAIL。
- 断言对象仍是用户可见文本（不绑 option 名/类名），与「D1 护栏」定位一致，BDD-04 主题未变。

## 步骤 R7：MINOR-01 / MINOR-03 处理
- **MINOR-01（a）**：§6.1 扫描 A 的 `useRelativeTime.ts:18` 行去掉 `longOffset` option 名，改为「tooltip 路径保留完整到分钟的偏移（形态随 locale，不在需求层指定具体说明符取值）」；BDD-12 ③ 说明里的 `longOffset` 也改为语义表述。保留的 `longOffset`/`shortOffset` 出现均在**实测取数表**（§2.4/§5.1/§5.2，说明「某取值会怎样」，属举例论证），不构成对实现的指定。
- **MINOR-01（b）VC 契约**：§2.2 新增 VC-1/VC-3 核对表并给显式结论 —— VC-1（tooltip 不横向溢出）不受影响（本次不改 tooltip）；VC-3（元信息行不因文本**变长**溢出）本次文本**变短**（25→16 / 29→20），方向相反不需反转；「变短后布局塌陷」是新风险但**不冒充 VC-3**，单列在 §2.2 由 P6 四处截图确认。
- **MINOR-03**：BDD-10 加判据 ⑤「`backend/tests/test_utc_serialization.py` 全部用例保持绿」（已实测该文件存在，20 个 test，是 TPV0102 的既有守护点，零新增成本）。MCP `createEntry.ts:118` 无自动化守护 → 列为已知残余风险，由 P7 人工核对 + 扫描 E 行号清单兜底（不假装已覆盖）。

## 步骤 R8：BDD-01 判据的可执行性加固（自查发现，非评审点名）
- 自查发现两处「按字面写会假 FAIL」的问题，均已修：
  1. **参考值与实现的 locale 来源必须同源**：若参考值 fix `en-US` 而实现跑在系统 locale，逐字符相等必然假 FAIL。补「写法 A（e2e，双方都给 undefined 跟随环境）/ 写法 B（vitest，双方都显式固定）」两条合法路径，并要求来源同源。实测验证（`an-alias.mjs`）：错配 → false，同源 → true。
  2. **判据 ③ 的 locale 对照不能选 zh-CN 与 ja-JP**：实测二者五字段输出**完全相同**（均 `2026/11/10 17:43`），用它们做对照会误判。改为 `sv-SE` vs `en-US`（实测不同：`2026-11-10 17:43` vs `11/10/2026, 05:43 PM`），并在正文写明为何不能选前者。
- 另修：③ 原写「en-US 参考值 ≠ zh-CN 参考值且各自主显等于自己的参考值」，需跨 locale 比较主显文本；而 Playwright `locale` 是 context 级 fixture，同 test 内无法切换 → 改为「同 test 内比较两个 locale 的**参考值**」，局部可算、不依赖执行顺序。

## 步骤 R9：最终全量复核（自跑，`an-b01.mjs`）
- BDD-01 新判据：5 locale × 7 种 `timeZoneName` × 有/无 second = **70 个变体** → 正确形态 **5/5 PASS**、**假 PASS = 0**、**假 FAIL = 0**。
- 旧正则 `/GMT|UTC|[+-]\d/` 独立复跑 32 locale：命中 **4**（sv-SE/lt-LT/nl-NL/en-CA = 假 FAIL 侧），未命中 **28**（含 zh-CN/en-US/de-DE/ja-JP 全部 4 个原 locale = 假 PASS 侧）→ 两个方向都失效，BLOCKER-01 前提确认。
- 段数 256 格独立复跑：main `{5:256}` / second `{6:256}` / longOffset `{7:256}` / shortOffset `{6:160, 7:96}` → §5.1 全部数字与正文一致。
- 机械门禁：`check-frontmatter.py` → **exit 0**；`check-pruning.py` → **exit 0**，RECONCILE **0 mismatches**。
- BDD 编号：12 条，`01..12` 连续，全部 `#### BDD-NN:` 格式。
- 环境隔离：全部探针落 `.agate-tmp/`（an-ref / an-seg / an-cp / an-alias / an-verify / an-b01）；未在 `backend/tests/` 或 `frontend-v3/src/` 留文件（已 ls 确认）；未改 `.state.yaml`（现为 `phase: P0`，本次未写 `status`）；未触碰 :8080 / ~/.peekview/。

## 步骤 R10：结构收尾
- 把 §6.1.1 从「扫描 B 与扫描 C 之间」移到扫描 E 之后、6.2 之前（保持扫描 A→B→C→D→E 的原有叙述顺序不被割裂）。
- §5.2 标题「三个…判据」改为「四个…判据」（本轮新增一行假 PASS 判据）。
- 表格完整性 awk 检查：无表行中断。
- 最终门禁：`check-frontmatter.py` exit 0；`check-pruning.py` exit 0（RECONCILE 0 mismatches）；BDD 12 条 01..12 连续。
- `check-gate.py P1` exit 1 —— **仅因 `P1-review.md` status 仍为 `needs-revision`**（评审轮次属主 Agent 流程，非本次产出问题）。

## 7 BLOCKER 闭合对照（交付摘要）
| # | 闭合方式 |
|---|---|
| 01 | BDD-01 locale 清单纳入 `sv-SE`，并写明它是钉住「判据退化回 `/GMT\|UTC\|[+-]\d/`」的唯一有效钉子（实测旧正则仅这 4 个 `-` 分隔 locale 命中） |
| 02 | BDD-08 选方案 (a)：空串/null 判「渲染为空串」（据实描述 `:67` falsy 守卫现状），无法解析字符串单独判非空占位；并说明改守卫超范围 |
| 03 | BDD-11 ② 改为「标题匹配 `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+` + 正文含指定语义」，版本号确切值校验移交 P8 |
| 04 | 改动面改为分类表：偏移 8 + 秒级 1（`e2e:401`）= ≥9；新增 §6.1.1 对 5 处 `FOUR_DIGIT_YEAR` 逐条判定（全部替换）+ 3 处常量删除；BDD-10 扩为 5 项 |
| 05 | §5.1 数字更正为 6/7（256 格实测：shortOffset 6×160+7×96、longOffset 7×256），删「互不重叠」，写入准确命题「主显恒 5、含 second 或任意 timeZoneName 恒 ≥6」；§2.4 补非整小时时区 shortOffset 为 7 段 |
| 06 | BDD-01 弃用「段数+¬GMT/¬UTC」改为与五字段参考格式化输出**逐字符相等**（参考值运行时现算、随 locale 参数化）；实测 70 变体 0 假 PASS / 0 假 FAIL；BDD-07 删除「能抓住多出秒或偏移」的错误宣称并声明能力边界 |
| 07 | BDD-12 Given 固定 `locale: zh-CN` + `timezoneId: Asia/Shanghai`（含人工路径写法），③ 改为与 `longOffset` 参考输出逐字符相等，消除与 BDD-06「7/32 locale 漏判」的自相矛盾 |

## 3 MINOR 处理
| # | 处理 |
|---|---|
| 01 | 是。扫描 A 的 `longOffset` option 名改为语义表述（「完整到分钟的偏移，形态随 locale」）；§2.2 新增 VC-1/VC-3 核对表 + 显式结论（VC-1 不受影响 / VC-3 方向相反不需反转 / 变短后布局塌陷单列为 P6 检查点，不冒充 VC-3） |
| 02 | 是。BDD-04 由字面 `toBe` 改正则 `^11\/10\/2026, 05:43[\s\u202f]PM$`；实测当前码点为 U+0020（无 U+202F/U+00A0） |
| 03 | 是。BDD-10 加判据 ⑤「`backend/tests/test_utc_serialization.py` 全部用例保持绿」（已确认该文件存在、20 个 test、零新增成本）；MCP `createEntry.ts:118` 无自动化守护 → 列为已知残余风险，交 P7 + 扫描 E |

---

# P1 retry 2（本轮）— 只修 2 BLOCKER + 4 MINOR

## 步骤 R11:BLOCKER-A 独立实测复现（Playwright 实跑，非采信）
- 探针 `.agate-tmp/r2-a-probe.mjs`：5 locale × 4 种实现形态 × 3 种参考值求法。
- **写法 A（Node 侧 `undefined`）在正确实现上：宿主 `zh-CN` → 2/5 PASS（3 条假 FAIL：en-US/de-DE/sv-SE）；宿主 `en_US.UTF-8` → 1/5 PASS（4 条假 FAIL）**。与主 Agent / 评审数字完全一致。
- **FIX-A（`page.evaluate` 浏览器内现算）：两种宿主下均 5/5 PASS**。
- **FIX-B（Node 侧显式传 locale 字符串）：两种宿主下均 5/5 PASS**。
- 错误实现不假 PASS：`+second` / `+timeZoneName long` / `+shortOffset` 三种过修在 FIX-A/FIX-B 下均 **0/5 PASS**（全被抓），写法 A 亦 0/5（但那是因为它连正确实现都判错，不构成保护力）。
- 结论：**「同源」= 显式同源（显式指定 / 同一 JS 环境内现算），不是「都跟随环境」**。上轮第 165 行「天然一致」确为假断言。

## 步骤 R12:BLOCKER-A 的 vitest 侧额外实测（本轮新增发现，主 Agent 未提）
- 被测实现 `useRelativeTime.ts:18` 的 locale 参数**硬编码为 `undefined`**，vitest/jsdom 下**无法**通过 `test.use` 固定（无浏览器 context），也无法在运行时改：实测 `process.env.LANG='en_US.UTF-8'` 赋值后 `resolvedOptions().locale` **仍是 `zh-CN`**（Intl 缓存 resolved locale）。
- 故 vitest 侧若照 §6.1.1 #2 写「显式传 `'en-US'` 求参考」：宿主 `zh-CN` 下 impl=`2026/11/10 17:43` vs ref=`11/10/2026, 05:43 PM` → **假 FAIL**。
- 正确 vitest 写法：参考值 locale 传 `Intl.DateTimeFormat().resolvedOptions().locale`（显式字符串 + 与 impl 同源），实测两种宿主均 true。
- 诚实边界：zh-CN 宿主下「硬编码 zh-CN」的错误实现会逃过 vitest 单 locale 断言 → 该职责由 e2e 5-locale 参数化承担（60/60 假 PASS=0 已验）。

## 步骤 R13:BLOCKER-B 独立实测（256 格 × 8 变体）
- `timeZoneName` 合法取值实测 **6 种**；`none`/`offset`/`generic` 均抛 `RangeError` → 「7 种」「65 变体」两个数都错（应为 6×5×2 = **60**）。
- `zh-CN` + `Asia/Shanghai` 逐值段数：`short`=6、`long`=5、`shortOffset`=6、`longOffset`=7、`shortGeneric`=5、`longGeneric`=5 → 确认「任意 timeZoneName 恒 ≥6 段」为假。
- **256 格全矩阵（32 locale × 8 时区）实测分布**：五字段 `{5:256}`、`+second` `{6:256}`、`long` `{5:256}`、`shortOffset` `{6:160,7:96}`、`longOffset` `{7:256}`、`shortGeneric` `{5:224,6:32}`、`longGeneric` `{5:224,7:32}`、`short` `{5:50,6:112,7:94}`。
- **本轮新增发现**：`short`/`shortGeneric`/`longGeneric` 的段数**还随 locale 与时区变**（非固定值）——主 Agent 给的「`short`/`shortOffset`=6」只在 5 locale × Asia/Shanghai 切片成立，全矩阵下 `short` 有 50 格是 5 段、94 格是 7 段。已据此写成「取值 + locale/时区双重依赖」的准确表述，避免重复上一轮「换了个假命题」的错。
- 判别力复验（浏览器内，`.agate-tmp/r2-power.mjs`）：6 取值 × 5 locale × 有/无 second = **60 个错误变体，假 PASS = 0；正确形态 5/5 PASS，假 FAIL = 0**。
- 跨引擎 ICU 对齐实测（Node ICU 78.3 vs Chromium 148）：16 locale 五字段输出**逐字符全等（0 差异）**——但这只是当下事实，不能作为判据前提，故 FIX-A（同引擎内现算）仍为首选。

## 步骤 R14:MINOR-01 ICU 稳定性论证限定到 BDD-07
- §8「边界说明」原笼统称「BDD-01/07 的判据（段数、去 GMT/UTC、子序列）在 ICU 版本间稳定」——同时含两个错误：① 笼统覆盖 BDD-01；② 残留旧判据描述（段数/去 GMT/UTC）。
- 改为按 BDD 分列表：**BDD-07 判据本身版本无关**（子序列是结构/顺序性质，不依赖排版模板）；**BDD-01 判据本身不具备版本无关性**，其跨 ICU 鲁棒性来自「参考值与实现同源现算」（FIX-A 同引擎 / FIX-B 同 locale），一旦改成硬编码或跨引擎取值，ICU 升级即假 FAIL。
- 并显式声明「BDD-01 的判据不再包含段数与不含 GMT/UTC，那两项已降级为参考值自检项 ②」。

## 步骤 R15:MINOR-02 `ui_affected` 引用
- 核对结论：`ui_affected` 由 **P2** 声明（`agate-frontmatter-check.py` 的 P1 schema `migrated_keys` 无此字段；`check-p6-provenance.py:657` 只读 `P2-design.md`）。
- 故**不**在 P1 frontmatter 补该字段（补了会成第二个真相源且被 P6 provenance 忽略）→ 选「改正文表述」：§9 P2 行改为「本任务属 **UI 可见改动**（`ui_render_shape: layout` + 四处渲染点文本变更），P2 需产出 UI 设计节，该节由 P2 自身声明 `ui_affected`」。

## 步骤 R16:MINOR-03 补结构化 scope_plus / scope_resolved
- P1 frontmatter 新增 `scope_plus`（SP1/SP2，各带 id + text）与 `scope_resolved`（同 id + note 说明落点）。
- id 命名沿用仓库既有惯例 `TPV0103:P1-requirements:SPx`（与 TPV0102 一致）。
- 正文两条 `[SCOPE+]` 行内补 id 回指，并注明「结构化登记见 frontmatter，P7 机械检查读字段不读散文」。
- 实测 `check-scope-resolved.py` → **exit 0**「结构化 scope_plus/scope_resolved 集合一致」。

## 步骤 R17:MINOR-04 §5.2 去掉 option 名
- 第 369 行「人工路径处改为与 `longOffset` 参考输出相比」→ 改为「与『完整到分钟的偏移』参考输出逐字符相等（参考值由运行时按该语义现算，不在需求层指定任何 option 取值）」。

## 步骤 R18:BLOCKER-A 门槛自跑验证（两种情形）
- **不假 FAIL**：照抄 FIX-A 代码块（含 `page.evaluate` 数组参数形式）在 5 locale 全过 → ①toEqual=true ×5、②seg==5=true ×5、③localeSensitive=true ×5（`.agate-tmp/r2-fixa-literal.mjs`）。
- **不假 PASS**：8 种实现形态 × 5 locale（`.agate-tmp/r2-fixa-wrong.mjs`）：
  | 实现 | 判 PASS locale 数 |
  |---|---|
  | 正确（五字段） | **5/5** |
  | +`second` | **0/5** |
  | +`timeZoneName`（6 种取值全测，共 6×5=30 组） | **0/5** |
  | +`hour12:false` | **4/5（仅 en-US 抓到）** |
- 最后一行是**诚实申报的已知弱项**，已写入 BDD-01 正文：`hour12:false` 只在 12 小时制 locale 可辨，守护点由 **BDD-04**（固定 en-US，正断言 `05:43 PM` 且否定 `17:43`）承担，**不在 BDD-01**。避免 P6 误以为 BDD-01 已覆盖。

## 步骤 R19:5 项已闭合 BLOCKER 回归核对（未被破坏）
| # | 核对 |
|---|---|
| 01 | BDD-01 locale 清单仍含 `sv-SE`（8 处提及），「钉子」论证原样保留 |
| 02 | BDD-08 仍据实判「空串/null → 主显与提示均为空串」，`useRelativeTime.ts:67` falsy 守卫依据保留 |
| 03 | BDD-11 ② 仍为 `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+`（版本号可占位） |
| 04 | §6.1 分类表与 §6.1.1 原样：8 偏移 + 1 秒级 = ≥9、5 处 `FOUR_DIGIT_YEAR`、3 常量删除 |
| 07 | BDD-12 Given 仍固定 `zh-CN` + `Asia/Shanghai`，③ 参考偏移 |
- BDD 编号：`#### BDD-01`..`BDD-12` 全部存在且连续（12 条）。
- 决策 D1、反转方向、对照 locale（sv-SE vs en-US，非 zh-CN/ja-JP）均未改。

## 步骤 R20:机械门禁最终全绿
- `check-frontmatter.py` → **exit 0**
- `check-pruning.py` → **exit 0**（RECONCILE 0 mismatches across 1 fields）
- `check-scope-resolved.py` → **exit 0**
- `check-structure-consistency.py` → **exit 0**（S0-S6 全 OK）
- `check-gate.py P1` → exit 1，**仅因 `P1-review.md` status 仍为 `needs-revision`**（评审轮次属主 Agent 流程，非本轮产出问题）
- 表格完整性专项：23 个表格块列数全一致（顺带修掉 §7 一处未转义 `|` 导致该表渲染错位）
- 代码围栏配对 OK、行内反引号全偶数。

## 步骤 R21:环境隔离 [PROD_NOT_TOUCHED]
- 全部 13 个探针落 `.agate-tmp/r2-*.mjs`（`.gitignore:105` 已忽略）。
- `git status --porcelain backend/tests frontend-v3/src frontend-v3/e2e` → **空**，未留任何 scratch 探针。
- `.state.yaml` 未改动（仍 `phase: P0`，未写 `status`）。
- 未触碰生产 `:8080`、未读写 `~/.peekview/`、未启动 uvicorn、未 pip/npm install。
- 状态标记二值：`[PROD_NOT_TOUCHED]`。

## retry 3（增量修复轮 3/3）— 2026-11-11

### 步骤 1：BLOCKER-C 根因与实测复现（已完成）
- 读到根因：`FIVE_FIELDS`（原第 177 行）pin 了 `timeZone:'Asia/Shanghai'`，而实现 `useRelativeTime.ts:17-19` 的 options 不含 `timeZone`（跟随运行时）→ 时区轴不同源。
- 真实 vitest 1.6 实跑（`.agate-tmp/r3/verify.spec.ts`，三种宿主）：
  - `TZ=Asia/Shanghai` → impl `2026/11/10 17:43` / ref(缺陷版) `2026/11/10 17:43` → PASS（恰好，本机永远绿）
  - `TZ=UTC` → impl `2026/11/10 09:43` / ref(缺陷版) `2026/11/10 17:43` → **假 FAIL 复现**
  - `TZ=America/New_York` → impl `2026/11/10 04:43` / ref(缺陷版) `2026/11/10 17:43` → **假 FAIL 复现**
  - 去掉模板 `timeZone` 后：三种宿主全 PASS（不假 FAIL）
- 真实 Playwright 1.60 实跑（`.agate-tmp/r3/pw-verify.mjs`）：未 pin `timezoneId` 的 describe 在 `TZ=UTC` / `America/New_York` 下缺陷版假 FAIL，方案 1 全 PASS；pin 了 `timezoneId` 的 describe 两版皆 PASS。
- 判别力：方案 1 下正确实现 5/5 PASS、8 类错误变体 36/40 抓（`hour12:false` 1/5，守护点归 BDD-04）、参考值 segCount 恒 5。

### 步骤 2：BLOCKER-C 选择方案 1（已完成落盘）
- 选定**方案 1**：`FIVE_FIELDS` 去掉 `timeZone`，固定时区改用 `test.use({ timezoneId })`（e2e）/ 进程启动前 `TZ`（vitest）。
- 已改 4 处：
  1. FIX-A 代码块（原第 177 行）：模板去掉 `timeZone`，加两条注释说明「不得含 timeZone」+「唯一固定手段是 test.use」
  2. FIX-B 代码块（原 195-199 行）：模板不 pin timeZone，注释改为「时区跟随运行时」
  3. vitest 代码块（原 227-231 行）：补 FIVE_FIELDS 定义（不含 timeZone）+ 三种宿主 TZ 下均成立
  4. §6.1.1 #2（原第 563/597 行）：**「显式传 locale+timeZone」已改写**为「locale 显式传 + timeZone 不传」
- 新增：
  - 「同源有两条轴」表（locale 轴 + timeZone 轴，各列实现真实来源 / 合法写法 / 错误写法后果）
  - BLOCKER-C 实测证据表（3 宿主 × 缺陷版/修正版）
  - 「固定时区只允许来自 context/进程级」三条 + 明确点名 e2e:248 / e2e:410 两个 describe 无 locale 无 timezoneId
  - **验收口径**：`TZ=UTC` 下 vitest 与 e2e 均全绿；`TZ=Asia/Shanghai` 下的绿不构成有效证据
  - §8 边界说明改写（MINOR-2）：两项增量（ICU 版本 / 时区来源不同源）

### 步骤 3：2 MINOR（已完成）
- MINOR-1：BDD-06 判据② locale 漏判数 7/32 → **8/32**，补 `bn-IN`（`GMT +০৮:০০`）。三处引用同步（BDD-06 正文第 341 行 / BDD-12 ③ 第 407 行 / §5.2 表第 494 行）。方向结论不变。
  - 自跑验证（`.agate-tmp/r3/bdd06-32.mjs`，P1 §5.1 同一份 32 locale 清单，`longOffset` + `Asia/Shanghai`）：
    `判据② /GMT[+-]\d{2}:\d{2}/ 漏判 = 8/32` — fr-FR(UTC+08:00)、da-DK(GMT+08.00)、fi-FI(UTC+08.00)、ar-EG(非ASCII)、he-IL(bidi)、fa-IR(非ASCII)、**bn-IN(GMT +০৮:০০)**、id-ID(GMT+08.00)
- MINOR-2：§8 边界说明改写为「两项增量」表（① ICU/CLDR 版本 ② 时区来源不同源），并说明修法不同。
  - 自跑验证（`.agate-tmp/r3/icu-tz-axis.mjs`）：Node ICU 78.3 vs Chromium 148 在 16 locale 上五字段输出 **0 差异**（① 当下为零，但非常量前提）；时区轴差异实证 node(宿主) `17:43` vs browser(timezoneId=UTC) `09:43` → **不同源成立**（②）。

### 步骤 4：A/B 与 5 项已闭合项未被破坏（自查）
- BLOCKER-A：FIX-A/FIX-B 两写法结构保留（仅模板去 timeZone + 注释增补），5/5 结论保留
- BLOCKER-B：§5.1 256 格分布表与「段数不可作判据」命题逐字未动
- 01（sv-SE 在清单）/ 02（BDD-08 空串据实）/ 03（BDD-11 标题正则）/ 04（改动面 8/1/5/3/5）/ 07（BDD-12 固定 locale）逐条未动
- 12 条 BDD 编号与主题未动；决策 D1、BDD-04 唯一守护点、反转方向、两处自主发现的坑、frontmatter 未动
- 主 Agent 上轮判错已澄清：BDD-01 第 255 行（现 288 行附近）「hour12:false → 4/5 逃逸」表述**按原样保留**（评审已复测确认正确）

### 步骤 5：验收口径自跑结果（写入 P1 §3.1 表）
| 侧 | 探针 | TZ=UTC | TZ=America/New_York | TZ=Asia/Shanghai |
|---|---|---|---|---|
| vitest 1.6（node env，逐行照抄 P1 最终代码块） | `.agate-tmp/r3/final-acceptance.spec.ts` | **10 passed**（09:43===09:43） | 10 passed（04:43===04:43） | 10 passed（17:43===17:43） |
| Playwright 1.60（复刻 FIX-A） | `.agate-tmp/r3/pw-final.mjs` | 未pin PASS / pin PASS / 5locale 5/5 / 错误变体 35-35 全抓 → 全绿 | 同上全绿 | 全绿 |
| 缺陷版对照（旧模板 pin 上海） | 同上 | **假 FAIL 复现** 09:43 vs 17:43 | **假 FAIL 复现** 04:43 vs 17:43 | PASS（恰好同区，缺陷不可见） |

→ **TZ=UTC 下正确实现不假 FAIL、错误实现不假 PASS，vitest 与 e2e 两侧均成立**（唯一硬验收通过）。

### 步骤 6：gate 脚本（均 exit 0）
- `check-frontmatter.py P1-requirements.md` → exit 0
- `check-pruning.py $TASK_DIR` → exit 0（RECONCILE SUMMARY: 0 mismatches across 1 fields）
- `check-scope-resolved.py $TASK_DIR` → exit 0（结构化 scope_plus/scope_resolved 集合一致）

### 步骤 7：环境纪律
- 生产 :8080 未触碰；`~/.peekview/` 未读写；未启动任何 backend；未 uvicorn 直启；未 pip install
- 探针全部在 `.agate-tmp/r3/`（node_modules 软链已删）；`backend/tests/` 与 `frontend-v3/src/` 零新增文件
- `.state.yaml` 未修改（git status 对该路径为空）
- 所有 bash 命令均由 `timeout` 包裹
- `[PROD_NOT_TOUCHED]`
