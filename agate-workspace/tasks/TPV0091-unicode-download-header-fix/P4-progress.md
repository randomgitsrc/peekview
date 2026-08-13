# P4 Progress — TPV0091-unicode-download-header-fix

- [x] 读取 P4-dispatch-context-implementer.md（派发指引：目标=候选 C、实现规格 §2、约束=只改两个文件）
- [x] 读取 implementer.md 角色定义（最小实现、DESIGN_GAP/SCOPE+ 上报、自查≠gate）
- [x] 读取 P2-design.md（§2 方案：_build_content_disposition RFC 5987 + client.ts getFileAsBase64 URL→/content；§7 实现完成标志）
- [x] 读取 P3-test-cases.md（TC-B1 中文/日文 download 200+filename*+unquote、TC-B2 café filename*、TC-B3 ASCII 字节级不变、TC-B4 净化复用）
- [x] 读取 backend/peekview/api/files.py（_sanitize_filename :62-70、download_file :169-208、get_file_content :211-253 不动）
- [x] 读取 frontend-v3/src/api/client.ts（getFileAsBase64 :160-171、getFileContent :152-158、downloadFile :173 死代码保留）
- [x] 读取 backend/tests/test_api.py（TestFileDownload :190-285 新用例断言：_FILENAME_STAR_RE + unquote + 响应体一致 + ASCII 格式守卫）
- [x] 读取 backend/tests/test_security.py（TestFilenameSanitization :573-613 断言范围=200+无 \r\n，净化顺序不回归）
- [x] 读取 AGENTS.md（铁律：不加注释、lint/typecheck 强制、pytest 用 venv）
- [x] 实现 backend/peekview/api/files.py：import quote + _build_content_disposition helper + download_file 使用 + 删除 safe_name（防 F841）
- [x] 实现 frontend-v3/src/api/client.ts：getFileAsBase64 URL → /entries/{slug}/files/{fileId}/content（downloadFile 死代码保留）
- [x] 自测：TestFileDownload 5 passed / test_security.py 全绿 / ruff All checks passed / typecheck passed
- [x] 写 P4-implementation.md（implementation_dir + 改动清单 + 自测结果；无 SCOPE+/DESIGN_GAP）

## Review (backend) — 只读评审

- [x] 读 P4-dispatch-context-review-backend.md（评审重点 5 项 + 约束）
- [x] 读 review.md 角色定义（Pass 1 CRITICAL / Pass 2 INFORMATIONAL）
- [x] 读 backend/peekview/api/files.py（:74-80 helper、:213-216 download_file 使用、:63-71 _sanitize_filename 未改）
- [x] 读 P2-design.md（§2.1 规格逐行比对：safe.isascii / fallback `_` / quote(safe, safe="")）
- [x] 读 P3-test-cases.md（TC-B1/B2/B3/B4 断言范围）
- [x] 读 backend/tests/test_api.py TestFileDownload（:190-285 新用例 + :24 _FILENAME_STAR_RE）
- [x] 读 backend/tests/test_security.py TestFilenameSanitization（:573-613，断言=200+无 \r\n）
- [x] 读 entries.py:455-489（ZIP 复用 _sanitize_filename 未动）
- [x] 实测：TestFileDownload+ContentEndpoint 6 passed；test_security 11 passed 1 skip；helper 边界用例（中文/日文/café/注入/空名/超长）latin-1 全通过；ruff All checks passed
- [x] 写 P4-review-backend.md
- [x] [design-review] 读取 P4-dispatch-context-design-review-frontend.md（评审重点 5 项：正确性/交互状态/回归/组件完整性/移动端+a11y）
- [x] [design-review] 读取 design-review.md 角色定义（只审不写、门槛 status 映射、引用锚点）
- [x] [design-review] 读取 frontend-v3/src/api/client.ts（getFileAsBase64 :160-164 走 /content，downloadFile :173 死代码保留）
- [x] [design-review] 读取 ImageViewer.vue（loadImage :108-127 用 guessMimeType(filename) 构造 data URI，不依赖响应 content-type）
- [x] [design-review] 读取 ImageViewer.spec.ts（mock api.getFileAsBase64 全对象替换，11 用例零 URL 断言）
- [x] [design-review] 读取 P2-design.md §2.2（URL 变更规格）+ P3-test-cases.md（TC-F1/2/3/5/8）
- [x] [design-review] 读取 e2e/tpv0091-unicode-preview-download.spec.ts（选择器与断言与 P3 一致，BDD-8 断言 /content 路径）
- [x] [design-review] 读取 P1-requirements.md（BDD-1/2/3 判定=image-content visible + image-error 缺席）
- [x] [design-review] git diff 核验 client.ts 单行变更（/files/{id} → /files/{id}/content）
- [x] [design-review] 独立 curl 实测 debug :8888：/content 对中文图片.png(fileId 41) 返回 200 image/png + 合法 PNG 签名 89504e47 0d0a1a0a
- [x] [design-review] 写 P4-review-frontend.md（5 项全 PASS，无 BLOCKER/CRITICAL，status: approved）

- [x] [review-lead] 读取 dispatch-context + 两个专家评审 + P4-implementation.md
- [x] [review-lead] 锚点真实性复核（files.py/client.ts/ImageViewer.vue/mime.ts/specs/e2e 全部核实存在）
- [x] [review-lead] 汇总写 P4-review.md（status: approved，无 BLOCKER，无分歧）
