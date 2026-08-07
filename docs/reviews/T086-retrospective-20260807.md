# T086 admin/settings 信息架构收敛 — agate 全流程复盘

> 任务：T086-admin-settings-consolidation（AdminView 独立页面整合进 SettingsView 的 tab）
> 版本：v0.17.1 → v0.18.0（minor）
> 会话时间：2026-08-06（P0 立项，前一会话）；2026-08-07 09:18 ~ 12:13（P1-P8，本会话，~2h54m）
> 复盘日期：2026-08-07
> 复盘人：主 Agent（orchestrator）
> 依据：本会话原始记录 + git commit 时间戳（`git log --date=format` 直接读取，非回忆）

---

## 0. 概览

| 维度 | 数值 |
|------|------|
| 总墙钟（P1 commit → DONE） | 2h54m09s（09:18:40 → 12:12:49，全程无外部故障挂起） |
| subagent 派发总数 | 20 次 |
| subagent 崩溃 | 0 |
| gate 首次不通过次数 | 5 次（P1×1, P2×2, P4-review×1, P5×2） |
| 阶段回退（retreat） | 2 次（P5→P4 diff=1；P5→P3 diff=2，PAUSED + 人工批准） |
| PAUSED 次数 | 1 次（跨 2 阶段回退，按 state-machine.md 规则触发） |
| 真实 bug 数（生产代码/测试代码） | 2 个（router.ts 路由拦截；admin.spec.ts 选择器缺 scope） |
| 发现的 agate 框架级 bug | 1 个（pre-commit hook exit-code 语义丢失，已提交修复并验证生效） |
| 最终 BDD 验收 | 17/17 PASS |

**核心结论**：本任务的 agate 流程本身运转正常——两次回退都是"验证机制抓到真问题"而非"流程空转"，P7 一致性检查也做了真正的独立代码核查。真正值得深挖的是**为什么这两个真 bug 会被引入**，以及**流程中重复出现两次的同一类格式契约问题**——这两类问题才是本次复盘的主体。

---

## 1. 客观记录（时间线，commit 时间戳直接读取）

| 阶段 | commit 时间 | 间隔 | 关键事件 |
|------|------------|------|---------|
| P0 | 2026-08-06（前一会话） | — | P0-brief.md 已就绪，本会话直接续接 P1 |
| P1 | 08-07 09:18:40 | — | analyst 首次派发 → requirements-review approved → **gate 失败#1**（`phases:` 字段散文非机器可读）→ 补丁 → commit |
| P2 | 08-07 09:34:41 | 16m01s | architect 单方案设计 → plan-design-review approved（发现真实双挂载风险）→ **gate 失败#2a**（`follows_existing_pattern:` 同类问题）→ **gate 失败#2b**（候选方案标题全角冒号未命中正则）→ 两次补丁 → commit |
| P3(首次) | 08-07 09:48:06 | 13m25s | test-designer 改 2 个测试文件，check-tdd-red.sh exit 0（真红灯） |
| P4(首次) | 08-07 10:04:02 | 15m56s | implementer 实现 + DESIGN_GAP（t068 mock 修复）→ design-review needs-revision（CSS 偏差）→ retry1 修复 → approved |
| P4(retry2) | 08-07 10:19:14 | 15m12s | **P5 首次全量重跑发现真 bug**（router.ts 路由拦截 /admin）→ 诊断 → 回退 P4 → 定向修复 |
| PAUSED | 08-07 10:34:01 | 14m47s | **P5 retry1 全量重跑证实路由修复生效，但发现新真 bug**（BDD-11 选择器缺 scope）→ 判定问题源头在 P3 → diff=2 触发 PAUSED → 人工批准跨阶段回退 |
| P3(fix) | 08-07 10:36:10 | 2m09s | test-designer 定向修复 1 行选择器 |
| P5(retry2) | 08-07 10:43:08 | 6m58s | 全量重跑 36/36 pass，BDD-11/12 首次真正执行且通过 |
| P6 | 08-07 11:13:43 | 30m35s | verifier 17/17 BDD PASS（含 15 张截图 + vision 分析）；**首次撞上 pre-commit hook bug**，`--no-verify` 绕过（人工批准） |
| P7 | 08-07 12:03:29 | 49m46s | 含：用户对截图"半透明"的质疑排查（结论：非 bug，页面本身低对比度设计）+ hook bug 诊断/报告/交给 agate 团队修复/验证修复生效 + consistency-reviewer 派发 + approved |
| P8 | 08-07 12:12:39 | 9m10s | releaser 发布准备 + 主 Agent 亲自跑发布检查（发现无关预存失败并隔离验证）+ bump-version + tag |
| DONE | 08-07 12:12:49 | 10s | state 收尾 |

### 1.1 subagent 派发统计

| 阶段 | dispatch 数 | 角色 |
|------|------------|------|
| P1 | 4 | analyst, requirements-review, analyst-formatfix×2 |
| P2 | 3 | architect, plan-design-review, architect-headingfix |
| P3(首次) | 1 | test-designer |
| P4(首次+CSS修复) | 4 | implementer, design-review, implementer-retry1, design-review-retry1 |
| P4(retry2 路由修复) | 1 | implementer |
| P5(首次+retry1) | 2 | verifier×2 |
| P3(选择器修复) | 1 | test-designer |
| P5(retry2) | 1 | verifier |
| P6 | 1 | verifier |
| P7 | 1 | consistency-reviewer |
| P8 | 1 | implementer（releaser 模式） |
| **合计** | **20** | 0 崩溃 |

---

## 2. 问题清单（现象 / 定位 / 机理 / 处置 / 风险，按归因分类）

### 类别 A：管理原因（agate 协议本身的设计/脚本缺陷）

#### A1. 结构化字段"格式契约"在角色卡与 gate 脚本之间不同步（本任务命中 2 次）

- **现象**：P1 阶段 `check-pruning.sh` 报"裁剪条件不满足"；P2 阶段 `check-gate.sh` 报"候选方案数不足"——两次报错时，对应的 P1-requirements.md 内容在**语义上**都已经正确声明（散文形式写清楚了"不裁剪任何阶段"/"follows_existing_pattern"），但脚本仍判定不通过。
- **定位**：
  1. `check-pruning.sh` 用正则 `phases:\s*\[([^\]]+)\]` 解析裁剪声明，P1-requirements.md 只有散文表述，无对应 YAML 字段
  2. `check-gate.sh` P2 分支用正则 `^(design_trivial|follows_existing_pattern):\s*\S` 读取 P1-requirements.md，同样只有散文引用，无独立行首字段
- **机理**：`analyst.md` 角色卡对"phases:"、"follows_existing_pattern:"等字段的产出要求，用自然语言描述（"声明跳过哪些阶段"），没有给出强制性的 YAML 代码块模板。analyst 在写作时优先满足"人类可读"（把裁剪意图讲清楚），而 gate 脚本要求的是"机器可解析"的独立字段——这是同一份产出物要同时服务"人看"和"脚本读"两种消费者，但角色卡的写作指引没有把"必须同时满足两种格式"讲清楚，导致同一类问题在同一个任务里出现 2 次（不同字段，同一根因）。
- **处置**：两次都是最小格式补丁（追加 YAML 代码块，`[BASELINE_CHANGE:]` 标注，零语义改动），验证通过后继续。未伤及任何 BDD/设计内容。
- **风险与建议**：这不是孤立事件——`~/.agate/assets/execution-roles/analyst.md` 和 `architect.md` 里所有要求"声明 xxx 字段"的地方，都应该在角色卡文档里**直接给出可复制的 YAML 代码块模板**，而不是只用一句话描述要求。建议 agate 项目组对 P1/P2 阶段涉及 gate 脚本正则解析的所有字段（`phases:`、`domains:`、`risk_level:`、`design_trivial:`、`follows_existing_pattern:` 等）做一次统一审计，在角色卡里补全模板示例，从源头消除这类"语义对但格式错"的返工。

#### A2. `check-gate.sh` P2 候选方案标题正则鲁棒性不足

- **现象**：`check-gate.sh` 判定 P2-design.md 候选方案数为 0，即便 architect 已经写了完整的候选方案内容。
- **定位**：正则 `方案\s*[A-Za-z0-9一二三四五]` 要求"方案"后紧跟字母/数字/中文数字，architect 写的标题是`### 方案：xxx`（"方案"后接全角冒号），不在允许字符集内。
- **机理**：纯粹的正则设计边界覆盖不全——中文技术文档里"方案：描述"（冒号分隔）是和"方案一：描述"（数字/序数词）同样自然、常见的写法，脚本设计时只覆盖了后者。这跟 agent 的理解/遵循无关，architect 的写法没有任何问题。
- **处置**：单字符插入（"方案" → "方案一"），验证后继续。
- **风险与建议**：建议 agate 项目组把正则放宽为 `方案\s*[:：]?\s*[A-Za-z0-9一二三四五]?`，或者更根本地，把候选方案的判定从"标题正则匹配"改为"结构化计数字段"（如要求 P2-design.md 显式声明 `candidate_count: 1`），从依赖自然语言标题格式的脆弱匹配，改为显式声明，能同时解决 A1/A2 这两类问题的共同根源。

#### A3. pre-commit hook 里 `check-p6-evidence.sh` 的 exit 2（WARNING）被 `|| exit 1` 误当阻塞处理

- **现象**：P6/P7 阶段 commit 被无差别拦截，即便只有 WARNING 级别的发现（4 张截图像素方差偏低，人工核实均非充数图）。
- **定位**：`pre-commit-gate.sh` 第 258 行 `bash check-p6-evidence.sh "$TASK_DIR" || exit 1`，`||` 把子脚本的 exit 1（真失败）和 exit 2（WARNING，脚本自身设计为不阻断）一视同仁地当成阻塞；而同一文件第 304 行左右的主 gate 结果处理逻辑，采用的是正确的三态 `case` 分支。
- **机理**：这是 agate 框架代码本身的实现缺陷（不是设计原则错误）——大概率是给 `check-p6-evidence.sh` 新增 exit 2（WARNING）语义时，忘记同步调用处的处理逻辑，属于**框架维护过程中的同步遗漏**。因为 `.git/hooks/pre-commit` 是指向 `~/.agate/scripts/pre-commit-gate.sh` 的符号链接，这个 bug 影响的是机器上所有安装该 hook 的项目仓库，不是 peekview 独有。
- **处置**：诊断后写成结构化问题报告（`hook-bug-plan.md`/`.html`），发布为 Artifact 交由用户转 agate 项目组审核（peeklink 工具本会话不可用，改用 Artifact 作为替代通道），agate 团队修复后本会话独立验证生效（改用 marker 方式在同一 command substitution 内可靠捕获退出码，比复盘者最初提议的写法更稳健）。修复前的 1 次 P6 commit 用 `--no-verify` 绕过，经用户明确批准。
- **风险与建议**：这类"同一文件里存在两种不一致的错误处理模式"的问题，可能还有其他类似遗漏点未被发现（这次是撞上"低方差截图 WARNING"这个具体场景才暴露）。建议 agate 项目组对 `pre-commit-gate.sh` 里所有子脚本调用点做一次统一 review，确认全部改为三态 `case` 处理，而不是逐个 commit 撞上才修一个。

---

### 类别 B：技术原因 — agent（analyst/architect/主 Agent）对 agate 协议的执行/遵循情况

#### B1.【本任务最重要的一条】P2 architect 对"纯代码逻辑"的最小验证豁免用错了地方，导致路由拦截 bug 被引入

- **现象**：P5 首次全量重跑，`E2E_SPEC=e2e/admin.spec.ts make debug-test` 发现 2 个真失败——`/admin` 被非 admin/未登录用户访问时，没有落到 404，而是被当作 entry slug 查询。
- **定位**：`router.ts` 的 `/:slug`（详情页路由）注册顺序早于 `/:pathMatch(.*)*`（catch-all 404），vue-router 按数组声明顺序匹配，`/admin` 删除后被 `/:slug` 拦截。
- **机理（这是本次复盘最值得记录的一条）**：P2-design.md §3.1 明确写"删除后 `/admin` 落到 catch-all `path: '/:pathMatch(.*)*'` → `NotFoundView.vue`，天然满足 BDD-8/9/10"——这是一个**未经验证的假设**。architect 在 P2 阶段确实按 files_to_read 清单读取了 `router.ts` 全文，但阅读方式是"定位要删除的两处代码"，没有做"删除后，这个路径最终会匹配到哪条路由"的**反向推演**。更关键的是，P2-design.md 的 `minimal_validation` 字段声明"纯代码逻辑，无外部系统依赖"——这个判断本身没有错（确实不涉及浏览器安全模型/外部系统），但**"纯代码逻辑"不等于"不需要验证"**：vue-router 的路由匹配顺序是一个有明确、可快速验证的行为契约（哪怕不涉及外部系统），这类"内部函数/框架行为的正确性假设"同样属于 architect.md 角色卡定义的"minimal_validation 必须声明"的范畴，而不应该被"纯代码逻辑"这个标签直接豁免。这是**minimal_validation 判断标准被误用**的一个具体案例：把"不需要外部验证"错误地扩大成了"不需要任何验证"。
- **处置**：P5→P4 直接回退（diff=1，无需 PAUSED），最小修复（显式注册 `/admin → NotFoundView` 路由插在 `/:slug` 之前），P5 全量重跑证实修复生效。
- **风险与建议**：这不是 architect 角色能力不足，是**验证方法论的一个具体缺口**——当方案涉及"删除/移动一条现有路由/接口"时，应该强制要求做一次"删除后，原本依赖这条路由的其他请求/组件会流向何处"的正向推演，哪怕不需要启动浏览器/外部系统，也应该在 `minimal_validation` 里体现为"读代码验证路由匹配顺序"这类最小验证动作（哪怕只是一句"已确认 `/:slug` 排在 `/admin` 删除位置之前，需要显式处理"就能避免这次 bug）。建议在 architect.md 角色卡的 minimal_validation 章节补充一条：**"涉及删除/移动现有路由、接口、注册表项的设计，必须验证删除后原路径最终落向哪个兜底分支，不因'纯代码逻辑'豁免"**。

#### B2. 主 Agent 转述 P2-review 的风险范围时窄化，导致新增测试用例漏了同一个已知风险点

- **现象**：P5 retry1 全量重跑，BDD-11（UserMenu 入口）strict-mode violation——选择器命中 2 个 DOM 元素。
- **定位**：`admin.spec.ts:276` 的 `[data-testid="user-manager-content"]` 未加视口 scope 前缀，撞上 `SettingsView.vue` 桌面/移动双挂载（同文件 BDD-01/02 已用 `scopeOf()` helper 正确处理了同一模式）。
- **机理**：P2-review.md 的 Advisory Note #1 已经明确预警了"双挂载会导致选择器命中 2 个元素"这个风险，但我（主 Agent）在撰写 P3-dispatch-context-test-designer.md 时，把这条风险转述为"迁移 `e2e/admin.spec.ts` 中含 `count()`/`toHaveCount` 类断言的用例（至少 BDD-01）时，必须……加视口 scope"——**这个转述把风险范围窄化成了"count 类断言"，但实际的风险面是"任何命中双挂载元素的单元素定位断言"（包括 `toBeVisible()` 这类非 count 断言）**。test-designer 严格按 dispatch-context 的字面要求处理了 BDD-01/02（count 类），但新写的 BDD-11（`toBeVisible()`，非 count 类）不在字面范围内，因而漏了同一个防护。这是**主 Agent 在派发时对上游风险的复述精度不够**，不是 test-designer 的执行问题——test-designer 完全遵循了 dispatch-context 给出的范围，只是这个范围本身画窄了。
- **处置**：这条真 bug 需要跨 2 阶段回退（P5→P3，diff=2），触发 PAUSED，人工批准后定向修复。
- **风险与建议**：这是本次复盘里唯一一条能明确追溯到"主 Agent 自己的派发质量"的根因。改进方向：主 Agent 在把 review 阶段发现的风险转述进下游 dispatch-context 时，应优先复制 review 原文的风险描述（"双挂载会导致选择器命中 2 个元素"），而不是自己提炼出一个更窄的技术分类（"count 类断言"）作为约束条件的边界——**转述时收窄范围，是本次流程里唯一一处实质性的"人祸"，值得作为独立的复盘教训**。

#### B3. 主 Agent 因 bash 工具 cwd 跨调用持久化的特性，两次误用相对路径导致 git 操作失败

- **现象**：两次 `git add docs/tasks/...`（相对路径）报"路径规格未匹配任何文件"。
- **定位**：前一次 Bash 调用里派发的 subagent 返回的 verify 步骤用了 `cd frontend-v3 && ...`，而这个环境的 Bash 工具"工作目录持久化跨调用"，导致后续我自己的 `git add` 调用仍处在 `frontend-v3/` 目录下执行，相对路径解析出错。
- **机理**：纯粹的操作纪律问题——不是 agate 协议问题，也不是模型能力问题，是我（主 Agent）在连续执行多个 bash 命令时没有始终用绝对路径或显式 `cd` 回仓库根目录，对工具的 cwd 状态假设有误。
- **处置**：两次都是 `cd /home/kity/oclab/peekview && ...` 后立即恢复正常，无实质影响（除了浪费一轮工具调用）。
- **风险与建议**：后续 orchestrator 层的 git 操作应统一在命令前加 `cd {repo_root} &&` 前缀，或每次先跑 `pwd` 确认，不假设 cwd 状态。这是一个可以通过操作习惯完全消除的低风险问题。

---

### 类别 C：技术原因 — 工具/基础环境

#### C1. Playwright 截图脚本缺少 CSS 过渡的 settle-wait（有风险，本次未命中，但流程漏洞真实存在）

- **现象**：用户看截图观感"半透明"，怀疑截图时机过早。
- **定位**：`App.vue` 确有 `<transition name="fade" mode="out-in">` + `opacity: 0.15s ease` 的路由切换淡入淡出；P6 verifier 的截图脚本模式是 `waitForSelector(state:'visible')` 后立即 `screenshot()`，中间没有等待过渡结束的 settle wait（只有 2 处用例额外加了 `waitForTimeout(300)`，其余没有）。
- **机理**：Playwright 的 "visible" 状态判定只要求元素非零尺寸、非 `display:none`/`visibility:hidden`，不要求 `opacity===1`——理论上确实可能在淡入过程中截图。但用 PIL 对被质疑的 4 张截图做像素级核查（RGB 值精确匹配 CSS 主题变量、无 alpha 通道混合痕迹），确认这次实际截取的都是淡入完成后的稳态画面，视觉上的"低对比度"是页面本身极简设计（大面积浅灰背景 + 小块深色文字）的固有效果，不是截图时机 bug。**这是一次"排查后证伪"的案例**，但排查过程发现的脚本时序缺陷是真实存在的，只是这次运气好没有命中。
- **处置**：本次不需要重截，因为像素级核查已排除该风险实际发生。已记录在案，未强制修复。
- **风险与建议**：建议后续 P6 verifier 的截图脚本模板统一加一步"过渡完成确认"（如 `waitForTimeout(200)`，或更严谨地用 `page.evaluate` 检查目标元素 `getComputedStyle().opacity === '1'`），而不是依赖"这次抽查没踩上"的运气。这类风险在低对比度、有淡入动画的设计系统里会反复出现，值得固化成标准步骤。

---

### 类别 D：项目本身原因

#### D1. `SettingsView.vue` 桌面/移动双挂载布局是长期技术债，给 E2E 测试引入系统性易错点

- **现象**：B2 描述的选择器 bug，根源是 `SettingsView.vue` 对桌面 tab-content 和移动端 mobile-stacked 用的是"两套 DOM 同时挂载 + CSS `display` 切换可见性"，而非条件渲染。
- **机理**：这个模式在 T086 之前就已经是项目既有架构（应用于 Profile/Security/API Keys 三个既有 tab），T086 只是把这个模式自然延伸到第 4 个 tab。P2-review.md 已经把这个模式点名为"现状既有模式"，不是本任务引入的新问题。但这个架构选择本身，给任何后续在这个组件上写 E2E 测试的人都埋了一个"必须记得给每个选择器加 viewport scope"的隐性契约——这个契约目前只存在于代码注释和 review 记录里，没有任何自动化手段强制执行（比如 lint 规则检测 `.desktop-only`/`.mobile-only` 容器内的 `data-testid` 是否总是要求 scope 查询）。
- **处置**：本任务范围内不做架构重构（不在 P1 BDD 范围内）。
- **风险与建议**：建议列入 roadmap——评估把这个"双重渲染 + CSS 切换"模式改为真正的条件渲染（`v-if` + `matchMedia`/`useBreakpoints` 组合，只挂载当前视口需要的一份 DOM），从架构层面消除"同一组件两份 DOM"这个易错源，而不是持续依赖"写测试的人记得加 scope"这种约定。这类技术债不改，未来每次给这几个 tab 加新的 E2E 用例都有同样的翻车概率。

#### D2. store mock 的"死代码字段"缺陷——字面量属性未镜像真实响应式契约

- **现象**：P4 实现阶段，`t068-account-settings.spec.ts` 的 7 个用例意外回归失败。
- **机理**：该文件的 `vi.mock('@/stores/auth', ...)` 里 `isAdmin: false` 是字面量布尔值，而不是 `ref`/`computed`，`storeToRefs()` 对字面量属性解构不出对应的响应式引用，得到 `undefined`。这个缺陷在 T086 之前就存在，只是此前 `SettingsView.vue` 从未真正读取 `authStore.isAdmin`，缺陷是死代码，T086 是第一个真正消费该字段的改动，因而暴露。
- **处置**：已定向修复（mock 字段改为 `computed`，未改任何测试断言），P7 独立核实修复合理且未被覆盖。
- **风险与建议**：这类"mock 对象字段没有严格镜像真实 store 响应式契约"的缺陷，可能还存在于其他尚未被消费的 mock 字段里，只是还没有改动触发它们。建议对项目内所有 `vi.mock('@/stores/*')` 的 mock 工厂函数做一次专项审计，确认所有字段类型（`ref`/`computed`/字面量）与真实 store 的定义一致，防止未来任何"第一次真正使用某字段"的改动都要重新踩一次这个坑。

#### D3. `make pre-publish-quick` 未默认排除 `integration` 标记测试，发布检查在无远程服务的沙盒环境必然误伤

- **现象**：P8 阶段执行 `make pre-publish-quick`，`test_cli_remote.py`（全文件 `pytest.mark.integration`）3 failed + 3 errors，报 `Connection refused`（需要 `127.0.0.1:18888` 的远程服务，当前环境未启动）。
- **机理**：`test-quick` Makefile 目标（`pre-publish-quick` 的依赖之一）执行 `pytest tests/ -n auto --tb=short`，没有排除 `integration` 标记。这与 T086 本身零关联（T086 全部改动在 `frontend-v3/`），已用 `pytest -m "not integration"` 隔离验证其余 1052 个用例全部通过，确认失败面精确隔离在这一个需要外部服务的文件。
- **处置**：登记 `known-failures.md`，推迟处理（不影响本次发布）。
- **风险与建议**：这不是本任务引入的问题，但每次发布检查都会在没有远程服务的沙盒环境里撞到同一堵墙，依赖人工每次重新识别"这是预存问题"。建议：① 把 `pre-publish-quick`/`test-quick` 默认加 `-m "not integration"`，把 integration 测试单独隔离成一个需要显式启动远程服务的独立 CI job；② 或者给 `pytest.ini`/`pyproject.toml` 注册 `integration` marker（当前是 `PytestUnknownMarkWarning`，连 marker 都没正式注册），减少这类"标记了但没被正式识别"的隐性维护债。

---

## 3. 做得好的地方

1. **P5 全量重跑纪律真正发挥了作用**：两次回退都不是"流程走个形式"——第一次抓到了 P2 架构假设错误（catch-all 天然生效的假设是错的），第二次抓到了 P3 测试代码本身的选择器缺陷。如果没有"P5 必须全量重跑、不能只测修复项"这条纪律，第二个 bug（BDD-11/12 三轮里从未被真正执行过，直到 retry2 才第一次跑到）会一直隐藏在"级联跳过"的假象里，直到 P6/生产环境才暴露。

2. **P7 一致性检查做了真正的独立代码核查，不是转抄文档**：`P7-consistency.md` 对每一处 DESIGN_GAP 配对、每一处跨文件一致性核对，都用 `Bash` 工具直接读取当前代码状态验证，而不是只转述上游文档的描述——这次两处 DESIGN_GAP 复核（t068 mock 修复、t080 15b/15c 处理）都是独立判断（不是简单转抄 P2-review 的结论），体现了"P7 不信任 P4/P5 自报"的设计初衷。

3. **对用户质疑的排查是认真的、可验证的**：面对"截图看起来半透明"的质疑，没有用"应该没问题"搪塞，而是先定位到真实存在的 CSS 过渡代码，再用 PIL 做像素级核查得出证据支撑的结论（不是"我觉得没问题"，是"RGB 值精确匹配主题变量，无 alpha 混合痕迹"）。即便最终结论是"证伪"，排查过程本身发现了一个真实的、值得记录的流程风险（C1）。

4. **发现 agate 框架级 bug 后走的是正规流程，不是绕过了事**：没有直接改共享框架文件了事，而是先诊断、写结构化报告、发布可审阅的链接、明确说明修改范围和风险、交给用户判断是否升级给 agate 团队——这是面对"发现的问题超出本任务权限范围"时的正确处理方式。

---

## 4. 处置措施汇总表

| # | 问题 | 类别 | 措施 | 优先级 | 归属 |
|---|------|------|------|--------|------|
| 1 | 结构化字段格式契约与角色卡描述不同步 | 管理(A1) | 角色卡补全 YAML 模板示例，覆盖 `phases`/`domains`/`risk_level`/`design_trivial`/`follows_existing_pattern` 等全部 gate 脚本要解析的字段 | 🔴 高 | agate 项目组 |
| 2 | P2 候选方案标题正则鲁棒性不足 | 管理(A2) | 放宽正则，或改为显式 `candidate_count:` 字段声明 | 🟠 中 | agate 项目组 |
| 3 | pre-commit hook exit-code 语义丢失 | 管理(A3) | ✅ 已修复并验证生效；建议对全文件所有子脚本调用点做统一 review | 🟢 已完成，遗留建议中优先级 | agate 项目组 |
| 4 | minimal_validation 判断标准误用（"纯代码逻辑"≠"不需要验证"） | 技术-agent(B1) | architect.md 补充路由/接口删除类设计的强制验证要求 | 🔴 高 | agate 项目组（角色卡） |
| 5 | 主 Agent 转述风险时窄化范围 | 技术-agent(B2) | 操作习惯：转述 review 风险时优先复制原文描述，不自行收窄技术分类 | 🟠 中 | 主 Agent 自身操作规范 |
| 6 | bash cwd 跨调用持久化导致相对路径操作出错 | 技术-agent(B3) | git 操作统一加 `cd {repo_root} &&` 前缀 | 🟢 低 | 主 Agent 自身操作规范 |
| 7 | 截图脚本缺少 CSS 过渡 settle-wait | 技术-工具(C1) | P6 verifier 截图脚本模板加过渡完成确认步骤 | 🟡 低（未命中，预防性） | agate P6 卡片/角色文件 |
| 8 | SettingsView 双挂载布局技术债 | 项目(D1) | 评估改为条件渲染架构 | 🟡 低（架构级，非紧急） | peekview 项目 roadmap |
| 9 | store mock 字面量属性未镜像响应式契约 | 项目(D2) | 全项目 mock 工厂函数专项审计 | 🟠 中 | peekview 项目 |
| 10 | pre-publish-quick 未排除 integration 测试 | 项目(D3) | 默认排除 `-m "not integration"` 或注册独立 CI job | 🟠 中 | peekview 项目 |

---

## 5. 风险与缓解（前瞻）

- **格式契约类问题（A1/A2）会在未来任何新任务里以同样模式复现**，直到角色卡模板补全——这是本次复盘里"复现概率最高"的一类风险，建议优先处理。
- **B1（minimal_validation 误用）是本次唯一一个真正造成生产代码 bug 的根因**，风险缓解的关键不是"这次修好了就完了"，而是要让 architect 角色卡明确"纯代码逻辑"和"不需要验证"不是同一件事，否则同类问题会在下一个涉及路由/接口删除的任务里重演。
- **hook bug（A3）修复后需要观察是否有同类遗漏点**——这次是撞上了一个具体场景才暴露，不代表 `pre-commit-gate.sh` 里没有其他类似的三态处理不一致的地方，建议做一次专项 review 而非等下一次撞上再修。
- **D1/D2/D3 都是"当前不阻断，但会持续产生小额维护成本"的技术债**，不需要立即处理，但应该进入 roadmap 可见范围，避免长期被忽略后一次性爆发。

---

## 6. 结论

T086 全流程 2h54m，20 次 subagent 派发，0 崩溃，2 次真实回退（含 1 次 PAUSED 人工批准），最终 17/17 BDD PASS，v0.18.0 发布。agate 流程本身的核心质检机制（P5 全量重跑、P7 独立核查、PAUSED 跨阶段人工把关）都真实发挥了作用，不是走过场。

本次复盘最有价值的两条发现：① **P2 architect 对"纯代码逻辑无需验证"这条豁免的误用**，是唯一一个直接导致生产代码 bug 的根因，值得写进 architect.md 角色卡作为强制检查项；② **主 Agent 自己在转述上游风险到下游 dispatch-context 时把范围画窄**，是本次流程里唯一一处能明确追溯到"编排质量"而非"协议/脚本/agent 执行"的问题，提醒以后转述风险时要复制原文而非自行提炼分类。

另有 1 个 agate 框架级 bug 作为副产物被发现、报告、修复、验证——这类"任务执行过程中意外发现的基础设施问题"，走独立报告+审核流程而非顺手绕过，是本次流程处理方式上做得对的地方。
