---
phase: P0
task_id: T067
task_name: detail-page-framework
type: feature
trace_id: T067-P0-20260722
created: 2026-07-22
revised: 2026-07-22
status: draft
parent: 冷打开体验审计（docs/reviews/T031-cold-open-audit-2026-07-22.md）+ 主 Agent 代码核查纠正
---

task: Entry 详情页框架补全——Sign in 入口 + 品牌字标 + explore 导航 + 移动端补全，解决冷打开转化断层

⚠️ 重要纠正（2026-07-22 主 Agent 代码核查，收窄原 brief 夸大的"孤岛"范围）：
- 桌面端**已有 logo**：EntryDetailView.vue:15-17 `<router-link to="/" class="detail-logo">`（PeekView SVG 图标，链回首页）——"无品牌"对桌面不成立
- 桌面端图标按钮**已有 tooltip**：EntryDetailView.vue:30/40/50 `<span class="tooltip">Toggle file tree / Table of Contents / Copy</span>`——"无 tooltip"对桌面不成立（但是否真在 hover 显示需 P1 实跑验证，截图看不出 hover 态）
- **移动端确实空**：EntryDetailView.vue:5-10 的 mobile-sticky-header 只有返回箭头 + 标题，无 logo、无品牌字、无 Sign in、无导航
- 因此本任务重点从"加 logo/tooltip"转为下面的真实缺口

真实缺口（收窄后）：
1. 【核心】详情页无 Sign in 入口——冷用户（87% 匿名）想登录无处可点。需加 Sign in，绑定 authState（登录后隐藏），依赖 T065 先修好 authState 响应式
2. 品牌识别弱——桌面只有 SVG 图标无"PeekView"文字字标；移动端连图标都没有。需补文字字标
3. 无 explore 导航——读完无法去浏览更多，转化断层
4. 移动端底栏 "Files 2" 文案改为 "2 files"（copy 修正）
5. reads 计数桌面/移动端统一（当前移动端显示、桌面端不显示——需 P1 实跑确认现状）
6. 首页 Sign in 视觉权重提升（当前纯文字混在 GitHub/PyPI 链接里）——与 T065 的 landing Sign in 改动划清边界

明确不含：
- 卡片显示要素配置 → T066
- Explore 性能/交互 → T031
- 登录跳转 bug → T065（本任务依赖它先修好 authState）
- 桌面端 logo / 图标 tooltip 重做（已存在；仅 P1 验证 tooltip hover 是否生效，坏了才修）

known_risks:
  - 品牌条形态需先想清楚（极窄条 vs 浮动徽章 vs footer），P2 须出多方案对比——用户明确"没想好，要仔细思考"，不可跳过设计
  - 占空间是核心顾虑：品牌条必须极窄（~36px，参照 GitHub Gist），不能挤压内容区；移动端尤其小心
  - Sign in 绑定 authState 依赖 T065——T065 未完成前本任务 Sign in 显隐无法验证，须串行
  - 图标 tooltip 桌面端已存在（代码层面）——P1 须实跑 hover 验证是否真显示，不要按"无 tooltip"假设重做；移动端无 hover 需等价方案（文字标签）
  - 首页 Sign in 权重提升与 T065 的 landing Sign in 绑定有重叠——T065 管"显隐绑定 authState"（功能），本任务管"视觉权重"（样式），改同一按钮需协调先后
  - UI 改动需 Playwright 截图验证桌面 + 移动两套视口，P6 不可裁

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123)
  ui_affected: true（详情页框架 + 首页，P6 需 Playwright 实跑截图验证桌面+移动）
  depends_on: T065（Sign in 绑定 authState 依赖 T065 修好 authState 响应式）
  env_check: P1 启动前须跑 docs/process/env-check-protocol.md（涉及移动端，步骤 4-5 必检）
  key_files: frontend-v3/src/views/EntryDetailView.vue（:5-10 移动端 header, :13-17 桌面 header+logo, :30/40/50 tooltip）, frontend-v3/src/views/LandingView.vue（首页 Sign in）
  frontend_test: make test-frontend；typecheck: make typecheck

pruning_tendency: 保守 — 涉及设计决策（品牌条形态），P2 须出多方案对比；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
