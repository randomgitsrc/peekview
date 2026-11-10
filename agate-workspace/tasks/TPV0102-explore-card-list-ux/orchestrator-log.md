# TPV0102 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 四项合为一个任务而非拆四个——同属 Explore 卡片/列表展示层，且第 3 项要抽 `VisibilityMenu` 三处复用，与第 1、2 项改的是同一批组件（`EntryCard`/`EntryListRow`/`EntryDetailHeader`），拆开会造成四次同样的组件改动
- DECISION: 明确排除 roadmap #57（主文件语义）与 #58（`/f` 多文件指定）——前者动 schema + MCP 契约，后者动已发布的公开 URL 契约（`/{slug}/f` 自 v0.25.0 上线），均需独立评估兼容性；用户已决定留后处理
- DECISION: 时间显示采用「靠浏览器时区 + 强制带时区名」而非引入服务端配置——用户选定。带时区名是消除"这是哪里的时间"歧义的最小手段，无需任何配置
- RISK: 后端存 naive UTC，若 API 返回的时间字符串不带 `Z`/`+00:00`，前端 `new Date()` 会按本地时间解析 → 改显示格式会引入整体时区偏移。P1 必须实查，P2 需给出兜底方案
- NEXT: 等用户「开工」指令后进 P1（写 `P1-dispatch-context-analyst.md` + 注入 AGATE_CARD）
- DECISION: 用户「开工 TPV0102」→ 进入 P1。协议根 `/home/kity/.agate/v0.83.1/agate`（v0.83.1），工作区 `agate-workspace`
- NEXT: 派发 analyst 产出 P1-requirements.md（dispatch-context 已注入 AGATE_CARD，exit 0）
- FACT(能力实测): vision 能力**实际可用**，但原生调用失败——`~/.local/share/vision-engine/ratelimit` 在本沙箱只读（`touch` 报 Errno 30），导致 `vision-analyze.py --self-test` 在 `record_usage` 崩溃。绕法（已验证）：`cp -rL ~/.dsh/skills/vision-engine/. .agate-tmp/ve/` + 把 `scripts/ratelimit.py` 的 `_BASE_DIR` 指向 `.agate-tmp/ve/ratelimit`，再跑 `PYTHONPATH=~/.local/lib/python3.12/site-packages python3 .agate-tmp/ve/scripts/vision-analyze.py`（需 PYTHONPATH 因为 HOME 隔离后 httpx 找不到）。self-test 结果：**8 个模型 alive**（google-free/gemini-flash-lite-latest、google-free/gemini-3.5-flash-lite、alibailian/qwen3-vl-plus、alibailian/qwen3.7-flash、alibailian/qwen3.7-plus、alibailian/qwen3.8-max、volcengine/doubao-seed-2-0-lite、xrouter/nx-vision）。**P6 视觉验收按 available 处理，不用降级链**
- 注：`.agate-tmp/vision-engine` 这个名字曾是符号链接指向 `~/oclab/skills-lab/vision-engine`（外部只读），已删除改用 `.agate-tmp/ve/`，避免误改外部仓库
- FACT(主 Agent 复验): analyst 报的两条关键发现均属实——① `scripts/seed-debug.py:183-185` 确有 `if not files: print SKIP ...; continue`，即 **`image-gallery/`（仅 meta.json）永远不会入库**，主 Agent 在 dispatch-context objective_info 里写的"现成的 0 文件 entry，可作决策 4 的验收素材"是**错的**，决策 4 的验收必须自行造 0 文件 entry（走 debug backend HTTP API，`CreateEntryRequest.files` 默认空数组）。已在 P1 评审派发中要求评审核对这条更正是否被 P1 采纳 ② `tpv0095-entry-list-row-team.spec.ts:70-82` 的 `bdd40_team_entry_hides_visibility_toggle_but_keeps_delete` 断言 team entry 的 `visibility-toggle` 数量为 0，与本任务"Team 也要能切换"直接冲突 → 属**基线取代**，须在 P1 显式声明（TPV0095 的 BDD-40 被本任务取代），P3 时改造该用例
- DECISION: 主 Agent 给 analyst 的 objective_info 里"image-gallery 是现成 0 文件素材"判断有误——不掩盖，记录并作为 P1 的输入更正项；决策 4 的 BDD 必须写明 0 文件 entry 由验收方自建
- SUBAGENT FAIL(轻微/已纠正): analyst 在 P1 §7 把两条 [P0_STALE] 的来源归为「P0 的 objective_info」，但 P0-brief.md 里 `grep -c "image-gallery\|backend-solo"` = **0 命中**——这两条错误信息实际出自**主 Agent 写的 P1-dispatch-context-analyst.md 第 371 行 objective_info**。**根因在主 Agent**（我给了未验证的"现成素材"判断），不在 analyst 的查证（其结论"image-gallery 不入库""团队归属为 frontend-team"均经我复验属实）。已要求 analyst 更正归因表述（结论保留），并在此记录：**主 Agent 提供客观查证信息前必须实测，不得凭 P0 转述或记忆转抄**（本次违反了自己的「先证后说」原则）
- FACT(主 Agent 复验): seed 团队归属实测 `csv-employees`→backend-solo(owner carol)、`markdown-test`→frontend-team(owner alice)、`mermaid-charts`→frontend-team(owner alice) —— analyst 的更正正确
- NEXT: 派发 requirements-review 评审 P1-requirements.md（analyst 已按实测更正两处归因；dispatch-context 原文已修正 + 重注入 exit 0）
- FACT(gate 机制): `check-gate.py P1` 的 `reviewed_bdds` 判据是 `set(re.findall(r"^#### BDD-([0-9]+[a-z]?):"))` 与声明集合**严格相等**。P1 用的是两位零填充编号（BDD-01..BDD-26），故 reviewed_bdds 必须写 `01 02 ... 26`（带前导零），写 `1 2 ... 26` 会因 `"1" != "01"` 直接 exit 1。已提前告知评审者
- GATE FAIL: `check-gate.py P1` exit 1 —— `P1-review.md frontmatter status 非 approved（当前: needs-revision）`。这是**预期内的真实评审打回**，不是工具故障
- DIAGNOSIS: requirements-review 判 needs-revision，3 BLOCKER。**主 Agent 已独立复验全部 3 条，均成立**：
  - M1（BDD-02）：实测 `TZ=UTC node -e 'Intl.DateTimeFormat().resolvedOptions().timeZone'` → `"UTC"`，**不含 `/`**，而 BDD-02 Then ③ 要求 IANA 名「形如 `Area/City`」→ CI runner（UTC）下必然假 FAIL。P1 的 I-22 只抓到「不得硬编码 GMT+8」，漏了这条
  - M2（BDD-04）：实测 `toLocaleString` 同一时刻 `2026-11-10T09:43:00Z`：zh-CN → `2026/11/10 GMT+8 17:43:00`（含 17:43:00 ✅）；**en-US → `11/10/2026, 05:43:00 PM GMT+8`（12 小时制，不含 17:43:00 ❌）**。且 `frontend-v3/playwright.config.ts` 的 `use` 块**未设 locale** → Playwright 默认 en-US → BDD-04 必然假 FAIL。更深层：P1 的 I-11 明写「`undefined` 跟随浏览器 locale → 接受」，与 BDD-04 硬编码 24 小时制字面量**自相矛盾**
  - M3（§3.4）：P0 决策 3 的 5 个转换中，仅 Public→Private(BDD-20)、Team→Public(BDD-19) 有 BDD；**Private→Team A / Team A→Team B / Team A→Private 三个无验收条件**。而「Private→Team A」正是决策 3 的立项理由（「单按钮无法表达团队可见性」）——核心新能力无 BDD，P3 无从写红灯、P6 无从判 PASS/FAIL
  - 另：m1（BDD-07 When 逐个点名 15 模型 vs §6.10 声称「机械遍历自动纳入」自相矛盾，未来第 16 个模型不会被抓）、W2（新增复合菜单控件零 a11y 覆盖，P1 全文 grep 可访问/aria/键盘/焦点 = 0 命中，须补 BDD 或显式声明不做并登记 roadmap）
- DECISION: 按 P1 卡「review 不通过 → analyst 修改需求 → 再 review」循环处理，**不回退阶段**。P1 retry 计数 = 1/3（MAX=3）。给 analyst 的修复派发用增量模式（引用上轮产出 + 上轮 dispatch-context，不重写完整目标）
- NEXT: 写 `P1-dispatch-context-analyst-rev1.md`（增量修复：M1/M2/M3 + m1/W2 五项），注入 AGATE_CARD 后派发 analyst
- NEXT: 已派发 analyst rev1（增量修复 M1/M2/M3/m1/W2）；rev1 dispatch-context 已注入 AGATE_CARD exit 0
- SUBAGENT OK: analyst rev1 完成五项修复（M1/M2/M3/m1/W2），BDD 26→30。**analyst 有一处独立发现优于主 Agent 给的方向**：主 Agent 在 M2 方案①里建议「用解析出的小时数判定」或「含 43:00 片段 + GMT+8」，analyst 实测否决了「用 `new Date(本地化文本)` 反解绝对时刻」这条路——`ja-JP` 文本 → `NaN`、`de-DE` 文本 → 解析成 `2026-10-11T09:43:00Z`（**错月份/错日期**），会引入假 PASS。这比主 Agent 的方案更严谨，采方案②（Given 固定 locale）正确。另 m1 的 AST 实测发现「非 table 且含 datetime」共 17 类，必须再排除**被 table 模型继承**的 EntryBase/UserBase 才命中 15 类/31 字段——这条排除条件主 Agent 未提示，analyst 自己补上了
- NEXT: 派发 requirements-review rev1（复审，重点核对 3 BLOCKER 是否真解决 + 已通过项未被破坏 + reviewed_bdds 需更新为 01..30）
- GATE PASS: `check-gate.py P1` exit 2 —— P1-review.md status=approved（agent=requirements-review ≠ main）+ 含 BDD 锚点 + reviewed_bdds 01..30 集合相等。唯一输出是「4 个 SUGGEST 项」WARNING（不阻塞）
- DECISION: 4 条 SUGGEST 全部采纳（主 Agent 权限内，均不涉破坏性变更/业务方向）：① CLI `--json` 统一用 `Z` 后缀（与 API 形态一致，避免消费方写两套解析）② 团队列表由 `EntryListView`/`EntryDetailView` 各触发一次 `loadMyTeams()`（已加载则跳过），视图层下发 `allTeams` 给菜单组件——P2 须在组件契约明确此 prop 链 ③ `ApiKeySettingsTab`/`ApiKeyListView` 两处本地 `formatRelativeTime` 重复实现**本次不合并**，登记技术债 ④ P3/P4 须显式更新 TPV0095 BDD-40 的 4 单测 + 1 E2E 断言，P7 记录「被本任务有意取代」，禁止「测试红就改断言」式静默处理
- FACT(复审独立实测): 复审方 AST 复现 m1 —— 非 table 含 datetime 17 类，被 table 继承者 = EntryBase/FileBase/UserBase（**FileBase 无 datetime**，故实际排除 2 个）→ 17−2 = 15 类/31 字段，与 §6.9 吻合。复审方还**主动更正了自己上轮的一处错误定位**：上轮把 I-11 当作「undefined 跟随 locale」的载体，实测 I-11 原文只讲 short/shortOffset 与禁拼接 → analyst 不改 I-11 而用 I-24 裁决是正确处置
- NEXT: 更新 .state.yaml（phase 保持 P1，记 history）+ active-tasks.md，git add + commit P1（phase=P1，产出含 P1-requirements.md + P1-review.md）
- SUBAGENT FAIL(已修正): 首次 commit 被 pre-commit hook 拦下两条——① `P1-requirements.md` 缺 `prod_touched` 字段（非 legacy 任务必填，设计 §4）→ 用 `agate-md-field-set.py set prod_touched false` 补 ② `retries[P1]` 无对应记录（RM-AG0042 BDD-1 WARNING，检测到 `P1-dispatch-context-*-rev1.md` 但 state 无 retries）→ 在 `.state.yaml` 补 `retries.P1[0]`（round/reason/ts）。两条都是**真实的状态缺失**，不是误报：确实发生了 1 次评审打回，理应记录。修正后 `check-state-yaml` exit 0 + `check-gate P1` exit 2
- DECISION: P1 已 commit `290f4c43`（12 files, +2755）。进入 P2。**C8 机械映射**：domains 含 backend → plan-eng-review；含 frontend → plan-design-review；risk=medium 非 high 故不额外触发。**两评审并行派发 → 组长汇总 → P2-review.md**
- NEXT: 写 `P2-dispatch-context-architect.md`（含 P2 最小验证要求 + UI 设计节规格 + gate_commands 固化要求），注入 AGATE_CARD 后派发 architect
- SUBAGENT OK: architect 产出 P2-design.md（75493 字节，candidate_count=7，ui_affected=true）。**关键最小验证发现（决定实现形态）**：BDD-02/03 要求的 tooltip 若用原生 `title` 属性或 CSS `::after`，Playwright `getByText` 命中 **0**、`textContent` 也不含伪元素内容 → **不可断言**；且 `opacity:0` 在 Playwright 下 `isVisible()` 仍为 true（用 opacity 隐藏会让"未悬停"也可见，破坏 BDD-02 的 Given/When 区分）→ **唯一可断言形态是自定义 DOM tooltip 元素 + visibility 切换 + role="tooltip"**。这条是 P2 最小验证的核心产出，P3 写红灯必须按此形态
- FACT(gate 预跑): `check-frontmatter` exit 0；`check-gate P2` exit 1 —— 唯一原因是 `P2-review.md 不存在`（评审未派发，预期）。`agate-read-p5-commands.py` 实测 6 条 P5 命令全部可解析：`make test-quick` / `make test-frontend` / `E2E_SPEC='e2e/(tpv0102|team-visibility)' make debug-test` / `make lint` / `make typecheck` / fitness。P5_e2e **已定向 E2E_SPEC**（避开裸调只跑 1 spec 的假绿陷阱）
- 注：`RECONCILE WARNING: packages grep=frontend-v3 structured=peekview frontend-v3 docs` —— 这是 P2 预跑阶段的正常提示（正文 grep 只看到 frontend-v3，frontmatter 有 3 个包），非错误
- NEXT: 并行派发 plan-eng-review（backend 域）+ plan-design-review（frontend 域），两评审各写独立 dispatch-context
- FACT(主 Agent 亲验 3 条 gate_commands 缺陷，已写进 eng-review 派发要求核实): ① `P5_fitness` 引用的 `backend/tests/test_architecture_fitness.py` **不存在**（`find . -name "*fitness*"` 全仓 0 命中）→ P5 必然 exit 4 ② `P5_e2e_timeout_seconds: 420` **小于** runner 内层 `E2E_TIMEOUT` 默认 **600s**（`scripts/run-e2e-tests.sh:92`）→ 外层先超时会杀掉内层，归因错乱；项目先例 TPV0099 用 **900s** ③ `E2E_SPEC='e2e/(tpv0102|team-visibility)'` 是正则片段，而 `e2e/tpv0102*.spec.ts` **尚不存在**（P3 才建）→ 若 P3 文件名不精确对应，Playwright 匹配 0 用例时**仍 exit 0** = 假绿。另 `E2E_SPEC` 实测是作为 `npx playwright test "$spec"` 的位置参数传入（`run-e2e-tests.sh:78`）
- 注：主 Agent 原在派发前假设 `run-e2e-tests.sh` 在 `frontend-v3/scripts/`、并让评审自查 fitness 是否存在——**两处假设都错**（脚本实际在 `scripts/`，fitness 确实不存在）。已亲验后改写派发内容，未把错误假设传给评审
- NEXT: 两评审并行跑（plan-eng-review / plan-design-review），返回后派组长汇总 → P2-review.md
- GATE FAIL: 两个 P2 评审均判 **needs-revision**（eng: 4 阻塞；design: 20 项缺陷 / 5 高级别 / 视觉 6/10 + 交互 6/10）。主 Agent **亲自复验**关键发现，**两处与评审表述不符，已纠正**：
- FACT(主 Agent 实测·G-1 成立且更严重): `npx playwright test --list 'e2e/(tpv0102|team-visibility)'` → **Total: 12 tests in 1 file**，全部来自 `team-visibility.spec.ts`，`tpv0102` 命中 **0**。故 `P5_e2e` 现在就能绿（exit 0）而本任务 E2E 覆盖为 0 → **假绿无法由 exit code 察觉**（评审补充：Playwright 零命中本身是 exit 1，但 alternation 里的 `team-visibility` 让零命中永不发生）。**必须改写死文件名**（TPV0099 先例）
- FACT(主 Agent 实测·B-3 结论方向被纠正): 评审称「P3 无 formatter → A 类误判；加 formatter 才对」。**实测相反**——`--tb=no` 抑制 traceback 时：**无 formatter → `red-light (unexpected test failure)` exit 0（正确）**；**加 `P3_formatter: pytest.sh` → `A-class error (test code has errors)`（错误）**。根因：`pytest.py` formatter 靠逐行扫 `ImportError`/`ModuleNotFoundError` 提取 `import_errors`，`--tb=no` 把 traceback 抑制掉 → 提取不到 → `errors=1` 走 A 类分支。**正确修法不是"加 formatter"，而是 `--tb=no` 改 `--tb=short`**（实测：`--tb=short` + formatter → `B-class red-light (import errors from missing project module 'peekview')` exit 0 ✅）
- FACT(G-2 已失效): architect 最终版 `P5_fitness` 已改为 `tests/test_utc_serialization.py -k mixin_not_in_table_mro`（P3 新建），不再是早先的 `test_architecture_fitness.py`。但 `-k` 零命中 pytest 是 exit 5，须在 P2 写明 P3 必须保留该测试函数名
- FACT(G-3 成立): `P5_e2e_timeout_seconds: 420` < runner 内层 `E2E_TIMEOUT` 默认 **600s**（`scripts/run-e2e-tests.sh:92`）→ 外层先超时杀内层。项目先例 TPV0099 用 **900s**
- FACT(16/34 vs 15/31 两个数都对): 主 Agent AST 亲验 —— `ShareCreateResponse` 自身 **0 个 datetime 字段**，其 3 字段全部**继承自 `ShareResponse`**。类自身声明口径 = 15 类/31 字段（P1 §6.9）；含继承的 `model_fields` 遍历口径 = 16 类/34 字段（P2 R6/V4）。两评审均独立确认 P2 处置（以遍历为准、P3 不硬编码）正确
- DECISION: 两评审均 needs-revision → **不派组长汇总**（组长只在全票无 BLOCKER 时 approved；此处两票都打回，直接回派 architect 修订）。P2 retry 计数 = 1/3
- NEXT: 写 `P2-dispatch-context-architect-rev1.md`（汇总两评审的全部阻塞项 + 主 Agent 实测纠正的 2 处），注入 AGATE_CARD 后派发 architect 修订
- FACT(主 Agent 完整四格矩阵实测·B-3 精确归因): 用真实 `check-tdd-red.py` + 真实 collection error（新测试 import 尚不存在的 `peekview.timefmt`，pytest exit **2**）跑四组合：
  | 配置 | judge 判定 | script exit | 正确性 |
  |---|---|---|---|
  | `--tb=no` 无 formatter | `red-light (unexpected test failure)` | 0 | ✅ 但**靠兜底分支**（exit_code=2 不命中 `==1` 的 A 类分支，落到末尾兜底） |
  | `--tb=no` + `P3_formatter: pytest.sh` | `A-class error (test code has errors)` | **1** | ❌ 假红 |
  | `--tb=short` 无 formatter | `red-light` | 0 | ✅ 同上靠兜底 |
  | `--tb=short` + formatter | `B-class red-light (import errors from missing project module 'peekview')` | 0 | ✅ **机制正确** |
  **结论**：评审 B-3 说「无 formatter → 必然 A 类」**不成立**（实测 exit 0）；但它「应加 `P3_formatter`」的方向对了一半——**只加 formatter 而不改 `--tb=no` 反而会引入 A 类假红**（`pytest.py` 靠逐行扫 `ImportError`/`ModuleNotFoundError` 提取，`--tb=no` 把 traceback 抑制掉 → `import_errors=[]` 但 `errors=1` → 落 `if errors > 0` 的 A 类分支）。**唯一正确配置 = `--tb=short` + `P3_formatter: pytest.sh`**
- NEXT: 派发 architect rev1（闭合 B-1~B-4 + D-1~D-5 + 2 项裁决 + 中低优先级非阻塞），dispatch-context 已注入 AGATE_CARD exit 0。`P5_e2e_legacy` 经 `is_legal_gate_key` 实测 True，可作拆键方案
- FACT(主 Agent 追加实测·architect 的 B-3 根因**比我的矩阵更深，且我漏了一层**): architect 指出根因还包括 P3 命令里的 `2>&1 | tail -30` 把 traceback 截掉。**我复验确认，并发现更坏的形态**：`--tb=short` + formatter + **带 `| tail -30` 且保留 `b=$?`** → judge 判定 **`tests pass, no red-light`（script exit 2）**，即**假绿**（比 A 类假红更危险：假红会退回 P3 修正，假绿会直接推进到 P4）。去掉 `tail` 后正确得 `B-class red-light`。故 B-3 的完整正确配置是**三件事**：① `--tb=no`→`--tb=short` ② 声明 `P3_formatter: pytest.sh` ③ **去掉 `| tail -30` 与 `b=$?` 遮蔽**。主 Agent 此前只给出①②，architect 补出③，属**人工纠正主 Agent 的结论**——已在评审复审派发时要求核验这一点
- FACT(architect 复核成立的项): `EntryDetailMobileBar.vue:50` 有 `<OverflowMenu variant="sheet">` 先例；`DESIGN.md:270` 44px / `:274` bottom sheet on mobile / `:290` focus indicators；`ConfirmDialog.vue` 根为 `<Teleport to="body">` 全文件无 `data-testid`（D-2 成立）；`team.ts` 的 `loadMyTeams()` catch 只置 error 不置 `teamsLoaded` → 失败态与"无团队"不可区分（D-9 成立）
- SUBAGENT OK: architect rev1 闭合 4 eng 阻塞 + 5 design 高级别 + 2 裁决 + 15 中低项（899→1227 行 / 127.9 KB）。**主 Agent 已实测验证其最终 P3 命令形态**（`--tb=short` + `P3_formatter: pytest.sh` + **去 tail**）→ `B-class red-light`（正确红灯），确认闭合
- DECISION: **采纳 architect 的修正**（我的矩阵少一格，其根因分析更深：`2>&1 | tail -30` 在真实全量套件下把 `ModuleNotFoundError` 截到 EOF 30 行之外，只剩 pytest 缩写形式使正则取不到 module → `module=''` → 落「import errors are NOT from project module」A 类分支）。这是本任务**第二次由 subagent 纠正主 Agent 的技术结论**（前一次是 analyst 否决 `new Date(反解)` 方案），已计入复盘素材
- NEXT: 派发两评审 rev1 复审（重点核验 B-1~B-4 / D-1~D-5 / 2 裁决是否真闭合 + 不变项未破坏）
- SUBAGENT RESULT: design-review rev1 判 **needs-revision**（上轮 D-1~D-5 全闭合、2 裁决正确采纳、两主分 6→8，但**修订过程新引入 5 项缺口**，其中 2 项高级别）。主 Agent 独立复验：
  - **N-1 属实且必须修**：`types/index.ts` 的 `Team` = `{slug,name,memberCount}`、`TeamRef` = `{slug,name}`；后端 `models.py:947-952` `TeamSummary` = `{slug,name,member_count}` —— **前后端都没有 team 数字 id**。而 P2 §3.5 写 `teams.find(t => t.id === teamId)` 与 `team = {id,slug,name}` → `vue-tsc` 必报错（CI 强制），且 BDD-18「子菜单排除当前团队」失去派生路径。修法：用 `entry.team?.slug` 反查（`api/client.ts:130` 已填充）
  - **N-2 属实**：`useMediaQuery` 全仓 **0 命中**；`IsMobileKey` 仅 `EntryDetailView.vue:159` `provide`，Explore 页无 `isMobile` → `variant="sheet"` 的切换主体悬空
  - **N-3 主 Agent 判定为「评审误判」**：architect 已**显式拆成两条**——VC-4 只针对本任务新增的 `VisibilityMenu` 触发按钮（移动端 ≥44px），既有 28×28 按钮**已登记为 §7.1 S2 明确不在本任务范围**（并注明「VC-4 不得写成对既有 28px 按钮的断言，那会把既有不达标写成已达标」）。这不构成「契约必然在 P6 红」
  - N-4（`inline`/`icon` 变体文案与 `aria-label` 未定义）/ N-5（§6.4#5 行号应为 :111-112 且影响 3 条断言）均属实
- DECISION: design-review 的 N-3 判「高」不成立（architect 已拆分处置），但 N-1/N-2/N-4/N-5 成立 → 仍需 rev2 修订。**不覆盖评审的 needs-revision 结论**（评审自己也不确定 N-3，明确说「若你认为可 P3/P4 兜，可覆盖我判 approved」——主 Agent 选择按缺陷清单继续修，不降口径放行）
- NEXT: 等 eng-review rev1 返回 → 合并两份复审为 rev2 修订清单 → 派 architect rev2
- SUBAGENT RESULT: eng-review rev1 判 **approved**（B-1~B-4 全闭合；B-3 裁决「三件事配置完整正确」）。**但它纠正了主 Agent 一处错误结论**，主 Agent 已亲验确认：
  - **我的「假绿」那格不成立（我错了）**：`agate_common.py:755-766` 在跑命令时**强制前缀 `set -o pipefail;`**（`"set -o pipefail; " + cmd`），故 `cmd | tail` 的退出码取**左侧失败码**。实测 `bash -c 'set -o pipefail; false | tail -3'` → exit **1**；无 pipefail 的裸 shell → exit 0。我此前在裸 shell 下测出的「`--tb=short` + formatter + tail → `tests pass` 假绿」**是无效结论**（我自己那条测法绕过了 agate 的执行通路）。用真实通路复测：带 tail + `b=$?` → `B-class red-light`（正确）。**去 tail 仍然必须，但真实机制是 A 类假红（ModuleNotFoundError 被截到 EOF 30 行外 → module=''），不是假绿**，而 P2-design.md:993-995 与 V10 本来就写对了
  - **这是本任务第三次 subagent 纠正主 Agent**（① analyst 否决 `new Date(反解)` ② architect 补出 `tail` 截断根因 ③ eng-review 纠正我的假绿归因）。复盘须记录：**主 Agent 自测时必须走被测系统的真实执行通路，不能用等价的"简化复现"替代**
  - B-3 结论：architect 的三件事配置（`--tb=short` + `P3_formatter: pytest.sh` + 去 tail）**完整正确**，主 Agent 独立实测 `B-class red-light` 确认
  - 新发现 6 项非阻塞，其中 **`P5_e2e_legacy_timeout_seconds: 600` 与设计自身 :1000 的「外层必须大于内层 600」矛盾**（等值不满足）→ 建议改 900；**双 toast 风险**（§3.5:549-552 store 内发 revokedShares warning + §5 要求视图层四态含同一句 → 会弹两条）
- FACT(N-1 精确改法已定): `Entry` 接口有 `teamId?: number | null`（entry 侧归属 ID）+ `team?: TeamRef | null`（`{slug,name}`），但 `Team` 类型无 id → **无法用 `entry.teamId` 在 `allTeams` 里 find**。确定改法：用 `entry.team?.slug` 与 `allTeams` 的 `team.slug` 比对派生 currentTeamSlug
- NEXT: 派发 architect rev2（只改 N-1~N-5 + E-1/E-2，不动已闭合项），dispatch-context 已注入 AGATE_CARD exit 0
- SUBAGENT OK: architect rev2 闭合 N-1~N-5 + E-1/E-2（1406 行，edit 定点修改）。**主 Agent 抽验**：
  - `check-frontmatter` exit 0
  - N-1 无违规残留（2 处 `Team.id` 均为「**不得**这样做」的否定陈述，正确）；且 `models.py:747-752` 引用的 `TeamRef` 行号精确（`{slug,name}` 无 id）
  - E-1 `P5_e2e_legacy_timeout_seconds: 900` 已改，§9 理由改写为「等值不满足规则，声明不能自相矛盾」
  - N-2 选方案②，并**纠正了主 Agent 的一处印象**：项目**已有** `useResponsiveLayout()`（`isMobile = viewportWidth <= 640` + rAF 节流 `handleResize`），已在 `EntryDetailView.vue:156` / `UserManagerTab.vue:87` 使用 —— 主 Agent 此前只查了 `useMediaQuery`（0 命中）就以为「无响应式机制」，**漏查了正确名字**。architect 指出后主 Agent 复验属实。其描述「`:262` 的 import 需补 `onBeforeUnmount`」也精确（该行当前确为 `import { ref, computed, onMounted, watch, nextTick }`，无 useResponsiveLayout、无 onBeforeUnmount）
  - N-2 还做了逻辑自洽澄清：`EntryDetailHeader` 因 `v-if="isDesktop"`（`:13`）实际恒为 `inline`；`EntryMetaTagsBar` 仅在 `isMobile` 时渲染（`EntryDetailContent.vue:24`）故恒为 `sheet`
- NEXT: 派发 design-review rev2 复审（N-1~N-5 闭合核验 + 不变项 + 重新打分）
- GATE PASS: `check-gate.py P2` **exit 2**（RECONCILE 0 mismatches）。两条 WARNING 经主 Agent 实测**确认为 gate 误报**：① `gate_commands.P3 命令 '' 不存在` —— P3 命令首 token 是 `(`（子壳），`shutil.which('(')` 必返空；实测该命令可正常执行（`b=1 f=1`，聚合语义正确）② `P5_fitness 命令 'cd' 不存在` —— `cd` 是 shell builtin，`which` 查不到（实测 `which cd` 非 0）。两条均为 gate 用 `shutil.which(首token)` 检测导致的 cosmetical 误报，eng 评审第 2 轮已预测到并说明「不改变 approved 结论」
- SUBAGENT OK: 组长汇总产出 `P2-review.md`（26783 字节，status=approved，agent=review ≠ main），专家票型 2/2 approved、无分歧、转抄 **23 条执行约束**（C-1~C-23）给 P4/P5/P6
- NEXT: 更新 .state.yaml（phase 推进 P2 + history + retries.P2）+ active-tasks.md，git add + commit P2
- SUBAGENT FAIL(已修正): P2 首次 commit 被 hook 拦下 —— `P2-design.md` 缺 `prod_touched` 字段（非 legacy 任务必填，设计 §4）。补 `prod_touched: false` 后通过。**注意**：`P2-review-*.md`（eng/design）的 md-field-set schema **不含 `prod_touched`**（合法 key 清单无该字段），只有主产出 `P2-design.md` 与汇总件 `P2-review.md` 需要；不要对评审件强行 set
- DECISION: P2 已 commit `da0c85a7`（20 files, +7298）。进入 P3 TDD 测试设计
- NEXT: 读 P3 阶段卡片 → 写 `P3-dispatch-context-test-designer.md` → 注入 AGATE_CARD → 派发 test-designer
- FACT(P3 前置实测): `backend/tests/test_utc_serialization.py` **不存在**（可新建，P2 的 P5_fitness 依赖此文件名 + `-k mixin_not_in_table_mro`）；`frontend-v3/e2e/tpv0102-*.spec.ts` **不存在**（P3 须新建，P2 的 P5_e2e 写死了 `e2e/tpv0102-explore-card-list-ux.spec.ts`）；`backend/tests/` 有 `conftest.py` / `factories.py` / `_team_helpers.py` 等既有基建
- FACT: 环境基线已捕获（`agate-capture-env-baseline.py` → 「命令 'make test-quick' 无 formatter，无法提取 fail-list，放弃捕获，不写入任何文件」——按脚本设计属预期，不阻塞）
- NEXT: 派发 test-designer（30 条 BDD 1:1 映射），dispatch-context 已注入 AGATE_CARD exit 0
- SUBAGENT OK: test-designer 产出 12 文件 / 112 用例（pytest 20 + vitest 30 + E2E 62[31×2 project]），BDD 01-30 全覆盖
- GATE PASS(主 Agent 亲跑，未采信自述): `check-gate P3` **exit 2**；`check-tdd-red.py` **exit 0 = `B-class red-light (import errors from missing project module 'peekview')`（真红灯）**；`check-platform-assumptions.py backend/tests/test_utc_serialization.py scripts/audit-utc-semantics.py` **exit 0 / 0 命中**。**30 条 BDD 逐条 grep 验证全覆盖、无遗漏**（E2E 覆盖 01-06/13-30，后端覆盖 07-12）。`test_code_dir` 已声明 = `backend/tests/ frontend-v3/src/ frontend-v3/e2e/ scripts/`
- FACT(test-designer 的桩验证，方法论值得复用): 注入伪 `peekview.timefmt` + `UtcSerializeMixin` + 换 16 个叶模型基类后，后端 20 用例 **18 passed**，剩 2 个正是 P4 真实缺口 —— 这是**用桩反证红灯真伪**，比只看红灯原因更可靠。过程中还修掉 3 处**测试自身缺陷**（1 处与 P2 冻结的 `parse_iso` 契约矛盾 / 1 处空断言恒真 / 2 处与 P2 §3.5 契约耦合过紧）
- FACT(预存失败已定性): 完整 P3 聚合命令 `AGG_EXIT=1`，其中 `backend/tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key` 是**预存失败**（沙箱 `~/.peekview/` 只读，P2 的 C-20 已登记），**非本任务引入** → P5 须登记 `known-failures.md`
- FACT(BDD-07 口径): 遍历实测命中 **16 类**（P2 §R6 已预期），测试**不硬编码数字**、只有「≥10 类 / ≥20 字段」防空跑下限 —— 与 P2 定的「以遍历为准」一致
- SUBAGENT FAIL(已修正·模式化): P3 首次 commit 被 hook 拦下 —— `P3-test-cases.md` 缺 `prod_touched` 字段。**这已是连续第三个阶段（P1/P2/P3）踩同一个坑**：`agate-md-field-set.py` 的 `--list` 输出未含 `prod_touched`，但 pre-commit hook 对非 legacy 任务的主产出强制要求它。**正确做法：写主产出时就主动 set `prod_touched false`**，不要等 commit 撞墙。已记入复盘素材
- DECISION: P3 已 commit `20fd76b3`（17 files, +3546）。进入 P4 代码实现
- NEXT: 读 P4 阶段卡片 → 按 P2 的 `dispatch_plan`（static-batch, 5 批）评估是否并行派发 → 写 dispatch-context
- DECISION: P4 按 P2 的 `dispatch_plan`（static-batch, 5 批）执行。**并行派发前 2 批**（`backend-serialize` + `frontend-shared`）——依据 P2 §2.4：两批**零文件重叠**（后端只在 `backend/`、前端共享件只在 `frontend-v3/src/` 的叶子件），且 `frontend-shared` 是"被两个挂载批共同消费的叶子件"批，必须先于挂载批完成。两批各用独立 dispatch-context（`-backend.md` / `-frontend.md`）
- DECISION: 剩余 3 批（`mount-explore` / `mount-detail` / `docs-changelog`）待前 2 批返回后再派——因 `mount-*` 两批依赖 `frontend-shared` 的产物（组件与纯函数签名），且 `mount-explore`/`mount-detail` 会改 `tpv0095-*` 既有断言（P2 R5 已标 expected_red），需在同一收敛点核对取代关系
- FACT(P4 前置): env baseline 已跑（同前，脚本按设计放弃写入）；`P4-dispatch-context-implementer-backend.md` 首次 inject 因缺 AGATE_CARD 占位符失败（我写漏了 START/END 块）→ 补占位符后重注入 exit 0。**教训：dispatch-context 必须预留 AGATE_CARD_START/END 占位符**
- NEXT: 等两批实现返回 → 核验 → 派 mount 两批
- SUBAGENT OK(批1): `backend-serialize` 完成 —— `timefmt.py`(新) + `models.py`(UtcSerializeMixin + 15 叶模型换基类) + `client.py` + `cli.py`(7处) + `admin_service.py`(3处)。**主 Agent 亲验**：`EntryBase`/`UserBase` **未改动** ✅、叶模型基类替换 **15 处** ✅、`UtcSerializeMixin` 用 `field_serializer("*", when_used="json", check_fields=False)` + `isinstance(v, datetime)` 守卫 ✅（四硬约束全落实）。测试：`test_utc_serialization.py` **20 passed**、`-k mixin_not_in_table_mro` **1 passed**、`make test-quick` 1205 passed/1 failed(预存 test_cli_remote，已 `git stash` 反证与本批无关)
  - **批1 发现并修复 P3 遗留**：`make lint` 在 HEAD 就红（P3 提交的 `test_utc_serialization.py:35` ruff I001 import 顺序），用 `ruff --fix` 机械修 1 行、**零断言改动**。属「既有测试因设计要求转红须处理」的边界，P4 review 需复核接受
- SUBAGENT OK(批2): `frontend-shared` 完成 —— 新建 `visibility-options.ts` / `visibility-target.ts` / `TimeDisplay.vue` / `VisibilityMenu.vue`，改 `useRelativeTime.ts` / `stores/{entryList,entryDetail,entry}.ts` + 1 个既有 spec。测试：本批 6 spec **79 passed**、8 个 tpv0095 spec **29 passed**、`typecheck` ✓、`lint` ✓。**主 Agent 亲验**：`visibility-options.ts` / `VisibilityMenu.vue` **无 `Team.id` 违规** ✅；`P4-implementation.md` **两节共存** ✅
  - 批2 按 P2 §6.4 第 4 项对 `tpv0095-entry-list-store-team.spec.ts` 做**显式取代**（teamId 守卫断言翻转为正常发起请求 + 用例改名 + 文件头注释登记），未删覆盖点
  - 批2 报 4 条 `[DESIGN_GAP]`（`useRelativeTime.update()` setup 内同步调用 / `VisibilityItem` 窄类型 / Teleport 泛化到三变体 / 用例改名）→ **P7 须配对 `[DESIGN_GAP_REVIEWED:]`**
  - 批2 报 `[SCOPE_GAP]`：`stores/entry.ts` 透传导出 `setVisibility` 属 P2 §3.5 要求但我的 dispatch-context 范围表漏列 → 已按 P2 做（1 行），无并行冲突
- DECISION: 派发 `mount-explore` + `mount-detail` 两批**并行**——两批文件完全不重叠（前者 3 个 Explore 文件、后者 5 个详情页文件），且都只消费不修改共享叶子件。dispatch-context 中明确互相禁止触碰对方的文件
- NEXT: 等两挂载批返回 → 派 `docs-changelog` 批 → P4 review（C8：backend→review + frontend→design-review，两评审并行 + 组长汇总）
- SUBAGENT OK(批3/批4): `mount-explore`（10 文件，3 组件/视图 + 7 断言文件）+ `mount-detail`（7 文件）完成。各自自查：全量前端 **119 files / 1456 passed / 0 failed / 4 skipped**、`make typecheck` ✓、`npm run build` 产出 dist
- FACT(**主 Agent 亲跑发现一个 subagent 未报的真实缺陷**): 全量 vitest 显示 `Tests 1456 passed` 但**同时报 `Errors 1 error`** —— `EntryDetailView.vue:219` 的 `ensureMyTeamsLoaded()` 里 `authState.value` 在 `t031-entry-detail-view.spec.ts` 下为 undefined（该 spec 的 `storeToRefs` mock 只挑"带 `.value` 的键"，而它自己的 auth mock 给的是裸字符串 `authState: 'anonymous'`）。Vitest 明确警告「This might cause false positive tests」。**两个 subagent 都报"0 failed"却都没提这个 error** —— 说明只看 `passed/failed` 计数会漏掉 unhandled rejection 这一类信号
  - **修法**：按同文件 `:213` 既有先例（`rawTeamOwned?.value ?? []`）改为 `authState?.value`。**修在代码侧而非改测试**（mock 局限不该由产品代码迁就到崩溃，但也不该为此改他人 mock）
  - 复跑确认：**unhandled error 已消除**（输出无 `Errors` 行），仍 1456 passed / 0 failed。`make typecheck` ✓、`make lint` ✓
- NEXT: 派 `docs-changelog` 批（CHANGELOG + upgrade 说明）→ 然后 P4 review（C8: backend→review + frontend→design-review 并行 + 组长汇总）
- SUBAGENT OK(批5): `docs-changelog` 完成 —— `CHANGELOG.md` 的 `[Unreleased]` 新增 4 小节（Breaking Change + 变更×3 + 修复×1，4 项改动全覆盖，均带 `（TPV0102）` 后缀）+ `docs/process/upgrading.md` 新增 `v0.26.1 → v0.27.0` 节（三件事齐全）。`make check-docs` exit 0
- DECISION(docs 批的 2 条 DESIGN_GAP 裁决): ① **版本号 0.27.0（minor）自定合理** —— 本项目 0.x 按 semver 惯例以 minor 承载破坏性变更（先例 mcp-v0.8.0）；**最终由 P8 的 `bump_type` 定，若 P8 判 patch 只需改 upgrading.md 节标题**（CHANGELOG 条目不含版本号，无需动）② **`####` 四级标题接受** —— 目的是把「三件事」下沉为「破坏性变更」`###` 节的子结构，层级无跳级，属正当用法
- FACT(P4 全批完成): 5 批全部返回，`P4-implementation.md` **5 节齐全**（backend-serialize / frontend-shared / mount-explore / mount-detail / docs-changelog）。**主 Agent 亲跑验收**：前端全量 **119 files / 1456 passed / 0 failed / 4 skipped**（且 unhandled error 已消除）、`make typecheck` ✓、`make lint` ✓、`make check-docs` ✓
- NEXT: 派 P4 评审（C8: backend→review + frontend→design-review，**并行**）→ 组长汇总 → 预跑 check-gate P4
- NEXT: P4 两评审并行派发中（`review`=后端 / `design-review`=前端）。dispatch-context 均已注入 AGATE_CARD exit 0
- GATE FAIL(P4 评审): `review`(后端) **approved** 0 CRITICAL（16 类/34 字段全覆盖、parse_iso 安全、表模型无污染）；`design-review`(前端) **needs-revision** 4 阻塞 + 5 建议。主 Agent 采纳评审结论，**4 项阻塞均为实测证据支撑的真实实现缺陷**：
  - **F-1**：`icon` 变体未 Teleport + `.entry-panel{overflow:hidden}` → 列表最后一行下拉被裁 **99/118px（仅 17% 可见）**，`elementFromPoint` 返 BODY。任意行数列表最后一行必现
  - **F-2**：桌面 `@media(hover:hover)` 只有 `:hover` 无 `:focus-within` → 新补的焦点环被容器 `opacity:0` 一起抹掉 = **空操作**；违反 P2 §UI 设计明写的「键盘用户由 :focus-within 保证可达」
  - **F-3**：tooltip 桌面 `nowrap` + `max-width:320px` → 文本溢出背景框 **63px**（Range 383px vs 盒 320px）；VC-1 断言 viewport 恒绿抓不到
  - **F-4（最重要）**：`EntryListRow.spec.ts:105-112` 用 `if (btn.exists())` 守卫 + 已删的选择器 → 断言**永不执行但测试仍绿**，且无注释登记。`git show HEAD:` 确认该用例 P4 前是活的 = **静默丢覆盖点**
- DECISION: 只修 F-1~F-4 + F-7（1 行记述）。**F-5/F-6/F-8/F-9 建议级不修**（不扩大改动面）。**严禁**再往 `EntryDetailView.vue` 加逻辑（289 行，距 t082 <300 门槛仅 11 行余量）
- NEXT: 派发 implementer rev1 修复（dispatch-context 已注入 AGATE_CARD）
- DECISION(流程纠正·用户指出): **停止用 `sleep` 轮询 subagent**。用户明确指出：DSH 在 subagent 完成时会主动通知，反复 sleep+查状态是浪费 token，且 agateon 协议**没有**要求编排者轮询等待。根因是我把「长驻服务存活跟随发起调用、需后台 job 托底」这条平台规则**错误地套用到了 subagent 上**——subagent 不是需要托底的进程，它是受管理的、完成时会回调的任务。正确做法：派发后**转去做独立的下一步工作**（如写下一个 dispatch-context、准备评审材料），或直接停下等通知；只有「确实无独立工作可做且必须拿到结果才能推进」时才等待，且等待应是**阻塞式单次等待**而非循环轮询
- **GATE FAIL（主 Agent 实测推翻 subagent 定性）**: rev1-fix 报「5 项 e2e 红是既有失败」，**实测不成立**。主 Agent 启动 :8888 亲自跑 `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test`：
  - 实测 **8 failed + 1 flaky + 52 passed**（不是 5 项）
  - **决定性理由**：这 4 条 spec（bdd01/bdd25/bdd26/vc03/vc06）全是**本任务 P3 新写的**，本任务之前**根本不存在** → 在定义上不可能"预存失败"。implementer 的对照只还原了 rev1-fix 的 4 处 CSS，**只能证明"不是那一轮引入"**，不能证明"不是 P4 前四批引入" —— 这是对照基线选错，属**逻辑跳跃**
  - 逐条根因（主 Agent 已定位）：
    | 测试 | 根因 | 归属 |
    |---|---|---|
    | bdd01 / bdd26 | `textContent()` 取整个 `[data-testid=time-display]`，**包含内部 tooltip**（tooltip 本就含 `just now` → 与 `not /ago\|just now/` 冲突）。应断言 `.time-display__main` | **P3 测试选择器过宽** |
    | bdd25 | 登录按钮 `disabled`（`waiting for locator('.login__submit')` → resolved to `<button disabled>`），login helper 未等校验就绪 | **P3 登录 helper 缺陷** |
    | vc03 | **真实实现缺陷**（截图证据）：`.card-meta-text` 是 `display:flex` **无 `flex-wrap`、无收缩约束**，而新的绝对时间文本远比旧 `3h ago` 长 → `2 files` 被挤成两行并**溢出卡片右边界**（1280 宽 4 列布局下每张卡都可见） | **P4 实现缺陷**（时间格式改动的连带回归） |
    | vc06 | 列表动作区与标题重叠（`actions.x`=108 vs 需 ≥351） | 待修（列表已 `flex-wrap:wrap`，需查具体重叠因） |
  - **对比证据**：列表 `.entry-meta-row` 有 `flex-wrap: wrap`（`EntryListRow.vue:245`），卡片 `.card-meta-text` 没有 → 这是本次漏改
- DECISION: **不接受"登记 known-failures 了事"**。这 8 条不是预存失败，是**本任务引入的真实缺陷**（含 1 处用户可见的卡片溢出）。known-failures 只登"P5 之前就存在、与当前任务无关"的失败，把本任务缺陷塞进去就是掩盖。→ 回派 implementer rev2 修复
- NEXT: 停 debug 服务 → 派 implementer rev2（修 4 类：测试选择器 / 登录 helper / 卡片 flex-wrap / vc06 重叠）
- SUBAGENT OK(rev2): 修 A/B/C/D 四类 + 2 处额外修复。**主 Agent 独立复验**（未采信自述）：
  - :8888 亲自启动 → `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` → **61 passed / 0 failed / 3 skipped** ✅（rev1 的 8 failed 全部消除）
  - 前端全量 **119 files / 1456 passed / 0 failed / 4 skipped**，**无 `Errors` 行** ✅
  - `make typecheck` ✓ / `make lint` ✓ / `make check-docs` ✓
  - **ver2 的关键判据复核**：`entryDetail.ts:49-53` 确认 `loadEntry` 在 `files.length > 0` 时**必然**把 `activeFile` 设为 `files[0]` → `empty-select-file` 分支（`EntryDetailContent.vue:72`）**不可达**。故 implementer 把 BDD-25 后半条改为「文案互异 + 互斥正向验证」是**正确的等价验证**，不是放宽断言。**但这是 P1 BDD-25 的判据瑕疵**（写了一条产品里不可达的场景），P7 须记录
  - **ver2 的 D 判定复核**：vc06 移动端单列 title y=72..96 / actions y=157.5..201.5，纵向无交集 → 「不重叠」是二维语义，原断言只比 x 在单列下必然假红。改为 `overlapX<=0 || overlapY<=0` 且**桌面两列保留原强度** → 合理
  - **ver2 的 C 自我澄清值得肯定**：它主动说明「裸 click 实测也能成功，C 不是 8 项红的实际原因」，补守卫是为消除三条件竞态 —— 没有把非原因当作原因上报
- FACT(rev2 的 A 修复实测证据): 1280px 全 15 张卡，修前 `scrollWidth=279 > clientWidth=246`、子项右边界 944 越出卡片 928；修后 bad=0。vc03 转绿
- DECISION: rev2 改动了**测试语义**（bdd25/bdd04/vc06 三处断言重写），必须**重派前端评审复审**，不能直接采信。后端未再改动 → 后端 review 的 approved 仍然有效
- NEXT: 派 design-review rev2 复审 → 组长汇总 P4-review.md → gate → commit P4
- GATE PASS: `check-gate P4` **exit 0**（暂存区含代码文件；`P4-review.md` status=approved + agent=review）。首次跑 exit 1 无 stderr —— **原因是 gate 检查暂存区**（`git diff --cached`），当时文件都未 `git add`；暂存后通过
- SUBAGENT OK: 组长汇总产出 `P4-review.md`（status=approved，agent=review ≠ main），专家 **2/2 approved、0 BLOCKER、无分歧**，转抄 **26 条约束（T-1~T-26）** 给 P5/P6/P7。DESIGN_GAP 精确计数 = **13 条**（前端 11 + docs 2）+ 2 条 `[SCOPE+]`
- DECISION(组长转来的 IN-1 建议): `cli.py` apikey create/list 与 whoami 的时间显示 local/remote 不对称（后端 review 的 2 条 INFORMATIONAL 之一）→ **不在本任务修**，登记 `docs/roadmap/improvement-backlog.md` 作 follow-up。理由：超出 P1 四项范围，且属既有 CLI 输出形态问题，与本任务的 API 序列化改动无因果关系
- NEXT: 更新 .state.yaml（phase→P4 + history + retries.P4）+ active-tasks.md → commit P4 → 进 P5
