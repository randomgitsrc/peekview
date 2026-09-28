# P2-dispatch-context-architect-rev1 — TPV0099（**增量修订轮**）

---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: architect
retry: 1
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

> 本文件是 **P2 retry 1/3** 的**定点修订**派发指令（P2 retry_cap = 3，预算充裕）。
> **这是增量指令，不是完整派发上下文**——第一轮上下文见 `P2-dispatch-context-architect.md`（含阶段卡片 AGATE_CARD 与全部约束），本文件只写**本轮要改什么**。
> 未点名的节**一律保持原样**，不要顺手改动、不要重做候选方案。

---

## 0. 一句话任务

两份独立评审（`P2-review-design.md` 判 `needs-revision`、`P2-review-eng.md` 判 `rejected`——后者系工具枚举所迫，语义同为"须修订再审"）**均确认方案骨架成立、无需重选候选**，但发现 **2 个阻塞级固化面缺陷**。你的任务：**定点修订 `P2-design.md`，只改这两处（约 6-8 行规格文本 + §6.1 一段前提），改完回报**。

### ⚠️ 权威修订指令的位置（先读这个）

**组长已汇总出统一评审文件 `P2-review.md`，其「§5 修订指令」是你的权威修订清单**，粒度比本文件更细（逐处行号 + 为什么 + 验收判据）。**请先完整读 `P2-review.md` 的 §2.1 / §2.2 / §5.1（R-1）/ §5.2（R-2）/ §5.3**，再执行。

- **`P2-review.md` §5 = 权威**（组长汇总，主 Agent 已复核采纳）
- 本文件 §1 / §2 = **问题框架与实证证据**（帮 you 理解"为什么要这样改"），若两者表述有差异，**以 `P2-review.md` §5 为准**

### 相对本文件初稿的**补充要求**（组长汇总时新增，务必一并落实）

1. **`P2-design.md:118` 的代码草图注释**：把「（形态示意，非最终代码）」改为「**签名与调用形态为最终规格，P4 照此实现**」——**这是本缺陷的根因**：草图与 M 栏同为规格却标注不同权威级，导致 P4 照抄清单、忽略草图。**必须改**。
2. **`updateZenAria` 的处置已由组长定论为「移除」**（非"no-op 或移除"二选一）：全仓非测试代码零消费方（`useZenMode.ts:34` 仅导出、`:16/:25` 仅内部调用），故**从返回对象一并移除该键**；`zenAriaText` 改为 computed，锁死文案分支由 computed 承载。附带：两处 spec mock（`t031:106` / `t067:119`）的 `updateZenAria: vi.fn()` 字面量**键名不变即可继续使用**（多出的键无害），故**无需改这两处 mock**。
3. **M9 单测（`frontend-v3/src/composables/__tests__/useZenMode.spec.ts`）须补一条用例**：「**锁定态派生随 route meta 翻转**」。理由：这是 §2.4/§3.2 **自己声明**的不变量（"不落 ref、随 route 响应式翻转"），也是**排除第三种假绿读法的唯一可执行判据**——不补则该不变量无 gate 承担。
4. **`files_to_read` 补两条**（现清单零 share 条目）：除 `frontend-v3/e2e/t058-share-redesign.e2e.spec.ts` 外，**另补 `backend/peekview/api/shares.py:18-23`**（三个 share 端点 `Depends(require_auth)` 的契约，说明为何匿名路径不可行）。
5. **R-2 的清理判定再精确一步**：`afterEach` 清理队列存 **`{slug, share_id}` 二元组**（而非仅 slug），清理后**以 alice 复查 `GET /api/v1/entries/{slug}/raw` = 404** 作为"无残留"判定；并同步更新 **`env_constraints.auth_premise`（`:660`）** 为"**登录创建**私有 entry + 登录建 share + 登录删除（afterEach 存 `{slug, share_id}`）"。

### 第三种假绿读法（组长补充，**务必理解，它决定修订目标是"唯一化"而非"消除报错"**）

除"裸值抛错"与"TS2540"两个报错分支外，还存在**第三种更隐蔽的读法**：若 P4 为消解类型冲突而把签名改成 `locked: boolean`（M3 裸值字面因而"类型通过"），配合可选链可**同时通过 `make typecheck` 与 `make test-frontend`** —— 但该写法把锁定态固化为 **setup 期一次性快照**，与 §2.4/§3.2 声明的"不落 ref、随 route 响应式翻转"不变量相悖（组件复用前提已实测：`onMounted` 仅 1 次、DOM 节点同一）→ **最坏结果是假绿**。

→ **故修订目标是「把形态唯一化」，不是「消除两个报错」**。只把报错消掉而留形态歧义，等于把假绿留在设计里。

**不要动**：方案 A 的选择、R1/R2/R3 三个开放点结论、`gate_commands` 的键形态与超时档位（评审已四项核查全部合规）、候选方案权衡、影响面 Modify/Not Modify/Risk 主体、UI 设计节。

---

## 1. 阻塞项①（合并自 design-review **G-1** ≡ eng-review **BLOCKER-2**）：M2/M3 接口规格自相矛盾，且按 M3 字面实现会**打红本任务自己声明的 gate 键**

### 问题（主 Agent 已独立复核为真）

`P2-design.md` 对"锁死态如何承载、调用点如何传入"给出了**三种互不兼容的写法**，而 P4 implementer 照抄的是**文件级清单 M2/M3**（§2.1 自述"形态示意，非最终代码"）：

| 出处 | 现状原文 | 形态 |
|---|---|---|
| §2.1 `:119` | `useZenMode(locked: () => boolean = () => false)` | **thunk**（权威） |
| §2.1 `:121` | `computed(() => locked() \|\| manualZen.value)` | 调 thunk |
| M2① `:46` | 「新增 `locked` 入参与 `lockedMode` **状态**」 | **暗示落 ref** ← 与 §3.2 `:210`「**不落 ref**（computed）」冲突 |
| M2② `:46` | `computed(() => lockedMode.value \|\| manualZen.value)` | 读 `.value`（Ref 语义）← 冲突 |
| **M3 `:47`** | 「传入 **`route.meta.zen === 'locked'`** 作为锁定入参」 | **裸 boolean 值** ← 第三种形态 |
| M2③ `:46` | 「`updateZenAria` 增加锁死分支」 | ← 与 M2② 的 computed 化冲突（TS2540） |

### 两条已实测的打红路径（主 Agent 与 eng-review 各自独立复现）

1. **`route.meta.zen` 裸值 → 既有 spec 挂载即抛**
   - `frontend-v3/src/components/__tests__/t031-entry-detail-view.spec.ts:164-168` 与 `t067-detail-framework.spec.ts:173-177` 的 `useRoute` mock **都没有 `meta` 键**，且两者**都真实 `mount(EntryDetailView)`**（`t031:203` / `t067:237,252`）
   - 二者虽 `vi.mock('@/composables/useZenMode')`（`t031:105-106` / `t067:118-119`），但 M3 的裸值表达式是在 **`EntryDetailView` 组件代码内**求值的 → **不受 composable mock 保护**
   - 主 Agent 实测：这两 spec 当前 **2 files / 29 tests 全绿**；按 M3 字面实现将 `TypeError: Cannot read properties of undefined (reading 'zen')` → **打红 `P3`/`P5`/`P6`（三键同为 `make test-frontend`）**
   - 主 Agent 已实核修法有效：`route.meta.zen` **抛异常**；`route.meta?.zen === 'locked'` **返回 `false`**（安全）
2. **`updateZenAria` 写 computed → TS2540**（`P5_typecheck`）
   - `zenAriaText` 变 computed 后，`useZenMode.ts:9` 的 `zenAriaText.value = ...` 赋值触发 TS2540（只读属性不可赋值）→ **打红 `P5_typecheck`**
   - 主 Agent 已核：`updateZenAria` 在 `useZenMode.ts:8,16,25,34` 仅内部引用，**全仓非测试代码零消费**

### 要求的修订（**权威清单见 `P2-review.md` §5.1，逐处行号齐全**；下方为提要）

1. **M2①（`:46`）改述**为：「新增 `locked: () => boolean` **入参**（默认 `() => false`）；锁定态为**只读派生**，**不落 ref**」
2. **M2②（`:46`）**：把 `lockedMode.value` 改为 **`locked()`**
3. **M2③（`:46`）定论为「移除 `updateZenAria`」**（非同前稿的"no-op 或移除"）——`zenAriaText` 已是 computed，文案分支由 computed 承载；并从返回对象移除该键
4. **M3（`:47`）改述**为：「传入 **`() => route.meta?.zen === 'locked'`**（**thunk + 可选链**，**勿传裸值**）」
   - ⚠️ **必须同时是 thunk 且带可选链**——thunk 解决签名一致，可选链解决 mock 缺 `meta`。二者取其一都不够
   - 钉定可选链后，**既有两处 `useRoute` mock 无需改动**；若你选择不加可选链，则**必须**把 `t031:164-168` / `t067:173-177` 补 `meta` 并**列入 §1.1 M 栏**（二选一，须显式声明取哪个，**不得留"待决定"**）
5. **`P2-design.md:118` 草图注释**改为「**签名与调用形态为最终规格，P4 照此实现**」（**根因修复，必改**）
6. **§1.1 M 栏补充**：声明上述二选一的路径
7. **§2.1 风险①（`:136`）更正**：补前提「"既有 mock 仍兼容"**仅对 thunk 形态成立**——mocked 时 thunk 从未被调用；裸值形态在**调用点**求值，早于 mock 拦截」
8. **M9（`:53`）补一条单测**：「锁定态派生随 route meta 翻转」

### 验收判据（改完自查）

- `locked` 的**签名 / 调用点 / 读取方式**三者**唯一**：签名 `() => boolean`、调用点传 thunk、读取用 `locked()`；全文不再出现 `lockedMode`（或出现时明确其为 `computed(() => locked())` 且注明"非状态存储"）
- `route.meta` 访问处**带 `?.` 可选链**（或明确声明改 mock——二选一，写明）
- `updateZenAria` **已移除**（含返回对象）
- `:118` 草图注释已改为"最终规格"；`:136` 兼容性断言已补 thunk 前提
- **实现前**（本修订只改文本）跑 `make test-frontend` 与 `make typecheck`：**均保持绿**，既有两 spec **29 tests 全绿**

---

## 2. 阻塞项②（合并自 design-review **G-2** ≡ eng-review **BLOCKER-1**）：BDD-10 认证前提写反，按现规格**不可执行**（或退化为恒真假绿）

### 问题（两方独立实测同三条服务端约束，主 Agent 已复核）

`P2-design.md:480,482`（§6.1）要求 BDD-10「**匿名创建 + 匿名删除**（成对）」，但 BDD-10 的 Given 是「**私有** entry + 有效 share token」——二者**服务端不可共存**：

1. **匿名创建被强制转公开**：`backend/peekview/api/entries.py:135-138`「Anonymous users forced to is_public=True」（主 Agent 已核）
2. **share 端点需登录**：`backend/peekview/api/shares.py:24` `Depends(require_auth)` → 匿名 POST `/shares` **实测 401**
3. **公开 entry 禁建 share**：`backend/peekview/services/share_service.py:54-55`「Public entries don't need share links」→ **实测 400**

→ 结论：按现规格，要么该条 E2E **不可实现**，要么**退化为恒真断言**（公开 entry 本来就匿名可读 = 假绿）。
→ **根因**：把 TPV0096 针对**公开 fixture** 的"匿名建+匿名删"铁律，**误移用**到了**私有 + share token** 场景。

### 唯一可行路径（两方均已跑通）

**alice 建私有 entry → alice 建 share → 匿名带 token 访问**：
- 匿名 `?share=<token>` → **200 可见正文**；**不带 token / bogus token → 均不可见**（区分力为真）
- 参考先例（eng-review 要求补进 `files_to_read`）：`frontend-v3/e2e/t058-share-redesign.e2e.spec.ts:33-56,80-88`（登录 → Bearer 建私有 → Bearer 建 share 的既有范式）

### 附带更正（design-review 实测，方向与现文相反）

现 §6.1 担心的"匿名建、带 token 删被拒 → 404 静默残留"**方向是反的**：实测**匿名 DELETE 可删 alice 私有 entry 返回 200**（`api/entries.py:477-478` 的 `allow_local = no_server_auth and current_user is None`，debug 无 server api_key 时放行）。
→ **清理对抗衡应落在"删除后以 alice 复查 404"**（证明真删掉了），而非"以匿名删除成功为清理证据"。

### 要求的修订

1. **§6.1 的 BDD-10 行前提列**：改为「**alice 登录建私有 entry → alice 建 share → 匿名带 token 读**；清理 = alice 删除后**以 alice 复查 404**」
2. **`P2-design.md:480,482` 的"匿名创建 + 匿名删除（成对）"表述删除/改写**为上述路径
3. **§8 `files_to_read` 补**：`frontend-v3/e2e/t058-share-redesign.e2e.spec.ts`（share 建/撤销范式先例；现 §8 **零 share 条目**）
4. **§6.1 的"切分轴 = 认证前提"结论保留**（评审认可该轴），但 BDD-10 归入 auth spec 的理由须与新路径一致（它现在确实需要 alice 登录态）

### 验收判据

- §6.1 中 BDD-10 的认证前提与清理方式**与上述可行路径一致**，不再出现"匿名创建私有 entry"
- `files_to_read` 含 share 范式先例
- 全文中"匿名创建 + 匿名删除（成对）"的表述**已清除**

---

## 3. 非阻塞项（**建议随本次一并处理，但不构成退回理由**）

评审列出非阻塞 5 条 + 测试缺口 6 条。**请顺带处理以下低成本项**（其余若判断需大改则**不要动**，在本轮回报里说明留待后续）：

- **N-1 / design-review 非阻塞**：**双 project 默认视口 = 1280×720 / 393×727，两个都不是 BDD 要求的 1280×800 / 390×844** → 建议在 §6.1 或 §6.5 写明 P3 须按 `tpv0091` 范式**显式 `test.use({ viewport })`** 钉定视口（判据动态取 `innerHeight` 故非必然失败，但应显式化）
- **统计口径说明（建议补述，非"改错"）**：`env_constraints` 现写"alice 22 / 匿名 15"——**主 Agent 已实测该值是"全新 seed 后"的正确值**（重启后全新 DB 双跑 `make debug-seed`，实测 alice 22 / 匿名 15，与现文逐字一致）。评审期实测到的 alice 26 / 匿名 19 是**同一 DB 被 E2E 自建 slug 累积污染后**的值，**两者都是真值、只是时点不同**。
  - → 请**不要**把 22/15 改成 26/19（那会把一个时点值当成新基准，是同一类错误的镜像）；应补述为：「**计数随 E2E 自建残留漂移（全新 seed 后 alice 22 / 匿名 15；跑过 E2E 后可达 alice 26 / 匿名 19），故 P6 前须重跑 `make debug-seed` 或按 slug 精确断言，勿依赖总数**」
- **`§7` 悬空引用**（design-review 非阻塞）：风险节实为 §1.3，UI 设计节插在 §6/§8 之间致编号断档 → 修正引用编号
- **eng-review N-2~N-5**：`firstFileId` 动态解析、`EntryDetailView` 300 行上限登记、`P5_lint` 覆盖面描述、`P5_timeout_seconds` 档位——**若属一行补述则改，否则留给后续**

---

## 4. 不要做的事

- **不要重做候选方案**（评审确认方案 A 成立，骨架无需重选）
- **不要改 `gate_commands` 的键形态与超时档位**（附录 A 四项核查已确认全部合规）
- **不要改 R1/R2/R3 结论**（两方均确认成立）
- **不要改 P1**（`[P1_CORRIGENDUM]` 已按裁决登记在 P2 内，本轮保留）
- **不要动 banner 不处理的裁决**（N12 + R-04 保持）
- **不要顺手修复 P1 §4.3 三处存量问题**（N1/N2/N3 保持）

---

## 5. 环境与纪律（与第一轮相同，重申）

- 只用 debug `:8888`（已运行，主 Agent 挂长托底 job）；Chrome CDP `:18800` 在线
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn` 直接启动、**严禁** `make debug`/`npm run dev`。返回时标注 `[PROD_NOT_TOUCHED]`
- 临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`；**`/tmp` 跨 bash 调用不共享**
- **任何 bash 命令设 `timeout 180s <cmd>`**
- **探针文件用后即删**：上一轮与评审期出现过 `frontend-v3/src/__*probe*.spec.ts`（会把前端基线临时抬高）。如需类型探针请放 `.agate-tmp/`，**不要放 `frontend-v3/src/`**；确需放入 src 的，用完立即删除并复查 `git status frontend-v3/` 为空
- 前端基线：`110 files / 1343 passed | 4 skipped (1347)`；后端 `1172 passed` + 1 条预存环境性失败（勿当本任务问题）
- 子派发能力：不启用
- 分阶段落盘：每完成一步**立即追加**一行到 `P2-progress.md`

## 6. 产出

- 就地修订 `agate-workspace/tasks/TPV0099-fullscreen-link/P2-design.md`（**同阶段内定点修订，无需归档旧产出**）
- 追加 `P2-progress.md`
- 改完跑 `python3 /home/kity/.agate/v0.76.0/agate/scripts/check-frontmatter.py <产出路径>`，非 0 先修正
- **自查 §1/§2 的验收判据**并在回报里逐条说明改了什么（含行号）

## 7. 返回给我（只三行）

1. 产出文件路径
2. 一句话摘要（≤30 字）
3. **两个阻塞项各自的修改落点**（行号 + 改后形态一句话）

**不要返回文件全文。**

> 本文件不含通过/失败预判。

---

## 附录 C（主 Agent 于**第二次派发前**追加，2026-09-28）：`viewer.spec.ts` 归属措辞的**定点更正**（1 处事实，4 个落点）

> **本条是主 Agent 自身派发缺陷的补救（错在派发方，不在 architect）**。主 Agent 已回源定位成因：**第一轮派发上下文 `P2-dispatch-context-architect.md:414` 的那条 bullet 把两个不同根因的事实捆在同一个 `DEBT0012` 标签下**——原文写「**seed 数据缺陷（DEBT0012…）**：…422…且这些 entry **即使 `is_public: true`，匿名也 404**（团队限定）」。其中"匿名也 404"实为 **TPV0095 的 seed 语义变更**（另一根因），却被并入 DEBT0012 条目 → architect 把 `viewer.spec.ts` 的红灯一并归给 DEBT0012，是**忠实执行了派发指令**，非其失误。**主 Agent 已在 `debt/tech-debt.md` 的 DEBT0012 条目下就地补记该区分**（含"勿据此关账 DEBT0012"），本条即与之对齐。

### 要改什么（事实更正，不是重写论证）

`P2-design.md` 有 **4 处**把 `viewer.spec.ts` 的 18 failed 归给 **DEBT0012**，该归属**与已核实的事实不符**：

| 行 | 现措辞 | 应改为 |
|---|---|---|
| `:118` | 「既有 spec 的红灯归 **DEBT0012**」 | 「既有 spec 的红灯归 **TPV0097/TPV0098（用例可信治理）**」 |
| `:543` | 「（P0 登记的 **DEBT0012 类**）」 | 同义更正（见下方"准确表述"） |
| `:544` | 「建议归入 **DEBT0012** 的后续清理」 | 「**归属 TPV0097/TPV0098 的用例可信治理范围**」 |
| `:700` | `env_constraints.known_red_baseline` 中「归 **DEBT0012**」 | 同上 |
| `:718` | §9 汇总表「建议归 **DEBT0012** 后续清理 / **待主 Agent 决定是否立项**」 | **主 Agent 已决定：不立项**，改为「归属 TPV0097/TPV0098，本任务不新立条目」 |

### 准确表述（可直接采用）

> `viewer.spec.ts` 18 failed 的成因是 **TPV0095（`59182590`，2026-09-03）给 seed entry 指派团队后引入的 seed 语义回归**——`markdown-test` 变为 `is_public: true` 但带 `team_id: frontend-team` → 匿名 404，而该 spec 的 `openMarkdownFile` 依赖它。该 spec 最后一次全绿为 `d4b05ee4`（TPV0088，2026-08-12），`git merge-base --is-ancestor d4b05ee4 59182590` 为真。**归属 TPV0097/TPV0098「用例可信治理」**（E2E 用例与 seed 语义脱节）。

### 为什么**不**归 DEBT0012（关键区别，务必保留这层区分）

| | DEBT0012 | 本项（`viewer.spec.ts`） |
|---|---|---|
| 根因 | `seed-debug.py` 先建 entry 后建 team → 422 → **entry 未入库**（数据**缺失**） | TPV0095 指派 team → **可见性语义变更**（数据**完好**） |
| 重跑 `make debug-seed` 能否恢复 | **能**（team 已存在即无 422） | **不能**（`team_id` 是 seed 数据本身） |
| 修复面 | `scripts/seed-debug.py`（时序/重试） | E2E 用例与 seed 语义的**对齐治理** |

→ 挂 DEBT0012 会**污染该条目的根因与 `closure_criteria`**。**主 Agent 已在 `agate-workspace/debt/tech-debt.md` 的 DEBT0012 条目下就地补记该区分**（并写入"勿据此关账 DEBT0012"），故**本处措辞若不改，会与债务登记簿出现跨文件矛盾**——这是本次要求修订的直接理由。

### 边界（不要扩大）

- **只改归属措辞**。§6.3 的**实质结论完全正确、不要动**：既有 spec **不作 gate 键**、本任务 E2E 键**全部指向新建 spec**、P4/P5 **不得为让 E2E 全绿而改既有 spec**——这三条保持原样
- **不要**顺手修 `viewer.spec.ts` 本身（明确在范围外）
- **不要**把这写成新的阻塞项/风险条，这是**事实更正**
- 改完重跑 `check-frontmatter.py`（exit 0）、`make lint`、`make typecheck`
