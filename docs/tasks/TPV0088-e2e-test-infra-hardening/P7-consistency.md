---
phase: P7
task_id: TPV0088-e2e-test-infra-hardening
type: consistency
parent: P2-design.md
trace_id: TPV0088-P7-20260812
status: approved
created: 2026-08-12
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 2
design_gap_reviewed_count: 2
---

# P7 一致性检查 — TPV0088 e2e-test-infra-hardening

[PROD_NOT_TOUCHED] 纯文档/代码只读审查：未启动服务、未触碰生产 :8080 与 `~/.peekview/`，仅执行 git show / grep / rg / sed 只读命令。

## 1. DESIGN_GAP 配对（P4 声明 → P7 转抄 + REVIEWED）

> 查证说明：当前工作区 P4-implementation.md（retry1 重写版）**不含** `[DESIGN_GAP]` 标记（grep 零命中，commit d4b05ee4 状态亦然）。但两处 DESIGN_GAP 存在于**已提交的 P4 初版**（commit 8faa147a，P4-implementation.md:49/51）且被 **P4-review.md §[DESIGN_GAP] 审查（approved）** 完整审查采纳（GAP-1/GAP-2），对应代码已实现（spec:146 / spec:340）。故按实质内容逐条转抄并配对 REVIEWED，保证审计链完整。

[DESIGN_GAP: TC-012 将点击目标从 P2/P3 默认的 `.toc-item a` first() 改为 last()——rich-markdown.md 首个 toc 项是文档顶部 h1，click first() 后 scrollTop 可能恒 0 导致断言不稳；last() 在折叠线以下，scrollTop>0 确定性成立。P3 清单仅写"点 .toc-item a"，未限定 first/last（来源：P4-review.md §[DESIGN_GAP] 审查 GAP-1；初版 P4-implementation.md commit 8faa147a:49）]

[DESIGN_GAP_REVIEWED: 已核实现实状态一致——`viewer.spec.ts:146` `page.locator('.toc-nav .toc-item a').last()` 确认实现 last()；P2 §2.1.3 S11 的目标（滚动锚 `.content-area` scrollTop>0，不依赖 `.toc-item.active`）不受影响；P3 修复清单 #8（TC-012）"点 .toc-item a"为不定选择，last() 属范围内的增强而非偏离。P5 复跑 38/38 含 TC-012 通过。锚点：P1 BDD-2/4、P2 §2.1.3 S11、P4 implementation retry1 修复清单 #2]

[DESIGN_GAP: TC-050 在 `toHaveURL(/\/([^/]+)$/)` 之外追加 `.detail-header` 可见断言——该正则同时匹配 `/explore`，单独使用在导航尚未发生时即可通过（假绿）；detail-header 可见才证明真实进入 detail 页。P2 S10 未覆盖此弱化点（来源：P4-review.md §[DESIGN_GAP] 审查 GAP-2；初版 P4-implementation.md commit 8faa147a:51）]

[DESIGN_GAP_REVIEWED: 已核实现实状态一致——`viewer.spec.ts:340` `await expect(page.locator('.detail-header')).toBeVisible()` 确认追加；`viewer.spec.ts:327` goto `/explore` 与 `:341` `toHaveURL(/\/[^/]+$/)` 并存，两者互证导航真实发生，堵住 P2 S10 单独正则的假绿漏洞。锚点：P1 BDD-2、P2 §2.1.3 S9/S10、P4 implementation retry1 修复清单 #6]

## 2. SCOPE+ 闭环

- **P1 无 `[SCOPE+]` 标记**（grep 零命中），只有 `[NO_NEED_CONFIRM]`（P1 §3 行 83）与 `[SUGGEST]`（P1 行 90，Check 6 集中放 e2e-safety-check.sh + `make build-frontend` 提示 + `find frontend-v3/src -newer ...` 比对）。
- **SUGGEST 已被采纳并落地**：Check 6 位于 `scripts/e2e-safety-check.sh` 既有 Check 5 之后（line 123-125）、函数定义/自检块置于 Check 1 之前（line 11-35），过期报错含 `make build-frontend` 提示（line 16/25），比对命令 `find "$src_dir" -type f -newer "$static_index"`（line 20）与 P1 SUGGEST 口径一致（叠加 `-type f` 为 P2 §6 minimal_validation 驱动修订，P2 §8 已显式登记，不构成新偏离）。
- **结论：SCOPE+ 项不存在，闭环 N/A；SUGGEST 已闭环。**

## 3. 跨文件一致性检查

### 3.1 P2 方案 ↔ P4 实现（viewer.spec.ts 修复点）

| P2 锚点 | P4/实现核验 | 结果 |
|---------|------------|------|
| P2 §2.1.1 路由 history（BDD-2） | `viewer.spec.ts` 15 处 `page.goto` 均为 `/{slug}` 或 `/`（TC-031）或 `/explore`（TC-050），grep `/#/entry/` 零命中 | 一致 |
| P2 §2.1.2 slug 映射表（BDD-4） | 实测 spec 内 slug 出现次数：python-entry-service×5、markdown-test×6、mermaid-charts×1、json-api-config×1；无 `lu4prg`/`ngajri` 残留 | 一致 |
| P2 §2.1.3 S1~S12 死选择器替换（BDD-3） | grep 无 `.code-header`/`.mobile-actions`/`.menu-btn`/`.toc-btn`/`.list-header`/`.btn-icon`/`has-text`/`a[download]`/`mermaidExists`；活选择器在册（`.file-sidebar`×3、`.toc-sidebar`×2、`data-testid`×7 等），与 P6 BDD-3 统计吻合 | 一致 |
| P2 §2.1.4 单文件断言（BDD-5） | `scripts/seed-data/json-api-config/` 仅 config.json 一个内容文件；spec:292-300 断言 `.file-sidebar` count===0 | 一致 |
| P2 §2.1.5 验收锚点（BDD-1） | P5 复跑 + P6 均 `38 passed`（19 用例 × 2 项目），非抽样 | 一致 |

### 3.2 P2 §2.2 Check 6 ↔ 实现（e2e-safety-check.sh）

| P2 锚点 | 实现核验 | 结果 |
|---------|---------|------|
| P2 §2.2.1 函数定义先于 Check 1 | `e2e-safety-check.sh:11-29`（line 11 起）位于 Check 1（line 39）之前 | 一致 |
| P2 §2.2.1 `--test-mtime` 自检块紧跟函数定义 | `e2e-safety-check.sh:32-35`，位于 Check 1 之前 | 一致 |
| P2 §2.2.1 缺失先判 `[ -f ]` | line 14 `[ ! -f "$static_index" ]` | 一致 |
| P2 §2.2.1 `-type f` 防目录 mtime 假阳性 | line 20 `find "$src_dir" -type f -newer "$static_index"` | 一致 |
| P2 §2.2.1 过期列前 5 + 提示 build-frontend | line 21-26（`head -5` + `make build-frontend`） | 一致 |
| P2 §2.2.1 Check 6 调用位于 Check 5 之后 | line 123-125（Check 5 结束于 line 121，`=== ✓ 安全检查通过 ===` 在 line 128） | 一致 |
| P2 §2.2.2 Makefile 传 $(CURDIR) env | `Makefile:636-639` `PV_SRC_DIR=$(CURDIR)/frontend-v3/src` + `PV_STATIC_INDEX=$(CURDIR)/backend/peekview/static/index.html` | 一致 |
| P2 IMPL-C1 Check 1-5 只追加不改 | git diff HEAD~4..HEAD：e2e-safety-check.sh 纯新增（函数+自检块+Check 6 调用），Check 1-5 零改动 | 一致 |

### 3.3 P1 BDD ↔ P6 验收数量匹配

P1 §4 共 **9 条 BDD**（BDD-1~BDD-9，逐一 grep 确认）；P6-acceptance.md **9 条 PASS 一一对应**（`PASS BDD-1` 至 `PASS BDD-9`，grep 确认，无 FAIL）。数量与内容编号均匹配，无 BDD 被错映射。

### 3.4 P3 测试契约 ↔ P4 实现对应

| P3 锚点 | P4/实现核验 | 结果 |
|---------|------------|------|
| TC-B1/B2/B3/B4/B6（新鲜/过期/缺失/env 注入） | `P3-test-code/test-mtime.sh` 含对应断言（B1 line 84-98、B2 103-117、B3 123-137、B4 142-153、B6 160-171）；P4-b 自查 PASS=6/FAIL=0 | 一致 |
| TC-B5（绕过 Check 1）| harness 中为诊断 helper `check_target_implemented`（line 70-76），非独立计数用例；P4-b PASS=6 与之吻合 | 一致 |
| TC-B7（IMPL-C1 回归守卫）| `test-mtime.sh:178-186` 无参调用断言 exit 1 + 含 "Check 1" | 一致 |
| P3 gate_commands.P3 `bash scripts/e2e-safety-check.sh --test-mtime` | P4-b 实测 exit 0（`✓ 静态产物新鲜`）；P2 §3 固化命令未被 P4-P6 修改 | 一致 |

### 3.5 P5 回退记录 ↔ 最终实现一致

- P5 首轮 `18 failed + 1 flaky`（`P5-test-results/e2e.md`）→ P4 retry1 修复 **7 项**（P4-implementation.md 修复清单 #1~#7：TC-005 / TC-010,011,012,020,023(helper) / TC-022 / TC-030 / TC-040 / TC-050 / TC-002），复跑 **38/38**。
- 逐项代码核验（dispatch 记载 11 个 TC 修复，实现 7 条修复记录，覆盖一致）：
  - TC-005 `filter({ hasText: 'entry_service.py' })` → spec:103 ✓
  - openMarkdownFile helper（API 查 id + `?firstFileId=`）→ spec:17-22 ✓
  - TC-022 `click({ position: { x: 360, y: 400 } })` → spec:207 ✓
  - TC-030/TC-040 强制桌面视口 → spec:232/281 ✓
  - TC-050 点 `.entry-card .card-title` + 桌面视口 → spec:327/337 ✓
  - TC-002 `waitForShiki` timeout 15s → spec:7 ✓
- P5 e2e.md "复跑 38/38" 与 P6 BDD-1 "38 passed" 数字一致（2 项目 × 19 用例）。

### 3.6 未决项清零

- P1 无残留行首 `[NEED_CONFIRM]`（仅 `[NO_NEED_CONFIRM]`）、无 `[BLOCKER]`、无 `[DEVIATION-CRITICAL]`（grep 确认）。P6 9 条均为 PASS/FAIL 二值，无 NEED_CONFIRM。

## 4. 非阻塞观察（不构成 DEVIATION）

- **OBS-1**：P6 BDD-4 记 "python-entry-service×5、markdown-test×6" 是 spec 内**字符串出现次数**（rg -c），而括号内列举的是**测试用例编号**（TC-004/005/030/042 共 4 个用例；markdown-test 对应 TC-010~012/020~023/040 共 8 个用例）——措辞上数量与用例数不对应，但数据本身（slug 出现与映射）与 P2 §2.1.2 完全一致，无实质影响。
- **OBS-2**：P2 §2.1.1 记原文件 17 处 goto 含 `/#/entry/`，现 spec 15 处 `page.goto`（helper 化 openMarkdownFile 合并后减少）——属修复过程的自然形态，BDD-2 语义（无 `/#/entry/` 残留）已满足。
- **OBS-3**：retry1 重写 P4-implementation.md 时丢失了两处 `[DESIGN_GAP]` 标记（初版 commit 8faa147a 有、HEAD d4b05ee4 无），但 P4-review.md 已完整审查并 approved，本 P7 已转抄配对，审计链闭环。若后续有工具依赖 P4 文件内标记做计数，需注意此差异。

## 5. 结论

- **BLOCKER = 0**（无阻塞项，见 §1/§3 全部检查项）
- **DEVIATION-CRITICAL = 0**
- **DESIGN_GAP = 2，全部 REVIEWED 配对（2/2）**
- **SCOPE+：N/A（无 [SCOPE+]）；SUGGEST 已闭环**
- **未决项清零**
- 跨文件一致性：P2↔P4 方案与实现、P1↔P6 BDD 数量、P3↔P4 测试契约、P5 回退↔最终实现全部吻合，且均引用具体锚点（P2 §2.1.x/§2.2.x、P1 BDD-N、P4 implementation retry1 修复清单 #N、P3 TC-Bx、spec 行号）。

**status: approved**（满足推进条件：无 BLOCKER/DEVIATION-CRITICAL、DESIGN_GAP 全配对、SCOPE+ 闭环、跨文件检查引用了实质锚点）
