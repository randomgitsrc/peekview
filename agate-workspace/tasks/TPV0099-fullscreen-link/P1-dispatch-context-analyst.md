# P1-dispatch-context-analyst — TPV0099

---
phase: P1
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: analyst
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

为「全屏模式链接 `/{slug}/f`」建立需求基线，产出 `P1-requirements.md`。任务一句话：**分享场景下，接收者打开 `https://host/{slug}/f` 应直接进入锁定的纯内容视图，且无任何页内出口**。

## 输入文件（必读，按序）

1. `agate-workspace/tasks/TPV0099-fullscreen-link/P0-brief.md` —— **主要输入**。注意文末「P0 时效性自检（2026-09-28 开工实核）」节，其中已由主 Agent 实核更正了若干前提，**以该节为准**。
2. `frontend-v3/src/router.ts` —— 现有路由表（`:slug` 在 catch-all 之前；两段路由现状）
3. `frontend-v3/src/views/EntryDetailView.vue` —— zen 装配点（`useZenMode()` 调用、`provide(ZenModeKey)`、**第 255-265 行 scoped 样式含第 7 项 zen 隐藏**）
4. `frontend-v3/src/composables/useZenMode.ts` —— zen 状态与键盘处理（36 行，全文很短，务必读全）
5. `frontend-v3/src/utils/zen-shortcut.ts` —— `shouldHandleZenShortcut` / `redirectFocusIfHidden`
6. `frontend-v3/src/styles/layout.css` 第 640-670 行 —— zen 隐藏集前 6 项
7. `frontend-v3/src/components/EntryDetailContent.vue` 第 20-30 行 —— `.meta-tags-bar` 的渲染条件（`v-if="isMobile"`）
8. `backend/peekview/main.py` 第 25 行（`FRONTEND_ROUTES`）、第 52-62 行（`_is_frontend_route`）、第 590-635 行（SPA catch-all）
9. `frontend-v3/e2e/` 目录下任一 spec + `frontend-v3/playwright.config.ts` —— E2E 编写规范与 project 列表（TPV0096 引入自建 fixture + `e2e-` 前缀 + afterEach 清理 + BASE_URL 防生产护栏）

## 已锁定约束（P0 决策，不得重开、不得重新讨论）

以下三条已由用户裁决锁定，P1 只需把它们转成验收条件，**不要质疑、不要提替代方案**：

1. **URL 格式 = 路径后缀 `/{slug}/f`**（已否决 `?f` query 形态）
2. **完全锁死**：f 与 Escape 均无效，**无页内出口**（用户明示接受"键盘用户需手动改 URL"的代价）
3. **元信息条一并隐藏**（"只剩纯内容"外观）

## 主 Agent 已实核的客观事实（直接采信，不必重查；若发现与代码矛盾请报告）

**A. [关键更正] 「元信息条一并隐藏」在现有 zen 下已天然满足 → 本任务零 CSS 改动。**

```
# DOM 实测（CDP 移动端 390×844，debug :8888 v0.24.1，seed 数据）
BEFORE (无 zen): {"exists":true,"display":"flex","visible":true,"h":89}
AFTER  (按 f):   {"zenClass":true,"barDisplay":"none","barVisible":false,"barH":0}
```
- `.entry-detail.zen-mode :deep(.meta-tags-bar) { display: none; }` 已存在于 `EntryDetailView.vue:260`
- 引入 commit = `59ab6f7e wf(T082-P4)`（**2026-07-30**，早于本任务立项 09-16）
- `.meta-tags-bar` 仅移动端渲染（`EntryDetailContent.vue:24` 的 `v-if="isMobile"`）
- vision 独立复核（vision-engine `quick`，`mobile-zen.png`）：确认 zen 态"页面最顶部没有显示标题/作者/时间的窄横条"——与 DOM 实测一致

**因此**：不存在"一套还是两套 zen 外观"的取舍，**P0-brief 原写的"P1 与用户确认 zen 外观统一"确认项已自然消解，不要作为 NEED_CONFIRM 提出**。取而代之需要的是：**回归确认既有 zen 外观不被本次改动破坏**。

**B. zen 隐藏集分布在两个文件**（P2/P4 的遗漏面，P1 的"同类扫描"节请登记）：
- `layout.css:649-654` —— `.detail-header` / `.file-sidebar` / `.toc-sidebar` / `.mobile-actions` / `.mobile-sticky-header` / `.mobile-bottom-bar`（**6 项，不含 meta-tags-bar**）
- `EntryDetailView.vue:260` —— `.meta-tags-bar`（**第 7 项**，在 scoped 样式里）
- 另 `EntryDetailHeader.vue:3,13` 与 `EntryDetailMobileBar.vue:2,97` 用 `v-show="!zenMode"` 各自兜底（**第三处机制**）

**C. 当前 `/{slug}/f` 的实际行为**：返回 **HTTP 200 + NotFoundView**（"Page not found"），即 SPA catch-all 放行了该路径但路由未注册 → **"错误链接静默 200"**。这是一个须转成回归 BDD 的边界。
```
GET /yaml-docker-compose/f → 200, hasNotFound=true, zenClass=null
```
原因：`serve_spa_catchall`（main.py:599）对未知两段路径返回 index.html；`/{slug}/f` 不匹配任何已注册路由 → 落到 `/:pathMatch(.*)*` → NotFoundView。

**D. 后端**：`/{slug}/f` 不在 `FRONTEND_ROUTES`（main.py:25，仅 `""`/`explore`/`settings/apikeys`/`login`），`_is_frontend_route` 对非 `users/` 前缀返回 False。故 **JSON-accept 客户端**访问会走 `resolve_entry_raw(request, "slug/f")` → 404。Agent 读路径本就走 `/{slug}/raw`，**是否处理此边缘是 P2 决策**，P1 只需在"待确认/风险"里登记，不要在此定方案。
**E. 两段路径冲突现状**：现存两段路由仅 `/settings/apikeys`（静态）与 `/users/:username`（前缀 `users/`）→ 与 `/:slug/f` **无冲突**。
**F. share 正交性**：`/{slug}/f?share=token` 天然可组合（`?share=` 是 query 传参，与 path mode 正交）。

**G. 环境与隔离（P0-brief 末节已详载）**：debug :8888 = v0.24.1，seed 19 entries；seed 用户 alice/bob/carol（密码 testpass123，dave 已禁用）；**严禁触碰生产 :8080 与 `~/.peekview/`**；临时产物落 `{project_root}/.agate-tmp/`（`/tmp` 在 DSH 沙箱下只读且跨调用不共享）。

## 需求层面的实质要求

1. **BDD 逐条对应 P0-brief「验收基线」的 8 条倾向**，可拆可并，但须覆盖：
   - 全屏视图形态（header/侧栏/移动端 chrome/**元信息条**均不可见 + 主体内容正常渲染）
   - **锁死**（f 与 Escape 均不改变视图；且**不得有页内出口**——含 `zenAriaText` 不得宣告 "Press f or Escape to exit"，此点 P0-brief「实现要点」已指出，请 BDD 化）
   - **mode 保态**（多文件 entry 内切文件不丢全屏）
   - markdown+TOC（无 toc 侧栏、锚点滚动正常）
   - 私有 entry + share token 组合
   - **回归**：`/{slug}`（无 f）现有行为不变；**既有 f 键 zen 外观不变**（对应更正 A）
   - 移动端（无 mobile-bar/sticky-header，内容区占满视口）
   - 图表类 entry（mermaid/svg）全屏下渲染与内置全屏按钮正常
   - **新增**：`/{slug}/f` 不再静默落 NotFoundView（对应事实 C）

2. **frontend 任务的强制声明**（`domains` 含 frontend 时 gate 硬校验，缺则 exit 1）：
   - `capability_requirements` 必须含视觉能力条目（`need` 含 `visual`/`vision`，status ∈ available/supplementable/GAP）。本项目实测：**available**——vision-engine skill 可实调（`quick` role 已验证成功）；注意 DSH 沙箱下需 `HOME` 重定向 + `PYTHONPATH`，见 P0-brief 末节
   - **至少一条 UX 类别 BDD**，类别写入 BDD 标题后缀（如 `#### BDD-3: 布局结构：...`）
   - 本任务形态 = **`layout`（布局型）**，建议 `ui_render_shape: layout` + `ui_ux_dimensions` 选布局结构/交互行为/视觉呈现（**若声明了 shape 而未声明 dims → gate exit 1**；维度须落在分类框架内，或作为扩展维度在 BDD 标题中出现）
   - UX BDD 判据须**可量化、可二值判定**，禁主观词（可读/美观/流畅/平滑/自然/灵敏）

3. **「同类扫描」（强制节）**：对本任务关键符号扫全仓并落盘结论——建议扫描目标：`zen-mode`、`meta-tags-bar`、`ZenModeKey`、`zenMode`、`shouldHandleZenShortcut`、`updateZenAria`、`zenAriaText`。逐条判定"本次处理 / 本次不处理 + 理由"。上面**事实 B（三处机制分布）**是扫描的起点，请把它做全并给出命中数 + 文件清单。结论写进 P1-requirements.md **正文**（即使结论是"已确认只此一处"也要显式写出）。

4. **人工体验路径验收**：本任务产出用户可见页面且内容受 seed 数据影响 → 须追加一条「Given seed 数据 → 页面有内容」型 BDD（不得只用 fixture/单测替代）。

5. **`[P0_STALE]` 处理**：P0-brief 已被主 Agent 标注并就地更正（前提 A）。你在 P1-requirements.md 中须**显式写出**一行引用该漂移点的 `[P0_STALE: ...]` + 已更新哪个字段，或写"已核对 P0-brief 时效性（主 Agent 已于 2026-09-28 实核更正，无新增漂移）"。**空白不算做过。**

## 产出与格式

- 产出：`agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md`
- 用 `agate-md-field-set` 写 frontmatter，不要手写。Header 值由主 Agent 给定：
  - `phase: P1`，`task_id: TPV0099`，`type: problems`，`parent: P0-brief.md`
  - `trace_id: TPV0099-P1-20260928`，`status: draft`，`created: 2026-09-28`，`agent: analyst`
  - 必填机器字段：`risk_level`（本项目定 **medium**——URL 是公开契约 + 移动端 zen 锁死态未验证过）、`phases`、`packages`、`domains`
  - `packages` 建议：`peekview-frontend`（主要）、`peekview-backend`（仅边缘，若 P2 决定处理）
  - 裁剪倾向（见 P0-brief）：P1/P2/P3/P4/P5/P6/P7/P8 **全走**，无裁剪
- 写完跑 `python3 /home/kity/.agate/v0.76.0/agate/scripts/check-frontmatter.py <你的产出路径>`，非 0 先修正再返回
- 分阶段落盘：每读完一个输入文件/完成一个关键步骤，立即追加写 `P1-progress.md`（bash 追加模式）；每条 bash 命令执行前也追加一行（要跑什么、预期多久）

## 命令超时（强制）

任何 bash 命令都设 `timeout 180s <cmd>`（或按预期耗时×1.5）。超时/非预期失败 → ① 停止，不换命令不深挖；② progress 写一行（卡在哪、跑了多久、什么输出）；③ 返回主 Agent 决定。

## 环境隔离（强制）

只用 debug `:8888`。**严禁**触碰生产 `:8080` 与 `~/.peekview/`。状态标记用二值格式：触发写 `[PROD_TOUCHED] {描述}`，未触发写 `[PROD_NOT_TOUCHED]`。

## 门槛（什么算完成）

- P1-requirements.md 存在且非空，含 ≥1 条 BDD（格式 `#### BDD-NN:`，连续不跳号）
- 含「同类扫描」结论（命中清单 + 逐条判定）
- 含 `[P0_STALE]` 或"已核对无漂移"的显式记录
- `domains`/`packages`/`risk_level`/`phases` 已声明；frontend 的视觉能力条目 + UX 类别 BDD + 形态/维度声明齐备
- 无未决 `[NEED_CONFIRM]`（无则写 `[NO_NEED_CONFIRM]`）
- `check-frontmatter.py` 退出码 0

## 返回给我（只两行）

1. 产出文件路径
2. 一句话摘要（≤30 字，含 BDD 条数 + 待确认项数）

**不要返回文件全文。**

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

## 客观查证信息（objective_info）

- 环境状态：debug backend `http://127.0.0.1:8888` 运行中，version 0.24.1；seed 19 entries
- 关键标识：
  - 路由注册点 `frontend-v3/src/router.ts`（`:slug` 在 catch-all 之前）
  - zen 装配点 `EntryDetailView.vue:155`（`useZenMode()`）、`:158`（`provide(ZenModeKey, zenMode)`）
  - zen 隐藏集前 6 项 `frontend-v3/src/styles/layout.css:649-654`
  - zen 隐藏集第 7 项 `frontend-v3/src/views/EntryDetailView.vue:260`
  - `.meta-tags-bar` 渲染条件 `EntryDetailContent.vue:24`（`v-if="isMobile"`）
  - 后端桥接：`main.py:25` `FRONTEND_ROUTES`；`main.py:52-62` `_is_frontend_route`；`main.py:599` `serve_spa_catchall`
  - 前端 URL 路径是 `/{slug}`，不是 `/entries/{slug}`
- 查证结果：
  - 移动端 DOM 实测（CDP 390×844）无 zen `display:flex`/h=89px → 按 f 后 `display:none`/h=0
  - vision 独立复核确认 zen 态无顶部元信息条
  - git 溯源：`59ab6f7e wf(T082-P4)`（2026-07-30）引入该隐藏规则
  - `GET /{slug}/f` 现状 → HTTP 200 且渲染 NotFoundView
- DSH 沙箱约束：`/tmp` 与 `~/.local/share` 只读且 `/tmp` 跨调用不共享；临时产物写 `{project_root}/.agate-tmp/`

> 本文件不含通过/失败预判。
