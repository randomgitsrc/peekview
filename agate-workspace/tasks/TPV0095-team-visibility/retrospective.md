---
task_id: TPV0095
mechanism_issues: ["subagent 单次派发任务过载导致 P4 三评审并行时全部半途结束（无产出即 idle），协议对并行 subagent 的任务粒度缺乏上限约束", "P4 实现评审发现真实 BLOCKER 后，评审→修复→复审循环的 agent 复用缺少明确指引（同 agent 多次 send_message 复用 vs 新派）", "agate BDD 只有正向路径、无「测试副作用/环境还原」gate——E2E 创建型 spec 无清理导致 debug DB 残留污染，产生用户可见的权限假象（DEBT0008）", "P1 排除 seed 数据改动时无「人工体验路径」替代验收——BDD 只验 P3 fixture，make debug-seed 后页面内容无任何 BDD 覆盖（DEBT0009）", "P2 评审是「方案正确性」gate 非「设计质量」gate——功能全对但视觉/交互不达标可通过全部 gate，UI 布局方案（行 vs 卡）不在设计评审必审项", "视觉协调类非功能需求无 BDD 表达机制（如 dropdown 宽度 ≥ trigger 这类契约），只能靠人眼或视觉规范 gate"]
execution_issues: ["P1/P2 阶段早期将完整 phase 卡片内容写入 dispatch-context 前未先注入 AGATE_CARD 占位符，导致 inject-card 失败重跑", "P6 E2E_b spec 的 fixture 缺陷（同 test 二次 login 无登出）在 P3 红灯期未被发现，P5 才暴露，应属 P3 自检范围"]
feedback_ready: false
---

# TPV0095 复盘 — team-visibility（团队可见性机制）

## 一、事实基线

> 本节含两部分：A. 任务执行期（P0-P8）基线；B. 交付后暴露层基线（本会话补写）。

### A. 任务执行期

- 任务规模：44 BDD（backend 30 + CLI 4 + MCP 3 + 前端 UI 7），schema 变更 + 三端（backend/frontend/mcp）+ CLI + 权限收敛
- 交付：peekview v0.22.0 + mcp-server v0.12.0（minor × 2，含 schema 迁移）
- 流程 commit 18 个（立项 5525c319 → READY fabc1793）
- 评审轮次：P2 双评审（首轮 needs-revision → 复审 approved）、P4 三评审（eng：rejected → needs-revision → approved 共 3 轮；design：needs-revision ×2 → approved 共 3 轮；cso 1 轮 approved）
- 真实缺陷捕获：P4 review-eng 抓 2 个 CRITICAL BLOCKER（share cookie 越权读 + owner 读权不一致，均实测复现）；P4 design-review 抓 F1-F3 前端问题；P6 抓 1 个 E2E fixture 缺陷
- 预存失败登记：known-failures ×3（沙箱只读 EROFS ×2 + backup flaky ×1）
- 维护性反模式：known-violations ×2（models.py god-file 997→1153 行 + 1 处测试 any）
- 触发的机制标记：SCOPE+ ×3（P2 报告，主 Agent 裁定采纳 2/不采纳 1 记 backlog）、DESIGN_GAP ×8（backend 3 + frontend 5，P7 全 REVIEWED）、BASELINE_CHANGE ×2（BDD-44 增补 + BDD-31~33 --user 锚）

### B. 交付后暴露层（用户使用/审视后报告）

- 暴露问题 4 类：① E2E 残留团队污染（bob 权限假象）② seed 无 team → Teams tab 空 ③ Teams 页 N 卡片布局无设计感 ④ admin 徽标使 user-menu-wrapper 宽于 dropdown
- 修复轮：d24a0ae9（UserMenu 宽度契约）+ 32e952da（Teams 方案 A 行列表 + E2E fixture 清理 + seed 幂等成员）+ b649071b（首页内容核查 + 团队区块）——均在交付后由用户报出，非 TPV0095 gate 捕获
- 全部 4 类问题**非执行失误**：44 BDD 全 PASS 时每项根因都不在 BDD 可表达域内（详见第三节归因）

## 二、做得好的 + 可复用模式

- **P4 实现评审的实测复现价值**：review-eng 用隔离 tmp DB 实测复现 BLOCKER（非"看代码推断"），抓到 cookie 越权读 + owner 读权不一致两个真实 CRITICAL——证明 P4 独立实现评审（非只看自述）在高风险权限任务上是必要的
  → 去向：项目资产沉淀（本任务 P4-review-eng.md 的实测模式可作后续权限类任务评审模板）
- **方案 A 裁定的 owner 语义传播检查**：BLOCKER-2 裁定"owner=团队读权成员"后，复审用 10 表面矩阵（get/All/team=me/team=slug/raw/?share=/cookie/download/files-content//stars/Starred tab）逐面验证语义传播完整，抓到 R1/R2 两处残留
  → 去向：可复用模式——"语义裁定后的全表面传播检查清单"，值得固化
- **主 Agent 在 P8 前的复盘检测**：`check-retrospective.py` 在 commit 时提醒 SCOPE+ 触发需复盘，协议自动兜底防遗漏
  → 去向：机制本身（无需沉淀）

## 三、发现的问题

- 问题：P4 C8 三评审（review-eng/design-review/cso）**并行派发后全部半途结束无产出**（cso 只读一半，其余未写 progress），白白消耗上下文与时间；改为 send_message 复用原 agent 逐个串行执行后才正常产出。
  归因层面: 机制缺口
  说明：协议 P4 卡片说"多个评审角色并行派发"，但未约束单 subagent 的任务粒度上限——大任务（44 BDD 全链）的每个评审都要读巨量 diff + 实测复现，超单 agent 承载；DSH 平台无超时保护会静默 idle。用户已指出"分派 subagent 不宜任务过多，一次撑死"。改进落点：DSH 派发时对评审类大任务拆小（每 agent 只审一个域/一批文件）或串行。

- 问题：P3 E2E spec 的 fixture 缺陷（teams-page.spec.ts 同 test 内 bob→alice 二次 login 无登出）在 P3 红灯期被"模块未实现"的失败掩盖，P5 实跑才暴露（2 failed），需 P5 后回修 spec。
  归因层面: 执行错误
  说明：P3 自检要求"红灯失败原因必须是被测模块未实现"——但 E2E spec 在 P3 期未实跑（页面未实现），fixture 逻辑缺陷（如二次 login）只有实跑才暴露。改进：E2E spec 的 fixture 层（login/登出/数据准备）在 P3 期就应可用独立于页面实现的机制自检（如单测 fixture helper）。

- 问题：P2-design 报告 SCOPE+（detail 标签三态 + raw team 字段）时，P1 基线增补走 BASELINE_CHANGE 流程（主 Agent 批准 + 标注），但 BDD 重排（35→44）导致后续阶段引用编号需全文同步，P3/P4/P6 引用旧编号易错位。
  归因层面: 执行错误
  说明：P1 rev1 重排编号时已全文同步，但 P2/P3 各自引用时仍出现对旧编号的引用（如 P2 引用 BDD-37 实为修订后不同条）——教训：BDD 重排后各阶段引用应 grep 旧编号残留确认清零。

### 交付后暴露层（本会话补写）

- 问题：E2E 创建型 spec（teams-page.spec.ts）**无 fixture 清理**，连续跑 E2E 在 debug DB 残留 18 个团队（Alpha-*/Del-*/T-*），bob 因残留成为自有团队 owner，用户实测「bob 能添加 dave」与 owner-only 权限模型矛盾——后端实测验证权限逻辑正确（404），污染来自测试自身。
  归因层面: 机制缺口
  说明：agate BDD 只有正向路径（创建→断言），"测试副作用 / 环境还原"不在任何 gate 覆盖内。P6 验收验的是"功能对不对"，不是"测试脏不脏"——44 BDD 全 PASS 时环境尚干净，残留是验收之后累积的，属于验收盲区而非执行漏检。已登记 DEBT0008。

- 问题：P1 显式排除「seed 带 team」（P1-requirements.md:94，理由合规：样例 seed 非生产路径），但 44 条 BDD 全用 P3 自建 fixture 验收后，**无一条验证"make debug-seed 后 explore Teams tab 应有内容"**——用户按文档 seed 后打开 Teams tab 是 No entries found。
  归因层面: 机制缺口
  说明："验收数据（P3 fixture）"与"用户体验数据（debug-seed）"被当作两个世界，BDD 只验收前者；凡"seed 后页面应有内容"的人工体验路径无 BDD 表达。已登记 DEBT0009。

- 问题：Teams 管理页初始实现为「N 个团队 = N 张完整管理卡片垂直堆叠」，占屏、扫视困难、无设计感（用户："完全没有设计感"）；后重构为「行列表 + 展开管理面板」（方案 A）。
  归因层面: 机制缺口
  说明：P2 设计文档全为实现层选型（组件落点/函数级），"行 vs 卡"这类布局决策不在设计评审输入内；plan-design-review 是「方案正确性」gate——N 卡片满足全部 44 BDD（新建显示 ✓ 删除确认 ✓ 成员错误 ✓）所以 PASS 是正确的。设计质量在流程里没有锚点（P2 输入是 design-note + BDD 功能语义，无 DESIGN.md 视觉对照清单）。

- 问题：admin 徽标使 `.user-menu-wrapper` 宽于 `.user-dropdown`（dropdown 固定 `min-width: 120px` vs trigger 内容随徽标撑到 ~190px），右缘错位不协调。
  归因层面: 机制缺口
  说明：1px~几十 px 级的"视觉协调"无 BDD 表达机制（"dropdown ≥ trigger 宽度"这类契约断言属事后创新，非协议默认能力）；P2 评审不会看这种细节。此问题暴露了 BDD 对非功能性视觉需求的表达边界，属认知盲区而非纪律问题。

## 四、改进措施

- 派发纪律（DSH/agate 通用）：评审类 subagent 任务粒度 = 一域一 agent（backend/frontend/security 各一），且一次只并行 ≤2 个大任务；大任务失败先看 progress 判断半途点，用 send_message 复用原 agent 续跑（保留已读上下文）而非重新派发
  → 落点：项目 AGENTS.md 派发约定 + 本复盘（用户已提示）
- E2E spec 编写规范：P3 写 E2E 时 fixture 层（多账号切换/登出）用独立 helper + 单元测试锁定；spec 内避免同 test 跨账号二次 login 未登出
  → 落点：project.md / P3 dispatch-context 模板加"E2E fixture 自检"要求
- BDD 编号变更协议：任何 BDD 增删/重排后，主 Agent 跑 grep 确认 P1-P6 产出无旧编号引用残留（`grep -rn "BDD-3[5-9]\|BDD-4[0-4]"` 对照）
  → 落点：主 Agent orchestrator 流程自检项
- E2E fixture 清理制度化：创建型 spec 强制 afterEach 清理队列（创建即注册、无条件删除、接受 200/204/404）；已在 teams-page.spec.ts 落地——后续同类 spec 模板沿用
  → 落点：DEBT0008 + P3 dispatch-context 模板
- P1 模板加「人工体验验收」节：凡改动涉及用户可见页面且 seed 影响其内容，强制补"Given seed 数据 When 打开 X 页 Then 有内容"BDD；debug-seed 已配套 team + team entry（32e952da）
  → 落点：DEBT0009 + P1 dispatch-context 模板
- frontend 域 P2 设计评审补「视觉/布局对照」必审项：评审输入须含"对照 DESIGN.md 哪些条"声明，UI 布局方案（行 vs 卡、间距、层级）成为必审项，对主观质量设"至少 2 方案权衡"要求（复用 P2 候选方案机制）
  → 落点：P2 设计评审 dispatch-context 模板
- 视觉契约 BDD 化：把可量化的协调性（如 dropdown ≥ trigger）写成契约断言入 E2E（已在 teams-page.spec.ts:96-102 落地），作为视觉质量的可表达子集
  → 落点：project.md E2E 规范 + 本复盘

## 技术债登记核对清单

| 机制 | 应该触发？ | 实际触发？ | 未触发后果 | 原因 |
|------|-----------|-----------|-----------|------|
| retry 记录 | 是（P2 双评审/P4 三评审多轮） | ✅ | — | |
| PAUSED | 否 | — | | |
| PROD_TOUCHED | 否 | ✅（全程 [PROD_NOT_TOUCHED]） | | |
| SCOPE+ | 是（P2 发现 3 处） | ✅（P2-design 标 + 主 Agent 裁定） | | |
| SCOPE_RESOLVED | 是（3 项裁定后） | ✅（P1 回写 3 条） | | |
| DESIGN_GAP | 是（P4 实现 8 处自主决策） | ✅（backend 3 + frontend 5） | | |
| DESIGN_GAP_REVIEWED | 是 | ✅（P7 8/8 配对） | | |
| NEED_CONFIRM | 否 | — | | |
| CAPABILITY_GAP | 否 | — | | |
| gate 验证（每阶段） | 是 | ✅（P0-P8 全跑） | | |
| 阶段产出文件（每阶段） | 是 | ✅ | | |
| .state.yaml phase 同步 | 是 | ✅ | | |
| 裁剪条件 + override | 否（全走无裁剪） | — | | |
| capability_requirements | 是 | ✅（browser-vision 等 4 项 available） | | |
| 分阶段落盘（防 subagent 空返回） | 是 | ✅（多数批落盘，P4 评审首轮半途即因无产出暴露） | | |
| phase-产出一致性 | 是 | ✅ | | |
| P6 evidence（含截图 + 引用 + vision YAML） | 是 | ✅（44 BDD 全证据 + 24 截图 + vision 7 份 blocker 0） | | |
| P2 候选方案 + 权衡（≥2） | 是 | ✅（候选 A/B） | | |
| P8 internal_only_reason | 否（未裁 P8） | — | | |
| dispatch-context.md | 是 | ✅（每阶段每个 subagent 都有） | | |
| pre-commit hook（gate / 状态转移 / 裁剪） | 是 | ✅ | | |
| CI backstop | —（未 push，本地全链） | — | | |
| **技术债登记** | 是 | ✅ known-failures ×3（debt/ 未建独立 DEBT——均为已登记 known-failures）+ DEBT0006 关联核对（backup merge 不拷 teams 记 backlog #48 附注）+ **DEBT0008（E2E 无环境还原 gate）/ DEBT0009（seed 人工体验无替代验收）——交付后暴露层补登记** | | |
| P6 测试副作用检查（E2E 后环境残留） | 是（TEAM spec 创建型 E2E 累积污染 debug DB） | ❌（无此机制；已在 DEBT0008 + afterEach 清理补） | 18 个残留团队污染 DB，bob 权限假象 | 机制缺口 |
| 人工体验路径验收（seed 后页面内容） | 是（/teams 新页 + explore Teams tab） | ❌（P1 排除 seed 改动时无替代 BDD 补入，DEBT0009） | seed 后 Teams tab 空，用户按文档体验错误 | 机制缺口 |

## agate 反馈

（feedback_ready: false——待主 Agent 确认复盘内容后置 true 供提取）

以下 4 条归因到 agate 机制层面的条目，值得反馈给 agate 项目组（撰写时已去除项目特定信息，仅保留可泛化的机制描述）：

1. **BDD 只有正向路径，无「测试副作用 / 环境还原」gate**：创建型 E2E（建团队/建条目）跑完不清理，多次运行累积污染共享测试环境，污染后的行为与权限模型矛盾（用户视角像功能 bug），而 P6 验收全 PASS 时环境尚干净——"测试是否弄脏环境"不在任何 gate 覆盖内。建议：协议在 P6/CI 增加 post-test 环境残留检查（快照比对）或要求创建型 spec 自带 fixture 清理钩子。
2. **P1 排除数据/seed 改动时无「人工体验路径」替代验收**：排除项理由合规（样例数据非生产路径），但 BDD 全部改用 fixture 验收后，"用户按文档跑 seed 后页面应有内容"成了隐性的、无人验证的路径。建议：P1 模板加"人工体验验收"节，凡涉及用户可见页面且数据源影响其内容，强制补一条"Given seed 数据 → 页面有内容"的 BDD。
3. **P2 评审是「方案正确性」gate，非「设计质量」gate**：满足全部 BDD 的布局/交互方案可通过全部评审（N 卡片堆叠 vs 行列表展开都能 PASS），主观视觉质量在评审输入中无锚点。建议：frontend 域设计评审强制"对照设计规范哪些条"声明，UI 布局方案（行 vs 卡等）设至少 2 方案权衡要求（复用 P2 候选方案机制）。
4. **视觉协调类非功能需求无 BDD 表达机制**：如"下拉面板宽度 ≥ 触发器宽度"这类契约，传统 BDD 写不出也验不了，只能事后人眼发现。建议：协议收录"视觉契约断言"作为可表达子集（把可量化协调性写成 E2E DOM 度量断言），并在 P2/P6 指南中提及。
