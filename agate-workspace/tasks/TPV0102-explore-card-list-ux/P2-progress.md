## [P2-architect] 输入读取完成
- 读 architect.md（UI 设计节规格 63-110 行）
- 读 P2-dispatch-context-architect.md（16 条已知陷阱 + 3 件必做事项）
- 读 P1-requirements.md（30 条 BDD，619 行）+ P0-brief.md（252 行）
- P1 frontmatter: ui_render_shape=layout, ui_ux_dimensions=[布局结构,交互行为,视觉呈现], risk_level=medium, domains=[backend,frontend,api,cli], packages=[peekview,frontend-v3,docs]
- decisions/ 目录不存在（主 Agent 已实测）

## [P2-architect] 代码通读（影响面梳理素材）
- useRelativeTime.ts:3 formatRelativeTime（NaNm ago / 未来→just now 两缺陷确认）、:24 formatFullDate 裸 toLocaleString、:28 useRelativeTime 返回 {relative, full}
- EntryCard.vue:43 `:title="fullTime"` 主显 relativeTime；:44 `v-if="entry.fileCount"` → 1 也显示；:4-20 单按钮 + team 时空 span 占位
- EntryListRow.vue:19 同；:20 同；:93-103 单按钮，team 时无元素
- EntryDetailHeader.vue:62 同 time；:66-73 只读 status-tag（无编辑入口）
- EntryMetaTagsBar.vue:4 只有 relativeTime（无 title）
- entryList.ts:45 toggleVisibility 有 teamId 守卫；entryDetail.ts:101 syncVisibility(slug,isPublic) 无 team 维度
- useEntryDetailActions.ts:47,73-79 overflow 菜单里的 Make Public/Private 项
- team.ts:23 loadMyTeams / :13 allTeams computed；EntryListView.vue:551 ensureMyTeamsLoaded 存在，EntryDetailView.vue 无调用（确认陷阱 13）
- OverflowMenu.vue:123-146 close() 内 triggerRef.focus() + Escape/Tab 关闭（可复用惯例）；ConfirmDialog.vue: Teleport + role=alertdialog + Cancel/Confirm
- api/client.ts:196 toggleEntryVisibility 只发 is_public；:203 updateEntry 支持 is_public+team_id（确认无需改 API）
- Makefile: test-quick(163) / test-frontend(173) / lint(185) / typecheck(193) / debug-quick(553) / debug-test(660)
- run-e2e-tests.sh:78 `spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` → 确认裸调只跑 1 spec
- playwright.config.ts use 块无 locale/timezoneId；两个 project: chromium / Mobile Chrome
- entries.py:156 JSONResponse(model_dump(mode="json"))；admin.py 7 处 response_model + config_router.py 3 处
- client.py:89 `datetime.fromisoformat(v)` 裸调用确认；cli.py 7 处 + admin_service.py 3 处 isoformat 确认

## [P2-architect] 最小验证（已完成，5 组）
1. PlainSerializer(when_used='json') 叶模型 + table 模型隔离：**confirmed**
   - 叶模型 json → '2026-11-10T09:43:00Z'；python 模式 → datetime；table 模型 json → 无 Z
2. 通配 field_serializer("*", when_used="json", check_fields=False) 于 mixin：**confirmed 可行**
   - 叶模型含未来新增 datetime 字段自动纳入（比逐字段 Annotated 更契合 BDD-07 的"遍历自动纳入"语义）
   - 嵌套模型（Nested 也继承 mixin）+ list/dict 容器均正确；ShareCreateResponse 经继承即得
   - **反证**：mixin 若被 table=True 模型继承 → 表模型 model_dump(mode=json) 也变 Z（污染）→ mixin 绝不可被 table 模型继承
3. FastAPI 五条响应路径：**confirmed** response_model 实例 / dict / JSONResponse(model_dump(mode="json")) / 直接返回实例 均带 Z；table 路径不带
4. BDD-07 遍历判据机械化：**confirmed** "非 table 且不被 table 模型继承" → 命中 16 类 / 34 字段
   - ⚠️ 与 P1 §6.9 的 15 类/31 字段**不一致**：多出 ShareCreateResponse(3 字段)——因 P1 把"经继承即得覆盖"排除在清单外，但**遍历判据会命中它**。已在设计中标注（P1 附录是"基线清单非判据主体"，遍历口径命中 16/34 属预期）
   - EntryBase/UserBase 排除条件实测有效（inherited_by_table=True）
5. 浏览器 toLocaleString + Playwright 时区/locale 控制：**confirmed**
   - timezoneId:'Asia/Shanghai' + locale:'zh-CN' → `2026/11/10 GMT+8 17:43:00`（含 17:43:00 + GMT+8）
   - timezoneId:'UTC' + locale:'en-US' → `11/10/2026, 09:43:00 AM GMT+0`
   - longOffset → `GMT+08:00`；tooltip 组合 `... GMT+08:00 ... · Asia/Shanghai`
6. tooltip 可观测性（决定 BDD-02 可断言性）：**confirmed 关键结论**
   - 原生 `title` 属性：Playwright `getByText` 命中 0（悬停后仍 0）→ **不可断言**，只能读 title 属性字符串
   - CSS `::after` + content:attr()：getByText 命中 0，textContent 不含，只能读 getComputedStyle(el,'::after').content
   - **自定义 DOM tooltip 元素（visibility:hidden↔visible）+ role="tooltip"**：悬停后 isVisible()=true、getByText 命中、textContent 可读 → **唯一可断言的形态**
   - `opacity:0` 元素 isVisible() 仍为 true → 用 opacity 做隐藏会让"未悬停"也可见，破坏 BDD-02 的 Given/When 区分
   - 结论：BDD-02/03 的 tooltip 必须实现为**真实 DOM 元素**（visibility 切换），不能用 title 属性或 ::after

## [P2-architect] 状态：无阻塞，进入撰写阶段（15:44 之后补记）
已完成：输入读取 → 代码通读 → 6 组最小验证（见上一节）→ 影响面梳理/候选方案已在脑中定稿。
之前 18 分钟无写入的原因：连续做最小验证（serializer/FastAPI 5 路径/遍历判据/时区/三种 tooltip 形态/无效日期边界），
每条都是独立脚本，未中途落盘——按主 Agent 要求现改为逐节落盘。

## [P2-architect] 影响面梳理结论（摘要，正文将展开）
**改什么**（4 包 21 文件）：
- backend: models.py（新增 UtcSerializeMixin + 16 叶响应模型继承；不碰 EntryBase:82/UserBase:116）、client.py:89（Z 兼容）、cli.py 7 处 + services/admin_service.py 3 处（isoformat→Z helper）
- frontend-v3: useRelativeTime.ts（三函数重写）、EntryCard.vue、EntryListRow.vue、EntryDetailHeader.vue、EntryMetaTagsBar.vue、EntryDetailContent.vue（0 文件空态）、新增 VisibilityMenu.vue + useVisibilityOptions.ts、stores/entryList.ts（toggleVisibility→setVisibility）、stores/entryDetail.ts（syncVisibility 扩 team）、useEntryDetailActions.ts（overflow 项移除/改接）、EntryListView.vue（toast 三态 + 下发 allTeams）、EntryDetailView.vue（补 loadMyTeams + 下发）
- docs: CHANGELOG.md [Unreleased]
**不改什么**：EntryBase/UserBase、25 个 table 模型、DB 列定义（TPV0101 前提）、api/client.ts 的 updateEntry（已支持两字段）、PublishView 的发布页可见性控件、FileTree 计数、ApiKeySettingsTab/ApiKeyListView 本地时间格式化、MCP 代码、api/entries.py 端点契约
**风险**：8 条（含 BDD-02 tooltip 可断言性——已实测决定实现形态；16 类/34 字段 vs P1 15 类/31 字段口径差；TPV0095 BDD-40 断言取代；title 属性改为 DOM tooltip 会破坏 2 个既有单测断言）

## [P2-architect] 候选方案定稿（3 个）
- **A. 逐字段 Annotated[datetime, PlainSerializer]**（P0 推荐形态）：显式、精确，但 31 处重复、新增字段靠人记得加 → 与 BDD-07「遍历自动纳入」语义张力
- **B. 通配 field_serializer("*", when_used="json", check_fields=False) 于共享 mixin**：**已实测可行**，未来 datetime 字段自动纳入，与 BDD-07 机械判据天然一致；风险是 mixin 绝不可被 table 模型继承（已实测反证污染）
- **C. 端点层统一 helper（每个返回点调 to_json_safe）**：改动散落到所有路由，覆盖靠人记得，且 JSONResponse 路径与 response_model 路径分叉 → 排除
→ **选 B**（理由：BDD-07 是机械遍历判据，B 的实现形态与判据同构；A 的"必须记得加"正是 I-3 静默错序的成因）

- 前端菜单：**D. 新组件 VisibilityMenu.vue（自建菜单 + 复用 ConfirmDialog）** vs **E. 复用 OverflowMenu.vue 传 items** vs **F. 扩展 useEntryDetailActions 的 overflowItems**
→ **选 D**（E 的 OverflowMenuItem 无子菜单能力，改它要动 5 处既有调用方；F 只服务详情页且 items 是平铺模型，装不下子菜单/当前态排除语义）。D 复用 OverflowMenu 的 a11y 惯例（Escape→close→triggerRef.focus）而非其组件本体。

- tooltip：**G. 原生 title 属性** vs **H. 自定义 DOM tooltip 元素（visibility 切换 + role=tooltip）** vs **I. CSS ::after + content:attr()**
→ **选 H**（实测：G 的 getByText 命中 0、I 的 getByText 也命中 0 且 textContent 不含伪元素内容 → BDD-02/03 不可断言；H 悬停后 isVisible()=true + textContent 可读，是唯一可断言形态。且 opacity:0 在 Playwright 下 isVisible() 仍为 true，必须用 visibility）

## [P2-architect] P2-design.md 首版已落盘（§0-§12 全部节）
含：frontmatter(candidate_count:7/packages/domains/ui_affected/ui_design_section/dispatch_plan 5批) + §1 影响面梳理(改什么/不改什么/风险10条)
+ §2 三个决策点7候选 + §3 详细设计 + §4 完成标志 + §5 UI设计(渲染形态:layout + 适用维度:三档 + 布局/交互/视觉 checklist + VC-1..6 视觉契约)
+ §6 测试策略含既有断言更新面9项 + §7 [SCOPE+] + §8 minimal_validation V1-V9 + §9-11 待写块
下一步：写 gate_commands / files_to_read / env_constraints 三个正文块，然后跑 check-frontmatter。

## [P2-architect] gate_commands / files_to_read / env_constraints 三块已落盘 + gate 自检
- gate_commands 用 agate-md-field-set-gate-commands.py 写入（OK: 已写入），位置移到 §9 节内（原在文件末尾、无节归属）
  keys: P3 / P5 / P5_frontend / P5_e2e / P5_lint / P5_typecheck / P5_fitness / 6 个 _timeout_seconds / project_module
- **坑记录**：`agate-md-field-set-gate-commands.py` 写入时对双引号做 JSON 转义 → 读回变成 `E2E_SPEC=\"e2e/...\"`（转义残留）。
  改用单引号包裹 `E2E_SPEC='e2e/(tpv0102|team-visibility)'` → 读回干净。P3 命令同理避免双引号。
- **P3 聚合命令形态实测**（V8 扩展）：`cd backend && cmd | tail -30; b=${PIPESTATUS[0]}` 形态在 `bash -c` 单行里 PIPESTATUS 不可靠
  → 改用 `bash -o pipefail -c '...'` 子壳取 $?，实测四组合（OK/后端失败/前端失败/双失败）= 0/1/1/1 正确。
- **UI 节标题坑**：写 `## 5. UI 设计` 时 parse_ui_design_section 返回 None（正则 `^#{2,3}\s+UI 设计` 不容编号前缀）
  → 改为裸 `## UI 设计` 后 gate 通过。**这是 P2 gate 的硬要求，后续任务注意**。
- **packages 对账坑**：正文里 `packages: [frontend-v3]` 触发 RECONCILE WARNING（正文 vs frontmatter 不一致）
  → 改为散文「影响包：frontend-v3」后 0 mismatches。
- 自检结果：
  - `check-frontmatter.py` → **exit 0**
  - `check-gate.py P2` → exit 1，**唯一原因** `P2-review.md 不存在`（评审未派发，属主 Agent 下一步）；其余全部通过
    （_gate_p2_ui_design_section=True / _gate_p2_dispatch_plan=None / count_p2_declared_fields=4 / tradeoff+choice 关键词 True / RECONCILE 0 mismatches）

## [P2-architect] 最终自检（完成）
1. `check-frontmatter.py` → **exit 0** ✅
2. `check-gate.py P2` → exit 1，**唯一原因 `P2-review.md 不存在`**（评审属主 Agent 下一步派发）；
   其余全部通过：`_gate_p2_ui_design_section=True` / `_gate_p2_dispatch_plan=None` /
   `count_p2_declared_fields=4` / `RECONCILE 0 mismatches` / candidate_count=7 ≥ 2 /
   tradeoff+choice_and_reason 关键词命中
3. `agate-read-p5-commands.py` 读回 6 条 P5 族命令（P5/_frontend/_e2e/_lint/_typecheck/_fitness），值无引号破损
4. 文件 897 行 / 75.6 KB

**注意（给主 Agent / 后续任务）**：
- `ui_design_section` 不是 agate-md-field-get 支持的 op（exit 2 unknown op）——该字段只由
  `check-frontmatter.py` 的 schema 校验，不要用 md-field-get 去读它。
- frontmatter 的 list 字段最终落成了块式（`- item` 逐行），dispatch_plan 也落成了块式 YAML
  （不是单行 flow）——`agate-md-field-get dispatch_plan` 仍能 json.dumps 出来，gate 通过；
  若后续任务需要单行 flow 形态，得手写 frontmatter（field-set 工具会重排成块式）。

## 修订轮 rev1（P2 retry 1/3）— architect 增量修订

### 输入已读
- P2-review-eng.md（4 阻塞 B-1~B-4 + 6 非阻塞）
- P2-review-design.md（20 项缺陷 / 5 高级别 / 2 裁决）
- P2-dispatch-context-architect-rev1.md（含 AGATE_CARD）
- architect.md（v0.83.2，AGATE_ROOT=/home/kity/.agate/v0.83.2/agate）
- P2-design.md 全文 899 行

### 自主复现的事实（不采信评审与主 Agent 自述）

1. **B-1 复核成立**：`npx playwright test --list 'e2e/(tpv0102|team-visibility)'` → `Total: 12 tests in 1 file` exit **0**；`--list 'e2e/zzzznonexistent'` → `Error: No tests found` exit **1**。即 alternation 里的 team-visibility 保证永不为空 → 今天已假绿。
2. **B-3 复核：主 Agent 的四格矩阵不完整——真实 P3 命令下有第五格，且是最坏的一格**
   用真实 `agate_common.run_test_with_formatter` + 真实 `check-tdd-red.py::judge_result`，跑**完整聚合 P3 命令**（不是隔离小仓）：

   | 变体 | exit_code | import_errors(module) | judge | 判定 |
   |---|---|---|---|---|
   | V-A `--tb=no` + `tail -30`，无 formatter | 1 | 0 | **1** | A 类假红 |
   | V-B `--tb=short` + `tail -30`，无 formatter | 1 | 0 | **1** | A 类假红 |
   | V-C `--tb=no` + `tail -30` + pytest.sh | 1 | 1 (`''`) | **1** | A 类假红 |
   | V-D `--tb=short` + `tail -30` + pytest.sh | 1 | 1 (`''`) | **1** | **A 类假红（主 Agent 矩阵漏掉）** |
   | **V-E `--tb=short` 去掉 `tail -30` + pytest.sh** | 1 | 3 (`'', peekview.timefmt, ''`) | **0** | ✅ B 类红灯 |

   **根因不是 `--tb=no`，是 `2>&1 | tail -30` 把 traceback 截掉了**：真实全量套件的 warnings summary ≈15 行，`ModuleNotFoundError` 落在距 EOF 30 行之外被砍，只剩 short summary 的 `ERROR - ImportError while importing test module '.../....'`（路径被缩写 → 正则取不到 module → `module=''`）→ 落 `A-class (import errors are NOT from project module)`。
   **结论：必须同时做三件事**——① `--tb=no`→`--tb=short` ② 声明 `P3_formatter: pytest.sh` ③ **去掉 P3 里的 `tail -30`**。主 Agent 的两件事不够。
3. **formatter 对 vitest 输出仍正确判红**（实测喂 `vitest_red.txt`：`failed=1` → `classic red-light` verdict 0）——单一 `pytest.sh` 覆盖聚合命令可行。
4. **B-4 复核成立**：`entry_service.py:856-865` 的 `revoked_shares` 自动吊销存在；`entryList.ts:64-68` 现状有 warning toast；P2 骨架无该分支。
5. **裁决 1 的修正方向复核成立**：`t052-header-redesign.test.ts:100` 确为 `const item: OverflowMenuItem = { label: 'Make Private' }` 字面量 + `isLucideName` 断言，与组件行为无关 → 不该列入待改；E2E `:108-112`（`text=Make Private`）与 `:114`（`Currently Public` hint）会红。
6. **D-4/P-5 复核成立**：`EntryDetailMobileBar.vue:50` 确有 `<OverflowMenu variant="sheet">` 先例；`DESIGN.md:270` 「Touch targets: minimum 44px」、`:274` 「Overflow menus: dropdown on desktop, bottom sheet on mobile」、`:290` 「All interactive elements must have visible focus indicators」。
7. **D-2 复核成立**：`ConfirmDialog.vue` 根为 `<Teleport to="body">`，内部 `.confirm-dialog`，全文件无 `data-testid` → 外部透传 attrs 到 Teleport 不产生 DOM 属性。
8. **D-9 复核成立**：`team.ts` 的 `loadMyTeams()` catch 只置 `error`，不置 `teamsLoaded`、`allTeams` 保持空 → 加载失败与"无团队"UI 不可区分。

### 已完成修正（第 1 组：§1.1 / §1.2 / §1.3 / §2.2）
- **B5 明细表**：补「调用点 × 现状形态 × 现状 prop 来源 × 改后 × 上游需删的 prop」四行表，登记 `EntryDetailView.vue:203` 的 `useRelativeTime` 解构删除 + `EntryListView.vue` 两处 prop 绑定删除（D-17）
- **D-4**：D3 行补 `variant: 'icon'|'inline'|'sheet'`、`disabled`、`currentTeamSlug`、emits `confirm-cancel`、`aria-haspopup`/`aria-expanded`
- **B-4/D-3**：D4 行 + D9 行（toast 由三态改**四态**，含 `revokedShares > 0` warning）
- **D-11**：D8 行语义裁定为「替换，非并存」（原 §6.4#5 与之矛盾，稍后同步改）
- **D-6**：§1.2 补 `--c-text-tertiary` 对比度债务登记（不扩大范围改色）
- **D-19**：§2.2 B2 的「5 个既有调用方」校正为**3 处**（实测 grep：`EntryDetailHeader.vue:53` / `EntryDetailMobileBar.vue:50` / `settings/UserManagerTab.vue:38`）
- **裁决 1 采纳**：移除 `[NEEDS_P2_REVIEW_DECISION]` 标记，写入裁决结论 + 三条硬理由
- **D-20**：新增 §2.2b「布局维度：详情页入口落位取舍」表（3 个被排除替代 + 理由）
- **D-9/R-11**：§1.3 新增 R11（团队加载失败被误认为无团队）+ R12（P3 tail 截断致假红）
- **R9**：缓解措施指向新增的 VC-7

### 已完成修正（第 2 组：§3.4 / §3.5 —— 契约核心）
- **D-7**（tooltip CSS 矛盾）：`left:0` + `nowrap` + `ellipsis` → 桌面左对齐 / `@media(max-width:640px)` 右对齐 + `white-space: normal`；**去掉 `text-overflow: ellipsis`**（它会截断 BDD-02 要求的完整三段文本，形成"断言绿而体验红"）。附长度估算 ≈63 字符 / 11px ≈420px > 320px max-width → 必须换行
- **D-13**：tooltip `z-index: 30` → **10**（`DESIGN.md` §4「Sticky+tooltips」档）；并显式说明移动端 `.mobile-sticky-header` 是 50 > 10，遮挡关系由 VC-1 + P6 截图核对（档位语义既定，不要求 tooltip 盖住 sticky header）
- **D-16**：模板补 `data-testid="time-display"`（根 `<span>`），与 §3.8 清单对齐
- **B-4 / D-3**：`setVisibility` 成功分支补 `revokedShares > 0` warning toast（保留现状反馈，不静默回归）
- **D-15**：给出 `applyPatch` / `restore` 的签名 + 字段契约表（三转换 × 三字段同写）
- **D-1**：props 表（`entry`/`teams`/`variant`（含 `sheet`）/`disabled`/`teamsFailed`）+ emits 表（`select`/`confirm-cancel`）+ **内部状态 5 项表**（`isOpen`/`isTeamSubmenuOpen`/`pendingTarget`/`isConfirming`/`triggerRef`）
- **D-10**：取消路径（`cancel` → 清 `pendingTarget` + `emit('confirm-cancel')` + 重开菜单 + 焦点回归触发按钮）
- **D-2**：`visibility-confirm` testid **不可实现** → 改为 P3 用既有类名 `.confirm-dialog` 定位（`ConfirmDialog` 不改）
- **D-12**：补 `aria-haspopup`/`aria-expanded`（既有先例零成本）；补 `.card-action-btn` / `.action-btn` 的 `:focus-visible` 焦点环（实测两文件各 6 处 `:focus-visible` 不含这两类）；补 Team 子菜单键盘路径
- **D-14**：toast 文案变更登记（稍后进 §6.4 第 10 项）
- **inFlight 非响应式**：改 `ref(new Set())` + 明确「BDD-24 判据由 store 守卫保证，组件 `disabled` 是附加视觉反馈」
- **currentTeamSlug 冗余**：删除该入参，"当前团队"由 `entry.teamId` + `teams` 派生
- **D-9 / R11**：三级处置（组件 `teamsFailed` 禁用项 + 视图传值 + 语义声明「加载失败降级不满足 BDD-17 Given」），并要求 P3 的 BDD-17 用例 mock 空团队而非让请求失败
- **D-14 相关**：`variant: 'sheet'` 走 `Teleport to="body"` 规避 `.content-area` 的 `overflow-y:auto` 裁剪；桌面菜单容器显式 `z-index: 100`

### 已完成修正（第 3 组：§3.8 / §4 / UI 设计节视觉 checklist）
- **D-11**：§3.8 表**删除 `visibility-menu-trigger` 行**，触发按钮行改为沿用 `visibility-toggle`；加裁决结论块（沿用 + 理由）
- **D-2（续）**：`visibility-confirm` 行改为「不设 testid，用既有类名 `.confirm-dialog`」，并说明为何不可实现
- **D-6**：对比度「风险为零」→ 如实陈述（4 行对比度表 + 债务归属 + 不改色理由 + P6 不得写成已达标）
- **D-8**：`padding: 2px 6px` → `var(--space-1) var(--space-2)`、`gap: 2px` → `var(--space-1)`；并加「既有 `status-tag` 的 1px 6px 属既有例外，非新增」声明
- **语义别名 token**：新增代码优先 `--text-*` / `--bg-*` / `--border-*`，回落 `--c-*` 时注明
- **D-5**：VC-4 门槛 24px → **44px**，并拆成「本任务新增按钮必须 ≥44px」+「既有 28px 按钮不在本任务范围（登记 SUGGEST）」两条，避免用新契约给既有不达标背书
- **新增 VC-7**：详情页 `meta-row` 高度 ≤ 两行（R9 的专用契约，补上上一版"视觉契约里没有覆盖这一项"的缺口）
- **D-13（续）**：组件一致性补 z-index 档位声明（tooltip 10 / 菜单 100 / ConfirmDialog 既有 200-210）
- §4 完成标志：E2E 文件名写死、补 VC-7 / 44px、补 `header-layout` / toast / T052 更新面、新增第 7 条「P3 红灯基线可判为 B 类」

### 已完成修正（第 4 组：§6 测试策略）
- **§6.1 三条 P3 约束**：文件名写死 / `test_mixin_not_in_table_mro` 函数名写死（`-k` 零命中 exit 5，实测）/ `test_existing_rows_utc_audit`（BDD-12）**必须是手工审计脚本而非 pytest 用例**（conftest autouse 隔离到 tmp_path，写成用例是假用例，P7 记 DEVIATION）
- **B-4**：§6.2 新增 `src/stores/__tests__/entry-list-visibility.spec.ts`，含 `revokedShares > 0` 产生 warning + 为 0/undefined 不产生
- **D-9**：§6.2 `visibility-options.spec.ts` 补 `teamsFailed` 断言
- **D-10**：§6.2 `visibility-menu.spec.ts` 补取消路径 + `teamsFailed` 禁用项
- **D-2/D-16**：§6.2 `time-display.spec.ts` 补根节点 testid 断言
- **B-1**：§6.3 标题改为**写死文件名** `e2e/tpv0102-explore-card-list-ux.spec.ts`，加「P3 必须创建该文件名」+ 假绿实测依据 + 为什么不用正则 alternation + `team-visibility` 回归拆 `P5_e2e_legacy`
- **BDD-22**：§6.3 补具体断言形态（非 owner × 卡片/列表行/详情三处，`[data-testid="visibility-toggle"]` count=0，并说明为何用 count 而非 not.toBeVisible）
- **§6.4 #1**：补「必须拆掉 `if ((await teamCard.count()) > 0)` 守卫」→ 前置 `toHaveCount(1)`
- **§6.4 #5**：与 D8 统一为「替换」（原"只读标签保留"与 D8 矛盾）
- **§6.4 #9**：**删除 `t052-header-redesign.test.ts:100`**（实测是字面量 + isLucideName 断言，与组件无关），只留 E2E `:108-112`；并补 `:114` 的 `Currently Public` hint 断言一并失效
- **§6.4 新增 #10**：toast 文案变更（`Entry made public` → `Made public`），含 `EntryListView.vue:640` / `useEntryDetailActions.ts:52`（D-14）
- **§6.4 新增 #11**：`header-layout.test.ts:67-76` TC-D01（`/\d+d ago/` 语义前提失效）/ TC-D02（强度提升为含 `GMT±N`）

### 已完成修正（第 5 组：§7 / §8）
- **V9 判据修正（B-1）**：`result: confirmed` → **`refuted`**；判据从「正则被 playwright 接受」改为「命中集合 == 期望集合」；记录 `12 tests in 1 file` 中 tpv0102 命中 0；记录反向实测（零命中 exit 1，故「0 tests 也算 exit 0」的具体担忧不成立）
- **新增 V10**：**真实** `run_test_with_formatter` + `judge_result` 的五格矩阵（本轮核心新证据），结论「三件事必须同时做」：`--tb=short` + `P3_formatter` + **去掉 `tail -30`**；并记录去除 tail 后输出仍紧凑（68 行 / 5.3KB）
- **新增 V11**：`-k` 零命中 pytest exit 5（实测）→ 支撑 §6.1 的函数名写死约束
- **新增 V12**：写死文件名后缺文件 exit 1（实测）→ 支撑 B-1 的机制保证
- **新增 §7.1 SUGGEST 登记**：S1（tertiary 对比度债务）/ S2（既有 28px 按钮 < 44px）/ S3（团队加载失败降级未上升为 BDD），各附实测依据 + 不修理由 + 建议处置；明确「P6 不检查，但也不得写成已达标」

### 已完成修正（第 6 组：§9 gate_commands 重写 / §10 files_to_read / §12 裁决记录 / §13 对照表）
- **§9 gate_commands 重写**（用 `agate-md-field-set-gate-commands.py` + `@file` 单引号包裹的 yaml，exit 0）：
  - `P3`：`--tb=no` → **`--tb=short`**，**去掉 `2>&1 | tail -30`**（V10 第三件必须做的事）
  - **新增 `P3_formatter: "pytest.sh"`**
  - `P5_e2e`：正则 alternation → **写死 `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts`**
  - **新增 `P5_e2e_legacy`**（team-visibility 回归独立 key）+ 其 `_timeout_seconds: 600`
  - `P5_e2e_timeout_seconds`: 420 → **900**
  - `P5_fitness`：`--tb=no` → `--tb=short`（与 P3 一致）
- **§9 声明要点重写**：五格矩阵结论 + 三件事同时做 + 去 tail 不影响紧凑性（68 行/5.3KB）+ B-1/B-2 理由 + `-k` exit 5 约束
- **§10 files_to_read**：补 4 项 eng 指出的缺口（`entry_service.py:800-870` / `api/entries.py:435-450` / `models.py:805-815` / `stores/entry.ts:1-40`）；把 §6.4 的 11 项既有测试文件全部列入（现 50 条，**全部路径已实测存在**）
- **§12**：从「待评审裁决项」改为「裁决项（已全部裁定）」三列裁定表（裁定 + 依据 + 落实位置）
- **§13 新增**：本轮修订对照表——eng B-1~B-4 闭合表 / design D-1~D-5 闭合表 / D-6~D-20 处置表 / eng 非阻塞 6 项处置 / **本轮独立发现 3 项**

### 门槛自查（全部通过）
- `check-frontmatter.py` → **exit 0**
- `check-gate.py P2` → 唯一失败原因仍是 `P2-review.md 不存在`（RECONCILE 0 mismatches）
- 18 项机械门槛检查全 PASS（P5_e2e 写死文件名 / 900s / P3 --tb=short / 无 tail / P3_formatter / P5_e2e_legacy / 裁决1 移除+只改E2E / 裁决2 沿用+删重复行 / B-4 / D-1 / D-2 / D-4 / D-5 / UI 设计裸标题 / frontmatter 未动）
- 28 个 markdown 表块 pipe-count 结构完好，0 suspicious
- frontmatter 与修订前**逐字节一致**（`candidate_count: 7` / `packages` / `domains` / `ui_affected` / `ui_design_section` / `dispatch_plan` 全未动）
- 「必须保持不变的部分」逐条核验：A2/B1/C2 选择与权衡、数据流（mixin 通配 serializer）、5 转换状态机、16/34 处置、`## UI 设计` 裸标题、两节"维度不适用"、BDD-30 对标、frontmatter —— **全部原样保留**
- 无 scratch 探针残留：`backend/tests/` 与 `frontend-v3/src/` 均 clean；临时产物全在 `.agate-tmp/`（已 gitignore）
- [PROD_NOT_TOUCHED]

## P2 retry 2（增量修订轮 2）— N-1~N-5 + E-1/E-2

- 读完 `P2-review-design.md`（needs-revision，N-1~N-5）/ `P2-review-eng.md`（approved，E-1/E-2 一行级）/ rev2 dispatch-context 与 AGATE_CARD。
- 独立复验事实（不采信自述）：
  - `types/index.ts:9-18`：`TeamRef = {slug,name}`、`Team = {slug,name,memberCount}` → **无 id**；`Entry.teamId?: number|null`、`Entry.team?: TeamRef|null` 确实存在。
  - `backend/peekview/models.py:747-752` `TeamRef`、`:947-952` `TeamSummary` 均无数字 id；`models.py:667` `EntryUpdate.team_id: str|None` 收的是 **team slug**（不是数字 id）。
  - N-2：`useMediaQuery` 0 命中属实，但**既有的 `useResponsiveLayout()` 存在**（`src/composables/useResponsiveLayout.ts`，`isMobile = viewportWidth<=640`），`EntryDetailView.vue:156` / `UserManagerTab.vue:87` 在用 → 选"视图层下发 variant"有现成机制。
  - `EntryListView.vue:262` import 无 `onUnmounted`（接线时须补）；`:784` 有 `onMounted`。
  - N-5：`tpv0095-detail-visibility-tag.spec.ts:111-112` 是 `statusTagText()` 助手，被 `:135`（team）/`:143`（private）/`:148`（public）**3 条**断言消费 → 评审正确。
  - `.status-tag` 在 `EntryDetailHeader.vue:63,64`（Archived/Expired）也用 → 类名定位本就有歧义，改 testid 定位有实质理由。
- **N-1 已落盘**（§3.5 `visibility-options.ts` 签名 + §1.1 D1 行 + §3.5 props 表）：`currentTeamSlug` 作为**派生值**入参（`entry.team?.slug ?? null`），子菜单 `teams.filter(t => t.slug !== …)`；`TeamOption = Team` 显式声明（无 id）；删除 `teams.find(t => t.id === …)`。
- **N-2 已落盘**（§3.5 props 表 + 新增「`variant` 的切换主体」小节）：选 **②视图层下发**并写死接线——`EntryListView.vue` 用既有 `useResponsiveLayout()`（`isMobile`/`handleResize`，`:262` 补 `onBeforeUnmount`）、`EntryDetailView.vue:156` 已有该 composable 零改动；卡/列表 `isMobile ? 'sheet' : 'icon'`，header/meta-bar `isMobile ? 'sheet' : 'inline'`。附否决 ①（每卡一个 listener）/③（Explore 侧 sheet 不落地）的理由 + sheet 在 Explore 两个面也需 Teleport 的裁剪面证据（`.entry-panel{overflow:hidden}` / `.card-actions{z-index:1}`）。
- **N-4 已落盘**（§3.5 新增「可见文案与 `aria-label`」三张子表 + §3.5 行为约定补 `aria-label` 行 + §1.1 D8 行 + §3.8 testid 表 `visibility-toggle` 行）：①`inline` 三态逐字沿用现状（`Public`/`Private`/`仅团队可见 · {team.name}`，`EntryDetailHeader.vue:68-72`/`EntryMetaTagsBar.vue:7-11`）；`icon` 无可见文字（仅 14/16px Lucide）+ `aria-label`；`sheet` 浮层标题 `可见性`。②所有变体触发按钮 `aria-label="Visibility: {statusLabel}"`（引 `OverflowMenu.vue:14` 先例；英文与 `EntryDetailHeader.vue:22/27/30/43/46` 惯例一致）。③菜单项状态名（非动作名）表 + testid 对照。④自查补 `Team` 子菜单项的 `aria-haspopup`/`aria-expanded`、`sheet` 关闭按钮 `aria-label="Close"`（`OverflowMenuSheet.vue:17`）。
- **N-5 已落盘**（§6.4#5）：行号 `:75` → **`:111-112`**（`statusTagText()` 助手 + `wrapper.find('.status-tag')`），并写明受影响的**3 条**断言（`:135` team / `:143` private / `:148` public），强调"改助手即一并覆盖三条"。附独立查证：`EntryDetailHeader.vue:63-64` 的 `Archived`/`Expired` 也用 `.status-tag` → 类名定位替换后会多命中，进一步支持改 testid 定位。
- **E-2 已落盘**（§3.5 `setVisibility` 伪码 + 新增返回类型 `SetVisibilityResult` + 三条归属理由 + P4 硬约束 + §3.5 store 改动的"保留"条目改写）：**toast 只由视图层发**；store 只 `return { ok, revokedShares }`，`entryList.ts:64-68` 的 `toast.show` 两行删除、语义搬到 `EntryListView.vue` 的 `handleVisibilityChange`（D9 改名点）。§6.2 的单测相应改为断言返回值计数而非 toast。
- **N-1 补强**（§3.5 `applyPatch` 表 `team` 行）：`team = { slug, name }`（对齐 `TeamRef`）；并澄清**乐观更新路径不得伪造 `teamId`**（`Team`/`TeamRef` 无 id），`teamId` 只在服务端响应路径可信。
- **N-3 已落盘**（§5 组件一致性节）：原单行「触发按钮尺寸」扩为 **4 行标注表**（行 1 = `VisibilityMenu` 移动端 `sheet` **44×44 本任务新增，VC-4 断言**；行 2/3 = 桌面 `icon` 28×28 / `inline` 沿用 `status-tag`，**新增但沿用既有尺寸、VC-4 不断言**；行 4 = 既有删除按钮 28×28 **既有、本任务不改、不得断言**）。附写死的 `.visibility-toggle { min-height/min-width: 44px }` @media 规则 + 明确禁止写到 `.card-action-btn`/`.action-btn`。**既有 28px 一行未改**（评审误判，已按主 Agent 判定处理）。同批把 VC-4 行与 VC-4 口径块改写成按表行号引用。
- **E-1 已落盘**：`agate-md-field-set-gate-commands.py` 重写块（未手写），`P5_e2e_legacy_timeout_seconds: 600` → **900**；§9 声明要点的 legacy 理由改写为"等值不满足规则 → 改 900"，并补 E-1 标注。已回读确认块完整、`project_module` 保留、块后空行已修复。
- **§13.6 新增**（N-1~N-5 + E-1/E-2 逐条落点表）+ **§13.7 新增**（「必须保持不变的部分」10 项逐条自查，含 B-1/B-2/B-3/B-4、D-1~D-5、2 裁决、方案骨架、裸标题/两节维度不适用/BDD-30、frontmatter 全字段）。同时修正 §13.4 与 §13.2 中两处表述已随 N-1 过时的旧说法（"由 `entry.teamId` + `teams` 反查派生"、"props 6 项"）。
- **§3.7 prop 链**补 `variant` / `teamsFailed` 并新增「`variant` 的取值来源」表（三视图取值表达式 + 依据）；§7.1 新增 S4（sheet 交互细节债务，注记不推翻 N-2）。
- 通路证据补强（§3.5 N-1 块）：`api/client.ts:107`（`transformListItem`，列表）与 `:130`（`transformEntry`，详情）两条 transform 都填 `entry.team`；后端 `entry_service.py:717`（`team_map`，列表批量）/ `:1261`（`_team_ref`，单条）→ BDD-18 在三处都有派生路径。
- 门槛复跑：`check-frontmatter.py` → **exit 0**（连跑两次一致）；`check-gate.py P2` → exit 1，唯一原因 `P2-review.md 不存在`（组长汇总前为正常态，与两评审判定一致）；`agate-read-gate-commands.py` → exit 0。
- 隔离核查：`git status --porcelain` 中 `backend/tests/` 与 `frontend-v3/src/` **零改动**（无 scratch 探针）；临时产物全在 `.agate-tmp/`（`gate-block.yaml` / `P2-design.bak.md`）；未触碰 :8080、未写 `~/.peekview/`。[PROD_NOT_TOUCHED]
