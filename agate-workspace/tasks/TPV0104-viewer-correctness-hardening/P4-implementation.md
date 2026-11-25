---
phase: P4
task_id: TPV0104
batch: data-viewers
complexity: medium
implementation_dir: frontend-v3/src
implementation_dirs:
- frontend-v3/src
- backend
prod_touched: false
---

# P4-implementation — TPV0104 Viewer 正确性与资源边界加固

> 多批任务：本文按批次分章追加。已交付章节：**第 1 批 `backend-render-budget`**（`implementation_dir: backend`）、
> **第 4 批 `data-viewers`**（`implementation_dir: frontend-v3/src`）。
> 未交付批次的章节（`detail-outline` / `detail-navigation`）到齐后追加。

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`、未触碰 `~/.peekview/`、未跑任何 CLI 写命令、未 commit。

---

## 第 4 批 `data-viewers` 的隔离声明

本批只改 `frontend-v3/src/`，未触碰 `backend/`（另一批 `backend-render-budget` 并行修改中）。
临时产物未产生（本批无脚本探针，验证全部走 `npx vitest` / `make typecheck`）。

---

## 第 4 批 `data-viewers` — 大产物的判定与截断态控件正确

### 交付能力（判据二 Vertical Slice）

**「大产物的判定与截断态控件正确」**：CSV 解析的构造上界与精确计数解耦、表格截断态的表头控件降级、
HTML/树视图按真实字节（而非 UTF-16 码元数）判定大文件阈值。

### 改动文件清单（6 个，全部在 `frontend-v3/src/`）

| # | 文件 | 动作 | 落点 |
|---|---|---|---|
| 1 | `composables/useCsvParser.ts` | 重写 | 单次状态机：`parsedDataRows`（始终计数）与 `constructedRows`（达 `maxRows` 停止 push）解耦；**不 `break`**（未闭合引号校验仍在扫完全文之后）；`totalRows = headerSeen ? parsedDataRows + 1 : 0` |
| 2 | `types/structured-data.ts` | 改 | `CsvParseResult` 新增 `constructedRows: number`（**必填**），带语义注释（R8 防误用） |
| 3 | `components/TableView.vue` | 改 | 两处 `shallowRef` 初值补 `constructedRows: 0`；截断 banner 文案改 `数据量过大，已显示前 ${constructedRows} 行，共 ${totalRows} 行`；`.th-sort-btn` / `.th-filter` 加 `v-if="!parsed.truncated"` + `<span v-else class="th-label">` 双分支 |
| 4 | `utils/file-bytes.ts` | **新建** | `resolveFileSize(fileLike, content)`：`size` 为有限非负数时用真实字节，否则回退 `content.length` |
| 5 | `components/HtmlViewer.vue` | 改 | 新增可选 `file?: { size: number } \| null` prop；`contentSize` = `testContentSize ?? resolveFileSize(props.file, props.content)`；阈值 `512KB`/`2MB` 与 `>=` 语义未动 |
| 6 | `components/TreeView.vue` | 改 | 新增可选 `size?: number \| null` prop；`truncated` = `resolveFileSize({ size: props.size }, props.content) > MAX_SIZE`；watch 依赖补 `props.size` |

### 逐条对应 P2 设计的 6 项

| P2 设计条目 | 落点 | 状态 |
|---|---|---|
| 1. `useCsvParser.ts` 单次状态机（D1/D2） | `useCsvParser.ts:16-71` | ✅ 实现了 `commit()` 内双计数器、不 `break`、`headerSeen` 前置 |
| 2. `CsvParseResult.constructedRows` 必填 | `structured-data.ts:11-30` | ✅ 必填成员 + 语义注释 |
| 3. `TableView.vue` 三处 | `TableView.vue:5`、`:25-45`、`:139`、`:186` | ✅ |
| 4. `utils/file-bytes.ts` 单点 | 新建 18 行 | ✅ `HtmlViewer` 与 `TreeView` 共用同一函数 |
| 5. `HtmlViewer.vue` 真实字节优先 | `HtmlViewer.vue:79-99` | ✅ 阈值与 `>=` 语义一字未动 |
| 6. `TreeView.vue` 走同一工具函数 | `TreeView.vue:62-79`、`:183` | ✅ |

### 已验证的联合约束（P1/P2 反复预警项）

- **BDD-35 × BDD-36 联合**：`1000 数据行 / maxRows=5` → `{rows:5, totalRows:1001, truncated:true, constructedRows:5}`；
  `3 / 5` → `{rows:3, totalRows:4, constructedRows:3}`。**朴素「到上限就不 push」会把 `totalRows` 从 1001 砍到 6**，本实现未踩。
- **既有契约 `useCsvParser.spec.ts:51-57`（空输入 `totalRows === 0`）**：靠 `headerSeen` 前置保住，**全绿**。
- **既有契约 `useCsvParser.spec.ts:68`（未闭合引号 throw）**：靠「不 `break`」保住，且 `1000 + '"unclosed'` 超限形态同样抛错，**全绿**。
- **既有契约 `HtmlViewer.spec.ts:338-365`（左闭右开）**：512KB 恰好 → 警告且渲染、2MB 恰好 → 不自动渲染，**全绿**。
- **R12（表头塌陷）**：`.th-label` 已存在于 `.th-sort-btn` 内部，故用 `v-if`/`v-else` 双分支而非给既有 span 加条件 → 截断态表头文字仍可见（`tpv0104-table-truncation-controls` BDD-32 ③ 绿）。

### 自查结果（自查 ≠ P5 gate）

| 命令 | 结果 |
|---|---|
| 本批 `tests_filter`（`useCsvParser` + `TableView` + `HtmlViewer` + `TreeView`）| **4 files / 70 passed / 0 failed** |
| 本批红灯 3 个 spec（`tpv0104-csv-constructed-rows` / `tpv0104-table-truncation-controls` / `tpv0104-real-file-bytes`）| **3 files / 22 passed / 0 failed**（全部转绿） |
| `src/__tests__/tpv0104-source-scan.test.ts` 的 BDD-35 断言 | **passed** |
| `make typecheck` | **exit 0** |
| `make test-frontend`（全量）| 21 failed / 1485 passed / 4 skipped —— **基线 31F，本批净减 10F，零新增失败** |

**全量剩余 21F 的归属（逐项已核对，均非本批文件）**：

| 失败文件 | 数量 | 归属批次 |
|---|---|---|
| `tpv0104-markdown-headings.spec.ts` | — | `detail-outline` |
| `utils/__tests__/tpv0104-default-file.spec.ts` | — | `detail-navigation` |
| `__tests__/tpv0104-source-scan.test.ts`（BDD-07 × 2 相关 + BDD-47 × 4）| 5 | `detail-outline` / `detail-navigation` |
| `__tests__/tpv0104-migration-and-docs.test.ts`（BDD-45 × 4）| 4 | `backend-render-budget`（文档） |

> **归因取证明**：`git stash push -- frontend-v3/src/` 后单独跑这 4 个文件得 **22F/6P**；
> 恢复本批改动后同一命令得 **21F**。差值 = 本批修复项，且**无一项由本批引入**（本批只让红灯变少）。

### [DESIGN_GAP]

无。P2 在这 6 项上的描述足以直接实现，未遇到需要自主决策的歧义点。

### [SCOPE+]

无。

### [CLARIFY]

无。

### 新增文件核对表

> 项目未采用骨架（`P2-skeleton.md`）也未采用 CODE-MAP（`agate-workspace/agents/CODE-MAP.md`），本节按 P4 卡片「未采用则本节可省略」处理——为便于 P7 核对仍列出本批唯一新增文件。

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|---|---|---|
| `frontend-v3/src/utils/file-bytes.ts` | 骨架机制未采用 | `[CODE_MAP_EXEMPT: 项目未采用 CODE-MAP 机制]` |

### 实现顺序中发现的实现细节（供 architect 完善设计）

1. **`commit()` 必须先 `row.push(field)`**：先按 D2 骨架写的版本漏了这一步，导致表头/数据行都少最后一列
   （`a,b,c` → `['a','b']`）。即「字段在行尾收口」这个动作必须纳入 `commit()` 而非依赖调用点。
   骨架伪代码里未写明，属实现细节而非设计缺口（骨架是计数器语义而非完整解析流程）。
2. **`TreeView` 的 `watch` 依赖需补 `props.size`**：`truncated` 是 `computed`，但 `parseTree()` 由 `watch`
   驱动且首行 `if (truncated.value) return`；`size` 单独变化时若不进 watch 依赖，树结构不会随截断态刷新。
   P2 只写了 `truncated` 表达式，未提 watch 依赖（同属实现细节）。
3. **`HtmlViewer` 的 `file` prop 用结构化类型 `{ size: number }`（而非 `File`）**：与 P2 一致，
   好处是单测可直接传 `{ size }` 字面量、调用点传 `activeFile` 也结构兼容，避免类型耦合。

### 待主 Agent 处理（本批不做）

- `frontend-v3/src/components/EntryDetailContent.vue` 的两个调用点尚未传新 prop：
  `HtmlViewer` 缺 `:file="activeFile"`、`TreeView` 缺 `:size="activeFile.size"`。
  该文件属 **`detail-navigation` 批**的 `output` 列表（P2 §0.1 明确列为该批落点），
  **不在本批 `output` 内** → 本批按「只改自己批次的文件」约束未触碰。
  **若不接这两个 prop，本批的真实字节判定在生产路径上不会生效**（只有单测显式传 prop 时才生效）。
  已在 `P4-progress.md` 与本文登记，请主 Agent 在 `detail-navigation` 批交付时核对这两个调用点已接上。

---

## 第 1 批 `backend-render-budget` — 注入预算与超限显式反馈

> complexity: high ｜ `implementation_dir: backend` ｜ [PROD_NOT_TOUCHED]
> 全程只跑 `backend/.venv/bin/python -m pytest`（conftest autouse 隔离到 `mkdtemp` 临时 app）与只读 grep/lint；
> 未接触生产 `:8080`、未触碰 `~/.peekview/`、未跑 CLI 写命令、未 commit。
> 临时探针只用 `.venv/bin/python -c` 内联执行（无落盘脚本），未在 `.agate-tmp/` 留产物。

### 交付能力（判据二 Vertical Slice）

**「注入超限必须显式可查，未内联的每一个都说得清原因」**：数量/单文件/总量三级预算 + 既有静默丢弃路径（oversized 二进制、kind-drop、未引用资源）全部纳入同一份可机器解析的跳过清单，且清单自身不能成为 XSS 载体。

### 改动文件清单（4 个）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `backend/peekview/services/html_render_service.py` | 改（常量 + `InjectSelection` + `select_inject_ids` + `REASONS` + `build_skip_report_html` + `_process_css_refs` 透传 + `inject_resources` 七处埋点） |
| 2 | `backend/peekview/api/files.py` | 改（`render_html_file` 预算编排六类 reason + 报表块追加；`_build_sibling_data` 签名不变） |
| 3 | `backend/peekview/services/entry_service.py` | 改（`_files_of_entry_query` 单点 `order_by`，6 处收敛） |
| 4 | `docs/architecture/html-preview-security-modes.md` | **新建**（BDD-45） |

### 逐条对应 P2 设计的 11 项

| # | P2 设计 | 落点 | 状态 |
|---|---|---|---|
| 1 | `_MAX_INJECT_IDS` 50 → **40** | `html_render_service.py:18` | ✅ `40 < 50-1=49` |
| 2 | 单文件 2 MiB / 总预算 8 MiB | 常量区 `:19-20` | ✅ 新增 |
| 3 | `select_inject_ids(...) -> InjectSelection` + 保留 `parse_inject_ids` | `:117-149` | ✅ `overflow` 落账，薄包装回 `list[int]` |
| 4 | `_build_sibling_data` 的 `None` 由调用方补记 | `files.py` 预算循环 | ✅ 签名不变，补 `binary_too_large` |
| 5 | `inject_resources(..., *, skipped_out=None) -> str` + 七处埋点 | `:272-460` | ✅ `consumed: set[int]` + `owners: dict`（text/binary 共用） |
| 6 | `render_html_file` 预算编排 + 尾部 JSON 注记 | `files.py:333-420` | ✅ 六类 reason 汇总；**响应头与 CSP 一字未改** |
| 7 | `skipped[]` schema（`file_id` 必填 + 五字段） | `files.py` 各判定点 | ✅ `size` 取不到写 `null`，未给 `SiblingFileData` 加字段 |
| 8 | `inlined` = **实际进入响应体**的个数 | `files.py` `inlined` 计算 | ✅ 由 `skipped_out` 增量回扣，不由预算层反推 |
| 9 | `entry_service.py` 确定性 `order_by` | `_files_of_entry_query`（`:104`） | ✅ 6 处收敛；**未**给 POST 响应加排序 |
| 10 | 新建安全边界文档 | `docs/architecture/html-preview-security-modes.md` | ✅ 三要素齐备 |
| 11 | BDD-41 报表块**始终存在** | `files.py` 无条件追加 | ✅ `skipped: []` 时仍有块 |

**七处埋点逐项**（缺一处不变式即破）：①`link[rel=stylesheet]` ②`script[src]` ③kind 追加 css/js ④`img/video/audio/source/track[src]`→二进制 ⑤同处→文本 SVG ⑥`link[rel=icon|shortcut icon]` ⑦CSS 内部——`owners`/`consumed_out` 透传进 `_process_css_refs`，在 `_replace_import` 与 `_replace_url`（二进制/SVG 两处）登记，**含递归分支**。

**未用 `used_text_keys` + `_sibling_keys()` 做消费判定**（P2 R17 的决定性反例：该钩子漏 CSS `@import`、CSS `url()`、`link[rel=icon]` 三条路径并给假绿报表）。零改动保证：`_process_css_refs` 新参数为关键字可选（`*, owners=None, consumed_out=None`）→ 既有 8 处调用不动；`inject_resources` 返回仍 `str` → 既有 13 处调用不动。

### 转绿用例

本批 `tests_filter`（`test_html_render.py` + `test_entry_service.py` + `test_entry_file_order.py`）：**89 passed / 0 failed**。

原先 13 条红灯全部转绿：BDD-38（2）、BDD-39（1）、BDD-40（4）、G11（1）、G12（1）、BDD-41（1）、BDD-13（3）。

### 既有测试/夹具的同步更新（RM-AG0107 逐条列明）

**`[P3_FIXTURE_BUG]` `backend/tests/test_html_render.py:62` 的 `_render_url` 对 list 类型 `inject` 做 f-string 插值**

- 该 helper **是既有代码**（`git blame` 落在 P3 之前的行），位于 TPV0104 段之外。P3 新增用例普遍以 Python list 调用它（`_render_url(slug, main_id, sibling_ids)`），插值结果是 `?inject=[10, 11]`。
- 服务端 `select_inject_ids` 按逗号切 token 后逐项 `int()`，`"[10"` / `"11]"` 双双失败 → **实际请求到 0 个 sibling**。实测：`[10, 11]` → 解析出 `[]`；`[123, 124, 125]` → 解析出 `[124]`（偶然命中不含方括号的中间 token，正是部分用例"看起来有数据"的来源）。
- 该缺陷在 P3 红灯阶段被「报表块不存在」这一更早的失败掩盖（`_parse_report` 先 FAIL），未暴露。
- **修法**：`_render_url` 对 list/tuple/set 按前端既有约定 `join(',')` 序列化（`frontend-v3/src/components/HtmlViewer.vue:152` 即 `props.siblingFileIds.join(',')`）。**未改任何断言、未改任何 Given/When/Then**——只让 helper 真正按契约构造 URL。单值 `inject=` 调用（Group 4 的 3 条既有用例传 int）行为不变。
- 影响面：该 helper 只被本文件使用。

**其余既有测试零改动、零连带失败。** 全量 `backend/tests/` 唯一失败是预存的 `test_cli_remote::TestCLIRemoteConfig::test_config_set_remote_api_key`（沙箱 `~/.peekview/` 只读，`OSError: [Errno 30]`，与本任务无关）。

### 自查结果（自查 ≠ P5 gate）

| 项 | 命令 | 结果 |
|---|---|---|
| 本批 tests_filter | `pytest tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py` | **89 passed / 0 failed** |
| 全量后端 | `pytest tests/` | 仅 1 预存失败（`test_cli_remote`，沙箱只读），**零回归** |
| 冻结计数 | `grep -c "= inject_resources(" tests/test_html_render.py` | **13** ✅ |
| 冻结计数 | `grep -c "_process_css_refs(" tests/test_html_render.py` | **8** ✅ |
| 平台假设扫描 | `check-platform-assumptions.py` 本批 2 个测试文件 + 3 个改动源文件 | **0 命中**，exit 0 |
| lint（本批源文件） | `ruff check peekview/{services/html_render_service,api/files,services/entry_service}.py` | **All checks passed** |
| BDD-45 文档要素 | 四要素 grep | 全 PASS |

平台假设扫描对**整个** `backend/tests/` 有命中，但全部落在**我未改动**的文件（`test_cli_remote.py` / `test_config.py` / `test_file_service.py` / `test_t073_*`），已逐文件 `git diff --quiet` 确认未改动 → 属预存。

**`make lint` 全量仍红 1 项（SIM300，`test_html_render.py:768`）**：该行是 **P3 写入的测试段**（`git blame` = `de03b466`），在 pristine HEAD 上 `ruff check peekview/ tests/` 同样 exit 1。我**改了测试文件的其它行**（`_render_url`），按「不修改 P3 测试」约束不动其断言区；本批源文件 lint 全绿。另注：BDD-45 的前端 vitest 断言（`tpv0104-migration-and-docs.test.ts`）实测 **6 passed**，文档章节已闭合。请主 Agent 决定 SIM300 由谁修

### 设计不变量实测（`inject_resources` 直调，不经 HTTP）

| 形态 | 结果 |
|---|---|
| 空 skipped 报表块 | `skipped=[]` / `requested=0` / `inlined=0`，块仍存在 |
| `path` 含 `</script><img src=x>` | 原始 payload **无字面 `</script`**、无 stray `img` DOM、`path` roundtrip 一致 |
| 未引用 sibling（未引用 css + README.md + 未引用 png） | `requested=3 / inlined=1 / len(skipped)=2`，不变式成立 |
| 两跳 `@import` a→b→c | `skipped=[]`，`color:blue` 已注入（第七处埋点递归透传生效） |

### [DESIGN_GAP]

无。P2 在实现层面足够明确，11 条逐项可落地。

### [SCOPE+]

无。

### [CLARIFY]

无。设计要求本身无冲突。

### 新增文件核对表

> 项目未采用骨架（`P2-skeleton.md`）也未采用 CODE-MAP（`agate-workspace/agents/CODE-MAP.md`）。

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|---|---|---|
| `docs/architecture/html-preview-security-modes.md` | 骨架机制未采用 | `[CODE_MAP_EXEMPT: 项目未采用 CODE-MAP 机制]` |

### 待主 Agent 处理（本批不做）

1. **`make lint` 的 SIM300**（见上）——P3 测试段内的既有 lint 错误，需决策由谁修。
2. **`tpv0104-migration-and-docs.test.ts` 的 BDD-45 四条**（`data-viewers` 批 §自查表把 4F 归给本批）：文档已按落点 `docs/architecture/html-preview-security-modes.md` 建好且四要素 grep 全 PASS，该 vitest 断言应已转绿；请在该批或全量 `make test-frontend` 时复核。
3. **前端接线**：`HtmlViewer`/`TreeView` 的新 prop 调用点在 `EntryDetailContent.vue`（属 `detail-navigation` 批），见 §第 4 批 待办。

---

## 第 2 批 `detail-outline` — TOC 与正文锚点单一来源

> **批范围经历一次更正**（主 Agent，2026-11-25 06:35）：原派发把 P2 的 D5「全屏入口」与 zen 侧栏也划入本批，与 P2 `dispatch_plan`（把 `EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` 全划给 `detail-navigation` 批）冲突。**本批实际只做 A 组**，只改 3 个文件。

[PROD_NOT_TOUCHED] 未接触生产 `:8080`、未触碰 `~/.peekview/`、未跑任何 CLI 写命令、未 commit。
临时探针只落 `.agate-tmp/`（`probe2.mjs`，用于核验「正文 id == headings id」，用完即弃，未进仓库）。

### 交付能力（判据二 Vertical Slice）

**「TOC 与正文锚点单一来源」**：目录项与正文 `<h*>` 的 `id`/文本由 `heading_open` renderer 的同一行代码产出，结构上不可能漂移；覆盖 h1–h4、同名去重、围栏内标题排除、内联标记剥离。

### 改动文件清单（3 个，全部在 `frontend-v3/src/`）

| # | 文件 | 动作 | 落点 |
|---|---|---|---|
| 1 | `composables/useMarkdown.ts` | 改 | 新增 `inlinePlainText()`；`heading_open` renderer 层级 `level >= 2 && level <= 4` → `level >= 1 && level <= 4`；`text` 由 `nextToken.content`（原样带标记）改为 inline children 的纯文本；`slugify` 后接 `usedHeadingIds: Map<string, number>` 去重（`base` / `base-1` / `base-2`）；`token.attrSet('id', id)` 与 `headings.push({level, text, id})` 保持**同一处** |
| 2 | `composables/useEntryDetailComputed.ts` | 改 | **删除** `extractHeadings`（整段逐行正则，BDD-07 归零）；`tocHeadings` 由 `ComputedRef`（computed + 逐行正则）改为 `Ref<TocHeading[]>` + `setTocHeadings(list)` 写入 + `watch(activeFile.id)` 清空；导出 `extractHeadings` → `setTocHeadings`（`tocHeadings` 名字不变，3 个消费组件零改动） |
| 3 | `components/TocNav.vue` | 改 | h1 层级视觉（D-2 / W1+W2 组合）：`.toc-item.toc-level-1 { margin-top: var(--space-3) }` + `.toc-item.toc-level-1 a { font-weight: 600 }` + `.toc-item.toc-level-1:not(.active) a { color: var(--c-text) }`（**颜色与字重拆两条**，R2-1/R16） |

**`components/MarkdownViewer.vue` 经核查无需改动**：`:111` 早已有 `emit('headings', result.headings)`，`defineEmits` 也已声明 `headings: [headings: TocHeading[]]`（`:27-30`），且**不存在**设计 `:107` 提到的 `select-heading` emit（该段设计与现仓不符，见下方 `[DESIGN_GAP]` 第 2 条）。

### 逐条对应 P2 设计

| P2 设计条目 | 落点 | 状态 |
|---|---|---|
| `:105` 层级过滤 → `level >= 1 && level <= 4` | `useMarkdown.ts` heading_open | ✅ |
| `:105` `text` 改为 inline token 纯文本（`text`/`code_inline` 取 `content`、`softbreak`→空格） | `inlinePlainText()` | ✅ |
| `:105` id 用纯文本跑 `slugify` | 同上 | ✅ |
| `:105` `Map<string,number>` 去重产出 `id`/`id-1`/`id-2` | `usedHeadingIds` | ✅ |
| `:105` `attrSet` 与 `headings.push` 同一处 | renderer 内同一 if 块 | ✅ |
| `:106` 删除 `extractHeadings`（逐行正则归零） | `useEntryDetailComputed.ts` | ✅ |
| `:106` `tocHeadings` 改 `ref<TocHeading[]>` + `setTocHeadings(list)` + `watch(activeFile.id)` 清空 | 同上 | ✅ |
| `:106` 导出保持 `tocHeadings` 名字不变 | 同上 | ✅ |
| `:107` 删除 `MarkdownViewer` 的 `select-heading` | **现仓本就不存在**，无改动 | ✅（no-op） |
| TocNav `.toc-level-1` 拆两条规则（不挡 active 的加粗） | `TocNav.vue` | ✅ |
| TocNav `.toc-level-1 { margin-top: var(--space-3) }` | 同上 | ✅ |
| **不写** `.toc-level-1 { padding-left: 0 }`（no-op） | 未写 | ✅ |
| **不改** h2/h3/h4 既有缩进 | 未动 `:42-44` | ✅ |

### 实测核验（`.agate-tmp/probe2.mjs`，单次 render，与生产同一段逻辑）

输入：h1 + 3×h2（含 2 个同名）+ 内联强调/链接标题 + Setext h1 + h5 + 围栏内 h2

```
headings ids: [ '一级', '中文标题', '中文标题-1', '粗体与链接', 'setext-标题' ]
body    ids: [ '一级', '中文标题', '中文标题-1', '粗体与链接', 'setext-标题' ]   ← 逐项相同
levels:      [ 1, 2, 2, 2, 1 ]                                                  ← h5 已排除
texts:       [ '一级', '中文标题', '中文标题', '粗体与链接', 'Setext 标题' ]      ← 标记已剥离
fenced excluded: true                                                          ← 围栏内「示例」未入
```

**BDD-01/02/03/04/05 五条判据全部在同一输出上成立** → 锚点单点（候选 A）机制确认。

### 自查结果

| 检查 | 命令 | 结果 |
|---|---|---|
| 本批 `tests_filter` | `npx vitest run src/composables/__tests__ src/components/__tests__/MarkdownViewer.spec.ts src/components/__tests__/TocNav.spec.ts` | **22 files / 241 passed, 1 skipped, 0 failed** |
| 本任务红灯（headings） | `npx vitest run src/composables/__tests__/tpv0104-markdown-headings.spec.ts` | **6P/0F**（基线 4F/2P → 全绿） |
| 本任务红灯（源码扫描 BDD-07 两项） | `npx vitest run src/__tests__/tpv0104-source-scan.test.ts` | BDD-07 两项**已转绿**；该文件仍 4F，全部是 BDD-47（`EntryCard`/`EntryListRow`，属 `detail-navigation` 批） |
| 类型检查 | `make typecheck` | **exit 0** |
| 全量前端 | `npx vitest run` | **12 failed / 1494 passed / 4 skipped**（12 = BDD-47×4 + `tpv0104-default-file.spec.ts`×8，**全部属 `detail-navigation` 批**；本批 0 回归） |

> 全量基线参照：`data-viewers` 批收官时为 21F，`backend-render-budget` 批后未复核前端；本批把 21F → 12F（-9：headings 6 + source-scan BDD-07 2 + 其连带的 1），剩余 12F 均属尚未开工的 `detail-navigation` 批。

### ⛔ 跨批阻断缺口（必须由 `detail-navigation` 批或补派人处理）

**现象**：`tocHeadings` 现在是 `ref` + `setTocHeadings()`（P2 `:106` 指定的形态），但**全仓无一处调用 `setTocHeadings`** ⇒ 真实页面 `tocHeadings` 恒为 `[]`。

P2 设计的数据流（`:191`）是三步：
```
MarkdownViewer  --emit('headings')-->  EntryDetailContent  --透传 @headings-->  EntryDetailView  --调 setTocHeadings()
```
第 1 步已在（`MarkdownViewer.vue:111`）；**第 2、3 步的落点文件（`EntryDetailContent.vue` / `EntryDetailView.vue`）都归 `detail-navigation` 批**，而该批的 dispatch-context 里 `grep -in "toc|headings|outline"` **没有任何一条要求接这条链**（只提到文件线边界与 `extractHeadings` mock 的更新）。

**后果（若无人补）**：`.toc-sidebar` 的 `v-if` 依赖 `tocHeadings.length > 0`（`EntryDetailContent.vue:78`）→ 永远假 → 桌面 TOC 默认不展开 → E2E **BDD-01/02/03/04/05/06/52 全红**。**vitest 层完全看不出来**（`t031`/`t067` 把整个 `useEntryDetailComputed` mock 掉了），故「单元测试全绿」不覆盖这条链。

**确切改法（供 `detail-navigation` 批照做，零额外文件）**：

1. `EntryDetailContent.vue` `:56` 的 `<MarkdownViewer>`：
   - **删除** `:headings="tocHeadings"`（该 prop 在 `MarkdownViewer` 的 `defineProps` 里根本不存在，是既有的无效绑定）
   - **删除** `@select-heading="$emit('scroll-to-heading', $event)"`（`MarkdownViewer` 无此 emit）
   - **新增** `@headings="$emit('toc-headings', $event)"`
2. `EntryDetailContent.vue` `defineEmits` 加 `'toc-headings': [headings: TocHeading[]]`
3. `EntryDetailView.vue` 的 `<EntryDetailContent>` 加 `@toc-headings="setTocHeadings"`
4. `EntryDetailView.vue` script 的 `useEntryDetailComputed()` 解构里补 `setTocHeadings`
5. `EntryDetailView.vue` 的桌面默认展开（`:243-246` 与 `:274`）改为 `watch(tocHeadings, …, { flush: 'post' })` + `userToggledToc` 标志（P2 R5）—— 因为 headings 现在是**异步到达**，`await nextTick()` 时点仍为空

> 另：`t031-entry-detail-view.spec.ts:130` / `t067-detail-framework.spec.ts:143` 的 `extractHeadings: vi.fn()` 已不再是被导出的名字。因这两处是**整体 mock** `useEntryDetailComputed`，多余属性不会报错（**不会因本批而红**），但按 RM-AG0107 更新这两个 spec 时应顺手删掉该行。

### [DESIGN_GAP]

[DESIGN_GAP: P2 `:107` 称 `MarkdownViewer.vue` 需「删除 `defineEmits` 里无用的 `select-heading`（父侧 `@select-heading` 一并删）」，但现仓 `MarkdownViewer.vue` 的 `defineEmits`（`:27-30`）只有 `headings` 与 `navigate-file`，从来不存在 `select-heading` —— 该 emit 只出现在父侧 `EntryDetailContent.vue:56` 的监听上（监听一个不存在的 emit，是无效绑定而非死 emit）。本批按「不改 `MarkdownViewer.vue`」处置；父侧的无效绑定按上节改法在 `detail-navigation` 批一并删除。]

[DESIGN_GAP: P2 `:191` 的数据流把「`EntryDetailContent` 透传 `@headings`」与「`EntryDetailView` 调 `setTocHeadings()`」写成 A 组（`detail-outline`）的落点，但 P2 `dispatch_plan`（`:859`）把这两个文件划给 `detail-navigation` 批。本批严格执行 `dispatch_plan` 的文件边界（只做 `useMarkdown`/`useEntryDetailComputed`/`TocNav`），因此本批产出的 `setTocHeadings()` **暂无消费者**；接线以「跨批阻断缺口」节写明确切落点，交 `detail-navigation` 批闭环。依 P2 `:865` 的既定处置（`setTocHeadings()` 导出名锁定、navigation 批只消费接口）这属预期内，但需要该批明确接上，否则 E2E 的 TOC 类 BDD 全红。]

### [SCOPE+]

无。本批未发现 P1/P2 未覆盖的新需求。

### [CLARIFY]

无。设计要求本身无冲突（上述两条是「设计与派发/现仓的偏差」，已按 `[DESIGN_GAP]` 申报，非质疑设计）。

### B 组 / C 组改法存档（本批**不实现**，移交 `detail-navigation` 批）

> 主 Agent 更正：这 4 个文件（`EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue`）全部归 `detail-navigation` 批。以下为我在收窄前已读实的落点与坑，供其参考。

**B. 全屏入口 I/O 链三处扩容（R2-2，缺一即 typecheck 红）**

1. `EntryDetailHeader.vue`：
   - `defineProps` 加 `activeFile?: File | null`（`withDefaults` 默认 `null`）—— **`File` 必须 `import type { ... } from '@/types'`**（现有 import 行 `:101` 已含 `Entry, TocHeading, AuthState, Team`，补 `File` 即可），否则解析成 DOM `File` → **TS2322**
   - `defineEmits`（`:146-155`）加 `'fullscreen': []`
   - `.actions-area`（`:43-45` Copy 之后、`:46` Share 之前）插入：
     ```
     <button v-if="currentEntry && activeFile" class="icon-btn" @click="$emit('fullscreen')" aria-label="全屏阅读" data-testid="detail-fullscreen-btn">
       <MaximizeIcon :size="16" /><span class="tooltip">全屏阅读</span>
     </button>
     ```
     - **`v-if="currentEntry && activeFile"` 是功能性必需**（实测 404 页 `.actions-area` 的 `v-if="isDesktop"` 仍渲染、`activeFile` 为 `null` → 无守卫会 TypeError）
     - `.icon-btn`（stateless one-shot，`DESIGN.md:162`）；**不设 `disabled`**（`v-if` 即禁用态）；**不加自定义过渡**（继承 `.icon-btn` 既有 `transition: all var(--transition-fast)`）
     - `:size="16"` 理由 = 跟随既有兄弟按钮（`CopyIcon`/`Share2Icon`/`Star` 均 16），**不引用 `DESIGN.md §7`**
     - 图标需从 `lucide-vue-next` 补 import（该文件现有 import 块 `:110-117`）
2. `EntryDetailMobileBar.vue`：
   - props（`:70-85`）加 `activeFile?: File | null`、emits（`:87-95`）加 `'fullscreen': []`（`File` 同样须从 `@/types` 导入）
   - 左簇（`:35` StarToggle 之后、`:36` `<div class="flex-spacer">` **之前**）新增同型 `icon-btn`，`data-testid="mobile-bar-fullscreen-btn"`
   - **间距收窄（M1/R7）**：scoped `.mobile-bottom-bar { gap: var(--space-2) → var(--space-1) }`（`:105`，8px→4px）。**`layout.css:538` 的 `gap: 4px` 不要动**（已被 scoped 覆盖、不生效）
   - **移动端只给 `aria-label`、不加 tooltip**（M6：既有底栏 4 个按钮 `tooltipCount = 0`）
3. `EntryDetailView.vue`：
   - `<EntryDetailHeader>`（`:5-36`）加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`
   - `<EntryDetailMobileBar>`（`:89-111`）加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`
   - 新增：
     ```ts
     function handleFullscreen() {
       if (!activeFile.value || !currentEntry.value) return
       const isDefault = activeFile.value.id === resolveDefaultFile(currentEntry.value.files)?.id
       const query = { ...route.query }
       if (isDefault) delete query.file; else query.file = String(activeFile.value.id)
       router.push({ path: `/${props.slug}/f`, query })
     }
     ```
   - 依赖 `utils/default-file.ts` 的 `resolveDefaultFile`（由该批创建）

**C. zen 侧栏 DOM 移除（BDD-28 / BDD-53③）**

`EntryDetailContent.vue`：
- `:4` `.file-sidebar` 的 `v-if="isFileTreeOpen && isMultiFile"` → 加 `&& !zenMode`
- `:78` `.toc-sidebar` 的 `v-if="isTocOpen && isMarkdown && !sourceViewMode && tocHeadings.length > 0"` → 加 `&& !zenMode`
- script 已有 `inject`（`:127` 的 import 行含 `inject`，`:181` 已 `inject(IsMobileKey)`），补 `const zenMode = inject(ZenModeKey)!`（`ZenModeKey` 与 `IsMobileKey` 同在 `@/composables/entryDetailKeys`，`EntryDetailContent.vue:142` 现有 import 补名字即可）
- **不要删**全局 CSS 规则（`layout.css:650-657` 等对 `.detail-header` 的 `v-show` 项仍有效）

### 新增文件核对表

> 项目未采用骨架（`P2-skeleton.md`）也未采用 CODE-MAP（`agate-workspace/agents/CODE-MAP.md`）。本批**无新增文件**。

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|---|---|---|
| （无） | — | — |

### 待主 Agent 处理

1. **⛔ 上节「跨批阻断缺口」**：请裁决由 `detail-navigation` 批补接 `@headings → setTocHeadings`（推荐，补 dispatch-context 一条即可），或补派人。

---

## 第 3 批 `detail-navigation` 的隔离声明

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`（实测不可达）、未触碰 `~/.peekview/`、未跑任何 CLI 写命令、未 commit。
E2E 实跑只用 `:8888`（debug），未造/删 entry（全部沿用 seed 的 `k8s-deployment`），前端产物落在 `frontend-v3/dist/`（gitignore 覆盖）。
未改 P3 的 `tpv0104-*` 测试；只按 RM-AG0107 更新了两处**仓库既有** spec 的 mock 属性名。

---

## 第 3 批 `detail-navigation` — 默认入口 / URL 持续态 / TOC 数据链 / 全屏入口

### 交付能力（判据二 Vertical Slice）

**「详情页的入口、深链与全屏入口一致」**：默认入口由单一 resolver 决定（README > index > 稳定排序首个）；
`?file=` 是页面活跃文件的**持续态**（首屏读入、页内切换同步、刷新保留、与 `share` 共存不误删）；
TOC 数据从渲染器单向流到容器与桌面自动展开；全屏入口在桌面 header 与移动底栏各恰一个，进入 `/{slug}/f` 并保留当前文件。

### 改动文件清单（8 个 + 3 个新建，全部在 `frontend-v3/src/`）

| # | 文件 | 动作 | 落点 |
|---|---|---|---|
| 1 | `utils/default-file.ts` | **新建** | `resolveDefaultFile(files)`：`effectivePath = path 非空 ? path : filename`；**含 `/` 即非根**；匹配键 `basename.toLowerCase()`；排序键 `effectivePath` 字典升序、同键按 `id` 升序 |
| 2 | `utils/default-file.ts` | 同文件 | `normalizeFileQuery(query, activeFileId, defaultFileId)` 纯函数：恒保留非 `file` 键；默认文件删键、非默认写 `String(id)`；**用「键不出现」而非 `null`** |
| 3 | `stores/entryDetail.ts` | 改 | `loadEntry` 两处 `entry.files[0]` → `resolveDefaultFile(entry.files)`；**预取 content 只在与 `targetFile` 同 id 时复用**（否则 `?file=` 指向 A 却展示 B 的正文） |
| 4 | `components/EntryCard.vue` | 改 | 删 `files?.[0]?.id` 分支（BDD-47），导航统一 `router.push('/' + slug)` |
| 5 | `components/EntryListRow.vue` | 改 | 同上 |
| 6 | `composables/useEntryDetailUrlSync.ts` | **新建** | `parseFileId` / `useEntryDetailUrlSync`（`suppressUrlSync` + `watch(activeFile.id)` → `router.replace` 合并 query + `handleFullscreen`）/ `useTocAutoExpand`（`watch(tocHeadings, …, {flush:'post'})` + `userToggledToc` 守卫） |
| 7 | `views/EntryDetailView.vue` | 改 | 首屏读 `route.query.file`（`Number` + `Number.isInteger`，失败即 `undefined`）；`firstFileId` **白名单化只删它**；`@toc-headings="setTocHeadings"`；两端 `:active-file` + `@fullscreen`；`toggleToc`/`toggleTocDrawer` 走守卫 |
| 8 | `components/EntryDetailContent.vue` | 改 | `<HtmlViewer :file="activeFile">`、`<TreeView :size="activeFile.size">`（跨批 prop 接线）；`@headings="$emit('toc-headings', …)"`（删 `:headings`/`@select-heading`）；两个 desktop `<aside>` 的 `v-if` 加 `&& !zenMode` |
| 9 | `components/EntryDetailHeader.vue` | 改 | props 加 `activeFile?: File \| null`（`import type` 自 `@/types`）；emits 加 `'fullscreen'`；`.actions-area` 加 `Maximize :size="16"` `icon-btn`（`data-testid="detail-fullscreen-btn"`、`aria-label="全屏阅读"`、tooltip、`v-if="currentEntry && activeFile"`） |
| 10 | `components/EntryDetailMobileBar.vue` | 改 | props/emits 同型扩容；左簇加同型按钮（`data-testid="mobile-bar-fullscreen-btn"`，只 `aria-label` 无 tooltip）；`.mobile-bottom-bar` 的 `gap: var(--space-2)` → `var(--space-1)` |
| 11 | `utils/__tests__/default-file.spec.ts` | **新建** | `normalizeFileQuery` 4 例 + `resolveDefaultFile` 4 例（含「子目录 README 不被选中」「同键按 id 兜底」） |
| 12 | `components/__tests__/t031-entry-detail-view.spec.ts` | 改（RM-AG0107） | mock 里 `extractHeadings: vi.fn()` → `setTocHeadings: vi.fn()`（它已不是导出项） |
| 13 | `components/__tests__/t067-detail-framework.spec.ts` | 改（RM-AG0107） | 同上 |

### 逐条对应 P2 设计的 11 项

| P2 设计条目 | 落点 | 状态 |
|---|---|---|
| A-1 resolver 单点（D3） | `utils/default-file.ts:22-39` | ✅ 根判定/匹配键/排序键/id 兜底四项齐全 |
| A-2 store 唯一消费点 | `stores/entryDetail.ts:50-57` | ✅ 两处兜底合一 |
| A-3 删死代码（BDD-47） | `EntryCard.vue:149-151`、`EntryListRow.vue:152-154` | ✅ 删非修，`firstFileId` 字面量归零 |
| B-4 `normalizeFileQuery` 纯函数 | `utils/default-file.ts:41-52` | ✅ 键不出现范式，未 mutate 入参 |
| B-5 时机表（4 行） | `EntryDetailView.vue:252-267` | ✅ 首屏/归一/白名单清理/页内切换 replace 全部按表 |
| B-6 非数字校验（BDD-18） | `useEntryDetailUrlSync.ts:10-14` | ✅ `Number.isInteger` false → `undefined` → 回退 |
| B-7 无效/跨 entry 静默回退（BDD-16/17） | `stores/entryDetail.ts:51-52` | ✅ `find` miss → resolver，无横幅 |
| C0-1 Content 转发 `headings` | `EntryDetailContent.vue:56` | ✅ 删 `:headings`/`@select-heading`，改 `@headings` |
| C0-2 View 调 `setTocHeadings` | `EntryDetailView.vue:81` | ✅ 见下方 grep 自查 |
| C0-3 桌面 TOC 默认展开时序 | `useEntryDetailUrlSync.ts:74-83` | ✅ `watch(..., {flush:'post'})` + `userToggledToc` |
| C-8/9/10/11 全屏入口 + zen 侧栏 | Header/MobileBar/View/Content | ✅ 见上表 6-10 行 |

### C0 自查（单测抓不到的那条链）

```text
$ grep -rn "setTocHeadings" frontend-v3/src --include=*.vue --include=*.ts | grep -v useEntryDetailComputed.ts
frontend-v3/src/views/EntryDetailView.vue:81:      @toc-headings="setTocHeadings"
frontend-v3/src/views/EntryDetailView.vue:177:  entryTitle, tocHeadings, setTocHeadings, copyContent, downloadFile, downloadPack,
```

实跑证据（`:8888` 桌面 1280×800，`/k8s-deployment`）：`.toc-sidebar` **DOM 1 + 8 个条目**（此前恒为 0 → 桌面默认展开永不触发）。
点 TOC 按钮关闭后再切文件 → `.toc-sidebar` 仍 **0**（`userToggledToc` 守卫有效，未被异步到达的 `headings` 重新打开）。

### 实测 E2E 冒烟（`/k8s-deployment`，debug `:8888`，非 claim P5/P6）

| 判据 | 实测 |
|---|---|
| BDD-14 首屏 `?file=14` | `?file=14` 保留，正文为 `deployment.yaml`（`apiVersion…kindDeployment`） |
| BDD-19 页内切换同步 URL | 点 `deployment.yaml` → `?file=14`，`history.length` 34→34 **不增** |
| BDD-20 切回默认删参数 | 点 `README.md` → `location.search === ""` |
| BDD-21 刷新保留 | 直接 `goto ?file=14` → 仍显示 `deployment.yaml`（未回落 README） |
| BDD-25 默认文件入口 | 点 `[data-testid="detail-fullscreen-btn"]` → `/k8s-deployment/f`（**无** `file=`） |
| BDD-26 非默认文件入口 | `?file=14` 下点击 → `/k8s-deployment/f?file=14` |
| BDD-28 / 53③ zen 侧栏 | `/f` 下 `.file-sidebar` **0**、`.toc-sidebar` **0**、`.detail-header` `display:none`（`v-show` 范式保留） |
| BDD-24 移动底栏 | @390 与 @360：`barHeight` **64px**（未增高）、按钮热区在栏内、`overflowPx` **0**、spacer 余 **5.39px**（与 P2 预测数值一致） |
| BDD-31 全页全屏按钮计数 | 桌面普通态名称匹配 `全屏\|fullscreen` 的可点击元素 **== 1** |
| BDD-51 旧 `?firstFileId=14` | 打开后 URL 清为 `/k8s-deployment`、展示默认 `README.md`、**无** `.error-state` |

### 既有契约的转红与更新（RM-AG0107）

| 用例 | 转红原因 | 处置 |
|---|---|---|
| `t031-entry-detail-view.spec.ts:130` | mock 了 `extractHeadings`（`detail-outline` 批已删该导出） | mock 属性名改为 `setTocHeadings: vi.fn()`，断言未动（仍绿） |
| `t067-detail-framework.spec.ts:143` | 同上 | 同上（仍绿） |
| `t082-error-format.spec.ts:15` / `t082-store-split.spec.ts:71` | 我用行数预算放不下 URL 同步逻辑（View 曾 358 行、store 曾 150 行） | **不放宽既有契约**：把 URL 同步 + TOC 自动展开抽到 `composables/useEntryDetailUrlSync.ts`，最终 View **295 行**、store **145 行**，两 spec 回到绿 |

### 自查结果

```text
tests_filter（frontend-v3/）:
  npx vitest run src/utils src/components/__tests__/t031-entry-detail-view.spec.ts \
                  src/components/__tests__/t067-detail-framework.spec.ts
  → Test Files 11 passed (11) / Tests 250 passed (250)

全量前端: npx vitest run → Test Files 127 passed (127) / Tests 1514 passed | 4 skipped
          （本批开始时基线为 12F；现 0F，无新增失败）
typecheck: make typecheck → ✓ type check passed（exit 0）
build:     npx vite build → ✓ built in 13.06s（exit 0，dist/ 产物存在）
```

### 对 P2 设计的偏差申报

[DESIGN_GAP: P2 只规定 normalizeFileQuery 的纯函数形态与 View 内时机表，未规定实现落点；为守住既有 t082 行数契约（EntryDetailView<300 / entryDetail.ts<150），我把 URL 同步与 TOC 自动展开抽到新建 composables/useEntryDetailUrlSync.ts，纯函数与非纯逻辑仍分层（default-file.ts 无 Vue 依赖）]
[DESIGN_GAP: P2 D3 字面写「只要 fileId 命中就用预取的 content」，未覆盖 loadEntry 的预取 id 与最终 targetFile 不一致的情形；实现中加 targetFile.id === fileId 守卫，否则 ?file= 指向 A 时正文会错显 B]
[DESIGN_GAP: P2 D5 的 handleFullscreen 伪码用 {...route.query} 手拼，与本批 normalizeFileQuery 双源；实现改为复用 normalizeFileQuery（P2 文字本身已建议复用，此处仅记录伪码与实现的形态差异）]

[SCOPE+] 发现 `EntryDetailView.vue` 原 `:244` 的 `router.replace({query:{}})` 不只误删 file/share，也承担「消费 firstFileId」；白名单化后该职责移到 syncUrl()（每个出口都调它），故路由参数在切换 slug 时也会被归一（P2 时机表未覆盖跨 entry 导航，属必要连带）。

---

# 重试 #1（`retries[P4]` = 1 / 上限 3）— 评审 rejected 项修复

[PROD_NOT_TOUCHED] 全程未接触生产 `:8080`（实测未监听）、未触碰 `~/.peekview/`、未跑 CLI、未 commit。
全部探针走 `create_app(data_dir=mkdtemp, db_path=mkdtemp)` 的**进程内临时 app**（`tempfile.mkdtemp()` + `shutil.rmtree`），
与 `P4-review.md` §1 的取证方式同源。临时产物在 `.agate-tmp/`（未用 `/tmp`）。

> **`:8888` 不可用于本轮自测的实测依据**：`GET …/render?inject=…` 的响应**完全无报表块**（`id="peekview-inject-report"` 偏移 −1），
> 即该实例跑的是 P4 之前的代码且**未开 `--reload`**（`scripts/dev-server.sh:117` 无 reload 参数）。
> 三个 CRITICAL 都落在报表块/记账上，用它验证等于验证旧代码 ⇒ 改用进程内临时 app。
> 全程只 `DELETE` 自己造的 entry（按 slug，返回 200），未对 `:8888` 上任何既有 entry 做写操作。

## 1. 逐条对应修复清单（`P4-review.md` §7）

| # | 级别 | 文件:行 | 处置 |
|---|---|---|---|
| 1 | CRITICAL | `api/files.py:389` | ✅ `cost = len(data.content.encode("utf-8"))` |
| 2 | CRITICAL | `api/files.py:430-436` | ✅ `re.finditer(r"</body\s*>", html, re.IGNORECASE)` 取 `matches[-1].start()` |
| 3 | CRITICAL | `html_render_service.py:449-456` | ✅ 关键字可选 `file_ids: dict[int, int]` 旁路 map，`not_injectable` 补 `file_id` |
| 4 | MAJOR | `html_render_service.py` / `api/files.py:311` | ✅ **方案 C**：`inject: str \| None = Query(None, max_length=4096)` |
| 5 | MAJOR | `html_render_service.py:288-315` | ✅ `owners` 拆 `text_owners` / `binary_owners` |
| 6 | MINOR | §3-3 | ✅ 删 `parse_inject_ids` / `_BINARY_SIZE_LIMIT` 单源 / `REASONS` 单源 + 出口校验 / `useCsvParser.ts:64-65` |

## 2. C1 — 总预算记账单位错配

```python
cost = len(data.content.encode("utf-8"))   # 原：len(data.content)
```

采用评审推荐的 **A**（与 `record.size` 同口径），**未给 `SiblingFileData` 加字段**——P2 的「13 处既有 `inject_resources` 调用零改动」得以保持（实测仍为 13）。
二进制项的 `data.content` 本就是 base64 字符串，`len(encode("utf-8"))` 即其 ASCII 长度，与 P2 D6「二进制 sibling 的 base64 长度计入」一致。

**自测（进程内临时 app，12 × `'中'*670000` CSS）**：

```text
requested=12  inlined=4  len(skipped)=8
reasons={'total_budget': 8}
响应体 7.67 MiB（预算 8 MiB）
势不变式=True   总预算拦截=True   未失控=True
skip: {'file_id': 6, 'reason': 'total_budget', 'filename': 'c4.css', 'size': 2010000}
=> C1 PASS
```

> 修复前同素材：`inlined=12 / skipped=[]`、响应 **23.0 MiB = 2.88×** 预算且报表自称合规（评审 §2 实测）。
> 修复后累计按字节（4 × 2,010,000 = 8,040,000 ≤ 8,388,608；第 5 个起触发 `total_budget`），报表与事实一致。

## 3. C2 — `_append_inject_report` 下标错位

```python
matches = list(re.finditer(r"</body\s*>", html, re.IGNORECASE))
if not matches:
    return html + block
idx = matches[-1].start()
return html[:idx] + block + html[idx:]
```

**与评审建议的一处有意偏离（需 P7 知晓）**：评审写的是 `re.search(...)`（取**首个**匹配），原实现 `rfind` 取的是**最后**一个 `</body>`。
若照抄 `search`，§3-4 已登记的已知隐患（`<script>var s="</body>";</script>` 这类正文含字面 `</body>` 的素材）
会从「插错位（仍插在某个 `</body>` 前）」恶化成「插到脚本内字符串之后、`body` 的**第一个**真实闭合标签之前」，
即把一条已接受的 MINOR 变成行为改变。故保留「最后匹配」语义，只移除变形：
**免去 `lower()` 变形 + 在原文上大小写无关匹配**，这正是 C2 的根因（`str.lower()` 非保长，U+0130 → `i` + U+0307）。
顺带覆盖 `</BODY>` / `</body >` 变体（`\s*` + `IGNORECASE`）。

**自测（含 U+0130）**：

```text
HTTP 200
'</body>' in body == True
报表块在 </body> 之前 == True
正文 İstanbul 完好 == True
tail: …"requested": 1, "inlined": 1, "skipped": []}</script></body></html>
=> C2 PASS
```

单元级另测 7 形态（`İstanbul` / `İİİ` / 大写 `</BODY>` / `</body >` / 多 `</body>` / 无 body / 纯 ASCII），
全部满足 `len(out) == len(in) + len(block)` 且闭合标签完整。

## 4. C3 — `not_injectable` 缺 `file_id`

`SiblingFileData` **不加字段**（P2 明令）。改为 `render_html_file` 在 `siblings.append(data)` 处登记
`id(sibling) -> File.id`，以**关键字可选参数** `file_ids` 传入 `inject_resources`（与 `owners`/`consumed_out` 同风格）：

```python
sibling_file_ids[id(data)] = record.id
...
inject_resources(html, siblings, skipped_out=skipped, file_ids=sibling_file_ids)
```

`inject_resources` 内 `not_injectable` 项补 `"file_id": file_ids[id(f)]`，
并加 `if skipped_out is not None and file_ids is None: raise ValueError(...)` —— 防止后续调用方漏传而静默产出缺键条目。

**自测（42 CSS + README.md，两类 reason 共存）**：

```text
requested=43  inlined=39  len(skipped)=4
reasons={'count_limit': 3, 'not_injectable': 1}
两类共存=True   缺 file_id 条目=0   势不变式=True   file_id 去重=True
重放 P3 BDD-38③ 逐项断言=True
not_injectable 项：{'file_id': 2, 'filename': 'README.md', 'path': None, 'reason': 'not_injectable', 'size': None}
=> C3 PASS
```

> 正是评审预测的「定时炸弹」形态：修复前该形态下逐项 `assert isinstance(item["file_id"], int)` 会 `KeyError: 'file_id'`。
> **P3 断言一字未改**（本节全部是新增探针）。

## 5. M1 — `overflow` 无界（选 **C**，理由）

**决策：方案 C 单独** —— `inject: str | None = Query(None, max_length=4096)`，超长转 **422**，与 `share`（`api/entries.py:222` / `files.py:650`）的既有风格一致。

**为什么不选 B（评审推荐项）**：实测证明 B 的任何落法都撞 P2 冻结不变式 `requested - inlined == len(skipped)`：

```text
K=100, 500 个不存在 id：
  B-落法1（截断 overflow，不加汇总项）  len(skipped)=100    vs 500  -> 势不成立
  B-落法2（K 逐项 + 1 条汇总项）        len(skipped)=101    vs 500  -> 势不成立
         且汇总项 {reason,truncated_at,total} 无 file_id -> 违反「file_id:int 必填」
```

即 B 必须**同时**授权改势不变式与 schema，属需要 P2 批准的范围（派发指引也写明 A 需 P2 授权）。
**A 同理需授权，故不选**。

**C 的边界（诚实记录）**：C 把「无界」变成「**有界但仍可放大**」——4 KB 的 `inject` 平均 token 2–7 B 时可容纳约 585–2048 个 id，
`overflow` 项 ≈ 545–2008 项 × ~92 B ⇒ 响应 **49 KB–180 KB**（放大 12–45×），远好于原来的 5000 个 → 460 KB 的线性无界，
但**不是**把放大压到接近 1×。彻底消除需 B（改契约）或 A（改契约），二者均需 P2 授权。
建议 **P7 转抄本决策**，并把「`requested - inlined == len(skipped)` 与 `skipped[]` 逐项上限不可兼得」登记为契约级取舍。

**自测**：

```text
len(inject)=4899 -> HTTP 422（期望 422）
len(inject)=2099 -> HTTP 200（期望 200）
=> M1 PASS
```

现有用例的 `inject` 长度（单 id / 2–3 个 id）远低于 4096，未受影响（批次 89 passed 复验）。

## 6. M2 — `owners` 单命名空间

拆成两个命名空间，`_process_css_refs` 的 `_mark()` 相应拆为 `_mark_text` / `_mark_binary`（签名仍**关键字可选**，既有 8 处测试调用零改动）：

```python
text_owners: dict[str, SiblingFileData] = {}     # 随 text_map 一起填
binary_owners: dict[str, SiblingFileData] = {}   # 随 binary_map 一起填
consumed.add(id(text_owners[resolved]))          # 4 处原 owners[...] 改指正确命名空间
```

**自测（复现评审 §3-2 的单元形态）**：

```text
REPORT skipped: [{'file_id': 22, 'filename': 'a.css', 'path': None, 'reason': 'not_injectable', 'size': None}]
事实: 文本 styles/a.css 真已注入 = True   二进制 a.css 真已注入 = False
报表宣称 inlined file_id = {11}
=> M2 PASS
```

（修复前：报表把**真已注入的文本**记为 `not_injectable`，同时**真未注入的二进制**被判已消费而漏记。）

**关于评审提到的「HTTP 可达近亲」——我的实测结论与评审不同，请 P7 以本节为准**：
评审称「同一 entry 两份 `filename='app.css'` → 报表 `inlined=1`，**两份内容都没进响应**（谎报）」。
我复现该素材，断言其根因**不在 `owners`，而在存储层**：

```text
POST 两份 app.css（一 text 一 binary）-> 201，DB 记录 id=[1,2]
GET …/files/1/content -> b'\x89PNG\r\n\x1a\nzzzz…'   ← 记录 1（text）读到的是二进制内容
GET …/files/2/content -> b'\x89PNG\r\n\x1a\nzzzz…'
磁盘实际文件数 = 1  [(data/default/1/app.css, 48 B)]
```

即同名 sibling 在**落盘写入时**就互相覆盖（一个路径只有一个文件），DB 保留两行但内容全被后者覆盖。
因此 `inlined=1` **是准确的**：记录 2（binary）的内容确实进了响应，记录 1 因内容已被覆盖故不可能独立落地——
这属于「同 entry 同名文件」的既有存储语义，不属本任务 BDD-40② 的「静默缺少 sibling 且无记录」（它有记录且记录与事实一致）。
**未在本轮修复**：改存储命名策略会动 entry 写入路径，超出 P1 范围。标记为 `[SCOPE+]` 供主 Agent 决定是否登记。

## 7. MINOR（4 条）

| 位置 | 处置 | 理由 |
|---|---|---|
| `html_render_service.py:132 parse_inject_ids` | **删除** | 全仓零调用（含测试）；标 `@deprecated` 会留下新的死代码面，删更干净。已复验 `grep parse_inject_ids` 无残留 |
| `html_render_service.py:21 _BINARY_SIZE_LIMIT` | **单源 import** | 删 `api/files.py:51` 的重复定义，改为从 service 导入；注释相应改为「single source; consumed by api/files.py」 |
| `html_render_service.py:26 REASONS` | **单源 + 出口校验** | 改 `frozenset`，并在 `build_skip_report_html`（唯一序列化出口）加 `unknown = {...} - REASONS; raise ValueError`。这样它从"无生产消费的死常量"变成**真正的运行时闸门**，与测试侧那份（`test_html_render.py:684`）即便漂移也会立即被生产代码挡住。**测试侧那份未动**（P3 冻结） |
| `useCsvParser.ts:64-65` | **删冗余重置** | `commit()` 内已 `row = []; field = ''`，调用点再重置一次语义不变（判定发生在 `commit()` 之前） |

## 8. 自查结果

```text
批次自查: cd backend && .venv/bin/python -m pytest \
            tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py -q
          → 89 passed（0 failed / 0 error）

计数核对: '= inject_resources('  测试文件 13  / 全后端 14（含生产唯一 1 处）
          '_process_css_refs('   测试文件 8   / 全后端 12（含定义与 3 处生产内部调用）
          → 与派发指引要求的 13 / 8 **完全一致**（两项指标均按「测试文件内的调用点」口径）

lint:     make lint → ruff check peekview/ tests/ → All checks passed!（exit 0）

前端:     make test-frontend → Test Files 127 passed / Tests 1514 passed | 4 skipped（与基线一致，0F）

全量后端: 见 §9（预存 test_cli_remote 失败另计）
```

## 9. 全量后端与既有契约

见本次返回摘要；`test_cli_remote.py::test_config_set_remote_api_key` 为**预存失败**
（`OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`，与本次改动无关）。

## 10. 未改动的红线项（逐项确认）

| 红线 | 状态 |
|---|---|
| P3 测试断言 | **零改动**（区间 `test_html_render.py:664+` / `test_entry_file_order.py` 未触碰；未新增也未修改断言） |
| 前端（除 `useCsvParser.ts:64-65`） | 未动。design-review 已 approved 的 17 个文件零改动 |
| `_MAX_INJECT_TOTAL_BYTES` = 8 MiB | 未变 |
| `_MAX_INJECT_IDS` = 40 | 未变 |
| `REASONS` 六元 | 未变（仅改类型为 `frozenset`） |
| CSP 与响应头 | 一字未改（本轮 diff 未触及 `RENDER_CSP` 与 `headers=`） |
| `SiblingFileData` 字段 | 未加字段（保住 13 处既有调用零改动） |
| commit | 未 commit |

## 11. 偏差与待主 Agent 裁决

[DESIGN_GAP: C2 修复未照抄评审建议的 `re.search`（取首个匹配），改为 `re.finditer` 取 `matches[-1]`——因原实现 `rfind` 语义是「最后一个 `</body>`」，照抄 `search` 会把 §3-4 已登记的 MINOR（正文含字面 `</body>`）从「插错位」变成「插错位置且行为改变」。根因（`lower()` 变形致下标偏移）已按评审处方消除]

[SCOPE+] M2 复现中发现的「同 entry 两份同名 sibling」形态：根因是**存储层同名覆盖**（磁盘仅 1 个文件），非 `owners` 缺陷；报表 `inlined` 与事实一致。修复需改 entry 写入命名策略，超出 P1 范围，未在 P4 处置]

[CLARIFY: M1 选中方案 C 后，评审 §3-1 建议的 B 经实测确认会破坏 P2 冻结势不变式与 `file_id` 必填约束（见 §5）。若主 Agent 希望把放大从 12–45× 压到接近 1×，需先由 P2 裁决是否放宽 `requested - inlined == len(skipped)` 或允许 `overflow` 汇总项无 `file_id`]

---

## 重试 #2（P6.5 judge 退回）—— BDD-38 Then③ 补齐实现

> 触发：`P6.5-judge-verdict.md` `status: needs-revision`，53/54 PASS，唯一 FAIL = **BDD-38 Then③**。
> [PROD_NOT_TOUCHED] 全程只用 `:8888`（只读探测）与 `:8892`（新代码独立 debug 实例，
> `DATA_DIR=.agate-tmp/debug-8892`）；未触碰 `:8080`、未读写 `~/.peekview/`、未用 CLI 造删 entry、未 commit。

### 1. 缺陷与根因

P1 `:373` 的 BDD-38 Then③ 原文：**「清单中每一项可对应到具体文件名」**。

judge 从 `P6-evidence/logs/bdd38-41-live-http.log:19` 的证据判 FAIL：该日志自报 `③ 每项可对应到具体文件名 = False`，
`skipped[0] = {"file_id":143,"reason":"count_limit","filename":null,...}`。

根因在 `api/files.py`（改动前 `:334-343`）：`count_limit` 项把 `filename`/`path`/`size` **硬编码成 `None`**。
这些 id 来自 `select_inject_ids()` 的 `overflow`，即**超过 40 上限而未被选中的 id —— 文件本身在 DB 里存在**。
所以这是「选择不查」，不是「查不到」。

P2-design `:410` 当初的判断「`get_files_by_ids` 只返回命中行 → 溢出 id 从未被查询 → 拿不到文件名」
**前半对、后半错**：没查 ≠ 查不到。该判断把「未查询」当成「不可知」，
并据此允许 `filename: null` —— 这等于用实现层的 schema 决策反向削弱了 P1 的 **Then 语义**，
且没走 `[BASELINE_CHANGE]` 程序。judge 判 FAIL 成立。

### 2. 修复（代码 2 处）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `backend/peekview/api/files.py:334-362` | `overflow` 分支补**一次**批量 `get_files_by_ids(entry_id, inject_ids.overflow)`，按 id 建 map 后填 `filename`/`path`/`size`；DB 中确实不存在的 overflow id 改归 `not_found` |
| 2 | `backend/tests/test_html_render.py:752-771` | `test_bdd_38_exceeding_count_limit_produces_skip_report` 判据**收紧回 P1 Then③ 原文**；另新增 `:772-827` 一条语义区分用例 |

**查询次数**：只在 `if inject_ids.overflow:` 内加 1 次 `get_files_by_ids(...)`（**一次 `IN` 查询，非 N+1**）；
`overflow` 为空时**零新增查询**（`else` 给 `{}`，不进 DB）。原先 `selected` 的那次查询未动。

**语义修正（本轮的核心判断）**：

| reason | 语义 | `filename` |
|---|---|---|
| `count_limit` | 文件**存在**，但超出 `_MAX_INJECT_IDS` 上限未被选中 | **必须**非空（本轮后由 DB 记录填入） |
| `not_found` | 客户端传的 id 在 DB 中**不存在** | `null`（真不可知） |

改动前，一个排在 40 之后的瞎编 id 也会被归入 `count_limit` —— 那是错的：
它不属于「超过上限」，而属于「DB 无此 id」。本轮把这两类拆开；`REASONS` **仍是六元**，未新增 reason。

### 3. `not_found` 类允许 `filename: null` 的边界（显式说明）

BDD-38 Then③ 的语境是**「被跳过的 sibling 能对应到文件名」**，隐含前提是**该文件真实存在**。
客户端可以用 `?inject=` 传任意整数，包括本 entry 里根本不存在的 id ——
此时没有文件名可言，`filename: null` 是**事实的忠实表达，不是判据的削弱**。

因此本轮的边界是：

- **`count_limit` 类：一律必须能对应到文件名**（本轮修复点，判据按 P1 原文收紧）
- **`not_found` 类：允许 `filename`/`path`/`size` 全为 `null`**，但 `file_id` 仍必填（可定位到「是哪个请求的 id 没命中」）

关键区别：`not_found` 项**查询后依然无行**，所以 null 是**查询的结果**，而不是**放弃查询**。
这与改动前 `count_limit` 的 `null` 有本质不同——后者从未发起查询。

### 4. 判据收紧（恢复基线，非新增需求）

`test_bdd_38_exceeding_count_limit_produces_skip_report` 的 ③ 由

```python
# 改动前（judge 判为「未经批准的判据替换」）
# ③ 清单每项可按 file_id 定位（filename 可为 null）
assert isinstance(item["file_id"], int)
```

改为 P1 原文语义：

```python
# ③ 清单每项可对应到具体文件名（P1 BDD-38 Then③ 原文）
assert item["reason"] != "not_found", item          # 本用例的 id 全部真实存在
assert isinstance(item["filename"], str) and item["filename"], item
```

并给 ④ 补正向覆盖：`count_limit` 项必须出现，其 `filename` 必须落在用例真实创建的文件名集合内、
`size` 必须为正整数——否则「有文件名」可能只是空串/占位名，判据仍可被假绿钻过。

**这不是新增需求**——改的是测试判据回到 P1 `:373` 的文字；`P1-requirements.md` 一字未动（见 §6）。

### 5. 三条自测（独立于既有用例）

脚本：`.agate-tmp/selftest_bdd38_fix2.py`（in-process ASGI，真实 FastAPI 栈 + 真实 DB，
与 BDD-38 Given 同形态覆写 `max_entry_files=N+1`，N=41 sibling）与
`.agate-tmp/selftest_bdd38_fix2_live8888.py`（真 HTTP，独立新代码实例 `:8892`，
经 HTTP API 造件、按 **slug** 删除）。

```text
N siblings=41  _MAX_INJECT_IDS=40  期望 overflow=1

[①] count_limit 项数=1  [{'file_id': 42, 'reason': 'count_limit', 'filename': 's40.css', 'path': 's40.css', 'size': 15}]
[①] count_limit 项有非空 filename = True
[③] requested=41 inlined=40 len(skipped)=1  requested-inlined==len(skipped) = True

[②] 存在的 overflow id=42 -> {'reason': 'count_limit', 'filename': 's40.css', ...} => count_limit+有文件名 = True
[②] 瞎编 id=9000001 -> {'reason': 'not_found', 'filename': None, 'path': None, 'size': None} => not_found+filename null = True
[③] 混合请求 requested=42（期望 42） inlined=40 len(skipped)=2 势成立=True

清理 DELETE -> 200（复核 GET -> 404）
SELFTEST_RESULT = PASS
```

| 自测 | 内容 | 结果 |
|---|---|---|
| ① | `count_limit` 项有非空 `filename` | **PASS** — `filename='s40.css'`、`size=15`（修复前 `null`/`null`） |
| ② | 存在的 id 归 `count_limit`、瞎编 id 归 `not_found` | **PASS** — 同一响应内两类并存且语义正确（修复前瞎编 id 也被归 `count_limit`） |
| ③ | 势不变式 `requested - inlined == len(skipped)` | **PASS** — 41-40==1；混合请求 42-40==2 亦成立 |

真 HTTP（`:8892` 新代码）复现同样三条，并额外核红线：

```text
HTTP 200
CSP 含 connect-src blob: data: https: = True
Cache-Control: no-store / Referrer-Policy: strict-origin-when-cross-origin
reasons: ['count_limit', 'not_found']   ⊆ 六元闭集 = True
势: 3 == 3 = True
五字段齐全 = True / file_id 全为 int = True / file_id 无重复 = True
not_found 项 filename 全 null = True / count_limit 项 filename 全非空 = True
limits: {'maxInjectIds': 40, 'maxFileBytes': 2097152, 'maxTotalBytes': 8388608}
```

### 6. 红线逐项确认

| 红线 | 状态 |
|---|---|
| `P1-requirements.md` | **零改动**（`git status` 中无该文件） |
| `_MAX_INJECT_IDS` = 40 | 未变（实测报表 `limits.maxInjectIds: 40`） |
| 单文件 2 MiB / 总预算 8 MiB | 未变（实测 `2097152` / `8388608`） |
| `REASONS` 六元 | 未变，**未新增 reason**（`not_found` 本就在闭集内，此前只用于 `selected` 分支） |
| `skipped[]` 五字段 schema | 未变（实测每条恰好 5 键） |
| `file_id` 必填 | 未变（`not_found` 类同样必填） |
| CSP 与响应头 | **一字未改**（diff 未触及 `RENDER_CSP`、`headers=`；实测响应头一致） |
| 前端 | **未动**（本轮只改 `backend/`） |
| 查询次数 | 新增**恰好 1 次**批量 `get_files_by_ids`；`overflow` 空时 0 次 |
| commit | 未 commit |

### 7. 自查结果

```text
批级 pytest  cd backend && .venv/bin/python -m pytest
             tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py
             → 90 passed / 0 failed（原 89 + 本轮新增 1 条）

计数核对     '= inject_resources('   测试文件 13（未变）
             '_process_css_refs('    测试文件  8（未变）

lint         make lint → ruff check peekview/ tests/ → All checks passed!（exit 0）

全量后端     make test-quick → 1 failed / 1222 passed / 3 skipped
             失败集不变：仅预存 test_cli_remote::test_config_set_remote_api_key
             （沙箱 ~/.peekview/ 只读，与本次改动无关）；基线 1221P → 1222P = 本轮 +1 用例
```

### 8. 一条需主 Agent 处置的环境事实（不阻断本次实现，但阻断 P6 重跑）

现网 **`:8888` 进程运行的是改动前的代码**：向其发 `?inject=` 实测仍返回
`{"reason":"count_limit","filename":null,...}`，且瞎编 id 仍被归入 `count_limit`。
该进程位于我沙箱的 PID / `/tmp` namespace 之外（`/tmp/peekview-debug.pid` 不可见、`/proc` 内无 uvicorn 进程），
**我无法重启它**。故改用独立新实例 `:8892`（`DATA_DIR=.agate-tmp/debug-8892`，非 `/tmp`）完成全部真 HTTP 验证。

→ **P6 重跑 BDD-38 现场证据前，须先重启 `:8888`**，否则新证据仍会读到旧代码、Then③ 仍为 `False`。
这是本轮唯一未闭环项，且不是代码问题。

### 9. 偏差申报

本轮无新增 `[DESIGN_GAP]` / `[SCOPE+]`。
唯一「偏离 P2 文字」之处是把 P2-design `:410` 的「`count_limit` 的 `filename` 可为 `null`」**作废**——
但该判断正是 judge 判定为「未经批准削弱 P1 判据」的那一条，本轮处置是**回到 P1 原文**，
属恢复基线而非实现层自主决策，故不按 `[DESIGN_GAP]` 记。
按 `[BASELINE_CHANGE]` 语境，应由主 Agent 在 P2 追加一句更正说明（P2 已冻结，我不改）。
