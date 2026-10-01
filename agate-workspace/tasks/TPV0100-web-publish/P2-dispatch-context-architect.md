# P2-dispatch-context-architect — TPV0100

---
phase: P2
task_id: TPV0100
role: architect
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

为「网页发布入口」产出 `P2-design.md`——把 P1 的 30 条 BDD 转化为可实现的前端技术方案（影响面、候选方案、gate_commands 固化、files_to_read、UI 设计节）。

任务一句话：**登录用户在 `/publish` 选文件/多文件 → 填字段 → 一次 POST 现有 `POST /api/v1/entries`（后端零改动）→ 结果态可复制链接**。

## 输入文件（必读，按序）

1. `agate-workspace/tasks/TPV0100-web-publish/P1-requirements.md` —— **主输入**（30 条 BDD + 隐含需求 + 同类扫描 + 声明）
2. `agate-workspace/tasks/TPV0100-web-publish/P0-brief.md` —— 环境约束/风险
3. `docs/specs/peekview-web-publish-20261001.md` —— **设计规格 V1.1**（已通过 3 轮独立评审）。§5 功能需求 / §6 技术设计（§6.2 数据流 / §6.3 前端模块改动 / §6.4 请求契约 / §6.5 幂等）/ §7 安全边界 / §8 测试策略——这些是 P2 的直接上游
4. `frontend-v3/src/api/client.ts` —— 现有 axios 客户端（拦截器、认证 cookie、错误处理惯例）——需新增 `createEntry` / `getLimits`
5. `frontend-v3/src/router.ts` —— 路由表 + `beforeEach` 守卫
6. `frontend-v3/src/components/UserMenu.vue` —— 入口落点 1
7. `frontend-v3/src/views/EntryListView.vue` —— 入口落点 2（服务 `/explore` 与 `/users/:username`，按钮须 gate 在 `!props.owner`）
8. `frontend-v3/src/components/LoginDialog.vue` —— 未登录惯例
9. `frontend-v3/src/views/SettingsView.vue` + `frontend-v3/src/components/settings/ProfileTab.vue` —— 表单/校验/字段错误反馈惯例
10. `frontend-v3/src/stores/auth.ts` —— 登录态
11. `frontend-v3/src/types/` —— 现有类型定义惯例
12. `frontend-v3/e2e/` 任一 spec + `frontend-v3/playwright.config.ts` + `frontend-v3/package.json`（scripts）—— E2E 编写规范、project 列表、测试命令形态
13. `backend/peekview/models.py` `FileCreate` / `CreateEntryRequest` / `CreateEntryResponse` —— 请求/响应契约（前端类型要对齐）
14. `backend/peekview/services/entry_service.py` `_process_file_input` —— `content` vs `content_base64` 分支（编码约束的代码依据）
15. `backend/peekview/config.py` `PeekLimits` + `backend/peekview/api/config_router.py` —— 限额来源与 `/config/limits` 响应字段
16. `frontend-v3/src/utils/`（若有）—— 是否有可复用的工具函数落点
17. `DESIGN.md` §6 —— 组件规则与菜单文书（加 Publish 需同步）

## 已锁定的架构决策（spec 定稿 + 用户裁决，**不得重开**）

1. **方案 A**：前端把文件内容内联进 JSON（文本→`content`、二进制→`content_base64`）一次 POST `POST /api/v1/entries`，**后端零改动**。方案 B（multipart 端点）/ C（分片）已在 spec 否决。
2. **MVP = 只做文件/多文件**；压缩包解压与文件夹选择**明确延后**（不设计、不预留过度抽象）
3. **入口两处**：`UserMenu` 下拉 + Explore 页顶部主按钮；**不在 `/users/:username` 出现**
4. **字段**：`summary`（必填）/ 文件（≥1）/ `slug`（留空自动生成）/ `tags` / `is_public`（默认**公开**）/ `expires_in`（默认 15 天）/ `team`
5. **相对路径可编辑**（每文件一行）
6. **结果态**：页面链接 + Raw 链接，可复制、可跳详情；含「再发一个」
7. **不添加** `X-PeekView-Source` 头（OQ-1 已结案）
8. **不在前端调 `/config/limits` 以外的新端点**；限流只能靠 `429` 提示

## 主 Agent 已实核的客观事实（直接采信；若与代码矛盾请报告）

- **限额**：`max_file_size` 20MB / `max_entry_files` 50 / `max_entry_size` 100MB / `max_summary_length` 500 / `max_slug_length` 64 / `default_expires_in` `15d`；`GET /api/v1/config/limits` **只返回这 6 字段**（不含限流值）；写端点限流 60/min 无公开接口。
- **`content_base64` 硬编码**：后端对 `content_base64` **无条件** `is_binary: true` / `language: null`；对 `content` 才判 binary + 检测语言。→ 前端必须自判文本/二进制（与后端 `language.py` 的 `is_binary_content` 对齐：NUL → 二进制，否则严格 UTF-8 解码；**不**对齐 MCP 的 `looksBinary`）。
- **路径校验**：后端 `get_disk_path` 做 `resolve()` + entry 目录内校验，逃逸抛 `ForbiddenPathError`；后端**不查重**（重复路径互相覆盖）→ 前端须预校验重复。`File.path` ≤ 500、`filename` ≤ 255。
- **前端现状**：`api/client.ts` 无 `createEntry`；全仓前端无 `type="file"` / `FormData`；`router.beforeEach` 对 `/settings` `/stars` `/teams` 未登录 `return '/'`。
- **认证**：httpOnly Cookie `peekview_token`，axios 已带 credentials 吗？——请你实读 `client.ts` 确认（若未带需在 P2 明确）。

## 硬性要求（gate 会硬校验，缺则 exit 1）

1. **`candidate_count`**：≥2 个候选方案（本任务非 trivial）。至少要有真替代方案（不是稻草人）——例如围绕「编码/预校验/交互模型/幂等键实现」等至少一个维度给出真权衡。若判定可简化须给出理由（`design_trivial: true` 或 `follows_existing_pattern: [文件]`）。
2. **frontmatter 四字段**：`packages` / `domains` / `ui_affected` / `candidate_count` 写入 frontmatter。
   - `packages: [peekview-frontend]`（纯前端；`docs` 不算版本包，若同步 DESIGN.md 可在 packages 里带上 docs 或仅在正文说明——按项目惯例定，但 `packages` 供 P8 多包发布消费，**peekview 与 mcp_server 本次均不 bump**）
   - `domains: [frontend]`
   - `ui_affected: true`（**必须有**，本任务纯 UI）
3. **UI 设计节**（`ui_affected: true` → **必含** `## UI 设计` 节）：
   - **渲染形态声明行**：`渲染形态: layout（布局型）`——必须与 P1 的 `ui_render_shape: layout` 一致（gate 做规范化值比对）
   - **`适用维度:` 声明行**：`布局结构 / 交互行为 / 视觉呈现`——必须与 P1 的 `ui_ux_dimensions` 一致
   - 按形态适配 checklist：常规布局型必含**布局 / 交互 / 视觉**三类（每类含卡片列出的 checklist 项）。**不适用的维度显式声明"维度不适用"**。
   - 视觉 checklist 的判据须是**可量化 DOM 度量**（宽/高/对齐/重叠/溢出五类），不收主观视觉
4. **`gate_commands`**（正文，P2 固化后 P4-P6 不得改）。本项目是 Python 后端 + Vue 前端 + MCP 的 monorepo，前端测试命令走 Makefile：
   - `P3`：前端单测运行器。注意本项目 `make test-frontend`（vitest，非 watch）。请实读 `frontend-v3/package.json` 与根 `Makefile` 后给出**实际可用**的命令（`check-tdd-red.py` 会读 `P3` 键自动跑红灯）
   - `P5`：前端单测（紧凑模式）+ 后端不回归（本任务后端零改动，但建议确认后端测试仍绿——`make test-quick`？请核实实际 target）
   - `P5_e2e`：**`ui_affected: true` → 必填**。本项目 E2E 是 `make debug-test` / `E2E_SPEC=<spec> make debug-test`（指向 debug `:8888`）。请给出与 P8/P6 可执行的形态
   - `P5_timeout_seconds` / `P5_e2e_timeout_seconds`：按 per-key 声明（E2E 档建议 300s；`make debug-test` 含浏览器交互与构建，评估后给值）
   - 若项目有前端类型检查（`make typecheck` = `vue-tsc --noEmit`，CI 强制）——**建议单列一个 key**（如 `P5_typecheck`），不要用 `&&` 串进 P5（`--strict` 反模式）
   - 架构适应度检查：本项目是否需为「前端不得绕过 API 直连」之类约束配适应度命令？判定无则在正文写明"本任务无架构适应度检查"
5. **影响面梳理节**（强制，写在候选方案**之前**）：改什么 / 不改什么 / 风险在哪 三部分齐全，落点具体到文件+小节/函数，关联 BDD 编号。
6. **`files_to_read`**（正文）：实现确实需要参考的文件清单 + why（控制 P4 上下文；大文件标行号范围）
7. **`env_constraints`**（正文）：确认/细化 P0-brief（**不得弱化**）——debug `:8888`、生产 `:8080` 与 `~/.peekview/` 严禁触碰、`make debug-start`/`debug-seed`、测试 entry 只走 debug HTTP API
8. **`minimal_validation`**（正文，**必声明**）：
   - 本任务方案依赖浏览器行为（File API 读入、FileReader/ArrayBuffer、大文件编码、axios 请求体积、CSP 是否影响 fetch）——**必须做最小验证**
   - 建议验证点：① 用 10-20 行 HTML/Node 脚本验证前端判文本/二进制规则与后端 `language.py` 一致；② 或在 debug `:8888` 用 curl 实测 `POST /api/v1/entries`（`content` 与 `content_base64` 两条路径）确认契约与响应结构；③ 确认 axios 带 cookie 的配置
   - **注意**：起服务必须按 AGENTS.md「跨调用起服务的正确姿势」（后台 job 托底），或直接读代码验证（少数情况下足够）。若判定纯代码逻辑也要写明依赖了哪些内部函数
9. **`dispatch_plan`**（可选）：本任务按工作量五维评估，若为单包单批（前端一个模块面）→ 可声明 `mode: single` 或不声明；若有实质可拆批（如「API 层 + 页面/组件层 + 路由/入口层」），按 `static-batch` 拆并在正文给批切分理由。**high 复杂度必须拆**。

## 关键设计要点（spec 已给方向，你来定稿与细化）

- **文本/二进制判定**：与后端一致（NUL → 二进制；否则严格 UTF-8 解码失败 → 二进制）。给出具体实现函数 + 放在哪个 util 文件。
- **幂等键**：spec §6.5 定义——给具体实现（如组件内 `crypto.randomUUID()` / 递增 token），以及在「再发一个」时如何重置（BDD-13）。
- **预校验**：summary 长度/空、文件数/单文件/总量、路径非法/重复/超长（BDD-14~19）——给出集中式校验函数与错误展示位置（字段级 + 顶部汇总）。
- **slug 校验**：前端早校验规则须与后端一致——**实读** `CreateEntryRequest`/`entry_service` 的 slug 校验规则（`max_slug_length` 64 + 字符集规则），不要凭猜。
- **过期时间**：`expires_in` 默认 `15d`；前端 UI 形态（下拉预设 or 输入）由你定稿，但须能表达"默认 15 天"（BDD-20）。
- **动作态**：结果态是独立路由（`/publish/done`?）还是页面内状态机？给出取舍与理由。
- **测试标识**：给 P3 test-designer 稳定定位清单（`data-testid` 命名建议），不当绑定 class。
- **E2E 测试文件落点**：本项目 E2E 在 `frontend-v3/e2e/`（自建 fixture + `e2e-` 前缀 + afterEach 清理 + BASE_URL 防生产护栏，TPV0096 引入）。设计时说明新 spec 落点与命名。

## 产出与格式

- 产出：`/home/kity/oclab/peekview/agate-workspace/tasks/TPV0100-web-publish/P2-design.md`
- 用 `agate-md-field-set` 写 frontmatter（先 `--list` 看字段清单；如不可用则按 task-files.md 的 P2 样例手工写并报告主 Agent）。Header 值：
  - `phase: P2`，`task_id: TPV0100`，`type: design`，`parent: P1-requirements.md`
  - `trace_id: TPV0100-P2-20261001`，`status: draft`，`created: 2026-10-01`，`agent: architect`
- 写完跑 `python3 /home/kity/.agate/v0.77.0/agate/scripts/check-frontmatter.py <产出路径>`，非 0 先修正再返回
- 若根 `Makefile` / `frontend-v3/package.json` 与上面的命令示例不符，**以你实读到的为准**，并在正文注明出处（哪个文件哪行）
- 分阶段落盘：每读完一个输入文件/完成关键步骤，立即追加写 `P2-progress.md`；每条 bash 命令执行前也追加一行

## 命令超时（强制）

任何 bash 命令设 `timeout 180s <cmd>`（构建/起服务类按预期×1.5，可到 300-600s）。超时/非预期失败 → ① 停止，不换命令不深挖；② progress 写一行；③ 返回主 Agent 决定。

## 环境隔离（强制）

只用 debug `:8888`（`make debug-start`/`make debug-seed`，跨调用须挂后台 job 托底）。**严禁**触碰生产 `:8080` 与 `~/.peekview/`；测试 entry 只经 debug HTTP API 创建，禁用 CLI `peekview create`。临时产物落 `{project_root}/.agate-tmp/`。状态标记二值格式：触发 `[PROD_TOUCHED] {描述}`，未触发 `[PROD_NOT_TOUCHED]`。

## 门槛（什么算完成）

- P2-design.md 存在，frontmatter 含 `candidate_count ≥2` + `packages`/`domains`/`ui_affected`/`candidate_count`
- 含影响面梳理节（改/不改/风险 三部分，在候选方案之前）
- 含 ≥2 候选方案 + 权衡 + 选择理由
- 含 `## UI 设计` 节：`渲染形态:` 行（layout，与 P1 一致）+ `适用维度:` 行 + 布局/交互/视觉三类 checklist
- 正文含 `gate_commands:` / `files_to_read:` / `env_constraints:` / `minimal_validation:`
- `ui_affected: true` → `gate_commands.P5_e2e` 已声明
- `check-frontmatter.py` exit 0

## 返回给我（重要）

只返回两行：
1. 产出文件路径
2. 一句话摘要（方案要点，不超过 40 字）
绝对不要返回文件全文。

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

4. **登记面（新增/改名 `agate/scripts/` 下文件时必填）**：按 `agate/scripts/README.md`「新增脚本登记面」节逐项判定，并**实测**（把文件真放进仓库跑一遍），不凭推理。该节已区分**机械门禁**与**团队约定**：真门禁只有 ① **CHECK 9 覆盖**与 ② **SG.6**（两处共用同一判据 `uncovered_gate_scripts()`），其余为约定——**不要**按旧印象把观测型脚本硬塞进锚点表。**③ `CHECK 10`（协议文档脚本名引用漂移）方向相反，不是新增脚本的登记面**——它只报「协议文档引用了**不存在**的脚本」，新增脚本文件本身不触发，**改名/退役**脚本时才要看。三处点名齐（CHECK 9 / SG.6 / CHECK 10）才算法定结论完整。实测结论写进影响面梳理节（"实际哪一处变红/告警"）。

> **为什么强调"实测"**：TAG0036 M18 是本仓库的实证——P1 同类扫描凭推理判"本次不处理"，直到 P2 评审实跑才由绿转红。同类扫描没有强制实测时，这个坑会重复出现（DEBT0046 登记的直接动因）。

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
