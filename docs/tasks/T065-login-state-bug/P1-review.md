---
phase: P1
task_id: T065
type: review
parent: P1-requirements.md
trace_id: T065-P1-review-20260722
status: approved
created: 2026-07-22
agent: requirements-review
---

# T065 P1 需求基线评审（复审）

## 评审结论

**status: approved** -- 首轮 7 条修订清单全部到位，无新增 BLOCKER。BDD-1~BDD-6 条件均可二值判定，隐含需求 5 维度覆盖，裁剪与 risk_level 一致，P1 纯净性合格。

## 修订清单逐条核对

| # | 类型 | 修订项 | 判定 | 锚点 |
|---|------|--------|------|------|
| 1 | BLOCKER | P3 恢复 + 删除 risk=low 矛盾 | ✅ 到位 | L113 `phases: [P1, P2, P3, P4, P5, P6, P8]`；L114 `P3_skip: false`；L115 `P3_retained_reason` 引用 `risk_level=medium` + agate 规则 + TDD 覆盖 BDD-1/BDD-2,3/BDD-5 |
| 2 | 一致性 | BDD-1/2 冗余合并 | ✅ 到位 | 7 条->6 条。原 BDD-1（LoginDialog 登录后跳转）与 BDD-2（刷新已认证仍重定向）合并为新 BDD-1（全页加载 / -> /explore）。P6 现可单一实跑 |
| 3 | 正确性 | BDD-5 "用户标识或登出" 二义消除 | ✅ 到位 | 新 BDD-4 Then 改为单一确定性判定："导航区域渲染了包含用户名（userName）的认证态元素"。"或"已移除 |
| 4 | 正确性 | BDD-7 "不闪跳转/不白屏" 主观量化 | ✅ 到位 | 新 BDD-6 Then 改为可二值判定："landing 页 DOM 包含首屏内容（logo 元素），且当前 URL 为 /（未重定向到 /explore）"。两个条件均可观测 |
| 5 | 纯净性 | 隐含需求 L48 HOW->WHAT | ✅ 到位 | L49 改述为"全页加载时已认证用户必须被重定向到 /explore"，"为什么必须"列保留根因诊断（fetchMe 未完成时守卫见 loading）但结尾明确"无论用何种机制...最终须落到 /explore"。处方性"需等待 fetchMe"已删除 |
| 6 | 完整性 | token 过期显式排除 | ✅ 到位 | L52 显式声明 out-of-scope："token 过期触发 authState -> anonymous，属既有登出流程；landing 在匿名态的渲染由 BDD-2 覆盖，无需重复" |
| 7 | 裁剪 | P7 补 T067/EntryListView + P8 注理由 | ✅ 到位 | L117 P7_skip_reason 补"已确认与 EntryListView 认证 UI 模式一致，T067 边界在 P2 切分"；L118 `P8_retained_reason: "bugfix 需版本 bump + CHANGELOG 记录；P0 hint 未含 P8 但发布流程要求"` |

## BDD 评审

覆盖维度标注：数据 / 前端 / 多端 / 边界 / 兼容（✓=覆盖 ✗=遗漏 △=部分）

- **BDD-1**（已认证全页加载 / -> /explore）：Given token+authState 将变为 authenticated / When 全页加载 / / Then 最终 URL=/explore。可二值判定（查 URL）。合并后冗余消除。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-2**（匿名态 Sign in 可见）：Given anonymous / When 访问 / / Then Sign in 可见。可二值判定。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-3**（已认证态 Sign in 不可见）：Given authenticated / When 访问 /（无论是否被重定向）/ Then Sign in 不可见。可二值判定。"无论是否被重定向"覆盖了重定向前瞬态。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-4**（已认证可见用户标识）：Given authenticated 且在 / / When 渲染导航栏 / Then 导航区域渲染包含 userName 的认证态元素。单一确定性判定，二义消除。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-5**（匿名登录后跳转不回归）：Given anonymous 且在 / / When LoginDialog 登录成功 / Then 导航到 /explore。可二值判定。兼容维度关键。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓
- **BDD-6**（fetchMe 期间正常渲染）：Given loading / When 渲染 / Then DOM 含 logo 元素 + URL=/。量化为两个可观测条件，主观性消除。覆盖：数据✓ 前端✓ 多端✓ 边界✓ 兼容✓

BDD 编号唯一（BDD-1~BDD-6），与 P6 验收可对照。

## 隐含需求覆盖

| 维度 | 判定 | 说明 |
|------|------|------|
| 数据维度 | ✓ 覆盖 | L47 authState 状态机迁移时机可观测性，独立"数据"行 |
| 前端维度 | ✓ 覆盖 | L48 Sign in 替换为用户信息/登出；L49 全页加载重定向；L50 watch 处理挂载前已 authenticated |
| 多端维度 | ✓ 覆盖 | L54 显式声明"纯前端 bug，无 MCP/CLI/后端改动" |
| 边界维度 | ✓ 覆盖 | L51 loading 态正常渲染；L52 token 过期显式排除（带理由） |
| 兼容维度 | ✓ 覆盖 | L53 登录对话框登录跳转不回归 |

## 裁剪评审

### P3 保留 -- 合规

`P3_skip: false`，`P3_retained_reason` 引用 `risk_level=medium` + agate 规则（medium 必须走 TDD 红灯）+ TDD 覆盖三条路径（BDD-1 重定向 / BDD-2,3 Sign in 显隐 / BDD-5 不回归）。与 risk_level=medium（L131）一致。首轮 BLOCKER 已消除。

### P7 跳过 -- 可接受

`P7_skip: true`，理由"仅 2 个文件改动 + 已确认与 EntryListView 认证 UI 模式一致 + T067 边界在 P2 切分"。2 文件 P7 跳过合理，T067/EntryListView 一致性说明已补齐。

### P8 保留 -- 合理

`P8_retained_reason: "bugfix 需版本 bump + CHANGELOG 记录；P0 hint 未含 P8 但发布流程要求"`。偏离 P0 hint（P0 phase_hint 无 P8）但理由注明。合规。

### phases 与 P0 一致性

P0 `phase_hint: [P1, P2, P3, P4, P5, P6]`。P1 `phases: [P1, P2, P3, P4, P5, P6, P8]`。P3 已恢复（与 P0 一致），P8 附加有理由。无矛盾。

## P1 纯净性

合格。首轮 flagged 的 L48"beforeEach 守卫需等待 fetchMe 完成后再判定"（处方性 HOW）已改述为"无论用何种机制，全页加载的已认证用户最终须落到 /explore"（WHAT）。

L49/L50 保留的根因诊断（`app.use(router)` 触发初始路由解析时 fetchMe 未完成、watch 设置时 authState 已 authenticated）是对现状 bug 的诊断描述，非方案处方--替代方案（beforeEach 异步化 / watch immediate / onMounted 检查）均不与这些描述冲突。可接受。

## 非阻断性观察（供 P2 参考，不计入门槛）

1. **BDD-3 与 BDD-4 的测试时序**：BDD-1 要求已认证用户最终跳转 /explore，BDD-3/BDD-4 要求已认证态在 / 上的渲染行为。若 BDD-1 重定向极快，BDD-3/BDD-4 的窗口可能极短。P6 可通过 Playwright 拦截 router.replace 或在 loading 态断言 DOM 来验证。属 P6 测试机制问题，非 P1 需求缺陷。
2. **L50 提及 `watch(authState)`**：隐含需求"watch 需处理挂载前已 authenticated"命名了现有机制，略偏实现锚点。但不处方修复方式（未说"加 immediate"），且替代方案不与此描述冲突。可接受，P2 设计时可自由选择机制。

## 覆盖维度总览

| 维度 | 结论 |
|------|------|
| 完整性 | ✓ 5 维度全覆盖；token 过期显式排除；数据维度独立行 |
| 正确性 | ✓ BDD-1~6 均可二值判定；无冗余；无二义；根因诊断全部属实 |
| 一致性 | ✓ P3 裁剪与 risk_level 一致；phases 与 P0 hint 一致（P8 附加有理由）；无 T060 回归表述 |
| 裁剪合理性 | ✓ P3 保留（medium 规则）；P7 跳过（2 文件 + 一致性确认）；P8 保留（发布流程） |
