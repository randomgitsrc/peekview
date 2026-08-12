---
phase: P6
task_id: T047
task_name: content-link-fix
type: acceptance
parent: P1-requirements.md
trace_id: T047-P6-20260705
status: draft
created: 2026-07-05
agent: verifier
---

# T047 P6 验收报告

## 验收环境

- Debug Backend: http://127.0.0.1:8888 (version 0.5.2)
- Test Entry: t047-acceptance (10 files)
- 验收顺序: 先验功能（AC-1~AC-6 后端 Content-Type → AC-12 单元测试 → AC-7/AC-8 前端测试 → AC-9~AC-14 E2E 验证），再凑格式

## BDD 验收结果

- PASS B01 (AC-1): PNG 文件 Content-Type 为 image/png — curl 验证 /content 端点返回 content-type: image/png (content-type-verification.log)
- PASS B02 (AC-2): JPEG 文件 Content-Type 为 image/jpeg — curl 验证 /content 端点返回 content-type: image/jpeg (content-type-verification.log)
- PASS B03 (AC-3): SVG 文件 Content-Type 为 image/svg+xml — curl 验证 /content 端点返回 content-type: image/svg+xml (content-type-verification.log)
- PASS B04 (AC-4): 未知二进制文件 Content-Type 为 application/octet-stream — curl 验证 data.bin 返回 content-type: application/octet-stream (content-type-verification.log)
- PASS B05 (AC-5): Python 文件 Content-Type 不受影响 — curl 验证 main.py 返回 content-type: text/x-python; charset=utf-8，与修复前一致 (content-type-verification.log)
- PASS B06 (AC-6): CSS 文件 Content-Type 使用 _LANGUAGE_TO_MIME 映射 — curl 验证 style.css 返回 content-type: text/css; charset=utf-8 (content-type-verification.log)
- PASS B07 (AC-7): path-map.ts 单元测试 38/38 全绿 — vitest run src/utils/path-map.test.ts 结果: 38 passed (test-output.log)
- PASS B08 (AC-8): useMarkdown.ts 恢复后与 T045 代码兼容 — npx vue-tsc --noEmit 无错误 (test-output.log)
- PASS B09 (AC-9): Markdown 图片端到端渲染 — Playwright 验证: img src=/api/v1/entries/t047-acceptance/files/2/content, naturalWidth=200, 图片可见 (screenshots/ac13-entry-page.png) (vision: vision-report-ac13.yaml)
- PASS B10 (AC-10): Markdown 链接端到端重写 — Playwright 验证: link href=/t047-acceptance?file=5, data-peekview-file-id=5, 点击后文件树切换到 guide.md (screenshots/ac13-entry-page.png)
- PASS B11 (AC-11): 同名文件 basename fallback 正确 — [utils](src/utils.py)→file=9, [test utils](test/utils.py)→file=10 精确匹配; [ambiguous](utils.py) 因 basename 冲突未被重写，符合 pathMap 删除冲突 key 的设计 (test-output.log)
- PASS B12 (AC-12): _determine_content_type 单元测试覆盖三级 fallback — pytest 23/23 passed，覆盖 level1(_language_to_content_type) + level2(_LANGUAGE_TO_MIME) + level3(mimetypes.guess_type) + level4(octet-stream) (test-output.log)
- PASS B13 (AC-13): 真实尺寸图片 + vision-helper 确认图片可见 — 200x150 PNG 图片, vision-helper 报告: "blue outer rectangle with yellow/orange inner box labeled TEST visible. No broken image icon." blocker_count=0 (screenshots/ac13-entry-page.png) (vision: vision-report-ac13.yaml)
- PASS B14 (AC-14): 网络请求 Content-Type 为 image/png — Playwright 监控网络请求: /files/2/content → Content-Type: image/png (非 text/plain) (test-output.log)

## 验收总结

- 总计: 14/14 PASS
- FAIL count: 0
- NEED_CONFIRM: 0

## IR-4 合规声明

P6 验收严格遵循"先验功能再凑格式"顺序：
1. 后端 Content-Type 功能验证（AC-1~AC-6）先于格式编排
2. vision-helper 确认图片可见（AC-13）先于报告撰写
3. 网络请求 Content-Type 检查（AC-14）作为独立验证项
4. 所有 BDD 实际运行后才写 P6-acceptance.md

## IR-7 合规声明

vision-helper 报告图片可见、无异常。若报告异常，第一反应是 curl -I 检查 Content-Type（实际已在 AC-1~AC-6 步骤中先行验证）。
