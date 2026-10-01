---
phase: P2
task_id: TPV0100
type: review
parent: P2-design.md
trace_id: TPV0100-P2-20261001
status: approved
created: 2026-10-01
agent: plan-design-review
reviewer_role: plan-design-review
ui_render_shape: layout
round: rev1
---

# P2-review — TPV0100 网页发布入口（设计评审 · 复评 rev1）

**受评对象**：`P2-design.md`（v1.1 / rev1，已按上轮评审意见修订）
**上游输入**：`P1-requirements.md`（30 BDD）、`docs/specs/peekview-web-publish-20261001.md`（V1.1）、`DESIGN.md`、`AGENTS.md`
**形态分派头**：受评任务 frontmatter `ui_render_shape: layout`（`P2-design.md` L1-18 与 `P1-requirements.md` L14 一致）→ 加载**布局 / 交互 / 视觉三组**维度。

**环境隔离**：`[PROD_NOT_TOUCHED]` —— 本次复评全程只读代码/grep/sed，未起任何服务，未触碰生产 `:8080` 与 `~/.peekview/`；未用 CLI `peekview create`；未对仓库做任何写操作（`git status` 仅显示既有未跟踪产出，无被评审文件改动）。实核命令均在同一 bash 调用内完成，无 scratch 残留。

---

## 0. 结论摘要

| 项 | 结论 |
| :--- | :--- |
| 总分 | **91 / 100**（上轮 72） |
| 终态 | **`approved`** |
| 核心依据 | 上轮 §5 补充清单 1–6 **逐条闭合**；布局/视觉/交互三组各有**≥2 真替代候选 + 权衡**（严格 3 候选）；逐组件契约、a11y 契约、422 渲染口径均已补齐且与代码实核一致 |
| 遗留 | 2 处**轻度**契约文本不一致（§3.4.1 顶部汇总 testid 误标；slug `aria-describedby` 双 id 未合并）——WARNING 级，已定位权威口径，**不阻断推进**，建议 P3/P4 落用例时按 §4.8/§4.10.5 权威映射修正 |

**通过理由（一句话）**：本方案的三组 UI 候选均为真替代探索（每个被否候选至少在一个可验证维度上优于采用项，被否理由落到 BDD 编号），a11y 契约逐字段承接 `TeamsView.vue` 既有三件套（实核），422 数组 `detail` 与 400 `error.message` 的渲染口径已分叉且有统一提取函数保证非空可读——上轮 4 项打回项全部消除。

---

## 1. 上轮补充清单闭合情况（逐条核对）

> 对照 `P2-review-design.md`（上轮）§5 「architect 须补齐的清单（按优先级）」。

| # | 上轮要求 | 落点（P2-design.md 节号） | 闭合判定 | 证据 |
| :-- | :--- | :--- | :--- | :--- |
| 1 | 布局/视觉/交互三组各补 **≥2 候选 + 权衡**（角色硬规则） | §2.x.1 布局（L1 单列 720px / L2 复用 Settings 1280px / L3 两栏）；§2.x.2 结果态视觉形态（R1 替换主区 / R2 顶部横幅保留表单 / R3 Toast+跳转）；§2.x.3 行编辑交互（E1 内联 / E2 弹层 / E3 拖拽排序树） | ✅ **闭合（强）** | 每候选含「优点 / 风险 / 工作量」+ 采用项选择理由；被否候选非稻草人（L2 在「零偏离」、L3 在「长列表独立滚动」、R2 在「原地微调」、R3 在「代码量」、E3 在「构造嵌套目录」各有一维度更优）；被否理由锚定 BDD（BDD-14~19/29、BDD-10/12/13、BDD-9/17/18）与 DESIGN.md §12/§9/§10 |
| 2 | 补逐组件契约表；`fileErrors` 改用稳定 `fileId` | §4.10.1 `PublishFileDraft`；§4.10.2 `FileDropZone`；§4.10.3 `PublishFileList`；§4.10.4 `PublishResultPanel`；§4.10.5 字段错误渲染件；§4.11 `PublishResult` 字段与构造处。`fileErrors: Record<string,string>`（key=`fileId`）见 §1.1 M8 / §4.5 / §4.10.3 | ✅ **闭合** | 每组件含 props / emits / 内部状态 / 空态 / 触发；`fileId`（`crypto.randomUUID()`）替代 index（§4.5 L328、§4.10.3 L421/L423/L426）；删除行 `delete fileErrors[fileId]`、不做 index 重映射 |
| 3 | 补 a11y 契约，承接 `ProfileTab`/`TeamsView` 惯例 | §3.4.1 字段↔错误关联表（`aria-describedby` + `aria-invalid` + `role="alert"`）；§3.4.2 提交中/状态跃迁公告（`aria-busy` / `aria-live="polite"` / `role="status"`）；§3.2.2 程序化焦点管理表 | ✅ **闭合** | 实核 `TeamsView.vue:34,38,117,121` 确为 `aria-describedby="member-error-${team.slug}"` + `<p id=... class="field-error" role="alert">`——与 §3.4.1 的 `fileId` 稳定 id 模式**同构**；`ProfileTab.vue:21,106` 的 `.field-error`（`--font-xs` + `--c-error`）被 §3.3 承接 |
| 4 | 补 422 数组形 `detail` 渲染口径 | §4.6 错误体形状表（400 `{"error":{"code","message"}}` → `error.message`；422 `{"detail":[{loc,msg,type}]}` → `detail[].msg` 拼接）；`extractApiErrorMessage` 统一提取（§4.6 L344）；§4.9 E2E 判据①；§10 标志行 | ✅ **闭合** | 与主 Agent 实核一致：`main.py` 仅 `RateLimitExceeded`(L397) / `PeekError`(L507) / `Exception`(L521) 三 handler，**无 `RequestValidationError` handler** → 422 走框架默认数组 `detail`；方案显式禁止 `String(detail)`（会渲染 `[object Object]`），BDD-26 双路径均可读 |
| 5 | 补视觉/移动端细化（720px 例外记录 / 结果态与错误态 390 布局 / 过渡档 / 双主题） | §3.1.1 720px 偏离 DESIGN.md §4 的 scoped override 表；§3.1.2 tablet 断点；§3.1.3 结果态与文件行错误态 390 布局；§3.2.1 过渡档（`--transition-fast` 150ms）；§3.3 light/dark 双主题 + mono 场景 + 量化断言①~⑧ | ✅ **闭合** | DESIGN.md §4 实核确有「scoped, deliberate override, not a violation」例外体例（L115 detail `.content-area`），方案比照记录；§9 三档断点（≤640 / 641-1023 / ≥1024）被 §3.1.2 显式补齐；§8 三档（Fast 150/Medium 250/Slow 350）被 §3.2.1 正确取用（Medium/Slow 声明不用）；§12「Test every change in both dark and light themes」被 §3.3 列为二值验证项 |
| 6 | 补 I-6 slug 覆盖语义 UI 提示 与「再发一个」内存释放（R7） | §4.7.1 slug 覆盖语义恒在提示（`publish-slug-hint`，slug 非空即显示）；§4.3 L304「再发一个」五项内存释放（清空 drafts/encoded/fileErrors/idempotencyKey，禁模块级缓存） | ✅ **闭合** | I-6「需让用户知晓语义」有 UI 落地；R7（base64 1.333x 膨胀）在「再发一个」连发场景的累积风险被显式释放约束覆盖 |

**闭合结论**：上轮 6 项补充清单 **全部闭合**，无一项遗留。

---

## 2. 上轮「已达标、无需改动」项复核（防 rev1 引入回退）

| 上轮已达标项 | rev1 是否改动 | 复核判定 |
| :--- | :--- | :--- |
| §2 架构 2 候选（candidate_count: 2） | 未改（§2 L90-119 与上轮一致） | ✅ 保持，`candidate_count: 2` 与正文一致 |
| §4.2 幂等键（载荷指纹） | 未改 | ✅ 保持 |
| §4.4 编码规则（8 样本对齐后端） | 未改 | ✅ 保持（§6 minimal_validation 实测仍在） |
| §5 gate_commands（实读 Makefile / :8888） | 未改 | ✅ 保持（本次实核 Makefile `test-frontend:173`/`typecheck:193`/`test-quick:163`/`debug-test:648` 均在；`run-e2e-tests.sh` 默认 `:8888` + 8080 拦截） |
| §1 影响面梳理（先于候选方案） | 未改 | ✅ 保持（Modify/Not Modify/Risk 三部分齐全，仍在 §1） |
| `[SCOPE+]`×2 标记 | 未改 | ✅ 保持（§9 L580-587） |

**未发现 rev1 对已达标项的回退。**

---

## 3. 事实核验（对本轮新增声明的独立交叉验证）

| P2 新增声明（节号） | 实核命令/落点 | 结论 |
| :--- | :--- | :--- |
| §3.4 承接源 TeamsView 三件套 | `grep aria-describedby/field-error/role="alert"` → `TeamsView.vue:34,38,117,121` | ✅ 一致；`member-error-${team.slug}` 稳定键模式与 `fileId` 同构 |
| §3.4 承接源 ProfileTab `.field-error` | `ProfileTab.vue:21,106`（`--font-xs` + `--c-error`） | ✅ 一致 |
| §3.3 `--font-mono` / §3.2.1 `--transition-fast` | `variables.css:21`（JetBrains Mono）/ `:29`（150ms ease） | ✅ 存在 |
| §3.3 `.sr-only` 全局存在（§3.4.1 引用） | `base.css:116` | ✅ 存在 |
| §3.4.2 `BaseButton` 无 `loading` prop | `BaseButton.vue:32-43`（仅 variant/size/disabled/type/href/target/rel） | ✅ 一致，故「发布中…」由页面 slot 自管成立 |
| §3.1.1 DESIGN.md §4 例外体例 | `DESIGN.md:112,115`（functional 1280px / detail `.content-area` 例外原文） | ✅ 一致，720px 偏离的例外记录方式合规 |
| §3.1.2 DESIGN.md §9 三档断点 | `DESIGN.md:260-266`（≤640 / 641-1023 / ≥1024） | ✅ 一致 |
| §3.2.1 DESIGN.md §8 三档 | `DESIGN.md:246-251`（Fast 150 / Medium 250 / Slow 350） | ✅ 一致 |
| §3.3 错误 `--c-error` + `--c-badge-private-bg` 语义别名 | `variables.css` 既有 token | ✅ 存在 |
| §4.7.1 slug 覆盖路径（后端 overwrite） | spec §6.5 + `entry_service.py` 既有 overwrite 路径 | ✅ 一致 |
| §4.6 422 无 handler | `main.py:397,507,521`（仅 3 handler） | ✅ 一致（主 Agent 实核交叉确认） |

**所有本轮新增事实声明均与代码/文档一致，未发现矛盾。**

---

## 4. 维度评分（布局 / 交互 / 视觉三组 + 贯穿维度）

### 4.1 布局组

#### 移动端考虑 —— **9 / 10**

- **优点**：§3.1 两档视口（desktop `1280×800` / mobile `390×844`，与 P3 截图档一致）之外，§3.1.2 补齐 **tablet `641-1023px`**（声明与 desktop 同构，唯一断点 `≤640px`）；§3.1.3 给出结果态与文件行错误态在 390 视口的具体排布（结果态链接块 + 复制按钮纵向全宽、`word-break: break-all`；文件行错误追加为第四行、不悬浮）；主按钮 `min-height:44px` 全宽满足 §9「Touch targets: minimum 44px」。
- **扣分**：§3.1.2 对移动端 `UserMenu` bottom-sheet 差异仅一句「沿用既有组件自身表现，本任务不新增菜单逻辑」——属可接受的范围声明，但 P3 移动视口仍需确认新增 Publish 项在 bottom sheet 中可见（蚂蚁项，扣 1）。
- **锚点**：BDD-9/10（390 截图）；§3.1.2/§3.1.3。

#### 组件完整性 —— **9 / 10**

- **优点**：§4.10.1~§4.10.5 覆盖全部新增 UI 件（`FileDropZone` / `PublishFileList` / `PublishResultPanel` / 错误渲染件）的 **props / emits / 内部状态 / 空态 / 触发**；§4.11 定义 `PublishResult` 字段与**唯一构造处**（`PublishView` 提交成功分支，组件不读 `window.location`）；`fileErrors` 用稳定 `fileId`（§4.5 L328），删除行 `delete` 同步、无 index 重映射（§4.10.3 L426）——直接消除上轮的「index 漂移串错行」缺口。
- **扣分**：`FileDropZone` 的「同名同 size 去重」规则写在 §4.10.2 触发列（合理），但未说明用户**同时**拖入两个同名同 size 但内容不同的文件（潜在误去重）时的提示；`PublishResultPanel` 的 `copiedTarget` 复位时机标「可选」，留了一点实现自由度（轻微，扣 1）。
- **锚点**：BDD-6/9/15/17/18；§4.8（testid 清单）+ §4.10 + §4.11。

### 4.2 交互组

#### 交互状态覆盖率 —— **10 / 10**

- **优点**：loading（§4.6 `submitting` + BDD-27）、error（§4.6 形状表覆盖 400/422/429/5xx，BDD-14~19/25/26）、empty（§4.10.3 空态 `publish-file-empty`，BDD-15）、disabled（提交中全输入 disabled，BDD-27）、失败保留表单（§2 方案一 + §4.6，BDD-23）、`getLimits` 失败降级（§4.6 末）逐项映射；上轮两处小缺口（幂等 200/201 区分、I-6 slug 覆盖语义）已分别由 §4.6「200 与 201 在 UI 上不区分」显式定性与 §4.7.1 恒在提示闭合。
- **锚点**：BDD-13/14/15/16/17/18/19/23/25/26/27；§3.2 + §4.6 + §4.7.1 + §4.10.3。

#### 交互设计细节 —— **9 / 10**

- **优点**：§3.2 输入态变化（summary 计数、可见性文本更新 BDD-29、slug 即早校验）+ **完整 Tab 顺序**；§3.2.1 过渡档落实 DESIGN.md §8（仅用 Fast 150ms，Medium/Slow 声明不用，`prefers-reduced-motion` 沿用全局）；§3.2.2 **程序化焦点管理表**（校验失败→汇总条、提交成功→结果态标题、「再发一个」→summary 输入）+ 提交中按钮保持 DOM 位置防焦点丢失——上轮「无过渡声明/无 focus 管理/loading 实现方式未定」三缺口全部闭合。
- **扣分**：「发布中…」按钮文案由页面 slot 自管（§3.4.2 已实核 `BaseButton` 无 loading prop）——明确可行，但未指定 slot 内是否含旋转图标（属实现自由度，扣 1）。
- **锚点**：BDD-13/27/29；§3.2.1 + §3.2.2 + §3.4.2。

#### 可访问性 / 键盘可达 —— **9 / 10**

- **优点**：§3.4.1 **逐字段**给出 `<label>` / `aria-label` / `aria-describedby` / `aria-invalid` / `role="alert"` 的完整关联表，且**逐字段复用** `TeamsView.vue` 既有三件套（实核同构）；§3.4.2 提交中 `aria-busy` + `role="status" aria-live="polite"` 公告、成功走 polite（不用 assertive）；§3.2.2 焦点迁移；§3.4.1 明确「id 用 `fileId` 非 index」保证删除行后 `aria-describedby` 不指错；tags/slug 提示用恒在 `.field-hint`（非 `role="alert"`）。上轮 a11y 全部缺口（未承接惯例/无 `aria-busy`/无结果态公告/无 tags 提示/禁用元素焦点）逐项闭合。
- **扣分**：**slug 输入的 `aria-describedby` 存在双 id 未合并的内部不一致**——§3.4.1 L251 写 `aria-describedby="publish-slug-error"`，§4.7.1 L359 写 `aria-describedby="publish-slug-hint"`；同一属性两个单值，实际应为 `"publish-slug-hint publish-slug-error"`（提示恒在 + 错误条件存在）。P4 若照抄任一单值会漏掉另一条描述。**扣 1**（详见 §5 遗留 W1）。
- **锚点**：BDD-14/15/17/18/19/26/27；§3.4.1 + §3.4.2 + §3.2.2。

### 4.3 视觉组

#### 视觉设计 —— **9 / 10**（布局一致性 0-2 / 颜色对比度 0-3 / 字体间距 0-3 / 组件一致性 0-2）

| 子项 | 分 | 依据 |
| :--- | :-- | :--- |
| 布局一致性 | 2/2 | §3.1.1 以**与 DESIGN.md §4 同体例**的 scoped override 表记录 720px 偏离（实核 §4 L115 例外原文），作用域限定 `.publish-content`；§3.1.2 三档断点补齐 |
| 颜色与对比度 | 3/3 | 全部既有 token（`--c-accent`/`--text-on-accent`/`--c-error`/`--c-surface`，实核存在）；明示 WCAG AA（body ≥4.5:1 / 大字 ≥3:1）；**不单以颜色传意**（错误 = 文本 + `role="alert"` + `aria-invalid`）；§3.3 增 **light/dark 双主题二值验证项**（上轮缺口闭合） |
| 字体与间距 | 3/3 | `--font-lg/xl/sm/xs`、`--space-4/5`（4px 网格）、输入 `min-height:44px`；补 **mono 场景**（path 输入/结果链接/slug 用 `var(--font-mono)`，实核 `variables.css:21`）；accent 用 mono（实核 `BaseTag.vue`） |
| 组件一致性 | 1/2 | 复用 `BaseButton`/`BaseTag`/`PageHeader`/`EmptyState`/`useToast`；上轮「与 Settings 表单节奏一致」的无约束表述已细化（字段块间距 `--space-4` + `<label>`+输入+错误三段式 + `.field-error`，与 `ProfileTab`/`TeamsView` 同构）。**残留**：§3.3 仍有一处轻度表述「沿用既有 WCAG AA 配色」未给具体对比度数值（虽为既有 token 的继承，可接受，但严格扣 1） |

- **优点**：§3.3 量化断言从 5 条扩至 **8 条**，新增覆盖**结果态**（断言⑥，BDD-10 链接块与复制按钮不重叠）与**文件行错误态**（断言⑦，`.file-row-error` 不重叠输入并位于其下）以及 **mono 断言⑧**——全部以 `getBoundingClientRect`/`getComputedStyle` 采集，无主观词。
- **锚点**：BDD-10/17/18/29；§3.1.1 + §3.1.2 + §3.1.3 + §3.3。

### 4.4 贯穿维度

#### AI Slop 风险 —— **9 / 10**

- **优点**：三组 UI 候选与逐组件契约使「随便搞」空间大幅收窄；无「样式照旧/按需处理」类表述；每项 checklist 带 px 值/token 名/组件名/BDD 编号；`PublishResult` 唯一构造处、`fileErrors` key 契约、错误 id 契约均落到具体 DOM。
- **扣分**：两处轻度放权仍在（§3.3「沿用既有 WCAG AA 配色」无数值；§4.10.4 `copiedTarget` 标「可选」，扣 1）。

#### ≥2 候选 + 权衡（布局/视觉/交互） —— **10 / 10**（上轮 3/10，本轮核心修复项）

- **事实**：§2.x.1 布局 3 候选（720 单列 / 1280 复用 Settings / 两栏）、§2.x.2 结果态视觉 3 候选（替换主区 / 顶部横幅保留表单 / Toast+跳转）、§2.x.3 行编辑 3 候选（内联 / 弹层 / 拖拽树），**每组 ≥2（实为 3）**。
- **真替代判据**：每个被否候选至少在一个可验证维度上优于采用项（L2 零偏离、L3 长列表独立滚动、R2 原地微调、R3 代码量、E3 构造嵌套目录直觉），且被否理由锚定 BDD + DESIGN.md 条款——**非稻草人**（§2.x 开头显式声明此约束）。
- **边界**：§2.x 显式声明其候选为 UI 维度取舍、**不改动** §2 架构候选的 `candidate_count: 2` 语义，无字段污染。
- **锚点**：BDD-14~19/29（布局）、BDD-10/12/13（结果态）、BDD-9/17/18（行编辑）；§2.x.1/2.x.2/2.x.3。

#### gate_commands 合理性（设计侧） —— **9 / 10**

- **优点**：**实核** Makefile（`test-frontend:173`=`npx vitest run`、`typecheck:193`=`vue-tsc --noEmit`、`test-quick:163`、`debug-test:648`）与 `package.json`（仅 `test: vitest` watch，禁用）；`P5_e2e` 指向 `E2E_SPEC=... make debug-test` → `run-e2e-tests.sh` 默认 `PORT=8888` + 显式 8080 生产拦截（实核 L21-31）；一 key 一命令，无 `&&` 短路；per-key `*_timeout_seconds`；无 `P3_xxx` 非法键（仅裸 `P3` + 元键 `P3_formatter`）。
- **扣分**：`P5_timeout_seconds: 180` / `P5_e2e_timeout_seconds: 600` 高于卡片建议档（单元 120s / E2E 300s）；偏宽非错误（E2E 600 可解释为 debug 起停开销），扣 1。`P3_formatter: ""` 空串沿用上轮观察，仍属可省元键。

---

## 5. 分形态维度汇总

| 组 | 维度 | 分值 | 主要 BDD / P2 节号锚点 |
| :--- | :--- | :-- | :--- |
| 布局 | 移动端考虑 | 9/10 | BDD-9/10；§3.1.2（tablet 补齐）/§3.1.3（390 结果态与错误态） |
| 布局 | 组件完整性 | 9/10 | BDD-6/9/15/17/18；§4.10.1~4.10.5 + §4.11（props/emits/状态/空态齐；`fileId` key） |
| 交互 | 交互状态覆盖率 | 10/10 | BDD-13/14/15/16/17/18/19/23/25/26/27；§3.2 + §4.6 + §4.7.1 + §4.10.3 |
| 交互 | 交互设计细节 | 9/10 | BDD-13/27/29；§3.2.1（过渡档）+ §3.2.2（焦点迁移）+ §3.4.2 |
| 交互 | 可访问性/键盘可达 | 9/10 | BDD-14/15/17/18/19/26/27；§3.4.1 + §3.4.2 + §3.2.2（slug 双 id 未合并扣 1） |
| 视觉 | 视觉设计 | 9/10 | BDD-10/17/18/29；§3.1.1/§3.3（720px 例外 + 双主题 + mono + 断言①~⑧） |
| 贯穿 | AI Slop 风险 | 9/10 | §2.x + §3.1-§3.4 + §4.10（两处轻度放权） |
| 贯穿 | ≥2 候选 + 权衡 | 10/10 | §2.x.1/2.x.2/2.x.3（三组各 3 候选 + 真替代权衡） |
| 贯穿 | gate_commands | 9/10 | §5（实核 Makefile，`:8888`，无 `&&` 短路；timeout 偏宽） |

**加权总分：91 / 100**（未设权重时按等权平均，含贯穿维度）。

---

## 6. 复核新引入的不一致（rev1 回归检查）

rev1 新增/改写了 §2.x、§3.1.1~§3.2.2、§3.3~§3.4、§4.3/§4.5/§4.6/§4.7.1/§4.9/§4.10/§4.11。逐处交叉核对，发现 **2 处轻度文本不一致**（均不影响架构成立性，均已定位权威口径）：

| # | 不一致 | 位置 | 权威口径 | 严重度 |
| :-- | :--- | :--- | :--- | :--- |
| W1 | slug 输入 `aria-describedby` 在同一属性上给出两个不同单值：§3.4.1 L251 = `"publish-slug-error"`，§4.7.1 L359 = `"publish-slug-hint"`。因提示恒在 + 错误条件存在，应为空格连接的 `"publish-slug-hint publish-slug-error"` | §3.4.1 ↔ §4.7.1 | §3.4.1 表（错误关联）+ §4.7.1（恒在提示），二者应合并 | WARNING |
| W2 | §3.4.1 L256「顶部汇总条」行 testid 列写 `publish-field-error-summary`，但同行模板用 `data-testid="publish-error-summary"`；且该列标题为「错误元素 id」却填 testid。§4.8 L376 与 §4.10.5 L445-446 均定义：`publish-error-summary`=顶部汇总、`publish-field-error-summary`=字段级 summary | §3.4.1 ↔ §4.8/§4.10.5 | §4.8 + §4.10.5（testid 权威映射） | WARNING |

- **判定**：两处均为**局部契约文本瑕疵**，P4 按 §4.8/§4.10.5 权威表实现即可修正，**不构成 P4 凭空实现缺口，也不违反任何 BDD**。不达 `needs-revision` 门槛（上轮 4 项打回项已全部消除），记为 WARNING 建议 P3/P4 顺手修正。
- **未发现**与上轮「已达标项」冲突的其他回归：`fileErrors`/`fileId` 在 §1.1 M8、§4.5、§4.10.3 三处一致；错误 id（`publish-summary-error`/`publish-slug-error`/`publish-file-error-{fileId}`）在 §3.4.1 与 §4.10.5 一致；`PublishResult` 构造处唯一（§4.11）。

---

## 7. [SCOPE+]×2 吸收判定（复核）

| SCOPE+ | 设计吸收情况 | 判定 |
| :--- | :--- | :-- |
| 错误体形状（400 `error.message`；422 数组 `detail`） | §4.6 形状表分叉两形 + `extractApiErrorMessage` 统一（优先 `error.message` → `detail` 字符串 → `detail[]` 映射 `msg` 拼接 → 兜底），显式禁 `String(detail)`；§4.9 E2E 判据①定义 422 断言「非 `[object Object]` 且含 msg」；§6 minimal_validation 标注「BDD-26 双路径均可读，已闭合」 | ✅ **完整吸收**（上轮「部分吸收」缺口闭合） |
| 响应 `url` 非当前源 | §4.3 用 `window.location.origin + '/' + slug`（及 `/raw`）构造，`response.url` 仅兜底；§4.11 `PublishResult` 明确 `pageLink/rawLink` 由页面构造、组件不读 `window.location` | ✅ **正确吸收**（与上轮一致） |

---

## 8. 是否需要补充方案

**不需要（`status: approved`）。**

- 上轮 4 项打回项（≥2 候选 / 组件契约 / a11y 契约 / 422 渲染）**全部闭合**；另 2 项次要补充（视觉移动端细化、I-6 与 R7）亦已闭合。
- 架构方案（§2 方案一）、编码规则（§4.4）、幂等键（§4.2）、gate_commands（§5）等已达标项保持稳定，无回退。
- 本轮新增的 2 处 WARNING 级文本不一致（§6 W1/W2）**不阻断 P2 推进**：权威口径明确（§4.8/§4.10.5 / 双 id 合并），建议 P3 test-designer 落用例时一并按权威映射对齐，或 P4 implementer 顺手修正。

**建议（非阻断）**：P3 用例设计时，W1 slug `aria-describedby` 断言应为「包含 `publish-slug-hint` 与 `publish-slug-error` 两 id」；W2 汇总错误 E2E 定位用 `publish-error-summary`（顶部）/ `publish-field-error-summary`（summary 字段级），与 §4.8 表一致。

---

## 9. 评审元信息

- **agent**: `plan-design-review`（独立评审，≠ main）✅
- **round**: rev1（复评；被评审对象 v1.1，已按上轮意见修订）
- **只读纪律**：全程未执行 `git checkout/restore/reset/stash/clean/add/commit/switch -f`，未编辑被评审文件（`git status` 无被评审文件改动）✅
- **命令超时**：所有 bash 均 `timeout 180s` ✅
- **环境**：`[PROD_NOT_TOUCHED]` ✅（未起服务，未触碰 `:8080` / `~/.peekview/`）
- **证据**：实核命令与落点见 §1/§3 表（`main.py` / `Makefile` / `package.json` / `run-e2e-tests.sh` / `config_router.py` / `entry_service.py` / `variables.css` / `base.css` / `ProfileTab.vue` / `TeamsView.vue` / `BaseButton.vue` / `DESIGN.md` / spec V1.1）

## 10. 变更记录

| 日期 | 版本 | 变更 |
| :--- | :--- | :--- |
| 2026-10-01 | v1 | 初稿。9 维度评分，总分 72/100；终态 `needs-revision`（≥2 候选缺失为主要打回项 + 组件契约/a11y/422 渲染三缺口） |
| 2026-10-01 | rev1 | 复评轮。逐条核对上轮补充清单 1–6 **全部闭合**；复核已达标项无回退；重评 9 维度（布局/交互/视觉 + 贯穿），总分 **91/100**；发现 2 处 WARNING 级新文本不一致（§6 W1 slug `aria-describedby` 双 id 未合并 / W2 §3.4.1 顶部汇总 testid 误标），不阻断推进；终态 **`approved`** |

---

## 8. 评审后主 Agent 变更记录（追加）

评审 approved 后，主 Agent 对 `P2-design.md` 的 `gate_commands` 做了两处**非设计性**修正（不影响任何评审结论）：
- `P3`: `cd frontend-v3 && npx vitest run --reporter=dot` → `make test-frontend`（Makefile 为测试命令唯一真相源；并消除 `check-gate.py` 对首 token `cd` 的假阳性 WARNING）
- `P3_formatter`: `""` → `"vitest.sh"`（启用内置 formatter，vitest 输出标准化为 JSON）

`P5` / `P5_e2e` / `P5_backend` / `P5_typecheck` 及所有设计节（§1–§4）**未改动**。`agate-read-gate-commands.py` 实跑确认解析正确；P2 gate 复跑无 WARNING。评审维度结论（layout 三组 + 贯穿）不受影响。
