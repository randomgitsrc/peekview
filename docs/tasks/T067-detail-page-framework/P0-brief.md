---
phase: P0
task_id: T067
task_name: detail-page-framework
type: feature
trace_id: T067-P0-20260722
created: 2026-07-22
status: draft
parent: 冷打开体验审计（docs/reviews/T031-cold-open-audit-2026-07-22.md）
---

task: Entry 详情页框架——加极窄品牌条（logo 回首页 + Sign in 绑定 authState）+ 图标 tooltip + 显示要素统一，解决冷打开孤岛

背景：
审计核心发现：entry 详情页是"孤岛"。冷用户（87% 非自读）打开链接后——不知道这是什么网站（无品牌）、不知道怎么去其他页面（无导航）、不知道能登录（无 Sign in 入口）、不知道图标按钮干什么（无 tooltip）。读完就走，转化率为零。

设计决策（2026-07-22 与用户讨论后确定）：
- 加品牌/导航，但做成【极窄品牌条】（约 36px），不是一整个导航栏——用户顾虑占空间，参照 GitHub Gist（顶部极窄条）/ Notion 公开页（浮动徽章）
- 品牌条布局：左边 PeekView 字标（点击回首页），右边仅【未登录时】显示轻量 Sign in（登录后消失）
- Sign in 显隐必须绑定 authState——与 T065 协同：T065 先修好 authState 响应式，本任务复用

范围：
1. 详情页顶栏加极窄品牌条：PeekView logo（回首页）+ 条件 Sign in（绑定 authState，登录后隐藏）
2. 图标按钮加 tooltip（文件树 / TOC / 复制 / 更多）——恢复可发现性
3. reads 计数桌面/移动端统一（当前移动端显示、桌面端不显示）
4. 移动端底栏 "Files 2" 文案改为 "2 files"
5. 首页 Sign in 视觉权重提升（当前是纯文字，与 GitHub/PyPI 链接混在一起）

明确不含：
- 卡片显示要素配置 → T066
- Explore 性能/交互 → T031
- 登录跳转 bug → T065（本任务依赖它先修好 authState）

known_risks:
  - 品牌条设计需先想清楚（极窄条 vs 浮动徽章 vs 底部 footer），P2 须出多方案对比——用户明确"没想好，要仔细思考"，不可跳过设计
  - 占空间是核心顾虑：品牌条必须极窄（~36px），不能挤压内容区；移动端尤其要小心
  - Sign in 绑定 authState 依赖 T065——T065 未完成前本任务的 Sign in 显隐逻辑无法验证，须串行
  - 图标 tooltip 在移动端无 hover——需考虑移动端等价的可发现性方案（长按/文字标签）
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
  frontend_test: make test-frontend；typecheck: make typecheck

pruning_tendency: 保守 — 涉及设计决策（品牌条形态），P2 须出多方案对比；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
