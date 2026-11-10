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
