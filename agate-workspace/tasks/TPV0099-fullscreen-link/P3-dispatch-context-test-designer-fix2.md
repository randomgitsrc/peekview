# P3-dispatch-context-test-designer-fix2 — TPV0099（**P3 产出定点修正轮 2**）

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

> ⚠️ 本文件是**定点修正指令**，不是完整派发上下文。前两轮见 `P3-dispatch-context-test-designer.md`（首轮）与 `-fix.md`（修正轮 1）。
> **只修下面这 1 处，未点名的一切保持原样**（不要重写测试、不要动实现、不要动另两个测试文件）。

## 背景：你上轮的 2 处修正已验收通过，P4 评审新发现第 3 处缺陷

- 匿名 spec：**32 passed 全绿** ✓
- auth spec：**6 passed 全绿** ✓（你修正轮 1 的 DG-1/DG-2 均已闭环，主 Agent 已复核）
- `make test-frontend`：**111 files / 1350 passed** ✓
- **P4 实现本身无阻塞缺陷**（design-review 独立复核：P2 §1.1 七个面逐字一致、三个禁止变体全避开、BDD-3 三态 0/3/1 与 P1 逐数字一致、零回归）

但 P4 的 design-review 新发现 **1 个阻塞级缺陷**，**在你写的 auth spec 里**。主 Agent 已**端到端独立复现并确认成立**。

---

## 修正 3：BDD-10 清理钩子登记的是**请求 slug**，而非**后端返回的 slug**

### 现状（auth spec）

```ts
// :258
const slug = `e2e-tpv0099-share-${Date.now()}`
const createRes = await request.post(..., { data: { slug, ... } })
// :268
expect(createRes.ok(), ...).toBeTruthy()
// :270  ← 问题在这：用的是「请求时想用的 slug」，不是「后端实际创建的 slug」
cleanupQueue.push({ slug, shareId: null })
// :281
cleanupQueue[0] = { slug, shareId: shareBody.id ?? null }
```

### 机制（主 Agent 已端到端复现）

后端 `entry_service._retry_with_slug_suffix`（`backend/peekview/services/entry_service.py:1107-1138`）在 **slug 冲突（TOCTOU 保护）** 时**静默创建 `{slug}-2` 并返回它**。主 Agent 实测：

```
第 1 次创建 slug=X          → 响应 slug = 'X'
第 2 次创建同 slug=X        → 响应 slug = 'X-2'      ← 静默改后缀
响应体确实含服务端 slug 字段：['created_at','expires_at','files','id','is_public','owner_id','slug','url']
```

而 spec **从未读 `createRes.json().slug`** → 清理队列登记的是 `X`，真实资源是 `X-2`。

### 三重后果（均已实证，非推测）

1. **真实残留**：主 Agent 查 debug DB 实测 **2 条 `e2e-tpv0099-share-*-2`**（summary 与本 spec 完全对应，创建时刻 21:48:07 / 22:15:24）→ **已被主 Agent 用 sanctioned 路径删除并复查 404**
2. **假绿（更严重）**：afterEach 的"无残留"断言复查的是**被删错的 slug**——删 `X`（本不存在）→ 断言 `raw === 404` **通过**，而真实资源 `X-2` 仍 **200** → **断言通过与事实相反**（reviewer 已构造性复现 `LEAK_DETECTED: true`）
3. **可能误删兄弟 project 的 fixture**：`DELETE` 用请求 slug，若恰好命中他方资源会删错对象

### 为什么现在会碰到

`playwright.config.ts:5` 是 **`fullyParallel: true`** → chromium 与 Mobile Chrome **并发跑同一用例**，两者 `Date.now()` **毫秒级撞车**。概率低但**非零**（已真实留痕 2 次）。

### 修正要求

**清理队列必须登记服务端返回的 slug**：

```ts
const createRes = await request.post(`${BASE_URL}/api/v1/entries`, { ... })
expect(createRes.ok(), ...).toBeTruthy()
const created = await createRes.json()
const createdSlug = created.slug as string          // ← 服务端实际 slug（冲突时可能是 X-2）
expect(createdSlug, 'BDD-10 前置: 创建响应须含服务端 slug').toBeTruthy()
cleanupQueue.push({ slug: createdSlug, shareId: null })

// 后续所有对该资源的操作（建 share / 访问 / 复查）一律改用 createdSlug
const shareRes = await request.post(`${BASE_URL}/api/v1/entries/${createdSlug}/shares`, ...)
```

**要点**：
- 建 share（`:279` 附近）也要改用 `createdSlug`（否则 share 建在错误的 slug 上）
- `cleanupQueue[0] = { slug: createdSlug, shareId: ... }`（`:281`）
- 页面访问 `${BASE_URL}/${createdSlug}/f...`（三态那几处）也须用 `createdSlug`
- **`afterEach` 的复查断言保持不变**（`raw === 404`）—— 修的是"登记谁"，不是"断言什么"

⚠️ **仓库已有先例可直接参照**：`frontend-v3/e2e/t069-settings-refresh-guard.e2e.spec.ts:122,194,238,328,436` 一律用 `body.slug`（服务端返回的 slug）而非请求值。

### 必须保留的（不得动）

- `[false, false, true]` 三态区分力断言
- Then 本体全部断言（真 token 可见 / 无鉴权提示 / zen 类 / 5 项 chrome 不可见）
- `afterEach` 的「无条件删除 + 复查 `raw`=404」结构
- 上一轮修好的 DG-1（pathname 锚定 `/${SLUG_MD}/f`）与 DG-2（独立匿名 `pwRequest.newContext()`）

---

## 顺带（极小，一并做）

**给 auth spec 补一条防回归的自证**：既然后端会在冲突时改后缀，请在 `:270` 附近加一行**自检断言**，让"登记了服务端 slug"这件事本身可被验证，例如：

```ts
// 防回归：清理队列登记的必须是服务端 slug（后端 slug 冲突时会改后缀为 -2）
expect(createdSlug, 'BDD-10 清理钩子: 必须登记服务端返回的 slug（防 -2 后缀残留）').toBeTruthy()
```

（若你判断更合适的写法是别的形式，可自行决定——**要点是让"误登记请求 slug"这类缺陷以后能被测出来**。）

---

## 环境与纪律（强制）

- **开工前先探** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`
- 跑 auth spec：`E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test`（**裸 `make debug-test` 只跑 1 个无关 spec**）
- **改动只在 `e2e/` 下**（不在 `src/` 下）→ 理论上不触发 Check 6；但**稳妥起见跑 E2E 前先 `make build-frontend-fast`**（~15s）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn`/`make debug`/`npm run dev`。返回标注 `[PROD_NOT_TOUCHED]`
- **临时/探针文件严禁放 `frontend-v3/` 下** → 放 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（E2E 类 600s+）
- 前端基线：`111 files / 1350 passed | 4 skipped (1354)`。**已知 2 条 flaky**（`DiagramBlock.spec.ts`、`TableView.spec.ts`）——单条失败请**隔离复跑确认**再定性
- **不得** `git add`/`commit`（主 Agent 负责）
- **不要动实现文件**（`useZenMode.ts` / `router.ts` / `EntryDetailView.vue`）与另两个测试文件
- 子派发能力：不启用
- 追加 `P3-progress.md`（标注修正轮 2）

## 门槛（什么算完成）

1. 清理队列**登记服务端返回 slug**（建 share / 页面访问 / 删除全部一致用它）
2. `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` → **全绿**（6 passed）
3. `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` → **仍全绿**（32 passed，不得回归）
4. `make test-frontend` → **111 files / 1350 passed**（不得回归）
5. **残留自证**：跑完 auth spec 后，自查 debug DB 中 `e2e-tpv0099-share*` 的**残留数 = 0**
   （可用 `curl -H "Authorization: Bearer <alice_token>" "http://127.0.0.1:8888/api/v1/entries?limit=200"` 过滤 `e2e-tpv0099-share` 前缀；alice 密码 `testpass123`）
   - **这是本轮最关键的验收点**——它直接验证"不再留残留"
   - **若要构造冲突场景验证**（可选，做则更有力）：连续创建同 slug 两次观察第二次返回 `-2`，然后确认你的清理逻辑能删掉 `-2` 那条
6. `git status --porcelain frontend-v3/` 仅含 auth spec 一处（测试面）

## 返回给我（只两行）

1. 产出文件路径
2. 一句话摘要（含修正点 + auth/匿名 spec 绿况 + **残留自查数**）

**不要返回文件全文。**
