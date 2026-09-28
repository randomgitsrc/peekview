# TPV0099 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 需求来源为用户分享场景（2026-09-16）——接收者拿到非 raw 链接 `/{slug}` 看到的是完整页，希望存在 `/{slug}/f` 直入"只剩主体内容"的视图
- DECISION: URL 格式定 `/{slug}/f`（path 后缀），否决 `?f` query——三点依据：`/{slug}/raw` mode 后缀先例；query 被聊天客户端剪参数的风险（分享场景重灾区）；内部导航保态（path 形态切文件不丢 mode，query 形态丢一次即意外退出全屏）。第三个是决定性差异
- DECISION: 行为定完全锁死（f/Escape 均无效、无页内出口）——用户裁决，接受键盘用户需手动改 URL 的代价；P1 不再重开此决策
- DECISION: 外观定"只剩纯内容"（元信息条一并隐藏）——注意这会统一改变现有 f 键 zen 模式外观（meta 条 可见→隐藏），推荐一套外观而非两套；P1 与用户确认此项
- NEXT: 等用户「开工」指令后进 P1（P1-dispatch-context-analyst.md + AGATE_CARD 注入）。P1 输入须含：三个已锁定决策、zen 外观统一的确认项、后端 `*/f` JSON 边缘的处理取舍
- DECISION（2026-09-28 开工）：P0-brief 时效性自检判定 = **局部前提更正，不重开 P0**。立项 09-16 → 开工 09-28 间隔 12 天，判据 1（task 目标方案）与判据 2（executor_env 平台前提）均成立；判据 3 命中一条，但命中的是**事实错误**而非"未解决前提"——`known_risks` 第 1 条与决策 ③ 的"zen 外观统一改变现有 f 键 zen 行为（meta 条 可见→隐藏）"**前提为假**：meta 条自 T082-P4（2026-07-30）起就已在 zen 下 `display:none`。更正后任务目标/URL 方案/锁死语义/影响面全不变，仅**范围缩小**（去掉无意义的 CSS 分支 + 去掉用户确认项），不构成严重漂移。已就地更新 P0-brief 三处字段 + 标注 [P0_STALE]
- DECISION（2026-09-28）：**不因该项打断用户**。P0-brief 原写"P1 与用户确认 zen 外观统一"——该确认项已因前提消失而**自然消解**（不存在"一套还是两套外观"的取舍，只有一套且已存在），无方向性分叉需人定夺，故不触发 NEED_CONFIRM/PAUSED，直接进 P1
- GATE PASS（2026-09-28）：环境自检完整版 1-5 全通过——工具链（pytest 9.1.1 / vitest 1.6.1 / vue-tsc 5.9.3 / ruff 0.15.18）、debug :8888（`make debug-quick`，v0.24.1，seed 19 entries）、版本一致性（VERSIONS.json 0.24.1 = 后端）、Chrome CDP 153 + Playwright 1.61.1、vision-engine `quick` 实调成功
- DECISION（2026-09-28）：**实核方式 = DOM 实测 + vision 独立复核 + git 历史溯源**三者交叉，而非仅读 CSS 下结论。DOM 实测（CDP 移动端 390×844）：无 zen 时 `.meta-tags-bar` `display:flex`/h=89px，按 f 后 `display:none`/h=0；vision 独立确认"页面最顶部没有显示标题/作者/时间的窄横条"；git 溯源定位引入 commit = 59ab6f7e `wf(T082-P4)`（2026-07-30，早于立项）
- 校正记录（2026-09-28）：P0-brief 称 zen CSS 隐藏 `.detail-header/.file-sidebar/.toc-sidebar/.mobile-actions/.mobile-sticky-header/.mobile-bottom-bar`——`layout.css:649-654` 确为这 6 项（**不含** `.meta-tags-bar`）；第 7 项在 `EntryDetailView.vue:260` 的 scoped 样式。**zen 隐藏集分布在这两个文件**，是 P1/P2 须注意的遗漏面
- 新增风险（2026-09-28 实核发现，已写入 P0-brief）：`/{slug}/f` 现状返回 **HTTP 200 + NotFoundView**（catch-all 放行但路由未注册），即"错误链接静默 200"——须转成回归 BDD
- NEXT: 写 P1-dispatch-context-analyst.md + AGATE_CARD 注入 → 派发 analyst 产出 P1-requirements.md → 派 requirements-review（agent≠main）→ 跑 check-gate P1
- GATE PASS（2026-09-28）：check-frontmatter.py P1-requirements.md exit 0；check-gate.py P1 exit 1 仅因 P1-review.md 尚未产出（评审进行中，属预期中间态）
- DECISION（2026-09-28）：**主 Agent 不采信 analyst 的自我报告，独立复核其三条关键发现**——① `.mobile-actions` 死选择器（复核为真：src 内 0 组件渲染，仅 zen-shortcut.ts:16 + CSS 引用）② 重复 spec 文件（复核为真：180 行 vs 238 行且 git 均 track，vitest 实测两者都被收集 26+18 tests）③ t052:141 恒真假绿（复核为真：断言体确为 `expect(true).toBe(true)`）。三条全部成立 → analyst 产出可信度确认
- 发现（2026-09-28，主 Agent 实核）：**analyst 的「同类扫描」更正了主 Agent 自己给出的事实 B**——zen 隐藏集实为 **8 项 + 3 处机制**，主 Agent 的 dispatch-context 漏了 `layout.css:208` 的 `.zen-mode .resize-handle`。主 Agent 已复核该项为真。这正是"主 Agent 的客观事实也可能不全"的实例——已按 analyst 的 §4.2 表格为准
- GATE FAIL → DIAGNOSIS（2026-09-28）：debug 服务在评审期间**掉线**（挂托底的 keepalive 后台 job 到期结束，服务随之被回收；`:8888` 无监听）。诊断：DSH 沙箱下服务存活跟随挂它的那条调用，非服务自身崩溃。处置：重启并**加长托底至 7200s**（bash-745），重启后 `/health` 200 复验通过
- 发现（2026-09-28，主 Agent 实核，**比 DEBT0012 现有登记更精确**）：`make debug-seed` 的「19 条 vs 22 条」不是随机偶发，而是**确定性时序缺陷**——`seed-debug.py` 先建 entry（L173）后建 team（L264），而 `entry_service._resolve_team_for_user` 对不存在的 team 抛 422。故**全新 DB 首次 seed 时 3 条带 `team_id` 的 entry（`csv-employees`/`markdown-test`/`mermaid-charts`）必定 422 失败**，total=19；**重跑一次即 22**（team 已存在）。已在全新实例 :8889 上双跑复现（首跑 3×422 + total 19 → 重跑无错 + total 22）。**本任务影响**：BDD-7/BDD-15 的 Given 引用了其中两条，且 `make debug-seed` 默认 `tail -10` **截断掉了 FAIL 行**（用 Makefile 看不到失败）→ 已把该根因与截断问题写入 requirements-review 的 dispatch-context，要求评审判定 BDD 前提是否需显式声明身份或改用匿名可达等价 seed
- DECISION（2026-09-28）：**DEBT0012 的"偶发"定性需更正为"确定性"**，且需补记「Makefile `tail -10` 截断掩盖 FAIL 行」与「带 team_id 的 entry 匿名不可见（is_public:true 亦 404）」两条新事实。本任务**不做修复**（超出 TPV0099 范围，DEBT0012 已归属 TPV0097）——仅登记并要求 P1 的 BDD 不依赖该缺陷行为
- GATE FAIL（2026-09-28）：check-gate.py P1 → **exit 1**（`P1-review.md frontmatter status 非 approved（当前: needs-revision）`）
- DIAGNOSIS（2026-09-28）：requirements-review 判定 **needs-revision**——8 项必修 + 8 项建议。**未判 rejected**（任务目标与三个 P0 决策成立，无需回 P0；问题集中在 BDD 判据可执行性与声明自洽，可改写修复）。主 Agent **独立复核了 reviewer 的关键新发现，全部为真**：
  1. **BDD-3 与 BDD-2 互斥（最严重）**：主 Agent 用 Playwright 实测 zen 态 `yaml-docker-compose`——Then「100px 内无 ≥90% 视口宽且 ≥8px 高的可见横条」命中 **14 个元素**（HTML/BODY/#app/`.entry-detail.zen-mode`/`.detail-content`/`.content-area` 自身 1264×705 top=0，以及 TreeView 的 `.tree-view`/`.tree-search`/`.tree-list`/`.tree-node-row` 等满宽容器）。**满足 BDD-2（内容区 top=0、高=视口高）就必然 FAIL BDD-3** → 判据自身不可通过，必须补排除项
  2. **BDD-7/BDD-15 的 seed 不可匿名访问**：`csv-employees`（BDD-7）与 `mermaid-charts`（BDD-15）均 `team_id` 限定 → 匿名 404。主 Agent 只提示了前者，**reviewer 独立发现后者**（同类第二例，正是 P1 卡「同类扫描」要防的漏项）
  3. **BDD-8/BDD-9 的 When 无对象可操作**（主 Agent 已独立复核）：`multi-format-demo` 四个文件**互相 0 个 markdown 链接**且 `data-peekview-file-id` 计数为 0（zen 下 file-sidebar 隐藏 + 抽屉触发在 header 亦隐藏 → 全屏视图内无任何文件切换入口，BDD-8 的 When 不可执行）；`dsh-architecture/ARCHITECTURE.md` 正文锚点链接 `](#` 计数 **0**（BDD-9 的 When 无对象可点）
  4. **BDD-15 事实错误**：`svg-icons` 是 **ImageViewer 路径的独立 SVG 文件 entry**（无 `.fullscreen-btn`），`mermaid-charts` 含 mermaid 但**不含 svg**——BDD-15 把两个性质不同的 entry 用"and"串在一条 Given 里
  5. **声明矛盾**：§2.5 明写"后端零改动"，但 `packages` 列了 `peekview-backend`、`domains` 列了 `backend`；且包名不合仓库惯例（先例 TPV0093 `[backend/peekview, frontend-v3]`、TPV0096 `[frontend-v3, docs]` 均为**路径式**，`peekview-frontend`/`peekview-backend` 在仓库中不存在）
  6. **P1 纯净性部分不通过**：§4.1/§2.3/§4.2 有 5 处指定方案选型（"新增状态或改类型"/"短路应在调用方实现"/"而非复用 zen 类"等）——属方案设计，应改为"P2 待取舍"
  7. **§2.1 事实更正**：`ShareDialog.vue:218`、`OverflowMenu.vue:150` 均为 **document 级**监听，P1 标为"元素级"有误（主 Agent 已复核）
  8. reviewer 同时确证放行项（BDD 编号连续、UX 三 gate 硬拦、同类扫描三处存量问题、`[P0_STALE]`、`[NO_NEED_CONFIRM]`）并直接调用 gate 子函数验证 `_gate_p1_vision_capability`/`_gate_p1_ui_shape` = True
- DECISION（2026-09-28）：**受理 8 项必修，回派 analyst 修订**（P1 retry 1/3）。同时**采纳全部 8 项建议**（均为主 Agent 认可的低成本判据收紧，其中建议 15/16 是事实性补记，必须做）。修订轮用**增量模式** dispatch-context（引用上轮产出与约束，不重写完整目标）
- DECISION（2026-09-28）：**BDD 数量将因拆分而增加**（BDD-13 拆出负向条、BDD-15 拆成 mermaid/SVG 两条）→ P6 验收条数须以修订后基线的最终 BDD 总数为准；主 Agent 在 P6 派发时按新总数核对
- DECISION（2026-09-28）：analyst 修订轮自主**新增 BDD-19**（中段路径 `/{slug}/f/<未知段>` 不误匹配渲染 entry 内容）并标注"主 Agent 可裁掉"→ **主 Agent 裁定保留**。理由：`/:pathMatch(.*)*` catch-all 确实存在，新路由若用通配/前缀匹配就会误命中——这是本任务核心机制的**真实回归风险**，不是凑数判据；且它把 §4.4 的散文冲突表约定升级为可执行判据，边际成本仅一条负向断言。已写入 rev 评审的 dispatch-context 告知 reviewer"按保留对待"
- 发现（2026-09-28，**主 Agent 独立复核必修 1 的修订结果，发现修正是无效的**）：**BDD-3 修订版（rev1）是恒真判据，永远不可能 FAIL**。Playwright/CDP 实测（`dsh-architecture`，桌面 1264 宽）：
  - **非 zen**（header 明确可见：`.detail-header` 1264×107 top=0，`.title-row`/`.meta-row` 同为满宽顶条）→ BDD-3 rev1 命中 **0**，**应当 FAIL 却判 PASS**
  - zen（正确实现）→ 命中 0（此处 0 是对的）
  - 根因：修订后的排除集把 `.entry-detail`/`.detail-content` **整棵子树**（"上述任一元素的祖先/后代"）排除，而 `.detail-header`/`.title-row`/`.meta-row` 等 chrome **恰是 `.entry-detail` 的后代** → 真实横条全被排除 → 候选集恒空。这与原判据是**反向的同类错误**：原判据"与 BDD-2 互斥必 FAIL"，新判据"恒真必 PASS"，**两者都不可二值判定**
  - **主 Agent 已验证的可修形式**（区分"排除自身" vs "排除子树"）：仅自身排除 `html/body/#app/.entry-detail/.detail-content`；子树排除 `.content-area` 及其后代 + `.markdown-viewer`/`.code-viewer`/`.table-view`/`.image-viewer`/`.html-viewer`/`.empty-state`/`.error-state`/`.loading-state` 及其后代。实测该形式：非 zen → 命中 **3**（`.detail-header`/`.title-row`/`.meta-row`）正确 FAIL；zen → 命中 **0** 正确 PASS
- DECISION（2026-09-28）：该发现已写入第二轮评审的 dispatch-context（含对比表与可修形式），要求 reviewer 独立复现并在 BDD-3 未真正修好时**继续给 needs-revision**。**主 Agent 不因"修订轮已交付"就采信其自我报告**——本轮实证：必需项 1 的自证（"修订判据命中 0"）结论虽真、但**论证不成立**（它只证明了 zen 下为 0，未做"非 zen 应 FAIL"的负向对照，故漏掉了恒真缺陷）。这是"绿灯不等于判据有效"的实例
- GATE FAIL（2026-09-28）：第二轮 check-gate.py P1 → **exit 1**（`P1-review.md` status = needs-revision）
- DIAGNOSIS + **独立收敛验证**（2026-09-28）：第二轮 reviewer **独立复现了主 Agent 的恒真判定**，并用三种状态实测把缺陷钉死：①正确 zen 实现 0 命中 ②`.detail-header` 强制恢复可见（1280×107 top=0）**仍 0 命中** ③新注入未纳入隐藏集的满宽横条（100%×40px）**仍 0 命中** → 三方（主 Agent / reviewer / analyst 上轮自证）中前两者独立得同一结论，第三方的自证被证伪
  - **两方独立收敛到同一修法**（强交叉验证）：区分「排除自身(+祖先)」与「排除自身+后代」——A 组结构链 `html`/`body`/`#app`/`.entry-detail` 仅排除自身+祖先（**不含后代**，因 `.detail-header`/`.title-row`/`.meta-row` 均是 `.entry-detail` 后代，排除子树会把真实横条一并排掉）；B 组内容流链 `.detail-content`/`.content-area`/`.markdown-viewer` 等排除自身+后代
  - 主 Agent 实测该写法双视口均成立：**desktop** 非 zen 命中 3（`.detail-header`/`.title-row`/`.meta-row`）→ 正确 FAIL，zen 命中 0 → 正确 PASS；**mobile 390×844** 非 zen 命中 1（`.mobile-sticky-header`）→ 正确 FAIL，zen 命中 0 → 正确 PASS
  - 主 Agent 与 reviewer 在 A/B 归类上有一处差异（`.detail-content` 归 A 组"仅自身" vs B 组"自身+后代"），**两者实测均通过** → 采纳 reviewer 的 B 组归类（更贴合"内容流容器"语义）
- DECISION（2026-09-28）：**受理唯一必修项，派发 rev2 定点修订**（retry 2/3）。rev2 范围严格控制为"只改 BDD-3 段落"，并要求 analyst **必须做三态负向对照实测**（含②③证明拦截力），明确写入"只验①不算通过"——直接针对上轮的错误模式
- 记录（2026-09-28）：第二轮 reviewer 的**两处如实更正**值得留存——① 承认其第一轮对 `image-gallery`/`legacy-deploy` 的合并叙述有误（`legacy-deploy` 确在库但 archived，成因 `seed-debug.py:204-209` 有意 PATCH）② 接受 analyst 未采纳其"限定 position: fixed|sticky"建议的理由。**reviewer 不因面子坚持错误判定**，是独立复核角色应有的行为
- 记录（2026-09-28）：第二轮 reviewer 报告的"`_gate_p1_vision_capability` 裸载返回 False"经其自查为**其加载器缺 `sys.path` 注入**（`read_vision_tri_state` 为 None）导致的误报，真实入口无此问题 → **不据此改产物**。主 Agent 复核：真实 `check-gate.py` 运行无此问题（见上条 gate 输出）
- GATE FAIL → DIAGNOSIS（2026-09-28）：rev2 执行期间发现 **debug :8888 再次掉线**（挂托底的 keepalive job `bash-745` 到期结束，服务随之回收）。这是本任务第二次遇到同一机制（第一次见上文 GATE FAIL → DIAGNOSIS）。诊断一致：DSH 沙箱下服务存活跟随挂它的调用。rev2 subagent **自行检测到停机并用 `make debug-start` + `make debug-seed` 恢复**（符合派发约束），主 Agent 亦并行重启并加长托底至 **14400s**（bash-1115）→ 服务稳定，seed 复灌 22 条 / 匿名 15 条，关键 seed `dsh-architecture` raw 200
- 记录（2026-09-28）：rev2 的**范围控制良好**——`diff` 仅 **1 个 hunk**（`@@ -151,14 +151,20 @@`，11 行有效增删，全部落在 BDD-3 段内），其余 18 条 BDD 与全部节零改动；BDD 编号 `grep -c` = 19 且序列 1–19 连续无跳号无复用
- GATE PASS（2026-09-28，主 Agent 亲自验，**不信 subagent 自报**）：rev2 的 BDD-3 已真正闭环——主 Agent **独立重写排除集实现**（A 组 = 元素 ∪ 全部祖先；B 组 = 元素 ∪ 全部后代，用 Set 累积后判定）实测三态：**①正确 zen 实现 0（PASS）/ ②`.detail-header` 强制恢复可见 3（FAIL）/ ③注入 `#bespoke-bar` 满宽横条 4（FAIL，②未还原故叠加）** → 判据对正确实现判 PASS、对两种失败态均判 FAIL，**拦截力确认恢复**
  - 踩坑记录（供后续阶段复用）：主 Agent 第一次实现排除集时误写成「`el.closest(A)` 或 `el.closest(B)`」，结果三态**全 0**——因为 `.detail-header` 是 `.entry-detail`（A 组）的后代，`closest` 会把它误排除。**A 组必须"元素 ∪ 祖先"、B 组"元素 ∪ 后代"用集合累积**，不能用 `closest` 统一表达。此坑已写入第三轮评审的 dispatch-context 提示 reviewer
- GATE PASS（2026-09-28，**P1 阶段正式通过**）：主 Agent 亲自跑 `check-gate.py P1` → **exit 2**（`P1-review.md approved + agent≠main + 含 BDD 锚点`）。第三轮 reviewer 给 **approved** 并独立实测 ①0/②3/③1（②③ 均被拦住），与主 Agent 独立实现的结果一致。**三方独立收敛**：主 Agent、第二轮 reviewer、第三轮 reviewer 各自实测同一结论，且第三轮 reviewer 在同一脚本内**并行计算 rev1 字面读法作为对照**——状态②下 rev1 读法候选集 0/命中 0（应 FAIL 却判 PASS），rev2 读法 3 → 这是"确实修好了"的直接证据
- 记录（2026-09-28）：第三轮 reviewer 的静态取证（回文件取证，非采信自述）：A/B 传播方向正确（`:155` A 组"自身+全部祖先，不含后代"并显式点出 `.detail-header` 是 `.entry-detail` 后代这一致命点；`:157` 另加"两组不可互换、不可统一写成祖先/后代"显式禁令）；Then 逐字未削弱；BDD-3 仍单一 GWT；全文 GWT 计数 **19/19/19**；编号 1–19 连续；**基线 diff 硬证未越界**（单 hunk `@@ -151,14 +151,20 @@`，16 行变更全在 BDD-3 块内，BDD-4 起零改动，frontmatter 未变）
- 记录（2026-09-28，第三轮 reviewer 如实披露的非阻塞边界）：其验收范围是"拦 chrome 层横条"（B 组语义 = 内容流内部满宽元素属内容而非 chrome）。若 P6 想覆盖"内容区内部被误加的固定横条"，那属**新增判据/新 BDD**，本轮未塞入——主 Agent 认可该边界划分（不扩大本轮范围）
- DECISION（2026-09-28）：**P1 通过后继续推进 P2**，不在里程碑停下等确认。依据项目 `AGENTS.md` 第 4 条（"长任务可按阶段简要汇报进展，但不要因此中断任务等待确认——除非出现真正需要用户决策/解答的问题"）。当前无 NEED_CONFIRM、无 CAPABILITY_GAP、无阻塞项，故按 P0-P8 默认全链推进；阶段进展通过本 log 与本轮汇报体现，不中断等待








