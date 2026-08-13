---
phase: P1
task_id: TPV0091-unicode-download-header-fix
type: requirements
parent: P0-brief.md
trace_id: TPV0091-P1-20260813
status: draft
created: 2026-08-13
agent: analyst
# ── v2.0 机器字段 ──
risk_level: medium
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages:
  - backend/peekview/api/files.py
  - backend/tests
  - frontend-v3/src/api/client.ts
  - frontend-v3/src/components/ImageViewer.vue
domains: [backend, frontend]
# ── 可选字段 ──
implicit_coupling: true
coupling_checklist:
  - backend-download-header: checked
  - frontend-preview-path: checked
  - read-tracking-action: checked
  - security-injection-guard: checked
# ── v2.0 标记状态（P1 首次产出留空）──
need_confirm_resolved: []
suggest_resolved: []
scope_resolved: []
---

# P1 需求基线 — 中文/日文文件名下载与图片预览 500 修复

## 1. 需求复述

用户可观察的问题：**所有含非 latin-1 文件名（中文/日文/韩文/emoji 等）的 entry**，其**图片预览**与**下载**路径返回 HTTP 500。

- 复现证据（TPV0089 验收补验 + 本次 curl 实测 debug :8888，public entry unicode-filenames 无需认证）：

  | 文件 | download 端点 `/files/{id}` | `/content` 端点 |
  |------|--------------------------|----------------|
  | 36 README.md | 200 | 200 text/markdown |
  | 37 arch.png | 200 | 200 image/png |
  | 38 café.png（é<256） | 200 | 200 image/png |
  | 39 english-notes.txt | 200 | 200 text/plain |
  | 40 report final.png | 200 | 200 image/png |
  | 41 中文图片.png | **500** | 200 image/png |
  | 42 报告附件.txt | **500** | 200 text/plain |
  | 43 概要図.png（日文） | **500** | 200 image/png |

- 根因：`download_file` 把原始中文文件名直接放入 `Content-Disposition` header（Starlette `init_headers` 强制 latin-1 编码 → `UnicodeEncodeError` → 500）。`é`（U+00E9 < 256）在 latin-1 范围内，故 café.png 正常——精确解释「只有中/日文失败」。
- 修复目标：非 latin-1 文件名**下载返回 200 且浏览器保存时显示正确文件名**；**图片预览正常显示**（不再出现「图片加载失败」）。

## 2. 隐含需求识别（逐维度）

| 维度 | 隐含需求 | 为什么必须 |
|------|---------|-----------|
| 前端 | 图片预览路径必须不再 500（ImageViewer → `getFileAsBase64` → download 端点，唯一触发点） | 这是 UI 上用户直接看到的失败 |
| 后端 | download 端点对非 latin-1 文件名必须 200 + Content-Disposition 正确编码 | 公开 API 端点，agent 读路径/直接 URL 下载依赖它 |
| 多端 | MCP 无牵连（已 grep 确认 MCP server 不调 `/files/` 端点，raw 路径走 `/content`） | 无需 MCP 同步 |
| 边界 | latin-1 内字符（é）/空格/ASCII 文件名不回归 | 防过度修复 |
| 兼容 | Content-Disposition 注入净化（引号/分号/换行删除）不回归 | test_security.py:574-615 现有安全覆盖 |
| 兼容 | markdown 内联渲染（走 `/content`）不回归 | 5 张内联图当前正常，不能被修复破坏 |
| 数据 | read tracking 统计口径：若图片预览改走 `/content`，action 从 download 变 read | 语义更正确，但口径变化需知悉 |
| 数据 | 无 schema/迁移需求 | 纯请求处理层改动 |

**客观查证修正（与派发上下文/P0-brief 的描述偏差）**：
- 派发上下文称「useEntryDetailComputed.ts:86 downloadFile → client.downloadFile → download 端点」——**不实**。该函数是客户端 blob 下载（`new Blob(fileContent)` + `a.download=filename`），**不经过 API download 端点**；TableView/TreeView 的 download-fn 是同一 blob 函数。前端「下载」菜单项只对已加载文本内容生效，对二进制文件下载空文件（**预存独立问题，非本 bug**）。
- `api.downloadFile`（client.ts:173）为**死代码，前端无任何调用者**。后端修复后其返回的 URL 自然返回 200。
- 推论：**后端 header 修复（候选 A）单独即可同时修复图片预览**——`getFileAsBase64` 拿到 200 响应即可 btoa 出 data URI。候选 B（预览改 `/content`）是语义改进、非必需（P2 选型）。

## 3. BDD 验收条件

### 图片预览（前端 UI，P6 用 Playwright CDP 实跑点击 + 截图验证）

#### BDD-1: 中文文件名图片点击后正常显示
- Given 打开 public entry `unicode-filenames`（seed data，无需登录）
- When 点击文件树中的「中文图片.png」
- Then 图片正常显示（页面不出现「图片加载失败」文案，`data-testid="image-content"` 的 img 加载成功且可见）

#### BDD-2: 日文文件名图片点击后正常显示
- Given 打开 public entry `unicode-filenames`
- When 点击文件树中的「概要図.png」
- Then 图片正常显示（判定同 BDD-1）

#### BDD-3: latin-1/空格/英文文件名图片不回归
- Given 打开 public entry `unicode-filenames`
- When 依次点击「café.png」「report final.png」「arch.png」
- Then 三张图片均正常显示（无「图片加载失败」）

### 下载端点（后端 API，pytest + curl 验证）

#### BDD-4: 非 latin-1 文件名下载返回 200 且内容正确
- Given entry `unicode-filenames` 含中文/日文文件名文件（41 中文图片.png、42 报告附件.txt、43 概要図.png）
- When 对每个文件 GET `/api/v1/entries/unicode-filenames/files/{id}`（download 端点）
- Then 每个响应 HTTP 200，且响应体与 `/content` 端点返回的原始文件内容一致（不再 500）

#### BDD-5: 下载响应 Content-Disposition 正确编码非 latin-1 文件名
- Given 同上（中文/日文文件名文件）
- When GET download 端点
- Then `Content-Disposition` 头包含 RFC 5987 UTF-8 编码（`filename*=UTF-8''...`），URL 解码后等于原始中文/日文文件名——浏览器保存时显示正确文件名

#### BDD-6: latin-1/ASCII/空格文件名下载不回归
- Given entry `unicode-filenames` 含 ASCII/latin-1/空格文件名文件（36 README.md、38 café.png、39 english-notes.txt、40 report final.png、37 arch.png）
- When 对每个文件 GET download 端点
- Then 每个响应 HTTP 200，且 Content-Disposition 保持有效（浏览器可正常保存文件）

#### BDD-7: Content-Disposition 注入净化不回归
- Given 上传含注入字符（引号 `"`、分号 `;`、换行）的文件名
- When GET download 端点
- Then 返回 200，且 Content-Disposition 头中不含引号/分号/换行（test_security.py 现有净化用例保持通过）

### markdown 内联渲染回归

#### BDD-8: markdown 内联渲染不回归
- Given entry `unicode-filenames` 的 README.md 内联引用 5 张图片
- When 打开 README.md full-page 渲染
- Then 5 张内联图片全部正常显示（该路径走 `/content` 端点，不受影响）

## 4. 待确认清单

[NO_NEED_CONFIRM] — 无真无方向项，推进不阻塞。

以下为 [SUGGEST:] 倾向项（不阻塞，主 Agent 可直接采纳；涉及审计痕迹）：

- [SUGGEST: 前端「下载」菜单对二进制文件下载空文件是预存独立问题（blob 方案仅覆盖已加载文本），不在本任务范围；建议 P2 不扩大范围，若 P6 验收与之冲突再评估]
- [SUGGEST: api.downloadFile（client.ts:173）是死代码；后端修复后其返回 URL 自然可用，无需专门改动；P2 可顺带决定保留或清理（不影响本 bug）]
- [SUGGEST: 若 P2 采纳「图片预览改走 /content」（候选 B），read tracking 该文件的 action 将从 download 变为 read（语义更正确）；若保持 download 端点则口径不变。P2 知晓影响即可，不需额外改动]

## 5. 裁剪说明（phases 全走，无裁剪）

| 阶段 | 处理 | 理由 |
|------|------|------|
| P1 | 必走 | 本阶段 |
| P2 | 必走 | 跨端改动（backend + frontend），修复候选 A/B/C 需明确选型，不可单候选跳过（P0-brief 已定） |
| P3 | 必走 | **零现成覆盖**——现有测试无中文/日文文件名 download 用例（test_api.py/test_admin_perm.py/test_security.py 均 ASCII），需新增（P0-brief 已定不可裁） |
| P4 | 必走 | 实现阶段 |
| P5 | 必走 | 后端 pytest 全量 + 前端 `make lint`/`make typecheck`（CI 强制） |
| P6 | 必走 | 需 Playwright CDP 实跑点击中文/日文图片 + 下载 + 截图（P0-brief 已定不可裁） |
| P7 | 必走 | 跨端改动（files.py + client.ts），一致性交叉核对（P0-brief 已定不可裁） |
| P8 | 保留 | 用户可见 bug 修复，走发布准备流程 |

## 6. 能力需求声明

```yaml
capability_requirements:
  - need: playwright-cdp          # P6 验收：点击文件树中文/日文图片 + 下载 + 截图
    why: BDD-1/2/3 必须实跑点击验证 UI 行为，截图作为证据
    available:
      - "playwright-cdp skill（Chrome CDP localhost:18800，connectOverCDP）"
      - "vision-engine skill（截图后视觉分析）"
    status: available
    requires_minimal_validation: true   # BDD-5 的 RFC 5987 filename* 文件名显示依赖浏览器解析行为，P2 需先做 minimal_validation 确认选型

  - need: backend-pytest          # P3/P5：新增中文文件名 download 测试 + 全量回归
    why: BDD-4/5/6/7/8 后端可测部分
    available:
      - "backend/.venv（make test-quick）"
      - "conftest autouse 隔离（tmp_path）"
    status: available

  - need: curl-api-verification  # P1 已用、P5 回归用
    why: 快速验证 download/content 端点状态码与 header
    available:
      - "debug backend :8888（make debug-quick，/tmp/peekview-debug/ 隔离）"
    status: available
```

## 7. 范围声明（frontmatter 已含，此处不重复）

- **packages**: `backend/peekview/api/files.py`、`backend/tests`、`frontend-v3/src/api/client.ts`、`frontend-v3/src/components/ImageViewer.vue`
  - 说明：`useEntryDetailComputed.ts`/`useMarkdown.ts` 经核实与 download 端点无牵连（分别走 blob 下载与 `/content`），不列入 packages
- **domains**: backend + frontend（跨端）

## 8. 附：P6 验证线索（供后续阶段使用）

- 验证入口：`http://127.0.0.1:8888/unicode-filenames`（public，owner alice，无需登录）
- 关键 file id：41 中文图片.png、42 报告附件.txt、43 概要図.png（download 当前 500）；38 café.png、40 report final.png（回归基线）
- 后端日志根因锚点：`starlette/_utils.py raw_headers ... v.encode("latin-1")` UnicodeEncodeError
- 环境约束（P0-brief）：debug :8888 隔离运行；严禁触碰 :8080 生产与 `~/.peekview/`；P4 后需 `make lint && make typecheck`；用户可见改动后 CHANGELOG 及时记录（铁律 8）
