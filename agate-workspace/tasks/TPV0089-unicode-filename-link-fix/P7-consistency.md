---
phase: P7
task_id: TPV0089-unicode-filename-link-fix
type: consistency
parent: P2-design.md
trace_id: TPV0089-P7-20260811
status: approved
created: 2026-08-11
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

# P7 一致性审查 — TPV0089 非 ASCII 文件名本地资源链接解析修复

审查方式：逐文件阅读 P1-P6 产出 + 实现代码（`frontend-v3/src/utils/path-map.ts`、`frontend-v3/e2e/unicode-filename-link.spec.ts`、`scripts/seed-data/unicode-filenames/`、`scripts/seed-debug.py`）+ P6 证据日志（P6-evidence/ + vision-reports/）交叉核对。

## 1. DESIGN_GAP 配对

P4-implementation.md 全文无 `[DESIGN_GAP]` 声明（grep `^\s*\[DESIGN_GAP` 于 P1-P6 全目录无命中）。

[DESIGN_GAP: 无。P4 §5 明确声明"无自主决策，严格按 P2 方案 A 伪代码契约实现"。]

[DESIGN_GAP_REVIEWED: P4 实现记录 §2 契约对照表逐条对齐 P2 §2 方案 A（raw 优先 / decode-once / try-catch 畸形兜底 / 守卫重跑 / matchRef 抽取），经与 `path-map.ts:77-108` 实际代码比对确认无未声明偏差。design_gap_count=0 成立。]

## 2. SCOPE+ 闭环

- P1 frontmatter `scope_resolved`（P1:33-34）声明："BDD-7 前提勘误 + 新增 BDD-8（字面 % 文件名 raw 直接命中）——SCOPE+ from P2 已回写 P1 基线，13 BDD"
- BDD-8 已纳入基线：P1:111（BDD-8 定义）→ P3 TC-UNI-09（P3:72-76）→ P6 PASS BDD-8（P6:41）
- BDD-7 前提勘误文本已回写：P1:109 注明 keepEscaped=true 不二次编码，真实链路由 BDD-8 覆盖
- 闭环确认：SCOPE+ 两条（BDD-7 前提勘误 + BDD-8 增补）均已纳入 P1 基线并被 P3/P6 实现与验收，无未回写的 SCOPE+ 条目。

## 3. 跨文件一致性

| # | 检查项 | 锚点 | 结论 |
|---|--------|------|------|
| 3.1 | P1 13 BDD vs P6 验收数量 | P1 BDD-1~13（P1:75-141，grep 唯一编号 13 个）；P6 §"BDD 逐条结果"（P6:34-46，13 行 PASS / 0 行 FAIL，frontmatter pass=13 fail=0） | 一致：13↔13，编号 1:1 对应 |
| 3.2 | BDD-11 BASELINE_CHANGE 双记录 | P1:131 `[BASELINE_CHANGE from P5]`（SPA URL 不变，改内容区断言）；P6:44 同语义记录；P5-test-results/e2e.md §BDD-11 根因分析 | 一致：三处（P1/P5/P6）叙述同一变更，验收以内容区显示为判据 |
| 3.3 | P2 packages vs P8 发布范围 | P2:12 `packages: [peekview]`；P1:14 `packages: [peekview]`；P2:32-33 后端/API/MCP 零改动 | 一致：改动仅前端静态资源，随 peekview 发布；无 mcp-server 包改动 |
| 3.4 | P4 实现路径 vs P2 方案设计 | P2 §2 候选方案 A（P2:46-70 伪代码）；P4:20-21（matchRef 抽取 + resolvePath raw 优先/decode-once/守卫重跑）；实际代码 path-map.ts:77-86（matchRef）、:88-108（resolvePath） | 一致：L93 显式 `raw !== null` 防 fileId=0（P2:54 注释对应）；L97-100 try/catch→null（BDD-6）；L102 decoded===normalized→null；L104-107 守卫重跑（TC-UNI-11/12/13） |
| 3.5 | normalizeRef/buildPathMap 零改动 | P2:29-30 契约；path-map.ts:10-23（normalizeRef 无 decode）、:25-75（buildPathMap 无 decode）；P4:22 | 一致 |
| 3.6 | P3 测试契约 vs P6 证据 | P3 §1 TC-UNI-01~13（P3:30-90）；P6 引用 TC-UNI-01~10（P6:34-42）；P6-evidence/test-output-unit.log 实测含 TC-UNI-01~13 全部（grep 13 个唯一编号） | 一致：P6 单元证据覆盖 P3 全部用例含守卫补充 11/12/13 |
| 3.7 | fixture 与 E2E 用例映射 | P3 §3 fixture 清单（P3:126-137，8 文件 + meta.json）；实际 scripts/seed-data/unicode-filenames/ 8 文件逐一存在；seed-debug.py BINARY_OVERRIDES 新增 unicode-filenames（5 PNG base64，P3:148 必要支持改动）；README.md 引用写法（`<images/report final.png>` 尖括号）符合 P2 §7 minimal_validation:178 实测约束 | 一致：文件数、文件名、markdown 引用写法、seed 支持改动全对齐 |
| 3.8 | P6 E2E 证据文件存在性 | P6 证据清单（P6:50-56）引用 test-output-unit.log / test-output-e2e.log / cdp-verify-bdd11-bdd13.log / 8 张截图；实际 P6-evidence/ 与 evidences/ 全部存在；vision-reports/bdd10~13.yaml blocker_count=0 | 一致 |

## 4. 未决项清零

- P1 无残留行首 `[NEED_CONFIRM]` / `[BLOCKER]` / `[DEVIATION-CRITICAL]`（grep 全目录无命中）；P1:145 为 `[NO_NEED_CONFIRM]` 显式声明，合规
- P2-P6 亦无上述残留标记

## 5. 非阻断观察（WARNING 级，不构成 BLOCKER/DEVIATION）

- **P3 §2 BDD-11 文档文本漂移**：P3:107 仍写旧断言 "Then URL 跳转 `/{slug}?file=\d+`"，而 P1:131（BASELINE_CHANGE）、P6:44、实际 spec（unicode-filename-link.spec.ts:57-60 内容区断言）均已按 SPA store 导航更新。P3 为 P5 前的测试设计文档，未随 P5 修正回写。属文档漂移，实际验收证据（P6）与实现（spec）自洽，不影响一致性结论。建议主 Agent 在后续文档整理时回写 P3 BDD-11 的 Then 断言文本（可选，非本阶段阻塞项）。

## 6. 审查结论

- BLOCKER=0，DEVIATION-CRITICAL=0，DEVIATION=0
- DESIGN_GAP=0（P4 无声明），全部配对项无缺失
- SCOPE+ 已闭环（scope_resolved 已回写 13 BDD 基线）
- 跨文件一致性检查项 3.1~3.8 全部通过，均引用具体源文件节名/BDD 编号/行号锚点
- 结论：**approved**。实现与设计一致，无未决项阻断 P8 发布流程。

[PROD_NOT_TOUCHED]
