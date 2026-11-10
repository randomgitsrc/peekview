---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0102
role: requirements-review
retry: 1
review_round: 2
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**复审轮（第 2 轮）**：核验 analyst 是否真正解决了上轮 `P1-review.md` 的 3 BLOCKER + 1 MINOR + 1 WARNING，且**未破坏**上轮已确认通过的项。产出**覆盖写** `P1-review.md`（同一文件，非新建），给出新的 `status` 与更新后的 `reviewed_bdds`。

### 上轮产出（增量模式，引用而非重述）

- 上轮你的评审：`{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-review.md`（30874 字节，status: needs-revision，3 BLOCKER + 1 MINOR + 1 WARNING）——**这是本轮核对的基准**，你上轮列的「已核实通过、修改时请勿丢失的部分」也是本轮必查项
- 上轮 dispatch-context：`{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-dispatch-context-requirements-review.md`（约束继续有效）
- 被复审对象：`{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（已由 analyst 修订）

### 本轮必须逐项核验的内容

#### 一、3 个 BLOCKER 是否真解决（不许只看"改了没有"，要看"改对了没有"）

| # | 上轮阻塞点 | analyst 声称的修法 | 你要核验什么 |
|---|---|---|---|
| **M1** | BDD-02 Then ③ 要求 IANA 名「形如 `Area/City`」，`TZ=UTC` 下 `resolvedOptions().timeZone` = `"UTC"`（无 `/`）→ CI 必然假 FAIL | 采方案②：Then ③ 改为「等于运行时 `Intl.DateTimeFormat().resolvedOptions().timeZone` 值」；Given 补 locale 前提 | ① 新判据在 `UTC` 与 `Asia/Shanghai` 两种环境下**都**可二值判定（自己跑 node 验）② 是否**没有**为过测试而放宽「tooltip 必须含浏览器实际时区名」的语义 ③ Given 补的 locale 前提是否引入新的不可满足条件 |
| **M2** | BDD-04 Then 要求含 `17:43:00`，但 en-US locale 输出 12 小时制 `05:43:00 PM`，项目 playwright.config 无 locale → 默认 en-US → 必然假 FAIL；且与 I-11「跟随浏览器 locale」自相矛盾 | 采方案②：Given 固定 `locale: zh-CN` + 时区；§8 新增 `locale-controlled-execution` 能力条目；新增 **I-24** 裁决 I-11 与 BDD-04 的矛盾（显示跟随 locale 是产品语义、验收固定 locale 是判定手段），**未改 I-11 原文** | ① I-24 是否真的消除了矛盾，还是只是把矛盾写成两句话并存 ② §8 的 `locale-controlled-execution` 条目 status 三态是否合法、available 列表是否给出可执行的补充方式 ③ BDD-04 固定 locale 后，BDD-01/03（形态匹配 `GMT±N` + 4 位年份）是否仍不受 locale 影响（上轮你说它们不受影响，复核是否仍成立） |
| **M3** | 5 个可见性转换中 3 个无 BDD（Private→Team A / Team A→Team B / Team A→Private） | 新增 BDD-27/28/29，每条断言 `is_public` + `team` 两字段；BDD-29 显式断言停在 `is_public=false` | ① 三条新 BDD 的 Then 是否**真的**断言了切换后的 `is_public` 与 `team` 两个字段（不是只断言"菜单关了"/"toast 出现"）② 是否与 P0-brief:159-163 的后端语义逐条对齐（尤其 Team A→Private 后端是「只清团队不改 is_public」）③ 5 个转换现在是否全覆盖，且**无重复断言**（BDD-19/20 与 27/28/29 之间无矛盾） |

#### 二、1 MINOR + 1 WARNING 是否处理到位

| # | 上轮问题 | analyst 声称的修法 | 核验点 |
|---|---|---|---|
| **m1** | BDD-07 When 逐个点名 15 模型，与 §6.10「机械遍历、新模型自动纳入」自相矛盾 | When 改为遍历「所有非 `table=True` 且**不被任何 `table=True` 模型继承**的类」，15 模型清单降为附录。AST 实测：非 table 含 datetime 共 17 类，须排除 `EntryBase`(3)/`UserBase`(1) → 15 类/31 字段 | ① 新遍历条件是否与 §6.10 的拦截声明一致（不再自相矛盾）② 「不被任何 table 模型继承」这个排除条件是否**必要且充分**（自己 AST 验一遍 models.py，确认 17 − 2 = 15）③ 附录清单与 §6.9 是否逐项吻合 |
| **W2** | 新增复合菜单控件零 a11y 覆盖 | 采方案①：新增 BDD-30（Escape 关闭 + 焦点回归触发入口），按 `OverflowMenu.vue:140-155` 既有惯例；§9 另显式声明「完整 ARIA 菜单角色树不纳入、留独立任务（roadmap 编号未代填）」 | ① BDD-30 是否可二值判定、是否**没绑** `aria-expanded` 之类属性名 ② §9 的显式声明是否足够（「不代填 roadmap 编号」是否构成"沉默跳过"——你上轮要求的是"补 BDD **或**显式声明不做并登记 roadmap"，现在只声明未登记编号，你要判定这算不算达标）③ `OverflowMenu.vue:140-155` 的既有惯例是否真的存在（自己读） |

#### 三、上轮已确认通过的项是否被破坏（逐条复查，这是复审的核心价值）

上轮你实测确认过、analyst 声称"未丢失"的项，**必须逐条重新核**（不要相信它的自述）：

- 15 个叶响应模型行号 + 31 个 datetime 字段计数
- 全部组件/store 行号引用（`EntryCard:43/44-47`、`EntryListRow:19/20-23`、`EntryDetailHeader:62/66-73`、`EntryMetaTagsBar:4/6-13`、`EntryDetailContent:59-61`、`entryList.ts:45`、`entryDetail.ts:101`、`team.ts:13`）
- seed 事实（image-gallery 0 文件不入库、三团队归属、BDD-26 的 8/4/1 文件数）
- 第 7 节 3 处 `[P0_STALE]` 的归因表述（**上轮已确认正确，若被改动须标出**）
- 同类扫描 10 小节
- 裁剪声明（phases 全 8 个、medium、standard、verification_env）
- P1 纯净性（不掺解决方案设计）

#### 四、新增 BDD 的格式与一致性（30 条全量）

- 编号 `#### BDD-NN:` 两位零填充、`01`–`30` **连续且顺序正确**（主 Agent 已实测：`01..30` 连续、单调递增，无跳号无乱序——你可复核）
- 每条只有一条 Given-When-Then
- 无主观形容词、无 CSS 类名 / HTML 属性名 / 组件名 / API 调用名绑定
- **计数同步点**（analyst 声称改了 5 处，逐处核）：
  1. §3 开头「共 **30 条**（BDD-01 ~ BDD-30，编号连续）」
  2. §5 裁剪说明里 P1 / P6 两行的 BDD 条数
  3. §6.10 回归拦截映射表是否含新 BDD 编号
  4. 顶部提示块 UX 类别后缀清单（analyst 写成 `BDD-01/02/03/13/16/19/25/27/28/29/30`）
  5. 是否还有任何残留的「26 条」表述（自己 grep）

### 只读纪律（强制，违反即数据丢失事故）

- **禁止**任何破坏性或写仓命令：`git checkout -- .` / `git restore` / `git reset` / `git stash` / `git clean` / `git add` / `git commit` / `git switch -f` / 直接编辑或删除被评审文件
- **禁止**对真实仓库运行写类工具：`agate-inject-card.py` / `agate-md-field-set.py` / `agate-state-set.py` / `agate-task-init.py`
- 唯一允许写入的是你自己的产出文件 `P1-review.md`（覆盖写，用 write 工具）+ 你的 progress 文件
- 需要跑验证只在仓外或可丢弃副本上做；scratch 失败如实上报，**不得**转而"修好"被评审的仓库
- 结束前核验 `git status --porcelain`：相对基线的唯一新增应是你自己的文件

### 关键填值要求（会导致 gate exit 1 的坑）

`reviewed_bdds` 必须**更新为 01..30 全部 30 项**（上轮是 26 项，现在 BDD 增至 30）。gate 判据是正则 `^#### BDD-([0-9]+[a-z]?):` 捕获的字面量与声明集合**严格相等**，P1 用两位零填充 → 必须写 `01 02 ... 30`（带前导零）。

用 `agate-md-field-set.py` 写，list 字段按空白分隔裸值（**不要**写 `"[01, 02, ...]"`，会被拆坏）。

### 环境约束

- 严禁触碰生产 `:8080` 与 `~/.peekview/`；调试只用 `make debug`（`:8888`）
- 前端页面路由是 `/{slug}`，不是 `/entries/{slug}`
- 状态标记二值：`[PROD_NOT_TOUCHED]`
- 任何 bash 命令外层 `timeout`（预期耗时 ×1.5）
- 临时产物落 `<项目根>/.agate-tmp/`，**不要用 `/tmp`**

### 输入文件

- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-requirements.md`（**被复审对象**，已修订）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-review.md`（**你上轮的评审，本轮核对基准**）
- `{AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P0-brief.md`（第 159-163 行是 M3 的后端语义依据）
- `frontend-v3/playwright.config.ts`（M2 依据）
- `backend/peekview/models.py`（m1 的 AST 核验对象）
- `frontend-v3/src/components/OverflowMenu.vue`（W2 的既有惯例依据）
- `AGENTS.md`（项目约定）

### 产出文件字段

用 `FILE={AGATE_WORKSPACE}/tasks/TPV0102-explore-card-list-ux/P1-review.md agate-md-field-set --list` 查字段。

已确定值（保持）：phase=P1, task_id=TPV0102, parent=P1-requirements.md, trace_id=TPV0102-P1-review-20261110, agent=requirements-review, created=2026-11-10

由你更新：`status`（approved / needs-revision / rejected）、`reviewed_bdds`（**01..30**）
</dispatch_guide>

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
# ── TAG0050 批 E/F 结构化字段（非 legacy 任务）──
# scope_plus: [{id: SP1, text: "增补项"}]   # list；P7 聚合，须被 scope_resolved 覆盖
# pruned: [{phase: P3, reason: "low 风险可裁", risk: low}]  # 跳过阶段；phases ∪ pruned == phase_universe（恒检）
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
5. **机械门禁必须实测，不得推理**：凡本任务**新增或改名 `agate/scripts/` 下的脚本/文件**，除逻辑上的同类扫描外，还须对「**既有测试与 gate 是否会因这个新文件被触发**」做**实测**——把文件真放进仓库，跑一遍相关测试与 consistency，记录**实际**变红/告警的面。「凭推理判『不处理』」在本仓库已被证伪（TAG0036 M18：P1 推理判"不处理"，P2 评审实测才发现 SG.6 由绿转红）。登记面权威清单见 `agate/scripts/README.md`「新增脚本登记面」节（该节已区分**机械门禁**与**团队约定**，照单登记前先看类型列）。

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
- [ ] 若本任务新增/改名 `agate/scripts/` 下文件：登记面已按 `agate/scripts/README.md`「新增脚本登记面」节**实测**过（不是推理），并记下实际变红/告警的面
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

<objective_info>

**主 Agent 已实测的事实（可直接使用）**

- BDD 编号集合 = `01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30`（30 条，连续且单调递增，awk 检查无乱序）
- `check-frontmatter.py P1-requirements.md` → **exit 0**
- 新增 BDD 标题：
  - `BDD-27: 交互行为：Private entry 选 Team A 后归属 Team A 且保持非公开`
  - `BDD-28: 交互行为：Team A entry 选 Team B 后归属改为 Team B 且保持非公开`
  - `BDD-29: 交互行为：Team A entry 选 Private 后团队清空且保持非公开`
  - `BDD-30: 交互行为：可见性菜单可被键盘关闭且焦点回到触发入口`
- analyst 声称的 5 处计数同步已改（主 Agent grep 确认：§3 第 127 行「共 **30 条**（BDD-01 ~ BDD-30）」、§5 第 341/346 行「30 条 BDD」、顶部第 41 行 UX 后缀清单含 27/28/29/30）
- 仓库 HEAD `8ab8f58b`；`.agate-tmp` 已 gitignore
- analyst 的一处独立发现（你上轮未覆盖）：`new Date(本地化文本)` 反解**不可靠**——`ja-JP` 文本 → `NaN`、`de-DE` 文本 → 解析成 `2026-10-11T09:43:00Z`（错月份）。analyst 据此否决了 M2 的"反解判据"替代方案。你可以复核这条

**未查证（需你自查，不要凭记忆断言）**

- analyst 是否在别处留下了「26 条」的残留表述（自己 grep）
- I-24 的原文表述（在 P1 正文 §2.2 附近），判断它是否真消除矛盾
- `OverflowMenu.vue:140-155` 的 Escape + focus 回归惯例

</objective_info>

> 注：该文件禁止包含 PASS/FAIL 预判——否则被 `check-p6-provenance.py` 审计失败。
