---
phase: P3
task_id: T047
task_name: content-link-fix
type: test-cases
parent: P2-design.md
trace_id: T047-P3-20260705
status: draft
created: 2026-07-05
agent: test-designer
---

# T047 测试用例

## 测试文件清单

| 文件 | 类型 | 测试数 | 覆盖 BDD |
|------|------|--------|----------|
| `P3-test-code/test_content_type.py` | 后端 pytest | 14 | AC-1~AC-6, AC-12 |
| `P3-test-code/path-map.test.ts` | 前端 vitest | 38 | AC-7, AC-11 |

AC-8 (vue-tsc 兼容)、AC-9 (端到端图片渲染)、AC-10 (端到端链接重写)、AC-13 (vision-helper)、AC-14 (网络请求 Content-Type) 属于 P5/P6 验收范围，不在 P3 单元测试覆盖。

## 后端测试：test_content_type.py

### 单元测试：`_determine_content_type` 函数

| TC# | 名称 | BDD | 输入 | 预期输出 |
|-----|------|-----|------|---------|
| TC-DCT-01 | PNG 二进制文件 → image/png | AC-1 | `File(path="arch.png", filename="arch.png", language=None, is_binary=True)` | `"image/png"` |
| TC-DCT-02 | JPEG 二进制文件 → image/jpeg | AC-2 | `File(path="photo.jpg", filename="photo.jpg", language=None, is_binary=True)` | `"image/jpeg"` |
| TC-DCT-03 | SVG 文件 → image/svg+xml | AC-3 | `File(path="diagram.svg", filename="diagram.svg", language=None, is_binary=False)` | `"image/svg+xml"` |
| TC-DCT-04 | 未知二进制文件 → application/octet-stream | AC-4 | `File(path="data.bin", filename="data.bin", language=None, is_binary=True)` | `"application/octet-stream"` |
| TC-DCT-05 | Python 文本文件 → text/x-python (不变) | AC-5 | `File(path="main.py", filename="main.py", language="python", is_binary=False)` | `"text/x-python"` |
| TC-DCT-06 | CSS 文本文件 → text/css (走 _language_to_content_type) | AC-6 | `File(path="style.css", filename="style.css", language="css", is_binary=False)` | `"text/css"` |
| TC-DCT-07 | JavaScript 文本文件 → text/javascript | AC-6 | `File(path="app.js", filename="app.js", language="javascript", is_binary=False)` | `"text/javascript"` |
| TC-DCT-08 | GIF 二进制文件 → image/gif | AC-1 扩展 | `File(path="anim.gif", filename="anim.gif", language=None, is_binary=True)` | `"image/gif"` |
| TC-DCT-09 | WebP 二进制文件 → image/webp | AC-1 扩展 | `File(path="img.webp", filename="img.webp", language=None, is_binary=True)` | `"image/webp"` |
| TC-DCT-10 | PDF 二进制文件 → application/pdf | AC-4 扩展 | `File(path="doc.pdf", filename="doc.pdf", language=None, is_binary=True)` | `"application/pdf"` |
| TC-DCT-11 | SVG language=xml → text/xml (文本路径) | AC-3 边界 | `File(path="diagram.svg", filename="diagram.svg", language="xml", is_binary=False)` | `"text/xml"` |
| TC-DCT-12 | null path + filename fallback | AC-4 边界 | `File(path=None, filename="photo.jpg", language=None, is_binary=True)` | `"image/jpeg"` |
| TC-DCT-13 | language 不在 _TYPE_MAP 但在 _LANGUAGE_TO_MIME | AC-6 扩展 | `File(path="data.json", filename="data.json", language="json", is_binary=False)` | `"application/json"` |
| TC-DCT-14 | 三级 fallback 全覆盖 (AC-12) | AC-12 | 分别测试: (1) _language_to_content_type 命中, (2) _LANGUAGE_TO_MIME 命中, (3) mimetypes.guess_type 命中, (4) fallback octet-stream | 四条路径各返回正确值 |

### 集成测试：`/content` 端点

| TC# | 名称 | BDD | 方法 | 预期 |
|-----|------|-----|------|------|
| TC-EP-01 | PNG /content → Content-Type: image/png | AC-1 | 创建 entry + PNG file, GET /content | `Content-Type: image/png` |
| TC-EP-02 | JPEG /content → Content-Type: image/jpeg | AC-2 | 创建 entry + JPEG file, GET /content | `Content-Type: image/jpeg` |
| TC-EP-03 | SVG /content → Content-Type: image/svg+xml | AC-3 | 创建 entry + SVG file, GET /content | `Content-Type: image/svg+xml` |
| TC-EP-04 | .bin /content → Content-Type: application/octet-stream | AC-4 | 创建 entry + .bin file, GET /content | `Content-Type: application/octet-stream` |
| TC-EP-05 | .py /content → Content-Type: text/x-python (不变) | AC-5 | 创建 entry + .py file, GET /content | `Content-Type: text/x-python` |
| TC-EP-06 | .css /content → Content-Type: text/css | AC-6 | 创建 entry + .css file, GET /content | `Content-Type: text/css` |

## 前端测试：path-map.test.ts

从 T046 P4-code-diff.patch 恢复 38 个测试，覆盖 AC-7 和 AC-11。

### buildPathMap (10 个)

| TC# | 名称 | BDD | 输入 | 预期 |
|-----|------|-----|------|------|
| TC-BPM-01 | 单文件 path → 精确匹配 priority=1 | AC-7 | `[{id:3, path:'images/arch.png', filename:'arch.png'}]` | `map.get('images/arch.png') = {fileId:3, priority:1}` |
| TC-BPM-02 | filename 匹配 priority=2 | AC-7 | `[{id:5, path:null, filename:'photo.png'}]` | `map.get('photo.png') = {fileId:5, priority:2}` |
| TC-BPM-03 | basename 从 path 提取 | AC-7 | `[{id:7, path:'/tmp/screenshot.png', filename:'screenshot.png'}]` | `map.get('screenshot.png')` 定义 |
| TC-BPM-04 | 同名冲突 → key 删除 | AC-11 | `[{id:1, path:'src/utils.py', filename:'utils.py'}, {id:2, path:'test/utils.py', filename:'utils.py'}]` | `map.has('utils.py') = false` |
| TC-BPM-05 | 低 priority 覆盖高 priority | AC-7 | `[{id:10, path:null, filename:'logo.svg'}, {id:11, path:'assets/logo.svg', filename:'logo.svg'}]` | `map.get('assets/logo.svg') = {fileId:11, priority:1}` |
| TC-BPM-06 | `./` 前缀剥离 | AC-7 | `[{id:3, path:'./images/logo.png', filename:'logo.png'}]` | `map.get('images/logo.png')` 定义 |
| TC-BPM-07 | 空文件列表 → 空 Map | AC-7 | `[]` | `map.size = 0` |
| TC-BPM-08 | 外部 URL path 不入 map | AC-7 | `[{id:1, path:'https://cdn.example.com/img.png', filename:'img.png'}, ...]` | 无 https:// key |
| TC-BPM-09 | null path 仅用 filename | AC-7 | `[{id:5, path:null, filename:'README.md'}]` | `map.get('README.md') = {fileId:5, priority:2}` |
| TC-BPM-10 | 绝对路径提取 basename | AC-7 | `[{id:7, path:'/tmp/screenshot.png', filename:'screenshot.png'}]` | 无 `/tmp/screenshot.png` key |

### normalizeRef (18 个)

| TC# | 名称 | BDD | 输入 | 预期 |
|-----|------|-----|------|------|
| TC-NR-01 | API 路径 → null | AC-7 | `'/api/v1/entries/abc/files/3/content'` | `null` |
| TC-NR-02 | https:// → null | AC-7 | `'https://cdn.example.com/img.png'` | `null` |
| TC-NR-03 | http:// → null | AC-7 | `'http://example.com/file.md'` | `null` |
| TC-NR-04 | data: URI → null | AC-7 | `'data:image/png;base64,iVBOR...'` | `null` |
| TC-NR-05 | blob: URI → null | AC-7 | `'blob:https://example.com/uuid'` | `null` |
| TC-NR-06 | # 锚点 → null | AC-7 | `'#intro'` | `null` |
| TC-NR-07 | mailto: → null | AC-7 | `'mailto:user@example.com'` | `null` |
| TC-NR-08 | tel: → null | AC-7 | `'tel:+1234567890'` | `null` |
| TC-NR-09 | 协议相对 // → null | AC-7 | `'//cdn.example.com/script.js'` | `null` |
| TC-NR-10 | `./` 前缀剥离 | AC-7 | `'./images/logo.png'` | `'images/logo.png'` |
| TC-NR-11 | 相对路径不变 | AC-7 | `'images/logo.png'` | `'images/logo.png'` |
| TC-NR-12 | `../` 保留 | AC-7 | `'../parent/file.md'` | `'../parent/file.md'` |
| TC-NR-13 | 多重 `./` 剥离 | AC-7 | `'./././images/logo.png'` | `'images/logo.png'` |
| TC-NR-14 | 绝对路径 → basename | AC-7 | `'/tmp/screenshot.png'` | `'screenshot.png'` |
| TC-NR-15 | 空字符串 → null | AC-7 | `''` | `null` |
| TC-NR-16 | 纯空白 → null | AC-7 | `'   '`` | `null` |
| TC-NR-17 | 前后空白 trim | AC-7 | `'  images/logo.png  '` | `'images/logo.png'` |
| TC-NR-18 | 仅 `./` → null | AC-7 | `'./'` | `null` |

### resolvePath (10 个)

| TC# | 名称 | BDD | 输入 | 预期 |
|-----|------|-----|------|------|
| TC-RP-01 | 精确 path 匹配 → fileId | AC-7 | `'images/arch.png'` | `3` |
| TC-RP-02 | filename 匹配 → fileId | AC-7 | `'main.py'` | `10` |
| TC-RP-03 | 不在 map → null | AC-7 | `'nonexistent.file'` | `null` |
| TC-RP-04 | 精确 path 优先于 basename | AC-7 | `'images/arch.png'` vs `'arch.png'` | 精确返回 3, basename 返回 99 |
| TC-RP-05 | 外部 URL → null | AC-7 | `'https://cdn.example.com/img.png'` | `null` |
| TC-RP-06 | 锚点 → null | AC-7 | `'#intro'` | `null` |
| TC-RP-07 | `./` 前缀剥离后匹配 | AC-7 | `'./main.py'` | `10` |
| TC-RP-08 | 空 pathMap → null | AC-7 | `'main.py'` + 空 Map | `null` |
| TC-RP-09 | basename fallback | AC-11 | `'some/deep/path/arch.png'` | `3` |
| TC-RP-10 | basename 也不在 map → null | AC-7 | `'some/deep/path/missing.png'` | `null` |

## BDD 覆盖矩阵

| BDD | 测试用例 | 类型 |
|-----|---------|------|
| AC-1 | TC-DCT-01, TC-DCT-08, TC-DCT-09, TC-EP-01 | 单元+集成 |
| AC-2 | TC-DCT-02, TC-EP-02 | 单元+集成 |
| AC-3 | TC-DCT-03, TC-DCT-11, TC-EP-03 | 单元+集成 |
| AC-4 | TC-DCT-04, TC-DCT-10, TC-DCT-12, TC-EP-04 | 单元+集成 |
| AC-5 | TC-DCT-05, TC-EP-05 | 单元+集成 |
| AC-6 | TC-DCT-06, TC-DCT-07, TC-DCT-13, TC-EP-06 | 单元+集成 |
| AC-7 | TC-BPM-01~10, TC-NR-01~18, TC-RP-01~10 (38 个) | 前端单测 |
| AC-8 | P5 vue-tsc 验证 | 集成 |
| AC-9 | P6 Playwright + vision-helper | E2E |
| AC-10 | P6 Playwright 链接点击 | E2E |
| AC-11 | TC-BPM-04, TC-RP-09 | 前端单测 |
| AC-12 | TC-DCT-14 (四级路径覆盖) | 单元 |
| AC-13 | P6 Playwright + vision-helper | E2E |
| AC-14 | P6 Playwright 网络监控 | E2E |

## TDD 红灯预期

- **后端**：`from peekview.api.files import _determine_content_type` → `ImportError`（函数未实现）
- **前端**：`import { buildPathMap, normalizeRef, resolvePath } from './path-map'` → `ModuleNotFoundError`（文件未创建）
