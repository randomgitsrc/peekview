---
phase: P2
task_id: TPV0099
type: review
parent: P2-design.md
trace_id: TPV0099-P2-20260928
agent: plan-design-review
status: approved
created: '2026-09-28'
---

# P2-review-design — TPV0099 全屏模式链接 `/{slug}/f`（方案设计独立评审 · 前端/UI 维度 · **复审轮**）

评审对象：`P2-design.md`（735 行，candidate_count: 3，domains: [frontend]，ui_affected: true；mtime 18:18:48 = 修订后版本）。
评审立场：**独立复核，不采信 architect 自述**。派发指令给出的行号一律作**线索**，本轮全部回文件 `read`/`grep` 并以源码/实跑独立确认；凡关键判据均附可复现命令或锚点。

范围边界：工程侧（数据流 / 接口契约 / 测试策略 / gate_commands 可执行性 / 架构债）归 `plan-eng-review`，本评审不重复覆盖。
本轮范围：**只验证上轮 2 个阻塞项的闭环 + 1 个跨文件一致性点 + 一次未回退抽查**；已通过的 19 条 BDD 覆盖、UI 设计节结构、R2/R3 专项结论**只做未回退确认，不重审**。

**结论：`approved`**。阻塞级问题 **0 项**（上轮 2 项均**实测闭环**）；非阻塞残留 **2 项**（措辞级，不改变 P4 的唯一实现形态，不构成退回理由）。

---

## 1. 上轮阻塞项闭环验证

### 1.1 G-1（锁死态接口形态唯一化）—— **已闭环**

上轮判据是"签名 / 调用点 / 读取方式三者唯一"，且特别要求拦截**第三种不报错的假绿读法**（签名改 `locked: boolean` + 可选链，可同时过 typecheck 与 test-frontend，但把锁定态固化为 setup 期快照）。本轮逐落点回文件确认，**全部到位**：

| # | 落点 | 实测内容 | 判定 |
|---|---|---|---|
| 1 | `P2-design.md:46`（M2①） | 「新增 **`locked: () => boolean` 入参**（默认 `() => false`）；锁定态为**只读派生**（computed），**不落 ref、不落任何可变状态**」 | 到位 |
| 2 | `P2-design.md:46`（M2②） | `computed(() => locked() \|\| manualZen.value)`，并显式「禁止写成 `lockedMode.value` / `locked.value`」 | 到位 |
| 3 | `P2-design.md:46`（M2③） | 「**移除 `updateZenAria`**（并从返回对象一并移除该键）」；`:58`、`:149`、`:445` 三处呼应 | 到位 |
| 4 | `P2-design.md:47`（M3） | `() => route.meta?.zen === 'locked'`，且写明「**thunk 形态 + `?.` 可选链，二者缺一不可**；**严禁传裸值**」 | 到位 |
| 5 | `P2-design.md:138`（草图注释·根因修复点） | 已由「形态示意，非最终代码」改为「**签名与调用形态为最终规格，P4 照此实现**」 | 到位 |
| 6 | `P2-design.md:136`（§2.1 风险①） | 补上前提：「⚠️ **"既有 mock 仍兼容"这一结论仅对 thunk 形态成立**……**裸值形态下该结论不成立**」 | 到位 |
| 7 | `P2-design.md:53`（M9） | 新增「**锁定态派生随 route meta 翻转**」用例（thunk 返回 `false → true → false`，断言 `zenMode` 随之翻转、`zenAriaText` 随之切换，**全程不重新调用 `useZenMode()`**） | 到位 |
| 8 | `P2-design.md:60-77`（新增节） | 「最终规格」四面板表（签名 / 调用点 / 读取方式 / 返回对象）+ **三个禁止变体** | 到位 |

**形态唯一性（可复现判据）**：

```bash
grep -n "lockedMode" P2-design.md   # 仅 1 处命中：:46 的禁止性表述"文中不存在 lockedMode 这个状态变量"
grep -n "locked\.value" P2-design.md # 仅 1 处命中：同上，出现在"禁止写成"里
```

即 `lockedMode` **不出现于任何规格性表述**，只出现在禁止性论证中——与派发指令的验收判据一致。

**第三种假绿读法是否被"显式禁止"**：是。`P2-design.md:77` 逐字列出该变体（"把签名改成 `locked: boolean`（配合可选链可**同时**通过 `make typecheck` 与 `make test-frontend`）→ 锁定态被固化为 **setup 期一次性快照**……**是最坏一类假绿**"），并指明 M9 的翻转用例「即为此变体的唯一可执行拦截」。**这正是上轮要求的"不只报错消失，而要形态唯一"**——三处（`M2①` 入参签名、`:64` 最终规格表、`:77` 禁止变体）互为闭锁，读法不再有二义。

**判据本身有区分力（验证工具也被验证）**：`M9:53` 是拦截该变体的**唯一**可执行判据，故我对**判据本身**做了独立复现（探针落 `.agate-tmp/`，用 `frontend-v3/node_modules/vue@3.5.34` 的 `ref`/`computed`，响应式 `route.meta` 模拟组件复用）：

| 实现形态 | `zenMode` 序列（非锁死 → 锁死 → 非锁死） | M9 判据 | BDD-4 判据（锁死态按 f 视图不变） |
|---|---|---|---|
| A 正确规格（thunk 签名 + thunk 调用点） | `[false, true, false]` | **通过** | 通过 |
| C 禁止变体 3（`locked: boolean` + 裸值，setup 期快照） | `[true, true, true]` | **不通过** | **通过** |

→ 两点可复现结论：① M9 判据在 A 上真、在 C 上假，**区分力成立**（非恒真）；② **BDD-4 单独拦不住该变体**（C 在"锁死态按 f 不变"上照样通过），故 M9 是**载荷性**的，不是装饰性条款。这从反面证实了"为何必须补 M9"——上轮与该变体的判定依据在此闭环。

**附带证实（架构前提）**：M2③ 移除 `updateZenAria` 的前提「全仓非测试代码零消费方」独立复核为真——`grep -rn "updateZenAria" src/ e2e/` 仅命中 `useZenMode.ts:8/16/25/34`（定义与内部调用）及两处 spec mock（`t031:106` / `t067:119`），**无组件消费方**。`:46` 所述「移除后须从返回对象删键、mock 的键名不变即可继续使用」与事实相符。

### 1.2 G-2（BDD-10 认证配对）—— **已闭环**

| 复核项 | 实测内容 | 判定 |
|---|---|---|
| 认证前提改为"alice 登录创建私有 entry → 登录建 share → 匿名带 token 读 → 登录删除" | `:505`、`:507`（五步编号链）、`:509`、`:497`（映射表认证前提列）、`:711`（`env_constraints.auth_premise`）**五处一致** | 到位 |
| "匿名创建 + 匿名删除（成对）"的规格性措辞已清除 | `grep -n "匿名创建\|匿名删除"` 三条命中 **:513 / :514 / :682**，**全部**位于"**为什么不能**"的禁止性论证内；规格性表述零残留 | 到位 |
| 清理判据 = 清理后以 alice 复查 `GET /api/v1/entries/{slug}/raw` = **404** | `:512` 逐字写明（「把判据落在**结果**上，而非"删除者身份"上」）；`:405` 同步 | 到位 |
| 含**区分力判据**（三者须互异） | `:518`：「三者结果必须**互不相同**——带 `?share=<真实 token>` **可见正文**；**无 token** 与 **伪 token** 均**不可见**。否则该用例退化为恒真假绿」 | 到位 |
| `files_to_read` 补 share 范本 | `:679-680` 补 `t058-share-redesign.e2e.spec.ts:25-95`（既有链路范本）+ `:681-682` 补 `api/shares.py:18-23`（契约依据）；`grep -c "t058-share-redesign"` = 3 | 到位 |

**参照事实的独立复核（不采信派发指令"可直接采信"的转述，逐条回源码）**：

- 匿名 POST 建 entry 强制 `is_public=True` → `api/entries.py:135-139`，原文注释 `# Anonymous users forced to is_public=True (API-layer enforcement)` 与 `if current_user is None: is_public = True` **确认成立**；
- share 端点 `require_auth` → `api/shares.py:18-23`，`create_share(... current_user: User = Depends(require_auth))` **确认成立**；
- 公开 entry 禁建 share → `services/share_service.py:54-55`，`raise ValidationError("Public entries don't need share links")` **确认成立**。

三条共同证明"匿名创建"与"私有 entry + share token"不可共存，`:513` 的论证链条**无事实错误**。

**新增的一处论证我也独立复核了，且认为它比上轮更强**：`:514` 明确**不采用**"匿名删除"作清理手段，理由是匿名 DELETE 的放行依赖 `config.server.api_key` 为空（`api/entries.py:476-478` 的 `allow_local = no_server_auth and current_user is None`；`config.py:164-167` 的 `api_key` 默认 `""`）。我回源码确认 `api_key: str = Field(default="", ...)` 与 `allow_local` 表达式**均如所述**。即该设计**没有**停在上轮我实测的"匿名删当前返回 200"这一时点现象上，而是把清理判据钉在"与创建同上下文、与环境配置解耦"的认证删除上——这是对"环境条件 ≠ 稳定契约"的正确处理。

### 1.3 跨文件一致性（`viewer.spec.ts` 18 failed 的归属措辞）—— **已闭环**

**判据**：`grep -n DEBT0012 P2-design.md` 的命中**全部**为"明确说明**不归** DEBT0012"的对照性表述，**不得**有任何一处把红灯归属给 DEBT0012。

实测 5 处命中，**逐处均为否认或对照**：

| 行 | 表述性质 |
|---|---|
| `:118`（R-08） | "**不属 DEBT0012**——判定见 §6.3 三维对照" |
| `:543`（§6.3 性质） | "归属 TPV0097/TPV0098「用例可信治理」……**不归 DEBT0012**" |
| `:544` / `:546` | "**与 DEBT0012 的三维对照（勿混，两者根因不同）**" + 对照表表头 |
| `:709`（`known_red_baseline`） | "**不归 DEBT0012**——判据见 §6.3：重跑 make debug-seed 不能恢复" |
| `:727`（§9 遗留表） | "TPV0095 引入的 seed 语义回归，**不归 DEBT0012**" |

**与债务登记簿的跨文件一致性**：`agate-workspace/debt/tech-debt.md:300` 的 DEBT0012 条目补记逐字写着该红灯"归属 **TPV0097/TPV0098「用例可信治理」**……根因与修复面均不同，**勿混同**。此处仅作指引，**勿据此关账 DEBT0012**"——与 `P2-design.md` 的八字措辞**方向与归属完全一致**，矛盾已消除。

**归属的事实链独立复核（三条命令全部复现为真）**：

```bash
git log -S'"team_id": "frontend-team"' --oneline -- scripts/seed-data/markdown-test/meta.json
#   → 唯一命中 59182590 feat(seed): 给 seed entry 指派团队（TPV0095）——markdown/mermaid→frontend-team, csv→backend-solo
git log --oneline -1 d4b05ee4
#   → d4b05ee4 wf(TPV0088-P5): 技术验证通过（E2E 38/38 全过，P4 重试修复 7 项）
git merge-base --is-ancestor d4b05ee4 59182590
#   → 真（exit 0）
```

且 §6.3 的区分判据（"重跑 `make debug-seed` 能否恢复"）在登记簿中被独立记为 DEBT0012 = 能 / 本项 = 不能，**两处判据同源**。

**§6.3 三条实质结论一字未动（逐条回文件核对）**：

| 结论 | 原文锚点 | 判定 |
|---|---|---|
| 既有 spec **不作 gate 键** | `:553`「① **不进本任务 gate**（否则 P5 必红，且红因与本任务无关）」 | 未动 |
| E2E 键**全指新建 spec** | `:554`「本任务的 E2E 键**全部指向新建 spec**」；`grep` gate 块确认 4 处 `make debug-test` 均带 `E2E_SPEC=` | 未动 |
| P4/P5 **不得为让 E2E 全绿而改既有 spec** | `:554`「P4/P5 不得为"让 E2E 全绿"而去改既有 spec」 | 未动 |

---

## 2. 未回退抽查（只确认，不重审）

| 抽查项 | 实测内容 | 判定 |
|---|---|---|
| `## UI 设计` 节仍在 | `:590` 标题存在；`:599/:607/:615` 三类 checklist（布局结构 / 交互行为 / 视觉呈现）齐备 | 未回退 |
| 渲染形态声明 `layout` 与 P1 一致 | P2 `:596` 渲染形态 = `layout`；P1 frontmatter `ui_render_shape` = `layout` → **一致** | 未回退 |
| 三维关键词齐备 | `:599`「布局结构」/`:607`「交互行为」/`:615`「视觉呈现」 | 未回退 |
| **UI 设计节 gate 口径** | 用 **真实** gate 函数实跑（见 §4 方法论），返回 **`True`** | 未回退 |
| 19 条 BDD 覆盖（16 + 3）完整无缺口 | `:496` = 16 条 `[1,2,3,4,5,6,7,8,11,12,13,14,16,17,18,19]`、`:497` = 3 条 `[9,10,15]`；**并集 = 1..19 共 19 条，缺口为 0** | 未回退 |
| 双视口落点仍在 | `:503` 视口钉定硬约束（`test.use({ viewport })` 桌面 1280×800 / 移动 390×844）；`:604/:605` 两档几何落点；V9（`:401`）移动端实测 | 未回退 |
| 上轮判"不成立"的两项专项所依赖内容 | ① **不误改全局 zen** → 依赖 `N4 零 CSS`（`:88`）+ `R-03 缓解 = 复用 zen 类，不新造隐藏规则`（`:113`），均在；② **不吞内容区 Escape** → 依赖整函数 `return`（`:147`、`:259` 两处）+ 明示「**不含** `preventDefault` / `stopPropagation`」（`:448`），均在 | 未回退 |

**补充事实核对（本轮新发现，均支持设计）**：

- `:503` 的视口钉定理由**经独立复现为真**：`playwright` 实测 `devices['Desktop Chrome'].viewport = 1280×720`、`devices['Pixel 5'].viewport = 393×727`，与设计所述**逐值一致**；且 `playwright.config.ts:20-40` 两个 project 确实分别用这两个 device，**均不等于** BDD 要求的 1280×800 / 390×844 → "必须显式钉定、不得依赖 project 默认"的判断成立。
- `:503` 所引先例**经独立核对为真**：`tpv0091-...:66/132`、`t084-...:68/221`、`render-regression...:67/263` 六处行号**逐处命中** `test.use({ viewport: { width: 1280, height: 800 } })` / `{ width: 390, height: 844 }`；`grep -rn "test.use({ viewport" e2e/` 全仓 **20 处点位 / 8 个文件**，故"等 10+ 处"的说法成立。
- M3 落点行号**经比对源码为真**：`EntryDetailView.vue:155` = `const { zenMode, zenAriaText, handleZenKeydown } = useZenMode()`、`:158` = `provide(ZenModeKey, zenMode)`、`:2` = `:class="{ 'zen-mode': zenMode }"`；`router.ts:48-52` = `/:slug`、`:53-57` = `/:pathMatch(.*)*`，M1 声明的插入位置正确。
- 既有 mock 无 `meta` 键**经比对为真**：`t031:164-168` 与 `t067:173-177` 的 `useRoute: () => ({ params, query, path })` **确无 `meta`**；且两 spec 均**真实 mount** `EntryDetailView`（`t031:203`、`t067:237/252/431`）。故"不加可选链就必须改 mock"的条件链成立，钉定可选链是零成本选择。
- **门禁基线未因本轮修订变化**（修订为纯文本）：`make test-frontend` = **110 files / 1343 passed | 4 skipped（1347）**、`make typecheck` = `✓ type check passed`（exit 0），**与本任务给定基线逐项一致**；两处 mount spec 隔离复跑 = **29 passed**（与上轮基线一致）。

---

## 3. 非阻塞残留（2 项，均不改变 P4 的唯一实现形态，不构成退回理由）

### NB-1 措辞：`:98`（N13）"属既有 DEBT"与其自身更正口径不一

`grep -n DEBT` 发现 `:98`（N13 行尾）仍写「属**既有 DEBT**」，但**未具名**；而本文其余 5 处（`:118/:543/:709/:727` 与 §6.3 对照表）已统一为「归属 TPV0097/TPV0098「用例可信治理」，**不归 DEBT0012**」。派发指令的判据（"`grep DEBT0012` 命中全部为否认性表述"）**已满足**，故这不是判据未过；仅属同一文件内一处泛称与具名结论的措辞不齐，读者若只读到 N13 可能误以为已挂某条债。**建议**（非必须，P4 无需等）：把 `:98` 的"属既有 DEBT"改为与 `:118` 同口径的"归属 TPV0097/TPV0098「用例可信治理」（**不归 DEBT0012**）"。

### NB-2 措辞：`:610`（UI 设计节·交互 checklist）散文用 `route.meta.zen`（无 `?.`）

`:610` 写「状态变化仅有"路由 → zen 态"一条：`route.meta.zen === 'locked'` 为真 → `zenMode=true`」。该表达式**不带可选链**，与 `:47`（规格节，钉定 `route.meta?.zen`）在**字面**上不同形。判定为**非阻塞**的依据：① `:610` 是**描述性散文**（说明"路由 → zen 态"这一状态变化，非实现条款），`:47`/`:64`/`:65` 的规格节已把 `?.` 钉为"二者缺一不可"；② 该行末句已写明「该派生用 **computed**」，与规格一致。**建议**（非必须）：把 `:610` 的 `route.meta.zen` 补为 `route.meta?.zen`，消除全文唯一的字面不同形。

> 两项均为**文本级**、不触 `gate_commands`、不改任何实现形态；`approved` 不因此保留。

---

## 4. 方法论说明（验证工具本身也被验证）

本轮有一次**我方探针自身出错**并已自查纠正，如实登记：

- 首次统计 BDD 覆盖时，探针用 `re.findall(r"BDD-(\d+)")` 解析 `:496` 的单元格，得出"16 条仅识别 1 条、缺口 17 条"的结论。**这是我方工具的错误**——该单元格写作 `BDD-1, 2, 3, …`（前缀只出现一次，后续为裸数字链），正则只能捕获首个数字。修正为按逗号链解析并加**自证用例**（`parse_ids("BDD-1, 2, 3")` 必须返回 `[1,2,3]`）后复算：`:496` = 16 条、`:497` = 3 条、**并集 19/19 无缺口**。**若未自查，本项会产出与真实情况相反的"覆盖回退"结论**——与派发指令所述"用错误方式验证"的教训同型。
- UI 设计节 gate 检查**用真实函数**（`check-gate.py` 的 `_gate_p2_ui_design_section`），且**显式注入 `sys.path`**（`sys.path.insert(0, "/home/kity/.agate/v0.76.0/agate/scripts")`）——已知缺此行会落到 `parse_ui_design_section` 的 fail-open 降级桩、产出与真实 gate 相反的结论。本轮先打印 `FUNC:` / `module_file:` 确认拿到的是 `/home/kity/.agate/v0.76.0/agate/scripts/check-gate.py` 的真实函数，再取返回值 **`True`**。
- §1.1 的判据区分力验证（M9 对 A/C 两形态）同样先经一次失败：首版探针用非响应式 `meta` getter，导致**正确形态 A 也判不通过**（恒假）。改为 `ref` 响应式 route 后 A/C 分别为 `[false,true,false]` / `[true,true,true]`，区分力成立。**该次失败本身即证"探针不响应式会让判据恒假"**，故未据此得出任何设计缺陷结论。

---

## 5. 维度评分（布局型形态：布局 / 交互 / 视觉三组）

本轮为复审轮，未重审维度明细；上轮失分项均随 G-1 闭环而消除，评分就地更新如下：

| 维度 | 上轮 | 本轮 | 依据 |
|---|---|---|---|
| 组件完整性 | 5/10 | **10/10** | 上轮唯一失分因是"被改动组件 input/output 契约（M2 入参与返回面）三处互斥、P4 无法唯一确定写法"；本轮 `:60-77` 给出四面板"唯一形态"表 + 三个禁止变体，签名/调用点/读取方式/返回对象四面唯一 |
| 交互设计细节 | 6/10 | **9/10** | 上轮失分在 `updateZenAria` 锁死分支与 computed 冲突（TS2540）及锁死文案更新时机缺文件级落点；本轮 `M2③` 改为整体移除（`:46/:58/:67/:149/:448/:662` 六处一致），文案分支明确由 `zenAriaText` computed 承载。保留 1 分：`updateZenAria` 从返回对象删键后，两处 spec mock 仍保留该键（`:158` 已说明"键名不变即可继续使用"，属低风险但非零） |
| 移动端考虑 | 9/10 | 9/10 | 未回退（`:503/:604/:605` + V9 均在）；保持上轮评分 |
| 交互状态覆盖率 | 7/10 | 7/10 | 本轮范围外，未重审；无回退证据 |
| 可访问性 | 7/10 | 7/10 | 同上（上轮已记"未评估新文案作为 `aria-live` 公告的语义完整性"，属非阻塞） |
| 视觉设计（0-10 分解） | 8/10 | 8/10 | 未回退（零 CSS + 五类度量断言仍在，`:617-627`） |
| AI Slop 风险 | 低 | 低 | 无"随便搞"空间；`locked` 的三种变体已被显式禁止，反 AI Slop 力度较上轮增强 |
| 渲染正确性与时序 | 不适用 | 不适用 | layout 形态（P1/P2 一致），按角色规格不启用 |

---

## 6. 结论

**`approved`**。上轮 2 项阻塞级问题**均实测闭环**，阻塞级问题 **0 项**：

1. **G-1 闭环**：锁死态接口形态**已唯一化**——签名 `locked: () => boolean`、调用点 thunk + 可选链、读取一律 `locked()`、返回对象无 `updateZenAria`，四面由 `:60-77` 最终规格表钉定；`lockedMode` 仅存于禁止性表述；**第三种假绿读法已被显式列为禁止项**（`:77`），且其唯一拦截判据 M9（`:53`）经我独立复现**区分力成立**（A 形态通过 / C 形态不通过），并同时证明 **BDD-4 单独拦不住该变体**——M9 因此是载荷性条款而非装饰性条款。根因（`:138` 草图注释权威级不明）亦已修复。
2. **G-2 闭环**：BDD-10 认证配对已改为"alice 登录创建私有 entry → 登录建 share → 匿名带 token 读 → 登录删除"（五处一致）；"匿名创建 + 匿名删除"仅存于禁止性论证（`:513/:514/:682`），规格性措辞零残留；清理判据落在"清理后 alice 复查 raw = 404"的**结果**上；**区分力判据**（真实 token 可见 / 无 token 与伪 token 均不可见，三者互异）已在 `:518` 明确；`files_to_read` 补了 share 范本与契约依据。三条服务端约束经我回源码逐条确认。
3. **跨文件一致性闭环**：`viewer.spec.ts` 18 failed 的归属已从 DEBT0012 更正为"TPV0095 引入的 seed 语义回归 → 归属 TPV0097/TPV0098「用例可信治理」"；`grep DEBT0012` 的 5 处命中**全部**为否认/对照性表述，与债务登记簿 `tech-debt.md:300`（"勿据此关账 DEBT0012"）**方向一致、无矛盾**；归属事实链三条 git 命令全部复现为真；§6.3 三条实质结论**一字未动**。

**非阻塞残留 2 项**（NB-1 `:98` 泛称"属既有 DEBT"未具名；NB-2 `:610` 散文用 `route.meta.zen` 未带 `?.`）——均为文本级措辞，不触 `gate_commands`、不改实现形态，**不构成退回理由**。

**未回退确认通过**：`## UI 设计` 节（含 `layout` 形态声明与三维关键词）、19 条 BDD 覆盖（并集 19/19 无缺口）、双视口落点（含新升为硬约束的 `test.use({ viewport })`）、上轮判"不成立"的两项专项所依赖内容（N4 零 CSS + R-03 复用 zen 类 / 整函数 `return` + 不调 `preventDefault`·`stopPropagation`）**均在**；`make test-frontend` 与 `make typecheck` 基线与本任务给定值逐项一致。

**方向本身正确，未被本轮修订动摇**：方案 A（computed 单状态源 + 复用 zen 类 + 键盘短路 `return`）的三条核心论证上轮已独立复现（组件实例确实复用、`route.meta` 在真实 router 可读、capture + `stopPropagation` 才是吞掉元素级 Escape 的真因），本轮修订**只收敛了接口形态的文字权威级**，未触碰候选方案集、R1/R2/R3 三结论、`gate_commands` 键形态与超时档、四字段与 P1 基线。

**环境合规**：`[PROD_NOT_TOUCHED]`。全程仅用 debug `http://127.0.0.1:8888`（开工前探 `/health` = **200**，实测在线）；未启动 `uvicorn`、未跑 `make debug` / `npm run dev`；生产 `:8080` 与 `~/.peekview/` **未触碰**；本轮全部 bash 命令用 `timeout` 包裹（单测 300s / typecheck 280s / E2E 类未跑）；临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`；未修改 `P2-design.md`（只读评审）。

**副作用与残留（如实登记）**：① 本轮我自建的判据复现目录 `.agate-tmp/rev1-probe/`（含一次性复制的 `node_modules` 副本）与脚本 `.agate-tmp/rev1_ui_gate_check.py` **已删除**；`frontend-v3/src/` **零探针残留**（全程未在其中放置任何文件）。② 复查 `git status --short frontend-v3/` 发现**一处非我产生的残留**：`?? frontend-v3/.agate-tsprobe/`（含 `probe_good.ts` / `probe_bad_ts2540.ts` / `probe_variant3_snapshot.ts` / `probe_provide.ts` / `probe_variants.mjs` + 5 个 `tsconfig.probe_*.json`，mtime 18:29–18:32，**晚于** architect 修订（18:18））——**归属本轮并行评审方，非我方产物**，故**我未删除他人产物**。经核其**当前不抬高基线**：`tsconfig.json:23` 的 `include` 为 `["src/**/*.ts", "src/**/*.vue"]`，`vitest.config.ts` 的 `exclude` 为 `['e2e/**','node_modules/**']` 且该目录**不含任何 `*.spec.*` / `*.test.*` 文件**（实测 0 个），且其**不在 `src/` 下**（本轮派发指引两处警告的对象是"探针放 `frontend-v3/src/`"）→ **不在 tsconfig / vitest 收集面内**，与实测 `make test-frontend` = 110 files / 1343 passed 一致。**请主 Agent 转告该残留的作者清理**（我不动他人产物）。③ `agate-workspace/debt/tech-debt.md` 处于 modified 状态，为本轮主 Agent 的 P2 期更正与 DEBT0013 新登记（含 `updated_at: 2026-09-28`），**与本评审的跨文件一致性判据直接相关**，已纳入 §1.3 核对，**非我方改动**。
