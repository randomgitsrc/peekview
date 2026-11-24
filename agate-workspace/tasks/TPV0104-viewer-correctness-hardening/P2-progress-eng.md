# P2 评审进度（plan-eng-review）

- [R2] 实测 order_by 影响面：复制 backend 打补丁后跑全量 149+ 用例 → **零新增失败**；且 POST 响应序≠GET 响应序（app.js 变首项）但测试不读 GET 的 files[0] → R1 归因**不成立**（失败被掩盖在 POST 响应序上）
- [R3] 实测 baseline binary skip：900KB png (>768KB _BINARY_SIZE_LIMIT) 在 inject 路径被 _build_sibling_data 静默 return None，响应无任何跳过记录 → P2 的 skipped 记账入口漏了这条既有静默丢弃点
- [R4] 实测 inject_resources 直接调用点：backend/tests/test_html_render.py 有 13 处 `result = inject_resources(html, siblings)` 并直接对它做 `in` 断言；P2 §0.1A 要把返回改成 `(html, skipped)` 元组 → 这 13 处全部会变成对 tuple 做 `in`（TypeError/假绿），方案未登记此连带面，也未给兼容包装
- [R5] V13 复现确认：import 不存在模块 → vitest 输出 Failed Suites 1、`{"errors":1,"import_errors":[]}` → judge_result `errors>0` 判 A 类 → exit 1（gate FAIL）。方案 §7.1 V13 结论正确，主 Agent 转述亦正确
- [R6] 小而稳：主 Agent 转述"复合命令超时 fail-open"经核：check-tdd-red.py:102-104 exit 124 → return 0。architect 否决 P3 复合命令的理由成立
- [R7] gate_commands 21 key 全部经 agate_common.is_legal_gate_key 实测 True；dispatch_plan 4 批 output 互斥无跨批重复
- [R8] 已产出 P2-review-eng.md（status: rejected，阻塞 3 项：B1 order_by 归因错 / B2 inject_resources 连带面+二进制静默丢弃遗漏 / B3 清单 JSON 注入缺陷）。自检：frontmatter 经 agate-md-field-set.py 写入、无行首 PASS/FAIL、仓库源码零改动
