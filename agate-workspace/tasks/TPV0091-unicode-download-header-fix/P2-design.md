---
phase: P2
task_id: TPV0091-unicode-download-header-fix
type: design
parent: P1-requirements.md
trace_id: TPV0091-P2-20260813
status: draft
created: 2026-08-13
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 3
packages: [backend/peekview/api/files.py, backend/tests, frontend-v3/src/api/client.ts, frontend-v3/src/components/ImageViewer.vue]
domains: [backend, frontend]
ui_affected: true
---

# P2 方案设计 — 中文/日文文件名下载与图片预览 500 修复

## 0. 影响域分析

### 改什么

| 文件 | 改动点 |
|------|--------|
| `backend/peekview/api/files.py` | `download_file`（169-208）：`Content-Disposition` header 构建改用 RFC 5987 编码。新增小型 helper `_build_content_disposition(filename)`（放在 `_sanitize_filename` 旁），`download_file` 调用之 |
| `frontend-v3/src/api/client.ts` | `getFileAsBase64`（160-171）：GET 路径 `/entries/{slug}/files/{fileId}` → `/entries/{slug}/files/{fileId}/content`（预览语义修正，一次 URL 变更） |

### 不改什么（边界）

- `_sanitize_filename`（files.py:62-70）行为**不变**——被 `entries.py:468` ZIP download 复用，不能改其语义
- `get_file_content`（files.py:211-253）**完全不动**——`/content` 端点已正确（200 + 正确 content-type + 无 Content-Disposition），BDD-8 markdown 内联渲染依赖它
- `api.downloadFile`（client.ts:173）死代码**保留**（后端修好后其返回 URL 自然可用；死代码清理超出本 bug 范围，YAGNI，P1 SUGGEST 已声明）
- `useEntryDetailComputed.ts:86` blob 下载、`_determine_content_type`、read tracking 记录逻辑、`main.py`、`models.py`、MCP 全部不动
- 无 schema/迁移需求（纯请求处理层改动）

### 风险在哪

- **read tracking 口径变化**：图片预览改走 `/content` 后，预览的 action 从 `download` 变 `read`（语义更正确，但既有统计口径变化）。P1 §4 SUGGEST 已声明由 P2 知悉；现有测试（test_read_tracking_hardening.py）均直接调 API 端点，不走前端预览，**无测试断言旧行为** → 可接受
- **ASCII 名回归**：通过「ASCII 分支保持现有 header 字节级不变」规避（见 §2）
- **注入字符回归**：`_sanitize_filename` 净化顺序在 RFC 5987 编码**之前**，BDD-7 不回归（minimal_validation 已实测）
- **filename\* 不支持的旧浏览器**（2012 年前）：fallback `filename=` 得到 ASCII 替代名（如 `____.png`），远好于 500，可接受

## 1. 候选方案与权衡

### 候选 A — 后端治本（RFC 5987）

`download_file` 的 `Content-Disposition` 用 RFC 5987 `filename*=UTF-8''...` 编码，ASCII fallback 用 `filename=`。

- **实现**：`_build_content_disposition(filename)`：
  1. `safe = _sanitize_filename(filename)`（先净化）
  2. 若 `safe.isascii()` → 保持现格式 `attachment; filename="{safe}"`（**字节级零回归**）
  3. 否则 → `attachment; filename="{ascii_fallback}"; filename*=UTF-8''{quote(safe, safe='')}`，`ascii_fallback` = 非 ASCII 字符替换为 `_`
- **优点**：修复 download 端点本身（agent 读路径 / 直接 URL 下载都受益）；前端零改动；BDD-4/5/6/7 全部满足；read tracking 口径不变
- **缺点**：图片预览仍走 download 端点——语义上「预览」被记为「download」（历史行为缺陷，非本 bug）；预览依赖 download header 编码永远正确

### 候选 B — 前端语义修正（预览走 /content）

`getFileAsBase64` 改用 `/content` 端点（图片 content-type 已实测正确：image/png）。

- **实现**：client.ts:162 一行 URL 变更
- **优点**：预览语义正确（读 ≠ 下载）；read tracking 预览记 `read`；预览与 download header 解耦
- **缺点**：**单独不满足 BDD-4/5/6**——download 端点对中文文件名仍 500，BDD-5 明确要求该端点 header 含 RFC 5987，B 无法满足。**非独立可行方案**（其缺点是真缺陷，非稻草人）

### 候选 C — A+B 组合

后端 RFC 5987 + 前端预览改 `/content`。

- **优点**：全部 8 条 BDD 满足；预览语义正确（记 `read`）；预览与 download 端点解耦（download header 再回归也不影响预览）；P0-brief known_risks 明示「组合最优」
- **缺点**：改动面最大（前后端都动）；read tracking action 口径变化（已被 P1 SUGGEST 预声明可接受）

### 权衡表

| 维度 | A（后端） | B（前端） | C（A+B） |
|------|-----------|-----------|----------|
| BDD-4/5/6/7（download 端点） | ✓ | ✗ 仍 500 | ✓ |
| BDD-1/2/3（图片预览） | ✓（间接） | ✓ | ✓ |
| 预览语义（read 非 download） | ✗ 保持旧缺陷 | ✓ | ✓ |
| 预览与 download 解耦 | ✗ | ✓ | ✓ |
| 改动面 | 后端 1 函数+测试 | 前端 1 行+测试 | 前后端各 1 处 |
| read tracking 口径变化 | 无 | download→read | download→read |
| 回归风险 | 低（ASCII 分支零变化） | 低 | 低（两项叠加） |

### 选择：候选 C

理由：
1. **P0-brief 明示「组合最优」**（known_risks 第 54-57 行），P1 §2 推论「A 单独即可修复预览」不构成否决 C 的理由——A 满足 BDD 但保留「预览被计为下载」的语义错误
2. B 单独失败是真缺陷（BDD-4/5/6 无法满足），C 才是完整组合
3. C 的增量成本极小：前端仅 1 行 URL 变更，且 `ImageViewer.spec.ts` 只 mock `api.getFileAsBase64`（不断言 URL）→ **前端零测试改动**
4. read tracking 口径变化已被 P1 SUGGEST 显式声明可接受，无测试绑定旧行为

**回退预案**：若 P6 发现前端改动引入意外（极不可能，见 minimal_validation），可退回候选 A（后端修复单独已满足全部 8 条 BDD）。

## 2. 选定方案详细设计

### 2.1 后端：RFC 5987 Content-Disposition（files.py）

新增 helper（紧邻 `_sanitize_filename`）：

```python
def _build_content_disposition(filename: str) -> str:
    safe = _sanitize_filename(filename)
    if safe.isascii():
        return f'attachment; filename="{safe}"'
    fallback = "".join(c if ord(c) < 128 else "_" for c in safe)
    encoded = quote(safe, safe="")
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{encoded}'
```

`download_file`（files.py:204-208）替换 header 构建：

```python
return Response(
    content=content,
    media_type="application/octet-stream",
    headers={"Content-Disposition": _build_content_disposition(file_record.filename)},
)
```

设计决策（对应派发上下文「关键设计问题」）：

| 问题 | 决策 | 理由 |
|------|------|------|
| filename\* 与 filename fallback | **两者都保留** | RFC 6266 §5 + MDN：同时存在时浏览器优先 filename\*；官方建议包含两者以最大化兼容 |
| 编码范围 | **仅非 ASCII 名加 filename\*** | ASCII 名保持现有格式字节级不变 → BDD-6 零回归；避免所有 ASCII 下载 header 变动 |
| 注入字符处理 | `_sanitize_filename` 先净化 → `quote(safe, safe='')` 全 percent-encode | 顺序实测验证（minimal_validation #3）；`safe=''` 使 `/` `\` `'` `%` 等全部编码（文件名可能含路径分隔符），值只剩 `%XX`+unreserved（attr-char 安全集） |
| fallback 内容 | 非 ASCII → `_` | MDN 建议「非 ASCII 用 ASCII 等价替换」；latin-1 可编码保证 |
| 净化顺序 | 先 `_sanitize_filename` 再编码 | 实测：不先净化则注入字符（`"` `;`）会进 filename\* 值 |

### 2.2 前端：预览走 /content（client.ts）

`getFileAsBase64`（160-171）URL 变更：

```ts
async getFileAsBase64(slug: string, fileId: number): Promise<string> {
  const response = await this.client.get(
    `/entries/${slug}/files/${fileId}/content`,   // 原: /files/{fileId}
    { responseType: 'arraybuffer' }
  )
  // ... 不变
}
```

- `/content` 对二进制图片返回 200 image/png（curl 实测：41/43 → 200 + PNG 签名正确）
- ImageViewer 用 `guessMimeType(props.filename)` 构造 data URI（不依赖响应 content-type）→ 端点变更对 data URI 零影响
- `getFileContent`（152-158）已走 `/content`，与 `getFileAsBase64` 现在同路径不同 responseType，无冲突

### 2.3 read tracking 口径

无需代码改动：`/content` 已记录 `action="read"`（files.py:236-247）。行为变化 = 图片预览从计 `download` 变为计 `read`（更准确）。`download` action 仍由直接调用 download 端点（curl/agent/未来真下载）触发。

## 3. gate_commands（P2 固化）

```yaml
gate_commands:
  P3: "cd backend && .venv/bin/python -m pytest tests/test_api.py tests/test_security.py -q --tb=short"
  P5: "make test-quick && make lint && make typecheck"
  P5_e2e: "E2E_SPEC=e2e/tpv0091-unicode-preview-download.spec.ts make debug-test"
```

说明：
- P3 定向新用例所在文件（test_api.py 扩 TestFileDownload）+ 净化回归（test_security.py），红灯检测快；`project_module` 不适用（非 import 错误驱动）
- P5 全量后端（`make test-quick` = `.venv/bin/python -m pytest tests/ -n auto --tb=short`）+ 前端 lint/typecheck（CI 强制，AGENTS.md 铁律 10）
- P5_e2e 需 debug backend 在 :8888 运行（先 `make debug-quick` 再跑）；`make debug-test` 内置 e2e-safety-check.sh 隔离守护

## 4. files_to_read（P4 implementer 上下文导航）

```yaml
files_to_read:
  - path: backend/peekview/api/files.py:62-70
    why: _sanitize_filename 现有净化逻辑（行为不可改），新 helper 放其旁
  - path: backend/peekview/api/files.py:169-208
    why: download_file 现状（header 构建点 + read tracking + _resolve_entry）
  - path: backend/peekview/api/entries.py:460-490
    why: ZIP download 复用 _sanitize_filename —— 确认不改其行为则 ZIP 不受影响（回归保护）
  - path: backend/tests/test_api.py:149-196
    why: TestFileDownload / TestFileContentEndpoint 现有模式（client fixture 匿名创建 entry + 下载断言），新用例加在此类
  - path: backend/tests/test_security.py:573-645
    why: BDD-7 净化断言现有范围（200 + 无 \r\n），新实现必须保持这些用例绿
  - path: frontend-v3/src/api/client.ts:152-175
    why: getFileAsBase64（改 URL）/ getFileContent（参照同路径实现）/ downloadFile（保留死代码）
  - path: frontend-v3/src/components/ImageViewer.vue:107-127
    why: loadImage 调用 getFileAsBase64 —— 不改，但确认调用契约（props.slug/fileId）
```

## 5. env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；P5_e2e/P6 前需 debug-start；seed entry unicode-filenames（public，file id 41 中文图片.png / 42 报告附件.txt / 43 概要図.png）"
  isolation_check: "pytest conftest autouse 隔离（PEEKVIEW_STORAGE__* → tmp_path，不触真实 DB）；E2E BASE_URL=127.0.0.1:8888 + e2e-safety-check.sh 守护；严禁触碰 :8080 生产与 ~/.peekview/"
  lint: "make lint && make typecheck（CI 强制）"
  # 不写 prod_env：生产环境不在 agate 范围内
```

## 6. minimal_validation（实测完成）

```yaml
minimal_validation:
  - assumption: "RFC 5987 filename*=UTF-8'' 编码后的 header 值 latin-1 可编码，unquote 往返等于原始中文/日文文件名"
    method: "python3 模拟 header 构造：_sanitize_filename → quote(safe='') → latin-1 encode → unquote 往返；对 中文图片.png/概要図.png/café.png/report final.png/README.md/注入名 全量验证"
    result: "confirmed"
    note: "quote(safe='') 全 percent-encode（含 / \\ ' %），值只剩 %XX+unreserved（均在 RFC 5987 attr-char/value-chars 允许集）；全部 latin-1 encode 通过；unquote(encoded) == 原名。\r\n注入字符实测：file\"; injection=\"true → 净化后 file injection=true → 编码后无任何注入字符残留。\r\n先净化后编码的顺序是关键——若不先净化，filename= fallback 会残留引号/分号"
  - assumption: "filename= 与 filename*= 共存时浏览器优先解析 filename*（BDD-5 的 suggestedFilename 依赖）"
    method: "MDN Content-Disposition 文档查证"
    result: "confirmed"
    note: "MDN 原文：'When both filename and filename* are present ... filename* is preferred over filename'；'It's recommended to include both for maximum compatibility, and you can convert filename* to filename by substituting non-ASCII characters with ASCII equivalents' —— 与本方案 ASCII fallback 设计一致。Content-Disposition 为 Baseline/Widely available（2015-07 起）"
  - assumption: "图片预览改走 /content 端点可行（返回 200 + 正确字节，与 data URI 构造兼容）"
    method: "curl debug :8888 实测 /content + 读 ImageViewer 源码"
    result: "confirmed"
    note: "curl：41 中文图片.png / 43 概要図.png → 200 image/png，前 8 字节 89504e470d0a1a0a（合法 PNG 签名）。ImageViewer 用 guessMimeType(filename) 构造 data URI（不读响应 content-type），axios arraybuffer 接收字节与端点无关 → 端点切换对 data URI 零影响"
  - assumption: "download 与 /content 响应体一致（BDD-4 断言成立）"
    method: "读代码"
    result: "confirmed"
    note: "两端点共用 service.read_file_content(entry_id, filename, path)（files.py:185 / 231）——同一存储读取，响应体必然逐字节一致"
  - assumption: "ASCII 名下载不回归（BDD-6）"
    method: "设计保证 + 现有测试"
    result: "confirmed"
    note: "ASCII 分支返回现有格式 attachment; filename=\"{safe}\" 字节级不变；现有 test_api.py TestFileDownload / test_security.py 净化用例无需改动即保持绿"
  - assumption: "前端 URL 变更不破坏 ImageViewer 单测"
    method: "读 ImageViewer.spec.ts"
    result: "confirmed"
    note: "spec 全部用例 mock api.getFileAsBase64（不断言请求 URL），端点变更对 11 条用例零影响"
```

## 7. 实现完成标志（供 P3/P5 判定）

1. [ ] `files.py` 含 `_build_content_disposition`（ASCII 分支字节级等同现格式）
2. [ ] `download_file` 使用新 helper；中文/日文文件名 download → 200 + header 含 `filename*=UTF-8''` + unquote 后等于原名
3. [ ] `test_api.py TestFileDownload` 新增中文/日文文件名用例（200 + 响应体与 /content 一致 + filename\* 正确）全绿
4. [ ] `test_security.py TestFilenameSanitization` 现有用例保持绿（BDD-7，断言范围不变：200 + 无 \r\n）
5. [ ] `client.ts getFileAsBase64` URL 已指向 `/content`
6. [ ] `ImageViewer.spec.ts` 全绿（零改动）
7. [ ] `make lint && make typecheck` 通过
8. [ ] 新 e2e spec `e2e/t091-unicode-preview-download.spec.ts` 通过（P5_e2e）

## 8. 测试策略（P3 指引）

### 后端（test_api.py TestFileDownload 追加，BDD-4/5/6）

- 中文文件名（`中文图片.png`）：POST 创建 → GET download → `200`、header 含 `filename*=UTF-8''%E4%B8%AD...`、`unquote` 后 == `中文图片.png`、响应体 == 同文件 `/content` 响应体
- 日文文件名（`概要図.png`）：同上
- ASCII 回归：现有 `test_download_file` 保持（断言 `200` + `Content-Disposition` 存在）
- **BDD-7 按 O1**：不新增引号断言；现有 `test_security.py` 用例（200 + 无 `\r\n`）保持绿即可

### 前端（P3 不新增单测）

`ImageViewer.spec.ts` 已 mock `getFileAsBase64` 且不断言 URL → URL 变更无单测可红。真实行为由 P5_e2e/P6 覆盖（BDD-1/2/3/8 均为 UI 行为）。

### P6 e2e（新 spec `e2e/t091-unicode-preview-download.spec.ts`）

稳定选择器（均已存在，无新增 testid 需求）：

| 断言目标 | 选择器 |
|----------|--------|
| 图片加载成功 | `[data-testid="image-content"]` visible + `naturalWidth > 0` |
| 图片加载失败态 | `[data-testid="image-error"]` 缺席 |
| 文件树点击 | `.file-tree .file-name`（hasText: 中文图片.png / 概要図.png / café.png / report final.png / arch.png） |

- **BDD-1/2/3**：goto `/unicode-filenames` → 点击文件树对应文件 → 断言 image-content visible + image-error 缺席 → 截图
- **BDD-5**：`page.goto(download URL)` 触发下载（Content-Disposition: attachment 导航触发 download 事件）→ `download.suggestedFilename()` == 原名
- **BDD-8**：复用 TPV0089 `unicode-filename-link.spec.ts`（markdown 内联 5 图走 /content，不受影响，P6 顺带回归）

## 9. 风险与回退

| 风险 | 缓解 |
|------|------|
| read tracking 统计口径变化（预览 download→read） | P1 SUGGEST 预声明；无测试绑定旧行为；语义更准确 |
| filename\* 旧浏览器 fallback 得 `____.png` | 远好于 500；现代浏览器（≥2015）全支持 filename\* |
| `_sanitize_filename` 被 ZIP 复用 | 不改其行为，仅新增 helper |
| 前端改动引入意外 | 1 行 URL 变更 + ImageViewer.spec mock 化零影响；回退预案=候选 A（后端修复独立满足全部 BDD） |

**回退预案**：候选 A 独立满足全部 8 条 BDD。若候选 C 的前端部分在 P5/P6 暴露问题，主 Agent 可裁掉前端变更退回 A（P3 后端测试不变，仅删 P5_e2e 的 URL 断言与前端改动）。
