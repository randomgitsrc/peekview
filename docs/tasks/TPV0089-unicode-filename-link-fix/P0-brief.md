---
phase: P0
task_id: TPV0089
task_name: unicode-filename-link-fix
trace_id: TPV0089
created: 2026-08-07
status: pending
parent: 用户报告（会话内发现，附生产数据复现参考）
---

# P0-brief — T089 非 ASCII 文件名本地资源链接解析修复

## task

修复 markdown 正文里引用的本地文件（图片/附件）在文件名含非 ASCII 字符（中文/日文/带重音拉丁字符等）时，点击/渲染失败的 bug。英文文件名不受影响。已用只读调研 agent 精确定位根因，代码改动面预计集中在单个前端工具文件。

## 现象（用户报告）

markdown 中通过相对路径引用的本地图片/附件，当文件名含中文字符时，点击打开失败（图片加载失败/链接打不开）；换成英文文件名一切正常。用户提供了本地生产环境的真实复现样例（`.../ewpmt-research-report-2/raw`，未直接访问核实，仅作为该 bug 在真实数据上已发生的佐证，不作为本任务调试环境——调试仍必须走 `make debug` 隔离环境）。

## 根因（已用只读 Explore agent 核实，非猜测）

**定位：`frontend-v3/src/utils/path-map.ts` 的 `resolvePath()`/`normalizeRef()` 缺少 decode 步骤。**

编码不一致发生在"前端渲染层"，跟后端存储/API 路由无关：

1. **后端存储**（`backend/peekview/storage.py`）：文件名原样落盘，UTF-8 无 sanitize，本身无问题
2. **后端路由**（`backend/peekview/api/files.py:169-208` `download_file`/`get_file_content`）：按整数 `file_id` 查找（`/{slug}/files/{file_id}/content`），不经过文件名做 URL path 参数，路由层无编解码问题
3. **markdown-it 渲染阶段**（`frontend-v3/src/composables/useMarkdown.ts:293-327` 调用 `resolvePath(srcAttr/hrefAttr, pathMap)`）：markdown-it 内部 `normalizeLink()`（依赖 `mdurl.encode`）会自动把 `![test](images/中文图片.png)` 的 `src` percent-encode 成 `images/%E4%B8%AD%E6%96%87...png`，这是 markdown-it 库自身行为，非本项目代码
4. **`frontend-v3/src/utils/path-map.ts`**：`buildPathMap()` 的 key 来自 `File.path`/`File.filename`（DB 原始未编码 Unicode 字符串）；`normalizeRef()`/`resolvePath()` 全程没有对传入的 href/src 做 `decodeURIComponent`，导致编码后的 `images/%E4%B8%AD...png` 查不到未编码的 key `images/中文图片.png`，返回 `null`。链接/图片 src 未被改写成可用的 `/api/v1/entries/{slug}/files/{id}/content`，浏览器直接用编码后的原始相对路径请求 → 404/加载失败
5. ASCII 文件名因为 percent-encoding 是恒等变换（字母数字不转义）而"恰好没事"，掩盖了这个 bug

**唯一调用点**：`resolvePath` 只在 `useMarkdown.ts` 里被调用；`buildPathMap` 另在 `useEntryDetailComputed.ts:40` 被调用生成 pathMap 供前者消费，不是独立的第二条渲染路径。改动面确认集中在 `path-map.ts` 一个文件。

**MCP 侧确认无关**：`packages/mcp-server/src/tools/fileNaming.ts` 只做扩展名建议，不涉及文件名转码。

**范围比"中文"更广**：本质是非 ASCII 文件名问题，日文/韩文/带重音拉丁字符（如 `café.png`）大概率同样受影响，BDD 应覆盖多种非 ASCII 场景而非只测中文。

## known_risks

- **零现成测试覆盖**：`frontend-v3/src/utils/path-map.test.ts` 和 `backend/tests/test_file_service.py` 均无非 ASCII 文件名用例——不满足项目 P3 裁剪条件"≤3行且有现成覆盖"（现成覆盖这一半不成立），P3 TDD 不可跳
- **decode 修复需要防御性处理**：`decodeURIComponent` 对畸形转义序列（如孤立的 `%`）会抛异常，修复时必须 try/catch 兜底，避免个别文件名解析失败导致整个 markdown 渲染崩溃
- **修复方案有两种候选，需 P2 判断**：① 在 `resolvePath`/`normalizeRef` 消费侧 decode 传入的 href/src 再匹配；② 在 `buildPathMap` 构建侧改为存储 encode 后的 key。前者改动更局部（消费侧兜底），后者可能影响其他潜在消费者的假设——P2 需明确选型理由，不能只挑一个不说明排除另一个的原因
- **验收数据依赖**：当前 `scripts/seed-data/` 大概率没有含非 ASCII 文件名的样例 entry，P3/P6 需要新增 fixture 或运行时通过 debug backend API 创建（禁止用 CLI，禁止碰生产库，见 AGENTS.md 铁律第 6 条）

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；创建含非 ASCII 文件名的测试 entry 只能走 debug backend HTTP API（curl），不可用 CLI"
lint: "cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；用户提供的生产复现样例仅作参考，不作为调试环境"

## 裁剪倾向

- P1：BDD 覆盖中文/日文/带重音拉丁字符/带空格等非 ASCII 文件名的图片渲染 + 链接点击均应正常解析；英文文件名行为不回归
- P2：`follows_existing_pattern`（修正现有 `resolvePath` 逻辑，非新功能），但两种候选修复位置需明确选型理由，不建议直接单候选跳过对比
- P3：**不可跳**——零现成覆盖，需新增 `path-map.test.ts` 用例覆盖多种非 ASCII 场景，走真红灯
- P6：需 Playwright 实跑（图片实际渲染 + 链接实际可点击打开），需要新建含非 ASCII 文件名的测试 entry 作为验收素材
- 风险：low-medium（单文件前端改动、无 schema/权限改动，但影响面是"任何非 ASCII 文件名的已发布内容"，且已在生产数据观察到真实影响，非假设场景）

## 排期

T089（本任务）：独立于 T086/T088，无依赖，可随时启动。
