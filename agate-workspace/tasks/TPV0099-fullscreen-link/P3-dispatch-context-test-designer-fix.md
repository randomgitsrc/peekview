# P3-dispatch-context-test-designer-fix — TPV0099（**P3 产出定点修正轮**）

---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: test-designer
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。

**创建型测试清理钩子（强制要求）**：测试含创建资源用例（建团队/条目等）时，须声明清理钩子要求——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；验收环境残留由清理钩子与 post-test 残留检查共同兜底（见 P6 卡）。

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.py 确认红灯
3. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P3，不要提前写 P4——phase = 本 commit 的产出阶段
4. git commit -m "wf({Txxx}-P3): {摘要}"（phase=P3，P3 产出含 P3-test-cases.md + 测试代码）
5. P3 commit 完成后进入 P4：**phase 推进 P4 随 P4 产出 commit 一起**（P4-implementation.md 就绪后），不是单独 phase commit

## refactor 任务：回归测试口径

> 适用：P1 frontmatter 声明 `change_type: refactor` 的任务（P2-design.md §3.4）。功能任务（缺省）走上方既有 TDD 口径，不受本节影响。

refactor 任务无新增功能行为可断言，P3 测试设计改用**回归测试口径**：

- **测试设计 = 回归测试口径**：复用/保留既有测试用例，标注每条回归用例覆盖了重构涉及的哪些文件/路径；**不新增功能行为断言**（无新行为可断言）。
- **跳过 check-tdd-red 红灯步骤**：重构无新功能断言，测试套件本就全绿，红灯语义不适用（check-tdd-red 对 refactor 任务会误报 exit 2 绿灯）。回归质量由 P5 全量回归（gate_commands.P5）+ P6 的 `regression.log`（全量回归重跑）兜底。CI backstop 对 refactor 任务同样跳过 check-tdd-red（ci-gate-backstop.py P3 分支 refactor 感知）。
- **P3 gate 不变**：仍为文件存在性检查——refactor 的 P3 产出是 P3-test-cases.md（回归口径声明 + 既有用例覆盖映射），文件存在即满足 gate。

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 不可裁剪）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则

**check-gate.py P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.py 独立确认）

**check-tdd-red.py**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.py $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.py 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据（本阶段特定）：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.py exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在

## 常见错误

1. **测试绿了才 commit**：测试已在 P4 之前通过 → 违反 TDD"测试先于实现"原则。P3 的 gate 要求红灯
2. **忘记声明 test_code_dir**：后续阶段找不到测试代码 → P5 跑 gate_commands 时找不到测试路径
3. **测试覆盖不全**：只为部分 BDD 写了测试 → P6 验收时那些 BDD 没有自动化验证
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。
5. **只覆盖交互路径，忽略前置状态**：测试设计应覆盖 BDD Given 隐含的前置状态，不只覆盖 When/Then 路径（详见 WORKFLOW.md §P3 测试设计指导）

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->

> ⚠️ 本文件是**定点修正指令**，不是完整派发上下文。第一轮上下文见 `P3-dispatch-context-test-designer.md`。
> **只修下面 2 处测试缺陷，未点名的一切保持原样**（不要重写测试设计、不要动实现、不要动主 spec）。

## 背景：你的 P3 产出基本正确，但 auth spec 有 2 处断言写错了方向

P4 已完成实现（三个禁止变体均未触碰，形态与 P2 §1.1 最终规格表逐字一致）。主 Agent 实测：

- **匿名 spec**：`E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` → **32 passed 全绿** ✓
- **auth spec**：`4 failed / 2 passed` —— **全部由下面 2 处测试缺陷导致**，与实现无关

P4 implementer 已按协议把它们登记为 `P4-implementation.md` §8 的两条 `[DESIGN_GAP]`，**并正确地没有去改测试**。主 Agent 已**逐条独立复核并确认两条均成立**（含读 P1 权威原文、写独立探针复现），现交回你修正。

**关键定性**：这两条不是"实现没做到"，而是**"测试没测对"**，且两处都是**"断言写成了与本任务目标相反的方向"**。

---

## 修正 1（DG-1）：`e2e/tpv0099-fullscreen-link-auth.spec.ts:151` —— BDD-9 的 pathname 断言

### 现状

```ts
expect(after.pathname, 'BDD-9: 锚点跳转不得改变 pathname').toBe(`/${SLUG_MD}`)
```

失败实测：`Expected "/markdown-test" / Received "/markdown-test/f"`。

### 为什么这是缺陷（主 Agent 已核）

1. **该用例自己的 Given（`:101`）就导航到 `/markdown-test/f`** → 期望 `/markdown-test` 必然失败
2. **P1 BDD-9 的 Then 原文只有两条**（`P1-requirements.md:218-224`，主 Agent 已逐字读）：
   - 「目录侧栏不可见」
   - 「`.content-area` 的 `scrollTop` 在点击后增加 > 0」
   - **不含 pathname**。你这条是自行加的"附：锚点跳转不得破坏完整全屏视图"
3. **期望值的来源被搬错了语境**：它来自 P1 §3.3 的实测记录「`location.pathname` 仍为 `/markdown-test`」——**但 P1 那次测量是在 `/{slug}` 上用 f 键做的**（当时 `/{slug}/f` 路由还不存在）→ 那次 pathname 当然是 `/markdown-test`
4. **它与全任务目标直接互斥**：BDD-2/8/13/14/18 以及本 spec 的 BDD-15 都要求**保留 `/f` 后缀**（主 Agent `grep` 确认：主 spec `:119`「全屏视图下 URL 必须保留 /f 后缀」、`:439`「切换文件后 URL 的 /f 后缀须保留」）。**改实现迎合它会同时打红那 5 条**

### 修正要求

把期望值改为 `/${SLUG_MD}/f`：

```ts
expect(after.pathname, 'BDD-9: 锚点跳转不得改变 pathname（须保持在 /f 全屏视图）').toBe(`/${SLUG_MD}/f`)
```

**这仍是有效断言、不是放宽判据**：它继续验证"锚点跳转不破坏全屏视图"，只是把"不改变"锚定到**该用例实际所处的 URL**（`/f`）上。**不要**删掉这条断言，**不要**改成 `toBeTruthy()` 之类的弱化形式。

### 必须保留的（不得动）

- `:138-148` 的三条实质断言（`tocInvisible` / `scrollTop` 增加 / `zen === true`）**全部保留**
- `:154` 的负向对照（`window.scrollY` 恒为 0，防判据绑错容器）**必须保留**

---

## 修正 2（DG-2）：`e2e/tpv0099-fullscreen-link-auth.spec.ts:288` —— BDD-10 的匿名基线

### 现状

```ts
const anonNoToken = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw`)
const anonFakeToken = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw?share=faketoken000000`)
expect(anonNoToken.status(), 'BDD-10 基线: 匿名无 token 读私有 entry 须 404').toBe(404)
```

失败实测：得 **200**（期望 404）。

### 为什么这是缺陷（主 Agent 已写独立探针复现）

`:255` 的 `aliceToken(request)` 调 `/api/v1/auth/login` 成功后，响应带 `Set-Cookie: peekview_token=...`，**该 cookie 写入了这个 `request`（`APIRequestContext`）**。此后**任何不带 Authorization 头的 `request.get` 都会被自动以 alice 身份发出** → 200 而非 404。

主 Agent 独立探针实测（`.agate-tmp/p4-cookie-probe.mjs`）：
```
SAME context, no auth header -> 200      ← cookie 泄漏
FRESH context, no auth       -> 404      ← 真匿名
```
即**失败只取决于"该 request 是否登录过"，与实现无关**。且失败发生在**任何页面交互之前**。

### 为什么不能改后端

改后端"忽略 Cookie"会违反 **N8「后端零改动」**（P1/P2 一致结论）。**不要碰后端。**

### 修正要求

基线三条请求改用**独立的匿名 `APIRequestContext`**：

```ts
// 独立匿名 context —— 避免 alice 登录 cookie 污染（该 context 自带 cookie 存储）
const anonCtx = await request.newContext({ baseURL: BASE_URL })
try {
  const anonNoToken = await anonCtx.get(`/api/v1/entries/${slug}/raw`)
  const anonFakeToken = await anonCtx.get(`/api/v1/entries/${slug}/raw?share=faketoken000000`)
  const anonRealToken = await anonCtx.get(`/api/v1/entries/${slug}/raw?share=${shareToken}`)
  expect(anonNoToken.status(), '...').toBe(404)
  expect(anonFakeToken.status(), '...').toBe(404)
  expect(anonRealToken.status(), '...').toBe(200)
} finally {
  await anonCtx.dispose()
}
```

**主 Agent 已实测该 API 可用**：`playwright.request.newContext()` 存在且匿名 GET 语义正确。注意 `APIRequestContext` **实例上**没有 `newContext()`（实测 `typeof ctx.newContext === 'function'` = **false**）——要从 `@playwright/test` 导入的 `request` 上调用。

⚠️ **若你的 fixture 签名里没有可直接用的 `request` 顶层对象**，可 `import { request as pwRequest } from '@playwright/test'` 后 `pwRequest.newContext(...)`。

### 必须保留的（不得动）

- **`[false, false, true]` 三态区分力断言**（`:344-347`）**必须保留** —— 这是防"退化为恒真假绿"的核心判据
- **Then 本体的全部断言**（真 token 可见 / 无鉴权提示 / zen 类存在 / 5 项 chrome 不可见）**全部保留**
- `afterEach` 清理队列（`{slug, share_id}` 二元组）+ 清理后 alice 复查 `raw=404` **保留**

---

## 一个重要事实：BDD-10 的 Then 本体已经通过了

主 Agent 用**真匿名 browser context** 独立实跑（`.agate-tmp/p4-bdd10-then.mjs`），结果：

```
ANON-ctx baseline [no,fake,real] = [404, 404, 200]      ← 用独立匿名 context 后基线正确
BROWSER Then: [no,fake,real] visible = [false,false,true]  ← 区分力成立
zen count = 1 | chromeVisible = false                    ← 全屏视图成立
cleanup: 200 | verify gone: 404                          ← 清理有效
```

→ 说明**你的测试设计意图是对的、实现也对**，只是基线那三条请求用错了 context。**修 context，不要修判据。**

---

## 环境与纪律（强制）

- debug `:8888` 已运行。**开工前先探** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn`/`make debug`/`npm run dev`；返回标注 `[PROD_NOT_TOUCHED]`
- **改完 spec 后必须先 `make build-frontend-fast`（~15s）再跑 E2E** —— 否则 `made debug-test` 的 Check 6 新鲜度检查（`find frontend-v3/src -newer static/index.html`）会 **FATAL 拒绝运行**。⚠️ 注意：你只改 `e2e/` 下的 spec **不在 `src/` 下**，理论上不触发；但若你顺手动了 `src/` 下任何文件就会触发 → **稳妥起见，跑 E2E 前先 build**
- 跑 auth spec 的正确命令：`E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test`（**裸 `make debug-test` 只跑 `debug-server.spec.ts` 一个 spec**）
- **临时/探针文件严禁放 `frontend-v3/` 下**（会抬高 vitest 基线，`vitest.config.ts` 未设 `include`）→ 放 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（E2E 类 600s+）
- 前端基线：`111 files / 1350 passed | 4 skipped (1354)`（已含你的 7 条单测；`DiagramBlock.spec.ts` 有一条**已知 flaky**）
- **不得** `git add`/`commit`（主 Agent 负责）
- **不要动** `useZenMode.ts` / `router.ts` / `EntryDetailView.vue` 等实现文件（P4 已实现完成且形态正确）
- **不要动** `.agate/formatters/vitest.sh` 与 `gate_commands`
- 子派发能力：不启用
- 追加 `P3-progress.md`（标注本轮为修正轮）

## 门槛（什么算完成）

- 上述 2 处按指定方向修正，**意图未弱化、判据未放宽**
- `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` → **全绿**（预期 6 passed：3 用例 ×2 project）
- `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` → **仍全绿**（32 passed，不得回归）
- `make test-frontend` → **111 files / 1350 passed**（不得回归）
- `git status --porcelain frontend-v3/` 仅含 auth spec 一处修正（**不得**动实现文件与另两个测试文件）

## 返回给我（只两行）

1. 产出文件路径（修正后的 auth spec）
2. 一句话摘要（含两处修正 + auth/匿名 spec 绿况）

**不要返回文件全文。**
