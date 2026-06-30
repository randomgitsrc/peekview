---
phase: P6
task_id: T040-shiki-language-coverage
type: acceptance
parent: P4-implementation/implementation.md
trace_id: T040-P6-20260630
status: draft
created: 2026-06-30
---

## BDD 验收结果

- PASS B01: C# 文件（动态加载语言）在详情页正确语法高亮
- PASS B02: Ruby 文件（动态加载语言）在详情页正确语法高亮
- PASS B03: Python 文件（静态语言基线）在详情页正确语法高亮
- PASS B04: Entry API 返回正确的文件信息
- PASS B05: Wolfram 语言文件（后端 ID 对齐 mathematica→wolfram）正确语法高亮
- PASS B06: LANG_IMPORT_MAP 包含 62 种动态语言
- PASS B07: LEGACY_LANG_MAP 将 mathematica 映射到 wolfram
- PASS B08: LEGACY_LANG_MAP 将 registry 映射到 reg
- PASS B09: 首屏 16 种静态语言加载不受影响

## 证据

- Playwright 截图：/tmp/t040-csharp.png, /tmp/t040-wolfram.png
- 后端测试：56 passed (test_language.py)
- 前端测试：624 passed / 1 skipped
