---
phase: P0
task_id: T031
task_name: cold-open-performance
type: performance
trace_id: T031-P0-20260629
created: 2026-06-29
status: draft
---

task: 冷打开体验优化 — 2 个核心场景

场景 1：Explore 页面点击卡片/条目打开详情页不流畅
- 当前串行加载：getEntry → selectFile → getFileContent，两次 API 请求串行等待
- EntryCard/EntryListRow 用 @click 而非 <a href>，丢失浏览器原生右键菜单（新标签页打开、复制链接等）
- 可能的改进方向：并行请求、entry 数据预缓存、骨架屏、恢复 <a> 语义链接

场景 2：直接访问链接（冷打开）打开详情页慢
- 同上串行加载链
- 首屏无任何视觉反馈（白屏或 loading spinner 太晚出现）
- 可能的改进方向：SSR/预渲染、骨架屏、API 合并（entry + 首文件内容一次返回）、服务端 push

known_risks:
  - <a href> vs @click 权衡：<a> 有原生右键但需要阻止默认跳转 + 处理 Vue 路由，@click 无右键但逻辑简单
  - API 合并（entry + 首文件内容一次返回）会改变后端 API 契约，影响 MCP 等消费方
  - entry 预缓存策略需要评估内存开销和缓存失效时机
  - 骨架屏需要设计，不是简单加个 spinner

executor_env:
  platform: opencode
  has_task_tool: true
  has_local_runtime: true
  network: full

env_constraints:
  debug_env: make debug (127.0.0.1:8888, /tmp/peekview-debug/)

pruning_tendency: 保守 — 性能优化涉及前后端 + 缓存策略 + API 契约变更，方案不明确须走 P2

phase_hint: [P1, P2, P3, P4, P5, P6]
