---
phase: P7
task_id: TPV0091-unicode-download-header-fix
type: consistency
parent: P2-design.md
trace_id: TPV0091-P7-20260813
status: approved
created: 2026-08-13
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 1
deviation_critical_count: 0
design_gap_count: 0
design_gap_reviewed_count: 0
---

# P7 一致性检查报告 — 中文/日文文件名下载与图片预览 500 修复

## 0. 审查范围与方法

- 输入：P1-requirements.md、P2-design.md、P2-review.md、P3-test-cases.md、P4-implementation.md、P5-test-results/unit.md、P6-acceptance.md、known-failures.md、`backend/peekview/api/files.py`、`frontend-v3/src/api/client.ts`、`frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts`
- 方法：对照 P1-P6 产出做跨文件交叉核对 + 实现代码逐行比对设计规格（非"看起来对"）
- 结论：无 [BLOCKER]、无 [DEVIATION-CRITICAL]，可推进 P8

## 1. DESIGN_GAP 配对

P4 implementation 明确声明无实现偏差：

> P4-implementation.md:48-50「无 SCOPE+、无 DESIGN_GAP。实现严格按 P2-design §2 锁定规格执行。」

- [DESIGN_GAP: 无] — P4 无 DESIGN_GAP 声明，无需配对。实现与 P2 §2.1/§2.2 规格逐行比对一致（见 §3.3），不存在需要 REVIEWED 标记的偏差项。
- design_gap_count: 0、design_gap_reviewed_count: 0。

## 2. SCOPE+ 闭环

P1-requirements.md 无 SCOPE+ 增补条目，frontmatter `scope_resolved: []` 为空。P1 §4 仅有 [NO_NEED_CONFIRM] + 3 条 [SUGGEST:]（二进制空文件预存问题不入范围 / downloadFile 死代码保留 / read tracking 口径变化 P2 知悉），全部在 P2-design.md §0「不改什么」+ §0「风险在哪」中被明确采纳处理。**无待闭环的 SCOPE+ 项**。

## 3. 跨文件一致性

### 3.1 P2§packages 与 P8 bump 范围

P2-design.md:12 packages = `[backend/peekview/api/files.py, backend/tests, frontend-v3/src/api/client.ts, frontend-v3/src/components/ImageViewer.vue]`，与 P1-requirements.md:13-18 完全一致（4 项，含 backend/tests 与 e2e 新增 spec）。

P4 implementation 实际改动面：files.py（`_build_content_disposition` + download_file）+ client.ts（`getFileAsBase64` URL）+ test_api.py（TestFileDownload 追加 3 方法）+ 新建 e2e spec。与 packages 范围吻合；`ImageViewer.vue` 属受影响面（调用 getFileAsBase64）但按 P2 §0 设计不改，仍在 packages 内（受影响≠被修改，符合 P1 §7「packages 说明」）。

⚠️ 非阻塞偏差记录（deviation_count=1）：P2-design.md:157 gate_commands.P5_e2e 写 `e2e/t091-unicode-preview-download.spec.ts`（旧前缀），与 P3-test-cases.md:25 强制改用的 `tpv0091-` 前缀不一致。该偏差已在链路中闭环：P2-review.md 观察③ 预发现 → P3 §test_code_dir 采纳 tpv0091- → P4-implementation.md:53-54 下游提示主 Agent → P5 实际跑通 12/12。**已解决、非阻断**，仅影响 P2 文档陈旧性，建议主 Agent 在 P8 前顺手修订 P2 该行（可选）。

### 3.2 P1§BDD 与 P6 验收数量

P1§BDD 共 8 条（BDD-1/2/3 预览、BDD-4/5/6/7 下载、BDD-8 内联），P6-acceptance.md frontmatter `pass: 8, fail: 0`，逐条 PASS（BDD-1/2/3/8 UI + vision、BDD-4/5/6/7 curl+pytest）。**数量 8=8 匹配，且逐条内容对应**（P6 每条标注了 BDD 编号与证据文件）。P3 的 11 用例（TC-B1 参数化 2 + B2 + B3 + B4 复用 + TC-F1×2 + F2/F3/F5/F8）完整映射 8/8 BDD，无 BDD 空映射或映射错位。

### 3.3 P4§impl-path 与 P2 方案吻合（逐行比对）

| P2 规格锚点 | P4 实现实际 | 判定 |
|-------------|------------|------|
| §2.1 `_build_content_disposition`（P2-design.md:99-107）| files.py:74-80，**逐字一致**：`safe = _sanitize_filename(filename)` → `isascii()` 分支 `attachment; filename="{safe}"` → fallback 非 ASCII 替换 `_` → `quote(safe, safe="")` → `filename*=UTF-8''{encoded}` | ✓ |
| §2.1 `download_file` 返回块（:109-117）用 `_build_content_disposition(file_record.filename)` | files.py:213-217，一致 | ✓ |
| §2.1 import quote | files.py:9 `from urllib.parse import quote`（stdlib 分组） | ✓ |
| P2-review 观察① 删 `safe_name` 防 F841 | files.py:179-217 已无 safe_name 局部变量 | ✓ |
| §2.2 getFileAsBase64 URL→`/content`（:131-141）| client.ts:162 `/entries/${slug}/files/${fileId}/content`，responseType='arraybuffer' 不变 | ✓ |
| §0 不改：getFileContent / downloadFile 死代码 / _sanitize_filename / get_file_content | client.ts:152-158、:173-175 原样；files.py:63-71、:220-262 原样 | ✓ |

实现与设计零偏差，helper 无「随便搞」空间（P2-review AI Slop 9/10 成立）。

### 3.4 P3 用例与 P6 验收覆盖一致

- TC-B1（BDD-4/5，中文/日文参数化）→ test_api.py:232 `test_bdd_4_5_unicode_filename_download`（断言 200 + filename* 正则 + unquote==原名 + body==/content）→ P6 BDD-4/5 PASS ✓
- TC-B2（BDD-6 café）→ test_api.py:253 `test_bdd_6_latin1_filename_download_header_valid` → P6 BDD-6 PASS ✓
- TC-B3（BDD-6 ASCII 字节级守卫）→ test_api.py:267 `test_bdd_6_ascii_filename_header_format_unchanged`（断言 `attachment; filename="report final.txt"`）→ P6 BDD-6 PASS ✓
- TC-B4（BDD-7 复用）→ test_security.py:577 `test_filename_header_injection_blocked`（200 + 无 \r\n，O1 不新增引号断言）→ P6 BDD-7 PASS（38 passed/1 skip）✓
- TC-F1/2/3/5/8 → tpv0091 spec 的 test_bdd_1/2/3/5/8 + mobile bdd_1 → P6 对应 PASS ✓

## 4. 未决项清零

- P1-requirements.md：无行首 [NEED_CONFIRM]（仅 [NO_NEED_CONFIRM]）、无 [BLOCKER]、无 [DEVIATION-CRITICAL]；3 条 [SUGGEST:] 均已在 P2 采纳并落地
- P6-acceptance.md：无 NEED_CONFIRM、无 [BLOCKER]、无 [DEVIATION-CRITICAL]，全部 PASS/FAIL 二值判定
- P5 的 1 个 failed（test_cli_remote）已登记 known-failures.md（预存失败，TPV0090 待办，与本任务无关），不阻断
- **未决项清零**

## 5. 耦合点核对（P1 implicit_coupling 4 项）

| 耦合点 | 核对结果 | 锚点 |
|--------|---------|------|
| backend-download-header | download_file → `_build_content_disposition(file_record.filename)`，helper 内部先 `_sanitize_filename` 再分支/编码，ASCII 分支字节级等同旧格式 → BDD-6 零回归 | files.py:63-71 / :74-80 / :213-217；P2-design §2.1 决策表 |
| frontend-preview-path | ImageViewer.vue:119 `api.getFileAsBase64(slug, fileId)` → client.ts:162 `/content`，全链路唯一调用方，URL 变更后契约（props.slug/fileId → data URI）不变 | client.ts:160-171；ImageViewer.vue:107-127（P2 §4 files_to_read 确认不改） |
| read-tracking-action | 预览改走 /content 后 action 从 download（files.py:205）变 read（files.py:250），P2 §2.3 确认无需代码改动；无测试绑定旧行为（P2-review §「read tracking 口径变化」复核） | P1 §4 SUGGEST③ + P2-design §2.3 + files.py:205/:250 |
| security-injection-guard | 净化顺序 = 先 `_sanitize_filename`（files.py:68 删 `"` `;` `\r` `\n`）后 `quote(safe, safe="")` 全 percent-encode → filename* 值只剩 attr-char 安全集；test_security.py:577-613 保持绿 | files.py:75-79；P2-design §2.1 决策表「净化顺序」；P6 BDD-7 |

4 项耦合点全部核对通过，与 P1 coupling_checklist 声明一致。

## 6. 其他一致性观察

- e2e spec 命名 `tpv0091-` 前缀贯穿 P3/P4/P5/P6 与仓库文件一致（frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts 存在，P5 实跑 12/12）
- BDD-8 复用 /content 端点未被改动（get_file_content 未动），P6 5 图全部走 `/files/\d+/content` 证实
- 环境隔离合规：P5/P6 全程 debug :8888，生产库 mtime 未变，known-failures 登记齐全

## 7. 结论

- [BLOCKER] 数量：0
- [DEVIATION-CRITICAL] 数量：0
- DESIGN_GAP：0 条声明，无需配对（P4-implementation.md:48-50 明确）
- SCOPE+：0 条，无需闭环（P1 scope_resolved 为空）
- 跨文件一致性：P2 packages ↔ P1 packages ↔ P4 改动面一致；P1 BDD 8 ↔ P6 PASS 8 逐条对应；P4 实现路径与 P2 方案逐行吻合；P3 用例与 P6 验收覆盖一一映射
- 1 条非阻塞偏差（P2 gate 命令 e2e 名旧前缀）已在 P3/P4/P5 链路闭环，deviation_count=1 / deviation_critical_count=0
- **无 [BLOCKER] / [DEVIATION-CRITICAL]，可推进 P8**

## 8. 给主 Agent 的提示

- 可选：P8 前顺手修订 P2-design.md:157 gate_commands.P5_e2e 的 spec 名为 `tpv0091-` 前缀（仅文档陈旧，功能已验证通过）
- P8 bump 范围应与 P2 packages 一致（files.py / backend/tests / client.ts / ImageViewer.vue），并含新增 e2e spec
