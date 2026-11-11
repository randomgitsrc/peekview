# TPV0103 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 立项 TPV0103 推翻 TPV0102 的「强制带时区名」——用户质疑成立：主显由浏览器时区决定本无歧义，`GMT+8` 是机器可读格式在人读界面的噪音
- DECISION: **不走 hotfix**（T074 先例判据是「≤3 行 + 现成测试覆盖」，本次生产代码虽约 3 行但测试断言本身就是判据要反转的部分，hotfix 会变成「自己改标准 + 自己判通过」）
- SUBAGENT OK(P1): analyst 产出 12 条 BDD / 0 NEED_CONFIRM / 2 SUGGEST。**两处实测发现纠正了我的 P0 判据**：
  - **① P0 的「`/GMT|UTC|[+-]\d/` 无命中」判据跨 locale 假 FAIL**——主 Agent 已亲自复验：`sv-SE`/`lt-LT`/`nl-NL`/`en-CA` 用 `-` 作日期分隔符，被 `[+-]\d` 误命中（`2026-11-10 17:43` → 判为"含偏移"）。analyst 改用「不含 `GMT`/`UTC` 子串 + `\p{Nd}+` 数字段数恰为 5」双条件
  - **② 主 Agent 复验了该双条件的判别力**（这是关键，不能只信）：「主显 5 段 / 含秒 6 段 / shortOffset 6 段 / longOffset 7 段」，**32 locale 全部一致**，三个方向互不重叠 → 判据有效
  - **但 analyst 正文的数字有一处错**：它写「shortOffset 7 段 / longOffset 8 段」，实测是 **6 / 7 段**。结论（5 段唯一）不受影响，但**正文数字须更正**，否则后人照它写断言会错 → 已列入 requirements-review 的核对项
- FACT(主 Agent 亲验的 locale 表): 主显输出实测——`zh-CN` `2026/11/10 17:43` / `en-US` `11/10/2026, 05:43 PM` / `de-DE` `10.11.2026, 17:43` / `fr-FR` `10/11/2026 17:43` / `fi-FI` `10.11.2026 klo 17.43` / `sv-SE` `2026-11-10 17:43` / `lt-LT` `2026-11-10 17:43` / `nl-NL` `10-11-2026, 17:43` / `en-CA` `2026-11-10, 05:43 p.m.`
- DECISION(采纳 analyst 的 D1): **不加 `hour12: false`**，并由 BDD-04 正断言 `en-US` 必须显示 `11/10/2026, 05:43 PM`——这条正断言的价值是**挡住后来者顺手强制 24 小时制**
- DECISION(采纳 analyst 的改动面修正): P0 的「26 处断言」是粗估（把注释/常量/mock/tooltip 一并计入且未分方向）→ analyst 精确为「需反转的主显断言 **8 处** / 需删常量 **3 处** / 须保留的 tooltip 断言 **5 处**」
- DECISION(采纳): TPV0102/TPV0103 P0 均写「三处渲染点」，但 `TimeDisplay` 实际有**四个消费方**（`EntryCard` / `EntryListRow` / `EntryDetailHeader` / `EntryMetaTagsBar`）→ BDD-05 按四处验证
- DECISION: ApiKey 两处本地 `formatRelativeTime` **不处理 + 不合并**——主 Agent 已核实它们只输出相对时间（`toLocaleDateString()` 无 timeZoneName），不受本次改动影响；且它们是 TPV0102 已登记的技术债
- NEXT: 派 requirements-review（重点核对 ① 数字段数分布的数字准确性 ② BDD 是否可二值判定 ③ 判据反转是否完整覆盖 BDD-01/03/04/26）
- GATE FAIL(P1 评审): requirements-review 判 **needs-revision**（7 BLOCKER + 3 MINOR）。**主 Agent 亲自复验了最关键的 BLOCKER-06，确认成立且指向我判据思路的根本缺陷**：
  - **实测实证**：`timeZoneName: 'long'` / `'shortGeneric'` / `'longGeneric'` 在 `zh-CN` 下输出 `2026/11/10 中国标准时间 17:43` / `2026/11/10 中国时间 17:43` —— **5 段、不含 GMT/UTC** → 我建议的双条件（段数==5 且无 GMT/UTC）**全部假 PASS**。即：用"文本特征"反推"实现没传 timeZoneName"是**错误方向**
  - **评审建议的替代方案我已实测验证**：「与参考格式化输出逐字符相等」能抓住 **全部 11 个错误变体**（无/含秒、short、long、shortGeneric、longGeneric、longOffset 各组合），且正确形态**不假 FAIL**。原理：不做字符串特征猜测，直接与参考实现输出比对 → 绕开 locale/时区名的一切形态差异
  - **注**：analyst 自己在 P1 §第 134 行写对了这个漏洞（「CST/EST 缩写段数仍 5」），但紧接着第 135 行的"合取完备性"论证没堵住 —— **自己发现了漏洞却没闭合**，属论证断裂
- FACT(评审其他成立项，主 Agent 抽验):
  - **BLOCKER-01**：BDD-01 原 locale 清单（zh-CN/en-US/ja-JP/de-DE）对旧正则全在假 PASS 侧 → 保护力为 0，必须纳入 `-` 分隔符 locale（`sv-SE`）
  - **BLOCKER-04**：改动面漏 `e2e/tpv0102-*.spec.ts:401`（`toContain(HH:MM:SS)`）+ 5 处 `FOUR_DIGIT_YEAR` 主显断言未判定 → 实为 **≥9 处**非 8 处，且那 5 处在新形态下**静默 PASS**（假绿）
  - **BLOCKER-05**：我上轮纠正 analyst 的「shortOffset 7/8 段」时，**我自己也漏了一层**——它同句的「5/6/7/8 互不重叠」同样错：shortOffset 与「含 second」**同为 6 段**，且非整小时时区（Kolkata/Chatham）shortOffset 为 **7 段**。正确表述应为「主显 5 段；含 second 或 timeZoneName **恒 ≥6 段**」
  - **BLOCKER-02**：BDD-08 空串项现状是 `""`（`useRelativeTime.ts:67` 的 falsy 守卫）而非「—」→ 按字面 P6 必 FAIL
  - **BLOCKER-03**：BDD-11 ② 要求 upgrading.md「按版本号记录」，但版本号 P8 才定、P6 在 P8 之前 → **P6 不可判定**（时序悖论）
  - **BLOCKER-07**：BDD-12 ③ 用 `GMT±HH:MM` 但人工路径未固定 locale/时区，而 BDD-06 自己用 7/32 locale 论证该形态 locale 敏感 → **同一份 P1 内自相矛盾**
- DECISION: 评审的 4 项正面结论采纳（BDD-04 正断言是有价值的防退化护栏、BDD-06 固定 zh-CN 不漏判、常量 3 处/tooltip 5 处/GMT 37 行/扫描 A 12 处准确）→ 回派 analyst 修订，**优先 BLOCKER-06**（判据真的漏判，是最实质的一条）
- NEXT: 写 `P1-dispatch-context-analyst-rev1.md`（增量修复 7 BLOCKER + 3 MINOR），注入 AGATE_CARD 后派发
- SUBAGENT OK(rev1): analyst 修订完成，7 BLOCKER + 3 MINOR 全闭合。**主 Agent 独立复验关键判据（未采信自述）**：
  - **BDD-01 新判据（与五字段参考格式化输出逐字符相等）实测有效**：13 个错误变体（7 种 timeZoneName × 含/不含秒组合）**全部被抓、0 假 PASS**，正确形态 PASS 不假 FAIL
  - **analyst 自主发现并报告了两处"按字面写会假 FAIL"的坑**（超出评审范围）：① 参考值与实现的 locale/时区必须**同源**，否则错配即假 FAIL ② **判据 ③ 的对照 locale 不能选 `zh-CN` 与 `ja-JP`**——主 Agent 实测两者五字段输出**完全相同**（都是 `2026/11/10 17:43`）→ 无区分力。已改 `sv-SE` vs `en-US`，主 Agent 复验确有区分力（`2026-11-10 17:43` vs `11/10/2026, 05:43 PM`）
  - **这条值得记**：analyst 这轮不仅修了我指出的问题，还发现**我在上轮 dispatch-context 里给的对照 locale 建议本身有缺陷**（我提议的 zh-CN/ja-JP 对照是无效的）
- FACT(BLOCKER-05 的数字最终定案，analyst 给了 256 格实测): shortOffset **6 段 ×160 + 7 段 ×96**（非整小时时区为 7）、longOffset **7 段 ×256**；正文改为「主显恒 5 段、含 second 或任意 timeZoneName 恒 ≥6 段」，删掉错误的「互不重叠」
- FACT(BLOCKER-02 决策): 选方案 (a)——空串/null 判「渲染为空串」（据实描述 `useRelativeTime.ts:67` 的 falsy 守卫现状），无法解析字符串单独判非空占位。**没有再制造"判据要求 A、现状是 B"的矛盾**
- FACT(BLOCKER-03 决策): 改为「标题匹配 `^## v\d+\.\d+\.\d+ → v\d+\.\d+\.\d+` + 正文含指定语义」，把确切版本号校验移交 P8 → **解除 P6/P8 时序悖论**
- NEXT: 重派 requirements-review（复审，重点核验 BLOCKER-06 的新判据是否真的假 PASS=0 + 其余 6 项闭合）
- GATE FAIL(P1 复审): requirements-review 第 2 轮判 **needs-revision**（5/7 闭合，2 条未闭合）。**主 Agent 亲自复验，两条完全成立，且其中一条比 BLOCKER-06 更严重**：
  - **【新 BLOCKER-A｜最严重】P1 推荐给 e2e 的「写法 A」在实现完全正确时必然假 FAIL**。主 Agent 实测三步坐实：
    ① **Node 进程 locale 由环境变量决定**，不受 Playwright `test.use({locale})` 影响：默认 `zh-CN`、`LANG=en_US.UTF-8` 下变 `en-US`
    ② **`test.use({locale:'sv-SE'})` 只改浏览器上下文** → 实现输出 `2026-11-10 17:43`；而写法 A 的参考值用 `undefined` 跟随 **Node 进程** → 输出 `2026/11/10 17:43`（zh-CN）或 `11/10/2026, 05:43 PM`（en-US）
    ③ **两者永不相等 → 实现正确也被判错**。评审的探针数据（本机 3/5 假 FAIL、CI `LANG=en_US` 下 4/5 假 FAIL）与该机制完全吻合
    **性质比 BLOCKER-06 更坏**：06 是判据有漏判（放过错误实现），A 是**判据会把正确实现判错**（制造假红）。而假红的下游处置最省力路径就是"把断言弱化回文本特征匹配"，正好重开 01 已堵的判据退化口子
    **两种修法主 Agent 均已实测有效**：FIX-A 浏览器内现算参考值（`page.evaluate`）/ FIX-B Node 侧**显式传 locale**（不用 `undefined`）。根本区别：**参考值不得跟随运行环境，必须显式指定**
  - **BLOCKER-B｜§5.1「任意 timeZoneName 恒 ≥6 段」为假**：主 Agent 实测 `long` / `shortGeneric` / `longGeneric` 在 `zh-CN` 下均为 **5 段**。且 `timeZoneName` 标准取值是 **6 种**（short / shortOffset / long / longOffset / shortGeneric / longGeneric），P1 写「7 种」「65 变体」是**算术错**（6 × 5 locale × 2 = 60）
  - **讽刺点**：我上轮刚把 analyst 的「5/6/7/8 互不重叠」纠正为「任意 timeZoneName 恒 ≥6 段」——**我这条纠正本身也是错的**，现被评审纠正回来。同一个 `long`/`shortGeneric`/`longGeneric` 的 5 段事实，我上轮明明实测过却在下结论时又忘了
- FACT(评审的 4 条 MINOR，不阻塞): ① ICU 稳定性论证需限定到 BDD-07 ② §575 引用 `ui_affected` 但 frontmatter 未声明该字段 ③ §10 两条 `[SCOPE+]` 只有散文、无结构化 `scope_plus`/`scope_resolved`（**P7 机械检查看不见**）④ §5.2 第 369 行仍指名 `longOffset`
- DECISION: 回派 analyst rev2，只修 2 个 BLOCKER + 4 MINOR，不动已闭合的 5 项
- NEXT: 写 `P1-dispatch-context-analyst-rev2.md`，注入 AGATE_CARD 后派发
- SUBAGENT OK(rev2): analyst 闭合 BLOCKER-A/B + 4 MINOR，5 项已闭合项未动。**主 Agent 独立复验（未采信自述）**：
  - **BLOCKER-B 的修正正确，且比它说的更强**：主 Agent 用**完整 256 格矩阵**（32 locale × 8 时区）实测——
    | 变体 | 段数分布 |
    |---|---|
    | `undefined`（正确形态） | **{5: 256}** |
    | `long` | **{5: 256}** ← **与正确形态完全无法区分** |
    | `shortOffset` | {6: 128, 7: 128} |
    | `short` | {5: 54, 6: 79, 7: 123} |
    | `shortGeneric` | {5: 224, 6: 32} |
    | `longGeneric` | {5: 224, 7: 32} |
    | `longOffset` | {7: 256} |
    → **`long` 在全部 256 格都是 5 段，与正确形态完全相同**。这比我原说的「恒 ≥6 段」错得更彻底，也再次证明「段数不能反推参数」这条路根本走不通
  - **analyst 主动纠正我的一处切片外推**：它说「`timeZoneName:short` 段数并非固定 6，全矩阵 {5:50,6:112,7:94}」——主 Agent 实测自己的矩阵为 `{5:54,6:79,7:123}`（数字略异因 locale/时区集不完全相同），但**结论一致**：short 的段数随 locale/时区跳变，我给的「short/shortOffset=6」只在 5×1 切片成立。**它没有照抄我的错话，而是改成「段数随取值×locale×时区共同变化」——这一步判断是对的**
  - **analyst 的 `hour12` 逃逸报告方向说反了，但结论成立**：它说「4/5 locale 逃逸、仅 en-US 抓到」，主 Agent 实测是 **4/5 抓到、仅 `en-US` 逃逸**（原因：en-US 本来就是 12 小时制，强制 `hour12:true` 对它是**无操作**，故测不出）。**结论一致且重要**：BDD-01 抓不全 `hour12` 错误 → 守护点必须归 BDD-04。它主动标注这一点是对的（避免 P6 误判覆盖强度）
  - **BLOCKER-A 修法采纳**：FIX-A（浏览器内 `page.evaluate` 现算）+ FIX-B（Node 侧显式传 locale）；并补了 vitest 侧额外陷阱（jsdom 下改 `process.env.LANG` 不生效，Intl 缓存在 resolved locale）
- FACT(rev2 的机械门禁): `check-frontmatter` / `check-pruning` / `check-scope-resolved` / `check-structure-consistency` **全 exit 0**（MINOR-03 的结构化 `scope_plus`/`scope_resolved` 已补，P7 可机械检查）
- NEXT: 重派 requirements-review 第 3 轮（重点核 BLOCKER-A 的两种修法是否真不假 FAIL/不假 PASS、BLOCKER-B 的段数表述是否彻底不再用作判据）
- GATE FAIL(P1 复审第 3 轮): requirements-review 判 **needs-revision**（1 BLOCKER-C + 2 MINOR）。**主 Agent 亲验，两项均成立，且其中一项是我上轮判错了**：
  - **【我错了】hour12 方向**：我上轮说「analyst 报告方向说反了」，**实际是 analyst 对、我错**。主 Agent 本轮实测区分两方向——
    | 错误实现 | 抓取 |
    |---|---|
    | **`hour12: false`（强制 24h）** | **抓住 1/5，4 个 locale 逃逸** ← 这才是 D1 要防的方向 |
    | `hour12: true`（强制 12h） | 抓住 4/5，仅 en-US 逃逸 ← 我上轮测的是这个 |
    我把两个方向搞混了。**analyst 原报告准确，P1 第 255 行表述无需改**。这个纠正已由评审指出，主 Agent 复验确认
  - **【新 BLOCKER-C｜真阻塞】`FIVE_FIELDS` pin 了 `timeZone:'Asia/Shanghai'` 但实现不传 `timeZone`（跟随运行时）→ 时区轴不同源**。BLOCKER-A 只补了 locale 轴，漏了 timezone 轴。主 Agent 实测：
    | 宿主 TZ | 实现 | 参考(pinned) | 判定 |
    |---|---|---|---|
    | `UTC` | `2026/11/10 09:43` | `2026/11/10 17:43` | ❌ 假 FAIL |
    | `America/New_York` | `2026/11/10 04:43` | `2026/11/10 17:43` | ❌ 假 FAIL |
    | `Asia/Shanghai`（本机） | `2026/11/10 17:43` | `2026/11/10 17:43` | ✅ PASS（**恰好**） |
    **最危险的特征**：`ci.yml` **不跑 vitest**（评审实测命中 0）→ **本机永远绿、他机必红**，属"本地绿 CI/他机红"的隐性陷阱。且成文化位置在 §6.1.1 #2「显式传 locale+timeZone」——**「显式传 timeZone」正是错误方向**，P3 会照抄
  - **修法（评审两种均已实测成立）**：方案1（推荐）去掉 `FIVE_FIELDS` 的 `timeZone`，e2e 用 `test.use({timezoneId})` 固定；方案2 给 `e2e:248/410` 补 `timezoneId` + vitest **启动前**设 TZ（运行时赋值 `process.env.TZ` 无效）。两者都须改写 §6.1.1 #2 的错误表述。**验收口径：`TZ=UTC` 下 vitest + e2e 全绿**
- FACT(评审的正面确认): BLOCKER-A/B **确认真闭合**——评审独立跑 256 格与 P1 §5.1 **逐格完全一致**，并把 FIX-A/FIX-B 按字面照抄成**真实 Playwright spec 实跑**（正确实现 5/5 PASS、8 类错误实现全抓）
- FACT(评审澄清 MINOR-2 成立): `ui_affected` 不在 P1 声明的理由成立——机制证据：`agate-frontmatter-check.py` 的 P1 schema required = `(risk_level, phases, packages, domains)`，`migrated_keys` 不含 `ui_affected`；`check-gate.py:_gate_p2_ui_design_section` 从 `p2_file` 读；`check-p6-provenance.py:654-658` 从 P2-design.md 读 → **P1 声明它既非必填也无 gate 读取**
- FACT(2 MINOR 不阻塞): BDD-06 的「7/32 漏判」实测为 **8/32**（多出 `bn-IN` `GMT +০৮:০০`），方向结论不变；§8 第 656 行「浏览器侧唯一增量是 ICU 版本」实际还有时区来源不同源（与 C 同源，一并改）
- DECISION: P1 retry 2/3 已用完两轮，剩最后 1 次。回派 analyst rev3 修 BLOCKER-C + 2 MINOR，**不动 A/B 及 5 项已闭合项**
- NEXT: 写 `P1-dispatch-context-analyst-rev3.md` 并派发
- SUBAGENT OK(rev3): analyst 选方案 1（`FIVE_FIELDS` 去 `timeZone`）+ 改写 §6.1.1 #2 错误指令 + 2 MINOR。**主 Agent 亲自用真实 vitest 复验了本阶段唯一硬验收**（未采信自述）：
  - 探针放进 `frontend-v3/src/composables/__tests__/`（vitest `include` 不扫 `../` 外部路径，首次放 `.agate-tmp/` 报 "No test files found"），跑真实 vitest 1.6.1：
    | 宿主 TZ | 实现 | 参考值 | 结果 |
    |---|---|---|---|
    | **`UTC`（CI 常态）** | `2026/11/10 09:43` | `2026/11/10 09:43` | **5/5 passed** ✅ |
    | `America/New_York` | `2026/11/10 04:43` | `2026/11/10 04:43` | **5/5 passed** ✅ |
    | `Asia/Shanghai`（本机） | `2026/11/10 17:43` | `2026/11/10 17:43` | **5/5 passed** ✅ |
  - **关键验证点全过**：① 正确实现不假 FAIL ② 参考值段数恒 5（判据自检）③ pin `Asia/Shanghai` 的错误实现**在非 Shanghai 宿主下与参考值不等**（判据有判别力）④ 多传 `second` 与参考值不等（不假 PASS）
  - **三宿主都自动同源** = 方案 1 正确的直接证据（参考值不 pin 时区 → 随宿主自然对齐）
  - 复验后**探针已删**（`zz-p1verify.spec.ts` + `.agate-tmp/p1verify`），`git status frontend-v3/` 干净
- FACT(rev3 的机械门禁): `check-frontmatter` / `check-pruning` / `check-scope-resolved` 均 exit 0
- NEXT: 重派 requirements-review 第 4 轮（终审）
- GATE PASS(P1): **终审 approved（BLOCKER=0）**，`check-gate P1` **exit 2**（approved + agent=requirements-review + BDD 锚点；2 个 SUGGEST WARNING 不阻塞）。评审独立复跑真实 vitest 1.6.1 三宿主均 10 passed
- **FACT(主 Agent 自纠一处测量错误)**: 我最初用一个跨字段正则提取 `reviewed_bdds`，把正文里的 `17/18/19...` 等数字也扫进来了，误判"不相等"。直接读该字段块确认是 `'01'`–`'12'` 共 12 项，与 P1 实际 BDD 集合相等；`check-gate P1` exit 2 亦为独立佐证。**教训：核对 frontmatter 字段要用 gate 脚本（权威）或精确读字段块，不要用跨字段正则**
- **P1 四轮评审的判据演进（全部由实测推翻，值得复盘引用）**：
  | 版本 | 判据 | 被实测推翻的原因 |
  |---|---|---|
  | 1 | 正则 `/GMT\|UTC\|[+-]\d/` 无命中 | 4/32 locale 假 FAIL（日期分隔符 `-` 误命中） |
  | 2 | 数字段数==5 且无 GMT/UTC | `long`/`shortGeneric`/`longGeneric` 假 PASS（均为 5 段） |
  | 3 | 与参考输出逐字符相等 | 判别力够，但写法假 FAIL（Node vs 浏览器 locale 不同源） |
  | 4 | + locale 轴同源 | 仍漏 timezone 轴（`TZ=UTC` 下假 FAIL） |
  | 5 | 两侧都不 pin locale/timeZone | 三宿主（UTC/New_York/Shanghai）全绿 ✅ |
  **其中三次是主 Agent 的判断错误**：① 正则判据是我提的 ② `long` 三个变体我实测过却在结论时忘了 ③ hour12 方向我测了 `hour12:true` 却拿它去"纠正" analyst 关于 `hour12:false` 的正确报告
- SUBAGENT OK(P1 全流程): analyst 三轮修订（rev1/rev2/rev3）+ requirements-review 四轮（3 次 needs-revision → 终审 approved）。**analyst 主动纠正主 Agent 3 次**（正则假 FAIL / short 段数是切片外推 / hour12 方向），主 Agent 纠正 analyst 2 次（数字段数 7/8→6/7、`互不重叠`表述——但后者我自己的替代说法也是错的）
- NEXT: commit P1 → 写 phase: P2 → 派 architect
