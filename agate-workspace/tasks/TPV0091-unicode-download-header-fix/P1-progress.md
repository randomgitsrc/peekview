# P1-progress — TPV0091-unicode-download-header-fix（analyst）

trace_id: TPV0091-P1-20260813  |  agent: analyst  |  日期: 2026-08-13

## 逐文件阅读进度

- [x] 读 P1-dispatch-context-analyst.md — 目标/约束/上游关联/输入文件清单明确；产出路径 P1-requirements.md
- [x] 读 analyst.md 角色定义 — P1 需求质疑 + BDD + 隐含需求 + frontmatter v2.0 机器字段
- [x] 读 P0-brief.md — env_constraints（make debug-quick :8888 隔离 / lint typecheck / 严禁碰 :8080）；risk=medium；P3/P6/P7 不可裁
- [x] 读 backend/peekview/api/files.py — download_file:204-208 确认 header bug（Content-Disposition 放原始中文名 → Starlette latin-1 编码 → UnicodeEncodeError → 500）；/content 端点（:211-253）无 Content-Disposition 正常；_sanitize_filename 仅去 [";\r\n] + 截断 200，保留原始中文
- [x] 读 frontend-v3/src/api/client.ts — getFileAsBase64:160-171 走 download 端点（responseType arraybuffer）；getFileContent:152-158 已走 /content；downloadFile:173-175 返回 URL 字符串
- [x] 读 useEntryDetailComputed.ts — downloadFile:86-97 是客户端 blob 下载（new Blob(fileContent) + a.download=filename），**不走 API download 端点**——与 dispatch-context 描述的「→ client.downloadFile → download 端点」**不符**
- [x] 全 frontend grep downloadFile/getFileAsBase64 — **api.downloadFile（client.ts:173）无任何调用者（死代码）**；getFileAsBase64 唯一调用者 = ImageViewer.vue:119（图片预览）
- [x] 读 ImageViewer.vue — 加载失败显示「图片加载失败」；loadImage → api.getFileAsBase64 → download 端点
- [x] 读 useEntryDetailActions.ts — Download 菜单项（:81-89）调 onDownloadFile = composable 的 blob downloadFile，不进 API；canDownload = activeFile !== null
- [x] grep TableView/TreeView — download-fn 接收的就是 composable 的 blob downloadFile（EntryDetailContent.vue:52-53）
- [x] 读 useMarkdown.ts — 内联图片 src 走 /content 端点（:119,:301），不受本 bug 影响
- [x] 读 EntryDetailView.vue — download-file prop 透传 composable 的 blob downloadFile
- [x] 读 backend/tests/test_file_service.py — 纯 service 层测试，**无 download API / Content-Disposition / 中文文件名用例**
- [x] grep backend/tests download 相关 — test_api.py:178 test_download_file（ASCII slug filedownload-test）；test_admin_perm.py 下载权限（admin/私有/匿名/API key）；test_security.py:574-615 文件名注入净化（引号/分号/换行，ASCII 恶意名）；test_content_type.py 图片 /content content-type（image/png、image/jpeg、image/svg+xml 有覆盖）；test_read_tracking_hardening.py download action 统计；test_t082_di.py download_file DI 名称检查。**均无中文/日文文件名 download 用例 → P3 零覆盖确认**
- [x] curl 实测 debug :8888（public entry，无需认证）：
  - download 端点：files/41 中文图片.png=500、files/42 报告附件.txt=500、files/43 概要図.png=500；files/36-40（ASCII/é/空格）=200
  - /content 端点：**全部 200**，图片均 image/png（37/38/40/41/43），文本 text/markdown、text/plain
- [x] sqlite3 查 debug DB unicode-filenames 文件表（id 36-43，见下）
- [x] seed-data 确认：scripts/seed-data/unicode-filenames/ 9 个文件 + meta.json（is_public: true, owner alice）——P6 无需认证即可验证
- [x] 读 AGENTS.md — 铁律（不加注释/CHANGELOG 及时/lint typecheck/debug 隔离）

## 关键发现（与派发上下文/简报的偏差）

1. **派发上下文链路描述有误**：useEntryDetailComputed.ts:86 downloadFile 是客户端 blob 下载，**不经过** client.downloadFile / download 端点。TableView/TreeView 的 download-fn 也是同一 blob 函数。前端「下载」菜单对二进制文件会下载空文件（预存独立问题，非本 bug）。
2. **api.downloadFile（client.ts:173）是死代码**——前端无调用者。后端修复后该 URL 自然返回 200，无需单独改动。
3. **download 端点 500 的实际前端触发面 = 图片预览唯一路径**（ImageViewer → getFileAsBase64）。附件/文件下载菜单不触发。
4. **后端修复（RFC 5987）单独即可修复图片预览**：getFileAsBase64 只要拿到 200 响应即可 btoa 出 data URI；候选 B（/content）是语义改进非必需（P2 选型）。
5. **/content 端点图片 content-type 正确**（mimetypes.guess_type → image/png），候选 B 可行（test_content_type.py 已有覆盖 + curl 实测）。
6. **read tracking 语义**：若图片预览改走 /content，action 从 download 变 read（语义更正确，但统计口径变化，P2 知悉即可）。
7. **安全回归约束**：修复必须保留 _sanitize_filename 的注入净化（test_security.py:574-615 现有覆盖，引号/分号/换行删除）。

## 隐含需求识别

- 前端：图片预览路径（ImageViewer/getFileAsBase64）必须不再 500（domains: frontend）
- 后端：download 端点对非 latin-1 文件名必须 200（domains: backend）
- 多端：MCP 不碰 download 端点（grep 确认无 /files/ 命中），raw/agent 路径走 /content —— 无同步需求
- 边界：latin-1 内字符（é）、空格、ASCII 不回归；注入字符（引号/分号/换行）净化不回归
- 兼容：markdown 内联渲染（/content）不回归；read tracking 统计口径变化需知悉
- 数据：无需迁移（无 schema 变更）

## 产出与自检

- [x] 写 P1-requirements.md（180 行）— frontmatter 含 risk_level=medium / phases 全走 P1-P8 / packages 4 项 / domains [backend, frontend]
- [x] 自检：BDD-1..8 锚点连续（8 条，含 Given/When/Then，二值可判定，无实现细节绑定）；`[NO_NEED_CONFIRM]` 声明 + 3 条 SUGGEST；capability_requirements 三态 available + requires_minimal_validation: true；packages 含 backend/tests（P3 必写）
- [x] 无 status GAP；domains/packages/risk_level/phases 全部声明

## requirements-review 评审记录（第二轮复核）
- 独立复核全部关键事实：api.downloadFile 死代码（grep 11 处引用全指向 blob 函数）、useEntryDetailComputed:86 blob 下载、ImageViewer→getFileAsBase64→download 端点、curl 实测 41/42/43=500 36-40=200、/content 全 200、test_security.py:574-615 仅断言 200+无\r\n、MCP 无 /files/ 调用
- BDD 判定：BDD-1..8 全部可二值判定，编号连续，机制无关（P1 纯净）
- 覆盖维度：数据✓前端✓多端✓边界✓兼容✓ 逐项落实
- 跨条一致性：BDD-4 vs 5（状态码/body vs header 不矛盾）、BDD-7 vs 4/5（净化先于编码可同时满足）均无冲突
- SCOPE 修正（downloadFile 死代码）合理，不损 BDD 完整性
- 裁剪全走 P1-P8 理由充分；risk_level=medium 匹配；capability 全 available 无 GAP
- 2 条非阻塞观察：①BDD-7 字面"不含引号"过强，P3 按 test_security 现有断言范围写 ②BDD-5 浏览器保存名需 P2 minimal_validation
- 结论：approved → 写 P1-review.md
