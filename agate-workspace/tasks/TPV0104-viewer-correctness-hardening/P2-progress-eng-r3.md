
## plan-eng-review r3（最终复审）核查流水

- [05:14:15] 读完 dispatch-context-r3 + P2-review-eng(r2) + P2-design.md §D6/D7/§3/§4/§5.1/§7 V17-19/§11.8。起点：B4 唯一 BLOCKER，N5-N8 四项非阻塞。
- [05:14:15] **B4-①  语义**：D7(:409) 已写死「= 实际进入响应体的 sibling 个数」单一可 grep 定义句，并显式否决「预算层放行数」读法（理由：会让 BDD-40 ② 失效）。设计自身自洽 → 通过。
- [05:14:15] **B4-②  六元闭集**：D7(:413) 六项齐全（count_limit/file_too_large/binary_too_large/total_budget/not_found/not_injectable）；§3 #8(:631) 与 D10 BDD-40 行(:507) 的 REASONS 集合逐字一致（脚本比对 3 处 = 同一 6 元集合）→ 通过。

- [r3] **B4-③ `consumed: set[id]` + 七处埋点（核心）**：独立重写原型（`consumed:set[id]` + `owners` 全 map + `_process_css_refs` 关键字透传含 `@import` 递归），跑设计 V17 的 7 形态，**全部通过**且数字与设计逐项一致（S1 5/3/2、S2 6/2/4、S3 4/4/0、S4 2/1/1、S5 2/0/2、S6 不崩、S7 1/1/0）。→ 七处埋点覆盖完整，无遗漏。
- [r3] **B4-③ 补强（设计未覆盖的形态，我自己造）**：srcset / `<link rel=preload>` / `<link rel=manifest>` / `<a href>` / `<object data>` / `<video poster>` / `<embed src>` / 同名 basename 双文件 / CSS `url()` 内联二进制 / SVG 双通道 —— **全部满足 `requested - inlined == len(skipped)`**，且逐项核对「报告说 inlined ⇒ 内容真在响应里」「报告说 skipped ⇒ 内容真不在」**双向无一撒谎**（首轮两处报错经查是我 marker 选择失误：`@import` 整段被替换会吞掉写在里面的 marker，改用独立规则后消失）。
- [r3] **B4-③ 递归深度交互**：`@import` 链 n0..n5（递归上限 3）→ n0..n3 内容落地并计 inlined、n4/n5 如实计 `not_injectable`；循环 import / 自 import 均不撒谎。→ 递归分支透传成立。
- [r3] **B4-④ BDD-40 素材**：§3 完成标志 #8（:631）与 D10 BDD-40 行（:507）均含第三件素材「非 css/js sibling（README.md/data.json）→ 必须 `not_injectable`」。→ 已补。
- [r3] **B4 判定：已闭环**（①语义写死 ②六元闭集完整 ③七处埋点经独立原型 + 9 个自造形态验证无遗漏 ④素材已补）。修订者对 `used_text_keys` 的反驳成立（实测该集合仅 3 个写入点，不含 `@import`/`url()`/favicon）。

- [r3] **N5 已闭环**：`grep -c "test_entry_order\.py"` 仅 2 命中，且**两处都是 N5 自身叙述**（:761「全设计不再出现该名」+ :1030 变更记录），**无任何现存动作指令**指向旧名。§5.1 命令（:755）**无 `| tail`**，实测 `pytest … | tail -30` 确实把 exit 4 变 exit 0（假绿），裸跑得 exit 4 → 该修复成立。两步取证（:761-764）：先单跑 `test_html_render.py` 取红、再跑完整命令确认全绿 —— **解决了 collection error 掩盖问题**。
- [r3] **N7 已闭环**：`grep "\b119\b"` 仅 1 命中，且是 :1031 的**变更记录行**（叙述「三处 119 全部改为 73」）；正文 R13(:173)/§5.1(:765)/V12(:829) 三处均为 **73**。我独立复跑 `pytest tests/test_html_render.py tests/test_entry_service.py -v` → **73 passed in 1.98s**，与设计一致。
- [r3] **N8 已闭环**：frontmatter `dispatch_plan.batches[backend-render-budget].output` 已含 `backend/tests/test_entry_file_order.py`（5→6 项）；`tests_filter` 同步含该文件；§8 批表(:844)两列同步。脚本校验 24 个 output 条目**零重复**（4 批仍互斥）。
- [r3] **N6 已闭环**：`files_to_read`(:681) 路径为 `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts:45-70` 并注明「不是 components/」（实测该文件确实只在 composables 下）；三处 `:51` 均已改 `:51-57` 且注明断言在 `:55`（实测 :51 是 `it()`、:55 是 `totalRows === 0`）。

- [r3] **WARNING 六项（均不阻断，实测取证）**：
  - W1 D7 样例数字不自洽：`requested 45 / limit 40` ⇒ `count_limit` 应有 5 项（样例 1 项）、且 selected 40 中 4 项非 count 丢弃 ⇒ `inlined` 应为 36（样例 40）。势 45-40=5==5 恰好成立，但两分量机制上不可同时成立。
  - W2 `<a href="x.css">` 形态：`inlined=1 skipped=[]` 但输出中 `href` 仍悬空 → 既有行为，建议 §0.2 补边界声明。
  - W3 BDD-40 ③（无截断内容）在 D10 的 BDD-40 行无落点；`_CSS_RECURSION_LIMIT=3` 超限留字面 `@import`（实测 1 处）→ §0.2 已声明不动，建议写成判据边界。
  - W4 `skipped[].size` 无可靠来源：`SiblingFileData` 仅 6 字段无 `size`；文本 `len(content)` 是字符数、二进制 base64 需 ×3/4（实测 1000B→1336 字符）。R4 已声明不断言数值 → 建议注明「近似值」。
  - W5 `not_found` / `count_limit` 项无 filename/path 来源（`get_files_by_ids` 只回命中行；溢出 id 从未查询）→ 建议二选一（补查询 / schema 加 `file_id`）。
  - W6 「既有 5 处测试调用」实测为 **8 处**（375/383/400/408/416/426/433/438），且所引「:372-410」漏掉后 4 处。
- [r3] **G11/G12 两条新测试缺口建议**：G11 双向对账断言（势断言在「报表撒谎」时仍会绿——第 2 轮驳倒最小钩子的正是此形态）；G12 两跳 `@import` 用例（递归透传唯一可被单独证伪的形态，V17 的 S3 只测单层）。
- [r3] **N5 两步法可执行性补充实测**：`TypeError` 与 `AssertionError` 在 pytest **exit code 层面不可区分**（均 exit 1）→ 设计的「恰好是 assertion failure」判据必须读输出文本，`:763` 原文已要求，可执行。
- [r3] **产出**：`P2-review-eng.md` 已覆盖写入（body 先写、frontmatter status 后写），`agent=plan-eng-review`、`status=approved`；frontmatter-check exit 0。生产代码 `git status` 干净。
