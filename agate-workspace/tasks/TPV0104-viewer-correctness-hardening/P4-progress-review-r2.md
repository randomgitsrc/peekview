---
phase: P4
task_id: TPV0104
type: progress
trace_id: TPV0104-P4-20261125
prod_touched: false
---
2026-11-25T08:57:25+08:00 review: 第 2 轮复审开工 — 读 dispatch-context-r2（含偏离表格）+ 第 1 轮 P4-review.md(300 行) + git diff（3 后端文件）
2026-11-25T08:57:25+08:00 review: C1 实测 PASS — 我自建素材 中×670k/😀×520k/中×666666 各 5 份：inlined=4、reasons={'total_budget':1}、响应 7.67/7.94/7.63 MiB ≤ 8MiB×1.35、势不变式成立（修复前 12×2MB 中文全放行 23.0 MiB / 2.88×）
2026-11-25T08:57:25+08:00 review: C2 实测 PASS — 4 种形态（U+0130 / 全大写标签 / </body > 带空白 / İ 多份）报表块均在末个 </body> 之前、正文无 '<'+'/body>' 残片、可解析
2026-11-25T08:57:25+08:00 review: C3 实测 PASS — README.md+大文件+41 CSS+不存在 id 一次请求：requested=44 inlined=38 skipped=6，reasons={count_limit:4, file_too_large:1, not_injectable:1}，缺 file_id=0、schema 字段集精确、势成立、file_id 唯一
2026-11-25T08:57:25+08:00 review: M2 实测 PASS — 我自建双向素材：text 'styles/a.css' + binary 'a.css' 同名，文本真注入=True/二进制 True=False，报表宣称 inlined={11} 且 22 落 not_injectable；反向（img 引 binary、text 未引）skipped==[44] 亦对
2026-11-25T08:57:25+08:00 review: REG 实测 PASS — 无 ?inject（rep 0/0、CSP 含 https:+frame-ancestors）'self'/无 </body> 片段（200，rep 1/1）/GET 升序 aaa|mmm|zzz 且 POST 保构造序 zzz|aaa|mmm（BDD-13 未被顺手排序）
2026-11-25T09:00:20+08:00 review: M1 实测 PASS（方案 C）— 精确边界：len=4091→200、len=4097→422（max_length=4096 生效）；残留放大已量化：宽1位id 1041个→22.6×、宽7位 512个→11.7×，势不变式在所有形态成立；合法满配 49 id 仅 350 字符，远低于 4096
2026-11-25T09:00:20+08:00 review: 偏离#1 复核 PASS — C2 改用 re.finditer 取 matches[-1]：我 4 形态实测（U+0130/全大写/</body >/多İ）报表均在末个 </body> 前且正文无残片；实现者偏离正确（原创 rfind 语义=最后，我上轮建议的 search 取首个会静默改行为）
2026-11-25T09:00:20+08:00 review: 偏离#2 复核 PASS — M1 选 C：我实测 B 的两种落法确实撞势不变式（K=100 vs 500）与 file_id 必填；C 保留契约且把无界压成有界（唯一代价：放大仍 11.7–22.6×，非 1×，属残留 MINOR）
2026-11-25T09:00:20+08:00 review: 偏离#3/§3-2 更正 — DUP 决定性验证：同 entry 两份 same.css（一 text 一 binary）DB 留 2 行但 file 5/file 6 的 /content 前 24B 完全相同、磁盘仅 1 个文件 → 根因确在存储层同名覆盖，inlined=2 与事实一致；我上轮 §3-2「谎报」分句应更正
2026-11-25T09:00:20+08:00 review: G12 两跳递归实测 PASS — a.css→b.css→c.css 三跳 @import 全在响应中、url() 二进制分支 data URI 在、仅 notes.md(id=16) 落 not_injectable；@import 环 ca↔cb 不挂死不误记
2026-11-25T09:00:20+08:00 review: REASONS 出口校验实测 PASS — 注入第七类 reason 抛 ValueError('unknown skip reason(s)')，闭集 6 元且为 frozenset
2026-11-25T09:00:20+08:00 review: 新增既有面（非 P4 引入）— ?inject= 传 20 位以上数字 token 时 int(token) 无位数上界 → SQLite OverflowError → 未捕获 500；已核 P3 基线 parse_inject_ids 同样无上界且当时无 max_length，故属既有面，降级为 MINOR 供 P7/P5 登记
2026-11-25T09:00:20+08:00 review: MINOR 4 条复核 — parse_inject_ids 已删（grep 零命中）、_BINARY_SIZE_LIMIT 单源（files.py:25 import）、REASONS frozenset+出口校验、useCsvParser commit 内重置保留且调用点冗余已删
2026-11-25T09:00:20+08:00 review: P3 测试零改动复验 — git diff de03b466 对 9 个 tpv0104 spec + test_entry_file_order.py 零输出；test_html_render.py 仅 _render_url 夹具 +1 处 isinstance 分支 + SIM300 等价改写
2026-11-25T09:02:25+08:00 review: 回归与门禁复跑 — pytest test_html_render.py+test_entry_file_order.py 全绿；-k 'bdd_38/39/40/41/bdd_13/g11/g12' 10 项全绿；ruff check backend/peekview exit 0；vue-tsc --noEmit exit 0；EntryDetailView 295 行 / entryDetail.ts 145 行（契约未放宽）
2026-11-25T09:02:25+08:00 review: 前端专项复核 — git diff de03b466 内 outline:none / #6366f1 / violet / 'Unlock the power' 零命中；TocNav 新增 3 条规则全用既有 token（--c-text/--space-3）
2026-11-25T09:02:25+08:00 review: 结论成型 — 3 CRITICAL 全部闭环（C1 字节口径/C2 finditer 取末个/C3 file_id 补齐）、2 MAJOR 闭环（M2 命名空间拆分实测对；M1 主 Agent 裁决方案 C 已实测生效）；无新 CRITICAL → status=approved；残留 3 MINOR 入正文
2026-11-25T09:07:01+08:00 review: 产出 P4-review.md（覆盖写，330 行，status=approved / agent=review）+ 自检：agate-md-field-set.py 写 status exit 0；check-frontmatter.py exit 0；行首 - PASS/-FAIL 零命中；实现代码与 P3 测试零改动
2026-11-25T09:07:01+08:00 review: check-gate.py P4 exit 1 但 stderr 无任何 'GATE P4' 消息 ⇒ 评审三门槛（存在/status=approved/agent≠main）全过，唯一未满足 = 暂存区无代码文件（主 Agent 的 git add 职责，非评审问题）
