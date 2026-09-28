## P3 test-designer 分阶段落盘

- [step 0] 读派发指引 + 角色定义完成；debug :8888 /health = **200**（探活通过，本任务第 4 次探活首探即活）
- [step 1] 读 P1-requirements.md（19 条 BDD 全文）+ P2-design.md（735 行全文）+ P2-review-eng.md（含 4 条非阻塞项，NB-1 = M9 须用 reactive 源）完成
- [step 2] 读源码：useZenMode.ts（36 行，当前 zenMode 是 ref、有 updateZenAria）、zen-shortcut.ts、entryDetailKeys.ts、playwright.config.ts（双 project 默认 1280×720 / 393×727）
- [step 3] 实跑探针（CDP :18800 + debug :8888，脚本落 .agate-tmp/）核实关键判据可达性与负向对照：
  - 现状基线：`/dsh-architecture/f` → `.not-found`=1 + "Page not found"（BDD-13/18 现状基线）；`/nonexistent-slug-xyz/f` → 同样落 NotFoundView；`/dsh-architecture/f/xyz` → NotFoundView（BDD-19 现状已满足 Then）；`/nonexistent-slug-xyz`（单段）→ `.entry-detail`=1 + `.error-state`=1（BDD-18 对照基线）
  - seed 匿名可达复测：dsh-architecture / tsv-server-metrics / unicode-filenames / svg-icons = 200；markdown-test / mermaid-charts / legacy-deploy = 404（与 P1 一致）
  - 控制组（f 键 zen）：desktop 1280×800 → content-area top=0/h=800/w=1280、aria 含 `Escape`；mobile 390×844 → top=0/h=844，sticky 56→0、bottom 64→0、meta 89→0；`.content-area` scrollHeight 5227 可滚
  - BDD-3 A/B 排除遍历规则：**已按 P1 rev2 语义实现并自证**（A 组排除集 = {html,body,#app,.entry-detail} 自身；B 组 = closest 命中即排除）——注入 `#bespoke-bar` 可使其命中 ≥1，故非恒真
  - BDD-7 机制：tsv `.per-page-trigger` ≥1、点击后 `.per-page-listbox` 出现（可关闭路径可达）
  - BDD-8：unicode-filenames zen 态 `a[data-peekview-file-id]`=2 均可点；点击后正文由 347 字符切为 49 字符、path 保持
  - BDD-9 机制：alice + `?firstFileId=43` zen 态 → 正文 `a[href^="#"]`=10、`.content-area` scrollTop 0→13691、`.toc-sidebar` display:none、window.scrollY 恒 0（判据须绑容器，已落实）
  - BDD-15 机制：alice + mermaid-charts → `.diagram-block`=1、`.fullscreen-btn`=1、内联 svg 850×400；点击后 `.diagram-modal` 1280×800、`.close-btn`=1；点关闭后 modal=0、内联 svg 恢复
  - BDD-10 机制全链路实测通过：alice 建私有 entry(201) → 建 share(201, share_url) → 匿名 raw 无 token=404 / 真 token=200 / 伪 token=404 → alice DELETE=200 → alice 复查 raw=404（探针 entry 已清理）
  - **硬约束 1 判别力实测**（.agate-tmp/p3-flip-discrimination.cjs，vue reactive+computed 三实现并排）：正确实现 `[false,true,false]` 且 aria 翻转 = **PASS**；「签名是 thunk 但 setup 期一次性快照」变体 `[false,false,false]` = FAIL；现状（无参 ref）`[false,false,false]` = FAIL → **仅正确实现通过，判据有区分力**
- [step 4] 写 `frontend-v3/src/composables/__tests__/useZenMode.spec.ts`（7 用例：BDD-4/5/6/12 + 接口形态 + thunk 入参 + M9 翻转）
  - 首次版本用了 `@ts-expect-error` → 改为 `zenApi()` 类型化包装（若用 ts-expect-error，P4 实现后该指令变 TS2578 未使用 → 会打红 P5 typecheck，属自伤）
- [step 5] 实跑该 spec：**6 failed | 1 passed（7）**，`vue-tsc --noEmit` **exit 0**（无类型错，故红灯非 A 类）
- [step 6] 写 `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（16 条匿名 BDD：1/2/3/4/5/6/7/8/11/12/13/14/16/17/18/19）+ `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts`（3 条：BDD-9/10/15，含认证配对 + afterEach 清理队列）
  - 双视口显式钉定：桌面 `test.use({viewport:{width:1280,height:800}})` / 移动 `390×844`（project 默认 1280×720 / 393×727 均不符 BDD 档位）
  - `openFullscreen()` **刻意不硬等 `.entry-detail`**，改用 `expect(locator(contentArea)).toHaveCount(1)` 断言 —— 否则 P3 红灯会以 waitForSelector timeout 收场（归因含混），而非断言失败（B 类）
  - BDD-3 逐字照抄 A/B 两组不对称规则（A 取自身+祖先、B 取自身+后代），并加 `candidateCount > 0` 前置自证
- [step 7] `npx vue-tsc --noEmit` = **exit 0**（含两个新 e2e spec 与单测；首版用 `@ts-expect-error` 已改掉）
- [step 8] ⚠️ **踩坑（已解决，须告知下游）**：`make debug-test` 的 Check 6 静态产物新鲜度用 `find frontend-v3/src -newer backend/peekview/static/index.html` —— 我在 `src/composables/__tests__/` 下**新增**了单测文件 → src 比 static 新 → **FATAL 拒绝跑 E2E**。
  → 解法：`make build-frontend-fast`（14.7s，388 static files）重建 static。**P5/P6 同样会踩**（只要 P4 改了 `src/` 下任一文件就必须先重建 static 再跑 `make debug-test`）。
- [step 9] 写 `agate-workspace/tasks/TPV0099-fullscreen-link/P3-test-cases.md`（含 test_code_dir + 19 条 BDD 1:1 映射表 + 四条硬约束逐条落实说明 + 每条"集合为空/不存在"型断言的负向对照表）
- [step 10] 实跑 `make test-frontend`：**111 files / 1344 passed | 4 skipped (1354)**，`6 failed` 全部来自新增的 `useZenMode.spec.ts`；基线（剔除该 spec）复跑 = **110 files / 1343 passed | 4 skipped (1347)**（与派发指引基线逐字吻合）→ **无附带回归**
- [step 11] 实跑两个 E2E spec（`E2E_SPEC=... make debug-test`）：匿名 spec chromium 13 failed / 3 passed（含 Mobile project 26 failed / 6 passed）；auth spec 6 failed / 0 passed。**全部失败均为断言失败**，无 timeout 归因、无语法/import 错。3 条预期绿 = BDD-11/12（回归基线）+ BDD-19（现状 catch-all 与实现后段数严格**均**满足 Then）
- [step 12] ⚠️ **发现并修复 gate 基础设施缺陷（预存，非本任务引入）**：`check-tdd-red.py $TASK_DIR` 曾返回 **exit 1（A 类假红灯）**。根因链：
  1. `make test-frontend` 全量输出 ~1.5 MB（主体是**既有** spec 的 Vue warn / `at <VTUROOT>` 噪声）
  2. agate 内置 `assets/formatters/vitest.sh:6-8` 把输出经 `export OUTPUT` 作为**环境变量**传给 python3 → 超 `execve` 上限（MAX_ARG_STRLEN=131072）→ `参数列表过长`，formatter **exit 126**
  3. `agate_common.run_test_with_formatter` 回退 `_fallback_json(raw_output=全量输出)`
  4. `judge_result` 命中 `exit_code==2 and raw_output 含 matching` 分支（`matching` 来自既有 spec 的 `No diagram type detected matching given configuration`，15 处）→ **误判 A 类**
  **预存性证明**：剔除恶本任务 spec 的基线输出 **1,509,387 字节同样触发同一误判**（零本任务文件）→ 预存缺陷。
  **处置**：走 agate 官方扩展点，在 `agate-workspace/tasks/TPV0099-fullscreen-link/.agate/formatters/vitest.sh` 放判定语义逐字等价、仅把输出改经**临时文件**传递的 formatter（`resolve_formatter` 第一优先级 = `$task_dir/.agate/formatters/`，**无需改 agate 本体**）。
  **结果**：`check-tdd-red.py` → `TDD_CHECK: classic red-light (assertion failures only)` = **exit 0（真红灯，B 类）** ✅
- [step 13] 自检全过：① `P3-test-cases.md` 含 `test_code_dir`（frontmatter + §0 双处）② 19 条 BDD 1:1 全覆盖（脚本核验：main e2e 16 + auth e2e 3 = union 19，missing=[]，dupes=[]）③ 真红灯实测确认（单测 6 failed 断言失败 + vue-tsc exit 0 ⇒ 非 A 类）④ `git status --porcelain frontend-v3/` **仅 3 个正式新增测试文件**，零临时探针残留（探针全在 `.agate-tmp/`）
- [step 14] `check-gate.py P3` = **exit 2**（P3-test-cases.md 存在，符合预期）；`vue-tsc --noEmit` = **exit 0**

---

## 修正轮（P3 定点修正，d dispatch: `P3-dispatch-context-test-designer-fix.md`）

> 背景：P4 已完成实现（形态与 P2 §1.1 最终规格表逐字一致，三个禁止变体均未触碰），匿名 spec 已 32 passed 全绿。
> auth spec `4 failed / 2 passed` —— 主 Agent 已逐条复核确认**全部由 2 处测试缺陷导致**（P4-implementation.md §8 两条 `[DESIGN_GAP]`），
> 定性为**「断言写成了与本任务目标相反的方向」**，非实现未达标。本轮只修测试，**不动实现**。

- [step 0] 探活 `curl :8888/health` = **200**（首探即活）
- [step 1] 读修正指令全文（287 行）+ 通读 auth spec（343 行）复核两处缺陷现状
- [step 2] **DG-1 修正**（`:151`，BDD-9 pathname 断言）：
  - 现状 `expect(after.pathname).toBe('/markdown-test')` 必然失败 —— 该用例自己的 Given（`:101`）就导航到 `/markdown-test/f`
  - 期望值来源被**搬错语境**：搬自 P1 §3.3 一次在 `/{slug}` 上用 **f 键**的测量（当时 `/{slug}/f` 路由尚不存在）
  - 且与全任务其余 6 条「保留 `/f`」要求（BDD-2/8/13/14/18 + 本 spec BDD-15）**直接互斥** → 改实现迎合它会同时打红那 5+1 条
  - 修正：期望值改 `/${SLUG_MD}/f`，标签改为「锚点跳转不得改变 pathname（须保持在 /f 全屏视图）」
  - **非放宽判据**：仍验证"锚点跳转不破坏全屏视图"，只是把"不改变"锚定到该用例实际所处的 URL（`/f`）
  - 保留未动：`:138-148` 三条实质断言（tocInvisible / scrollTop 增加 / zen===true）+ `:154` 负向对照（window.scrollY 恒为 0）
- [step 3] **DG-2 修正**（`:288` 一带，BDD-10 匿名基线）：
  - 现状基线三条请求走已登录的 fixture `request` context —— `:255` 的 `aliceToken(request)` 登录成功后 `Set-Cookie: peekview_token=...` **写入该 context**，
    此后任何不带 Authorization 的 `request.get` 都自动以 alice 身份发出 → 得 200 而非 404。**失败发生在任何页面交互之前，与实现无关。**
  - 不可改后端「忽略 Cookie」（违反 **N8 后端零改动**）→ 只能修 context
  - 修正：`import { request as pwRequest }` 后 `pwRequest.newContext({ baseURL: BASE_URL })` 建**独立匿名 context**，
    三条基线请求改走该 context，`try/finally` 中 `anonCtx.dispose()` 释放
    （注：`APIRequestContext` **实例上**无 `newContext()` —— 须从 `@playwright/test` 导入的 `request` 上调用）
  - 保留未动：**`[false,false,true]` 三态区分力断言**（`:344-347`，防恒真假绿核心判据）+ Then 本体全部断言
    （真 token 可见 / 无鉴权提示 / zen 类存在 / 5 项 chrome 不可见）+ `afterEach` 清理队列（`{slug,shareId}` 二元组）+ 清理后 alice 复查 `raw=404`
- [step 4] `make build-frontend-fast` → ✓ built 13.69s / 388 static files（E2E Check 6 新鲜度前置）
- [step 5] 实跑 `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` → **6 passed (8.7s)**（3 用例 ×2 project）✅
  （修正前为 4 failed / 2 passed）
- [step 6] 实跑 `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` → **32 passed** ✅ 无回归
- [step 7] 实跑 `make test-frontend` 两次：
  - 首跑 **1 failed | 1349 passed | 4 skipped** —— 失败在 `src/components/__tests__/TableView.spec.ts:158`（与本次 e2e-only 改动无关，本次未触碰 `src/`）
  - 复跑 **111 files / 1350 passed | 4 skipped (1354)** ✅ 命中基线 ⇒ 该条为**并行负载下的 flaky**（第二个已知 flaky，主 Agent 已知 flaky 为 `DiagramBlock.spec.ts`）
- [step 8] `git status --porcelain frontend-v3/`：`e2e/tpv0099-fullscreen-link-auth.spec.ts`（本轮唯一改动）
  + `src/composables/useZenMode.ts` / `src/router.ts` / `src/views/EntryDetailView.vue`（**P4 既有改动，本轮零触碰**）
  → 本轮 diff 范围严格限于 auth spec（17 insertions / 8 deletions），未动实现文件、未动另两个测试文件
- [step 9] 纪律：全程未触碰生产 `:8080` 与 `~/.peekview/`，未跑 `uvicorn`/`make debug`/`npm run dev`，未 `git add`/`commit`
  **[PROD_NOT_TOUCHED]**

---

## P3 修正轮 2（DG-3：清理队列登记「请求 slug」而非「服务端 slug」）

- [step 0] 探活 `curl :8888/health` = **200**（首探即活）
- [step 1] 读定点修正指令全文（262 行）+ 通读 auth spec（352 行）+ 核对仓库先例 `e2e/t069-settings-refresh-guard.e2e.spec.ts:122,194,238,328,436`（一律 `body.slug`）完成
- [step 2] **机制端到端复现**（.agate-tmp/，只读 :8888 + 自建 e2e- 资源）：
  - 第 1 次 POST `/api/v1/entries` slug=X → 服务端 slug = **X**
  - 第 2 次 POST 同 slug=X → 服务端 slug = **X-2**（静默改后缀，证实 `entry_service._retry_with_slug_suffix` 行为）
  - 触发面：`playwright.config.ts:5` `fullyParallel: true` → chromium 与 Mobile Chrome 并发跑同一用例，`Date.now()` 毫秒级撞车
- [step 3] **DG-3 修正**（`:258-294`）：把 `slug` 重新定义为**服务端返回的 slug**，请求值另名 `requestSlug`
  - `const requestSlug = \`e2e-tpv0099-share-${Date.now()}\`` → POST data 用 `requestSlug`
  - `const created = await createRes.json()` / `const slug = created.slug as string` ← **清理队列登记它**
  - 下游**建 share（`:297`）/ 匿名基线（`:315-317`）/ 三次页面访问（`:326,333,340`）全部沿用 `slug`** → 因变量名重绑，天然对齐、无需逐处替换（少改 = 少错）
  - `cleanupQueue[0] = { slug, shareId: ... }`（`:305`）随之登记服务端 slug
  - **修的是"登记谁"，不是"断言什么"** —— `afterEach` 无条件删除 + 复查 `raw===404` 结构**逐字未动**
- [step 4] **防回归自证（指令"顺带"项，做了强化版）**：除指令建议的真值断言外，另加**活体校验**
  - `expect(slug, '必须登记服务端返回的 slug（防 -2 后缀残留）').toBeTruthy()`（静态：登记值非空）
  - `expect(registeredAlive.status(), ...).toBe(200)`（**动态**：登记对象须是 alice 可读的真实资源）
  - 为何加动态条：真值断言只证明"有值"，**证明不了"这个值指向真实资源"** —— 原缺陷正是登记了**有值但不存在**的 phantom slug。
    冲突场景下退回登记 `X` 时真实资源在 `X-2`，`GET X/raw` 必 404 → 本条 fail，缺陷被直接测出
- [step 5] **负向对照实证缺陷成立 + 修正有效**（.agate-tmp/probe-conflict.sh，两组各自收尾清理）：
  - A 组（旧行为）：建 X/X-2 → 只删登记的 X → `X/raw`=404（**断言会通过**）但 `X-2/raw`=**200** → **真实残留 + 假绿**，与主 Agent 实测一致
  - B 组（新行为）：建 X/X-2 → 删登记的服务端 slug `X-2` → `X-2/raw`=**404** → 清理成功
- [step 6] `make build-frontend-fast` → ✓ built 13.84s / 388 static files（E2E 新鲜度前置）
- [step 7] 实跑 `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` → **6 passed (8.4s)** ✅
- [step 8] 实跑 `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` → **32 passed (14.4s)** ✅ 无回归
- [step 9] 实跑 `make test-frontend` → **111 files / 1350 passed | 4 skipped (1354)** ✅ 命中基线（本轮串行跑，避开已知 flaky 的并行负载）
- [step 10] **残留自证（本轮最关键验收点）**：auth spec 跑完后 + 冲突探针收尾后，**两次**查 :8888 中 `e2e-tpv0099-share` 前缀
  → **RESIDUE_COUNT = 0** ✅（口径：alice token 查 `/api/v1/entries?limit=200` 过滤前缀）
- [step 11] 纪律与范围：
  - `git status --porcelain frontend-v3/` 中**本轮唯一改动** = `e2e/tpv0099-fullscreen-link-auth.spec.ts`（+43/-10），无 untracked 文件
  - 三实现文件 + 另一测试文件 mtime 仍为前轮（19:46 / 20:27），**本轮零触碰**；后端**零改动**（N8 遵守）
  - 临时/探针文件全在 `.agate-tmp/`（`check-residue.sh` / `probe-conflict.sh`），**未落入 `frontend-v3/`**
  - 未触碰生产 `:8080` 与 `~/.peekview/`；未跑 `uvicorn`/`make debug`/`npm run dev`；未 `git add`/`commit`
  - **[PROD_NOT_TOUCHED]**
