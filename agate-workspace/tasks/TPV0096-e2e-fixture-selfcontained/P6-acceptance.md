---
phase: P6
task_id: TPV0096
type: acceptance
parent: P5-verification.md
trace_id: TPV0096-P6-20260907
status: draft
created: 2026-09-07
agent: verifier
pass: 13
fail: 0
ui_affected: false
---
# P6 验收报告 — TPV0096 E2E 红灯 spec 自建 entry 化

> 验收时点：2026-09-07 深夜～2026-09-08 凌晨（本地）；被验收代码 = 当前 HEAD `333f5209`（P4 commit `13594c9f` 之后无代码改动，P5→P6 间仅 agate-workspace 产出文件变更）。
> 执行环境：干净 debug 环境（`make debug-start` + `make debug-seed`，:8888，/tmp/peekview-debug/ 独立数据目录），每次验证链结束 `make debug-stop` 还原。**全程未触碰 :8080 生产服务与 ~/.peekview/**。
> 执行形态（dispatch-context 强制）：需服务的验证一律单调用自包含链（外层 timeout 900s，串行，`rc=$?; timeout 120s make debug-stop; exit $rc`）。实际链：链 1（run1 3 spec + 抽验 + 残留查询 + stop）、链 2（run2 3 spec + svg-inline-render；被执行器 600s 强制上限 SIGTERM 截断，已捕获段完整，其后所有步骤移入链 3 补做）、链 3（render-regression + absent-check + 认证抽验 + sqlite 真值 + 二次残留 + stop）。debug-stop 每链均执行且验证 /tmp/peekview-debug/ 已销毁。
> 环境失败记录（预算 2/2 轮内）：① 链 1 首跑对 run-e2e-tests.sh 传入位置参数且提前 cd frontend-v3 → runner 内部 cd 失败 exit 1（verifier 调用错误，修正为 repo 根 + E2E_SPEC 环境变量后重跑）；② 链 2 被执行器 600s cap 截断（run2 三 spec 与 svg-inline-render 段已完整捕获，剩余步骤链 3 补齐）。两次均为执行环境问题，非被验收行为失败。
> 环境预存事实（与本次改动无关，如实记录）：seed-debug.py 对带 team_id 的 3 条 seed（csv-employees / markdown-test / mermaid-charts）在 team 创建（循环后置）之前 POST → 后端 422，仅 20/24 入库；P5 verifier e2e.md「Total entries: 19」已记录同现象（seed 基建预存缺陷）。BDD-4 抽验按此事实调整口径（见 seed-isolation.log §6）。

## BDD 逐条对照（P1-requirements.md §3，13 条）

- PASS BDD-1: 干净环境 3 spec 自建后全绿——run1 实跑 mermaid.spec.ts 6 passed / mermaid-check.spec.ts 2 passed / mermaid-visual.spec.ts 6 passed（合计 14 passed，failed=0，skipped=0），3 spec 退出码全 0（链退出码 CHAIN1_EXIT=0）；BDD-1 Given 佐证：test-mermaid-2 / playwright-test / e2e-test 在 seed 后 DB 中 db_count=0 且匿名 GET 404（residue-check.log absent-check 节） (test-output.log, residue-check.log)
- PASS BDD-2: 运行后 DB 无 fixture 残留——run1 全部 spec 跑完后（debug-stop 之前）对本次运行创建的 14 个 fixture slug 逐条 sqlite3 COUNT 查询，全部 count=0，且 `e2e-mermaid%` catchall 查询 0 行 (residue-check.log)
- PASS BDD-3: 连续重跑 2 次结果稳定且无累积残留——run2（第 2 次连跑）3 spec 退出码全 0（6/2/6 passed，链 2 段捕获）；第 2 次运行后残留查询（链 3 补做，仍是干净 debug 环境）14 slug 逐条 count=0 + catchall 0 行，无累积残留 (residue-check.log, test-output.log)
- PASS BDD-4: fixture 不与 seed 数据冲突——seed-data 24 条 slug 与 3 spec fixture slug（e2e-mermaid-* 7 个模式 ×2 project 后缀）交集 0 行；spec 中无任何 seed slug 字面量；清理后 seed 抽验：公开条目 svg-icons / svg-standalone / dsh-architecture 匿名 GET 均 200（清理钩子未误删 seed）；markdown-test / mermaid-charts / csv-employees 认证 GET 404 经 sqlite 全表真值核实为不在 DB——seed 脚本预存 422 缺陷（team_id 时序，P5 同现象），非本次改动引入，见证据 §6.4 根因 (seed-isolation.log)
- PASS BDD-5: 清理失败必须显式失败——代码级断言记录：3 spec afterEach 对 `createdEntries.splice(0)` 逐条匿名 DELETE，容忍集 `[200, 204, 404]`（404=已删除容忍），其余状态码 `throw new Error(...)` 使用例 FAIL；创建成功才入队（POST 非 200/201 先 throw）；匿名建/删同 request 上下文配对；无静默吞错路径；运行旁证：两轮运行后残留全 0 (cleanup-assertion.md)
- PASS BDD-6: mermaid-visual 断言无条件执行——静态三判据实跑：if…Visible 条件包裹、.catch 静默假绿、if-count fail-safe 包裹三负向模式在 3 spec 命中 0 处（grep exit 1）；正向对照 expect 计数 mermaid 13 + check 3 + visual 7 = 23 ≥ 改造前基线 21（逐文件 13/3/7 ≥ 13/3/5） (static-checks.log)
- PASS BDD-7: 死选择器清零——`.mermaid-content` / `.mermaid-action-btn` / `.diagram-modal-overlay` 在 3 spec 命中 0 处；正向双向对照：spec 侧存活选择器（.diagram-viewer/.diagram-code/.diagram-action-btn/.diagram-modal）mermaid.spec 与 mermaid-visual.spec 各命中 ≥1，src 侧 DiagramBlock.vue（diagram-viewer L187/L369、fullscreen-btn L177）与 MermaidRenderer.vue（diagram-modal L9/L289）各命中 ≥1；构建产物 static/assets 含 diagram-viewer（辅助对照） (static-checks.log)
- PASS BDD-8: goto 全部使用 /:slug 页面路由——`/entries/` 在 3 spec 命中 0 处；`` goto(`${BASE_URL}/${slug}`) `` 形式每 spec 命中 ≥1（7 处）；「到达渲染视图（非 NotFoundView）」由运行断言兜底：BDD-10 的 .diagram-viewer/.diagram-block 断言在真实运行中通过（NotFoundView 下二者匹配 0） (static-checks.log, test-output.log)
- PASS BDD-9: 双 project 口径全绿——run1 运行不带 --project 过滤（配置仅 chromium 与 Mobile Chrome 两 project）；per-project 计数拆分：chromium 7/7 passed、Mobile Chrome 7/7 passed（mermaid 3+3 / check 1+1 / visual 3+3），两 project 各 0 failed 0 skipped；mermaid-visual 测试体内自起 chromium 在两 project 各执行一遍（6 次执行均计入 passed），日志逐行含 [chromium]/[Mobile Chrome] 前缀可核 (test-output.log)
- PASS BDD-10: 渲染正确性：自建 fixture 的 mermaid SVG 渲染输出——自建 fixture（单 mermaid flowchart 代码块）详情页实测：.diagram-viewer 可见且 boundingBox 容器高度 400px > 200（chromium 850x400 / Mobile Chrome 343x400），svg 可见且高度 400px > 100（SVG size: 850x400 / 343x400）；mermaid-check 双 project 容器 400px / SVG 400px；断言在 spec 内无条件执行，E2E 全绿 = 断言全过 (test-output.log, screenshots/bdd-10-mermaid-svg-chromium.png)
- PASS BDD-11: 渲染正确性：交互后结束状态断言——toggle 后 .diagram-code 可见 + .diagram-viewer 隐藏，切回后 svg 恢复可见且高度 >100；fullscreen 开启后 .diagram-modal 可见且实测高度 720px > 500（chromium 1280x720 / Mobile Chrome 393x727，1280x800 自起视口内），modal 内 svg 可见，Esc 关闭；量化实测值由 spec 断言输出（Container/SVG/Modal size 行）转录于 test-output.log (test-output.log, screenshots/bdd-11-toggle-code-view.png, screenshots/bdd-11-toggle-back-diagram.png, screenshots/bdd-11-fullscreen-modal.png)
- PASS BDD-12: 其余渲染 spec 不回归——干净 debug 环境重跑两 spec 并对照 P3 §5 基线（失败家族并集 bdd_3/4/5/7/8）：svg-inline-render.spec.ts 2 passed（3.3s）exit 0 = 基线全绿一致；render-regression.spec.ts 5 failed / 2 flaky / 15 passed，失败逐条对照全部 ∈ 基线家族（bdd_4 ×2 project、bdd_7 ×2 project、bdd_5 Mobile、bdd_8 ×2 project），零基线外新失败，bdd_4↔5 互换属既有 flaky 口径不计 (regression-compare.log)
- PASS BDD-13: E2E 编写规范落盘——docs/process/debug-workflow.md 实跑 grep：L245 `## E2E 编写规范` 节存在；L249 规则 1 文本（页面路由 `/:slug` 不是 `/entries/:slug`，API 才是 `/api/v1/entries`）；L250 规则 2 文本（spec 依赖的 entry 必须存在于 seed-data/ 或测试内自建且带 afterEach 清理队列）——两条规则同时存在 (doc-rules.log)

**Summary**: 13/13 PASS, 0 FAIL（run1 + run2 两轮独立实跑；静态三判据 + 文档判据命令级亲跑）

## post-test 残留检查（强制步骤，最后一条 PASS 证据记录前执行）

- 最后验证链（链 3）debug-stop 之前：14 fixture slug sqlite COUNT 全部 0 行 + `e2e-mermaid%` catchall 0 行（residue-check.log「residue2(链3补做)」节）。
- debug-stop 之后终检：/tmp/peekview-debug/ 目录已销毁（ls 确认不存在）、无 debug uvicorn 进程残留——无任何 fixture 残留、无跨轮污染路径。
- 结论：post-test 残留检查完成，无残留，各 PASS 判定有效。

## 证据清单与执行对照

| 证据文件 | 内容 | 关联 BDD |
|---|---|---|
| P6-evidence/test-output.log | run1 三 spec 全量转录（含 per-project 行、量化实测、EXIT_CODE 行） | 1/9/10/11 |
| P6-evidence/residue-check.log | run1 残留 + run2 后残留（链 3 补做）+ absent-check + DB 真值佐证 | 2/3 |
| P6-evidence/seed-isolation.log | slug 交集 0 + HTTP 抽验（匿名/认证）+ 404 根因 | 4 |
| P6-evidence/cleanup-assertion.md | 清理钩子代码级断言记录（容忍集/throw/入队/认证配对） | 5 |
| P6-evidence/static-checks.log | BDD-6/7/8 命令级判据全量输出 | 6/7/8 |
| P6-evidence/regression-compare.log | 两回归 spec 实跑 + 基线家族逐条对照 | 12 |
| P6-evidence/doc-rules.log | debug-workflow.md 规范节三条 grep | 13 |
| P6-evidence/screenshots/ | 4 张渲染/交互截图（md5 互异，66-91KB，run1 实跑转录） | 10/11 |

截图说明：4 张截图为 run1 链（01:47 时间戳）中 spec 内置 screenshot 调用的真实产物，转录自 /tmp（验收后 debug-stop 不清理 /tmp 根下散文件）；md5 互异（操作类截图不重复）。

## 环境隔离声明

[PROD_NOT_TOUCHED]

- 全部命令仅指向 http://127.0.0.1:8888（debug，/tmp/peekview-debug/ 数据目录）；run-e2e-tests.sh 内建生产守卫（E2E_GUARD_ENABLED）逐 spec 生效。
- 未操作 :8080 服务、未读写 ~/.peekview/、未使用 peekview CLI、未直接操作生产 DB；seed 仅灌入 debug DB。

## 边界说明

- 本报告为验收时点事实记录：seed 基建预存 422（3 条 seed 未入库）与 render-regression 既有 flaky 家族均为预存环境事实，如实记录，不影响本次 13 条 BDD 判定；未做任何修复性代码改动。
- 本文件由 verifier subagent 产出，自查≠gate：P6 gate 由主 Agent 跑 check-gate.py P6 + check-p6-evidence.py + check-p6-provenance.py，随后 P6.5 judge 独立复核。
