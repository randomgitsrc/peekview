---
phase: P4
task_id: TPV0104
type: progress
trace_id: TPV0104-P4-20261125
prod_touched: false
---
2026-11-25T07:46:14+08:00 review: 已读 dispatch-context + review.md + git diff 全量（22 文件 + 5 新增）+ P4-implementation.md（5 DESIGN_GAP / 1 SCOPE+）
2026-11-25T07:46:14+08:00 review: Pass1 后端 — 手工复核 select_inject_ids 六类 reason 归类、_process_css_refs 递归透传、七处埋点、< 转义、CSP 一字未动
2026-11-25T07:46:14+08:00 review: P3 测试未篡改核验 — git diff de03b466 逐文件：9 个 tpv0104 spec + test_entry_file_order.py 全部 UNCHANGED；test_html_render.py 仅 2 处（_render_url 夹具 + 一处断言顺序等价改写）
2026-11-25T08:18:16+08:00 review: Pass1 实跑 3 条 CRITICAL — C1 总预算 len(str) 字符数记账→12×2MB 中文 CSS 全部放行，响应 23.8MiB/预算 8MiB=2.98×；C2 _append_inject_report 用 lower() 下标切原文→含 U+0130 时 </body> 被劈开；C3 not_injectable 缺 file_id→count_limit+not_injectable 共存时 BDD-38③ KeyError
2026-11-25T08:18:16+08:00 review: Pass2 发现 2 MAJOR — overflow 无界致报表 13× 放大、owners 单命名空间致 text/binary 同名互相覆盖(假报表)；4 MINOR（死代码/死常量/U+0130 外的 rfind/rfind 字面量/前端 parseFileId 边界）
2026-11-25T08:18:16+08:00 review: 前端专项全过 — 无 AI Slop、无新增 outline:none、hover/focus 齐备、交互态有守卫、R12 表头未塌陷、t082 行数契约未放宽(295/145)
2026-11-25T08:18:16+08:00 review: 5 条 DESIGN_GAP + 1 条 SCOPE+ 逐条独立核实→全部合理；P4-review.md 已产出 27KB，status=rejected，gate P4 exit 1（符合预期）
