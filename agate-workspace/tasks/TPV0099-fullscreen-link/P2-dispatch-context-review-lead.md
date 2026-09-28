# P2-dispatch-context-review-lead — TPV0099（专家组组长汇总）

---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: plan-eng-review
---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P2

路径：phase-cards/P2-design.md
---
# P2 — 方案设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P2 不可裁剪。design_trivial / follows_existing_pattern 可简化（1 个候选方案），不可省略。

## 如果是首次进入本阶段

1. 派发 architect subagent → 产出 P2-design.md
   1.1 写 P2-dispatch-context-architect.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 C8 映射表派评审（见下方）
3. 评审通过 → P2-review.md status: approved
4. 预跑 check-gate.py P2（脚本化检查）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P2，不要提前写 P3——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P2): {摘要}"（phase=P2，P2 产出含 P2-design.md + P2-review.md）
7. P2 commit 完成后进入 P3：**phase 推进 P3 随 P3 产出 commit 一起**（P3-test-cases.md 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（方案选择有误 / 候选方案不足 / 评审 rejected）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P2 MAX=3）

## 前置条件

- [ ] P1-requirements.md 含 domains / risk_level / phases 声明
- [ ] P0-brief.md env_constraints 可查阅
- [ ] 若项目存在 `{AGATE_WORKSPACE}/decisions/`，已读取其中既有决策（见下节「项目侧架构决策」）

## 项目侧架构决策（decisions/，TAG0036）

项目内**跨任务的架构决策**（影响不止本任务、后续任务也会依赖的取舍）落在 `{AGATE_WORKSPACE}/decisions/`，与协议自身的 `adr.md`（agate 协议层决策）分开。具体文件名与模板不作规定，由项目自定。

- **P2 开始前读取既有决策**：写候选方案之前先读 `decisions/` 下的既有决策，方案不得在不知情的情况下与之冲突；有冲突时在 P2-design.md 说明取舍。
- **写入时机**：P2 定稿后，若方案含新的跨任务架构决策，将其写入 `{AGATE_WORKSPACE}/decisions/`（P7 一致性检查阶段亦可核对）。
- **前提被证伪时就地标注**：发现某条既有决策的前提已被后续变更证伪，在该条决策原处标注「已过时 + 被什么取代」，**不删除**（保留决策史）。
- 这是读取与登记的约定，不由 gate 校验，也不设自动过期机制。

## 派发

- **角色**：architect（`{agate_root}/assets/execution-roles/architect.md`）
- **输入**：P1-requirements.md + P0-brief.md
- **输出**：P2-design.md
- **派发 prompt 追加**：

```
## P2 最小验证
方案设计前，先用最小验证确认关键假设（10 行 HTML 测试页 / curl 请求 / 20 行脚本）。
验证结果写入 P2-design.md 的 minimal_validation 字段。
- 方案依赖浏览器行为/安全模型/外部系统行为 → 必须做最小验证
- 纯代码逻辑 → 须在 minimal_validation 字段声明 `纯代码逻辑，无外部系统依赖`（须写明依赖了哪些内部函数/数据转换）
```

## 产出规格

P2-design.md 必须包含：
- **候选方案 ≥2** + 权衡 + 选择理由（design_trivial / follows_existing_pattern 时可只写 1 个，见下方）
- **`candidate_count: N` 必填**：本方案候选方案数（≥2，design_trivial/follows_existing_pattern 时可 1），gate 按此字段校验，不再解析标题。你写几个候选就填几个，与正文一致。
- **四字段**：`packages:` `domains:` `ui_affected:` `gate_commands:`
- **files_to_read**：实现时需要参考的文件清单（控制 P4 implementer 上下文）
- **env_constraints**：确认/细化 P0-brief 的环境约束
- **minimal_validation**：验证结果 或 声明"纯代码逻辑，无外部系统依赖"（声明时须附理由）

`candidate_count`/`packages`/`domains`/`ui_affected` 写在文件头 **frontmatter**（`---` 分隔块），
不写正文；`gate_commands:`/`files_to_read:`/`env_constraints:`/`minimal_validation:` 留正文。
**可直接复制的完整样例**：
```yaml
---
phase: P2
task_id: TAG0001           # 替换为实际任务编号
type: design
parent: P1-requirements.md
trace_id: T001-P2-20260101 # {task_id}-P2-{YYYYMMDD}
status: draft
created: 2026-01-01
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2                # int ≥1，必填
packages: [pkg-a]                 # list，必填
domains: [backend, cli]           # list，必填
ui_affected: false                # bool，必填
ui_design_section: true           # bool，可选（presence 语义：ui_affected: true 时声明已含 UI 设计节）
---
```

**UI 设计节（`ui_affected: true` 时必含，P2 gate 校验）：** `ui_affected: true` 的 P2-design.md
正文必须包含 `## UI 设计` 节，节内含**渲染形态声明**（`渲染形态:` 声明行，复用 P1 frontmatter
`ui_render_shape` 的规范形态值 + 中文注释，gate 按规范化值比对校验 P1-P2 一致；无 P1 声明时按
布局型默认）+ **维度选择**（`适用维度:` 声明行）+ **按形态适配的 checklist**（常规布局型 =
布局/交互/视觉三类；渲染组件/时序特效型 = 渲染正确性/动效时序等适用维度 checklist；不适用的维度
显式声明"维度不适用"）。缺 UI 设计节 / 缺形态声明 / 缺按形态 checklist / P1-P2 形态声明不一致 →
P2 gate exit 1。结构规格见 `assets/execution-roles/architect.md`「UI 设计节」节（由 architect
兼任产出，不新增 designer 角色）。

**骨架产出（`project_phase: bootstrap` 时必含，P2 gate 校验）：** P1-requirements.md frontmatter
声明 `project_phase: bootstrap`（0→1 新项目；缺省 `established` 不触发）的任务，P2 architect 除
P2-design.md 外，还须在 task 目录下产出 `P2-skeleton.md`（须含 `## 骨架声明` 标题）。骨架内容以
「候选目录集合 + 项目侧声明」的参数化形式表达（不写死具体语言/框架目录名），模板见
`assets/templates/skeleton-template.md`，结构规格见 `assets/execution-roles/architect.md`
「骨架设计职责」节（由 architect 兼任产出，不新增专属角色）。`project_phase` 字段缺失或非
`bootstrap` 时不检查（向后兼容，行为与改动前一致）。

候选方案简化（须附理由，无理由视为无效声明，要求 ≥2 候选方案）：
- `design_trivial: true` + 理由（为什么 trivial）→ 可只写 1 个候选方案（P2 仍不可省略）
- `follows_existing_pattern: [src/foo.py]`（列出参照文件路径）→ 可只写 1 个候选方案，参照已有模式（P2 仍不可省略）

## dispatch_plan 机器字段（可选，TAG0014）

> 本字段是 P2 对**后续阶段编排方案**的机器声明（评估 + 编排模式，见 dispatch-protocol「派发编排机制」），由 architect 在"批次设计"节（execution-roles/architect.md）产出，P2 gate 校验其合法性。

方案含多个独立子任务（多包/多模块/high 复杂度）时，P2-design.md frontmatter 应声明 `dispatch_plan:`（单行 flow YAML，与 candidate_count 同级，**不入 frontmatter-check schema**，缺省不校验）：

```yaml
# ── v2.0 派发编排字段（可选）──
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: pkg-a, complexity: medium}, {id: pkg-b, complexity: low}]}
```

字段契约（gate 校验口径）：
- `mode` ∈ {single, static-batch, parallel, recon-then-split, serial}——编排模式（单发/静态拆批/并行/先理解后拆/串行链）
- `parallel_limit` 可选，≥1 整数——并行上限（缺省 3）
- `batches` 可选——mode ∈ {static-batch, parallel} 时每批须含 `id` + `complexity` ∈ {low, medium, high}；批数 ≤ parallel_limit
- 缺字段 / 坏 YAML → P2 gate 跳过校验，行为等同现状（向后兼容，不误拦）

### batches[] 可选键：tests_filter / output 与批切分判据（TAG0036）

> 本小节是 `tests_filter` / `output` 写法的**权威定义**（architect 角色文件只写"如何选"并引用本节，不复述契约）。两个键都嵌套在 `dispatch_plan.batches[]` 内，不新增 frontmatter 顶层键。

`batches[]` 的每一批除 `id` + `complexity` 外，可再声明两个**可选**键（`tests_filter` 与 `output`）：

```yaml
dispatch_plan: {mode: static-batch, parallel_limit: 3, batches: [{id: order-cancel, complexity: medium, tests_filter: "python -m pytest tests/unit/test_order_cancel.py -q", output: [src/order/cancel.py, src/order/api.py]}, {id: order-refund, complexity: low}]}
```

- **`tests_filter`（可选）**：该批**绿灯确认**用的测试命令，写在 P2-design.md 的 frontmatter，值须用**双引号**包裹（值内含引号/空格的 node id 同理保持双引号可解析）。**只覆盖该批交付面**的测试，**禁止全量**套件、不含后续批才交付的测试——全量回归属 `gate_commands.P5`，不属批级过滤。**缺省**（不写）时 gate 行为不变，该批只是不产生批级证据，不会被拦截。
- **平台中立**：`tests_filter` 示例写 `python -m pytest …` 形态，不裸 `python3`（不同平台解释器名不同，Windows 无 `make`/`python3`）；实际解释器名以本项目 `AGATE_PYTHON` / `probe_python` 探测为准，示例仅示意。
- **`expected_red` 声明位置**：该批确有设计上应红的测试（属后续批交付面，但已落在本批 `tests_filter` 命中范围内）时，由运行者在证据日志 `P4-evidence/{batch}.log` 的 `expected_red` 键里声明，不写进 P2-design.md。`{batch}` 即该批的 `id`，须匹配 `[A-Za-z0-9._-]+`（filename-safe，不含空格、斜杠、`..`），因为它直接拼成证据文件名。
- **`output`（可选）**：该批预期改动的文件路径列表（如上例）。**仅供** `check-mvwu.py --observe` 做 boundary / commit 形态比对时读取，**不新增 gate 校验**——缺省、写错都不影响任何阶段 gate；`agate-frontmatter-check.py` 与 `check-structure-consistency.py` 均不因这两个键而改动（嵌套键，不触碰顶层白名单）。

**批切分判据**（写 `batches[]` 时按以下三条判断怎么切；三条均是判据式引导，不是 gate 规则；`Walking Skeleton` 见判据一）：

1. **判据一：Tracer Bullet（曳光弹）**——触发条件：任务含 ≥2 个批，且存在可端到端验证的关键路径。此时首个批应为该路径的端到端最小打通，其 `tests_filter` 覆盖该路径的**冒烟**级验证（"路径确实通"），而不是该批的完整单元测试。目的：在投入全部实现之前先取得"管道确实通"的反馈。**与 P3 红灯批的边界**：tracer bullet 只是**首个批的切法**，不替代 P3 完整红灯批（任务级红灯基线仍由 `gate_commands.P3` 承担），后续批仍按常规批级验证走。`Walking Skeleton` 中"骨架先跑通"的部分**吸收**进本判据；其自动化部署/CI 配置部分**拒绝**（技术栈中立，见 `adr.md` ADR-003）。这**不是**既有 `P2-skeleton.md`「骨架声明」（`project_phase: bootstrap` 的目录布局声明）——二者是不同机制，本判据不新增字段、gate 或模板文件。
2. **判据二：Vertical Slice（垂直切片）**——批 / 包**优先按业务能力切**：一个批 = 一条端到端可交付的能力，而不是一个技术层。判据式自检：批 `id` 应能回答"这个批交付了什么能力"，而不是"动了哪层代码"。若必须按技术层切，须在 P2-design.md **写明理由**（不禁止、也没有任何 gate 拦截）。与判据一的关系：端到端批天然是垂直切片，二者是同一决策的两个面。
3. **判据三：Architecture Fitness Functions（架构适应度）**——`gate_commands` 除功能测试外，还应为本任务涉及的架构约束配置适应度检查，见下方「gate_commands 声明」节的「架构适应度检查」小节。

## 影响面梳理（强制节）

**写候选方案之前**先做影响面梳理——方案的取舍取决于它牵动多大面，先设计再补影响面等于反过来给方案找理由。P0 卡片的「同类/影响面预判」给量级、P1 卡片的「同类扫描」给清单，P2 在这两者基础上做**候选方案级**的影响域分析，三处同源、逐级细化，不重复劳动。

P2-design.md 正文必须含影响面梳理节，覆盖三部分：

1. **改什么（Modify）**：逐文件/逐模块列出改动点 + 关联 BDD 编号；改动落点必须落到"哪个文件的哪个小节/函数"，不写"相关代码"这种模糊表述
2. **不改什么（Not Modify）**：显式列出**看起来该改但决定不改**的文件/范围 + 理由。这一栏比"改什么"更容易漏，也是 P4 implementer 判断范围边界的依据（避免"顺手改进"）
3. **风险在哪（Risk）**：每条风险配一条缓解措施；跨模块引用、双源同步（权威源 + 副本）、schema 变更、并发/资源竞争是高频风险项

梳理动作要有客观证据：grep/rg 命中清单、读过的消费方代码、既有 gate 脚本的校验口径——不是凭印象列。P1 已声明 `follows_existing_pattern` 的任务同样要做（沿用既有模式不等于影响面为零）。

## gate_commands 声明

gate_commands 在 P2 固化，后续阶段按此执行：

```yaml
gate_commands:
  P3: "pytest"                  # 可选：测试运行器（verbose 输出，供 check-tdd-red.py 自动读取）
  P5: "pytest -q --tb=no"       # 紧凑输出模式
  P5_e2e: "playwright test --reporter=line tests/e2e/"  # ui_affected: true 时必填
  P5_timeout_seconds: 120       # 可选：该 key 命令的预期耗时上限（秒），见下方字段规则
  P5_e2e_timeout_seconds: 300   # 可选：per-key 声明，不同命令类型各自取档
```

### `{key}_timeout_seconds` 字段规则

`timeout_seconds` 是 `gate_commands` 块内的**可选声明性字段**，用来给每条 gate 命令声明"预期耗时上限"，供跑命令的一方（主 Agent / subagent）据此设置 shell 层超时。四点规则：

1. **排除 P3**：`gate_commands.P3` 继续走既有 `AGATE_TDD_TIMEOUT` 环境变量机制（默认 120s，由 `agate_common.py` 的 `run_test_with_formatter()` 消费、`check-tdd-red.py` 读取，exit 124 → 超时 JSON，区分 A/B 类错误）。`timeout_seconds` **只服务 P5 / P6 / 其他非 P3 key**，不覆盖 P3。两层不合并：P3 层是运行时代码真实消费的超时，`timeout_seconds` 是给人和 subagent 读的静态声明
2. **per-key 声明**：写成 `{key}_timeout_seconds`（如 `P5_timeout_seconds` / `P5_e2e_timeout_seconds`），每条 key 各自声明，**不设整体共享默认**——单元测试与 E2E 的耗时差 2.5 倍以上，共享一个值起不到分类阈值的作用。命名与既有 `{key}_formatter` / `{key}_e2e` 的 per-key 惯例一致
3. **三档默认基准表**（**建议档位，需按命令类型手动声明，不是自动推断**——没有任何代码去"猜"命令属于哪一类）：

   | 命令类型 | 建议档位 | 依据 |
   |---------|---------|------|
   | 单元测试类（pytest / vitest 等） | 120s | 与 `AGATE_TDD_TIMEOUT` 默认值对齐，同类命令的既有锚点 |
   | E2E 类（Playwright / CDP） | 300s | 覆盖页面加载 + 多步操作；比脚本内部硬超时（HARD 90s/180s）更大——外层命令级预期时长必须留够内层完整走完的余量 |
   | 构建类（编译 / 安装依赖 / 打包） | 600s | 覆盖 `npm install` / 编译等长操作。宁可档位定高，也不要让长命令被误判失败（TPV0093 教训：`make test-quick` 挂 188 分钟） |

4. **向后兼容**：缺字段 → 行为等同现状（沿用 `dispatch_plan` 的"缺字段 / 坏 YAML → gate 跳过校验"先例），不新增强制阻断，老任务无需回填

与运行时超时纪律的关系：本字段是**静态声明**（层级 1），subagent 执行命令时真正去设 shell timeout 的是**层级 4** 的「命令超时兜底」（取值 = 预期耗时 ×1.5；本字段已声明时"预期耗时"直接取该值）。四层超时机制的完整分层见 dispatch-protocol.md「命令超时兜底与既有超时机制的分层关系」。

### env_constraints 与 gate_commands 的边界（不等价）

`env_constraints` 是**声明性字段**——它只做信息确认/注入（写清楚环境约束是什么，供 P4/P8 读取参考），本身不会被自动执行，也没有任何 gate 脚本会去校验 `env_constraints` 里写的条件是否真的成立。真正被执行的机制是 `gate_commands`：P5/P6 只会去跑 `gate_commands` 里声明的命令，不会去"执行" `env_constraints` 的内容。二者不等价，不能互相替代。

**因此**：任何需要被强制执行的约束，必须落到 `gate_commands`（有命令可跑、有 exit code 可判定），或者落到 P4/P8 阶段卡片里的明确 checklist 条目（有人工自查动作可执行）。只写进 `env_constraints` 而不落 `gate_commands`/checklist 的约束，等于没有强制力——architect 设计时若发现某条环境约束必须被强制执行，不要止步于写进 `env_constraints`。

### 架构适应度检查（Fitness Functions，TAG0036）

这是批切分判据三（Architecture Fitness Functions，判据一、二见「dispatch_plan 机器字段」节）：`gate_commands` 除功能测试外，**应为本任务涉及的架构约束**再配置适应度检查——把"架构约束不被破坏"变成有 exit code 的命令，而不是只靠评审目测。示例维度（取与本任务相关的至少几项即可，不必全配）：

- **依赖方向**：低层模块不得反向依赖高层模块
- **分层边界**：跨层调用只走约定的接口，不穿层
- **循环依赖**：模块 / 包之间无环
- **公共 API 稳定性**：对外暴露的接口签名不被无意改动

约束：

- **agate 不规定具体工具**——用什么工具做这些检查由项目自选；命令仍经 `gate_commands` 注入（独立 key，遵守下方「`--strict` 反模式」的一 key 一命令规则），P5 照常执行。
- 只要求"该维度存在"：本任务涉及某条架构约束时，对应检查应在 `gate_commands` 里有位置；不要求覆盖所有维度，也不由 gate 校验其存在。
- 项目判定本任务无架构约束时，在 P2-design.md 写明"本任务无架构适应度检查"即可，不强制。

### `--strict` 反模式：不要放进 `&&` 链路中间

`gate_commands` 的每个 key 声明的是**一条完整命令**，若把多个校验命令用 `&&` 拼接成一条命令串塞进同一个 key，会有短路问题——只要前一个命令非零退出，后面的命令（包括 `--strict` 校验）根本不会跑，看似"全部声明了"，实际后半段从未被执行过，问题被掩盖。

**反例（不要这样写）**：
```yaml
gate_commands:
  P5: "pytest -q --tb=no && check-protocol-consistency.py --strict && shellcheck scripts/*.sh"
```
上面这条命令一旦 `pytest` 失败就短路退出，`--strict` 校验和 `shellcheck` 都不会执行，历史上 TAG0004 等任务已经在这类写法上吃过亏。

**正确做法**：把每个校验拆成独立的 key 分别声明，各自独立跑、独立记录 pass/fail，不共享短路关系：
```yaml
gate_commands:
  P5: "pytest -q --tb=no"
  P5_consistency: "check-protocol-consistency.py --strict-errors-only"
  P5_shellcheck: "shellcheck scripts/*.sh"
```
`--strict-errors-only`（仅 ERROR 判失败）适合日常任务默认使用；`--strict`（WARNING-only 也判失败）保留给专门做 WARNING 债务清理的任务主动选用。

### `P3_xxx` 禁止声明（P2 卡禁令，BDD-6）

`gate_commands` 的测试命令键只允许裸 `P3`（`check-tdd-red.py` 只收集精确键
`key == "P3"`）。禁止声明 `P3_xxx` 检测键：旧解析器曾用 `startswith("P3")`
静默收集辅助键，致 TDD 误执行非测试命令。白名单后缀清单（不收集为检测命令）：
`_formatter` / `_timeout_seconds`（元键，`is_gate_meta_key` 豁免）+ `_e2e`
（E2E 形态，P5_e2e 消费，P3 永不收集）+ 历史 `_js` / `_html`（已退役，
不得复用为检测键；未来多栈回归走协议修订登记收集后缀，不走静默收集）。

### CHECK / 扫描面上线流程（DEBT0025：先全量扫描存量）

`check-platform-assumptions.py` 新增 CHECK / 扫描面上线时，先全量扫描存量
测试树登记命中清单，有命中先登记再启用常驻阻断，避免存量命中阻断正常开发。

## 评审派发（C8 机械映射）

按 P1 声明的 domains + risk_level 机械映射评审：

| domain | risk_level | 必须派的评审 |
|--------|------------|------------|
| backend | 任意 | plan-eng-review（P2 方案评审） |
| frontend | 任意 | plan-design-review |
| 任意 | high | plan-eng-review（硬规则，必须派独立 subagent） |
| 任意 | full（tier=full 或声明 ceremony: full）| plan-eng-review（硬规则，必须派独立 subagent）+ cso（security 域）+ P7 不可裁 |
| P1-requirements.md 含 [NEED_CONFIRM] 且涉及业务方向 | 任意 | plan-ceo-review |

> **去重说明**：同一任务命中多行且触发同一评审角色时，去重只派发一次（如 backend + high 均命中 plan-eng-review，只派 1 个 plan-eng-review，不重复派发）。

多个评审角色 `专家组并行` → 组长汇总 → P2-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件（示例非穷举，按 C8 映射表触发）：
   - plan-eng-review → P2-review-eng.md
   - plan-design-review → P2-review-design.md
   - plan-ceo-review → P2-review-ceo.md
   - cso → P2-review-cso.md
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长输入：所有评审文件路径
5. 组长产出：P2-review.md（统一 status: approved / rejected）。**组长 subagent 产出的 P2-review.md 的 Header agent 字段必须是组长角色名（非 main）——check-gate.py P2 硬拦截 agent=main 的 approved**
6. 组长规则：
   - 不发表新意见，只汇总
   - 任何专家标 BLOCKER → status: rejected
   - 多位专家分歧 → 标「专家组分歧」交人工
   - 全票无 BLOCKER → status: approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P2-review.md。

review 不通过 → architect 修改方案 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

**UI 测试选择器**：涉及前端时，P2 design 建议声明 UI 组件的稳定测试标识清单（如 `data-testid`，而非 class 命名）。P3 test-designer 用稳定标识定位元素，P4 implementer 按清单实现--class 命名可重构，稳定标识不变。具体方案由 P2 architect 决定。

## gate 规则

```bash
check-gate.py P2 $TASK_DIR
```

- 候选方案数 ≥2（design_trivial / follows_existing_pattern 时可只写 1 个）
- P2-review.md 存在且 status: approved（agent≠main）— 不存在 → gate exit 1
- 四字段齐全（packages/domains/ui_affected/gate_commands）
- gate_commands.P3 可选（非 pytest 项目建议声明，供 check-tdd-red.py 自动读取测试运行器）
- 候选方案 ≥2 时含权衡/选择理由

## 推进条件（全部满足才写 phase: P3）

- [ ] P2-design.md 候选方案 ≥2（或 design_trivial/follows_existing_pattern 须附理由时可只写 1 个）+ 四字段齐全
- [ ] 含「影响面梳理」节（改什么 / 不改什么 / 风险在哪 三部分齐全，且写在候选方案之前）
- [ ] P2-review.md 存在且 status: approved（agent≠main）
- [ ] gate_commands.P5_e2e 已声明（ui_affected: true 时）

## 常见错误

1. **忘了最小验证**：方案依赖外部系统行为（API MIME 类型、浏览器 CSP 等）但直接假设前提成立 → 到 P6 才发现不可行。跑一个 curl / 10 行 HTML 就能 5 分钟发现
2. **gate_commands.P5 只列单元测试**：UI 任务时缺少 P5_e2e → P5 不会跑端到端验证
3. **files_to_read 列太多文件**：把所有相关文件都列上 → P4 implementer 上下文爆炸。只列确实需要参考的
4. **忘了派评审**：按 C8 映射机械执行，不靠"觉得不需要"
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P4 依赖 files_to_read 导航代码阅读范围
- P5 依赖 gate_commands 执行验证命令
- P6 依赖 ui_affected 判断是否需要 vision-helper
- gate_commands 在 P2 固化后 P4-P6 不能改——设计阶段是声明验证契约的唯一窗口

> 完成 → 读 phase-cards/P3-tdd.md
<!-- AGATE_CARD_END -->

> ⚠️ 本轮职责是**汇总**，不是重新评审。**只审不写** `P2-design.md`。

## 目标

作为**专家组组长**，汇总两份职能评审（`P2-review-eng.md` + `P2-review-design.md`），产出**统一门槛文件** `P2-review.md`，Header `status` 给终态。

## 背景

TPV0099（全屏模式链接 `/{slug}/f`）的 C8 映射命中两个 P2 评审角色（去重后 2 个）：
- `domains` 含 **frontend** → `plan-design-review` → 产出 `P2-review-design.md`
- `domains` 含 **backend**？→ 注意：P1 已把 `domains` 收缩为 `[frontend]`（后端零改动的结论），但 **R1 仍留了后端选项**。故主 Agent 派发了 `plan-eng-review` 覆盖工程维度（数据流/状态机/接口契约/测试策略/gate_commands/实现就绪度/架构债）→ 产出 `P2-review-eng.md`

两份评审**并行独立**产出，各自给 status。

## 你的汇总职责

1. **读全两份评审**，逐条核对
2. **冲突消解**：两份评审结论冲突时，明确判定谁对 + 理由（**不要和稀泥**，也不要简单取"更严格的"）
3. **去重**：同一问题被两方各自提出时合并为一条，标注双方锚点
4. **定级**：把两方的问题统一分为「阻塞级（须 architect 修订）」/「非阻塞（记录或登记债）」
5. **判定终态**：
   - 任一评审存在**阻塞级**问题 → `P2-review.md` = `rejected` 或 `needs-revision`（按问题性质：方案方向错 = rejected；需补充/修订 = needs-revision）
   - 两方均无阻塞级问题 → `approved`
6. **给出可执行的修订指令**（若判 needs-revision）：逐条写明改什么、为什么、验收判据——让 architect 能定点修

## 前两阶段的教训（请在汇总时特别留意）

P1 阶段出现过两次"判据看似正确实则失效"的缺陷，均由**独立复核**（而非自述核对）捕获：
1. **BDD 判据与自身需求互斥**（正确实现必然 FAIL）
2. **修完反向失效为恒真**（应 FAIL 却判 PASS，拦截力归零）

→ 汇总时请特别确认：两份评审是否对 **gate_commands 的真实可执行性**（命令是否存在、是否 `&&` 拼接导致短路、`P5_e2e` 是否真能覆盖 UX 类 BDD）与 **方案是否真能与既有 zen 机制共存**（不误锁 f 键 zen、不吞内容区 Escape）做了**实证**而非"看起来可以"。

## 输入文件
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-review-eng.md`（工程维度评审）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-review-design.md`（前端/UI 维度评审）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-design.md`（被评审的方案，用于核对两方意见的落点）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md`（19 条 BDD 基线，判定"是否覆盖全部 BDD"）
- `Makefile`（如需独立核验 gate_commands 引用的 target 是否存在）
- `/home/kity/.agate/v0.76.0/agate/rules/review-mapping.md`（C8 映射与产出规范）

## 产出
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-review.md`（**统一门槛文件**）
- frontmatter：`phase: P2` / `task_id: TPV0099` / `parent: P2-design.md` / `trace_id: TPV0099-P2-20260928` / `agent: review-lead` / `status: <终态>`
  - ⚠️ `agent` **必须写 `review-lead`**（组长角色名），**不是** `plan-eng-review` / `plan-design-review`——`P2-review.md` 是**组长**的汇总产物，写具体评审角色名会造成「谁批准的」归属错误。先例 `TPV0093/P2-review.md:9` = `agent: review-lead`
  - `check-gate.py P2` 硬拦截 **`agent: main`**（主 Agent 不可自行批准评审）；写 `review-lead` 即通过该项
- 正文须含：① 两份评审的来源与各自结论 ② 去重后的问题清单（含双方锚点）③ 冲突消解结论（若有）④ 阻塞/非阻塞定级 ⑤ 若 needs-revision：逐条修订指令 ⑥ 对 19 条 BDD 覆盖性的确认

## 约束
- **只审不写**：不修改 `P2-design.md`；两份职能评审文件也不改
- `status:` 终态必须与返回摘要一致（**主 Agent 只读 Header 判定**）
- 正文避免行首 `- PASS` / `- FAIL` 预判格式（触发 provenance 审计拦截）
- 子派发能力：不启用
- **不要**直接写入 `{AGATE_WORKSPACE}/debt/tech-debt.md`（如需登记债，在汇总里给出标准格式条目，主 Agent 统一登记）

## 命令超时（强制）
任何 bash 命令设 `timeout 180s <cmd>`。超时/非预期失败 → 停止，不换命令不深挖，返回主 Agent。

## 环境隔离（强制）
只用 debug `:8888`。**严禁**触碰生产 `:8080` 与 `~/.peekview/`。状态标记二值格式：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`。

## 返回给我（只两行）
1. 产出文件路径
2. 一句话摘要（≤30 字，含终态 status + 阻塞级问题数）

**不要返回文件全文。**

> 本文件不含通过/失败预判。

---

## 附录 A（主 Agent 于派发前追加，2026-09-28）：三条**已裁决**事项 —— 汇总时按此处理，不要重新翻案

### A.1 `viewer.spec.ts` 18 failed 的定性：**不是 DEBT0012，本任务不新立债务条目**

architect 在终稿 §10 遗留表建议「归 DEBT0012」，**主 Agent 已裁决不予采纳**（定性有误）。证据链（主 Agent 独立取证）：

1. `git log -S'"team_id": "frontend-team"' -- scripts/seed-data/markdown-test/meta.json` → 唯一命中 **`59182590`**（`feat(seed): 给 seed entry 指派团队（TPV0095）`，2026-09-03）
2. `viewer.spec.ts` 最后一次全绿 = **`d4b05ee4`**（`wf(TPV0088-P5)`，E2E 38/38，2026-08-12）
3. `git merge-base --is-ancestor d4b05ee4 59182590` → **YES** → 加 `team_id` 的时序明确，**TPV0095 是回归成因**

**与 DEBT0012 的关键区别**：DEBT0012 =「seed 脚本 team 创建时序 → **入库失败/数据缺失**」（可重跑恢复）；本项 =「**数据完好、但匿名可见性语义变了**」（`markdown-test` `is_public:true` 却带 `team_id` → 匿名 404，**重跑不恢复**）。二者根因与修复面不同，挂 DEBT0012 会污染该条目的根因与 closure_criteria。

**归属**：这是全仓 E2E 基建层问题（TPV0095 改了 3 条 seed 可见性、未同步依赖它们的既有 spec），属 **TPV0097/TPV0098「用例可信治理」**范围，**不属 TPV0099**。本任务已通过「E2E 键全部指向新建 spec」完全隔离其影响。

→ **汇总要求**：若两份评审中有人建议"为 viewer.spec 立 DEBT 条目"或"归 DEBT0012"，请按上述裁决**标记为已由主 Agent 处理**，不必要求 architect 修订（它不是 `P2-design.md` 的缺陷——§6.3 已正确说明"既有 spec 不作 gate 键"）。若你认为证据链有反例，**明确指出并给出反证**（这才是有价值的汇总）。

### A.2 banner 遗漏面 + `[P1_CORRIGENDUM]`：已裁决「不处理 + P2 就地更正」

- banner（`.archived-banner`/`.expired-warning-banner`）**本任务不处理**——决定性理由：`/{slug}/f` 复用 zen 类 → banner 在**今天的 zen 态就已可见**（既有行为）→ 本任务对其**视觉状态增量为零**，纳入即虚假验收面；另一理由：匿名 `legacy-deploy` 404，与"分享给匿名接收者"的核心故事不相交
- **汇总要求**：只判定 `P2-design.md` 是否**如实落实**（Not Modify N12 + Risk R-04 + §6.5 钉定 seed + `[P1_CORRIGENDUM]`），**不要讨论该不该这样裁**

### A.3 `P5_e2e` 假绿风险：主 Agent 已实核，请**独立复核**而非采信

`scripts/run-e2e-tests.sh:78` = `spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` → **裸 `make debug-test` 只跑 1 条 spec**。若 `P5_e2e` 写成裸 `"make debug-test"` → P5 绿灯但 19 条 BDD 的 E2E 层零覆盖（最坏一类假绿）。

`P2-design.md` 当前写法（主 Agent 已核）：`P5_e2e` + `P5_e2e_auth` 两键均用 `E2E_SPEC=` 定向、各 900s、**全文无裸 `make debug-test`**。

→ **汇总要求**：若 `plan-eng-review` 已实证复核过此项**且无异议**，直接采信其结论；**若两份评审在此项上冲突或都未复核**，你必须自己打开 `scripts/run-e2e-tests.sh` 与 `Makefile` 判定（这是门槛项，不可悬空）。

### A.4 一条本阶段的方法论提醒（P1 教训的延续）

P1 出现过两次"判据看似正确实则失效"，均靠**独立复核**（而非自述核对）捕获。P2 的同类风险是「gate_commands 看似齐备但真实不执行」与「方案声称复用 zen 但实际误改全局 zen / 吞掉内容区 Escape」。

**主 Agent 自身也已踩过一次同类坑并记录在案**：主 Agent 用 `importlib` 按路径加载 `check-gate.py` 调 `_gate_p2_ui_design_section`，因缺 `sys.path` 注入而走到内联**降级 stub**（`return (None,"","")`），得到**与真实 gate 相反的 `False`**；补 path 后复跑 = `True`。→ **教训：验证工具本身也要被验证**。若你在汇总中要给出"某 gate 检查不过"的判定，请用 `check-gate.py` 的**真实 CLI 入口**跑，而非自造探针调内部函数。

---

## 附录 B（主 Agent 于派发前追加，2026-09-28）：两份评审已回报 —— 汇总时的**已核事实与语义校准**

两份职能评审**均已完成**，且**都判存在阻塞级问题**。请按下列已核事实汇总，**不要重新翻案、也不要放过**。

### B.1 两方各自的终态与**语义校准（本次汇总最关键的一点）**

| 评审 | 文件 | 其 status | 阻塞级数 |
|---|---|---|---|
| plan-design-review | `P2-review-design.md` | `needs-revision` | 2 |
| plan-eng-review | `P2-review-eng.md` | `rejected` | 2 |

**语义校准（必须转述，否则会被读成"方案被否"）**：`plan-eng-review` 的 `rejected` **不是**"方案方向被否决"。它自述其取值**受工具枚举约束被迫**——主 Agent 已独立复核该约束为真：`agate-md-field-set.py` 的 `STATUS_ENUM_BY_BASENAME` 是**按文件名**映射的，实测：

```
P2-review.md        -> {approved, draft, needs-revision, rejected}   ← 含 needs-revision
P2-review-design.md -> {approved, done, draft, rejected}             ← 不含
P2-review-eng.md    -> {approved, done, draft, rejected}             ← 不含
```

即**只有汇总文件 `P2-review.md` 才允许 `needs-revision`**；两份职能评审文件因不在该映射表内、落到 `DEFAULT_STATUS_ENUM`，**写不了 `needs-revision`**，故 eng-review 只能以 `rejected` 表达"须修订再审"。它正文已明确声明：两处阻塞项均为**固化面定点修订**，**方案 A / R1-R3 结论 / gate 键形态与超时档位均无需动**，**骨架无需重选、无需回退 P1**。

→ **你要做的**：在 `P2-review.md` 里给出**你自己的终态**。按 review-mapping 的语义，两方均为"需补充/修订"而非"方向性打回"时，**应判 `needs-revision`**（`P2-review.md` 允许该值）。**不要**简单照抄 eng-review 的 `rejected` 字面——那会误导主 Agent 判为方向性返工。

### B.2 去重结论（**两方提的是同样两个问题**，务必合并为 2 条并记双锚点）

主 Agent 已比对确认两组是同一缺陷的两个视角，**不是四个独立问题**：

- **合并①：锁死态接口规格的固化面缺陷** = design-review 的 **G-1** ≡ eng-review 的 **BLOCKER-2**
  - design-review 视角：M2/M3 与 §2.1/§3.2 三种写法互斥（thunk / 落 ref / 裸值）
  - eng-review 视角：**打红已固化 gate 键**（`route.meta.zen` 使 `t031`/`t067` 缺 `meta` 的 `useRoute` mock 挂载即抛 `TypeError`；`updateZenAria` 写 computed → TS2540）→ 命中 `P3`/`P5`/`P6`（三键同为 `make test-frontend`）与 `P5_typecheck`
  - **合并后锚点**：`P2-design.md:46`(M2) / `:47`(M3) / `:119-121`(§2.1) / `:210`(§3.2) ↔ `t031-entry-detail-view.spec.ts:164-168` / `t067-detail-framework.spec.ts:173-177` / `useZenMode.ts:8,34`
- **合并②：BDD-10 认证前提不可执行** = design-review 的 **G-2（其自标 `[跨域]`）** ≡ eng-review 的 **BLOCKER-1**
  - 双方独立实测同三条服务端约束（匿名创建强制 `is_public=True` / share 端点 `require_auth` / 公开 entry 禁建 share），并**都跑通了唯一可行路径**（alice 建私有 → alice 建 share → 匿名 `?share=` 可读；无 token/bogus token 不可见 = 区分力为真）
  - **合并后锚点**：`P2-design.md:480,482`(§6.1) ↔ `api/entries.py:136-139` / `api/shares.py:23,41,57` / `services/share_service.py:54-55`

### B.3 主 Agent 已独立复核为真的关键证据（可直接采信，不必重跑）

- `t031-entry-detail-view.spec.ts:105-106` 与 `t067-detail-framework.spec.ts:118-119` 均 `vi.mock('@/composables/useZenMode')`；但二者 `useRoute` mock **均无 `meta`** 且**都真实 `mount(EntryDetailView)`**（`t031:203` / `t067:237,252`）→ M3 裸值在组件内求值、不受 composable mock 保护。主 Agent 实测这两 spec 当前 **2 files / 29 tests 全绿**
- 匿名 POST 建 entry 强制转公开 = `api/entries.py:135-138`；share 需登录 = `api/shares.py:24`；公开 entry 禁建 share = `services/share_service.py:54-55`
- **统计口径校准（主 Agent 已复核，注意别误判成"设计写错"）**：设计 `env_constraints` 与派发指引写的"alice 22 / 匿名 15"**是"全新 seed 后"的正确值**（主 Agent 已实测复现：debug 服务重启后全新 DB 双跑 `make debug-seed` → alice 22 / 匿名 15，与现文逐字一致）；评审期观察到的 **alice 26 / 匿名 19** 是**同一 DB 被 E2E 自建 slug 累积污染后**的值。**两者都是真值、只是时点不同** → 请作为**非阻塞须登记项**，结论措辞应为「**计数随 E2E 残留漂移，不可作断言基准；P6 前重跑 `make debug-seed` 或按 slug 精确断言**」，**不要**写成"设计值有误、应改为 26/19"（那会把一个时点值当成新基准，是同一类错误的镜像）
- 附录 A 四项（`P5_e2e` 定向 / 900s / spec→BDD 映射 / 无 `&&`）**两方均核为合规**，且 eng-review 补测「缺失 spec → `No tests found` + exit 2 → fail-closed 不假绿」→ **最坏一类 E2E 假绿不存在**，请在汇总中确认此结论

### B.4 债务登记：**你不要写 `tech-debt.md`**

eng-review 建议登记 `DEBT0014`（zen 隐藏集不含 archived/expired banner）。按派发指令，**组长不直接写债务登记簿**——请只在汇总里给出结论与建议编号，**由主 Agent 统一决定是否登记与编号**（主 Agent 已注意到它建议避开协议层占用的 `DEBT0013`）。

同时提醒：architect 曾建议把 `viewer.spec.ts` 的 18 failed **归 DEBT0012**，**主 Agent 已裁决不予采纳**（根因是 TPV0095 加 `team_id` 的 seed 语义回归，与 DEBT0012 的"入库失败"不同源；归属 TPV0097/TPV0098）。若某方评审重提此议，按「已由主 Agent 处理」记录，并要求其**给出反证**才可翻案。

### B.5 若两方对同一项判断冲突

主 Agent 目前**未发现实质冲突**（两方在两个阻塞项上完全一致）。若你读出的结论不同（例如你认为某项其实不阻塞），**必须给出你自己的实证锚点**再判——P1 的教训是"独立复核"而非"取更严格的"。
