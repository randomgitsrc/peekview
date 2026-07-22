---
phase: P0
task_id: T066
task_name: explore-card-display-config
type: feature
trace_id: T066-P0-20260722
created: 2026-07-22
status: draft
parent: 冷打开体验审计（docs/reviews/T031-cold-open-audit-2026-07-22.md）+ 用户实测
---

task: Explore 卡片显示要素站点级配置——照抄 PeekDiagram 模式加 PeekUI 配置节，summary 等元素可配置显隐

背景：
审计发现 Explore 卡片只有标题 + meta（@user · 1d ago · 1 file），看不到 entry 讲什么，冷用户无法判断值不值得点。用户要求把 summary 及其他显示要素做成配置开关。

关键设计决策（2026-07-22 与用户讨论后确定）：
配置存【站点级】，不是个人偏好（localStorage）。理由：
- 个人偏好需要设置界面，但当前完全没有用户设置 UI（用户连改密码都不能）——凭空造设置面板是好几天的活
- 站点级配置的地基全是现成的：config.py 的 PeekDiagram 就是完美模板（配置节 + env_prefix），config_router.py 已把配置免认证暴露给前端（/api/v1/config/diagram），CLI 也有 config 命令
- 产品形态上更对：PeekView 是自部署、站长主导，87% 是匿名访客（无账号谈不上个人偏好），真正在乎"内容怎么呈现"的是站长

实现路径（照抄 PeekDiagram）：
1. config.py 加 PeekUI 配置节（env_prefix="PEEKVIEW_UI__"），字段如 card_show_summary / card_show_tags / card_show_reads / card_show_files / card_show_author / card_show_time，默认值需界定
2. config_router.py 加 GET /api/v1/config/ui 端点（免认证，照抄 /config/diagram 的 PublicDiagramConfig 模式）
3. 前端 bootstrap 拉 /config/ui（与现有拉 captcha/limits/diagram 一致），card 组件按配置条件渲染各元素
4. 三种配置方式免费获得：env var（PEEKVIEW_UI__CARD_SHOW_SUMMARY=false）、~/.peekview/config.yaml、CLI

known_risks:
  - follows_existing_pattern（PeekDiagram 完全同构）——P2 可走简化（1 个候选方案），但配置项范围必须在 P1/P2 界定清楚，避免过度设计（哪些元素可配置、默认值、是否分组）
  - 前端需处理 /config/ui 拉取失败的 fallback（用默认值，不能白屏）
  - summary 显示涉及卡片高度变化——需考虑列表整齐度（截断行数固定），与 T031 的卡片结构改动有重叠
  - 依赖 T031：T031 改卡片外层（<a> 链接化）和 meta 分隔符，T066 改内层元素显隐——T031 先做，T066 在其基础上做，避免冲突

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123)
  ui_affected: true（Explore 卡片渲染，P6 需 Playwright 验证不同配置组合下的显示）
  config_pattern_ref: backend/peekview/config.py:PeekDiagram + backend/peekview/api/config_router.py:get_diagram_config
  backend_test: make test-quick；frontend_test: make test-frontend；typecheck: make typecheck

pruning_tendency: 激进 — 完全照抄现有 PeekDiagram 模式（design follows_existing_pattern），P2 简化为 1 候选方案；但 UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
