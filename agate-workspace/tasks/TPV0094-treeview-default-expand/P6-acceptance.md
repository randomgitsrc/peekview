---
phase: P6
task_id: TPV0094-treeview-default-expand
type: acceptance
parent: P5-verification.md
trace_id: TPV0094-P6-20260815
status: draft
created: 2026-08-15
agent: verifier
# ── v2.0 机器汇总 ──
pass: 8
fail: 0
ui_affected: true
---

# P6 验收报告 — TPV0094 TreeView 默认展开优化

- phase: P6
- task_id: TPV0094-treeview-default-expand
- trace_id: TPV0094-P6-20260815
- agent: verifier
- 验收环境: debug backend :8888（隔离 `/tmp/peekview-debug/`）+ Chrome CDP :18800，viewport 1280×800
- 状态标记: [PROD_NOT_TOUCHED]（未触碰 :8080 生产服务与 ~/.peekview/，未引入任何源码变更，fixture 与验证脚本均经 debug :8888 API 创建 / 放 /tmp 与 P6-evidence/scripts/）
- 状态标记: [NO_NEED_CONFIRM]
- 验收方式: Playwright CDP 实跑 8 条 BDD，逐条二值判定（先跑后结论）

> vision 引用说明：UI 类 PASS 行均已引用截图 + 断言日志 + vision-reports/ 下对应 YAML（vision-engine 实跑产出，blocker_count=0）。

## 验收依据

- P1-requirements.md §3 的 8 条 BDD（BDD-1~8）
- P2-design.md §8 redline_protocol（BDD-8 判定协议：预算 ≤500ms、阈值取值规则、无白屏/无超时）
- P3-test-cases.md fixture 映射（t094-p6-* 为 P6 经 debug API 创建的干净 fixture，规避调试库中带 `-2-2-...` 后缀的历史脏数据）

## fixture 清单（debug :8888 API 创建，`/tmp/create-p6-fixtures.py`）

| slug | 内容 | 节点数 |
|------|------|--------|
| t094-p6-json | 小 JSON（9 节点，2 分支） | 9 |
| t094-p6-yaml | 小 YAML | 9 |
| t094-p6-xml | 小 XML | 7 |
| t094-p6-large | 大 JSON（根 data → 20 子树 × 500 叶子） | 10021 |
| t094-p6-multi | large.json + small.json 多文件 | 10021 + 9 |
| t094-p6-perf-{100,500,1000,2000,5000} | 平铺单根 + N-1 叶子（红线实测） | N |

## BDD 逐条验收结果

- PASS BDD-1: 小 JSON 默认全部展开 — `.tree-node` 数 == 9（== 节点总数），`[aria-expanded="true"]` 计数 == 2（== 分支节点数），`[aria-expanded="false"]` 计数 == 0，无折叠 banner (screenshots/bdd1-small-json-expanded.png, test-output.log, scripts/p6-verify-bdd1-7.ts) (vision: vision-reports/bdd-1.yaml)
- PASS BDD-2: 小 YAML / 小 XML 同样默认全展开 — YAML `.tree-node`=9、XML `.tree-node`=7，两者 `[aria-expanded="false"]` 计数均为 0（全部节点含子节点行展开、无折叠 toggle）(screenshots/bdd2-yaml-expanded.png, screenshots/bdd2-xml-expanded.png, test-output.log) (vision: vision-reports/bdd-2.yaml)
- PASS BDD-3: 超红线大 JSON 默认折叠并显示提示 — 10021 节点 entry 渲染 `.tree-node`=1（远小于总节点数），`data-testid="tree-collapse-banner"` 可见且文案含「已折叠部分」(screenshots/bdd3-large-collapsed-banner.png, test-output.log) (vision: vision-reports/bdd-3.yaml)
- PASS BDD-4: 大文件折叠态下仍可手动展开 — 默认折叠（1 节点）→ 点根 `data` toggle → 21 节点、`sub_0` 可见 → 点 `sub_0` toggle → 521 节点、`leaf_0_499` 可见（两次逐层手动展开均成功）(screenshots/bdd4-manual-expand.png, test-output.log) (vision: vision-reports/bdd-4.yaml)
- PASS BDD-5: 多文件 entry 切文件后按新文件大小重新决定展开态 — t094-p6-multi 默认打开 large.json（折叠 + banner）→ 点击 `small.json` → `.tree-node`==9 全展开、`[aria-expanded="false"]`==0、banner 消失（不继承大文件折叠态）(screenshots/bdd5-multi-before-switch.png, screenshots/bdd5-after-switch-small.png, test-output.log) (vision: vision-reports/bdd-5.yaml)
- PASS BDD-6: 展开态下手动折叠/再展开可逆 — 小 JSON 中 `tags` 行初始 `aria-expanded="true"` → 点击一次 → `false` 且子节点隐藏 → 再点一次 → `true` 且子节点恢复可见（三态断言通过）(screenshots/bdd6-toggle-reversible.png, test-output.log) (vision: vision-reports/bdd-6.yaml)
- PASS BDD-7: 折叠态下搜索计数不受影响 — 大 JSON 折叠态（banner 可见）输入 `leaf_3_250` → `.search-match-count` 显示 `1 match`（非零，遍历不依赖展开态）(screenshots/bdd7-search-collapsed.png, test-output.log) (vision: vision-reports/bdd-7.yaml)
- PASS BDD-8: 红线阈值据实测定并记录证据 — 5 量级实测见下，判定：2000 满足预算且 5000 超预算 → 阈值保持 `DEFAULT_EXPAND_THRESHOLD = 2000` (redline-results.json, redline-test-output.log, scripts/p6-redline-bench.ts)

## BDD-8 红线实测明细（P2 §8 redline_protocol 执行）

**测量口径**：平铺 fixture（单根 + N-1 叶子）→ 折叠（N≤阈值量级初始全展开则先折叠）→ T0（页内 performance.now()）→ 点击根 toggle → `waitForFunction(.tree-node == N, 10s)` → T1 → 全展开渲染耗时 = T1 - T0。预算 ≤500ms，`waitForFunction` 10s 超时判白屏/无响应。

| 量级 | 全展开渲染耗时 | ≤500ms 预算 | 白屏/超时 |
|------|--------------|------------|----------|
| 100  | 45.8ms | ✓ | 无（readyState=complete, bodyVisible=true）|
| 500  | 141.9ms | ✓ | 无 |
| 1000 | 206.5ms | ✓ | 无 |
| 2000 | 297.2ms | ✓ | 无 |
| 5000 | 787.7ms | ✗ 超预算 | 无超时（787ms 完成渲染，无白屏）|

**阈值判定**：满足预算的最大量级 = 2000；5000 超预算 → 按 P2 §8 规则取 2000。**DEFAULT_EXPAND_THRESHOLD 保持 2000，无需回 P4 改常量**。5000 量级无白屏（787ms 正常完成，页面持续响应），实测覆盖到 5000 节点（BDD-8 Given/When/Then 全部满足）。

**初始态抽查（阈值语义验证）**：N=100 首屏即全展开（100 节点）、N=5000 首屏折叠 + banner——与阈值语义一致，证明测量基准有效（fixture 未越权全展开）。

## Summary

**Summary**: 8/8 PASS, 0 FAIL

- BDD-1~7 产品行为全部符合 P1 验收条件，实现与 P2 设计一致（`DEFAULT_EXPAND_THRESHOLD=2000`、`shouldCollapse` 判定、`resetExpansion` 全展开收集、`tree-collapse-banner` 折叠提示）
- BDD-8 红线实测确定阈值 2000 有效（实测证据：100→45.8ms 单调增长至 2000→297.2ms，5000→787.7ms 超预算）
- 截图相似性说明：bdd1 与 bdd2-yaml（同源小 JSON 树，视觉相似）、bdd3 与 bdd7（同一大 JSON 折叠态，视觉相似）——均 md5 逐字节不同，视觉相似因同 fixture 渲染，行为差异由断言日志（test-output.log）承载：BDD-1 断言 expFalse=0、BDD-2 断言 yaml/xml 各自独立 entry、BDD-3 断言 banner 文案、BDD-7 断言搜索计数 1 match
- vision-reports/ 已由 verifier 用 vision-engine 实跑产出（bdd-1~7.yaml，blocker_count 均为 0，含具体验证点与结论）
- P6 阶段未引入任何源码变更，验收脚本留存 P6-evidence/scripts/ 与 /tmp
