# P1-dispatch-context-analyst-rev1 — TPV0099（修订轮）

---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: analyst
retry: 1
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P1

路径：phase-cards/P1-requirements.md
---
# P1 — 需求基线

> 当前状态：[首次 / 重试 #N]
> P1 不可裁剪（核心阶段）

## 如果是首次进入本阶段

1. 派发 analyst subagent → 产出 P1-requirements.md
   1.1 写 P1-dispatch-context-analyst.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 确认：BDD 验收条件 ≥1 条 + 无未决 NEED_CONFIRM
2.5 派发 requirements-review subagent（角色文件：{agate_root}/assets/review-roles/requirements-review.md）
     2.5.1 写 P1-dispatch-context-requirements-review.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
    输入：P1-requirements.md
    产出：P1-review.md（agent≠main，含 BDD 编号引用 + 覆盖维度标注）
    review 不通过 → analyst 修改 → 再 review → … → approved（⑩迭代循环）
3. 预跑 check-gate.py P1（exit 2，主 Agent 自判）
4. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P1，不要提前写 P2——phase = 本 commit 的产出阶段
5. git commit -m "wf({Txxx}-P1): {摘要}"（phase=P1，P1 产出含 P1-requirements.md + P1-review.md）
6. P1 commit 完成后进入 P2：**phase 推进 P2 随 P2 产出 commit 一起**（P2-design.md + P2-review.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（BDD 不完整 / domains 声明错 / NEED_CONFIRM 未处理）
→ review 不通过时：analyst 修改需求 → 重派 requirements-review → 共享 retry 预算
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P1 MAX=3）

## 前置条件

- [ ] P0-brief.md 完成（四字段齐全）

## 派发

- **角色**：analyst（`{agate_root}/assets/execution-roles/analyst.md`）
- **输入**：P0-brief.md（env_constraints / known_risks / executor_env）
- **输出**：P1-requirements.md
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 复杂需求编排（模式 4，条件触发）

需求复杂（多来源 / 多模块 / 无法预先拆清范围）时，P1 可先派**侦察 subagent**（模式 4 先理解后拆，见 dispatch-protocol「派发编排机制」）读全貌后再拆需求：

1. 侦察 subagent 读 P0-brief + 相关上下文，产出拆分方案（拆成哪些子需求、各子需求的输入/产出/依赖）
2. 按方案派 analyst（并行或串行）分别产出需求基线
3. 合并时定义**合并语义**（在侦察产出中声明，P7 一致性检查依赖）：
   - **BDD 全局编号**：各子需求承接的 BDD 编号全局唯一（`#### BDD-NN:`），不允许各子需求各自从 1 编号
   - **包归属去重**：每个 BDD 明确归属唯一包，跨包的共享件单独列出，不允许两个子需求各写一份

## 产出规格

P1-requirements.md 必须包含：
- BDD 验收条件（至少 1 条，Given/When/Then 格式）
- `domains:` 声明（backend / frontend / mcp / security）
- `packages:` 声明（受影响的包/模块）
- `risk_level:` 声明（low / medium / high）→ 决定 P2 评审强度
- `ceremony:` 声明（thin / standard / full）→ 仪式深度档位（可选，缺省 standard，fail-closed：不声明或声明要素不满足一律按 standard 处理，不做薄化）
- `phases:` 裁剪声明（跳过哪些阶段 + 理由）
- `judge:` 启用声明（RM-AG0039 强制）：机制后新任务（P1 `created` ≥ `judge_required_since`，见 `agate/rules/dispatch.yaml`）P1 初始化须在 `.state.yaml` 写 `judge.enabled: true`——check-gate P1 机械校验（缺失/未启用 → exit 1）；历史任务（created < 截止或未声明）缺块 → 跳过
- `capability_requirements:` 能力需求声明（available / supplementable / GAP 三态）
- 无未决 `[NEED_CONFIRM]`（有则 PAUSED）；无待确认项时写 `[NO_NEED_CONFIRM]`

`risk_level`/`phases`/`packages`/`domains` 写在文件头 **frontmatter**（`---` 分隔块），不写正文。
**可直接复制的完整样例**：
```yaml
---
phase: P1
task_id: TAG0001           # 替换为实际任务编号
type: problems
parent: P0-brief.md
trace_id: T001-P1-20260101 # {task_id}-P1-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low             # low / medium / high，必填
ceremony: standard          # thin / standard / full，可选；缺省 standard（fail-closed）
phases: [P1, P4, P5, P6, P8]   # list of P\d+，必填
packages: [pkg-a]           # list，必填
domains: [backend, frontend]  # list，必填
# 可选字段：override / implicit_coupling / coupling_checklist / internal_only /
# internal_only_reason / 跳过风险 / design_trivial / follows_existing_pattern
# ── RM-AG0039 judge 启用声明（写在 .state.yaml，非 P1 frontmatter）──
# 机制后新任务（P1 created ≥ judge_required_since，rules/dispatch.yaml "2026-08-22"）必须
# 在 .state.yaml 写 judge.enabled: true——check-gate P1 机械校验，缺失/未启用 → exit 1
# ── v2.0 refactor 任务类型声明（可选，缺省 = 功能任务）──
# change_type: refactor   # 当前仅支持 refactor；枚举非法值由 frontmatter schema 拦截
# ── TAG0007 项目阶段声明（可选，缺省 = established，向后兼容）──
# project_phase: bootstrap   # bootstrap（0→1 新项目）/ established（既有项目，缺省值）；
#                             # bootstrap 时 P2 architect 需额外产出 P2-skeleton.md（骨架声明）
# ── TAG0006 UI/UX 渲染形态声明（可选，presence 语义：缺失 = 常规布局型默认，不红基线）──
# ui_render_shape: render_component   # str，规范形态值：layout（布局型）/ render_component
#                                     # （渲染组件型，仅举例 OpenGL/WebGL/Canvas/图表/模型/特效/
#                                     #  地图/数字地球）/ temporal_effects（时序特效型）；开放集合可扩
# ui_ux_dimensions: [渲染正确性, 动效时序]  # list，从 UX 分类框架选适用维度；渲染组件/时序特效
#                                     # 类形态必填，常规布局型可省略
# ── v2.0 标记"已解决/已确认"状态（可选，仅标记存在时写）──
# need_confirm_resolved: []   # list[str]：已解决的 NEED_CONFIRM 项描述（逐条匹配正文）
# suggest_resolved: []        # list[str]：已采纳的 SUGGEST 项描述
# scope_resolved: []          # list[str]：已解决的 SCOPE+ 项描述
---
```

**UX 类别 BDD 与分类框架（domains 含 frontend 时必做）**：frontend 任务的 P1 必须含至少一条
UX 类别 BDD，并按实际 UI/渲染形态声明 `ui_render_shape` + 从 **UX 分类框架**（布局结构/
渲染正确性/交互行为/动效时序/视觉呈现等示例性开放集合）选 `ui_ux_dimensions` 维度，类别写入
BDD 标题后缀（如 `#### BDD-3: 渲染正确性：...`）。判据必须可量化（渲染正确性 → 渲染结果对比 +
diff 阈值或输出断言；时序 → 帧/时间戳对齐；动效 → 过渡/动画关键帧与结束状态断言；手势交互 →
动作输入的坐标/参数量化），禁主观词。缺失形态声明/维度选择/UX BDD → requirements-review 打回，
P1 gate 在"声明了形态但维度为空"或"维度不在分类框架且未在 BDD 标题声明"时 exit 1。

**人工体验路径验收（强制节）**：任务产出含**用户可见页面**且**页面内容受 seed 数据影响**时，
P1 必须追加一条**人工体验** BDD，句式强制为「Given seed 数据 → 页面有内容」（验证用户按文档 seed 后
页面在人工体验路径下确实渲染出内容）；不得只用 fixture 或单测断言替代人工体验路径验收。

**NEED_CONFIRM 分级**：
- `[SUGGEST: 推荐 X，理由 Y]` - 有倾向但求确认。主 Agent 可自行采纳倾向（除非涉及破坏性变更/业务方向），不必问用户
- `[NEED_CONFIRM]` - 真无方向需人定夺。阻塞推进，主 Agent 问用户

## ceremony fail-closed 声明 checklist（TAG0019，BDD-7/8/9）

`ceremony:` 声明仪式深度档位（thin / standard / full），缺省 standard（fail-closed——不声明或声明要素不满足一律按 standard 处理）。声明 **thin**（薄仪式）时，P1 必须连同以下四要素一起声明，缺一 → check-routing exit 1，档位回退 standard：

1. **申请**：`ceremony: thin` 显式声明
2. **逐信号 checklist**：`coupling_checklist: [...]` 流式声明（判据 `^coupling_checklist:\s*\[`，复用 check-pruning）
3. **跳过风险评估**：`跳过风险:` 声明（复用 check-pruning 判据）
4. **P5/P6 保留**：`phases` 含 P5 与 P6（薄化仪式不薄化验证，P5/P6 由 check-routing / check-pruning 双闸兜底）

不声明（存量/新任务缺 ceremony 字段）→ standard，不拦截。`ceremony: full` 的任务 `phases` 必须含 P7（P7 不可裁，缺失由 requirements-review 审声明拦截，BDD-14）。

### M3 验收锚度量协议（BDD-12，机制文档供提取）

thin 档跳过 LLM 评审的 M3 验收锚四要素：

1. **评审轮数**指标：任务在 P2/P4 阶段派发的 LLM 评审 subagent 轮数（含重试轮）
2. **真实发现数**指标：评审产出中被采纳或阻止了真实问题的条数（排除非阻塞建议、排除机械检查可抓项）
3. **TAG0018 基线值**：4 场 LLM 评审 ≈0 净收益（17 条非阻塞 + 1 条真实发现且机械检查可抓）
4. **不达标决策规则**：「LLM 评审真实发现 ≈ 0 且机械 gate 已覆盖 → 回滚 standard」

## 同类扫描（强制节）

需求基线必须含一次**同类扫描**结论——被报告的那一处几乎从来不是唯一的一处。P0 卡片的「同类/影响面预判」给出粗粒度量级，P1 在此基础上把清单做实：

1. **扫描动作**：对问题涉及的关键符号（函数名、字段名、配置键、协议节标题、错误文案）用 grep/rg 扫全仓，记录**命中数量 + 文件清单**
2. **逐条判定**：每个命中标"本次处理 / 本次不处理 + 理由"。本次不处理的同类实例要么进 roadmap，要么写清为何不构成同一问题
3. **回归拦截**：若同类问题未来还会新增（不是一次性修完的存量），需求里要声明拦截手段（新增测试 / gate 脚本 / 文档约定），并转成对应 BDD
4. **结论落盘**：扫描结论写进 P1-requirements.md 正文（不是只写在 progress 里）；即使结论是"已确认只此一处"也要显式写出，空白不算做过

同类扫描缺失 → requirements-review 打回（"只修被报告的那一处"是 agate 反复复发的反模式）。P2 的「影响面梳理」在本节结论上继续做候选方案级的影响域分析，三处（P0 预判 / P1 同类扫描 / P2 影响面梳理）同源、逐级细化，不重复劳动。

## verification_env vs supplementable 边界判断树

`capability_requirements` 三态（available / supplementable / GAP）和 `verification_env`（运行环境声明）经常被混用——TAG0009 的 11.7 小时就是把一个环境问题错标成 `supplementable` 导致的。P1 声明时按下面的判断树走：

```
先问：缺的是能力还是环境？
├─ 缺的是「agent 侧的能力」（看不见图 / 不会用某工具 / 没有某技能）
│   └─ 走 capability_requirements 三态：
│      ├─ 当前就有 ................................. available
│      ├─ 当前没有，但能通过派发子角色 / 注入 skill / 换工具补上 ... supplementable
│      │   （必须在需求里写清补充方式，否则等同 GAP）
│      └─ 当前没有且补不上 ......................... GAP（阻塞，PAUSED 交人工）
└─ 缺的是「运行环境」（服务没起 / 端口没通 / 数据库没建 / 依赖没装 / 平台不支持）
    └─ 走 verification_env 声明（不是 supplementable）：
       ├─ 环境可由主 Agent 用标准操作准备好 → P1 声明 verification_env，
       │   由主 Agent 按 dispatch-protocol.md「环境准备职责边界」统一准备
       └─ 环境本质不可得（权限/凭据/平台原生不支持）→ 这是不可重试类，
           按 dispatch-protocol.md「verification_env 失败处理协议」立即升级人工
```

**判别口诀**：换个更强的模型/角色就能做 → 能力问题（supplementable）；换谁来做都得先把服务起起来 → 环境问题（verification_env）。**把环境问题标成 `supplementable` 属于机制误用**，不算"环境故障"，不消耗验证轮次预算，应立即改正声明方式。

**环境验证轮次预算占位声明位**：声明了 `verification_env` 的任务，P1 需求里留一行轮次预算占位（默认止损轮次 = 2 轮，与阶段 `retries[Pn]` 独立计数），供 P5/P6 派发时由主 Agent 在 dispatch-context 中接续记录"当前第几轮 + 历次已排除假设"。数值与完整规则的权威定义在 dispatch-protocol.md「verification_env 失败处理协议」，本卡片不重写：

```yaml
verification_env: "debug server http://127.0.0.1:3001 + tests/fixtures/test.db"
verification_env_budget: "止损轮次 2（独立计数，不占 retries[P5]）；轮次追踪由主 Agent 在 dispatch-context 记录"
```

## P0-brief 时效性质疑

analyst 拿到 P0-brief 后不默认它仍然成立——立项与实际启动之间可能已经漂移（跨会话恢复、任务搁置后重启、从 PAUSED 恢复）。P1 阶段必须做一次时效性质疑，判据（严重 3 条 / 轻微 2 条）的权威定义见 P0 卡片「P0-brief 时效性自检（漂移判据）」，本节只定标记规则与处理方式：

**标记格式**（行首声明，一个漂移点一行，必须写出**具体漂移点**，不允许只写标记裸词）：

```
[P0_STALE: executor_env 声明的 CI 镜像已下线，当前实际跑在 ubuntu-24.04]
[P0_STALE: task 描述的 .sh 路线已全量 Python 化，目标方案本身不再成立]
```

**阻塞 / 记录二选一**（按漂移严重程度分流，不允许"既不阻塞也不记录"地含糊推进）：

| 漂移程度 | 处理 | 落盘 |
|---------|------|------|
| **严重**（命中 P0 卡判据 1-3 任一条） | **阻塞**：停止 P1，回 P0 重新立项 / 重做可行性分析 | P1-requirements.md 写 `[P0_STALE: 具体漂移点]` + 说明为何判定严重；主 Agent 按 PAUSED 或回 P0 流程处理 |
| **轻微**（不命中判据 1-3） | **记录**：更新 P0-brief 对应字段后继续 P1，不阻塞 | P1-requirements.md 写 `[P0_STALE: 具体漂移点]` + 已更新哪个字段 |
| 无间隔 / 已核对无漂移 | 继续 | 写一行"已核对 P0-brief 时效性，无漂移"，空白不算做过 |

## gate 规则

check-gate.py P1 → P1-review.md 存在 + status:approved + agent≠main + 含 BDD 编号锚点 → exit 2（BDD 编号格式为 `#### BDD-NN:`）；缺 P1-review.md / agent=main / 无锚点 → exit 1
P1 评审不可裁——所有任务都走独立 requirements-review，无例外

## 推进条件（全部满足才写 phase: P2）

- [ ] P1-requirements.md 含 BDD ≥1 条
- [ ] 含「同类扫描」结论（命中清单 + 逐条处理判定，"只此一处"也要写出）
- [ ] P0-brief 时效性已质疑：无漂移则记录已核对；有漂移则含 `[P0_STALE: 具体漂移点]` 且已按阻塞/记录二选一处理
- [ ] domains / packages / risk_level / phases 已声明
- [ ] 无 [NEED_CONFIRM] 标记
- [ ] 无 status: GAP（supplementable 不阻，GAP 阻）
- [ ] P1-review.md status: approved（agent≠main，含 BDD 编号锚点）

## 常见错误

1. **BDD 写成技术实现而非用户行为**：BDD 应该描述"用户能看到什么/系统应该做什么"，不是"调用哪个 API"
2. **domains 声明不全**：漏了某个受影响域 → P2 不派该域的评审 → 实现方向错误
3. **capability_requirements 漏声明**：P6 验收时才发现需要但不可用的能力 → 返工。**frontend 任务
   漏声明 vision 视觉能力条目（need 含 visual/vision）→ P1 gate exit 1 硬拦**（check-gate.py
   `_gate_p1_vision_capability`）；声明形态但漏选维度 / 形态声明与 UI/渲染形态不符 →
   同样 exit 1
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P2 设计依赖 domains + risk_level 决定评审角色
- P6 验收逐条对照 P1 的 BDD（PASS/FAIL 总数必须 ≥ P1 BDD 总数）
- P7 一致性检查依赖 packages 声明做跨文件交叉核对

## 评审

P1 评审通用必有（所有任务都走 requirements-review），P2/P4 评审是 C8 域触发（见 review-mapping.md）——二者在"是否通用"上不对称，仅在"独立 subagent、agent≠main"上类比。P1 评审不可裁剪。
review 不通过 → analyst 修改需求 → 再 review（⑩迭代循环），直至 approved。

> 完成 → 读 phase-cards/P2-design.md


## P1 基线保护

P1-requirements.md 是需求基线，后续阶段（P2-P8）不应直接修改。如需变更（如 P4 发现 BDD 矛盾需补充注释），必须：
1. 主 Agent 显式批准
2. 在变更处标注 `[BASELINE_CHANGE: 理由]`
3. 不改 BDD 的 Given/When/Then 语义（只补充注释/优先级说明）
4. **隐含扩展同样要授权**（TAG0025 教训）：P3/P4 的实现细节若事实上扩展了 P1 验收标准的范围（新增豁免条件、放宽/收紧某条 BDD 的判定边界等），即使当下未产生"矛盾"，也视为需要`[BASELINE_CHANGE]` 授权的情形——授权内容必须回写 P1-requirements.md 正文，不得只存在于下游阶段的 dispatch-context 口头引用中
<!-- AGATE_CARD_END -->

> ⚠️ 本轮是**修订轮（retry 1/3）**，不是重写。以下必修项是强制指令，逐条落实。

## 目标

按 `P1-review.md` 的 **8 项必修 + 8 项建议**修订 `P1-requirements.md`。**不重写整个文件**——只改 review 指出的问题。

修订后产出仍写回原路径：`agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md`

## 上轮产出与上下文（增量模式，不重述完整目标）

- 上轮产出：`P1-requirements.md`（16 条 BDD，0 待确认项，`[NO_NEED_CONFIRM]`）
- 上轮 dispatch-context：`P1-dispatch-context-analyst.md`（**其约束全部继续有效**：三个 P0 锁定决策、环境隔离、命令超时、DSH 沙箱约束、落盘纪律）
- 评审意见：`P1-review.md`（`status: needs-revision`）——**必读**，含逐条 BDD 判定与覆盖维度标注
- 目标/约束/上游关联无需重述，引用上轮文件即可

## 8 项必修（阻塞 approved，逐条落实）

1. **BDD-3 判据必然 FAIL 且与 BDD-2 互斥（最严重）**。主 Agent 已用 Playwright 实测复现：zen 态下当前 Then 命中 **14 个元素**——`HTML`/`BODY`/`#app`/`.entry-detail.zen-mode`/`.detail-content`/`.content-area`（自身 1264×705、top=0）以及 TreeView 的 `.tree-view`/`.tree-search`/`.tree-search-input`/`.tree-list`/`.tree-node-row` 等满宽容器。**满足 BDD-2（内容区 top=0、高=视口高）就必然 FAIL BDD-3**。
   → 修法（review 建议，任选其一或组合）：限定为 `position: fixed|sticky` 的横条；或排除容器祖先链/根元素（如排除 `html/body/#app` 及内容区自身与其祖先）；或改为「不存在**独立于内容流的**满宽横条」。**修完必须自证**：给出修订后的判据在正确实现下应当命中 0 个元素的推理

2. **BDD-7 seed 不可匿名访问**。`csv-employees` 的 `meta.json` 是 `is_public: true` **但带 `team_id: backend-solo`** → 匿名 404（carol=owner 200 / alice=admin 200）。Given 隐含"需登录"未写明。
   → 改为匿名可见的 **`tsv-server-metrics`**（review 已实测：匿名 200、60 行数据、`.per-page-trigger` 存在且不触发截断），或在 Given 显式写明登录身份

3. **BDD-8 的 When 不可执行**。`multi-format-demo` 四个文件**互相 0 个 markdown 链接**、`data-peekview-file-id` 计数 0；zen 下 `.file-sidebar` 隐藏且抽屉触发控件在 header（同样隐藏）→ **全屏视图内无任何文件切换入口**。
   → 改用 review 实测可用的 **`unicode-filenames`**（zen 下内容区有 2 个可点 `navigate-file` 链接，点击后正文切换且 `/f` 保持），或 E2E 自建带 sibling 链接的多文件 entry。**并把"保态成立"与"切换动作可达"两件事分开表述**（上轮 §2.3 把二者混同了）

4. **BDD-9 无对象可点**。`dsh-architecture/ARCHITECTURE.md` 正文 `](#` 锚点链接数 = **0**（仅 2 条 http 外链）。
   → Given 改为真正含正文锚点链接的 seed（`markdown-test/rich-markdown.md` 有 10 条，**但它 `team_id: frontend-team` → 匿名 404**，须写明登录前提，或 E2E 自建）；**Then 的 `scrollTop` 须绑定具体滚动容器**（`.content-area` 自身 `overflow-y: auto`）与具体触发路径

5. **BDD-15 拆分 + 事实更正**。原 Given 用"and"把两个性质不同的 entry 串成一条，且事实有误：
   - `svg-icons` 匿名 200，但它是**独立 SVG 文件 entry（ImageViewer 路径）**，实测 `contentAreaSvg=0`、`imgInContent=1`、**`fullscreenBtn=0`** → Then 要点的全屏按钮**不存在**
   - `mermaid-charts` 有 `fullscreenBtn=1` 但**不含 svg**（3 个 `.md` 全 mermaid），且 `team_id: frontend-team` → **匿名 404**（上轮 §2.4/§5 均未登记此可见性事实）
   → 拆为两条（mermaid 一条 / 独立 SVG 一条），各自写明可见性前提

6. **BDD-13 拆分**：把"存在 slug"与"不存在 slug"两个不同 Given 打包在一条 BDD（负向判据写在 Then 之后），违反"每条一组 Given-When-Then" → 负向判据拆为**独立编号**（新增一条，建议放末尾并保持编号连续）

7. **`packages` / `domains` 与"后端零改动"自相矛盾**。§2.5 明写"数据无、后端零改动"、§1/R1 把 backend 决策留给 P2，但 `packages` 列了 `peekview-backend`、`domains` 列了 `backend`。且**包名不合仓库惯例**——先例 TPV0093 `[backend/peekview, frontend-v3]`、TPV0096 `[frontend-v3, docs]` 均为**路径式**，而 `peekview-frontend`/`peekview-backend` 在仓库中**不存在**。
   → 收缩为 `packages: [frontend-v3, docs]` + `domains: [frontend]`；或若保留 backend，须把 backend 标为**条件性**并在正文说明条件（R1 选择"处理"时才生效）

8. **P1 纯净性（部分不通过）**。澄清：P0「实现要点」的 `meta:{zen:'locked'}` / `route.meta` / `zenMode.value` **未被抄进正文**（grep 0 命中，这点做得对）；§2.1 里的 `handleZenKeydown`/`preventDefault` 属风险边界论证、可接受。但以下 **5 处指定了方案选型**，须改为"P2 待取舍"表述：
   - §4.1「锁死态须经此 provide 面传递（**新增状态或改类型**）」
   - §4.1「锁死短路**应在调用方 useZenMode 实现**」
   - §4.1「**新文案分支**；两测试文件 mock 形状须同步」
   - §4.2「**而非复用 zen 类**」
   - §2.3「若 P2 误以为需要改 `selectFile`/`useMarkdown`」

## 8 项建议（一并处理，主 Agent 已全部采纳）

9. **BDD-5/BDD-7 优先级写进 BDD 判据**（内容区内嵌组件 Escape 优先，锁死仅约束"全屏视图状态"）——不能只留在 §2.1 散文里
10. **BDD-6 限定作用域**为"全屏视图自身 chrome"，把"……语义"改为**枚举式词表**（避免主观词，并避免与 BDD-15 弹层关闭控件潜在互斥）
11. **BDD-1 指明视口**（"作者与时间信息区"在桌面下恒真：meta 条 `v-if="isMobile"` + `@media(min-width:768px)` 双重隐藏）
12. **BDD-11 响应头判据降为辅助证据**，主体判据用可见性断言
13. **BDD-10 补写 afterEach 清理**（对齐 TPV0096 规范）
14. **§4.2 补登记** `.expired-warning-banner` / `.archived-banner`（EntryDetailBanners）**不在任何 zen 隐藏规则中**这一项
15. **§2.4/§5 补记数据面事实**：`is_public: true` **≠** 匿名可达（`team_id` 使然，由 commit `59182590` TPV0095 于 2026-09-03 引入）；并**修正 §5 "无新增漂移"措辞**（`image-gallery` / `legacy-deploy` 两个 seed 目录存在但未落入 debug DB——`image-gallery` 无内容文件、`legacy-deploy` 为 archived 状态，故不在匿名 15 / alice 22 清单内）
16. **§2.1 表格事实更正**：`ShareDialog.vue:218`、`OverflowMenu.vue:150` 均为 **document 级**监听，非"元素级"——主 Agent 已复核，须标注以免 P2 误判锁死短路的影响面

## 硬约束

- **不要重写整个文件**——只改上述问题；未被点名的节保持原样
- **BDD 编号保持连续且不跳号**。本次会**新增**编号（BDD-13 的负向条拆出、BDD-15 拆成两条）→ 新增项接在原编号之后，保证整段连续；**不要复用已删除的编号**。修订完成后在文件内标注一句本次编号总数（供 P6 核对全量覆盖）
- **不得削弱任何 BDD 的判定强度**来让它"容易通过"——修订目的是让判据**可执行且正确**，不是放宽
- 三个 P0 锁定决策（URL path 后缀 / 完全锁死 / 元信息条隐藏）**不得重开**
- `risk_level: medium` / `phases`（全 8 阶段）/ `ceremony`（缺省 standard）**不变**
- 保持 `[NO_NEED_CONFIRM]`（review 已确证其合理）；保持 `[P0_STALE]` 记录（review 已复核成立）
- 修订完成后重跑 `check-frontmatter.py`，exit 0；并自跑 `_gate_p1_vision_capability` / `_gate_p1_ui_shape` 确认仍为 True（frontend 硬拦项不得因本次改动失效）

## 命令超时（强制）

任何 bash 命令设 `timeout 180s <cmd>`。超时/非预期失败 → 停止，不换命令不深挖，返回主 Agent。

## 环境隔离（强制）

只用 debug `http://127.0.0.1:8888`（主 Agent 已起 + 长托底 job）。**严禁**触碰生产 `:8080` 与 `~/.peekview/`。状态标记二值格式：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`。

## DSH 沙箱约束

`/tmp` 与 `~/.local/share` 只读；`/tmp` **跨 bash 调用不共享文件**；临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`。读文件优先用 read/grep/glob 工具。

**seed 数据提示**（自行复核 seed 可达性时用）：`make debug-seed` 默认 `tail -10` **会截断 FAIL 行**——要看完整输出请直接 `timeout 240s python3 scripts/seed-debug.py http://127.0.0.1:8888`。且**带 `team_id` 的 entry 即使 `is_public: true` 匿名也 404**（`csv-employees`/`markdown-test`/`mermaid-charts` 三条），选 seed 前务必先 `curl -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/api/v1/entries/<slug>/raw` 实测匿名可达性。

## 分阶段落盘

每改完一组必修项就向 `P1-progress.md` 追加一行（哪几项、改了什么）；每条 bash 命令执行前也追加一行。

## 门槛（什么算完成）

- 8 项必修 + 8 项建议**逐条落实**（progress 中可追溯）
- BDD 编号连续不跳号；新增编号已登记总数
- BDD-3 判据已消除与 BDD-2 的互斥（并给出"正确实现下命中 0 个元素"的推理）
- 所有 BDD 引用的 seed 均**已实测匿名可达**（不可达的必须写明登录前提或改用自建）
- `packages`/`domains` 已消除矛盾且用路径式名
- `check-frontmatter.py` exit 0；两个 frontend gate 子检查仍为 True
- 未重写未点名的节；三个 P0 决策未重开

## 返回给我（只两行）

1. 产出文件路径
2. 一句话摘要（≤30 字，含修订后 BDD 总数 + 落实的必修项数）

**不要返回文件全文。**

> 本文件不含通过/失败预判。
