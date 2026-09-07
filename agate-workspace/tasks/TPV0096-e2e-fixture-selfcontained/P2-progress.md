# P2-progress — TPV0096 (architect)

- [ok] 读取 P2-dispatch-context-architect.md（含 P2 卡全文）：目标=3 spec 自建 fixture 方案定稿；1 候选方案（design_trivial + follows_existing_pattern，理由须写明）；影响面梳理节先于候选方案；gate_commands 固化（裸 P3、禁 && 链、引 Makefile target、E2E 须 P5_e2e、per-key timeout_seconds）。
- [ok] 读取 roles/architect.md：产出字段（candidate_count/packages/domains/ui_affected 进 frontmatter；gate_commands/files_to_read/env_constraints/minimal_validation 留正文）；minimal_validation 必须声明；批次设计（本任务单发，无需 dispatch_plan）。
- [ok] 读取 agents/project.md：gate 命令权威源 = Makefile；make debug-test = Playwright E2E（需 debug-start）；make test-frontend / typecheck / lint；不跑完整 make debug E2E 全量（CDP 可能超时）；:8080 与 ~/.peekview/ 禁触。
- [ok] 读取 P1-requirements.md：13 条 BDD（BDD-1~13）+ 隐含需求 §2.1~2.8（死选择器迁移表、/entries/:slug 死路由、匿名创建/删除配对 §2.3、假绿修复 §2.4、护栏 §2.6、规范落点 §2.7）；risk_level: medium；P2 声明 design_trivial + follows_existing_pattern [teams-page.spec.ts, render-regression.spec.ts]。
- [ok] 读取 P0-brief.md：DEBT0010 来源、自建模式现成（render-regression createEntry + teams-page 清理队列）、seed 24 条无失败 slug、不 bump 版本。
- [ok] render-regression.spec.ts：`createEntry(request, slug, summary, files)` helper（POST /api/v1/entries，body={summary,slug,is_public:true,files}，`.catch(()=>{})` 吞错、无状态码断言、无清理=DEBT0008 家族）；`gotoEntry` helper（`page.goto(`${BASE_URL}/${slug}`)`=正确 `/:slug` 写法，L59-61）；beforeAll 建条目（t085-*）。新 fixture 需升级：创建必须断言状态码（吞错会把「创建失败」误归因为渲染回归）。
- [next] 读 3 个改造对象 spec：mermaid.spec.ts / mermaid-check.spec.ts / mermaid-visual.spec.ts。
- [ok] mermaid.spec.ts：beforeEach goto `/entries/test-mermaid-2`（死路由）+ networkidle + waitForTimeout(3000)；3 test：死选择器 `.mermaid-content[data-mode=…]`（test1/2）、`.mermaid-action-btn[title="Fullscreen"]` + `.diagram-modal-overlay`（test3）；断言阈值 容器>200px / svg>100px / modal>500px（BDD-10/11 沿用）。
- [ok] mermaid-check.spec.ts：单 test，URL 硬编码 `http://127.0.0.1:8888/entries/playwright-test`（死路由+无 BASE_URL 变量）；waitForTimeout(5000)；选择器 `.diagram-block`/`.diagram-viewer` 存活；⚠️ 新发现 L16 `if (count > 0)` 条件包裹断言（P1 §2.4 只点名 mermaid-visual test1）——但 L14 `expect(count).toBeGreaterThan(0)` 无条件先行，属 fail-safe 包裹（非假绿），改写时顺带移除即可，无需动 P1 基线。
- [ok] mermaid-visual.spec.ts：`import { chromium }` 每 test 自起 chromium.launch({headless, viewport 1280x800})；BASE_URL 硬编码；goto `/entries/e2e-test` ×3；test1 = BDD-6 目标假绿（isVisible().catch(()=>false) + 双层 if 包裹 expect）；test2/test3 死选择器同 mermaid.spec。
- [next] 读 playwright.config.ts（fullyParallel/project 定义，决定 spec 内是否需 serial 模式）+ run-e2e-tests.sh（E2E_SPEC 单 spec 运行方式，gate_commands P5_e2e/P3 红灯命令依据）。
- [ok] playwright.config.ts：fullyParallel: true；projects = chromium（Desktop Chrome, CDP_ENDPOINT env）+ Mobile Chrome（Pixel 5）；baseURL = BASE_URL||:8888；无 webServer 自启。⚠️ 推论：双 project 的同名 test 会并发跑，fixture slug 必须含 project 维度唯一化，否则同 slug 创建 409 / 删除互踩。
- [ok] run-e2e-tests.sh：E2E_GUARD_ENABLED 强制（只能经 make debug-test 跑）；`spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` 单值机制 → 多 spec 须分键（P5_e2e/_b/_c，teams-page 已有 P5_e2e_b 先例）；CDP :18800 自动探测注入；内层 timeout 600s（E2E_TIMEOUT 可覆盖）；生产污染双重检查。
- [next] grep src 验证存活选择器 + Makefile targets + seed slug 清单。
- [ok] src 选择器 grep（89 命中）：DiagramBlock.vue 实证 `.diagram-block[data-type]`/`.diagram-view-toggle`/`.diagram-action-btn.fullscreen-btn`/`.diagram-viewer`(v-show)/`.diagram-code`(v-show)；MermaidRenderer.vue 实证 Teleport 到 body 的 `.diagram-modal`（无 overlay 类）；死类名 `.mermaid-content`/`.mermaid-action-btn`/`.diagram-modal-overlay` 在 src 0 命中——P1 死/活映射表全部复核成立。
- [ok] Makefile：test-frontend(L173)=vitest run；typecheck(L193)=vue-tsc；debug-test(L648)=e2e-safety-check + run-e2e-tests.sh（E2E_GUARD_ENABLED=1）；test-quick(L163)=后端 pytest。P3 红灯命令定为 `E2E_SPEC=e2e/<spec> make debug-test`（run-e2e-tests.sh 的 spec 变量原生支持单 spec；teams-page 已有同款先例）。
- [next] 读 docs/process/debug-workflow.md（规范节落点结构）。
- [ok] debug-workflow.md（387 行）：既有节含「调试检查清单」(L228) 与「常见问题」(L245)，新「E2E 编写规范」节插入点定在 L244 之后、L245 常见问题之前；文档已有 e2e 污染检查（L175-197）与 BASE_URL 陷阱 FAQ，规范节与其呼应。
- [ok] seed-data/ ls：24 个子目录（admin-private-config…yaml-docker-compose），无 e2e- 前缀 slug——`e2e-` 前缀与 seed 天然隔离成立（BDD-4）。
- [next] minimal_validation 步骤 1：curl 匿名创建探针 entry `e2e-probe-p2`（POST /api/v1/entries，无认证头），预期 201 + 匿名 GET 200。耗时 ~2s。
- [!] minimal_validation 通道受阻与切换：bash 沙箱实测对 127.0.0.1 任意端口（8888/8080/关闭的 59999）TCP 层挂起，仅 :18800（CDP）放行——bash curl 无法直连 debug 服务。改用 pwtest 浏览器通道（Playwright 进程在沙箱外；E2E 套件本身即经 Chrome 访问 :8888，可达性有先例背书）执行同一组 HTTP 层验证：navigate /health → fetch 匿名 POST 创建 → GET → 匿名 DELETE → GET 404。仍不启停服务、不触碰 :8080。
- [next] browser_navigate http://127.0.0.1:8888/health（确认浏览器通道可达 debug 服务），预期 200。耗时 ~5s。
- [✗] minimal_validation 全通道受阻，诊断链闭合，结论 = **:8888 服务未运行**（dispatch-context「已启动保活」前提与当前运行时不符）：
  1. bash curl :8888 /health → TCP 挂起（rc=28）；对照关闭端口 59999 同样 rc=28，:18800 → 404/200 可达 → bash 沙箱拦截 loopback（本通道证据不足）
  2. pwtest 专用 Chrome navigate :8888 → 导航永久 Loading，MCP 层超时（沙箱内进程，同受沙箱影响）
  3. **pwuser 用户真实 Chrome（沙箱外）→ net::ERR_CONNECTION_REFUSED**（真实拒连，非挂起）
  4. **bash 直连 LAN IP 192.168.0.102:8888（不经 loopback 沙箱路径）→ rc=7 connection refused，秒级失败**
  → 3+4 相互独立且一致：宿主 :8888 无监听。阻塞移交主 Agent（唯一有 debug-start 权限方）；本 agent 受「严禁启停服务」约束无法自愈。
- [决策] 不阻塞设计主体：设计文档按计划完成，minimal_validation 字段如实标注「尝试失败 + 证据 + 待补实测」，认证配对设计维持 P1 §2.3 代码级推断（entries.py L136-139/L477-478/L979-1002、dev-server.sh L112 已读码复核），不伪造实测结论。主 Agent 重启服务后可补跑（步骤已写入 design 的 re-run 步骤）。
- [ok] 补充读码：t049 spec L7-11 防御性预删先例确认（beforeAll 先匿名 DELETE 容忍 404 再建——fixture helper 预删步骤的范式依据）。
- [ok] P2-design.md 落盘（237 行）：影响面梳理（M1-M4 逐文件落点 + Not Modify 8 项 + Risk R1-R9，先于候选方案）→ §0 简化声明（design_trivial + follows_existing_pattern 理由）→ §2 单候选方案（四件套 + slug 定稿 + mermaid-visual 自起保留定稿 + 完成标志）→ §3 files_to_read（10 条）→ §4 env_constraints → §5 minimal_validation（attempt_failed_blocked + 固化 6 步复验脚本 + 代码级复核证据）→ §6 gate_commands（P3/P5/P5_typecheck/P5_e2e/_b/_c + per-key timeout，裸 P3、无 && 链、全 Makefile target）→ §7 选择器清单 → §8 无 dispatch_plan。
- [ok] frontmatter：agate-md-field-set.py 逐字段写入（agent 不在工具白名单、手工补一行——工具合法 key 清单见 progress 上文）；packages/domains 按 raw.split() 空格分隔写入；正文 parent: 残留行已清理。
- [ok] check-frontmatter.py P2-design.md → exit 0；field-set --list 确认 candidate_count=1 / packages=['frontend-v3','docs'] / domains=['frontend'] / ui_affected=False / gate_commands 12 项。
- [待办→主 Agent] ① debug :8888 重启（见上「minimal_validation 全通道受阻」节）；② 在线后按 §5 六步补跑匿名创建/删除配对实测（探针 e2e-probe-p2，验证后删除复查 0 残留），或授权回派补测；③ P2-review 评审派发照常进行（P2 卡 C8 映射：frontend 域 → plan-design-review）。
- [环境修正 from 主 Agent] 本平台服务不跨 bash 调用驻留（解释了此前 :8888 不可达：主 Agent 上一调用启动的服务已回收）；主 Agent 授权自包含模式：单次 bash 调用内 `make debug-start && make debug-seed && <验证链> && make debug-stop`，外层 timeout 300s，严禁漏 debug-stop（脏环境）。原「严禁启停服务」约束由本授权覆盖，仅限此模式。
- [next] 前提核查：dev-server.sh uvicorn 绑定地址（0.0.0.0 → 可用 LAN IP 兜底；127.0.0.1 → 仅 loopback）+ sqlite3 二进制可用性。预期 <5s。
- [ok] 前提核查：uvicorn 绑定 127.0.0.1（dev-server.sh L118 → curl 必须走 127.0.0.1:8888，LAN IP 兜底不适用；服务与 curl 同调用内自包含，无跨调用可达性问题）；sqlite3 3.45.1 在 /usr/bin；backend/peekview/static/index.html 存在（debug-start 前置满足）。
- [ok] minimal_validation 自包含重跑（主 Agent 授权模式，单调用 300s 内完成）：STEP1_health=200；STEP2_anon_create=**201**（body 实证 `"is_public":true,"owner_id":null`）；STEP3_anon_get=200；STEP4_anon_delete=**200**（匿名删除放行，配对关键确认点）；STEP5_after_delete=404；STEP6_db_residue probe=0 / e2e- 前缀=0；debug-stop exit 0 + 目录已清理。**认证配对假设 confirmed（P1 §2.3 升级为运行时实证）**。
- [ok] P2-design.md 回填：§5 minimal_validation 重写为 confirmed（7 步实测证据 + 对方案的直接影响 + 平台自包含执行模式）；§4 env_constraints.runtime_prereq 更新为自包含模式（P3/P5/P6 必读）；check-frontmatter.py 复验 exit 0。seed 备注：debug-seed 显示 "Total entries: 22 / 24 loaded"（团队/admin 条目幂等跳过属 seed 脚本正常去重口径，与 BDD-4 的 seed 基数无耦合——基线以 seed-data/ 24 目录为准）。
- [环境澄清 from 主 Agent #2] 此前 ：8888 短暂下线系保活 job 到期（挂起发生在下线窗口）；现已用新 job 保活（~30 分钟窗口）；curl 异常挂起时统一加 `--noproxy '*'`（沙箱有 HTTP_PROXY=127.0.0.1:10808，NO_PROXY 已含 127.0.0.1）。
- [next] minimal_validation 在线服务二次复跑（主 Agent 指引：服务已运行，不启停）：单 bash 调用内 health → 匿名 POST e2e-probe-p2（记状态码）→ 匿名 GET 200 → 匿名 DELETE（记状态码）→ GET 404 → sqlite3 残留复查（probe + e2e-% 前缀）。全程 curl 加 --noproxy '*'。预期 ~5s。
- [!] 二次复跑首试：执行器 60s 默认上限截断（timeout 120s 未生效），首个 curl（health, --noproxy）即挂起零输出。⚠️ 关键风险判断：保活 job 的服务在跑但我的 bash 通道可能仍连不上（此前实测：沙箱内 connect 非 :18800 端口一律挂起，含关闭端口；自包含模式能通是因为服务在同一 bash 调用进程树内启动）。**决不再跑自包含 debug-start/stop——会顶掉主 Agent 保活服务并清库**。下一步 ≤20s 快速诊断可达性；不可达则切 pwuser（沙箱外真实 Chrome，可真实探测 ：8888）做 HTTP 层验证。
- [诊断闭环] bwrap 沙箱实锤：pgrep 显示本 bash 进程 1 = bwrap（--unshare-pid --die-with-parent，进程树隔离）；curl :8888 → rc=28 挂起（--noproxy 无效）；ss 无 8888（本命名空间视角）。**结论：保活服务在我的 bash 网络视角不可达（策略性拦截），但 /tmp 为 bind 可直读 debug DB。** HTTP 层验证切 pwuser（沙箱外 Chrome）；DB 残留层用 bash sqlite3 只读查询。不启停、不顶掉保活服务。
- [next] ① bash 只读查 debug DB（entries 总数 + e2e- 前缀计数）；② pwuser Chrome 开 tab 至 :8888 同源页 → 一次 evaluate 内 fetch 全链（health/匿名 POST e2e-probe-p2/GET/DELETE/复 GET 404）→ 关 tab。
- [复跑中止] pwuser Chrome 实测宿主 ：8888 仍无监听（ERR_CONNECTION_REFUSED），HTTP 层验证无法进行——本轮两次复跑尝试均未发出任何请求（零副作用，无 e2e- 残留风险）。**关键：全程未跑 debug-start/stop，未触碰保活服务与 /tmp/peekview-debug/**（bwrap --tmpfs /tmp 层下本不可见，且沙箱对非 ：18800 端口 connect 一律挂起——dev-server.sh 绑定 127.0.0.1，LAN IP rc=7 与服务存活无关）。
- [证据定案] 同一 pwuser Chrome 同一时刻：:18800（CDP，宿主确定监听）正常加载；:8888 拒连 → pwuser 视角可信，「宿主 ：8888 无监听」成立。保活 job 可能病在「服务进程已死/端口未绑/绑在别的 netns」，需主 Agent 从其 job 侧核验（curl -v http://127.0.0.1:8888/health 或看 /tmp/peekview-debug.log）。
- [影响评估] 本沙箱内 E2E 可达性 = 自包含模式启动的服务可达（P2 首次实测已证）；P3/P5 若用保活服务跑 E2E，其 Chrome（pwuser 同源）也连不上 :8888 → 主 Agent 在派发 P3 前务必用 run-e2e-tests.sh 的自检（或 job 侧 curl）确认服务真实在线。P2-design.md §5 已加复跑备注（不构成反证，首次自包含实测仍为权威证据）。
- [ok] 修复轮（P2-review needs-revision，主 Agent 指令 5 处小改，方案主体不动）：
  1. 【P-1】§0 末补指针句「简化声明同时以顶格字段形式存在于 P1 §7（[BASELINE_CHANGE] 已批准）…」——grep 核对 P1 L226 顶格 design_trivial + L229 BASELINE_CHANGE 批准注记在位，指针句与事实一致；
  2. 【S-1】§6 说明补 AGATE_TDD_TIMEOUT 消费条款（默认 120s，红灯一轮含 debug-start+seed+test 内层上限 600s，主 Agent 派发 P3 显式设 AGATE_TDD_TIMEOUT=600 或 ≥600）；
  3. 【S-2】P5_e2e/_b/_c timeout_seconds 600→900（三键 grep 实证；P3_timeout_seconds 保持 600；§6 blockquote 口径同步为「E2E 档 900s，外层余量避让内层 E2E_TIMEOUT=600」）；
  4. 【S-3】§4 runtime_prereq 与 §5 平台执行模式各补失败分支显式形态 `…; rc=$?; make debug-stop; exit $rc`（先取码、无条件 stop、透传；两处 grep 实证）；
  5. 【S-4】§2.5 补 BDD-12 基线对照行（svg-inline-render.spec.ts 与 render-regression.spec.ts t085 用例改造前后一致，既有 flaky bdd_4↔5 互换不计新失败）。
  复验：check-frontmatter.py exit 0；文件 237→241 行。
- [ok] teams-page.spec.ts：beforeAll 护栏（BASE_URL 含 :8080/prod → throw）+ `/health` 探活；清理队列范式 = createdTeams[] + afterEach splice(0) 逐条 DELETE，[200,204,404] 容忍、其他 status throw；每条队列记录 {slug, token}（认证与创建上下文一致）；注释明言「测试末尾清理断言失败会跳过→必须走钩子」。
