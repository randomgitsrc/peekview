# P2-progress — architect

## 读取输入文件

- [x] P2-dispatch-context-architect.md — 派发指引：候选 A/B/C、5 个关键设计问题、minimal_validation 必做（RFC 5987 浏览器解析行为）
- [x] architect.md 角色文件 — P2 产出=方案设计+实现导航；minimal_validation 强制；files_to_read 精挑控制 P4 上下文
- [x] P1-requirements.md — 8 BDD；A 单独满足全部 BDD 的推论；SUGGEST：read tracking 口径变化由 P2 知悉
- [x] P1-review.md — O1：BDD-7 按现有断言范围（200+无\r\n），不按字面加引号断言；O2：BDD-5 suggestedFilename 是 P6 唯一浏览器解析点
- [x] P0-brief.md — env_constraints（debug :8888 隔离）；known_risks「组合最优」倾向
- [x] backend/peekview/api/files.py — download_file(169-208) 根因；get_file_content(211-253)；_sanitize_filename(62-70)；entries.py:468 ZIP 复用 _sanitize_filename（勿改其行为）
- [x] frontend-v3/src/api/client.ts — getFileAsBase64(160-171) GET /files/{id}；downloadFile(173) 死代码；getFileContent(152-158) 已走 /content
- [x] frontend-v3/src/components/ImageViewer.vue — loadImage(108-127) getFileAsBase64；data-testid 全套已存在（image-content/image-error/image-loading/manual-render-btn/size-warning）
- [x] backend/tests/test_security.py:573-645 — 净化断言仅 200 + 无 \r\n
- [x] backend/tests/test_api.py:149-196 — TestFileDownload/TestFileContentEndpoint 现有模式（client fixture 匿名创建）
- [x] frontend-v3/src/components/__tests__/ImageViewer.spec.ts — mock api.getFileAsBase64，不断言 URL → 改端点零影响
- [x] frontend-v3/e2e/unicode-filename-link.spec.ts — TPV0089 内联渲染路径（/content）基线；文件树点击模式 `.file-tree .file-name` hasText
- [x] conftest.py — client fixture ASGITransport；isolate_config_file autouse 隔离

## minimal_validation（实测）

1. **RFC 5987 header 构造**（python3 模拟）：`quote(name, safe='')` → `filename*=UTF-8''...` 值全 percent-encode（`%`+hex+unreserved 均在 attr-char 允许集），latin-1 encode 通过，unquote 往返==原名 ✓
2. **filename vs filename* 优先级**（MDN 查证）：两者同时存在时浏览器优先 filename*；官方建议同时提供，fallback 用非 ASCII→ASCII 替代（é→e 类）✓
3. **净化+编码顺序**：必须先 `_sanitize_filename`（去 `"` `;` `\r\n`）再 quote——否则注入字符会出现在 filename* 值里（实测 `file"; injection` → 净化后 `file injection=true`，编码后无注入）✓
4. **/content 端点图片**（curl :8888 实测）：41/43 → 200 image/png，PNG 签名 89504e47... 正确 ✓
5. **download 与 /content 内容同源**（读代码）：两端点共用 service.read_file_content ✓（BDD-4 内容一致断言成立）
6. **ASCII 名不回归**：ASCII 分支保持现格式 `attachment; filename="..."` 字节级不变 ✓（BDD-6）

# P2-progress — plan-design-review

## 读取输入文件

- [x] P2-dispatch-context-plan-design-review.md — 评审重点 6 项 + 约束 + 产出规格
- [x] plan-design-review.md 角色文件 — 5 评分维度 + status 映射
- [x] P2-design.md — 候选 A/B/C 权衡 + 选定 C（后端 RFC 5987 + 前端 /content）+ 四字段 + minimal_validation
- [x] P1-requirements.md — 8 BDD 基线；SUGGEST read tracking 口径
- [x] P1-review.md — O1/O2 观察项
- [x] backend/peekview/api/files.py — download_file 169-208 / get_file_content 211-253 / _sanitize_filename 62-70
- [x] frontend-v3/src/api/client.ts — getFileAsBase64 160-171 / getFileContent 152-158 / downloadFile 173
- [x] frontend-v3/src/components/ImageViewer.vue — loadImage 108-127 / testid 全套
- [x] frontend-v3/src/components/__tests__/ImageViewer.spec.ts — 12 条用例全 mock getFileAsBase64，不断言 URL
- [x] P0-brief.md — known_risks「组合最优」；env_constraints
- [x] backend/tests/test_security.py:573-645 / test_api.py:149-196 — 现有断言范围
- [x] scripts/seed-data/unicode-filenames/meta.json — is_public:true，owner alice
- [x] frontend-v3/e2e/unicode-filename-link.spec.ts + png-download.spec.ts — 现有 e2e 模式（download 事件 waitForEvent）

## 独立复核

- RFC 5987 header 构造（python3 实测）：中文/日文/café/injection 名 → latin-1 encode 全通过；unquote 往返==原名；注入字符净化先于编码 ✓
- MDN 原文核验：filename* 优先于 filename；官方建议同时提供；fallback 用 ASCII 替代 ✓
- seed 文件 id 41/42/43 与 P1 表一致（curl /raw 实测）✓
- download 与 /content 共用 read_file_content（files.py:185/231）→ BDD-4 内容一致断言成立 ✓
