# P2-dispatch-context-review-lead-rev1 — TPV0099（**汇总复审轮**）

---
phase: P2
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: review-lead
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

> 本文件是 **P2 汇总复审轮**的派发指令。你上一轮作为组长汇总出 `P2-review.md`，判 **`needs-revision`**（阻塞 2 项）；architect 已按你的 §5 修订指令完成**定点修订 + 一轮归属补丁**；两份职能评审已**复审**。现请你**重新汇总**，给出新的 `P2-review.md` 终态。
>
> 本轮范围：**验证两份复审的结论并给出统一终态**。不要重新评审方案本身。

---

## 一、你的输入（两份复审，已产出）

| 评审 | 文件 | 上轮终态 |
|---|---|---|
| plan-design-review | `P2-review-design.md` | `needs-revision`（阻塞 2） |
| plan-eng-review | `P2-review-eng.md` | `rejected`（阻塞 2；系枚举所迫，语义 = 须修订再审） |

**请读全两份复审**，确认：① 你上轮 §5.1（R-1）/ §5.2（R-2）的每一条修订指令是否被**如实落实** ② 两份复审是否都判定闭环 ③ 有无冲突。

---

## 二、本轮要验证的 3 个闭环点（主 Agent 已复核，请独立确认）

### 闭环点 1：锁死态接口形态**唯一化**（你上轮的 R-1）

**关键**：不只"两个报错消失"，而是**形态唯一**。你上轮发现的**第三种不报错的假绿读法**（签名改 `locked: boolean` + 可选链可同时过 `make typecheck` 与 `make test-frontend`，但把锁定态固化成 setup 期快照、组件复用下状态残留）**必须已被显式禁止**。

主 Agent 已复核的落点（请独立确认）：
- `:46` M2①/②/③、`:47` M3、`:138` 草图注释（已改「最终规格，P4 照此实现」——**根因修复**）、`:136` 风险①前提、`:53` M9 补「随 route meta 翻转」单测
- **新增 `:60-77`**「锁死态接口最终规格」四面板表 + **三个禁止变体**（第三项即你发现的假绿读法，并点明 M9 新单测是其**唯一可执行拦截**）
- `:69` `route.meta` 访问**二选一已显式定案取可选链**（不留"待决定"），并说明该分支下两处 mock 无需改动

### 闭环点 2：BDD-10 认证配对已改正（你上轮的 R-2）

应为「alice 登录建私有 → 登录建 share → 匿名带 token 读 → 登录删除」，清理判据 = **alice 复查 `raw` = 404**，且含**区分力判据**（真实 token 可见 / 无 token 与伪 token 均不可见，三者须互异）。`files_to_read` 应补 share 范本两条。

### 闭环点 3（本轮新增，跨文件一致性）：`viewer.spec.ts` 归属措辞已更正

- 现已改为「**TPV0095 引入的 seed 语义回归，归属 TPV0097/TPV0098「用例可信治理」**」
- **判据**：`grep -n DEBT0012 <P2-design.md>` 命中**全部**为"明确说明**不归** DEBT0012"的对照性表述，**不得**有一处归给 DEBT0012
- 应同时确认 **§6.3 三条实质结论一字未动**（既有 spec 不作 gate 键 / E2E 键全指新建 spec / P4/P5 不得为让 E2E 全绿改既有 spec）
- **背景（不必重新论证，若你认为有反例请给反证）**：主 Agent 已裁决该问题**不新立债务条目、不归 DEBT0012**；根因是**第一轮派发上下文**把"seed 时序 422（DEBT0012）"与"team-scoped 匿名 404（TPV0095 语义变更）"**捆在同一标签下**，architect 是忠实执行指令。

---

## 三、你的汇总职责（与上一轮相同）

1. 读全两份复审
2. **冲突消解**（若两份复审结论冲突，明确判定谁对 + 理由，**不要和稀泥**）
3. **去重**
4. **定级**（阻塞级 / 非阻塞）
5. **判定终态**：
   - 任一复审有**阻塞级** → 不可给 `approved`
   - 两份复审均闭环且无阻塞级 → `approved`
6. 若仍须修订：给出逐条可执行的修订指令

---

## 四、若本轮闭环 → `approved` 的额外要求（**重要**）

**两份职能评审文件不允许 `needs-revision`**（`agate-md-field-set.py` 的 `STATUS_ENUM_BY_BASENAME` **按文件名**映射，仅 `P2-review.md` 允许该值）——故复审若判"须修订"只能写 `rejected` 并注明语义。你已经历过该摩擦，本轮 `P2-review.md` **允许** `needs-revision`，**请按真实语义取值**（不是照抄职能评审的字面）。

**`agent` 字段**：必须写 **`review-lead`**（组长角色名），**不是** `plan-eng-review`/`plan-design-review`。
- ⚠️ **已知工具摩擦（你上轮已实测）**：`agate-md-field-set.py` 在写非 draft 的 `status` 时会校验 `agent` 是否 ∈ `assets/review-roles/*.md` **文件名集合**，而该目录**只有 `review.md`、无 `review-lead.md`** → `agent: review-lead` **无法经 setter 写 status**。
- **处置（沿用你上轮的有效做法）**：**保留 `agent: review-lead`**，改用 **Write 落盘**写 `status`，然后用 `check-frontmatter.py`（应为 exit 0）+ **真实 `check-gate.py P2`** 双重验证该形态被 gate 接受。
- **主 Agent 已复核并采纳**：该摩擦是**协议层两个工具之间的口径不一致**（setter 的 UX 引导校验 ≈ `role-system.md` 第二层角色表，而组长是**汇总角色、不在该表内**），**不是本任务缺陷**。先例：`TPV0093/P2-review.md` 即用 `agent: review-lead`。

---

## 五、约束

- **只审不写**：不修改 `P2-design.md`，也不改两份职能评审文件
- **不要**写 `agate-workspace/debt/tech-debt.md`（主 Agent 已登记 `DEBT0013` 并更正 DEBT0012，**勿重复登记**）
- `status:` 终态必须与返回摘要一致（**主 Agent 只读 Header 判定**）
- 正文避免行首 `- PASS` / `- FAIL` 格式（触发 provenance 审计拦截）
- 子派发能力：不启用

---

## 六、环境与纪律

- debug `:8888` 已运行（开工前先探 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn`/`make debug`/`npm run dev`；返回标注 `[PROD_NOT_TOUCHED]`
- 临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`；**任何 bash 命令设 `timeout 180s <cmd>`**
- **探针文件严禁放 `frontend-v3/src/`**（本任务已两次出现探针残留抬高基线）；用完即删并复查 `git status frontend-v3/` 为空
- 前端基线：`110 files / 1343 passed | 4 skipped (1347)`（`DiagramBlock.spec.ts` 有一条**已知 flaky**）
- **工具调用提示**：`agate-read-gate-commands.py` 必须用 `GATE_FILE=<绝对路径>` 环境变量传参，位置参数会被忽略并 KeyError
- **方法论提醒**：本任务已出现三次"用错误方式验证"（判据恒真/恒假、importlib 探针因缺 `sys.path` 落到**降级 stub** 产出与真实 gate **相反**的结论、根因标签张冠李戴）。**验证工具与验证结论本身都要被验证**——给"某 gate 检查不过"的结论时，请用 `check-gate.py` 的**真实 CLI 入口**，附可复现命令

## 七、产出

- `agate-workspace/tasks/TPV0099-fullscreen-link/P2-review.md`（**就地更新**为统一门槛文件）
- frontmatter：`phase: P2` / `task_id: TPV0099` / `parent: P2-design.md` / `trace_id: TPV0099-P2-20260928` / `agent: review-lead` / `status: <终态>`
- 正文须含：① 两份复审的来源与各自结论 ② 去重后问题清单 ③ 冲突消解结论（若有）④ 阻塞/非阻塞定级 ⑤ 若仍须修订：逐条修订指令 ⑥ 19 条 BDD 覆盖性确认 ⑦ **三个闭环点的验证结论**

## 八、返回给我（只两行）

1. 产出文件路径
2. 一句话摘要（含终态 status + 阻塞级问题数）

**不要返回文件全文。**

> 本文件不含通过/失败预判。

---

## 附录 A（主 Agent 于派发前追加，2026-09-28）：两份复审**已回报**——本轮已核事实

### A.1 两份复审结论（均为 `approved`，阻塞级 **0**）

| 评审 | 文件 | 本轮终态 | 阻塞级 |
|---|---|---|---|
| plan-design-review | `P2-review-design.md` | **`approved`** | 0 |
| plan-eng-review | `P2-review-eng.md` | **`approved`** | 0 |

两份复审**均判定你上轮的 R-1 / R-2 已实际闭合**，且**未发现冲突**。主 Agent 已抽验（`check-frontmatter.py` exit 0 / `P2-design.md` mtime 未变 / 未越权改动）→ 与自报一致。

### A.2 两方各自的关键独立验证（可直接采信，不必重跑）

- **design-review**：用响应式 `route.meta` 探针实测判据**区分力**——正确 thunk 形态 `zenMode` 序列 `[false,true,false]`（M9 通过）、禁止变体 `[true,true,true]`（M9 不通过），并证明 **BDD-4 单独拦不住该变体** → 坐实 M9 是**载荷性条款**
- **eng-review**：分四步**先验证工具判别力再采信结论**——① `locked: boolean` 变体实测 `vue-tsc` exit 0 + vitest 3 passed（**证实设计 `:77` 的事实前提为真**：该假绿读法确能同时穿过两道 gate）② 同 harness 反例（computed 后写 `.value`）必红 `TS2540` exit 2 ③ M9 翻转用例对"thunk 签名 + setup 期快照"的隐蔽变体确有拦截力 ④ 挂载探针逐字复刻既有 mock，复现裸值形态的 `TypeError`
- 两方均复核**跨文件一致性（你上轮的验证点 3）**：`DEBT0012` 命中全为"不归 DEBT0012"的对照性表述、与 `debt/tech-debt.md` 一致、§6.3 三条实质结论一字未动；eng-review 明确"**未发现该裁决的反例**"

### A.3 本轮非阻塞残留（**不构成退回**，请只登记不阻断）

两方合计 6 条（design 2 + eng 4），**均判不构成退回理由**。主 Agent **已裁决：本轮不改 `P2-design.md`**，理由是流程性的——设计已被两份评审批准，**此刻再改（哪怕仅措辞）会使两份 `approved` 立即失效**，须再走一轮评审 = 额外消耗 retry 预算（P2 cap 3），为措辞级非阻塞项不成比例。**改由主 Agent 在 P3/P4 派发上下文转达**。

→ **你的汇总里请把它们列为"非阻塞、已由主 Agent 裁定延后转达"**，不要据此判 needs-revision。

其中两条值得你在汇总里点出（供 P3/P4 用）：
- **eng-NB-1（最值得注意）**：M9 翻转用例（`:53`）**未写明"thunk 须读 reactive 源"**——eng-review 实测用非响应式局部变量驱动时**正确实现也会返回 `[false,false,false]`** → 会**误红正确实现**（性质是判据精度问题，最坏是误红、**非假绿**）。建议 P3 落为显式硬前提（推荐用 `reactive` 模拟 `route.meta`）
- **eng-NB-3**：`:97`(N14) 引用的 300 行上限 spec **路径有误**——写作 `src/components/__tests__/t082-error-format.spec.ts`，实际在 `src/components/t082-error-format.spec.ts`（**无 `__tests__/` 层**；主 Agent 已实核确认）。行号与断言内容正确，仅目录层级偏差

### A.4 债务编号争议已闭（**请勿再提 DEBT0014**）

eng-review 已**主动撤回**其 `DEBT0014` 编号建议，声明"以已登记条目为准"。主 Agent 已登记为 **`DEBT0013`**（`debt/tech-debt.md`），并已就地更正 DEBT0012（含"勿据此关账 DEBT0012"）。**你的汇总只需确认"banner 缺口已登记 + viewer.spec 归属已更正"，不要给出新编号建议。**

### A.5 一条工程侧事实（供你判断，不必动作）

eng-review 报告：`check-gate.py P2` 当前 exit 1 的**唯一**原因是你的 `P2-review.md` 仍为 `needs-revision`；它在**临时副本**上把 status 改为 `approved` 后复跑得 **exit 2（nudge，非失败）**→ 证明职能评审的 `approved` 可被 gate 接受。临时副本已删。**你本轮把 `P2-review.md` 改为 `approved` 后，主 Agent 会亲自跑真实 gate 复验。**

### A.6 工作区残留已闭环（供你确认"未回退抽查"的基线）

评审期出现的 `frontend-v3/.agate-tsprobe/` 残留（曾把 vitest 基线抬到 115 files）**已由 eng-review 整目录删除**；`git status --porcelain frontend-v3/` 为空。主 Agent 正在复跑全量套件确认基线回到 **110 files / 1343 passed | 4 skipped (1347)**。**若你的未回退抽查涉及前端基线，以此为准。**
