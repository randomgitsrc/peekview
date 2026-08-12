---
phase: P0
task_id: T066
task_name: explore-card-display-config
type: feature
trace_id: T066-P0-20260722
created: 2026-07-22
revised: 2026-07-22
status: deferred
parent: 冷打开体验审计（docs/reviews/T031-cold-open-audit-2026-07-22.md）+ 主 Agent 代码核查纠正
---

⏸️ DEFERRED（2026-07-22 主 Agent 审核后决定 defer 进 backlog）

理由：
1. 唯一有价值的点（summary/content 预览）被砍——entry.summary 已是标题字段（EntryCard.vue:29），无独立摘录字段，做内容预览需后端生成 excerpt = 新功能非纯配置
2. 剩余范围（开关现有 tags/author/time/files）方向反——立项要解决"冷用户看不到 entry 讲什么"，开关现有元素只能让站长**藏东西**，不增加信息，不解决原问题
3. reads 需后端改动（EntryListItem 无 read_count，models.py:488）——不是纯配置
4. 套用 T032 探针教训：不造没人要的旋钮

触发条件（重新启动时须满足之一）：
- 有站长明确要求"我想隐藏卡片上的 X 元素"
- 确认 reads 社会证明对冷用户转化有效（需数据）
- 确认需要内容预览且愿意投入后端 excerpt 生成

---

task: Explore 卡片显示要素站点级配置——照抄 PeekDiagram 模式加 PeekUI 配置节，卡片元素可配置显隐

⚠️ 重要纠正（2026-07-22 主 Agent 代码核查，厘清原 brief 的术语冲突与范围低估）：
- **entry.summary 就是标题字段**（models.py:85 "Human-readable description"），卡片标题用的就是它（EntryCard.vue:29 `{{ entry.summary || entry.slug }}`）。Entry **没有**独立的 description/excerpt 字段
- 因此"加 summary 预览"含义不明：若指内容摘录，那是**新后端字段**（需从文件内容生成 excerpt），不是纯配置——P1 必须先界定要不要做、做的话是后端活
- **reads 当前不在卡片上**，且 EntryListItem（models.py:488-503）**不含 read_count**——卡片显示 reads 需后端改动（list 查询加 read_count），不是纯配置
- 卡片上**现有可开关的元素**只有：tags（EntryCard.vue:44）、@username（:31-36）、relativeTime（:38）、fileCount（:39-42）——这些才是真正 follows_existing_pattern 的纯配置开关

背景：
审计发现 Explore 卡片只有标题 + meta（@user · 1d ago · 1 file），冷用户难判断值不值得点。用户要求把显示要素做成配置开关。

关键设计决策（2026-07-22 与用户讨论后确定）：
配置存【站点级】，不是个人偏好（localStorage）。理由：
- 个人偏好需要设置界面，但当前完全没有用户设置 UI（用户连改密码都不能）——凭空造设置面板是好几天的活
- 站点级配置的地基全是现成的：config.py 的 PeekDiagram 就是完美模板（配置节 + env_prefix），config_router.py 已把配置免认证暴露给前端（/api/v1/config/diagram），CLI 也有 config 命令
- 产品形态上更对：PeekView 是自部署、站长主导，87% 是匿名访客，真正在乎"内容怎么呈现"的是站长

实现路径（照抄 PeekDiagram，已核实存在）：
1. config.py 加 PeekUI 配置节（env_prefix="PEEKVIEW_UI__"，模板 config.py:346 PeekDiagram）
2. config_router.py 加 GET /api/v1/config/ui 端点（免认证，模板 config_router.py:67 get_diagram_config）
3. 前端 bootstrap 拉 /config/ui，card 组件按配置条件渲染各元素
4. 三种配置方式免费获得：env var（PEEKVIEW_UI__CARD_SHOW_TAGS=false）、~/.peekview/config.yaml、CLI

配置项范围（P1/P2 须界定，分两档）：
- 【纯配置·现有元素】card_show_tags / card_show_author / card_show_time / card_show_files——开关 EntryCard 已有元素，零后端改动
- 【需后端·范围扩张】card_show_reads（read_count 不在 EntryListItem，需后端加）/ "内容预览"（无 excerpt 字段，需后端生成）——P1 须决定本任务做不做，做则范围从"纯前端配置"扩到"后端+前端"，pruning 不再激进

known_risks:
  - "summary 预览"术语冲突：entry.summary 已是标题，P1 必须先厘清用户要的"预览"到底是什么（内容摘录？更长标题？），不可照 brief 字面假设有个 summary 元素可开关
  - reads / 内容预览若纳入，需后端改动（EntryListItem 加字段 / 生成 excerpt），范围超出"照抄 PeekDiagram 纯配置"——P2 须明确分档，避免范围蠕变
  - follows_existing_pattern 仅对【配置管道】成立（PeekDiagram 同构）；【配置项范围】是真实设计决策，P2 不能纯走简化
  - 前端需处理 /config/ui 拉取失败的 fallback（用默认值，不能白屏）
  - 显示元素增减涉及卡片高度变化——需考虑列表整齐度（截断行数固定），与 T031 的卡片结构改动有重叠
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
  config_pattern_ref: backend/peekview/config.py:346 PeekDiagram + backend/peekview/api/config_router.py:67 get_diagram_config
  key_files: frontend-v3/src/components/EntryCard.vue（现有元素 :29 标题/:31-42 meta/:44 tags）, backend/peekview/models.py:488 EntryListItem（无 read_count）
  backend_test: make test-quick；frontend_test: make test-frontend；typecheck: make typecheck
  env_check: P1 启动前须跑 docs/process/env-check-protocol.md（至少快速版 1-3）

pruning_tendency: 分档 — 配置管道 follows_existing_pattern（PeekDiagram 同构，P2 可简化）；但若纳入 reads/内容预览则含后端改动，P2 须出真实设计。UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
