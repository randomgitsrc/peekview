---
phase: P0
task_id: T029
task_name: frontend-ux-improvements
type: feature
trace_id: T029-P0-20260629
created: 2026-06-29
status: draft
---

task: 前端体验改进 — 6 个改进项

1. HTML 多文件引用提示：sibling 注入限制下，多文件 HTML entry 的引用文件提示改进
2. C# 语法高亮修复：Shiki 语言别名问题导致 C# 文件无高亮
3. Entry description API 字段暴露：后端 list API 返回 description 字段，前端卡片可显示描述
4. 卡片 Tag 数量限制 + 折叠：限制显示 2-3 个 tag，超出折叠为 +N，控制卡片最高高度
5. 卡片/列表 meta 信息位置调整：meta（@user · 日期 · file数）放在 title 下方，tags 限数折叠，布局顺序 title → meta → tags → badge
6. 详情页 tags + 时间显示：详情页加 tags 显示（标题下方），时间用相对时间 + tooltip 显示完整日期，前端统一用 toLocaleDateString() 走浏览器时区

known_risks:
  - Shiki 语言别名修改可能影响其他语言的注册
  - sibling 注入限制是架构决策，提示改进不能突破安全边界
  - API 响应加字段是破坏性变更的边界情况（新增字段通常是兼容的，但需确认前端不依赖字段顺序）
  - Tag 折叠交互需要设计 +N 的 tooltip/popover 展开方式
  - 详情页 header 空间有限，加 tags 可能需要折叠区域

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 6 个改进项涉及后端 API + 前端渲染 + Shiki 配置 + 组件设计，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
