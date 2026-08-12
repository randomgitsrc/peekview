---
phase: P6
task_id: TPV0089-unicode-filename-link-fix
type: acceptance
parent: P5-verification.md
trace_id: TPV0089-P6-20260811
status: draft
created: 2026-08-11
agent: verifier
# ── v2.0 机器汇总 ──
pass: 13
fail: 0
ui_affected: true
---

# P6 验收报告 — TPV0089 非 ASCII 文件名本地资源链接解析修复

验收时间：2026-08-12（debug backend :8888 实跑，[PROD_NOT_TOUCHED]，全程未触碰 :8080 / ~/.peekview/）

## 验收环境

- debug backend `http://127.0.0.1:8888`（隔离数据 `/tmp/peekview-debug/peekview.db`，E2E 安全守卫确认）
- fixture：`unicode-filenames` entry（8 files：README.md + 中文图片.png / 概要図.png / café.png / report final.png / arch.png + 报告附件.txt / english-notes.txt）
- 浏览器：CDP Chrome `127.0.0.1:18800`，desktop 1280×800 + mobile 390×844
- 静态文件：`make build-frontend` 已重建（P5），dist 反映 P4 修复

## 验证方法

- **BDD-1~9（单元级）**：`npx vitest run src/utils/path-map.test.ts --reporter=verbose` 实跑，51/51 passed，日志含每条 TC-UNI 用例名（对应 BDD-1~9）
- **BDD-10~13（端到端）**：`E2E_SPEC=e2e/unicode-filename-link.spec.ts make debug-test` 实跑 12/12 通过（11 passed + 1 flaky=BDD-12 chromium naturalWidth 竞态，retry 通过，exit 0）；另用自定义 CDP 脚本补充精确断言（BDD-11/13 点击后内容区文本）

## BDD 逐条结果

- PASS BDD-1: 中文文件名 path 引用（images/中文图片.png 与 percent-encode 形式）解码后命中 fileId (test-output-unit.log) TC-UNI-01 通过
- PASS BDD-2: 中文文件名 basename 引用解码后命中 fileId (test-output-unit.log) TC-UNI-02 通过
- PASS BDD-3: 日文文件名 概要図.png 解码后命中 (test-output-unit.log) TC-UNI-03 通过
- PASS BDD-4: 带重音 café.png 解码后命中 (test-output-unit.log) TC-UNI-04 通过
- PASS BDD-5: 含空格 report final.png 解码后命中 (test-output-unit.log) TC-UNI-05 通过
- PASS BDD-6: 畸形转义（孤立 %）不抛异常：命中返回 fileId、未命中返回 null (test-output-unit.log) TC-UNI-06/07 通过
- PASS BDD-7: 字面 % 文件名 decode 恰好一次（a%2520b → a%20b 命中，不二次 decode）(test-output-unit.log) TC-UNI-08 通过
- PASS BDD-8: 字面 % 文件名 raw 直接命中（a%20b.png 不经 decode）(test-output-unit.log) TC-UNI-09 通过
- PASS BDD-9: 英文文件名 arch.png 不回归，返回 fileId (test-output-unit.log) TC-UNI-10 通过
- PASS BDD-10: 中文文件名图片 中文图片.png 实际渲染——E2E 断言 img src 已改写为 /api/v1/entries/unicode-filenames/files/43/content（非相对路径、不含 %E4%B8%AD）、naturalWidth=32>0；截图可见红色实心方块无裂图 (test-output-e2e.log, screenshots/bdd10_desktop_1280x800.png, screenshots/bdd10_mobile_390x844.png) (vision: vision-reports/bdd10.yaml)
- PASS BDD-11: 中文附件链接 报告附件.txt 可点击打开——E2E 点击后内容区可见；自定义 CDP 脚本断言点击后内容区文本变为"这是中文文件名附件的占位内容"（无 404），截图可见文本与选中态附件 (test-output-e2e.log, cdp-verify-bdd11-bdd13.log, screenshots/bdd11_desktop_1280x800.png, screenshots/bdd11_click_desktop.png, screenshots/bdd11_mobile_390x844.png) (vision: vision-reports/bdd11.yaml) [BASELINE_CHANGE from P5]：SPA store 导航（T047 既有架构）URL 不变，验收以"内容区显示文件内容、无 404"为用户可见行为，与 ASCII 链接行为一致非回归
- PASS BDD-12: 日文/重音/空格文件名图片实际渲染——5 张图全部 src 改写为 /files/\d+/content 且 naturalWidth>0；截图可见蓝/绿/橙黄实心方块无裂图 (test-output-e2e.log, screenshots/bdd12_desktop_1280x800.png) (vision: vision-reports/bdd12.yaml)
- PASS BDD-13: 英文文件名不回归——E2E 断言 arch.png src 改写 + English 链接存在；自定义 CDP 断言 arch.png naturalWidth=32、点击 English 链接后内容区显示"English attachment placeholder" (test-output-e2e.log, cdp-verify-bdd11-bdd13.log, screenshots/bdd13_english_desktop.png) (vision: vision-reports/bdd13.yaml)

## 验收证据清单

| BDD | 证据文件 | 说明 |
|-----|---------|------|
| BDD-1~9 | P6-evidence/test-output-unit.log | vitest verbose 51/51，逐条含 TC-UNI 用例名 |
| BDD-10 | test-output-e2e.log + bdd10_desktop/mobile 截图 | 12/12 E2E + 截图 |
| BDD-11 | test-output-e2e.log + cdp-verify 日志 + bdd11 三张截图 | 内容区显示附件文本断言 |
| BDD-12 | test-output-e2e.log + bdd12_desktop 截图 | 5 图 naturalWidth>0 |
| BDD-13 | test-output-e2e.log + cdp-verify 日志 + bdd13_english 截图 | 英文图片渲染 + 链接点击 |

## vision-helper 结论

- bdd10.yaml / bdd11.yaml / bdd12.yaml / bdd13.yaml：`summary.blocker_count` 均为 **0**
- 无 blocker，无异常需追查（4 张关键截图全部 vision 确认图片真实渲染、无裂图、无乱码、无布局崩坏）

## 验收后补验（2026-08-12，用户驱动的盲区核查）

**触发**：用户质疑 P6 截图只覆盖了 README.md / 报告附件.txt 的点击，未逐一点击各图片文件。主 Agent 用 Playwright CDP 实跑补验（脚本 + 截图存 `P6-evidence/screenshots/verify/`）。

**补验结果**：

| 验证项 | 结果 | 证据 |
|--------|------|------|
| markdown 内联渲染（full-page） | ✅ 5 张图（中文/日文/重音/空格/英文）全部渲染，无裂图 | `verify/full-page.png`（vision 确认） |
| 文件树文件名显示 | ✅ 8 个文件名全部正确显示（含 概要図.png / 中文图片.png / café.png / report final.png，无乱码） | `verify/full-page.png` |
| 点击 `café.png` / `report final.png` | ✅ 正常渲染（绿色/橙色方块） | `verify/click-caf__png.png` / `verify/click-report_final_png.png` |
| 点击 `中文图片.png` / `概要図.png` | ❌ **"图片加载失败"**（后端 500） | `verify/click-中文图片_png.png` / `verify/click-概要図_png.png`（vision 确认错误提示） |

**根因（已确认，非 TPV0089 引入）**：后端 `download_file`（`files.py:204-208`）的 `Content-Disposition` header 直接放原始中文/日文文件名，HTTP header 必须 latin-1 可编码 → `UnicodeEncodeError` → 500。前端 `getFileAsBase64`/`downloadFile` 走该端点（不带 `/content`）。`é`（café.png）在 latin-1 范围内所以正常。**已立项 TPV0091 修复**。

**对 BDD 结论的影响**：无——P1 BDD-10/12 验证的是"markdown 正文引用的图片渲染"（走 `/content` 端点，PASS 结论不变）；点击文件树图片是独立用户路径，暴露的是相邻 bug（TPV0091），不属于 TPV0089 的 BDD 范围。

## Summary

**Summary**: 13/13 PASS, 0 FAIL（单元级 BDD-1~9 51/51，端到端 BDD-10~13 12/12 E2E + CDP 精确断言 + vision blocker_count=0；验收后补验发现相邻 bug 已立项 TPV0091）

[PROD_NOT_TOUCHED]
