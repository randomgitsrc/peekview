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
