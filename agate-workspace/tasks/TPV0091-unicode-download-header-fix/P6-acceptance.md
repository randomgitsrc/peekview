---
phase: P6
task_id: TPV0091-unicode-download-header-fix
type: acceptance
parent: P5-test-results
trace_id: TPV0091-P6-20260813
status: draft
created: 2026-08-13
agent: verifier
# ── v2.0 机器汇总 ──
pass: 8
fail: 0
ui_affected: true
---

# P6 验收报告 — 中文/日文文件名下载与图片预览 500 修复

## 验收环境

- debug backend `http://127.0.0.1:8888`（P4 新代码已加载，curl 实测 41/43 download 200 + filename*）
- seed entry `unicode-filenames`（public，8 文件 id 36-43）
- Playwright CDP `127.0.0.1:18800`（Chrome 151）
- **:8080 生产未运行（curl 000），全程未触碰；`~/.peekview/` 未触碰**

## BDD 逐条验收

### 图片预览（UI）

- PASS BDD-1: 中文图片.png 点击后正常显示——image-content visible、error_count=0、naturalWidth=32、opacity=1；vision 确认红色测试图居中渲染、无破图/错误文案 (screenshots/bdd1-chinese-image.png) (vision: P6-evidence/vision-reports/bdd1.yaml)
- PASS BDD-2: 概要図.png（日文）点击后正常显示——image-content visible、error_count=0、naturalWidth=32；vision 确认蓝色测试图渲染、文件树高亮选中 概要図.png、无破图 (screenshots/bdd2-japanese-image.png) (vision: P6-evidence/vision-reports/bdd2.yaml)
- PASS BDD-3: café.png / report final.png / arch.png 依次点击均正常显示——三张 error_count=0、naturalWidth=32；vision 确认当前 arch.png 紫色测试图渲染、无破图 (screenshots/bdd3-latin1-space-ascii.png) (vision: P6-evidence/vision-reports/bdd3.yaml)

### 下载端点（curl / Playwright）

- PASS BDD-4: 41/42/43 download 全部 200，且响应体与 /content 端点 IDENTICAL（不再是 500）(bdd4-5-6-curl.log)
- PASS BDD-5: Content-Disposition 含 `filename*=UTF-8''...`，python unquote 往返 == 原始中文/日文文件名（3/3 PASS）；Playwright download.suggestedFilename()==中文图片.png (bdd4-5-6-curl.log, p6-ui.log)
- PASS BDD-6: 36/38/39/40/37 download 全 200 + Content-Disposition 有效（ASCII 名保持原格式字节级；café 走 filename* 分支正确）(bdd4-5-6-curl.log)
- PASS BDD-7: test_security.py 净化用例保持绿——38 passed, 1 skipped, PYTEST_EXIT=0（TestFilenameSanitization::test_filename_header_injection_blocked 覆盖 引号/分号/换行 注入）(bdd7-security-pytest.log)

### markdown 内联渲染

- PASS BDD-8: README 5 张内联图片全部正常渲染——.markdown-body img count=5，src 全部走 `/content`（41/43/38/40/37），naturalWidth>0；vision 确认 5 张彩色测试图分别渲染于 5 个标题下、无破图 (screenshots/bdd8-markdown-inline.png) (vision: P6-evidence/vision-reports/bdd8.yaml)

## vision 汇总

| 截图 | blocker_count | 结论 |
|------|---------------|------|
| bdd1-chinese-image.png | 0 | 中文图预览正常 |
| bdd2-japanese-image.png | 0 | 日文图预览正常 |
| bdd3-latin1-space-ascii.png | 0 | latin-1/空格/ASCII 无回归 |
| bdd8-markdown-inline.png | 0 | 5 图内联渲染正常 |

所有 vision blocker_count=0，无异常需追查。

## 证据清单

- `P6-evidence/screenshots/`：bdd1/bdd2/bdd3/bdd8（4 张，md5 互不相同，均 >1KB）
- `P6-evidence/vision-reports/`：bdd1/bdd2/bdd3/bdd8.yaml（blocker_count 全 0）
- `P6-evidence/bdd4-5-6-curl.log`（curl 断言含实际 header/状态码输出）
- `P6-evidence/p6-ui.log`（Playwright 断言含 naturalWidth/error_count/suggestedFilename）
- `P6-evidence/bdd7-security-pytest.log`（pytest 实跑输出，含 EXIT_CODE: 0）

## 总结

**Summary**: 8/8 PASS, 0 FAIL。BDD-4/5/6/7 后端 download 端点（200 + RFC 5987 header + 净化）实跑通过；BDD-1/2/3/8 UI 行为实跑点击 + 截图 + vision 全部正常。

[PROD_NOT_TOUCHED] — 全程仅操作 debug :8888；:8080 未运行未启动；`~/.peekview/` 未被读取/写入。
