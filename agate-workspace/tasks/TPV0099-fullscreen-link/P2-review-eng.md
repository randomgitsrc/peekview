---
phase: P2
task_id: TPV0099
parent: P2-design.md
trace_id: TPV0099-P2-20260928
agent: plan-eng-review
status: approved
---

# P2 工程维度评审（复审轮）— TPV0099 全屏模式链接 `/{slug}/f`

评审角色：plan-eng-review（独立 subagent，agent≠main，**只审不写**，未修改 `P2-design.md`）
评审轮次：**第二轮（复审）**。上一轮终态 `rejected`（语义 = 须修订再审，非方案被否），architect 已按 `P2-review.md` §5 的 R-1/R-2 定点修订，本轮**只验证两个阻塞项是否真的闭环**，外加 1 项跨文件一致性与 1 组「未回退」抽查。
评审对象：`P2-design.md`（**735 行**，candidate_count=3）
方法：不采信 architect 自述；对每条关键声明回源码 / 真实 gate CLI / 实证探针核对，给出**文件:行号**锚点。凡涉及"某 gate 是否会红"的结论一律用**真实 CLI 入口**（`check-gate.py` / `agate-read-gate-commands.py`）或**自验证探针**（正例必过 + 反例必红，先证明探针有判别力再采信结论）。
环境标记：`[PROD_NOT_TOUCHED]`（全程只用 debug `:8888` + 本机 node/vitest/vue-tsc；未触碰 `:8080`、未读写 `~/.peekview/`）

---

## 0. 本轮范围

按派发指令，本轮**只做四件事**：验证点 1（BLOCKER-2 闭环 + 形态唯一化）、验证点 2（BLOCKER-1 = BDD-10 闭环）、验证点 3（`viewer.spec.ts` 归属措辞的跨文件一致性）、未回退抽查。
**未重审**已确认合规的 E2E 假绿四项核查、测试策略主体、方案 A 的候选权衡（§2.4/§3.2/§3.3）与 R1/R2/R3 结论。

---

## 1. 验证点 1：BLOCKER-2（M2/M3 与既有测试/类型契约）——**已闭环，且形态已唯一化**

### 1.1 落点复核（回文件读，逐条给锚点）

| 要求落点 | 设计行 | 实测内容 |
|---|---|---|
| M2① thunk 入参 + 默认值 | `P2-design.md:46` | `locked: () => boolean`（默认 `() => false`）；明写"不落 ref、不落任何可变状态""文中不存在 `lockedMode` 这个状态变量" |
| M2② `zenMode` 为 computed | `:46`、`:141` | `computed(() => locked() || manualZen.value)`；`zenMode` 由 `ref(false)` 改 computed |
| M2③ 移除 `updateZenAria` | `:46`、`:58`、`:67`、`:149` | 正文、完成标志、返回对象、代码草图四处一致要求整体移除（含返回对象删键） |
| M2④ 键盘短路 | `:46`、`:147`、`:259` | `if (locked()) return` —— 整函数 return，不 `preventDefault` / 不 `stopPropagation` |
| M3 调用点 | `:47`、`:65`、`:155` | `useZenMode(() => route.meta?.zen === 'locked')`，**thunk + `?.` 二者缺一不可**，明写"严禁传裸值" |
| 「最终规格」表 | `:60-67` | 四面唯一形态：签名 / 调用点 / 读取方式 / 返回对象 |
| 三个禁止变体 | `:74-77` | ①裸值 ②`zenAriaText` 保留 ref ③`locked: boolean` |
| 草图注释与风险前提 | `:135`、`:136`、`:138` | 方案 A 核心、风险①前提、"签名与调用形态为最终规格" |
| M9 补翻转单测 | `:53` | 「锁定态派生随 route meta 翻转」用例，`false → true → false`，全程不重新调用 `useZenMode()` |
| 完成标志 | `:448` | 与 M2 规格逐项对齐 |

### 1.2 形态唯一化——**关键项，已达成**（不只是"两个报错消失"）

派发指令要求确认**第三种不报错的假绿读法**（签名改 `locked: boolean`）已被**显式禁止**。我分四步做实证（探针自验证：先证明工具有判别力，再采信结论）：

1. **确认该读法"确实不报错"** —— 我用 `vue-tsc --noEmit`（本仓 `vue-tsc`，target ES2020 + strict）对 `locked: boolean` 形态单独编译：**exit 0，零报错**；且用 `vitest` 跑"锁死下 f/Escape 不改状态 + 公告文本不含退出词 + 非锁死态行为不变"三条朴素用例：**3 passed，exit 0**。→ **证实设计 `:77` 的事实前提成立**：该变体可同时穿过 `make typecheck` 与 `make test-frontend`，"没有报错"本身**不足以**禁止它。
2. **确认探针有判别力**（避免落入"判据恒真"）：同一 harness 下 `zenAriaText` 转 computed 后写 `.value` 的变体**必须**红 —— 实测 `error TS2540: Cannot assign to 'value' because it is a read-only property`（exit 2）。正例 exit 0 / 反例 exit 2，探针方向正确。
3. **确认 M9 的翻转单测确实能拦截**：我构造"签名是 thunk（骗过 typecheck）但 setup 期一次性快照"的最隐蔽变体，与正确实现并排跑同一翻转断言 ——
   - thunk 读 **reactive** 源（`route.meta?.zen` 形态）：正确实现 `[true,false,true]` 翻转，快照实现**恒定 `[true,true,true]`** → **判别成立**（断言失败，红）
   - 读 `ref`：正确 `[false,true,false]`，快照 `[false,false,false]` → **判别成立**
   → **M9 的翻转用例是有效拦截，不是形式条款**（见下方非阻塞项 1 的前提提醒）。
4. **形态唯一性收敛**：能同时满足"① typecheck 绿 ② 既有 2 个 spec 绿 ③ M9 翻转绿 ④ 不落 ref / 随 route 响应式翻转不变量"的形态**只有一种** = `useZenMode(locked: () => boolean = () => false)` + 调用点传 thunk + 内部 `locked()`。三个禁止变体各自被至少一个已固化 gate 键打红：裸值 → `make test-frontend`；保留 ref + 加赋值 → `make typecheck`（TS2540）；`locked: boolean` → **M9 翻转用例**（另：M9 若按 thunk 形态书写，该变体还会先在 `make typecheck` 上因实参类型不符报错，拦截更早）。

> 结论：判据不是"两个报错消失了"，而是"**除唯一形态外，其余可编译写法都被某条已固化 gate 键打红**"。`:74-77` 把第三个变体**显式列为禁止**并指明其唯一可执行拦截 —— 这一点是本轮修订的核心增量，已核实达成。

### 1.3 `route.meta` 访问方式：**二选一已显式定案**（无"待决定"）

`:69` 明写「二选一已定，取『钉定可选链』（**不留待决定**）」；`:71` 给出采用分支（带 `?.` → 既有两处 `useRoute` mock **无需改动、不进 M 栏**）并**显式拒绝**另一分支（`:72` 不加可选链 → 必须补 mock `meta` 并列入 M 栏，"本设计不取此分支"）。**符合"显式定案、不留待决定"的要求。**

我独立复核该定案的**代码事实依据**是否成立（自验证挂载探针，逐字复刻既有 mock 形态）：

| 挂载形态 | 实测结果 |
|---|---|
| 规格形态（thunk + `?.`） | **正常挂载**，且渲染出 `false`（证明 setup 真的执行了，不是静默跳过） |
| 禁止形态（裸值 `route.meta.zen`） | **抛错**：`TypeError: Cannot read properties of undefined (reading 'zen')` |

- 既有 mock 无 `meta` 键的锚点已复核：`t031-entry-detail-view.spec.ts:164-168`、`t067-detail-framework.spec.ts:173-177` 的 `useRoute` mock 只返回 `params`/`query`/`path`；两处 `useZenMode` mock（`t031:106`、`t067:119`）为链式字面量、**忽略入参**。
- `:158` 已把上一轮我指出的措辞缺陷更正到位：旧文断言"既有 mock 仍兼容"（无限定），现文改为**「该结论仅对 thunk 形态成立」**，并点明裸值在**调用点**求值、早于 mock 拦截。
- 补充实证：`t031`/`t067` 的 mock 字面量里**保留** `updateZenAria: vi.fn()` 也不会因 M2 移除该导出而报错（`vi.mock` 工厂返回值对模块不做严格签名比对，实测带额外/伪造键仍 exit 0）；两 spec 是整体 mock `useZenMode`，`EntryDetailView` 只解构三个键，故**无类型与运行时风险**。设计"mock 无需改动"的结论成立。
- 交叉核对：其余引用 `EntryDetailView` 的 spec（`t052-header-redesign.test.ts` / `entry-lifecycle.test.ts` / `header-layout.test.ts` / `HtmlViewerIntegration.spec.ts` / `t082-error-format.spec.ts`）**均未挂载该组件**（前者读源码文本、后者仅算行数、余者为 store/工具测试），不构成新的红点。

### 1.4 类型面交叉复核（无可信度缺口）

- `provide(ZenModeKey, zenMode)` 与 `provide(ZenAriaTextKey, zenAriaText)`：`entryDetailKeys.ts:3,5` 声明为 `InjectionKey<Ref<boolean>>` / `InjectionKey<Ref<string>>`，computed 是 Ref 子类型 —— 我用 `vue-tsc` 实测该 provide 形态 **exit 0**，设计 `:89`/`:158` 的兼容性结论成立。
- `ZenAriaTextKey` 全仓唯一消费方是 `EntryDetailView.vue:160` 自身 provide（`:136` 导入），无外部 `.value` 写入点，故 `zenAriaText` 转 computed 无赋值面冲突。
- `updateZenAria` 零非测试消费方已复核：全仓命中仅 `useZenMode.ts:8,16,25,34`（实现内）+ `t031:106`、`t067:119`（mock 字面量），**移除安全**。

**验证点 1 判定：闭环。** BLOCKER-2 的两个子缺陷均已从「实现就绪度缺口」转为「规格已唯一化 + 由既有 gate 键承担拦截」。

---

## 2. 验证点 2：BLOCKER-1（BDD-10 认证配对）——**已改正，含区分力判据**

| 派发要求的核对项 | 设计行 | 实测 |
|---|---|---|
| 认证前提 = alice 登录建私有 → 登录建 share → 匿名带 token 读 → 登录删除 | `:509` | **五步顺序完全相符**（①alice 登录取 token ②同一 token 建私有 entry `is_public:false` + `e2e-` 前缀 ③同一 token 建 share 收 `share_url` ④匿名带 `?share=<token>` 访问 `/{slug}/f` ⑤同一 token 删除 entry） |
| 「匿名创建 + 匿名删除」的**规格性措辞**已清除（仅可留在禁止性论证） | `:513`、`:514` | 全文该措辞**仅出现 2 处**，均为**禁止性论证**（"为什么不能『匿名创建 + 匿名删除』"、"不采用『匿名删除』作为清理手段"）；规格与执行步骤中**零出现** |
| 清理判据 = "alice 复查 `raw` = 404" | `:512` | 明写判据落在**结果**上而非"删除者身份"上；`:711` 同步 |
| **区分力判据**（真实 token 可见 / 无 token 与伪 token 均不可见，三者互异） | `:518` | 有独立小节「BDD-10 的区分力判据（防恒真退化）」：三者结果必须**互不相同**，否则退化为恒真假绿 |
| 保留"为何匿名路径不可行"的论证 | `:513` | 三条服务端约束 + 行号锚点 |
| `files_to_read` 补 share 范本 | `:679-682` | 新增 2 条，与我上轮建议一致 |

**上游一致性**：`:52`（M8）与 `:497`（§6.1 映射表认证前提列）、`:582`（§6.5 第 4 条）、`:711`（`env_constraints.auth_premise`）四处**口径统一**，无残留旧措辞。

**范本锚点独立复核**（不采信自述）：
- `frontend-v3/e2e/t058-share-redesign.e2e.spec.ts:25-95`：实测确为「注册（容忍已存在）→ 登录取 `access_token` → `Authorization: Bearer` 建 **私有** entry（`is_public: false`）→ share 列表取 activeIds → `/shares/revoke` 清理」的完整既有链路 —— 与 BDD-10 所需配对**逐环对应**，范本有效。
- `backend/peekview/api/shares.py:18-23`：实测 `:23` 为 `current_user: User = Depends(require_auth)`（create）；`list_shares`/`revoke_shares` 同样为 `require_auth` —— 引用范围准确。
- 三条服务端约束独立复核均成立：`api/entries.py:136-138` 匿名强制转公开；`services/share_service.py:54-55` 公开 entry 禁建 share（`ValidationError`）；share 端点三处 `Depends(require_auth)`。
- `:514` 对"匿名删除不可靠"的论证（依赖 `config.server.api_key` 为空，`config.py` 默认 `""`）与源码一致 —— 该论证**支持**取认证删除，方向正确。

**验证点 2 判定：闭环。**

---

## 3. 验证点 3：`viewer.spec.ts` 18 failed 的归属措辞——**已更正，跨文件一致**

**判据**：`grep -n DEBT0012 P2-design.md` 命中**全部**须为"不归 DEBT0012"的对照性表述，不得有任何一处把它归给 DEBT0012。

实测命中 **6 处**，逐处判读：

| 行 | 内容性质 | 判定 |
|---|---|---|
| `:118`（R-08） | "成因为 **TPV0095 引入的 seed 语义回归**，**不属 DEBT0012**" | 对照性，合规 |
| `:543` | "归属 **TPV0097/TPV0098「用例可信治理」**，**不归 DEBT0012**" | 对照性，合规 |
| `:544` | "**与 DEBT0012 的三维对照**（勿混，两者根因不同）" | 对照性，合规 |
| `:546` | 对照表表头 `| DEBT0012 | 本项（viewer.spec.ts） |` | 对照性，合规 |
| `:709`（env_constraints） | "归属 TPV0097/TPV0098…**不归 DEBT0012**——判据见 §6.3" | 对照性，合规 |
| `:727`（§9 汇总表） | "TPV0095 引入的 seed 语义回归，**不归 DEBT0012**" | 对照性，合规 |

→ **零处**把该红灯归给 DEBT0012。符合判据。

**跨文件一致性复核**（与债务登记簿对照）：`debt/tech-debt.md:300` 的 DEBT0012 条目自身写明「**由上条衍生、但根因不同（不并入本条）**」并注明「此处仅作指引，**勿据此关账 DEBT0012**」，且已登记「归属 **TPV0097/TPV0098**」。**设计措辞与登记簿口径一致**，先前"归 DEBT0012"的矛盾表述已消除。

**§6.3 三条实质结论一字未动**（逐条复核）：
- 既有 spec **不作 gate 键** → `:553` ①
- E2E 键**全指新建 spec** → `:496-497`（两键 spec 均为 `tpv0099-*.spec.ts` **新建**）+ `:554` 前半
- P4/P5 **不得为让 E2E 全绿而改既有 spec** → `:554` 后半（"P4/P5 不得为『让 E2E 全绿』而去改既有 spec"）

→ 三条均完好。另 `:552` 保留判据（重跑 `make debug-seed` 能否恢复）与提交锚点，与主 Agent 裁决一致。**我未发现该裁决或证据链的反例。**

**验证点 3 判定：闭环。**

---

## 4. 未回退抽查（只确认，不重审）

| 抽查项 | 实测 | 判定 |
|---|---|---|
| 四个 E2E 键仍 `E2E_SPEC=<spec> make debug-test` 定向 | `:477`、`:479`、`:485`、`:487` —— 4/4 带 `E2E_SPEC=` | 未回退 |
| gate 块内**无裸调用** | 逐行核对 `:464-490`：裸 `make debug-test` 计数 **0**（全文唯一非 `E2E_SPEC` 命中在 `:706` 的 `env_constraints` 散文"必须经 `make debug-test`"，非命令键） | 未回退 |
| **无 `&&` 拼接** | gate 块内 `&&` 计数 **0** | 未回退 |
| E2E 档 **900s** | `:478`、`:480`、`:486`、`:488` —— 4 个 `*_timeout_seconds: 900` | 未回退 |
| 全引用 Makefile target | `test-frontend:173` / `lint:185` / `typecheck:193` / `debug-test:648` / `check-docs:732` —— 逐个实存 | 未回退 |
| spec → BDD 映射 16+3=19 完整 | 脚本核验：A=16、B=3、`union=19`、跨集交集 `[]`、`{1..19}` 缺失 `[]` | 未回退 |
| `dispatch_plan` 合法 | `:18` `{mode: single}` —— `mode` ∈ 协议允许集，`single` 无需 `batches` | 未回退 |
| 四字段齐全 | frontmatter `:11-17`（`packages` / `domains` / `ui_affected`）+ 正文 `§6` `gate_commands` | 未回退 |
| M9 / E2E 测试分工与 `P3`/`P5` 键形态未变 | `P3: "make test-frontend"`（`:466`）+ `P3_formatter: "vitest.sh"`（`:467`）；`P5: "make test-frontend"`（`:469`）；M9 单测（`:53`）与 `P5_e2e` 双 spec（`:477`/`:479`）分工同上一轮 | 未回退 |

**真实 CLI 复核**（不用自造探针调内部函数）：
- `agate-read-gate-commands.py`（`GATE_FILE=<绝对路径>` 传参）→ **exit 0**，解析出 `{"commands": [{"cmd": "make test-frontend", "formatter": "vitest.sh", "suffix": ""}], "project_module": "src/"}`，`RECONCILE SUMMARY: 0 mismatches` —— gate 键形态可被真实读取器正确消费。
- `check-gate.py P2 <task_dir>` → **exit 1**，输出 `GATE P2: P2-review.md frontmatter status 非 approved（当前: needs-revision）` —— 该红来自**组长汇总文件的上一轮终态**，正是派发指令所述"修订后须重跑评审、`needs-revision` 会被 gate 拦下"的预期行为，**非设计缺陷**；本轮我给出 `approved` 后该键即由组长汇总轮闭合。

---

## 5. 非阻塞项（本轮新识别 4 条，均不构成退回理由）

1. **M9 翻转用例的前提未写明"thunk 须读 reactive 源"**（`:53`）。我用**非响应式**局部变量驱动同一断言时实测：**正确实现也返回 `[false,false,false]`**（非响应式变量不触发 computed 失效），此时用例会**误红正确实现**；只有读 `route.meta` / `ref` 等 reactive 源时正确实现才翻转、快照实现才被拦截。设计 `:53` 的「传入 `() => route.meta?.zen === 'locked'` 形态的 thunk，令其返回 `false → true → false`」已隐含 route-like 语义，但**未把"必须 reactive"写成硬前提**。建议 P3 落为一句显式约束（推荐直接用 `reactive` 对象模拟 `route.meta`），以免翻转用例退化为"两类实现都红"的无效断言。**性质：判据精度，非闭环缺口**（最坏结果是误红，不是假绿）。
2. **`:688` 的 `files_to_read` 理由仍写"决定 mock 是否需补 meta"** —— 措辞停留在"待决定"语气，而 `:69-72` 已**显式定案**为"无需改动、不进 M 栏"。建议把该 `why` 改为"已定案：thunk 形态下 mock 无需补 `meta`（§1.1）"，避免 P4 重复决策。
3. **`:97`（N14）引用的 300 行上限 spec 路径有误**：写作 `frontend-v3/src/components/__tests__/t082-error-format.spec.ts:9-16`，**实际文件在** `frontend-v3/src/components/t082-error-format.spec.ts`（**无 `__tests__/` 层**）。行号 `:9-16` 与断言内容（`lineCount < 300`）**均实测正确**，仅目录层级偏差；因该文件不在 `files_to_read` 内，影响限于 N14 的导航可读性。建议更正路径。
4. **`:98`（N13）的"属既有 DEBT"未具名** —— 虽**不构成** DEBT0012 归属（判据仍合规），但在 `viewer.spec.ts` 语境下易被后续读者就近读成 DEBT0012。建议改为"归属 TPV0097/TPV0098（§6.3），**非** DEBT0012"，与其余 6 处的显式对照保持一致。

**上一轮 5 条非阻塞项已全部被处理**（抽查确认，非重审）：双 project viewport 钉定 → `:503` 已升为硬约束；`firstFileId=43` 硬编码 → `:711` 已改动态解析；300 行上限登记 → `:97`（N14，路径有误见上）；`P5_lint` 覆盖面描述 → `:533` 已澄清"只覆盖后端"；`P5_timeout_seconds` 档位 → `:524` 已登记 `node_modules` 前提（档位有意不改，理由充分）。

**仍待主 Agent 动作的悬挂项 1 条**（非 architect 可闭合）：`§6.5` 验证执行约束 + BDD-16 人工体验路径须**真正进入 P6 dispatch-context**（设计 `:717`、`:728` 自标"待主 Agent 确认"）。本轮设计侧已如实声明，我在此保留登记以免移交中掉线。

---

## 6. 债务与残留（如实登记）

- 上一轮我建议的产品侧债（zen 隐藏集不含 archived/expired banner）**已由主 Agent 登记为本项目 `DEBT0013`**（`debt/tech-debt.md:307-310`，采本项目登记簿自增连续性、未采纳我建议的 `DEBT0014`，理由已在 `:330` 记录）。**编号分歧不影响条目内容**，我撤回编号建议、以已登记条目为准。
- 本次 E2E 类红灯 **不新立债务条目、不归 DEBT0012** 的处置，与登记簿 `:300` 口径一致，无需我再提。
- **副作用与残留（如实登记）**：本轮探针曾写入 `frontend-v3/.agate-tsprobe/`，因 `vitest.config.ts` **未设 `include`**（仅设 `exclude: ['e2e/**','node_modules/**']`，实测 `vitest.config.ts:10`）而落入 vitest 默认收集面，并一度把全量套件抬成 `Test Files 5 failed | 110 passed (115)`（其中 1 个文件在写入中途被主 Agent 读到，报 `Failed to load url`）。**该目录已整体删除**，删除后复查 `git status --porcelain frontend-v3/` **为空**、`frontend-v3/` 下无 `probe` 残留，并**复跑全量套件确认基线已恢复**：`Test Files 110 passed (110)` / `Tests 1343 passed | 4 skipped (1347)`，exit 0。后续如仍需探针，落 `.agate-tmp/` 或不带 `.spec.`/`.test.` 的命名。
- 全程未跑 `uvicorn` / `make debug` / `npm run dev`；未触碰 `:8080` 与 `~/.peekview/`；未修改任何被评文件（只审不写）。

---

## 7. 结论

**Header status（终态）：`approved`**

**阻塞级问题数：0**

| 项 | 终态 |
|---|---|
| 验证点 1（BLOCKER-2：M2/M3 与既有测试/类型契约自洽 + 形态唯一化） | **闭环**。形态已唯一化：`locked: () => boolean` + 调用点传 thunk + 内部 `locked()` + 无 `updateZenAria`；第三个"不报错假绿读法"（`locked: boolean`）已被 `:77` **显式禁止**，且经我实证确认——该读法**确实能同时通过** `make typecheck` 与 `make test-frontend`（故"没有报错"不足以禁止它），而 **M9 的翻转用例对 reactive 源确有判别力**（正确实现翻转、快照实现恒 `true`），构成有效可执行拦截。`route.meta` 访问方式二选一**已显式定案**（`:69`"不留待决定"），既有两处 mock 经独立挂载探针确认无需改动 |
| 验证点 2（BLOCKER-1：BDD-10 认证配对） | **闭环**。五步认证配对与要求逐项相符；"匿名创建 + 匿名删除"措辞**仅存于禁止性论证**；清理判据落在"alice 复查 `raw`=404"这一结果上；**区分力判据**（三者互异）已独立成节；`files_to_read` 已补 2 条 share 范本，锚点经源码复核准确 |
| 验证点 3（`viewer.spec.ts` 归属措辞跨文件一致性） | **闭环**。`DEBT0012` 全文 6 处命中**全部**为"不归 DEBT0012"的对照性表述，零处归属；与 `debt/tech-debt.md:300`（"勿据此关账 DEBT0012" + 归属 TPV0097/TPV0098）**跨文件一致**；§6.3 三条实质结论一字未动 |
| 未回退抽查 | **全部未回退**（4 E2E 键定向 / 无裸调用 / 无 `&&` / 900s / Makefile target 实存 / 16+3=19 无缺号 / `dispatch_plan` 合法 / 四字段齐全 / M9 与 `P3`/`P5` 键形态未变）；真实 `agate-read-gate-commands.py` exit 0 |

**二值判定说明**：两处阻塞项均已**由定点修订实际闭合**，且闭合方式不是"让报错消失"，而是"**规格唯一化 + 由已固化 gate 键承担拦截**"——这正是我上一轮要求而本轮设计已做到的事。**故给出 `approved`，无阻塞级问题。** 非阻塞项 4 条（§5）建议 P3/P4 顺手收敛，不构成退回理由；其中第 1 条（M9 须读 reactive 源）最值得在 P3 落为显式约束。

`[PROD_NOT_TOUCHED]`
