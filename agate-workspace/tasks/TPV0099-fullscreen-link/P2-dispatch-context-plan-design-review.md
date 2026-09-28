# P2-dispatch-context-plan-design-review — TPV0099

---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: plan-design-review
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

> ⚠️ 以下派发指引是本次任务的强制指令。**只审不写**：不修改 `P2-design.md`。

## 目标

独立评审 TPV0099 的 P2 方案设计（`P2-design.md`）的**前端/UI 维度**：路由与状态承载方案是否与既有 zen 机制自洽、UI 设计节是否与 P1 的 19 条 BDD（尤其 UX 类别 BDD）逐一可落地、锁死语义的边界划分是否正确。产出 `P2-review-design.md`。

## 你是独立视角

architect 在隔离上下文里写的方案可能有盲区。**不要转述其自述**——对关键声明回到源码 grep/read 实证。P1 阶段已实证过两个反例：**① BDD 判据与自身需求互斥（必 FAIL）② 修完反向失效为恒真（必 PASS）**。P2 阶段同类风险是"方案声称复用 zen 但实际会误改全局 zen"或"锁死短路会吞掉内容区 Escape"——请专门核这两点。

## 职责范围（C8 映射：domains 含 frontend → plan-design-review）

- 前端交互/状态设计是否与既有 `useZenMode` + `ZenModeKey` provide 面自洽
- `## UI 设计` 节：渲染形态声明（须复用 P1 的 `ui_render_shape: layout` 规范值）+ 维度选择（P1 的 `ui_ux_dimensions`：布局结构/交互行为/视觉呈现）+ 按形态 checklist 是否齐备且可执行
- 每个 UX 类别 BDD（BDD-2 布局结构 / BDD-3 视觉呈现 / BDD-4~7 交互行为 / BDD-14 移动端）在方案里是否有明确落点
- 移动端（390×844）与桌面（1280×800）双视口是否都被方案覆盖
- **工程侧（数据流/接口契约/测试策略/架构债）由 plan-eng-review 负责，你不必覆盖**——避免与另一评审重复

## 本项目已实证的关键事实（可直接采信；独立复核出矛盾请报告）

**A. zen 机制现状（P1 已核）**
- `useZenMode.ts`（36 行）：`zenMode` ref + `zenAriaText`（硬编码 `'Zen mode on. Press f or Escape to exit.'`）+ `handleZenKeydown`（**无锁死概念**）
- 键盘监听挂在 **`document` 级**：`EntryDetailView.vue:216` `document.addEventListener('keydown', handleZenKeydown)`
- `shouldHandleZenShortcut`（`utils/zen-shortcut.ts`）是**纯函数**，只判"是否该处理快捷键"，**不持有 zen 状态** → P1 结论：锁死短路应在调用方 `useZenMode` 实现，不改该 util
- provide 面：`entryDetailKeys.ts` 的 `ZenModeKey: Ref<boolean>` / `IsMobileKey` / `ZenAriaTextKey: Ref<string>`；消费方 2 个组件（`EntryDetailHeader.vue:142` / `EntryDetailMobileBar.vue:97`）

**B. zen 隐藏集 = 8 项 + 3 处机制**（P1 §4.2 表格；**若方案新造隐藏规则而非复用 zen 类，必须覆盖全部 8 项**）
- `layout.css:208` `.zen-mode .resize-handle`（第 8 项，易漏）
- `layout.css:649-654` 6 项：`.detail-header`/`.file-sidebar`/`.toc-sidebar`/`.mobile-actions`/`.mobile-sticky-header`/`.mobile-bottom-bar`
- `EntryDetailView.vue:260`（scoped）：`.meta-tags-bar`
- 两处 `v-show="!zenMode"` 兜底：`EntryDetailHeader.vue:3,13`、`EntryDetailMobileBar.vue:2`
- **未纳入任何隐藏规则**的 banner：`.expired-warning-banner` / `.archived-banner`（`EntryDetailBanners.vue`）

**C. Escape 多消费方（锁死边界的关键）**
- `TableView.vue`：**元素级** `@keydown`（`:68,77`；Escape 分支 `:227` / `:243`）→ **在内容区内**，是 BDD-7 的对象
- `ShareDialog.vue:218` / `OverflowMenu.vue:150`：**`document` 级**（P1 rev1 已更正）→ 全屏下入口在 header/mobile bar（已隐藏）故无从打开
- 图表全屏弹层（Mermaid/Svg/PlantUmlRenderer 的 `.diagram-modal`）：**当前无任何 Escape 监听**（只支持点遮罩/点 × 关闭）→ 锁死与它**当前不冲突**

**D. `/{slug}/f` 现状（主 Agent 实测）**
- 浏览器 accept → **HTTP 200 + NotFoundView**（命中 `/:pathMatch(.*)*`；`.entry-detail` 不存在）
- `Accept: application/json` → **404**（走 `resolve_entry_raw("slug/f")`）
- 对照 `/{slug}/raw` → **302** 重定向
- 现存两段路由仅 `/settings/apikeys`（静态 redirect）与 `/users/:username` → 与 `/:slug/f` **无冲突**

**E. BDD-3 判据的特殊约束（P2/P4 实现期必须知道）**
BDD-3 的排除集是 **A/B 两组不对称规则**：A 组结构链 `html`/`body`/`#app`/`.entry-detail` 取"自身+全部祖先，**不含后代**"；B 组内容流链 `.detail-content`/`.content-area`/`.markdown-viewer` 等取"自身+全部后代"。文中明写"两组不可互换、不可统一写成祖先/后代"。**已实测证明**：统一写成祖先/后代会让判据退化（正确实现判 PASS、两种失败态也判 PASS → 恒真）。若方案涉及"为锁死态新造隐藏规则"，须评估是否影响该判据。
实测基线（三态）：①正确实现命中 **0**；②`.detail-header` 强制可见命中 **3**；③注入未纳入隐藏集的满宽横条命中 **1**。

**F. 环境与工具**
- debug `http://127.0.0.1:8888`（**主 Agent 已起并挂长托底 job**；version 0.24.1；seed 22 条 / 匿名 15 条）
- Chrome CDP `:18800`；Playwright 用全局包 `require('/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules/playwright')`（`npx tsx` 不可用，npm 缓存只读）；须 `try/finally { await page.close() }` + `process.exit(0)`，**不要** `browser.close()`
- 前端测试基线：`Test Files 110 passed` / `Tests 1343 passed | 4 skipped (1347)`
- E2E 双 project：chromium（Desktop Chrome）+ Mobile Chrome（Pixel 5），`baseURL` 默认 `:8888`，无 webServer 自启
- **DSH 沙箱**：`/tmp` 与 `~/.local/share` 只读；`/tmp` 跨 bash 调用不共享；临时产物落 `{project_root}/.agate-tmp/`
- **seed 数据坑**：`is_public: true` ≠ 匿名可达（带 `team_id` 的 `csv-employees`/`markdown-test`/`mermaid-charts` 匿名 404）；`make debug-seed` 默认 `tail -10` **截断 FAIL 行**

## 输入文件
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-design.md`（**评审对象**）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md`（19 条 BDD + §4.2 隐藏集 + §8 风险登记）
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-dispatch-context-architect.md`（architect 的派发指令，含 R1/R2/R3 开放点——判定"是否落实"
- `agate-workspace/tasks/TPV0099-fullscreen-link/P0-brief.md`
- `frontend-v3/src/composables/useZenMode.ts`、`frontend-v3/src/utils/zen-shortcut.ts`、`frontend-v3/src/composables/entryDetailKeys.ts`、`frontend-v3/src/views/EntryDetailView.vue`、`frontend-v3/src/components/EntryDetailHeader.vue`、`frontend-v3/src/components/EntryDetailMobileBar.vue`、`frontend-v3/src/components/TableView.vue`、`frontend-v3/src/router.ts`、`frontend-v3/src/styles/layout.css`
- `/home/kity/.agate/v0.76.0/agate/assets/review-roles/plan-design-review.md`（角色定义）
- `AGENTS.md`（项目约定）

## 产出
- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-review-design.md`
- frontmatter 用 `FILE=<产出路径> python3 /home/kity/.agate/v0.76.0/agate/scripts/agate-md-field-set.py --list` 查看后逐个写入：`phase: P2` / `task_id: TPV0099` / `parent: P2-design.md` / `trace_id: TPV0099-P2-20260928` / `agent: plan-design-review` / `status: draft`（评审后改终态 `approved`/`rejected`/`needs-revision`）
- 输出结构按角色文件：架构问题（阻塞级）/ 架构问题（非阻塞）/ 结论

## 约束
- **只审不写**：不修改 `P2-design.md`
- status 终态必须与返回摘要一致（主 Agent 读 Header）
- 正文避免行首 `- PASS` / `- FAIL` 预判格式
- 子派发能力：不启用
- 若在评审中判定"存在后续应重构/架构债"，须用标准 DEBT 条目格式（模板 `{agate_root}/assets/templates/tech-debt-template.md`，`evidence` 必填）——**但不要直接写入** `{AGATE_WORKSPACE}/debt/tech-debt.md`（主 Agent 统一登记）

## 命令超时（强制）
任何 bash 命令设 `timeout 180s <cmd>`（Playwright 300s）。超时/非预期失败 → 停止，不换命令不深挖，返回主 Agent。

## 环境隔离（强制）
只用 debug `:8888` + CDP `:18800`。**严禁**触碰生产 `:8080` 与 `~/.peekview/`。状态标记二值格式：`[PROD_TOUCHED] {描述}` / `[PROD_NOT_TOUCHED]`。

## 返回给我（只两行）
1. 产出文件路径
2. 一句话摘要（≤30 字，含终态 status + 阻塞级问题数）

**不要返回文件全文。**

> 本文件不含通过/失败预判。

---

## 附录 A（主 Agent 于派发前追加，2026-09-28）：`## UI 设计` 节 + 两项已裁决事项的核对

### A.1 两项主 Agent 已裁决事项 —— 判定「是否落实」，不要重新翻案

architect 中途上报了两个问题，主 Agent 已裁决，请在 `P2-review-design.md` 里**核对 `P2-design.md` 是否如实落实**，而不是重新讨论该不该这样裁：

**(1) `EntryDetailBanners` 的 `.archived-banner` / `.expired-warning-banner` —— 裁决：本任务不处理、不改隐藏集、不增补 BDD**
- 已核事实：二者**不在 zen 隐藏集**（`layout.css`+`EntryDetailView.vue` 均 0 命中，唯一定义在 `EntryDetailBanners.vue`）；zen 态下 `.archived-banner` 仍 `display:flex`/1280×49/top=0 → 满足 BDD-3 拦截条件、且不在其 A/B 排除集内
- **不处理的决定性理由**：`/{slug}/f` **复用 zen 类**（P0 决策③+P1 结论）→ banner 在**今天的 zen 态就已可见**（既有行为，早于立项）→ 本任务对该 banner 的**视觉状态增量为零**。本任务新增的是 **URL 入口**，不是新可见状态 → **不是本任务引入的回归**，纳入即等于为"实现前后逐像素一致"背书（虚假验收面）
- 第二理由：匿名 `legacy-deploy` 404（需 alice）→ 与"分享给匿名接收者"的核心用户故事不相交
- **你要核对的**：`P2-design.md` 的 **Not Modify** 栏是否列了这两条 banner（含上述理由）；**Risk** 栏是否登记为 `[SCOPE+]` 建议（而非被静默忽略）

**(2) `[P1_CORRIGENDUM]` —— 裁决：P1 不改（已 approved+committed），由 P2 就地更正**
- 已核事实：`P1-requirements.md:359`（§4.2）写「当前 seed **无**过期/归档 entry」，但同文件 `:403`（§5）写着 `legacy-deploy`「**确实在 debug DB 中**……`status=archived`」→ **P1 内部自相矛盾，§4.2 该句为假**（非方向性，不重开基线）
- **你要核对的**：`P2-design.md` 是否以 `[P1_CORRIGENDUM]` 形式就地更正了该句（预期表述：seed 中存在 1 条 archived entry `legacy-deploy`，alice 可达/匿名 404，其 banner 不在 zen 隐藏集内）

**(3) BDD-3 验证须钉定 seed —— 属 architect 职权内（"如何验证"，非范围扩大）**
- 风险：BDD-3 的 Given **entry 无关**（仅"桌面 1280×800 + 全屏视图已加载"）→ P6 若挑到 archived/expired entry，会在**与本任务无关的既有条件**上判 FAIL，并被误读为"本任务实现错了"
- **你要核对的**：`P2-design.md` 测试策略是否明确写出 **BDD-1/2/3 的 E2E 钉定非归档非过期 seed（推荐 `dsh-architecture`，与 P1 rev2 自证一致）** + 理由

### A.2 `## UI 设计` 节（P2 gate 硬校验，请按 gate 口径逐项核）

已核 gate 实现口径（`check-gate.py` 的 `_gate_p2_ui_design_section`），缺任一即 exit 1：
- 节标题 `## UI 设计`
- **渲染形态声明**：须为 `渲染形态:` 行，**规范化值必须与 P1 的 `ui_render_shape: layout` 一致**（P1 已声明时 gate 会做规范化值比对；不一致 → exit 1）
- **维度选择**：`适用维度:` 行（P1 为 `ui_ux_dimensions`: 布局结构/交互行为/视觉呈现）
- **常规布局型 checklist**：`布局` / `交互` / `视觉` **三个关键词各须至少出现一次**（或显式声明该维度"不适用"）——注意 gate 是按**关键词**判的，三个词都要真实出现
- 请同时判定该节是否**可执行**（落到具体断言/选控件），而非只有名目

### A.3 你的既有专项（重申）

- **R2 是否真能做到"区分锁死态与 zen 态"**：architect 实测定论为 `zenMode` 必须是 **route.meta 派生的 computed**（候选 C 的 setup 一次性 ref 实测有残留 zen + f 键永久失效；`watch` 无 immediate 会 FOUC）。请**独立复核这个结论与 BDD-4/BDD-12 的成对拦截是否闭合**（即：实现按此写，f 键 zen 确实不会被锁死）
- **R3 是否真能不吞内容区 Escape**：定论为「locked 时整个 handler `return`（不 preventDefault、不 stopPropagation、保持 bubble 相位）」。**重要**：P1 §2.1 把"吞掉"归因于 `preventDefault` 是**方向性误述** —— architect 实测真正吞掉元素级的是 **capture 相位 + stopPropagation**。请核对 `P2-design.md` 是否把这个澄清写成了 P4 护栏（否则 implementer 会按 P1 原措辞去防一个不存在的坑、而踩中真正的坑）
- 双视口（桌面 1280×800 / 移动 390×844）是否都被方案覆盖
