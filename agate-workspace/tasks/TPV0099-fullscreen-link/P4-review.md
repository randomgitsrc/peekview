---
phase: P4
task_id: TPV0099
type: review
parent: P4-implementation.md
trace_id: TPV0099-P4-20260928
agent: design-review
status: approved
retry: 1
created: '2026-09-28'
domains:
- frontend
risk_level: medium
blocking_count: 0
non_blocking_count: 7
prior_round: needs-revision（阻塞级 1 项，已闭环）
evidence_scripts:
- .agate-tmp/dr-rev1-guard-calibration.cjs
- .agate-tmp/dr-rev1-guard-matrix.cjs
- .agate-tmp/dr-rev1-timing-sim.cjs
- .agate-tmp/dr-rev1-fixed-hook-conflict.cjs
- .agate-tmp/dr-rev1-concurrency.cjs
- .agate-tmp/dr-dg2-cookie-probe.cjs
- .agate-tmp/dr-dg2-then-probe-fixed.cjs
- .agate-tmp/dr-m9-variant-intercept.cjs
- .agate-tmp/dr-cleanup-leak-probe.cjs
---

# P4 实现评审（复审轮） — 全屏模式链接 `/{slug}/f`（TPV0099）

> 角色：design-review（C8 映射：`domains: [frontend]` + `risk_level: medium` → 仅本角色，直接产出本文件）
> 本轮性质：**复审轮（retry 1）**。上轮终态 `needs-revision`（阻塞级 1 项：BDD-10 清理钩子登记「请求 slug」）。
> 本轮范围：**只验证该阻塞项闭环** + 已通过内容的「未回退」抽查 + 独立核实主 Agent 的活体校验守卫校准。
> **只审不写**：未修改任何实现文件、测试文件、债务登记簿。
> [PROD_NOT_TOUCHED] 全程未触碰生产 `:8080` / `~/.peekview/`；未 `uvicorn` / `make debug` / `npm run dev`；E2E 一律经 `E2E_SPEC=… make debug-test` 定向。

---

## 0. 结论（二值）

**`status: approved`** —— **阻塞级 0 项**，非阻塞 7 项（含 1 项对守卫注释措辞的澄清，供 P7/P5 注意）。

上轮的**唯一**阻塞项（BDD-10 清理钩子登记「请求 slug」而非「服务端返回 slug」）经**独立实跑 + 源码复核**确认**已真正闭环**：登记、建 share、三次页面访问、`afterEach` 删除与复查**全部锚在服务端 slug 上**；真实冲突场景下修正后的钩子正确删除真实资源且**不误删兄弟 project fixture**；连续 **6 次** auth spec 全量运行后 debug DB 残留扫描 = **0**。曾经存在的 2 条 `-2` 残留现已从 DB 消失（复查 = 0）。

**对「活体校验守卫」的校准：主 Agent 的结论成立，且我实测后发现它比主 Agent 的表述更弱一档**（§4）。主 Agent 说「检出取决于 A 的清理时序」——对；但我把 spec 的**真实时序**复刻出来后，**在真实时序下该守卫是漏检的**，检出反而需要一个**逆序竞态**（兄弟 project 先跑完并清理）。更关键的是：**在已修正的代码上，该守卫是恒 200 的空断言**（§4.3）。我另给出一个**时序无关**的替代判据（§4.4），供主 Agent 决定是否采纳。**以上均不构成返回理由**——闭环证据是修正本身 + 残留 = 0。

---

## 1. 上轮阻塞项 → 本轮 5 个验证点的独立确认

全部由 `read` 源码原文 + 实跑确认，**未采信任何自述**。

| # | 验证点 | 源码/实测锚点 | 判定 |
|---|---|---|---|
| 1 | `cleanupQueue.push` / `cleanupQueue[0]` 用服务端 slug | `:281` `const slug = created.slug as string`；`:286` `cleanupQueue.push({ slug, shareId: null })`；`:305` `cleanupQueue[0] = { slug, shareId: shareBody.id ?? null }`。`cleanupQueue` 内**无任何** `requestSlug` 引用 | 闭环 |
| 2 | 建 share 用同一服务端 slug | `:297` `POST /api/v1/entries/${slug}/shares` —— `${slug}` 是 `:281` 的服务端绑定 | 闭环 |
| 3 | 三次页面访问用同一服务端 slug | `:326` `/${slug}/f`、`:333` `/${slug}/f?share=faketoken000000`、`:340` `/${slug}/f?share=${shareToken}`；另 `:315-317` 三条匿名基线请求同源 | 闭环 |
| 4 | `afterEach` 删除 + 复查 `raw===404` 锚在服务端 slug | `:241` `DELETE /entries/${item.slug}`、`:245-248` `GET /entries/${item.slug}/raw` 须 `404`，`item` 来自队列（服务端 slug）。**`requestSlug` 在 `afterEach` 中零出现**（grep 全文仅 5 处：注释 3 + 声明 1 + 断言文案 1） | 闭环 |
| 5 | 无残留（实跑） | 见 §1.1 | 闭环 |

**变量重绑是否真的「天然一致」**：核实成立——`requestSlug` 仅在 `:269` 声明、`:273`（请求体 `slug`）、`:294`（失败文案）出现；`:273` 之后的**所有** `${slug}` 均指向 `:281` 的服务端绑定。无遗漏点。

### 1.1 实跑证据（全部我自己执行，可复现）

| 命令 | 实测结果 |
|---|---|
| `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health` | **200**（开工前探测；全程服务稳定，未掉线） |
| `make build-frontend-fast` | exit 0（`✓ built in 9.86s` / `✓ 388 static files`），Check 6 新鲜度自然满足 |
| `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` × **6 次** | **每次 6 passed，exit 0**（8.0–8.4s，零 flaky） |
| 残留扫描（`GET /api/v1/entries?limit=500`，Bearer alice，过滤 `e2e-tpv0099` / `e2e-dr-`） | **RESIDUE_COUNT = 0**；alice 可见总数稳定 22 |
| `make test-frontend` | **exit 0**；`Test Files 111 passed (111)` / `Tests 1350 passed \| 4 skipped (1354)` —— 与基线**逐数字一致** |

> 上轮我实测到的 2 条 `-2` 残留（`e2e-tpv0099-share-1790604924253-2` / `…-1790603287882-2`）**现已从 DB 消失**（残留 = 0）。我未执行任何删除（只审不写），故系主 Agent 侧处置。**本次扫描同时覆盖 `e2e-dr-` 前缀**，确认我自己的探针资源亦无残留（每个探针脚本均内置 `finally` 自清理，输出 `SELF_CLEANUP: []`）。

### 1.2 真实冲突场景下「修正后」钩子的语义验证（比 §1.1 更强）

§1.1 的 6 次运行**未触发** slug 冲突（碰撞率低），故只证明「无冲突路径正确」。为排除「修正只在无冲突时成立」的可能，我**构造真实冲突**并复刻修正后的 `afterEach` 语义：

```bash
timeout 180s node .agate-tmp/dr-rev1-fixed-hook-conflict.cjs
```

```json
{"conflict":{"A":"e2e-dr-rev1-fixed-…","B":"e2e-dr-rev1-fixed-…-2","DIVERGED":true}}
{"FIXED_afterEach_on_server_slug":{"server_slug":"…-2","delete_status":200,
   "recheck_raw_status":404,"assertion_passes_correctly":true}}
{"A_untouched_by_B_cleanup":{"A":"…","status":200,"no_cross_project_deletion":true}}
{"VERDICT":"修正后钩子在真实冲突下正确闭环：真实资源被删且不误删兄弟 project fixture"}
```

⇒ 上轮缺陷的**三重后果全部被修正消除**：① 真实资源（`-2`）被删除；② 「无残留」断言锚对了对象（判据与事实一致，不再是假绿）；③ `DELETE` 不再命中兄弟 project 的 fixture。

**冲突的真实性（避免夸大/低估）**：我按 spec 的写法（同毫秒取 slug + `Promise.all` 并发建）实测碰撞率：

```bash
timeout 180s env ROUNDS=12 node .agate-tmp/dr-rev1-concurrency.cjs
# → {"SUMMARY":{"rounds":12,"diverged":12,"rate":1}}
```

**12/12 全部碰撞**（`{slug}` 与 `{slug}-2` 各半）。⇒ 只要两个 project 真的同毫秒进入创建，冲突**必然**发生。这既确认上轮阻塞项的现实性，也说明「6 次未复现」只反映两 project 到达创建点的时间差通常 > 1ms，而非冲突不可能。

---

## 2. 未回退抽查（只确认，不重审）

| 项 | 实测锚点 | 判定 |
|---|---|---|
| 实现三文件未被本轮修正触碰 | `sha256`：`useZenMode.ts` `b490b7be…` / `router.ts` `3a246f70…` / `EntryDetailView.vue` `5323dabf…`；mtime 均为 **20:27:37**，而 auth spec mtime 为 **23:01:40**（修正晚于实现 ~2.5h）。`git diff --numstat` 三文件行数增删与上轮记录一致（`+16/−13`、`+7/−0`、`+1/−1`） | 未回退 |
| P2 §1.1「最终规格」表 7 个面逐字一致 | 重新 `read` 源码逐项比对：签名 `:8`、调用点 `EntryDetailView.vue:155`（thunk + `?.` 均在）、内部读取 `:11/:13/:18` 全为 `locked()`、`zenMode` 为 `computed` 且**无** `locked.value`/`lockedMode`、`zenAriaText` computed 且不含 `Escape`/`exit` 子串、返回对象恰三键（无 `updateZenAria`）、锁死短路 `:18` 首行整函数 `return` | 未回退 |
| 三个禁止变体仍全避开 | `grep -rn "locked\.value\|locked: boolean\|lockedMode\|updateZenAria" frontend-v3/src` → 非测试代码命中 **0**（仅两处既有 mock 与 M9 断言文案提及） | 未回退 |
| BDD-10 Then 本体 + 三态区分力仍完整 | `:350` 真 token 可见、`:352` 无鉴权提示、`:356` zen 类、`:357` 五项 chrome 全不可见、`:371-373` `.toEqual([false, false, true])` | 未回退 |
| BDD-9 `pathname` 仍锚定 `/${SLUG_MD}/f` | `:151` `.toBe(\`/${SLUG_MD}/f\`)`（`grep` 确认仅此一处断言，另 `:101` 为 goto） | 未回退 |
| DG-2 独立匿名 context 仍在 | `:313` `await pwRequest.newContext({ baseURL: BASE_URL })` + `:322` `finally { await anonCtx.dispose() }`；import `:22` 含 `request as pwRequest` | 未回退 |
| 基线零回归 | `111 files / 1350 passed \| 4 skipped (1354)` = 派发给定基线**逐数字一致** | 未回退 |
| 临时/探针文件落位 | `git status --porcelain frontend-v3/` 的 untracked 项 = **none**；本轮 5 个新探针全部落 `.agate-tmp/` | 未回退 |
| 本轮修正的改动面 | `git diff --numstat frontend-v3/` → 仅 4 个文件：3 实现 + 1 auth spec（`+43/−10`）。**无第五个文件被触碰** | 未回退 |

---

## 3. 评审重点：独立复核主 Agent 的「活体校验守卫」校准

§4 给出结论与实证锚点。这里先固定被验证对象的**准确形态**（`read` 源码原文 `:287-294`）：

```ts
// 登记值**活体校验**：登记对象须是 alice 可读的真实资源（200）。
const registeredAlive = await request.get(`${BASE_URL}/api/v1/entries/${slug}/raw`, {
  headers: { Authorization: `Bearer ${token}` },
})
expect(registeredAlive.status(), `…（请求 slug=${requestSlug} / 服务端 slug=${slug}）`).toBe(200)
```

关键结构性事实：**该守卫读的是 `slug`（= `created.slug`），与 `cleanupQueue` 登记的是同一个变量**。故它验证的是「服务端返回值指向真实资源」，**不是**「登记值与返回值一致」。这一区别是本节的枢纽。

---

## 4. 校准核实：**成立**，且实测比主 Agent 的表述更弱一档

### 4.1 主 Agent 的构造（A 存活 / A 已清理两态）——**逐字复现成立**

```bash
timeout 180s node .agate-tmp/dr-rev1-guard-calibration.cjs
```

| 态 | 表达式 | 实测 | 守卫判定 |
|---|---|---|---|
| A **尚未**清理 | `GET X/raw`（旧逻辑登记值） | **200** | 通过（**漏检**） |
| A **已**清理 | 同一 `GET X/raw` | **404** | 失败（**检出**） |

```json
{"TIMING_DEPENDENT":true,
 "CONCLUSION":"守卫非确定性：同一缺陷在 A 存活/已清理两种时序下判定相反"}
```

⇒ 同一缺陷、同一守卫、仅 **A 的清理时序** 不同 → 判定相反。**「不是确定性探测器」成立**。同时该探针复现了旧逻辑的假绿本质：`afterEach` 复查 = 404（断言通过）而**真实创建的资源仍为 200**（`LEAK_UNDETECTED: true`）。

### 4.2 但我把 spec 的**真实时序**复刻出来后，守卫在真实时序下是**漏检**的

主 Agent 的两态是抽象的「A 存活 / A 已清理」，未绑定时点。而 spec 里守卫执行在 **`:290`，即创建成功并立即登记之时**；兄弟 project 的 `afterEach` 清理则要等它整个用例体跑完（含 3 次页面导航 + 多次 `waitForTimeout`，实测 8.0–8.4s）之后。复刻：

```bash
timeout 180s node .agate-tmp/dr-rev1-timing-sim.cjs   # 连跑 3 次，结论一致
```

```json
{"B_create":{"requested":"…","returned":"…-2","DIVERGED":true}}
{"GUARD_old_logic_at_registration_time":{"status":200,"verdict":"PASS(漏检)"}}
{"A_afterEach_done":{"A":"…"}}
{"GUARD_old_logic_after_A_cleanup":{"status":404,"verdict":"FAIL(检出)"}}
```

⇒ **真实时序（守卫在登记当下执行）落在「A 存活」分支 → 恒 200 → 漏检。** 要触发检出，需要 A **先于** B 的守卫完成清理，即 B 的创建+守卫整体晚于 A 的整个用例体（~8s）——这是一个比碰撞本身**罕见得多**的逆序竞态。

### 4.3 决定性的一点：**在已修正的代码上，该守卫是恒 200 的空断言**

这是主 Agent 表述里未点出、但实测最硬的一环。因为守卫读的就是 `slug`（服务端返回值，刚由 `201` 响应给出），而建 entry 成功后该资源**必然存在**：

| 代码版本 | 守卫 `GET <slug>/raw` 的取值来源 | 实测 |
|---|---|---|
| **已修正（现状）** | `slug = created.slug`（真实资源） | **恒 200**（本任务已 6 次实跑 + 探针均 200） |
| 假想回归（旧逻辑） | `slug = requestSlug`（幻影） | 取决于兄弟 project 清理时序（§4.1/§4.2） |

```json
// dr-rev1-guard-matrix.cjs 的「新逻辑 / 正确登记」行
{"label":"新逻辑 / 正确登记","g2_liveness_200":true,"g3_identity_with_response":true}
```

⇒ 该断言**今天不检测任何东西**（无信息量、亦无代价）；它只在「有人把 `:281` 退回 `requestSlug`」这一假想回归场景下才可能发出信号，而**在那个场景下它的信号又依赖 A 的清理时序**（§4.1/§4.2）。故「该缺陷的**直接探测器**」这一自我描述，在**两个层面**上都被高估。

**结论：主 Agent 的校准成立；我进一步把「非确定性」收紧为「真实时序下是漏检、且当前是空断言」。** 我未发现任何使该守卫成为确定性探测器的机制（穷举了「谁可能在守卫执行前删除登记对象」，只有兄弟 project 的 `afterEach`，且其时点结构性晚于守卫）。

### 4.4 我给出的替代判据（**建议**，非阻塞、不要求本轮回改）

同一探针输出里，**时序无关**的判据是「登记值与创建响应恒等」：

```json
// dr-rev1-guard-matrix.cjs
{"CALIBRATION":{
  "guard2_verdict_is_timing_dependent": true,
  "guard2_misses_defect_when_sibling_alive": true,
  "guard3_deterministic_across_timing": true,
  "guard3_catches_defect_regardless_of_timing": true,
  "no_false_positive_on_correct_code": true}}
```

即 `expect(slug).toBe(created.slug)`（或等价地断言 `slug === requestSlug || slug === \`${requestSlug}-2\``）。它在两态下判定不变，且对正确代码无误报——**这才是「确定性拦截」**。它比活体校验更弱耦合（不依赖 HTTP 往返的状态）、更快（无网络请求）。

**为什么我仍不建议本轮回改**：① 该守卫与 `toBeTruthy()` 相比仍是**严格改进**（多覆盖了「返回体缺 `slug` 字段」一类畸形响应），且**不会误报**；② 真正的闭环由 §1/§1.2 的「登记服务端 slug + 残留 = 0」提供，与该守卫的强度无关；③ 再次触碰测试文件会重新引入回归面。**列为建议项**，供主 Agent 在 P5/P6 视成本决定。

---

## 5. 非阻塞发现

| # | 项 | 实测 | 处置建议 |
|---|---|---|---|
| **N-1** | 守卫注释（`:288`）把假想分支写成事实：「冲突场景下若退回登记请求 slug `X`，则真实资源在 `X-2`，`GET X/raw` **必为 404** → 本条 fail」 | 「必为 404」**只在逆序竞态分支成立**；真实时序下（§4.2）为 200，且**在已修正代码上该守卫恒 200**（§4.3）。参见本任务已 6 次「验证声明需要被验证」的方法论警示——本条正是第 7 个同族实例（**注释层的强度声明未同步校准**） | 非阻塞；建议 P7 一致性检查时把该注释与 §4 的准确表述对齐。**不要求本轮回改** |
| **N-2** | 公告文案为 `'Fullscreen view. Content only.'`，与 P2 §2.1 伪代码示例 `'Full screen view'` 字面不同 | §1.1「最终规格」表（唯一权威）只约束「computed + 不含 `Escape`/`exit` 子串」，未固定字面；重跑词表自查：`Escape`/`exit`/退出词组命中均空 ⇒ 合规 | 非阻塞；记录备追溯 |
| **N-3** | `P4-implementation.md` 行号引用不精确（§0 称 `locked()` 在 `useZenMode.ts:9,11,16`，实际 **11,13,18**；返回对象称 `:30-34`，实际 **34-38**） | 仅文档准确性问题，实现无碍 | 非阻塞；P7 校正 |
| **N-4** | `.agate-tmp/` **未被 `.gitignore` 覆盖** | `git check-ignore .agate-tmp/` 返回未忽略；本轮 5 个新探针 + 既有探针均为 untracked。**P4 gate 要求 `git add` 代码文件** | 非阻塞但**有操作风险**：误用 `git add -A` 会把探针一起入库。建议加 `.gitignore` 规则或严格按路径 `git add` |
| **N-5** | P1 rev2 散文「候选集 = 0」与 spec 守卫 `candidateCount > 0` 字面冲突 | 上轮实测候选集 = **1**（`.sr-only` 1×1），spec 守卫**成立且非空**；P1 该句实指「7 个满宽元素全落排除集」 | 非阻塞；P7 或后续任务澄清措辞 |
| **N-6** | BDD-9 首轮曾 2 flaky（Given 前置 `anchorCount` = 0，重试后通过） | 本轮**连续 6 次** auth spec 全绿、零 flaky；上轮时序探针测锚点首现 514–672 ms ≪ spec 等待 1500 ms | 非阻塞；P5/P6 若再现则记录 |
| **N-7** | 碰撞率实测 **12/12**，高于「6 次运行零残留」所暗示的直觉 | §1.1 的 6 次运行未碰撞，不代表冲突罕见——只是两 project 到达创建点的时间差通常 > 1ms。**修正的价值因此比「6 次未复现」看起来更重要** | 非阻塞；供主 Agent 评估是否需要 `test.describe.configure({ mode: 'serial' })` 或让 slug 带 project 名（上轮建议 3，**本轮非必需**，因修正已使冲突无害） |

### 5.1 Not Modify 清单核对（`git diff` / `git status` 实证）

| 项 | 结论 |
|---|---|
| P1 §4.3 三处存量问题（`.mobile-actions` 死选择器 / 重复 `zen-shortcut.spec.ts` / `t052:141` 恒真假绿） | 均未被改动（不在变更列表） |
| `.archived-banner` / `.expired-warning-banner` 未加 zen 隐藏规则 | 未改动；DEBT0013 已登记（open） |
| `zen-shortcut.ts` / `entryDetailKeys.ts` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` | 均未改动；`ZenModeKey: InjectionKey<Ref<boolean>>` 声明不变，`provide(ZenModeKey, zenMode)` 传 computed，`make typecheck` 通过 |
| 既有 E2E spec | **未改动任何既有 spec** |
| `layout.css` 零 CSS 改动（N4） | 未改动 |
| 后端 `backend/peekview/`（N8）/ MCP（N10） | 未改动 |
| `EntryDetailView.vue` 300 行上限（N14） | 265 行（未增行，单行替换） |
| `debt/tech-debt.md` | 未改动（实际路径为 `agate-workspace/debt/tech-debt.md`） |
| 临时/探针文件 | 5 个新探针全落 `.agate-tmp/`，`frontend-v3/` 下 **零 untracked** ⇒ 单测基线未被抬高（实测 111 files 一致） |

---

## 6. 阻塞级 / 非阻塞 汇总

**阻塞级：0 项。** 上轮唯一阻塞项（BDD-10 清理钩子登记请求 slug）经 §1 五点逐项复核 + §1.2 真实冲突实测 + §1.1 残留扫描 = 0，确认**真正闭环**，未发现修正引入的新缺陷或回退。

**非阻塞：7 项** —— N-1 守卫注释「必为 404」与实测（真实时序漏检 / 当前恒 200 空断言）不符；N-2 公告文案与 P2 伪代码示例字面不同（合规）；N-3 `P4-implementation.md` 行号不精确；N-4 `.agate-tmp/` 未 gitignore（`git add -A` 误入库风险）；N-5 P1「候选集=0」措辞冲突（spec 写法正确）；N-6 BDD-9 历史 flaky（本轮 6 次未再现）；N-7 碰撞率 12/12 的量化记录。

**对守卫校准的独立判断**：主 Agent 的校准**成立**（非确定性，检出依赖兄弟 project 的清理时序）；我实测后**进一步收紧**——按 spec 的真实时点，旧逻辑下该守卫落在「A 存活」分支而**漏检**，检出需一个逆序竞态；且**在已修正代码上它是恒 200 的空断言**，不构成「该缺陷的直接探测器」。它仍是相对 `toBeTruthy()` 的**严格改进**且**不误报**，故保留合理，但**不应记为「确定性拦截」**。确定性判据是「登记值与创建响应恒等」（§4.4），**建议项，非本轮返回理由**。

---

## 7. 复核锚点索引（可复现）

```bash
# 环境探测（开工前）
timeout 30s curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health   # → 200

# 主验证：E2E（跑前必须 make build-frontend-fast，否则 Check 6 FATAL）
timeout 180s make build-frontend-fast
timeout 600s env E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test   # → 6 passed, exit 0（连跑 6 次均绿）

# 残留扫描（alice 密码 testpass123；过滤 e2e-tpv0099 / e2e-dr-）
#   → RESIDUE_COUNT = 0

# 守卫校准（主 Agent 两态）
timeout 180s node .agate-tmp/dr-rev1-guard-calibration.cjs
#   → A-alive 200(漏检) / A-cleaned 404(检出) → TIMING_DEPENDENT: true

# 守卫校准（spec 真实时序）—— 本轮新增，结论更强
timeout 180s node .agate-tmp/dr-rev1-timing-sim.cjs
#   → 登记当下 200(漏检)；检出需逆序竞态

# 三候选守卫判定矩阵（含时序无关的替代判据）
timeout 180s node .agate-tmp/dr-rev1-guard-matrix.cjs
#   → guard2 时序相关 / guard3（恒等）时序无关且无误报

# 修正后钩子的真实冲突闭环
timeout 180s node .agate-tmp/dr-rev1-fixed-hook-conflict.cjs
#   → DIVERGED true + delete 200 + recheck 404 + 不误删 A

# 碰撞率量化（12/12）
timeout 180s env ROUNDS=12 node .agate-tmp/dr-rev1-concurrency.cjs

# 基线
timeout 600s make test-frontend    # → 111 files / 1350 passed | 4 skipped
```

> 所有探针均落 `.agate-tmp/`（未污染 `frontend-v3/`），均 `try/finally` + `process.exit(0)`、未 `browser.close()`；[PROD_NOT_TOUCHED]
> 本轮新建 entry 的探针（`dr-rev1-*`）**全部用服务端返回的 slug 自清理**，每次输出 `SELF_CLEANUP: []`（残留 0）——即上轮发现的坑已在评审者自己的工具链上先被贯彻。
