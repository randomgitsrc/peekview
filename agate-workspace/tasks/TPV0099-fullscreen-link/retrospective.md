---
task_id: TPV0099
mechanism_issues:
  - "check-scope-resolved.py 对粗体包裹的行首 SCOPE+ 不可见致真空早退，且 check-gate.py 不调用它 → P7 gate 通过 ≠ SCOPE+ 被校验过（DEBT0015）"
  - "check-p6-provenance.py 剥离 frontmatter 用 --- 逐对配对，奇数个 --- 时末个吞掉其后至 EOF → 审计 2 对尾部行漏检、同一违规因位置不同判定相反（DEBT0016）"
  - "agate 内置 assets/formatters/vitest.sh 用环境变量传全量测试输出，超 MAX_ARG_STRLEN 致 formatter exit 126 → check-tdd-red.py 误判 A 类假红灯、CI backstop 会误判 P3 FAIL（DEBT0014）"
  - "make bump-version 的 Step 4 是 git add -A，会把工作区未忽略的临时目录（含明文凭证）扫进 release commit；协议未就 release 提交前的暂存面做任何防护或提示"
  - "retries 账本归属规则（评审失败记哪一阶段）在协议中无显式示例，导致主 Agent 一虚增（P3）一漏记（P4），虚增项触发假 PAUSED"
execution_issues:
  - "P2→P3 的 retry 归属记错：把「已被 P4 消费的 P3 产出」的失败记到 retries.P3、漏记 P4，属对既有规则（review 与 gate 共享该阶段预算）的理解偏差"
  - "P1 阶段漏写 [SCOPE_RESOLVED] 标记（协议明文要求主 Agent 在产出含 [SCOPE+] 时增补），直到 P7 由 consistency-reviewer 发现"
  - "两轮派发产物自违其规：P6-dispatch-context 的格式样例落在 CARD 块外触发 provenance 审计 2；P6.5-dispatch-context 的『禁止读取』清单写在被扫描的两节内、自身触发黑名单 5 处命中"
  - "P7 完成时更新 active-tasks.md 的写入未落地（替换目标串不匹配、静默未生效），看板滞后一阶段到 P8 才发现"
feedback_ready: true
---

# TPV0099 复盘 — 全屏模式链接 `/{slug}/f`

> 本复盘按 `retrospective-template.md` 结构撰写。触发理由：本任务发现 **4 条机制缺口**（其中 1 条为高危安全面）+ 多次"验证声明需要被验证"的实例，属"发现机制缺口 + 高价值任务"。

## 一、事实基线

| 项 | 值 |
|---|---|
| 任务编号 | TPV0099（fullscreen-link） |
| 立项 → READY | 2026-09-16 → 2026-09-29（实际编码工作集中在 09-28 ~ 09-29） |
| 本任务 commit 数 | **11**（立项 + P1~P8 + P6.5 + READY 收尾） |
| 发布版本 | **0.24.1 → 0.25.0**（`bump_type: minor`），commit `c23efabd` + tag `v0.25.0` |
| BDD 总数 | **19**（P1 定稿，经 3 轮独立评审闭合） |
| 产品代码改动 | **4 文件 / +238 −14**（`useZenMode.ts` / `router.ts` / `EntryDetailView.vue` + 1） |
| 全部改动（含测试/文档） | 12 文件 / +1326 −18 |
| gate_run 次数 | **13**（其中 exit 1 两次：P1、P2 各一次——均为评审 needs-revision 导致，**非实现缺陷**） |
| retries 账本 | `P1: 2` / `P2: 1` / `P4: 1`（**P3 归 0**，见问题 5） |
| 新增技术债 | **4 条**：DEBT0013（产品，open）/ DEBT0014·0015·0016（均 `category: protocol`，open） |
| 生产触碰 | **`[PROD_NOT_TOUCHED]`** —— 全程仅用 debug `:8888` + Chrome CDP `:18800` |

**阶段级评审轮次**：P1 三轮（16 BDD → 8 必修 → 19 BDD → 1 必修 → approved）；P2 两轮（双评审 needs-revision/rejected → 定点修订 → 双复审 approved）；P4 两轮（design-review needs-revision → 测试缺陷修正 → 复审 approved）；P6.5 judge 一轮 passed 19/19；P7 两轮（BLOCKER=1 → 补标记 → 复审 approved）。

## 二、做得好的 + 可复用模式

**A. 「先验证验证工具，再采信结论」——本任务被反复证明是唯一可靠的结构**
本任务累计出现 **11 次**「验证声明需要被验证」的同族实例。凡最终被纠正的，都是靠**独立复现**（而非自述核对）：
- P2 eng-review 对假绿变体 ③ 分四步**先证明工具有判别力**（`locked: boolean` 变体实测 typecheck exit 0 + vitest 3 passed → 证实"没报错"不足以禁止它；再以反例证明探针方向正确），才给结论
- P6.5 judge 独立复算 BDD-3 的三态命中（state2 的 3 个命中确认为 `.entry-detail` 后代 → 反证 A/B 两组不可统一）
- P7 reviewer 用 **4 状态临时副本矩阵**（A 原样/ B 行首形态+有标记/ C 仅移除标记/ D 还原）证明 `check-scope-resolved.py` 对本例**有区分力**，B 的 exit 0 才是真通过
→ **去向：①回馈 agate**（见「## agate 反馈」F-1）

**B. 「判据必须有负向对照，仅验正例不算通过」**
本任务最有价值的判据设计与验证都遵循这一条：
- BDD-3 的 A/B 不对称排除集 + **三态负向对照闭环 0/3/1**（P1 rev2 设计，P4/P6/judge 三方各自复现）
- BDD-10 的**三态区分力** `[false,false,true]`（三者必须互异，否则退化为恒真假绿）
- M9 单测对"thunk 签名 + setup 期快照"隐蔽变体的拦截力
→ **去向：①回馈 agate**（见 F-2）

**C. 派发前把「机械校验的实现」读一遍，再把硬约束写进指令**
主 Agent 在 P7/P8 派发前先读 `check-gate.py` 的 `gate_p7`/`gate_p8` 实现，把硬校验（`design_gap_reviewed_count >= design_gap_count`、P4/P7 转抄交叉核对、`debt_check` 字段存在性）**前置写进 dispatch-context**，避免了 subagent 因格式不合规而白跑一轮。P8 更把「releaser 只产出文件、不执行 bump/commit/tag」与「`check-changelog` 会因未归版而报错属预期中间态、不得为凑绿灯改 CHANGELOG」一并写入。
→ **去向：①回馈 agate**（见 F-3）

**D. 交接清单驱动收尾（releaser→主 Agent）**
P8 的「临时资源清单」让主 Agent 收尾有据可依，且**明确区分"应清理"与"不应动"**（如 Chrome CDP `:18800` 属外部既有服务）。这次清单直接促成了 READY 阶段发现"`make debug-stop` 报成功但端口仍监听"的真问题。
→ **去向：②项目资产沉淀**，位置：`agate-workspace/agents/project.md`（补记"debug 服务持有者 = 挂它的 keepalive job；`/tmp` 为 per-call tmpfs 故 pidfile 不可见"）

**E. 本任务产生的可沉淀脚本/经验**
- **探针落位纪律**：所有临时探针落 `.agate-tmp/`（`frontend-v3/` 下曾因探针被 vitest 默认收集面扫入而把基线从 110 抬到 115 files）
- **P5/P6 跑 E2E 的前置**：`make build-frontend-fast`（`e2e-safety-check.sh` 的 Check 6 会 FATAL）
- **E2E 键必须 `E2E_SPEC=` 定向**：裸 `make debug-test` 只跑 1 个无关 spec
→ **去向：②项目资产沉淀**，位置：`agate-workspace/agents/project.md`（上述三条已有部分记载，本次补充"探针落位"与"`/entries` 的 `limit` 参数不生效、须用 `per_page`"）

## 三、发现的问题

### 问题 1（机制缺口）：`check-scope-resolved.py` 真空早退 + 无人调用
- **归因层面: 机制缺口**
- 说明：`SCOPE_PLUS_RE` 只匹配行首 `[SCOPE+]`，产出用粗体 `**[SCOPE+]**`（常见写法）即匹配不到 → `scope_found` 为空 → **早退 exit 0，从未进入 `[SCOPE_RESOLVED]` 判定**。且 `check-gate.py` **根本不调用它**（`grep -c` = 0；真实调用方 `pre-commit-gate.py:439` 还带 `if gate_exit != 1` 前置）。
- **后果**：主 Agent 把该 exit 0 引作"SCOPE+ 已闭环"的证据，**被 P7 reviewer 用 4 状态矩阵推翻**；P1 的实际标记缺失直到 P7 才被人发现。已登记 **DEBT0015**。

### 问题 2（机制缺口）：`check-p6-provenance.py` 的 `---` 奇数配对吞尾
- **归因层面: 机制缺口**
- 说明：剥离 frontmatter 用"遇 `---` 向后找下一个 `---`"的逐对逻辑；**奇数个 `---` 时最后一个会吞掉其后至 EOF**。本任务该文件剥离 CARD 后剩 9 个 `---`（奇数）→ 尾部 38 行不参与审计 2。
- **后果**：主 Agent 反向对照实证——**同一违规行放被吞区间 exit 0（漏检）、放存活区间 exit 1（检出）**，判定非确定性。本任务未因此出错（被吞区间行首判定词命中 0）。已登记 **DEBT0016**。

### 问题 3（机制缺口）：内置 vitest formatter 的环境变量传输出上限
- **归因层面: 机制缺口**
- 说明：内置 `assets/formatters/vitest.sh` 用 `export OUTPUT` 传全量输出；本仓前端输出 ~1.5MB **超 `MAX_ARG_STRLEN`（131072）11.5×** → formatter exit 126 → 回退 `raw_output` → 命中 `check-tdd-red.py` 的 `matching` 分支 → **误判 A 类假红灯**。CI backstop 对 `tdd_exit == 1` 判 FAIL。
- **后果**：影响本仓另 4 个任务 + 未来所有前端任务；本任务以任务级 formatter 规避。已登记 **DEBT0014**。

### 问题 4（机制缺口，**高危安全面**）：`bump-version` 的 `git add -A` 无暂存面防护
- **归因层面: 机制缺口**
- 说明：`make bump-version` 的 Step 4 是 `git add -A`（`Makefile:265`）。本任务工作区有未被忽略的 `.agate-tmp/`（**76MB，含 10 个明文 token/cookie**）→ 实测 `git add -A --dry-run` 会 stage **162 条路径，其中 158 条在 `.agate-tmp/` 下**。
- **后果**：**若不处置，release commit 会把明文凭证写进 git 历史**。本任务已在 `.gitignore` 新增 `.agate-tmp/`（staged 162→5）并确认历史上从未入库。**协议层对此无任何防护或提示**（`bump-version` 直接 `git add -A`，无"提交前检查暂存面"步骤）。

### 问题 5（执行错误）：retry 账本归属记错（一虚增一漏记）
- **归因层面: 执行错误**
- 说明：把「**已被 P4 消费的 P3 产出**」的失败记入 `retries.P3`（2 条），同时**漏记 P4 的真实评审失败**（1 条）。按规则（`state-machine.md:611`「每次某阶段门槛失败」+ P4 卡「review 与 gate 共享该阶段预算」），应记 P4、P3 归 0。
- **后果**：虚增的 `P3=2` 恰好触达 `P3` cap=2 → pre-commit 报 **`P3=2 (MAX=2)，phase 应为 PAUSED`**、commit 被硬阻断。**该 gate 是有效的**——反过来说，若当时"图方便少记"，P4 的漏记就不会被发现。
- **协议层缺口**：该归属规则**无显式示例**（力导向型判断），故同时列入机制缺口清单。

### 问题 6（执行错误）：P1 漏写 `[SCOPE_RESOLVED]` 标记
- **归因层面: 执行错误**（协议明文要求"产出含 `[SCOPE+]` 时主 Agent **必须**在 P1 增补对应标记"，本次未做）
- **后果**：P7 gate **exit 1**（`BLOCKER=1`），由 consistency-reviewer 发现后才补齐。**注**：该问题的暴露恰恰依赖 reviewer 独立复核——若只看 `check-scope-resolved.py` 的 exit 0，会误判为"已闭环"（见问题 1）。

### 问题 7（执行错误）：两轮派发产物「自违其规」
- **归因层面: 执行错误**
- 说明：① `P6-dispatch-context-verifier.md` 的格式样例（行首 `- PASS`）落在 AGATE_CARD 块**之外** → 触发 `check-p6-provenance.py` 审计 2，P6 provenance **exit 1**；② `P6.5-dispatch-context-judge.md` 的「禁止读取」清单写在**被扫描的两节之内** → 自身触发黑名单 **5 处命中**（`check-gate P6.5` 本会必然 exit 1）。
- **后果**：两处均在**派发前自测**时被主 Agent 抓到（读源码确认扫描面 + 调脚本内部函数自测），未造成 subagent 白跑。**共性**：为满足机制的精神，反而违反了它的字面实现。

### 问题 8（执行错误）：看板写入静默未生效
- **归因层面: 执行错误**
- 说明：P7 完成时更新 `active-tasks.md` 的替换目标串与实际行不匹配，脚本 `assert` 通过但**目标行未改**，看板滞留在 `P6✅`，到 P8 才发现。
- **后果**：无功能影响，但暴露"以脚本 exit 0 代替回读验证"的习惯缺陷。

## 四、改进措施

| # | 措施 | 落点 |
|---|---|---|
| 1 | 修 `SCOPE_PLUS_RE` 以覆盖粗体/引用等常见包裹形态；早退分支输出显式 stderr 提示（区分"未检出"与"已闭环"）；明确纳入 `check-gate.py P7` | agate 上游（DEBT0015）；本任务不改协议本体 |
| 2 | 剥离 frontmatter 改为**只剥离文件顶部第一对 `---`**，找不到闭合对时不删除并告警；或剥离后校验行数守恒 | agate 上游（DEBT0016） |
| 3 | 内置 vitest formatter 改为经临时文件传输出（`TMP=$(mktemp); cat > "$TMP"; python3 - "$TMP"`） | agate 上游（DEBT0014）；本项目已以任务级 formatter 规避 |
| 4 | **`bump-version` 提交前增加暂存面检查**：`git add -A` 后校验 `git diff --cached --name-only` 不含未忽略的临时/敏感路径（或改为按路径白名单 `git add`） | agate 上游（建议新登记 DEBT）；**本项目已加 `.gitignore: .agate-tmp/`** |
| 5 | 在协议中补 **retries 归属的显式示例**（"评审失败记被评审阶段"正反例各一） | agate 上游（建议新登记 DEBT 或并入 F-4） |
| 6 | 派发模板：格式样例**一律放进 AGATE_CARD 块内**或改写为不含行首判定词的形态；"禁止清单"用**原则性表述**（"白名单之外一律不读"）而非逐条枚举 | 本项目 `agate-workspace/agents/project.md` + agate 上游模板 |
| 7 | 写入类操作（看板/state/文档）后**必须回读目标行验证**，不以脚本 exit 0 代替 | 本项目 `agate-workspace/agents/project.md` |

## 技术债登记核对清单

| 机制 | 应该触发？ | 实际触发？ | 未触发后果 | 原因 |
|------|-----------|-----------|-----------|------|
| retry 记录 | 是 | ✅ | —— | 首轮记账有误（问题 5），经 gate 阻断后按证据修正为 P1:2/P2:1/P4:1 |
| PAUSED | 是（曾触发假 PAUSED） | ✅ | commit 被硬阻断一次，修正账本后解除 | 主 Agent 记账错误（执行错误），gate 工作正常 |
| PROD_TOUCHED | 否 | — | —— | 全程 `[PROD_NOT_TOUCHED]` |
| SCOPE+ | 是（P2 识别 banner 遗漏面） | ✅ | —— | P2 §1.3 R-04 / §10 遗留表登记 |
| SCOPE_RESOLVED | 是 | ✅（P7 补） | P7 gate exit 1（BLOCKER=1） | 执行错误：P1 阶段漏写，P7 由 reviewer 发现后补齐 |
| DESIGN_GAP | 是（P4 两条测试缺陷） | ✅ | —— | P4 §8 声明 2 条，按协议"标 gap 而非改测试" |
| DESIGN_GAP_REVIEWED | 是 | ✅ | —— | P7 逐条转抄 + 配对，`design_gap_count=reviewed_count=2` |
| NEED_CONFIRM | 否 | — | —— | P1 `[NO_NEED_CONFIRM]`；三决策 P0 已锁定 |
| CAPABILITY_GAP | 否 | — | —— | 视觉能力 `available`（vision-engine 实调成功） |
| gate 验证（每阶段） | 是 | ✅ | —— | P0-P8 各阶段主 Agent 亲跑；13 次 gate_run |
| 阶段产出文件（每阶段） | 是 | ✅ | —— | P0-P8 + P6.5 产出齐备 |
| .state.yaml phase 同步 | 是 | ✅ | —— | 由 `agate-next.py` 机械推进，`check-state-transition.py` 复验 |
| 裁剪条件 + override | 否 | — | —— | P1 §7 声明全 8 阶段不裁 |
| capability_requirements | 是 | ✅ | —— | P1 §6.1 声明 browser-visual-verification = available |
| 分阶段落盘（防 subagent 空返回） | 是 | ✅ | —— | 各阶段 progress 文件（P2/P3/P4/P5/P6 均有） |
| phase-产出一致性 | 是 | ✅ | —— | pre-commit 输出 `phase=P3 但暂存了代码文件` 等 WARNING 均属预期（P3 产出即测试代码） |
| P6 evidence（含截图 + 引用 + vision YAML） | 是 | ✅ | —— | 52 文件 / 1.5MB；14 截图 md5 唯一；`vision-reports/` 14 份 blocker_count=0 |
| P2 候选方案 + 权衡（≥2） | 是 | ✅ | —— | 3 候选（thunk computed / watch / setup ref），含实跑淘汰依据 |
| P8 internal_only_reason | 否 | — | —— | 本任务有发布动作（minor bump），非 internal_only |
| dispatch-context.md | 是 | ✅ | —— | 全部派发均有对应 dispatch-context（含 rev 轮） |
| pre-commit hook（gate / 状态转移 / 裁剪） | 是 | ✅ | —— | 多次实际拦截（P2 缺 review、P3 假 PAUSED、provenance、scope-resolved） |
| CI backstop | 是 | —（未 push） | 未 push 故未触发；但已识别 DEBT0014 会让 CI 误判 P3 FAIL | 本任务未执行 `git push`（P8 卡：推送由人手动触发） |
| **技术债登记** | 是 | ✅ | —— | **DEBT0013**（产品，open）/ **DEBT0014**·**DEBT0015**·**DEBT0016**（均 protocol，open）；另有 1 条建议新登记（`bump-version` 的 `git add -A` 暂存面防护），已在本复盘改进措施 4 中给出落点 |

## agate 反馈

> 以下条目归因到 agate 机制/执行层面，供 `agate-feedback.py` 提取。

**F-1（机制缺口，高价值）：需要"验证器有效性自检"的机制化提示**
本任务 11 次"验证声明需要被验证"中，绝大多数是**验证器自身的跳过分支与通过分支在 exit code 上不可区分**（真空通过）。典型案例：`check-scope-resolved.py` 的 `if not scope_found: sys.exit(0)` 早退；`verify-wheel` 校验 wheel **内部自洽**（而非与当前源码同步）故对旧 wheel 也 exit 0。
→ **建议**：协议可为"引用了某脚本 exit 0 作为某机制闭环证据"的场合，要求附一句"该 exit 0 在何种前提下成立"（或要求做一次反向对照）。当前 `check-*.py` 的多数脚本缺"跳过原因"的显式输出，使 exit 0 承载了两种互斥语义。

**F-2（可复用模式）：负向对照应作为判据设计的默认要求**
P1 卡与 P3 卡的"测试设计指导"已提到覆盖前置状态，但**未要求"判据必须能对失败态给出相反结论"**。本任务正是靠这条抓出两次判据失效（BDD-3 先恒假、修完恒真）与一次未报错的假绿变体。
→ **建议**：在 P1/P3 卡"判据"相关节显式要求——凡"集合为空/元素不存在"型断言，须附负向对照或说明为何不恒真（本任务 P3 已自发产出 11 条负向对照表，可作范例）。

**F-3（可复用模式）：派发前读"机械校验实现"并把硬校验前置写入 dispatch-context**
本任务在 P7/P8 这样做，避免了因格式不合规而白跑。当前 `dispatch-protocol.md` 要求 dispatch-context 含"客观查证信息"，但**未提示"应查阅目标阶段的 gate 脚本实现"**。
→ **建议**：在 dispatch-protocol 的派发检查清单中加一条"目标阶段 gate 的机器字段与格式要求（从 `check-gate.py` 对应分支读取）"。

**F-4（机制缺口）：`retries` 归属规则缺显式示例**
`state-machine.md` 定义了"每次某阶段门槛失败"与"review 与 gate 共享该阶段预算"，但**无归属示例**，本任务因此出现"一虚增一漏记"。虽然 gate 最终抓到了，但抓到的路径是"虚增触顶"这一偶然现象。
→ **建议**：补正反例各一（如"P4 评审 rejected → 记 retries.P4"；"P3 产出被 P4 消费后发现缺陷 → 仍记 P4，不记 P3"）。

**F-5（机制缺口，安全面，建议最高优先级）：`bump-version` 的 `git add -A` 需提交前防护**
`make bump-version` 直接 `git add -A`。任何未被 `.gitignore` 覆盖的临时目录（探针/日志/凭证）都会进入 release commit。本任务实测会 stage 158 个 `.agate-tmp/` 路径、含 10 个明文 token/cookie。
→ **建议**：① 模板层为项目 `.gitignore` 预置常见的 agent 临时目录（如 `.agate-tmp/`）② `bump-version` 在 `git add -A` 后、`git commit` 前加一步"暂存面审查"（列出 `git diff --cached --name-only` 中非预期路径并要求确认，或改为按白名单 `git add`）。
