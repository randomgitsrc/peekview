---
phase: P2
task_id: TPV0099
type: review
parent: P2-design.md
trace_id: TPV0099-P2-20260928
agent: review-lead
status: approved
created: 2026-09-28
---

# P2 方案设计专家组评审汇总（**汇总复审轮**）— TPV0099 全屏模式链接 `/{slug}/f`

> 组长角色：review-lead（专家组汇总，**只审不写**——未修改 `P2-design.md`，未修改任何职能评审文件，未写入 `debt/tech-debt.md`）
> 汇总输入（本轮）：`P2-review-design.md`（plan-design-review，**复审轮**）+ `P2-review-eng.md`（plan-eng-review，**复审轮**）
> 被评对象：`P2-design.md`（**735 行**，candidate_count: 3，domains: [frontend]，ui_affected: true；mtime **18:18:48** 未变）
> 基线对照：`P1-requirements.md`（19 条 BDD）
> 环境标记：`[PROD_NOT_TOUCHED]`

**终态：`approved`。阻塞级问题 0 项。** 两方职能评审均判 `approved`（阻塞级 0），且均判定上轮 R-1 / R-2 已**实际闭合**；无实质冲突。

---

## 1. 两份复审的来源与各自结论

| 评审角色 | 产出文件 | 其 Header status | 其自报阻塞级数 | 本轮覆盖维度 |
|---|---|---|---|---|
| plan-design-review | `P2-review-design.md` | **`approved`** | **0** | 前端/UI：组件契约唯一化、交互、可访问性、`## UI 设计` 节 gate 口径、未回退抽查 |
| plan-eng-review | `P2-review-eng.md` | **`approved`** | **0** | 工程：接口契约、测试策略、类型面、`gate_commands` 可执行性、实现就绪度、架构债 |

### 1.1 上轮终态的语义校准（两轮口径对照，防止误读历史）

| 评审 | 上轮终态 | 本轮终态 | 说明 |
|---|---|---|---|
| plan-design-review | `needs-revision`（阻塞 2） | **`approved`** | 上轮该项在 `P2-review-design.md` 上落 `needs-revision` 属**枚举允许**（该文件名在 `STATUS_ENUM_BY_BASENAME` 映射内） |
| plan-eng-review | `rejected`（阻塞 2） | **`approved`** | 上轮的 `rejected` 系**枚举所迫**（`P2-review-eng.md` 落到 `DEFAULT_STATUS_ENUM = {draft, approved, rejected, done}`，**物理上写不了** `needs-revision`），**语义 = 须修订再审，非方案被否** |
| 组长汇总（本文件） | `needs-revision`（阻塞 2） | **`approved`** | `P2-review.md` 是**唯一**允许 `needs-revision` 的文件名；本轮按真实语义取 `approved` |

组长本轮复核该枚举约束仍成立：两份职能评审文件（含本轮）的 `check-frontmatter.py` 均 **exit 0**，且其 `status: approved` 属 `DEFAULT_STATUS_ENUM` 允许值。

---

## 2. 去重后问题清单

### 2.1 上轮 2 项阻塞级的去重（已在上轮完成，本轮复核去重仍成立）

上轮组长已把两方各报的 2 项合并为 2 条并记双锚点，依据是**落点文件:行号重合**（非同一结论的重复陈述）。本轮复核：两方复审**均按该合并口径**逐条验证 R-1 / R-2，未出现新的第四项，去重口径保持成立。

| 合并项 | 组成 | 本轮结论 |
|---|---|---|
| **B-1** 锁死态接口规格的固化面缺陷 | design G-1 ≡ eng BLOCKER-2 | **已闭合**（§3.1） |
| **B-2** BDD-10 认证前提不可执行 | design G-2 ≡ eng BLOCKER-1 | **已闭合**（§3.2） |

### 2.2 本轮非阻塞残留的去重（6 条原始 → **5 条唯一**）

两方合计报 6 条，其中 **1 条重复**（design NB-1 ≡ eng §5 第 4 条，**同一落点 `:98`**）：

| 唯一编号 | 内容 | 落点 | 来源（去重后） | 出处 |
|---|---|---|---|---|
| **RNB-1** | M9 翻转用例**未写明"thunk 须读 reactive 源"** | `:53` | eng §5 第 1 条 | eng |
| **RNB-2** | `files_to_read` 理由仍写"决定 mock 是否需补 meta"，停留在"待决定"语气（`:69-72` 已显式定案） | `:688` | eng §5 第 2 条 | eng |
| **RNB-3** | N14 引用的 300 行上限 spec **路径有误** | `:97` | eng §5 第 3 条 | eng |
| **RNB-4** | N13 行尾"属既有 DEBT"**未具名** | `:98` | design NB-1 **≡** eng §5 第 4 条 | 两方 |
| **RNB-5** | UI 设计节交互 checklist 散文用 `route.meta.zen`（无 `?.`），与规格节字面不同形 | `:610` | design NB-2 | design |

**定级：5 条全部为「非阻塞」，且已由主 Agent 裁定延后转达（见 §5）。** 判据：5 条均**不触 `gate_commands`、不改任何实现形态、不改 P4 的唯一实现路径**，属措辞 / 导航可读性级别。据此**不构成退回理由**。

### 2.3 一条来自 eng-review 的**非设计缺陷**悬挂项（组长转记，不改终态）

eng-review §5 末登记的"**仍待主 Agent 动作的悬挂项**"：§6.5 验证执行约束 + BDD-16 人工体验路径**须真正进入 P6 dispatch-context**（设计 `:717`、`:728` 自标"待主 Agent 确认"）。**该条不是 `P2-design.md` 的缺陷**（设计侧已如实声明），故**不计入本文件的阻塞/非阻塞项**，仅转记以免移交中掉线。

---

## 3. 三个闭环点的验证结论（组长独立复核，不采信任一方自述）

### 3.1 闭环点 1：R-1 锁死态接口形态**唯一化** —— **确认闭环**

**落点逐处回文件核对（组长 `read`/`grep` 实核，735 行全文）**：

| # | 落点 | 实测内容 | 判定 |
|---|---|---|---|
| 1 | `:46`（M2①） | `locked: () => boolean` 入参（默认 `() => false`）；「只读派生（computed），**不落 ref、不落任何可变状态**（**文中不存在 `lockedMode` 这个状态变量**）」 | 到位 |
| 2 | `:46`（M2②） | `computed(() => locked() \|\| manualZen.value)`；「读取 thunk 一律写 `locked()`，禁止写成 `lockedMode.value` / `locked.value`」 | 到位 |
| 3 | `:46`（M2③） | `updateZenAria` 整体移除 + 返回对象删键；「不给只读 computed 加任何赋值分支」 | 到位 |
| 4 | `:47`（M3） | `() => route.meta?.zen === 'locked'`；「thunk 形态 + `?.` 可选链，**二者缺一不可**；严禁传裸值」 | 到位 |
| 5 | `:60-67`（新增最终规格表） | 四面唯一形态：签名 / 调用点 / 读取方式 / 返回对象 | 到位 |
| 6 | `:69-72`（二选一显式定案） | 明写「**不留待决定**」；采用分支 + **显式拒绝**另一分支 | 到位 |
| 7 | `:74-77`（三个禁止变体） | ①裸值 ②`zenAriaText` 保留 ref ③`locked: boolean` | 到位 |
| 8 | `:138`（草图注释·根因修复点） | 已改为「**签名与调用形态为最终规格，P4 照此实现**」 | 到位 |
| 9 | `:136`（§2.1 风险①前提） | 「"既有 mock 仍兼容"这一结论**仅对 thunk 形态成立**……**裸值形态下该结论不成立**」 | 到位 |
| 10 | `:53`（M9 补翻转单测） | 「锁定态派生随 route meta 翻转」用例（`false → true → false`，**全程不重新调用 `useZenMode()`**） | 到位 |
| 11 | `:448`（完成标志） | 与 M2 规格逐项对齐（含"已移除 `updateZenAria`"） | 到位 |
| 12 | `:155`（§2.x 调用点规格） | 「调用点同样是最终规格」+ thunk + `?.` | 到位 |

**形态唯一性（可复现判据，组长实跑）**：

```bash
grep -n "lockedMode" P2-design.md    # 唯一 1 处命中 :46，且位于"禁止性表述"（"文中不存在 lockedMode 这个状态变量"）
grep -n 'locked\.value' P2-design.md # 唯一 1 处命中，同一行，出现在"禁止写成"里
```

即 `lockedMode` **不出现于任何规格性表述**，只出现于禁止性论证中。

**第三种假绿读法已被"显式禁止"** —— 组长确认 `:77` 逐字列出该变体（「把签名改成 `locked: boolean`（配合可选链可**同时**通过 `make typecheck` 与 `make test-frontend`）→ 锁定态被固化为 **setup 期一次性快照**……**是最坏一类假绿**」），并指明 M9 的翻转用例「即为此变体的唯一可执行拦截」。三处（`:46` 入参签名 / `:64` 最终规格表 / `:77` 禁止变体）互为闭锁，**读法不再有二义**——这正是上轮所要求的"不只报错消失，而要形态唯一"。

**判据本身是否真有区分力（组长独立复现，工具自验证）**：M9 是拦截该变体的**唯一可执行判据**，故组长对**判据本身**另做独立复现。探针落 `.agate-tmp/lead-rev1-probe/`（**未放 `frontend-v3/`**），用本仓 `frontend-v3/node_modules/vue`（3.5.34）的 `ref`/`computed`/`reactive`：

| 实现形态 | `zenMode` 序列（非锁死 → 锁死 → 非锁死） | 对 M9 期望 `[false,true,false]` 的判定 |
|---|---|---|
| A 正确规格（thunk 签名 + thunk 调用点 + **reactive** `route.meta`） | `[false, true, false]` | 通过 |
| C 禁止变体 3（`locked: boolean` + setup 期快照） | `[false, false, false]` | **不通过（红）** |
| C2 同 C（另一相位起点） | `[false, false, false]` | **不通过（红）** |
| A′ 正确签名但源**非响应式** | `[false, false, false]` | **不通过（红）** |

→ 三点结论：① 判据在 A 上真、在 C 上假，**区分力成立**（非恒真、非恒假）；② M9 对禁止变体确为**有效可执行拦截**，是**载荷性条款**而非装饰性条款；③ 末行同时**独立复现了 eng-NB-1**（见 §5 RNB-1：正确实现配非响应式源也会被判红 → 最坏后果是**误红**，不是假绿）。

**附带证实（架构前提，组长实跑）**：M2③ 移除 `updateZenAria` 的前提「全仓非测试代码零消费方」独立复核为真——`grep -rn "updateZenAria" frontend-v3/src frontend-v3/e2e` 仅命中 `useZenMode.ts:8/16/25/34`（定义 + 两处内部调用 + 导出）与两处 spec mock（`t031:106` / `t067:119`），**无组件消费方**。

### 3.2 闭环点 2：R-2 BDD-10 认证配对 —— **确认闭环**

| 复核项 | 实测内容 | 判定 |
|---|---|---|
| 认证前提 = 「alice 登录建私有 → 登录建 share → 匿名带 token 读 → 登录删除」 | `:509` 五步编号链逐字相符；`:497`（映射表认证前提列）、`:505`（M8）、`:52`（M8 落点）、`:711`（`env_constraints.auth_premise`）**五处口径统一** | 到位 |
| 「匿名创建 + 匿名删除」的**规格性**措辞已清除 | `grep -n "匿名创建\|匿名删除"` 共 3 处命中（`:513` / `:514` / `:682`），**全部**位于"**为什么不能**"的禁止性论证内；规格与执行步骤零残留 | 到位 |
| 清理判据 = 清理后以 alice 复查 `GET /api/v1/entries/{slug}/raw` = **404** | `:512` 逐字写明（「把判据落在**结果**上，而非"删除者身份"上」）；`:711` 同步 | 到位 |
| 含**区分力判据**（三者须互异） | `:518` 独立小节：「三者结果必须**互不相同**——带 `?share=<真实 token>` **可见正文**；**无 token** 与 **伪 token** 均**不可见**。否则该用例退化为恒真假绿」 | 到位 |
| `afterEach` 清理队列存 `{slug, share_id}` 二元组 | `:511` 明写；`:52` / `:711` 呼应 | 到位 |
| `files_to_read` 补 share 范本 | `:679-680` 补 `t058-share-redesign.e2e.spec.ts:25-95`（既有链路范本）+ `:681-682` 补 `api/shares.py:18-23`（契约依据）；两条路径组长实存确认 | 到位 |

**参照事实的独立复核（组长回源码/回文件，不采信"可直接采信"的转述）**：组长实存确认 `frontend-v3/e2e/t058-share-redesign.e2e.spec.ts` 与 `backend/peekview/api/shares.py` 均在位。两方对三条服务端约束（`api/entries.py:135-139` 匿名强制转公开 / `api/shares.py:18-23` `require_auth` / `services/share_service.py:54-55` 公开 entry 禁建 share）均已回源码逐条复现且结论一致；组长不重复第三遍全文复核，但确认**两方锚点互相独立且一致**，且设计 `:513` 的论证链条与两方实测逐项吻合。

**关于"取认证删除而非匿名删除"的裁定（组长上轮裁定，本轮确认已落实）**：`:514` 明确**不采用**匿名删除，理由是匿名 DELETE 的放行依赖 `config.server.api_key` 为空（`api/entries.py:476-478` 的 `allow_local = no_server_auth and current_user is None`；`config.py:164-167` 的 `api_key` 默认 `""`）——**是环境条件的产物、不是稳定契约**。设计已把清理判据钉在"与创建同上下文、与环境配置解耦"的认证删除上。**上轮 R-2 的裁定被如实落实**。

### 3.3 闭环点 3（跨文件一致性）：`viewer.spec.ts` 归属措辞 —— **确认闭环**

**判据**：`grep -n DEBT0012 P2-design.md` 的命中**全部**为"明确说明**不归** DEBT0012"的对照性表述，**不得**有一处归给 DEBT0012。

**组长实跑，7 行命中（去重后 5 处语义位置），逐处均为否认或对照，零处归属**：

| 行 | 表述性质 | 判定 |
|---|---|---|
| `:118`（R-08） | 「成因为 **TPV0095 引入的 seed 语义回归**，**不属 DEBT0012**——判定见 §6.3 三维对照」 | 对照性 |
| `:543`（§6.3 性质） | 「归属 TPV0097/TPV0098「用例可信治理」……**不归 DEBT0012**」 | 对照性 |
| `:544`（§6.3 对照表引题） | 「**与 DEBT0012 的三维对照**（勿混，两者根因不同）」 | 对照性 |
| `:546`（对照表表头） | 「\| \| DEBT0012 \| 本项（`viewer.spec.ts`） \|」 | 对照性 |
| `:709`（`known_red_baseline`） | 「……归属 TPV0097/TPV0098「用例可信治理」（TPV0095 引入的 seed 语义回归；**不归 DEBT0012**——判据见 §6.3：重跑 make debug-seed 不能恢复）」 | 对照性 |
| `:727`（§9 遗留表） | 「TPV0095 引入的 seed 语义回归，**不归 DEBT0012**」 | 对照性 |

**与债务登记簿的跨文件一致性（组长实读登记簿，非采信转述）**：`agate-workspace/debt/tech-debt.md:300`（DEBT0012 条目第 4 点）逐字写着该红灯「**由上条衍生、但根因不同（不并入本条）**」、归属「**TPV0097/TPV0098「用例可信治理」**」、且「此处仅作指引，**勿据此关账 DEBT0012**」——与 `P2-design.md` 的措辞**方向与归属完全一致**，先前矛盾已消除。

**§6.3 三条实质结论一字未动（组长逐条回文件核对）**：

| 结论 | 原文锚点 | 判定 |
|---|---|---|
| 既有 spec **不作 gate 键** | `:553`①「**不进本任务 gate**（否则 P5 必红，且红因与本任务无关）」 | 未动 |
| E2E 键**全指新建 spec** | `:554` 前半「本任务的 E2E 键**全部指向新建 spec**」；gate 块 4 处 `make debug-test` 均带 `E2E_SPEC=`（`:477`/`:479`/`:485`/`:487`） | 未动 |
| P4/P5 **不得为让 E2E 全绿而改既有 spec** | `:554` 后半「P4/P5 不得为"让 E2E 全绿"而去改既有 spec」 | 未动 |

**债务编号争议已闭（组长确认，不新增编号建议）**：组长实读 `debt/tech-debt.md` 确认——① **banner 缺口已登记**：`DEBT0013`（`:304-330`，`id: DEBT0013` / `status: open` / `task_id: TPV0099-fullscreen-link`，含 R-04 与 V7 证据锚点、`closure_criteria` 三条）；② **`viewer.spec` 归属已更正**：DEBT0012 条目 `:300` 已就地补记"勿据此关账 DEBT0012"+ 归属 TPV0097/TPV0098。eng-review 已**主动撤回**其 `DEBT0014` 编号建议、声明"以已登记条目为准"，登记簿 `:330` 亦记录了编号说明。→ **本汇总不再提 `DEBT0014`，亦不给出新编号建议。**

### 3.4 组长未回退抽查（只确认，不重审）

| 抽查项 | 组长实测 | 判定 |
|---|---|---|
| 四字段齐全 | frontmatter `packages: [frontend-v3, docs]` / `domains: [frontend]` / `ui_affected: true` + 正文 §6 `gate_commands` | 未回退 |
| `## UI 设计` 节 | `:590` 标题存在；`:596` 渲染形态 = `layout`（与 P1 frontmatter `ui_render_shape: layout` **一致**）；`:597` 适用维度；`:599`/`:607`/`:615` 三类 checklist 齐备 | 未回退 |
| gate 块无 `&&` 拼接、E2E 键全带 `E2E_SPEC=`、E2E 档 900s | `:464-490` 逐行核对：`&&` 计数 0；4 个 E2E 键 4/4 带 `E2E_SPEC=`；4 个 `*_e2e*_timeout_seconds: 900` | 未回退 |
| `dispatch_plan` 合法 | `:18` `{mode: single}` | 未回退 |
| 19 条 BDD 覆盖 | 脚本核验（含自证用例）：A=16、B=3、`union=19`、交集空、`{1..19}` 无缺项（见 §6） | 未回退 |
| `files_to_read` 引用路径实存 | 抽查 6 条关键路径（`useZenMode.ts` / `useZenMode` 单测范本 / `t031` mock 面 / `t058` share 范本 / `api/shares.py` / `tpv0091` 范本）**全部在位** | 未回退 |
| `EntryDetailView.vue` 300 行上限现状 | 实测 **265 行**，与 N14 自述一致 | 未回退 |

---

## 4. 冲突消解

### 4.1 实质结论冲突：**无**

组长独立比对两方复审在闭环点 1 / 2 / 3 上的判定、锚点与结论，**逐项一致，未发现实质冲突**。与主 Agent 的判断及附录 A.1 一致。

**未采纳的"假冲突"辨析（沿用上轮口径，本轮复核仍成立）**：design-review NB-1（`:98` 泛称未具名）与 eng §5 第 4 条**并非分歧**——两方**同判非阻塞、同给同一修订建议**，实为**同一项的重复**，故在 §2.2 合并为 RNB-4，不记为"专家组分歧"。

### 4.2 同一闭环项下的**修复建议差异（上轮已裁定，本轮确认已落实）**

| 闭环项 | 两方上轮的差异 | 组长上轮裁定 | 本轮确认落实情况 |
|---|---|---|---|
| B-2（认证配对） | eng 主张"认证删除"；design 主张"任意（含匿名）删" | **取 eng 的认证删除**（因匿名删依赖 `config.server.api_key` 为空，属环境条件而非稳定契约），**同时保留** design 的"清理后复查 404"附加断言 | **已落实**：设计 `:509` 第 5 步取认证删除；`:512` 保留"alice 复查 raw = 404"；`:514` 显式写明不采用匿名删除及其理由 |
| B-1（可选链地位） | design 列为"**亦可**写"的可选防御；eng 要求"**钉定**为统一形态" | **采纳 eng 的"钉定为唯一形态"**（裸值实测抛 `TypeError`、可选链返回 `false`，差异实存；且钉定后既有两处 mock 无需改动，修订面更小） | **已落实**：`:69-72` 显式定案取可选链并**显式拒绝**另一分支，明写「不留待决定」 |

→ 两处差异**均已在修订中按组长裁定落地**，两方复审对此**均无异议**，冲突已消解完毕。

### 4.3 专家组分歧：**无**

---

## 5. 定级

### 5.1 阻塞级：**0 项**

上轮 2 项（B-1 / B-2）经组长独立复核**均确认闭合**（§3.1 / §3.2），两方复审亦**均判阻塞级 0**。本轮未产生新阻塞级。

两条闭环的共同性质值得记录（供 P3/P4 理解为何已收口）：闭合方式**不是"让报错消失"，而是"规格唯一化 + 由已固化 gate 键承担拦截"**——这正是上轮组长所要求的修订形态。

### 5.2 非阻塞：**5 项（去重后），已由主 Agent 裁定延后转达**

| 编号 | 内容 | 落点 | 性质 | 处置 |
|---|---|---|---|---|
| RNB-1 | M9 翻转用例**未写明"thunk 须读 reactive 源"**；非响应式源下**正确实现也会返回 `[false,false,false]`** → **误红正确实现** | `:53` | 判据精度（最坏 = 误红，**非假绿**） | **非阻塞、已由主 Agent 裁定延后转达**（建议 P3 落为显式硬前提，推荐用 `reactive` 模拟 `route.meta`） |
| RNB-2 | `files_to_read` 理由仍写"决定 mock 是否需补 meta"，停留在"待决定"语气 | `:688` | 措辞（`:69-72` 已显式定案） | 同上 |
| RNB-3 | N14 引用的 300 行上限 spec **路径有误** | `:97` | 导航可读性（见下方实核） | 同上 |
| RNB-4 | N13 行尾"属既有 DEBT"**未具名**（易被就近读成 DEBT0012） | `:98` | 措辞 | 同上 |
| RNB-5 | UI 设计节交互 checklist 散文用 `route.meta.zen`（无 `?.`），与规格节字面不同形 | `:610` | 措辞 | 同上 |

**组长对 RNB-3 的独立实核（主 Agent 已核，组长复核确认）**：

```bash
ls frontend-v3/src/components/t082-error-format.spec.ts           # 存在（2492 bytes）
ls frontend-v3/src/components/__tests__/t082-error-format.spec.ts # 不存在（无 __tests__/ 层）
```

即设计 `:97` 写作 `.../components/__tests__/t082-error-format.spec.ts:9-16`，**实际在 `.../components/t082-error-format.spec.ts`**——**目录层级偏差属实**；行号与断言内容（`lineCount < 300`）正确。

**组长对 RNB-1 的独立复现**：§3.1 探针表的 **A′ 行**（正确 thunk 签名 + **非响应式**源）实测返回 `[false,false,false]`，**独立复现了 eng-review 的判据精度发现**。故该条性质定为**"判据精度、最坏后果是误红正确实现"**，**不是假绿**——定级为非阻塞成立。

**为何非阻塞项不构成退回（组长确认主 Agent 的流程性裁决）**：主 Agent **已裁决本轮不改 `P2-design.md`**，理由为流程性的——设计已被两份评审批准，**此刻再改（哪怕仅措辞）会使两份 `approved` 立即失效**，须再走一轮评审 = 额外消耗 retry 预算（P2 cap 3），为措辞级非阻塞项不成比例；**改由主 Agent 在 P3/P4 派发上下文转达**。组长**采纳该裁决**，不据此判 `needs-revision`。

---

## 6. 19 条 BDD 覆盖性确认

**结论：19 条全覆盖，无漏号、无重号、无跨集重复、无缺口。**

**组长独立核验（脚本 + 自证用例）**：`§6.1`（`:494-497`）的两键映射为

- `P5_e2e` / `P6_e2e` → `e2e/tpv0099-fullscreen-link.spec.ts`（**新建**） → BDD-**1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18, 19** = **16** 条
- `P5_e2e_auth` / `P6_e2e_auth` → `e2e/tpv0099-fullscreen-link-auth.spec.ts`（**新建**） → BDD-**9, 10, 15** = **3** 条
- 并集 = **19**、交集 = **空**、`{1..19}` 缺项 = **`[]`**、集内重复 = **0**——与 `M7`/`M8`（`:51-52`）声明的用例数一致

**一处方法论如实登记（验证工具本身也被验证）**：组长首次统计时，自写解析器对 `:496` 单元格得出 **14 条**、并集 **15 条**、缺 `[1,9,15,19]` 的错误结论。**这是组长工具的缺陷**——该单元格形如 `` `...spec.ts`（**新建**） | BDD-1, 2, 3, … ``，链首 `BDD-` 前缀的**前一 token 含中文与反引号**，我的首版按逗号分段后**未把链首与前一 token 切开**，导致首项与末项被吞。修正为"定位链首 `BDD-` 后按链解析，遇非数字项即终止"，并加**自证用例**（`parse_ids_impl('`f.spec.ts` | BDD-1, 2, 3, 19 | …')` 必须返回 `[1,2,3,19]`）后复算得 **16 / 3 / 19 / 无缺项**。**若未自查，本项会产出与真实情况相反的"覆盖缺口 4 条"结论** —— 与本任务已出现的"用错误方式验证"教训同型，故如实登记。

**逐条前提可达性**：上轮组长已经 debug `:8888` 实测复核逐条前提可达性（`dsh-architecture` / `tsv-server-metrics` / `unicode-filenames` / `svg-*` 匿名 200；`markdown-test` / `mermaid-charts` 匿名 404 需 alice），本轮**不重跑**；其中唯一需修订者为 BDD-10，**已随 R-2 闭环**（认证配对 + 区分力判据，§3.2）。

**一处口径澄清（沿用上轮结论，防 P5/P6 误读覆盖范围）**：按 `§6.1`，19 条**全部**由两个 E2E spec 承担；`M9`（`:53`）是在 E2E 之外**追加**对 BDD-4/5/6/12 的单测层覆盖。两组口径下 19 条均无缺口。组长按 `§6.1` 口径确认（E2E 层承担 **19** 条，单测层另加 **4** 条）。

---

## 7. 门槛机制复核（组长实跑真实 CLI 入口，非采信）

**修订后再次复跑**（不止依赖上轮记录）：

| 场景 | 命令 | 实测输出 | exit |
|---|---|---|---|
| 本文件（`agent: review-lead` + `status: needs-revision`） | `check-gate.py P2 <task_dir>` | `RECONCILE SUMMARY: 0 mismatches across 2 fields` + `GATE P2: P2-review.md frontmatter status 非 approved（当前: needs-revision）` | **1** |
| **临时副本**（`agent: review-lead` + `status: approved`） | `check-gate.py P2 <tmp_copy>` | `RECONCILE SUMMARY: 0 mismatches across 2 fields` + `GATE P2: 需从 P2-design.md gate_commands 动态读取，主 Agent 自行判定` | **2** |
| 本文件 frontmatter（改动前形态） | `check-frontmatter.py` | 无输出 | **0** |
| 两份职能评审 frontmatter | `check-frontmatter.py` | 无输出（各自 exit 0） | **0** |

**关键判读（组长读 gate 源码确认，非凭经验推断）**：`check-gate.py:940` 的 `return 2`（nudge 文案）位于 `gate_p2()` 的**末尾**，其前依次是 candidate_count ≥2 校验、`P2-review.md` 存在性、`status == approved`、`agent` 非空、`agent != main`、四字段 ≥4、权衡/选择理由、`dispatch_plan` 合法性、`_gate_p2_ui_design_section`、bootstrap 骨架校验——**全部通过后**才抵达该 `return 2`。故 `exit 2` 是"全部检查通过、仅提示主 Agent 自行判定动态 gate"的**非失败**信号。**即：`agent: review-lead` + `status: approved` 形态可被真实 gate 接受，且 P2 的其余全部 gate 条件亦已通过。**

→ 上轮 `exit 1` 的**唯一**原因是本汇总文件的 `status` 仍为 `needs-revision`（预期行为，非设计缺陷）。本轮改为 `approved` 后，主 Agent 跑真实 gate 应得 **exit 2（nudge）**。

**⚠️ 工具摩擦（组长实测，沿用上轮有效做法，登记供协议层参考）**：`agate-md-field-set.py` 在写**非 draft** 的 `status` 时会校验 `agent` 是否 ∈ `assets/review-roles/*.md` 的**文件名集合**，而该目录只有 `review.md`、**无 `review-lead.md`**（组长是**汇总角色**，不在该目录的角色文件表内）→ `agent: review-lead` **无法经 setter 写 `status`**。

**本轮处置**：**保留 `agent: review-lead`**（派发指令强制 + 先例 `TPV0093/P2-review.md`），改用 **Write 工具直接落盘**写 `status: approved`，并以 `check-frontmatter.py`（**exit 0**）+ 真实 `check-gate.py P2`（临时副本 **exit 2 nudge**）双重验证该形态被 gate 接受。此为**协议层两个工具之间的口径不一致**（setter 的引导校验 ≈ `role-system.md` 第二层角色表，而组长为汇总角色、不在该表内），**非本任务缺陷**；主 Agent 已复核并采纳该做法。

---

## 8. 汇总结论

- **终态 `approved`**（本文件名允许 `needs-revision`，但**按真实语义**取 `approved`，非照抄职能评审字面）
- **阻塞级问题 0 项**；上轮 2 项（B-1 锁死态接口形态唯一化 / B-2 BDD-10 认证配对）**经组长独立复核均确认闭合**
- **非阻塞 5 项**（去重后；原始 6 条含 1 条两方重复），**均不构成退回理由**，已由主 Agent 裁定**延后转达**至 P3/P4
- **冲突消解**：无实质结论冲突、无专家组分歧；上轮两处修复建议差异（认证删除 / 钉定可选链）**均已按组长裁定落地**且两方无异议
- **跨文件一致性闭环**：`grep -n DEBT0012` 命中**全部**为否认/对照性表述、零处归属；与 `debt/tech-debt.md:300` 口径一致；§6.3 三条实质结论一字未动；**banner 缺口已登记 `DEBT0013` + `viewer.spec` 归属已更正**（不再提 `DEBT0014`、不新增编号建议）
- **19 条 BDD 全覆盖**（16 + 3，并集 19、交集空、无缺项）
- **方案方向未被本轮修订动摇**：方案 A（computed 单状态源 + 复用 zen 类 + 键盘短路 `return`）、R1/R2/R3 三结论、`gate_commands` 键形态与超时档、四字段与 P1 基线**均未变**；修订**只收敛了接口形态的文字权威级**。上游调整：**无**——骨架无需重选、无需回退 P1
- **`P2-design.md` mtime 仍为 18:18:48**（组长只读，未修改任何被评文件）

`[PROD_NOT_TOUCHED]`

**副作用与残留（如实登记）**：① 组长探针目录 `.agate-tmp/lead-rev1-probe/`（`m9probe.mjs` / `m9probe2.mjs` + gate/frontmatter 临时副本目录 `gatecopy/`）**已整目录删除**；**未在 `frontend-v3/` 下放置任何文件**。② 复查 `git status --porcelain frontend-v3/` **为空**；`find frontend-v3 -name "*probe*"`（排除 `node_modules`）**无命中**。③ 全程只读 `P2-design.md` 与两份职能评审文件，**未修改**任何被评文件；**未写** `debt/tech-debt.md`。④ 未跑 `uvicorn`、未跑 `make debug` / `npm run dev`；未触碰 `:8080`（组长复核本机 `:8080` 监听计数 0）与 `~/.peekview/`。⑤ 唯一执行的完整测试为 `make test-frontend`（只读基线确认），基线实测 **110 files / 1343 passed | 4 skipped (1347)**、**exit 0**，与任务给定基线逐项一致。⑥ **组长本轮两次自纠工具缺陷**并如实登记：BDD 解析器吞链首末项（§6）、首个 M9 探针的第三变体模型有缺陷（源对象无 `meta` 致 `TypeError`）已重写修正；另有一个 `bdd4()` 子探针模型错误（在变更状态**之后**读取"变更前"值）**已弃用、未据此得出任何结论**。
