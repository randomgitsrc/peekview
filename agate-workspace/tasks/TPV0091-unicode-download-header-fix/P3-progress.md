# TPV0091 P3 progress（test-designer）

## 2026-08-13

- [x] 读取 P3-dispatch-context-test-designer.md（目标/约束/输入文件/红灯要求）
- [x] 读取 test-designer.md 角色定义（BDD 1:1 映射、UI 任务须 E2E、测试名引用 BDD 编号）
- [x] 读取 P2-design.md：选候选 C（后端 RFC 5987 `_build_content_disposition` + 前端 getFileAsBase64 URL→/content）；BDD-7 按 test_security.py 现有断言范围（O1）
- [x] 读取 P1-requirements.md：8 条 BDD；根因 = latin-1 强制编码 UnicodeEncodeError；api.downloadFile 死代码
- [x] 读取 P1-review.md：O1（BDD-7 不新增引号断言，按 test_security.py:604-608 范围）
- [x] 读取 P2-review.md：3 观察（F841 safe_name 属 P4 / café.png 需补断言（obs ②）/ e2e 命名用 tpv0091- 前缀（obs ③））
- [x] 读取 backend/peekview/api/files.py：_sanitize_filename(62-70)、download_file(169-208) 现 `filename="{safe_name}"`、get_file_content(211-253) 无 Content-Disposition
- [x] 读取 backend/tests/test_api.py：TestFileDownload(176-196) 模式（client fixture 匿名创建 + download 断言）；TestFileContentEndpoint
- [x] 读取 backend/tests/test_security.py:573-645：TestFilenameSanitization 断言范围 = 200 + 无 \r\n
- [x] 读取 frontend-v3/src/api/client.ts：getFileAsBase64(160-171) 现 URL /files/{fileId}；getFileContent 已 /content；downloadFile(173) 死代码
- [x] 读取 frontend-v3/src/components/ImageViewer.vue：image-content(54)/image-error(43) testid；loadImage 调 getFileAsBase64
- [x] 读取 frontend-v3/e2e/unicode-filename-link.spec.ts（TPV0089 模式：viewport describe + evidences + /content 正则）与 t091 spec
- [x] 读取 frontend-v3/playwright.config.ts：testDir ./e2e；desktop + Mobile Chrome projects
- [x] 读取 TreeNodeItem.vue / EntryDetailView.vue：`.file-tree .file-name` 选择器；desktop 多文件自动展开 file tree
- [x] 确认 seed data（scripts/seed-data/unicode-filenames/）8 文件；API 支持 content_base64（test_raw_api.py minimal_png 模式）
- [x] 设计测试用例 → P3-test-cases.md
- [ ] 写后端测试代码（test_api.py TestFileDownload 追加）
- [ ] 写前端 e2e spec（tpv0091-unicode-preview-download.spec.ts 新建）
- [ ] 跑后端新用例确认红灯
- [x] 产出 P3-test-cases.md（8/8 BDD 映射；test_code_dir 声明 backend/tests/test_api.py + frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts）
- [x] 后端测试代码写入 test_api.py：新增 _minimal_png/_FILENAME_STAR_RE/imports + TestFileDownload 3 个新测试（TC-B1 parametrize 中文/日文、TC-B2 café、TC-B3 ASCII 守卫）
- [x] 前端 e2e spec 新建（tpv0091- 前缀）：TC-F1 desktop+mobile、TC-F2、TC-F3、TC-F5、TC-F8
- [x] 后端红灯确认：pytest tests/test_api.py::TestFileDownload → EXIT_CODE=1
      - test_bdd_4_5_unicode_filename_download[中文图片.png/概要図.png]：UnicodeEncodeError latin-1（500 根因）→ B 类红 ✓
      - test_bdd_6_latin1_filename_download_header_valid：无 filename* 断言失败 → B 类红 ✓
      - test_bdd_6_ascii_filename_header_format_unchanged：绿（回归守卫，符合设计）
      - 注：首版用 path 创建导致 filename="untitled"，已改为显式 filename 字段
- [x] ruff check tests/test_api.py → 通过
- [x] 全量 test_api.py → 仅 3 个新用例失败，无既有用例破坏
- [x] e2e spec 语法/类型验证：npx tsc --noEmit（targeted）→ EXIT 0
