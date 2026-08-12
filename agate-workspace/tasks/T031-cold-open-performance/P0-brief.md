---
phase: P0
task_id: T031
task_name: cold-open-performance
type: performance
trace_id: T031-P0-20260722
created: 2026-06-29
revised: 2026-07-22
status: draft
parent: 冷打开体验审计（docs/reviews/T031-cold-open-audit-2026-07-22.md）+ 用户实测
---

task: Explore 列表页性能与交互优化——并行加载、卡片改真链接、显示要素打磨

范围界定（2026-07-22 与用户讨论后确定）：
本任务聚焦 Explore 列表页的"更快 + 更顺"，不含新功能、不含详情页。

包含：
1. 点击卡片/列表项打开详情页慢——当前串行加载链 getEntry → selectFile → getFileContent，点了像没反应。改为并行请求 + 首屏即时反馈
2. card-title（乃至整张卡片）改真 <a> 链接——当前用 @click，浏览器不识别为链接，右键无"复制链接/新标签页打开"菜单。恢复原生链接语义
3. card-meta-text 的分隔符 `·`（U+00B7）渲染成难看的灰色方块加一点——字体 fallback 问题，改用可靠的分隔方式
4. 搜索框 placeholder 是中文"搜索标题、标签和文件内容"，其余 UI 全英文——统一为英文
5. 首页/导航 "Explore" 按钮文案模糊——改为更明确的措辞（如 Browse public）

明确不含（已拆到其他任务）：
- summary 预览 / 卡片显示要素配置 → T066（站点级配置）
- 标签过滤、排序 → defer 进 backlog（当前 27 篇内容用不上，等数据触发）
- 详情页孤岛（品牌/导航/Sign in）→ T067

known_risks:
  - <a href> vs @click 权衡：<a> 有原生右键菜单但需阻止默认跳转 + 处理 Vue 路由；改整卡为链接时注意嵌套交互元素（标签按钮等）的 a11y 与事件冒泡
  - 并行加载优先做纯前端并行（Promise.all），不改后端 API 契约——API 合并（entry+首文件一次返回）会影响 MCP 等消费方，本任务不动后端
  - 首屏反馈（骨架屏/spinner）需要设计，不是简单加个 loading；骨架屏布局应与真实卡片一致避免跳动
  - `·` 修复要兼顾亮/暗色主题下的视觉一致性

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)
  seed_data: make debug-seed (alice/bob/carol, password testpass123；含 12 条目覆盖各文件类型)
  ui_affected: true（Explore 列表页 + 卡片组件，P6 需 Playwright 实跑截图验证桌面+移动）
  frontend_test: make test-frontend (vitest)；typecheck: make typecheck

pruning_tendency: 保守 — 性能优化涉及加载链改造与 <a> 语义重构，方案不明确须走完整 P2；UI 改动 P6 不可裁

phase_hint: [P1, P2, P3, P4, P5, P6]
