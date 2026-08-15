---
phase: P7
task_id: TPV0092-mcp-get-entry-fetch
type: consistency
parent: P2-design.md
trace_id: TPV0092-P7-20260815
status: draft
created: 2026-08-15
agent: consistency-reviewer
# ── v2.0 机器计数 ──
blocker_count: 0
deviation_count: 0
deviation_critical_count: 0
design_gap_count: 1
design_gap_reviewed_count: 1
---

# P7 一致性审查 — TPV0092 MCP get_entry 直接读取任意 PeekView 链接

审查方式：批判第三方视角（假设 P2 设计可能有错），双向检查（P2→P4 设计落地 / P4→P2 僵尸要求），逐条对照 P1/P3/P5/P6 产出。只读审查，未修改任何产出文件。`[PROD_NOT_TOUCHED]`

## 1. DESIGN_GAP 配对（P4§标注 ↔ P7 转抄 + REVIEWED）

### 1.1 [DESIGN_GAP] 转抄（原始标记，来自 P4-implementation.md §标注）

> [DESIGN_GAP: backend test_raw_purify_strips_base64_image 的体积断言对测试样例数学上不可满足]
> `backend/tests/test_raw_share_purify.py:153`：`assert len(resp.text) < len(MARKDOWN_WITH_IMAGE) * 2  # 63*2 = 126`。实测净化后 content 正确（`[image: alt text (0.04 KB, base64)]`），但整个 raw JSON 响应体（含 slug/summary/tags/created_at/raw_url/files 元数据）即使净化后也有约 375 字符 > 126。该断言只在 base64 载荷足够大时成立，P3 样例是 20 字符迷你 base64，任何实现都无法让整响应 <126 字节。按 P3 自身红灯判定规则属测试数据问题，P4 禁改测试未修改。

**[DESIGN_GAP_REVIEWED: 已确认]** — P3 retry1/retry2 修复闭环，未回打 P2：

- 修复事实（已读代码验证 `backend/tests/test_raw_share_purify.py`）：
  - `test_raw_purify_strips_base64_image`（L144-156）体积断言改为 **content 级**：`assert len(content) < len(MARKDOWN_WITH_IMAGE)`（净化后文件内容 < 原始 markdown），不再断言整响应体。
  - 新增 `test_raw_purify_large_payload_shrinks_whole_response`（L161，84KB 大 fixture）保留"整响应缩小"语义——断言在数学上可满足的域内继续覆盖原始意图。
- 技术验证（P5§unit.md）：后端 1091 passed，两用例均绿。
- 验收（P6§BDD 逐条结果）：BDD-23 PASS，`?purify=true` 剥离 base64 且响应体积 459→431。
- 决策合理：该 GAP 是测试数据设计缺陷（非实现缺陷），P3 修复正确，不构成对 P2 设计的改动，无阻塞级问题。

### 1.2 [SCOPE_GAP] 说明（非 DESIGN_GAP，转抄 + 处理结论）

> [SCOPE_GAP: MCP 集成测试 mcp-integration.test.ts 仍用旧 {slug} 契约]
> `packages/mcp-server/tests/integration/mcp-integration.test.ts:180,186` 仍以 `{ slug }` 调用 `get_entry` handler，不在 P3 更新的测试文件清单内。本任务契约已改为 `{ ref }`，P6 `make debug-test-mcp` 会因 schema 变化失败。

处理结论：该 GAP 是 **P3 测试遗漏**（非 P2 设计缺口），与 DESIGN_GAP 不同类，不计入 `design_gap_count`。已闭环：P3 retry2 将 `mcp-integration.test.ts:180,187` 改为 `{ref: slug}`；P4-review-eng I-2 补漏 `mcp-e2e.test.ts:171,271` 也改 `{ref: ...}`。已读代码验证两文件当前均为新契约。P6§gate 命令 debug-test-mcp 集成测试全绿佐证。

## 2. SCOPE+ 闭环（P1§3 BDD ↔ 基础设施改动判定）

### 2.1 [SCOPE_RESOLVED] 判定

P2§4 声明无 [SCOPE+]（"P2 设计未发现 P1 基线遗漏的必须改动"，P2-design.md §4）。P6 期间主 Agent 新增 2 项基础设施改动，判定如下：

| 改动 | 位置 | 性质 | 判定 |
|------|------|------|------|
| `.gitignore` 加 `!packages/mcp-server/src/lib/` | .gitignore §79 | 版本控制修复 | **必要修复，非 [SCOPE+]**：`lib/`（L13）是 Python 构建目录规则，误伤 MCP 源码 `src/lib/`（entryRef.ts/purify.ts）。若不加例外，P4 新增源码不被 git 跟踪（已 `git ls-files` 确认两文件现已被跟踪）。无产品行为/BDD 变化，仅确保 P4 产出完整可跟踪。**不登记 [SCOPE+]**，但应随任务 commit 保留（P4 commit `f1b9f8f1` 已含）。 |
| Makefile `debug-extra`/`debug-extra-stop`/`debug-extra-status` + dev-server.sh PORT 参数化 | Makefile §634-648 / dev-server.sh §9-20 | 测试基础设施 | **非 [SCOPE+]，非 [DEVIATION]**：P2§5 env_constraints 已预见 :8889 第二实例需求（"dev-server.sh 硬编码 8888，需手动命令"），P6 将"手动命令"固化为 make target，是对 P1 capability_requirements[p6-second-instance]（supplementable）的落地增强。纯测试工具链，不触碰产品代码路径，无 BDD 影响。**建议登记 [SUGGEST]**（多实例跨 host 测试能力已固化，后续可复用），无需回补 P1 基线。 |

结论：2 项均为基础设施，**不构成 [SCOPE+]/[DEVIATION]**，无新 BDD 需要。SCOPE+ 保持 P2§4 声明（无），闭环通过。

### 2.2 ⚠️ 未提交改动提醒（非阻塞）

`git status` 显示 **Makefile 与 scripts/dev-server.sh 改动仍在工作区未 commit**（P6 commit `41ad3182` 只含 agate-workspace 文件）。主 Agent 需在 P7 commit 时一并纳入（`git add Makefile scripts/dev-server.sh`），否则 debug-extra 能力与 P7 产出分离。另有 `backend/zip-*-test.zip` 3 个二进制测试夹具被测试运行改写（非 TPV0092 改动，建议还原或按仓库惯例处理）。`[SUGGEST: 主 Agent 确认上述工作区文件处理方式]`

## 3. 跨文件一致性检查（双向）

### 3.1 P1§3 26 BDD ↔ P6§BDD 逐条结果 26 PASS（内容映射，非仅数量）

| BDD | P1§3 内容 | P6§验收结果（证据） | 一致性 |
|-----|-----------|---------------------|--------|
| BDD-1 | 页面链接→结构化 JSON | PASS：`http://127.0.0.1:8888/yaml-docker-compose`，slug + content_len=1810（bdd-01-05.log L1） | [OK] |
| BDD-2 | raw 长链接→内容 | PASS：`.../api/v1/entries/.../raw`，content_len=1810（L2） | [OK] |
| BDD-3 | raw 短链接→内容 | PASS：`.../yaml-docker-compose/raw`，content_len=1810（L3） | [OK] |
| BDD-4 | 裸 slug→内容（向后兼容） | PASS：`yaml-docker-compose`（Bearer 路径），content_len=1810（L4） | [OK] |
| BDD-5 | 分享链接→私有内容 | PASS：`?share=<token>` 透传，content=private share content（L5） | [OK] |
| BDD-6 | 跨 host 公开读 | PASS：`http://127.0.0.1:8889/ext-public`→"hello from external instance"（bdd-06-08 L1） | [OK] |
| BDD-7 | 跨 host 私有无 token 拒绝 | PASS：`ext-private-2`→isError=true "无法读取：…私有…"（bdd-06-08 L2） | [OK] |
| BDD-8 | 跨 host 不带凭据 | PASS：mock 捕获 `authorization=null`、`source=mcp`（bdd-06-08 L3） | [OK] |
| BDD-9 | 非 PeekView 响应拒绝 | PASS：`{ok:true,data:"SUPERSECRETBODY"}`→"无法识别为 PeekView entry"，不泄响应体（bdd-09-11 L1） | [OK] |
| BDD-10 | 非白名单协议拒绝 | PASS：ftp:// 与 file:// 均"协议不支持"，未发请求（bdd-09-11 L2-3） | [OK] |
| BDD-11 | http 非 localhost 拒绝 | PASS：`http://example.com/foo`→"不支持的 host"（bdd-09-11 L4） | [OK] |
| BDD-12 | base64 图片→占位符保 alt | PASS：含 `[image: alt text (`，载荷 `iVBORw0KGgo...` 不出现（bdd-12-14） | [OK] |
| BDD-13 | 二进制 content=null | PASS：`arch.png` is_binary=true + content=null（bdd-12-14） | [OK] |
| BDD-14 | 普通文本原样 | PASS：净化后与 raw 逐字符相等 1810=1810（bdd-12-14） | [OK] |
| BDD-15 | 单文件 ≤200KB 全量 | PASS：content_len=1810 无 warning（bdd-15-19） | [OK] |
| BDD-16 | 单文件 >200KB 全量+软警告 | PASS：215040 字符 + "文件较大（>200KB）"（bdd-15-19） | [OK] |
| BDD-17 | 多文件 ≤32KB 全量 | PASS：2×10KB 全量，无 warning（bdd-15-19） | [OK] |
| BDD-18 | 多文件 >32KB 片段+提示 | PASS：≤2000 字符片段 + "可用 file= 取单个"（bdd-15-19） | [OK] |
| BDD-19 | file= 取单个全量 | PASS：`file=a.md` 仅返回 a.md content_len=30720（bdd-15-19） | [OK] |
| BDD-20 | publish_files 返回 raw_url | PASS：`Raw URL: http://127.0.0.1:8888/api/v1/entries/{slug}/raw` 且可被 get_entry 读取（bdd-20） | [OK] |
| BDD-21 | raw ?share= 200 一次访问 | PASS：200 + 内容 + 无 Set-Cookie（bdd-21-24） | [OK] |
| BDD-22 | raw ?share= 无效 404 | PASS：BADTOKEN123→404（bdd-21-24） | [OK] |
| BDD-23 | raw ?purify= 剥离 base64 | PASS：占位符 + 响应 459→431（bdd-21-24） | [OK] |
| BDD-24 | raw 无 query 向后兼容 | PASS：无参返回原样含 base64（bdd-21-24） | [OK] |
| BDD-25 | 错误不打印 token/完整 URL | PASS：`contains_secret_token=false contains_full_url=false`（bdd-25） | [OK] |
| BDD-26 | fetch 超时明确错误 | PASS：1513ms abort，未无限挂起（bdd-26） | [OK] |

26/26 内容级映射一致，非仅数量匹配。P6 无中间态（全部二值 PASS），符合 P6 BDD 二值规则。

### 3.2 P2§packages ↔ 实际改动文件

- P2§packages: `[backend, packages/mcp-server]`。
- 实际代码改动全部落在这两个包内（`backend/peekview/services/purify.py` + `api/files.py`；`packages/mcp-server/src/{lib/entryRef.ts, lib/purify.ts, client.ts, tools/getEntry.ts, tools/publishFiles.ts, types.ts}`）。
- 包外改动仅基础设施（.gitignore / Makefile / dev-server.sh，见 §2.1）与测试文件（P3 retry），无第三个包被改。frontend-v3 零改动（P2§0"前端完全不动"成立）。
- 与 P8 双包 bump 范围一致。

### 3.3 P2§2 详细设计 ↔ P4§改动摘要逐条

| P2§2 设计点 | P4 实现（已读代码） | 判定 |
|-------------|---------------------|------|
| 2.1 parseEntryRef 5 形态 + 协议白名单 | entryRef.ts：页面/raw长/raw短/分享/裸 slug 全实现；http 仅 localhost/127.0.0.1/::1；ftp/file 请求前拒绝；路径含 `..`/多段拒绝。kind 归一为 'url'（P3§测试契约锚点显式允许） | [OK] |
| 2.2 匿名 fetch（不注入 Bearer） | client.ts fetchEntryRaw：headers 仅 `X-PeekView-Source: mcp`，无 Authorization；恒带 `?purify=true`；AbortController 30s；响应结构校验 slug/summary/files（含 I-3 files.length>0） | [OK] |
| 2.2 响应结构校验不泄响应体 | assertRawResponse 失败消息仅 host/slug，响应体不进错误 | [OK] |
| 2.2 redirect:manual（P2-review 注意点 A） | fetchEntryRaw 与 fetchEntryRawAuthenticated 均 `redirect: 'manual'`（后者为安全正向扩展，超出 P2 字面但同向） | [OK] |
| 2.3 净化后端主 + MCP 兜底 | purify.py（MD/IMG/DATA 三层正则 + 占位符）+ purify.ts 逐字同构；DEBT0004 双端样例一致 | [OK] |
| 2.3 purify 仅非二进制文本 | files.py L472-477：`if not item.is_binary and item.content is not None` | [OK] |
| 2.4 getEntry 返回策略 5 场景 | getEntry.ts buildOutput：单≤200KB/单>200KB+warning/多≤32KB/多>32KB片段(2000字符)+file=提示/file=匹配（path+filename 优先、无匹配列可用、多匹配要求更精确） | [OK] |
| 2.4 二进制 content:null | toOutputFile：`!is_binary && content` 才写 content | [OK] |
| 2.5 publish_files raw_url | publishFiles.ts L540：`Raw URL: {config.publicUrl}/api/v1/entries/{slug}/raw`，publicUrl 与 Link 同源 | [OK] |
| 2.6 后端 raw 扩展 | files.py get_entry_raw：share(max_length=64)/purify 可选 Query；resolve_entry_raw share 分支（public/owner/admin 直通→get_entry_with_share，失败 404，不设 cookie）；缺省向后兼容 | [OK] |
| retry1 M-1 响应体上限 | client.ts：MAX_RESPONSE_BYTES=20MB / MAX_ERROR_BYTES=1MB / readTextWithLimit（Content-Length 预检 + 流式兜底）/ readJsonWithLimit 替换 request() 与 fetchEntryRaw 的 json() | [OK] |

**说明 1（多文件阈值用 f.size 而非净化后体积）**：getEntry.ts L94 用 `raw.files[].size`（净化前文件存储大小）判断 32KB 阈值，P1 BDD-17/18 措辞为"净化后总大小"。但 P2§2.4 设计表本身未限定"净化后"（"多文件总量 ≤32KB"），实现与 P2 一致；净化只减小体积，原始 size 判定更保守（净化后超阈值但原始 ≤32KB 的场景不存在反例方向问题）。`[OK]`（与 P2 设计表一致，P1 措辞细微差已在 P2 定稿时收敛）。

**说明 2（I-5 KB 舍入双端差异）**：P4 retry1 明确"本次不修（cosmetic，DEBT 记录）"。已读代码确认双端舍入逻辑实际同构（`>=10 用 0 位小数，否则 2 位`），仅浮点舍入边界（如 .xx5 位）可能有 1 字符差异，且 P3 断言模式不锁死格式化（`\d+(\.\d+)? KB`）。`[OK]`，非核心，不阻塞。

### 3.4 方向 2（实现→设计，僵尸/废弃要求检查）

- P2 无"为已否决方案写的 AC"：候选 B（后端代理 fetch）被否决后，P2 未残留其验收条件，实现也未含后端 fetch 端点。`[OK]`
- P2§不改什么 全部成立：get_entry 端点本体未改；EntryRawResponse/RawFileItem 模型未改；`_check_share_cookie` cookie 兜底保留（files.py L421-426）；list/delete/create 工具未改；frontend-v3 未动。`[OK]`
- P2§minimal_validation 五个假设在实现中全部落地：302 不经（直连 raw API，BDD-3 证据"直连 raw 路径"）；?share= 补上（BDD-21/22）；?purify= 补上（BDD-23）；二进制 content=null（BDD-13）；share_url host 不信任（取用户传入 URL host，entryRef.ts L72 用 url.origin）。`[OK]`

## 4. 未决项清零

- P1§4 `[NO_NEED_CONFIRM]`：P1-P6 无行首 `[NEED_CONFIRM]` 残留。`[OK]`
- 5 SUGGEST 定稿情况（全部落地）：
  - S1（跨 host 匿名 fetch 不注入凭据）→ fetchEntryRaw 无 Authorization，BDD-8 PASS
  - S2（get_entry 加 file 参数）→ schema `{ref, file?}`，BDD-19 PASS
  - S3（净化后端主实现 + MCP 兜底）→ purify.py 主 + purify.ts 兜底，BDD-12/23 PASS
  - S4（错误/日志不打印完整 URL/token）→ BDD-25 PASS
  - S5（raw_url 用 publicUrl 格式）→ publishFiles L540，BDD-20 PASS
- P5 无待确认项（unit.md `[NO_NEED_CONFIRM]`）。`[OK]`

## 5. P6 验收事实核验（预存失败不影响结论）

- P6§BDD 逐条结果 26/26 PASS + 证据文件齐备（9 个 bdd-*.log + test-output.log 尾行 `EXIT_CODE: 0`，已读验证）。
- P6§gate 命令 debug-test-mcp：MCP 单元 268 passed / 集成 12 passed / 前端 e2e **11 passed / 3 failed**（debug-test-mcp.log 尾行 `3 failed` + `11 passed`）。
- 3 个 e2e 失败全为 Mobile Chrome FileTree 渲染（`create multi-file entry`/`switch between files`/`expand-collapse directories`），Desktop Chromium 对应用例全过；TPV0092 P4 commit `f1b9f8f1` 未触碰 frontend-v3/；spec 自 v0.7.0 未改 → **预存前端问题**。
- DEBT0005 已在 `agate-workspace/debt/tech-debt.md` 登记（status: open, priority: medium, 前端跟进），证据指向 P6-evidence/debug-test-mcp.log。`[OK]`，不构成对本任务 BDD 结论的影响。

## 6. 结论

- **BLOCKER=0**，**DEVIATION-CRITICAL=0**，**DEVIATION=0**。
- **DESIGN_GAP=1**（体积断言），已转抄 + `[DESIGN_GAP_REVIEWED: 已确认]`（P3 retry1/retry2 修复闭环，已读代码 + P5/P6 证据三重验证）。SCOPE_GAP（旧契约）为 P3 测试遗漏，已说明处理，不计入 design_gap_count。
- **SCOPE+ 无**（P2§4 声明成立）；2 项基础设施改动判定为必要修复/测试基础设施，非 [SCOPE+]/[DEVIATION]，建议登记 SUGGEST。
- 双向一致性全绿：P1 26 BDD ↔ P6 26 PASS 内容级映射一致；P2§packages ↔ 实际改动文件一致；P2§2 ↔ P4 逐条 [OK]；实现未超出设计范围（除同向安全扩展 redirect:manual）。
- 未决项清零（[NO_NEED_CONFIRM] + 5 SUGGEST 全落地）。

**遗留提醒（非阻塞）**：Makefile / scripts/dev-server.sh 基础设施改动未 commit，请主 Agent 随 P7 commit 纳入；`backend/zip-*-test.zip` 测试夹具被测试改写，建议还原。

`[PROD_NOT_TOUCHED]` — 全程只读，未触碰 :8080 生产 / ~/.peekview/，未修改任何产出文件。
