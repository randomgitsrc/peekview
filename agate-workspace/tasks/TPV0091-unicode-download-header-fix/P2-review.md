---
phase: P2
task_id: TPV0091-unicode-download-header-fix
type: review
parent: P2-design.md
trace_id: TPV0091-P2-design-review-20260813
status: approved
created: 2026-08-13
agent: plan-design-review
---

# P2 评审 — 中文/日文文件名下载与图片预览 500 修复

独立复核了方案正确性（RFC 5987 header 构造 python3 实测 + MDN 原文 + 源码逐点核对），结论基于自身复核，非直接抄录 architect。

## 评分维度（0-10）

### 交互状态覆盖率 — 8/10

- BDD-1/2/3 图片预览的 loading/error/empty 状态由 **现有 ImageViewer.spec.ts 的 12 条用例**完整覆盖（loading on mount / API failure→error / mime unknown→error / img @error），组件行为零改动（仅 client.ts URL 变更），复用现有覆盖成立（P2-design.md §8「前端（P3 不新增单测）」+ §6 minimal_validation #6）
- P6 e2e 断言 `[data-testid="image-content"]` visible + `image-error` 缺席（§8 P6 e2e 表格），两 testid 均存在于 ImageViewer.vue:43/:54 ✓
- empty 态由 guessMimeType 返回 null → error 分支覆盖（spec `shows error when mime type is unknown`）
- 观察（非阻塞）：e2e 未显式断言 loading 中间态——组件行为未变，Loading 态由单测锁定，可接受

### AI Slop 风险 — 9/10

- RFC 5987 实现细节完全锁定：`quote(safe, safe="")` 全 percent-encode（§2.1 代码 + §2.1 决策表「注入字符处理」），fallback `_` 替换（决策表「fallback 内容」），先净化后编码顺序（决策表「净化顺序」），ASCII 分支字节级不变（决策表「编码范围」）——P4 无「随便搞」空间
- 逐项实测确认：`中文图片.png`→`filename*=UTF-8''%E4%B8%AD...`、注入名 `file"; injection="true`→`file injection=true` 无任何注入残留（见「方案正确性核查」）
- 观察（非阻塞）：P4 需在 files.py 顶部补 `from urllib.parse import quote` import——§2.1 代码引用了 `quote` 但未明示 import 语句；属琐碎实现细节

### 移动端考虑 — 7/10

- 改动为传输层（URL 换 `/content` + 后端 header 编码），**与布局/样式零关联**——drawer 布局下 ImageViewer 复用同一组件与端点，移动端不受影响（ImageViewer.vue:155-283 样式无改动）
- 观察（非阻塞）：设计未显式声明「移动端不受影响」的理由，但可推理（传输层变更不触及布局）；P6 如需可加 390×844 viewport 用例（TPV0089 spec 已有同款模式），非必须

### 可访问性 — 7/10

- img 保留 `:alt="filename"`（ImageViewer.vue:53），data URI 方案不影响 alt/键盘/SR
- 下载为导航触发（非新增交互元素），无键盘/SR 回归面
- 观察（非阻塞）：设计未显式讨论 a11y——因无新增交互元素且 alt 不变，判定无影响可接受

### 组件完整性 — 9/10

- **ImageViewer**：input（props.slug/fileId/filename）→ output（data URI）完整描述（§2.2「ImageViewer 用 guessMimeType(props.filename) 构造 data URI」+ §4 files_to_read ImageViewer.vue:107-127 loadImage 契约）✓
- **client.ts** 两函数边界清晰：`getFileAsBase64`（URL 一行变更，§2.2 代码）/ `getFileContent`（152-158 已走 /content，同路径不同 responseType 无冲突，§2.2）✓；`downloadFile`（173）死代码保留边界明确（§0「不改什么」）✓
- 后端 helper 契约完整：input filename → output header 字符串，ASCII/非 ASCII 双分支（§2.1）✓

## 方案正确性核查

### RFC 5987 实现 × Starlette latin-1 — 通过

- python3 独立实测（复刻 §2.1 `_build_content_disposition`）：中文/日文/café/注入名全部 `header.encode('latin-1')` 通过（无 UnicodeEncodeError），`unquote(filename* 值) == 原名` 往返成立。`quote(safe, safe="")` 后值只剩 `%XX` + unreserved（A-Za-z0-9-._~），全部落在 RFC 5987 attr-char/value-chars 允许集 → 与 Starlette `init_headers` latin-1 强制编码兼容 ✓
- **MDN 原文核验**（webfetch MDN Content-Disposition）：『When both `filename` and `filename*` are present ... `filename*` is preferred over `filename`』『It's recommended to include both』『convert `filename*` to `filename` by substituting non-ASCII characters with ASCII equivalents』——与 §2.1 决策表逐字一致；Content-Disposition 为 Baseline Widely available（2015-07 起）✓（minimal_validation #2 可信）

### 改动最小化（YAGNI）— 通过

- 后端：1 个新 helper + download_file 一处 return 替换；`_sanitize_filename` 行为零改（ZIP 复用面 entries.py:468 无波及）✓
- 前端：getFileAsBase64 一行 URL 变更；`downloadFile` 死代码保留（P1 SUGGEST 已声明）；无 schema/迁移 ✓
- 两端点响应体一致性：download（files.py:185）与 /content（files.py:231）共用 `service.read_file_content` → BDD-4「响应体一致」断言机制成立 ✓（minimal_validation #5 可信）

### read tracking 口径变化 — 可接受

- /content 端点已记录 `action="read"`（files.py:236-247），download 端点记录 `download`（files.py:191-202）→ 预览改走 /content 后 action 从 download 变 read，语义更准确（§2.3）✓
- 复核 test_read_tracking*.py：全部直接调 API/服务层，无任何测试绑定「预览=download」→ 口径变化无测试破坏（§0「风险在哪」声明成立）✓

### 回退预案 — 成立

- 候选 A（后端 RFC 5987 独立满足全部 8 BDD）：BDD-1/2/3 预览走 download 端点拿到 200 → data URI 正常；BDD-4/5/6/7 直接由 header 修复满足；BDD-8 走 /content 无关 ✓
- §9 回退预案明确：前端部分异常时主 Agent 可裁前端改退回 A（后端测试不变，仅删 e2e URL 断言）✓

## 与 BDD 映射

| BDD | 方案锚点 | 判定 |
|-----|---------|------|
| BDD-1/2/3 图片预览 | §2.2 getFileAsBase64→/content + §8 P6 e2e | ✓ |
| BDD-4 下载 200+内容一致 | §2.1 + §8 后端测试（中文/日文名下载，body==/content） | ✓ |
| BDD-5 filename\* | §2.1 决策表 + §8（unquote==原名）+ P6 suggestedFilename | ✓ |
| BDD-6 ASCII/空格/latin-1 不回归 | §2.1 ASCII 分支字节级不变 + 现有 test_download_file | ✓（见观察 3） |
| BDD-7 注入净化 | §2.1 先净化后编码 + test_security.py 现有用例 | ✓ |
| BDD-8 markdown 内联 | /content 完全不动 + TPV0089 spec 复用 | ✓ |

## 非阻塞观察（转 P3/P4 参考，不计 retry）

1. **P4 lint 风险**：§2.1 只替换 return 块后，`download_file` 现有 `safe_name = _sanitize_filename(...)`（files.py:186）变为未使用局部变量 → ruff **F841**（select 含 Pyflakes F，backend/pyproject.toml:85）→ `make lint` 会红。P4 需一并删除该行或让 helper 复用。实现完成标志 §7 #2 可补一句
2. **P3 latin-1 边界覆盖**：BDD-6 显式含 café.png（é，latin-1 非 ASCII），新代码下其 header 从 `filename="café.png"` 变为 `filename="caf_.png"; filename*=UTF-8''caf%C3%A9.png`（非字节级不变，但浏览器 filename* 优先 → 仍保存为 café.png，BDD-6 语义满足）。§8 后端测试策略只列了中文/日文 + 现有 ASCII test_download_file，建议 P3 补一条 café.png 下载断言（200 + header 有效），防止 latin-1 名误回归
3. **e2e 命名**：新 spec `t091-unicode-preview-download.spec.ts` 与既有 `t091-mobile-detail-visual-polish.spec.ts` 前缀相同（旧 T091 编号任务），虽文件不重名但易混淆，建议确认编号约定（可用 `tpv0091-` 前缀或复用既有 TPV 风格 `unicode-filename-link.spec.ts`）

## BLOCKER/CRITICAL

**无 BLOCKER，无 CRITICAL。**

## 结论

**approved**。候选 C（后端 RFC 5987 + 前端预览走 /content）方案正确性经独立复核成立：RFC 5987 × Starlette latin-1 兼容（python3 实测 + MDN 原文双重确认）、改动最小化（前后端各 1 处）、read tracking 口径变化无测试破坏、回退预案成立（候选 A 独立满足全部 8 BDD）。评分：交互状态 8 / AI Slop 9 / 移动端 7 / 可访问性 7 / 组件完整性 9。3 条非阻塞观察已转 P3/P4，不阻断推进。
