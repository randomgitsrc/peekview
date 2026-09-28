[13:26:56] architect P2 TPV0099 启动；读 dispatch-context + architect.md 完成
[13:27:22] 已读 P1/P0/project.md/useZenMode/router.ts；下一步读 EntryDetailView.vue + keys + TableView + header/mobilebar
[13:28:00] 已读 useZenMode/zen-shortcut/router/EntryDetailView/entryDetailKeys/TableView/main.py；下一步 resolve_entry_raw + header/mobilebar + layout.css + docs 相关节
[13:32:34] 读代码完毕（useZenMode/keys/router/EntryDetailView/TableView/layout.css/main.py/files.py/EntryDetailHeader/MobileBar/Makefile/playwright.config）；开始最小验证
[13:49:11] architect 启动：已读 P2-dispatch-context-architect.md（444 行）+ architect.md 角色定义（322 行）；关键约束已提取：R1-R3 决策、BDD-3 A/B 不对称、Not Modify 含 P1 §4.3 三处、gate_commands 禁 && 且需 P5_e2e
[13:49:27] 已读 P1-requirements.md 全文（468 行，19 BDD + §4.2 隐藏集 8 项 + §4.3 三处存量 + §8 R1-R6）；下一步读代码：router.ts/useZenMode/zen-shortcut/entryDetailKeys/EntryDetailView/layout.css/TableView/main.py
[13:49:45] 读代码中：router.ts(109行已读,/:slug 在 catch-all 前)、useZenMode.ts(36行)、zen-shortcut.ts(20行)、entryDetailKeys.ts(5行)、EntryDetailView.vue(265行：provide 3 个 key；scoped 隐藏 4 项；document keydown 在 onMounted:216)
[13:50:05] 读 layout.css 关键行：:208 .zen-mode .resize-handle；:649-654 六项；:624-626 桌面 meta 隐藏；EntryDetailHeader.vue:3,13 v-show=!zenMode 兜底。下一步查 zenMode inject 消费方 + 后端 R1
[13:50:50] 读 P0-brief(120行) + playwright.config(46行) + main.py:25/53-69/598-629；准备查 Makefile targets / project.md / decisions/ / e2e 规范
[13:51:15] 读 Makefile targets（test-quick:163/test-frontend:173/typecheck:193/lint:185/debug-test:648/debug-seed:570）；decisions/ 目录不存在（无既有跨任务决策需读）；e2e specs 已列；下一步读 e2e 编写规范 + project.md
[13:51:24] 读 project.md gate 命令 + e2e 规范（tpv0091 spec）完毕；下一步：确认 :8888 在线 + 检查主 Agent 已写的 p2-*.cjs 脚本
[13:51:50] 开始最小验证：跑主 Agent 留下的 p2-key.cjs（键盘分发顺序 + 锁死模拟）+ p2-mobile.cjs（BDD-18 基线 + 移动端 zen 几何 + aria）
[13:52:31] p2-key.cjs 结果：V1 /yaml-docker-compose/f → path 保持 + .not-found 存在（确认现状落 catch-all）；V2 锁死模拟(document-bubble 仅 preventDefault) → listbox 关闭 + defaultPrevented=true；V3 capture+stopPropagation → listbox 保持打开（反证：吞掉风险真实存在）；V4 现实 zen 下 Escape → listbox 关闭且 zen 退出
[13:53:26] p2-bdd7.cjs 结果：document 级 bubble 监听在 target 元素处理之后运行；parent bubble preventDefault 不阻断 child（A 组 order=[child,parent]）；capture+stopPropagation 才阻断（B 组）→ R3 结论方向确定：锁死短路须「不 preventDefault、不 stopPropagation、保持 bubble 相位」
[13:53:54] p2-mobile.cjs 结果：V5 单段不存在 slug → .entry-detail 存在 + .error-state「Request failed with status code 404」+ 无 .not-found（BDD-18 对照基线成立）；V6 移动端 390×844 zen 几何 top=0/h=844/sticky+bottom+meta 全 display:none/scrollHeight 5227 可滚到底；V7 aria 现文案含 Escape（锁死态须改）+ 内容区外可聚焦元素 0
[13:54:20] 写 p2-arch-router.cjs（router resolve 打分复核 + 真实 .resolve + BDD-8 zen 链接可点性）；准备实跑
[13:56:39] 写 p2-arch-route-inject.cjs（真实 vue-router addRoute '/:slug/f' 后 resolve 复核 + 客户端导航组件复用检测 + 直接整页加载 route.meta 可读性）
[13:56:56] 修 p2-arch-route-inject.cjs（改用 router.currentRoute.matched[0].components.default 取组件定义）后重跑
[13:58:28] p2-arch-route-inject 关键结果：真实 vue-router addRoute '/:slug/f' 后 —— /slug/f → __probe_locked（胜出）；/slug/f/xyz → 仍落 catch-all（BDD-19 ✓）；/slug/F 大写也命中 /:slug/f（vue-router sensitive:false）；step3 客户端导航 /slug→/slug/f sameDomNode=true（组件实例复用，isLocked 必须响应式，setup 常量会失效）；step4 整页加载因 addRoute 只存在于内存故落 not-found（预期）
[13:58:42] R1 JSON-accept 实测：/settings→404 JSON、/stars→404 JSON、/explore→200 HTML、/dsh-architecture→200 JSON、/dsh-architecture/f→404 JSON、/dsh-architecture/raw→302。关键：FRONTEND_ROUTES 仅 {'' ,'explore','settings/apikeys','login'}，settings/stars/teams/admin 均非 frontend route → 现有行为已是「非白名单路由 JSON-accept 落 resolve_entry_raw」
[14:00:27] 追加 R1 数据：/teams,/admin,/settings JSON-accept 均 404 JSON（现有前端路由同样 404，非 /f 独有）；/users/alice 200 HTML（前缀白名单）、/explore 200 HTML、/login 200、/settings/apikeys 200；浏览器 Accept 下 /slug/f = 200 text/html
[14:01:25] 写 p2-arch-routetable.cjs（node 直接用 vue-router.cjs + createMemoryHistory 对候选路由表做全路径 resolve，含插入位置前后对照）
[14:03:40] 写类型探针 frontend-v3/src/__typeprobe_zenkey.ts（验证 computed 能否 provide 给 InjectionKey<Ref<boolean>>；R2 核心类型假设），跑 vue-tsc
[14:04:16] vue-tsc 对类型探针 exit=0 无报错——需反证非恒真：加故意错误再跑
[14:04:38] 反证成立：vue-tsc 对故意错误 exit=2（TS2322）→ 说明前次探针 exit=0 非恒真。结论：computed/readonly 可赋给 InjectionKey<Ref<boolean>>（Vue 3.5.34 中 ComputedRef extends Ref）→ R2 方案 A2 类型可行。恢复探针复跑确证后删除
[14:05:34] 类型探针已验证并删除（computed/readonly 可 provide 给 InjectionKey<Ref<boolean>>，Vue 3.5.34）。下一步：读 zenMode 消费方细节 + useResponsiveLayout.metaTagsHidden + EntryDetailContent
[14:08:06] 查 agate 脚本：check-frontmatter.py / agate-md-field-set / formatters 目录；并查 DESIGN.md Zen 节行号 + CHANGELOG + VERSIONS.json
[14:09:40] 查 requestFullscreen / banners 可聚焦控件 / run-e2e-tests.sh E2E_SPEC / formatters README
[14:12:09] 写 R2/R3 最小验证 HTML 探针（Vue+vue-router UMD 真实组件树：meta 驱动 computed zen + provide computed 给子组件 v-show + 锁定 no-op 短路 + 元素级 Escape 消费）
[14:12:42] 跑 p2-arch-r2r3.cjs（独立 Vue+vue-router 真实组件树，验证 R2 computed-zen+provide 与 R3 no-op 短路；含捕获相 stopPropagation 反证）
[14:15:49] 修 p2-arch-r2r3.cjs：改用 createMemoryHistory（避免 web history push 触发真实导航销毁执行上下文）后重跑
[14:16:26] 再修：/health 页有 CSP default-src none 阻挡 addScriptTag，改 about:blank
[14:16:49] 修 p2-arch-r2r3.cjs：S3/S5 需先 focus 内容区内嵌元素才能触发元素级 @keydown（原次 elementEscape=0 属 vacuous，不算验证）
[14:18:47] 查 Link header：curl -I 用 HEAD 得 405（路由仅 GET），改用 GET -D 复核
[14:20:38] 待验证：①archived banner 在 zen 下是否同样可见（R-12 的既有行为论断须实测）②zenMode.value 写入点全仓 grep ③agate-md-field-set.py 用法 ④P2 gate UI 设计节校验口径
[14:22:07] 关键发现待实测：BDD-3 的排除集不含 .expired-warning-banner/.archived-banner（EntryDetailBanners 渲染在 .entry-detail 内、内容区外，width:100%）→ 归档/过期 entry 在锁死态会命中 BDD-3 禁项。P1 §5 已述 legacy-deploy 在 debug DB 中为 archived。查构建产物里的 scoped hash 以便用真实 CSS 实测
[14:22:29] 跑 p2-arch-banner.cjs：在真实 zen 态注入 EntryDetailBanners 真实 DOM（含 scoped 属性），按 BDD-3 A/B 规则复现判据，验证 banner 是否为遗漏的满宽横条
[14:22:45] 修 p2-arch-banner.cjs：content-area 不是 .entry-detail 直接子节点，改用 .detail-content 作插入锚点
[14:26:21] 跑 p2-arch-real.cjs：真实 archived entry（legacy-deploy，alice 登录）在 zen 下的 banner 几何 + 桌面 BDD-2 几何 + addRoute 后真实 useRoute().meta 可读性
[14:27:48] 跑 p2-arch-bdd1811.cjs：注入候选路由后逐条探 BDD-18/19/11/1 的真实落点 + 锁死路由快照（BDD-1/2/3 基线）
[14:29:45] 跑 p2-arch-edge.cjs：候选路由表边界（/f/f、/settings/f、/users/f、/teams/f 等两段路径；静态段路由故意排在 /:slug/f 之后验顺序无关性）
[14:36:14] 跑 p2-arch-r2variant.cjs：R2 三种承载方式首帧对比（computed / watch 无 immediate / watch 带 immediate）——区分能否满足'直入'语义
[14:37:25] 查 Makefile check-docs/check-changelog/check-version 内容 + vitest.sh formatter + e2e-safety-check 是否需要 spec 存在
[14:38:39] 最后一批验证：①BDD-10 的 ?share= 后 router.replace 是否保留 /f 后缀 ②e2e/单测是否断言 aria-live 初始为空 ③BDD-6 词表对候选 aria 文案的自检
[14:39:27] 跑 p2-arch-bdd108.cjs：BDD-10（?firstFileId 后 router.replace 是否保留 /f）+ BDD-8（锁死路由下文件间链接可点性与保态）+ BDD-6 词表自检
[14:40:37] 跑 p2-arch-r2back.cjs：A(computed) vs B(ref+watch) 在 前进/后退/再进/再按键 8 步序列下逐一比对 —— 验证 R2 承载方式的状态一致性
[14:41:00] 修 p2-arch-r2back.cjs：A 变体把 f 写入 computed 是探针 bug（computed 只读），改为写 manualZen 后重跑
[14:43:49] 跑 p2-arch-zen8.cjs：多文件 entry（unicode-filenames）zen 下 8 项隐藏集逐一实测 + 从 CSSOM 反查 zen-mode 隐藏规则来源（核对 P1 §4.2 的 7+1 分布）
[14:44:09] 补跑 p2-arch-csssource.cjs：上一步 css_rule_hits 为空，反查 stylesheet 加载/CSSOM 可访问性
[14:44:24] CSSOM 未命中 zen-mode 规则——需核实构建产物是否含 zen 隐藏集（可能 static 是旧构建，或规则在 media query 内）
[14:45:35] 8 项隐藏集证据链：CSSOM 反查为空（我的 walk 有 bug），改用构建产物 grep 直接命中：index-Ch-pgAwR.css（layout.css:208 resize-handle 1 条 + :649-654 六项 1 条组）+ zsh-Dx9y5tKO.css（EntryDetailView scoped 的 4 项含 meta-tags-bar）。行为侧 8 项 display 全部 none（桌面 3 项 + resize-handle；移动 3 项由 p2-mobile 实测）。下一步读 main.ts 判 FOUC 前提
[14:47:35] 后台跑 make test-frontend 测真实耗时基线（用于 P5_timeout_seconds 定档）
[14:47:35] 跑 p2-arch-replace.cjs：验证 EntryDetailView.vue:215 的 router.replace({path: route.path, query:{}}) 是否保留 /f 后缀（BDD-10 关键前提；前次探针因组件复用未触发 onMounted）
[14:50:28] 跑 p2-arch-coldstart.cjs：冷启动（初始 location = /:slug/f + 懒加载组件）下 setup 期 route.meta 可读性与首帧 zenMode（模拟真实直载 /{slug}/f）
[14:51:23] 修 p2-arch-coldstart.cjs（onMounted 内 DOM 尚未插入，#app 内容由 mount 后渲染；改为在 evaluate 时读取）后重跑
[14:51:37] 修 p2-arch-coldstart.cjs（须先 await router.isReady() 再 mount，否则初始导航未完成不渲染）
[15:00:39] p2-arch-coldstart.cjs 挂死（evaluate 返回未决 Promise）→ 改为 waitForSelector('.val') 等待渲染
[15:01:06] 跑 p2-arch-cold2.cjs：冷启动（初始 location=/:slug/f，非懒加载）下 setup 期 route.meta 可读 + 首帧 zenMode 两变体对比
[15:01:29] 跑 p2-arch-cold3.cjs：两段式冷启动（push 后 mount）三变体首帧对比
[15:02:55] 跑 p2-arch-leak.cjs：候选 C（setup 一次性写 zenMode ref）在离开锁死路由后是否残留 zen —— 用于候选方案取舍的实证
[15:03:10] 候选 C 实测残留确认：离开锁死路由后 val 仍 true/chrome none，且 f 键无效 → 候选 C 淘汰。
[15:05:27] 类型探针2（route.meta?.zen 可选链 + computed provide）vue-tsc exit=0
[15:05:40] 类型探针2 exit=0（route.meta?.zen 可选链 + computed provide 给 Ref key 均类型通过）。ZenAriaTextKey 无 inject 消费方（仅 provide + 测试 mock）→ aria 文案可安全改为 computed
[15:08:38] 清理 fmtest
[15:15:03] 已向主 Agent 发送中途关键发现（R2/R3 定论 + BDD-3 banner 遗漏面 [SCOPE+] 待裁决 + R1 现状一致性）；开始撰写 P2-design.md
[15:15:51] 继续验证：①gate key 合法性（P3_e2e/P5_e2e_regression）②make check-docs 现状是否为绿（决定能否作为 fitness function）
[15:17:09] 后台跑 E2E_SPEC=e2e/viewer.spec.ts make debug-test（确认拟声明的 P5_e2e_regression 键当前为绿；否则不能声明）
[15:22:28] viewer.spec.ts 实测 18 failed → 预存红灯，不可作为 gate 键（成因：markdown-test 团队限定需登录，正是 P0 登记的 DEBT0012/team-scoped 陷阱）。改用新建 spec 分键。现验证 make lint / make typecheck 是否为绿
[15:22:42] lint exit=0 / typecheck exit=0（均绿，可作 gate 键）。删掉 E2E 产生的 test-results/playwright-report 临时产物（它们不是我的产出）
[15:26:41] P2-design.md 写盘完成；开始 frontmatter 校验（check-frontmatter.py + field-get 逐字段核对 + gate UI 节校验）
[15:28:00] UI 设计节 gate 子检查通过（is_render_form=False、canonical=layout 与 P1 一致、布局/交互/视觉三关键词齐备）。跑完整 check-gate.py P2（预期因 P2-review.md 未生成而 exit 1，属正常——评审由主 Agent 派发）
[14:5x] ✅ P2-design.md 完稿。核心结论：3 候选方案（A=route.meta 派生 computed + node 级短路 + 复用 zen 类【选定】；B=watch ref【实测无 immediate 会 FOUC，淘汰】；C=setup 一次性 ref【实测组件复用下残留 zen + f 键永久失效，淘汰】）
[14:5x] R1=不处理（JSON-accept 404 是 FRONTEND_ROUTES 白名单的普遍行为，/settings /stars /teams /admin 同样 404；让 /f 返 HTML 属不一致扩大）；R2=computed 派生（locked 只读不落 ref，manualZen 可写，物理上无法污染 f 键 zen）；R3=锁死时整个 handler return（不 preventDefault/不 stopPropagation/保持 bubble）
[14:5x] 最小验证 V1-V13 全部实跑（router resolve 全路径矩阵 / 组件复用 / R2 三变体首帧 / 事件相位与吞掉机制含反证 / 8 项隐藏集逐一 + CSS 产物反查 / 保态 / 移动端几何 / 词表自检 / R1 路由矩阵 / 类型探针含反证 / gate 基线）
[14:5x] 校验全绿：check-frontmatter exit=0；_gate_p2_ui_design_section=True（is_render_form=False、canonical=layout 对齐 P1、布局/交互/视觉三关键词齐备）；check-gate P2 exit=1 仅因 P2-review.md 未生成（评审由主 Agent 派发）
[14:5x] gate_commands 核验：无 && 拼接、无裸 make debug-test、全部引用 Makefile target、P5_e2e + P5_e2e_auth 定向 spec、11 个 _timeout_seconds、无非法 P3_xxx
[14:5x] 环境：debug :8888 健康（v0.24.1）；生产 ~/.peekview/peekview.db mtime 09:04 未触碰 → [PROD_NOT_TOUCHED]
[15:30:18] progress 收尾完成

## retry 1/3 — 定点修订轮（rev1 派发，权威清单 = P2-review.md §5.1/§5.2/§5.3）

[rev1-1] 开工先探 debug backend：`curl :8888/health` → **200**（本任务该服务已掉线 3 次，按纪律先探再用）
[rev1-2] **R-1（B-1 锁死态接口唯一化）** 落点 6 处：M2①（`:46`，`locked: () => boolean` 入参 + 只读派生不落 ref，显式声明"文中不存在 lockedMode 状态变量"）；M2②（`:46`，`lockedMode.value` → `locked()`）；M2③（`:46`，定论**移除 `updateZenAria`** 并从返回对象删键，`zenAriaText` 改 computed）；M3（`:47`，裸值 → **thunk + `?.` 可选链**）；`:118` 草图注释（"形态示意" → "**签名与调用形态为最终规格，P4 照此实现**"，并补调用点最终规格行）；`:136` 风险①（补 thunk 前提：兼容性结论**仅对 thunk 成立**，裸值在调用点求值早于 mock 拦截）
[rev1-3] R-1 追加：新增 §1.1「锁死态接口最终规格」表（签名/调用点/读取方式/返回对象四面唯一）+ **三个禁止变体**（裸值→TypeError、ref+赋值分支→TS2540、`locked: boolean`→setup 期快照假绿）；「route.meta 访问方式二选一」**显式定案取可选链**（既有两处 useRoute mock 无需改动、不进 M 栏），不留"待决定"
[rev1-4] R-1 追加：M9（`:53`）补第 4 条单测「**锁定态派生随 route meta 翻转**」（thunk 返回 false→true→false 断言 zenMode/zenAriaText 翻转且不重调 useZenMode）；§5 完成标志第 2 条同步扩写；§2.4 R2 结论、§3.2 显式区分表、§8 files_to_read 的 useZenMode 条目同步改述
[rev1-5] **R-2（B-2 BDD-10 认证配对）** 落点 5 处：§6.1 映射表 BDD-10 认证前提列（"需 alice 登录 或 自建私有 entry" → "**登录创建自建私有 entry + 登录建 share**"）；`:501` BDD-10 特殊处置（去"匿名创建 + 匿名删除"）；`:503` 认证配对注意整段改写为 5 步认证链路 + `{slug, share_id}` 二元组 + 清理判据改「**alice 复查 raw = 404**」+ 三条服务端约束实证 + 不采用匿名删的理由（依赖 `config.server.api_key` 为空，非稳定契约）+ 区分力判据（真 token 可见／无 token・伪 token 不可见）；M8 行、§6.5 第 4 条、`env_constraints.auth_premise` 同步
[rev1-6] R-2 追加：§8 `files_to_read` 补两条 share 条目（`t058-share-redesign.e2e.spec.ts:25-95` 认证配对范本 + `backend/peekview/api/shares.py:18-23` 三端点 `Depends(require_auth)` 契约依据）——原清单**零 share 条目**
[rev1-7] §5.3 非阻塞项一并处理（NB-10 属主 Agent 动作，未触）：**NB-1** viewport 钉定升为 §6.1 显式硬约束（playwright.config 双 project 默认 = 1280×720 / 393×727，**均不等于 BDD 的 1280×800 / 390×844** → 两个 spec 必须 `test.use({viewport})`，附 10+ 处先例行号）；**NB-2** `.auth_premise` 的 `?firstFileId=43` 改为 `resolveFileId(request,'rich-markdown.md')` 动态解析（序号随 DB 重建失效）；**NB-3** Not Modify 新增 **N14**：`t082-error-format.spec.ts:9-16` 的 300 行上限为既有不可越界约束（实测 265 行）
[rev1-8] §5.3 续：**NB-4** §6.2 `P5_lint` 覆盖面描述更正（`Makefile:185` 的 ruff **只覆盖后端 Python**，测不到前端越界；前端无 lint/适应度工具，属既有空缺）；**NB-5** 补 `P5/P6_timeout_seconds: 120` 的**适用前提**（`Makefile:173` 含 `npm ci` 分支 → node_modules 缺失时分钟级、120s 会误报失败；**档位按指令未改**，只登记前提）；**NB-6** 修 §7 悬空引用两处 → §1.3，并把 UI 设计节标注为"专题节，不参与章节编号"+ §8/§9/§10 上移为 §7/§8/§9（消除 6 → UI 设计 → 8 断档）；**NB-7** 补「布局/视觉维度候选等价」的显式论证；**NB-8** `project_module` 行内注明口径
[rev1-9] 中途核对：`agate-read-gate-commands.py` 对修订后 gate 块 → `project_module: "src/"`、`commands`/`formatter` 均正常，exit=0；`parse_ui_design_section` 仍命中（shape=layout / dim 三关键词齐备）——**序号调整未破坏 gate 契约**
[rev1-10] 本轮只改 markdown 规格文本 → **回归确认未破坏任何已固化契约**：`make test-frontend` **110 files / 1343 passed | 4 skipped (1347)**，17.56s（与派发基线逐字一致，**无 DiagramBlock flaky**）；`make typecheck` ✓ passed exit=0；`make lint` All checks passed exit=0
[rev1-11] 产出校验全绿：`check-frontmatter.py P2-design.md` **exit=0**；`agate-read-gate-commands.py` → `project_module: "src/"`、`RECONCILE SUMMARY: 0 mismatches`、**exit=0**；`parse_ui_design_section` 仍命中（shape=layout 与 P1 一致、布局/交互/视觉三关键词齐备）——**章节重编号未破坏 gate 契约**
[rev1-12] 探针与残留复查：`git status --porcelain frontend-v3/` **为空**；`frontend-v3/src/` 无 probe/tmp 残留（本轮全程未在 src 放任何探针，只读+改 markdown）
[rev1-13] 环境：开工/收工各探一次 debug `:8888/health` → 均 **200**；生产 `~/.peekview/peekview.db` mtime 仍为 **09:04:16**（未触碰）→ **[PROD_NOT_TOUCHED]**。未跑 `uvicorn`、未跑 `make debug`/`npm run dev`，未触碰 `:8080`
[rev1-14] ✅ 本轮完稿。**R-1 落点 8 处**（M2① `:46`、M2② `:46`、M2③ `:46`、M3 `:47`、`:118` 草图注释、`:136` 风险①、§2.4 R2 结论 `:193`、§3.2 表 `:233`）+ **新增「最终规格」表与三禁止变体块（`:61-77`）** + **M9 补单测（`:53`）** + §5 完成标志 `:448`；**R-2 落点 5 处**（§6.1 映射表 `:497`、BDD-10 特殊处置 `:505`、认证配对注意段 `:507-517` 整段改写、M8 `:52`、§6.5 `:573`、`env_constraints.auth_premise` `:702`）+ **`files_to_read` 补 2 条 share 条目（`:670-673`）**；§5.3 非阻塞 NB-1~NB-8 一并落定（除 NB-10 属主 Agent 动作）
[rev1-15] ⚠️ 一次 flaky 观测（如实登记）：rev1-10 后的第 2 次 `make test-frontend` 出现 **1 failed | 109 passed**（Tests 1 failed | 1342 passed | 4 skipped）。按派发指引的提示定性为**已知 flaky**，并做了三重确认：① 随后**连续两次**完整复跑均 **110 passed / 1343 passed | 4 skipped (1347)** 全绿；② 单独隔离 `npx vitest run src/components/__tests__/DiagramBlock.spec.ts` → **24 passed**；③ **因果排除**：本轮全程只改 `P2-design.md`（markdown 规格文本），`git status --porcelain frontend-v3/` **为空** → **零源码改动**，该失败在因果上不可能由本轮修订引入。**不构成本轮修订的回归证据，也不改基线**（仍 110/1343）。

## retry 2/3 — 极小补丁轮（rev2 派发，权威清单 = P2-dispatch-context-architect-rev1.md **附录 C**）

> **性质**：**事实更正**（归属措辞），非新问题、非新风险、非新阻塞项。根因在主 Agent 第一轮派发上下文（`P2-dispatch-context-architect.md:414` 把「seed 时序 422」与「team-scoped 匿名 404」两个不同根因捆在同一 `DEBT0012` 标签下）——本轮即该缺陷的补救，与 `agate-workspace/debt/tech-debt.md` 中 DEBT0012 条目下就地补记的区分对齐。

[rev2-1] 开工先探 debug backend：`curl :8888/health` → **200**
[rev2-2] **先复核附录 C 的三条事实源，全部为真**：`git log --oneline -1 d4b05ee4` → `wf(TPV0088-P5): 技术验证通过（E2E 38/38 全过…）`（= 该 spec 最后一次全绿）；`git log --oneline -1 59182590` → `feat(seed): 给 seed entry 指派团队（TPV0095）——markdown/mermaid→frontend-team, csv→backend-solo`（= 语义变更引入点）→ 归属更正**有据可依**，非照抄
[rev2-3] **4 个落点全部就地更正**（`:118` R-08 风险表 / `:543` §6.3 性质 / `:544` §6.3 处置③ / `:700`→现 `:709` `env_constraints.known_red_baseline` / `:718`→现 `:727` §9 汇总表第 3 行）：
  · `:118`：「即 P0 登记的 DEBT0012 类前提」→「成因为 TPV0095 引入的 seed 语义回归，**不属 DEBT0012**——判定见 §6.3 三维对照」；缓解列「归 DEBT0012」→「归 **TPV0097/TPV0098「用例可信治理」**」
  · `:543`：「与 P1 §2.4 team-scoped 前提同源（P0 登记的 DEBT0012 类）」→「成因为 **TPV0095 引入的 seed 语义回归**——**归属 TPV0097/TPV0098「用例可信治理」**，**不归 DEBT0012**」
  · `:544`：「建议归入 DEBT0012 的后续清理（主 Agent 决定是否立项）」→「**归属 TPV0097/TPV0098「用例可信治理」范围**，本任务不新立条目」
  · `:709`：`known_red_baseline` 尾部「归 DEBT0012」→「归属 TPV0097/TPV0098「用例可信治理」（TPV0095 引入的 seed 语义回归；**不归 DEBT0012**——判据见 §6.3：重跑 make debug-seed 不能恢复）」
  · `:727`：§9 表「建议归 DEBT0012 后续清理 / **待主 Agent 决定是否立项**」→「（TPV0095 引入的 seed 语义回归，**不归 DEBT0012**）/ **归属 TPV0097/TPV0098「用例可信治理」，本任务不新立条目**（主 Agent 已决定：不立项）」
[rev2-4] **三层区分落为文档内显式对照表**（附录 C 表格原样采纳，`§6.3` 新增 3 行表）：根因（entry **未入库** 数据缺失 vs **可见性语义变更** 数据完好）/ **重跑 `make debug-seed` 能否恢复（**能** vs **不能**）** / 修复面（`scripts/seed-debug.py` 时序 vs E2E 用例与 seed 语义对齐治理）。**判据句**同时写入 `known_red_baseline`，使 gate 声明层与论证层口径一致
[rev2-5] **边界严守核验（逐条）**：① §6.3 三条实质结论**一个字未动**——「既有 spec **不作 gate 键**」「本任务 E2E 键**全部指向新建 spec**」「P4/P5 **不得为让 E2E 全绿而改既有 spec**」（含 §6.3 末条推论段原样保留）；② **未**改 `viewer.spec.ts` 本身（`git status --porcelain frontend-v3/ backend/ scripts/` → **0 行**）；③ **未**新增风险条/阻塞项（R 表无新增行，仅在 R-08 行内改归属措辞）；④ **未**触 rev1 的 R-1/R-2 任何内容（`§1.1` 最终规格表、三禁止变体、§6.1 BDD-10 五步认证链路与 `{slug, share_id}` 判据均原样）
[rev2-6] 残留复核：`grep -n "DEBT0012" P2-design.md` → 命中 **5 行，全部为「明确说明不归 DEBT0012」的对照性表述**（`:118`/`:543`/`:544` 表头/`:709`/`:727`），**无一处把红灯归属给 DEBT0012**——符合派发允许的例外口径
[rev2-7] 产出校验全绿：`check-frontmatter.py P2-design.md` **exit=0**；`make typecheck` → `✓ type check passed` **exit=0**；`make lint` → `All checks passed!` **exit=0**；`agate-read-gate-commands.py`（`GATE_FILE=<abs path>`）→ `project_module: "src/"`、`RECONCILE SUMMARY: 0 mismatches`、**exit=0**（新增表格未破坏 gate 契约）
[rev2-8] 环境：开工/收工各探一次 debug `:8888/health` → **200**；生产 `~/.peekview/peekview.db` mtime 仍为 **2026-09-28 09:04:16**（与 rev1 逐字一致，未触碰）→ **[PROD_NOT_TOUCHED]**。未跑 `uvicorn`、未跑 `make debug`/`npm run dev`，未触碰 `:8080`；临时产物零新增（本轮全部就地 edit，未落 `.agate-tmp/`）
[rev2-9] ✅ 本轮完稿。**改动 4 处落点、净 +9 行**（`P2-design.md` 726 → 735 行）；子派发未启用
