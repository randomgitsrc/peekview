---
phase: P6
task_id: T037-search-content-expansion
type: acceptance
parent: P4-implementation/implementation.md
trace_id: T037-P6-20260630
status: draft
created: 2026-06-30
---

## BDD 验收结果

- PASS B01: 搜索文件内容（unique marker）能找到对应 entry
- PASS B02: 搜索 summary 仍然正常
- PASS B03: 搜索 tags 仍然正常
- PASS B04: 二进制文件内容不进入搜索索引
- PASS B05: 前端搜索 placeholder 显示"搜索标题、标签和文件内容..."
- PASS B06: 前端搜索文件内容能返回正确结果
- PASS B07: FTS5 索引扩展后回填已有 entry 成功
- PASS B08: 大文件内容截断索引正常

## 证据

- Playwright 实跑验证：6/6 PASS
- 后端测试：741 passed（含 21 个 FTS content 测试）
- 前端测试：624 passed / 1 skipped
