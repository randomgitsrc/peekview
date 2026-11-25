---
phase: P2
task_id: TPV0104
type: design
parent: P1-requirements.md
trace_id: TPV0104-P2-20261124
status: draft
created: '2026-11-24'
agent: architect
candidate_count: 6
packages:
- peekview
- frontend-v3
- docs
domains:
- frontend
- backend
ui_affected: true
ui_design_section: true
dispatch_plan:
  mode: static-batch
  parallel_limit: 4
  batches:
  - id: backend-render-budget
    complexity: high
    tests_filter: python -m pytest tests/test_html_render.py tests/test_entry_service.py
      tests/test_entry_file_order.py -q
    output:
    - backend/peekview/services/html_render_service.py
    - backend/peekview/api/files.py
    - backend/peekview/services/entry_service.py
    - backend/tests/test_html_render.py
    - backend/tests/test_entry_file_order.py
    - docs/architecture/html-preview-security-modes.md
  - id: detail-outline
    complexity: medium
    tests_filter: npx vitest run src/composables/__tests__ src/components/__tests__/MarkdownViewer.spec.ts
      src/components/__tests__/TocNav.spec.ts
    output:
    - frontend-v3/src/composables/useMarkdown.ts
    - frontend-v3/src/composables/useEntryDetailComputed.ts
    - frontend-v3/src/components/MarkdownViewer.vue
    - frontend-v3/src/components/TocNav.vue
  - id: detail-navigation
    complexity: high
    tests_filter: npx vitest run src/utils src/components/__tests__/t031-entry-detail-view.spec.ts
      src/components/__tests__/t067-detail-framework.spec.ts
    output:
    - frontend-v3/src/utils/default-file.ts
    - frontend-v3/src/stores/entryDetail.ts
    - frontend-v3/src/views/EntryDetailView.vue
    - frontend-v3/src/components/EntryDetailContent.vue
    - frontend-v3/src/components/EntryDetailHeader.vue
    - frontend-v3/src/components/EntryDetailMobileBar.vue
    - frontend-v3/src/components/EntryCard.vue
    - frontend-v3/src/components/EntryListRow.vue
  - id: data-viewers
    complexity: medium
    tests_filter: npx vitest run src/composables/__tests__/useCsvParser.spec.ts src/components/__tests__/TableView.spec.ts
      src/components/__tests__/HtmlViewer.spec.ts src/components/__tests__/TreeView.spec.ts
    output:
    - frontend-v3/src/utils/file-bytes.ts
    - frontend-v3/src/types/structured-data.ts
    - frontend-v3/src/composables/useCsvParser.ts
    - frontend-v3/src/components/TableView.vue
    - frontend-v3/src/components/TreeView.vue
    - frontend-v3/src/components/HtmlViewer.vue
prod_touched: false
---

# P2-design — TPV0104 Viewer 正确性与资源边界加固

> 上游：`P1-requirements.md`（54 条 BDD，第 3 轮终审 approved）+ `P1-review.md`（2 项残留 WARNING：W-r3-1 / W-r3-2）+ `P0-brief.md`（决策 1–7）。
> 本文**不重新讨论需求**，只回答「怎么实现」；**不削弱任何 BDD 判据**。
> 所有源码事实、数值、行为均在本阶段实测（见 `minimal_validation`），不凭印象。

[PROD_NOT_TOUCHED] 全程只读源码 + 只用 debug `:8888`（现造 entry 用完即 DELETE）+ pytest 临时 app（`mkdtemp`）；未接触生产 `:8080`，未触碰 `~/.peekview/`，未跑任何 CLI 写命令，未 commit。

---

## 0. 影响面梳理（强制节，先于候选方案）

> 三部分：改什么 / 不改什么 / 风险在哪。依据是 grep 实测命中 + 消费方代码 + gate 校验口径，不是印象。

### 0.1 改什么（Modify）— 逐文件到函数/小节 + 关联 BDD

#### A. 后端（`peekview`）

| 文件 | 落点 | 改动 | 关联 BDD |
|---|---|---|---|
| `backend/peekview/services/html_render_service.py` | `:17` 常量区 | `_MAX_INJECT_IDS` **50 → 40**；新增 `_MAX_INJECT_FILE_BYTES = 2*1024*1024`、`_MAX_INJECT_TOTAL_BYTES = 8*1024*1024`；`_BINARY_SIZE_LIMIT` 保留（该文件内是死常量，见 0.2） | 38 ④、39、40 |
| 同上 | `parse_inject_ids()`（`:54-74`） | 改为 `select_inject_ids(inject, main_file_id, limit) -> InjectSelection`（`selected: list[int]` + `overflow: list[int]`）；**保留** `parse_inject_ids` 作为薄包装（回 `list[int]`，供旧签名调用者）；`break` 处把溢出 id 落进 `overflow` 而非静默丢 | 38 ①②③ |
| 同上 | `inject_resources()`（`:177-330`） | **签名与返回类型不变**（仍返回 `str`），只增**可选出参** `skipped_out: list[SkippedResource] \| None = None`：`inject_resources(html, siblings, skipped_out=None) -> str`。新逻辑（单文件 `_MAX_INJECT_FILE_BYTES` / 总量 `_MAX_INJECT_TOTAL_BYTES` 超限）经 `skipped_out` **回传**而非改返回值 → **13 处既有测试调用（`grep -c "= inject_resources(" tests/test_html_render.py` = 13）零改动**（既有断言形如 `assert 'type=\"module\"' in result`，对 `str` 求值恒成立；改 tuple 会让 13 处全红）。新增 `build_skip_report_html(skipped, limits) -> str` 产出 JSON 块（含 `<` 转义，见下） | 39、40、41 |
| `backend/peekview/api/files.py` | `_build_sibling_data()`（`:270-300`，**本任务记账落点**） | 现有 `if file_record.is_binary and file_record.size > _BINARY_SIZE_LIMIT: return None`（**`:272-273`**，`:271` 是该函数 docstring 自述「None if skipped (oversized binary)」）**是注入路径上的既有静默丢弃**——唯一调用方是 `render_html_file`（`:336`）→ 本函数。**注意：这是 `_BINARY_SIZE_LIMIT` 在全仓的唯一消费点**（详见 §0.2 与 §11.7）。**函数签名不变**（仍 `-> SiblingFileData \| None`），由**调用方**在收到 `None` 时补记一条 `reason="binary_too_large"` 的 skipped 项（`size` 取 `file_record.size`） | 40 ② |
| `backend/peekview/api/files.py` | `render_html_file()`（`:303-354`） | 预算编排：`select_inject_ids` → `get_files_by_ids` → 逐文件大小检查 → 累计总量检查 → `inject_resources(..., skipped_out=skipped)`；把 `not_found` / `count_limit` / `file_too_large` / `total_budget` / **`binary_too_large`（`_build_sibling_data` 返回 `None` 时）** 五类预算层跳过项汇总，**并接收 `inject_resources(..., skipped_out=)` 追加的第六类 `not_injectable`**（B4，六类合并后统一序列化）；响应体尾部追加 `<script type="application/json" id="peekview-inject-report">`，内容用 `json.dumps(report, ensure_ascii=False).replace("<", "\\u003c")`（**必须转义 `<`**：`path` 用户可控且实测无过滤，未转义会提前闭合 `<script>` 并注入 DOM，实测见 V9）。**响应头与 CSP 一字不改** | 38、39、40、41、46 |
| `backend/peekview/services/entry_service.py` | `:432`、`:950`、`:1083`、`:1374`、`:1423`、`:1429` | 六处 `select(File)` 统一补确定性排序 `order_by(func.coalesce(File.path, File.filename), File.id)`；抽 `_files_of_entry(session, entry_id)` 单点 helper，六处改为调用它 | 13（并支撑 08–12） |
| `backend/tests/test_html_render.py` | 新增用例 | **预算五态**（无超限等价 / 数量超限 / 单文件文本超限 / 总量超限 / **>768KB 二进制 sibling → `binary_too_large`**）+ 跳过清单可解析（**含 `<` `>` `</script` 敏感字符的文件名与 path，G2**）+ `_MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1` 代码级关系断言（**+ 一条反向断言**，见 D6）。**13 处既有 `= inject_resources(...)` 调用零改动** = 本文件进 `tests_filter` 的真因（G5） | 38、39、40、41 |
| **新建** `backend/tests/test_entry_file_order.py` | 新增用例 | 构造序 ≠ 字典序时 `GET /entries/{slug}` 两次一致且等于「path 非空取 path、否则 filename」字典序 + id tie-breaker；**并显式断言 `POST` 序 ≠ `GET` 序**（G3，护住 R1 的契约面） | 13 |
| `docs/architecture/html-preview-security-modes.md` | 新建 | 两档定义 + 当前默认（交互式 Demo）+ 明示「仍允许 `connect-src https:` 外传，收紧属独立决策」 | 45 |

#### B. 前端（`frontend-v3`）

| 文件 | 落点 | 改动 | 关联 BDD |
|---|---|---|---|
| `src/composables/useMarkdown.ts` | `:67-75` `slugify`（保留）、`heading_open` renderer（`:329-343`） | 层级过滤 `level>=2 && level<=4` → **`level>=1 && level<=4`**；`text` 改为 **inline token 的纯文本**（`text`/`code_inline` 取 `content`、`softbreak`→空格）；id 生成用纯文本跑 `slugify`；加 `Map<string,number>` 去重产出 `id`/`id-1`/`id-2`；`token.attrSet('id', id)` 与 `headings.push({level,text,id})` 在**同一处**完成 | 01、02、03、04、05 |
| `src/composables/useEntryDetailComputed.ts` | `:51-78`（`extractHeadings` + `tocHeadings` computed） | **删除** `extractHeadings`（逐行正则归零，BDD-07）；`tocHeadings` 改为 `ref<TocHeading[]>` 容器 + `setTocHeadings(list)` 写入 + `watch(activeFile.id)` 清空；导出保持 `tocHeadings` 名字不变（3 个消费组件零改动） | 07、01–05 |
| `src/components/MarkdownViewer.vue` | `:109-111` | 保持 `emit('headings', result.headings)`；**删除** `defineEmits` 里无用的 `select-heading`（父侧 `@select-heading` 一并删，见下） | 01–05 |
| `src/components/TocNav.vue` | 样式 `:42-44` | **新增** `.toc-level-1` 规则（决策 B 扩 h1 后缺该档）+ **重做 h1 的可区分性**：**颜色与字重必须拆成两条规则**（`:not(.active)` 只挂颜色，字重不挂——见 R16）——<br>`.toc-item.toc-level-1 a { font-weight: 600; }`<br>`.toc-item.toc-level-1:not(.active) a { color: var(--c-text); }`<br>`.toc-item.toc-level-1 { margin-top: var(--space-3); }`<br>**注意**：`.toc-level-1 { padding-left: 0 }` 是 **no-op**（`.toc-item` 只有 `margin` 无 `padding`，该属性默认已 0），**不得**再作为层级手段（候选与实测见 §UI 设计「TOC h1 视觉层级」）；**`margin-top` 那条不挂 `:not(.active)`**（它挂在 `li` 上，与 `.toc-item.active a` 不同选择器、无特异性冲突） | 04、52 |
| `src/utils/default-file.ts` | 新建 | `resolveDefaultFile(files: File[]): File \| null`：根 `README.md`（大小写不敏感）→ 根 `index.md` → 稳定排序首个；`isRootFile(f)` / `fileBasename(f)` 同文件内导出（供 P3 单测） | 08–12 |
| `src/stores/entryDetail.ts` | `:49-53` | `entry.files[0]` 兜底全部改走 `resolveDefaultFile(entry.files)`；`loadEntry` 签名不变（`fileId?` 仍为「首选 id」，无效即 resolver 兜底） | 08–12、16–18、51 |
| `src/views/EntryDetailView.vue` | `onMounted`（`:232-247`）、`:254-258`、`:262-276` | ① 读 `route.query.file`（`Number.isInteger` 校验，非数字即忽略）→ 传 `loadEntry`；② 清 query **逐参数**：仅删除已消费的 `firstFileId`，`file`/`share` 一律保留；③ 新增 `watch(activeFile.id)` → `router.replace` 合并写入/移除 `file`（初始加载期用 `suppressUrlSync` 抑制）；④ 桌面默认展开改为 `watch(tocHeadings, …, {flush:'post'})`（render 异步到达后再展开） | 14–22、30、51 |
| `src/components/EntryDetailContent.vue` | `:4`、`:56`、`:61-62`、`:75-93` | ① 文件树 sidebar `v-if` 加 `!zenMode`；② TOC sidebar `v-if` 加 `!zenMode`（`inject(ZenModeKey)`，与 Header/MobileBar 同源）→ **DOM 不存在**；③ 删除无效绑定 `:headings`/`@select-heading`，改为 `@headings="$emit('toc-headings', $event)"` 透传；④ `HtmlViewer` 增传 `:file="activeFile"`，`TreeView` 增传 `:size="activeFile.size"` | 28、53 ③、42、44 |
| `src/components/EntryDetailHeader.vue` | **`defineProps`/`defineEmits`（`:113-158`）+ `.actions-area`（`:21-53`）** | **① 前置 prop/emit 扩容（R2-2，必须——实测该组件当前 `grep -c activeFile` = 0、`defineEmits`（`:146-155`）无 `'fullscreen'`，按设计直写会 `TS2339 + TS2345` 让 `make typecheck` 必红）**：`defineProps` 加 **`activeFile?: File \| null`**（`withDefaults` 里给 `activeFile: null`）——`File` 必须**从 `@/types` 显式 import**（`import type { Entry, File, ... }`），否则 TS 解析成 **DOM `File`** → `TS2322`（实测）；`defineEmits` 加 **`'fullscreen': []`**。<br>**② 新增 1 个 `icon-btn`**：`Maximize` 图标（`lucide-vue-next`，`:size="16"` 跟随既有兄弟按钮）/ `aria-label="全屏阅读"` / `data-testid="detail-fullscreen-btn"` / `<span class="tooltip">全屏阅读</span>`；`@click="$emit('fullscreen')"`；位置在 Copy 之后、Share 之前；**必须加 `v-if="currentEntry && activeFile"`**（404 页 `.actions-area` 仍渲染而 `activeFile` 为 null → 无守卫会在点击时抛 TypeError，见 R14/M2） | 23、25、26、31 ② |
| `src/components/EntryDetailMobileBar.vue` | 底部栏（`:2-51`）+ props/emits（`:70-95`）+ scoped 样式（`:102-116`） | **① props/emits 扩容（R2-2 连带核对：移动端同样缺——实测 props 14 项无 `activeFile`、emits 7 项无 `'fullscreen'`）**：`defineProps` 加 `activeFile?: File \| null`（`File` 同样从 `@/types` import），`defineEmits` 加 `'fullscreen': []`；`EntryDetailView.vue` 的 `<EntryDetailMobileBar>` 加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`。**注意两端的守卫差异**：移动端整栏已有 `v-if="isMobile && currentEntry"`（`:2`），**不新增 `activeFile` 也不会抛 TypeError**——但仍要加 prop，理由是其按钮的 `v-if="activeFile"` 需与桌面端判据同源（否则 entry 存在但 activeFile 为 null 的瞬时态会在移动端出现一个点了没反应的按钮）。<br>**② 新增同类 `icon-btn`**：`aria-label="全屏阅读"` + `data-testid="mobile-bar-fullscreen-btn"`，放在 `flex-spacer` **之前**（左簇）；不增高栏（`min-height:64px` 已定）。<br>**③ scoped `.mobile-bottom-bar` 的 `gap: var(--space-2) → var(--space-1)`**（8px → 4px）——这是**生效**的那条规则；`layout.css:538` 的同名 `gap: 4px` 被它覆盖，**不改**（见 R7 / V14） | 24、25、26 |
| `src/components/EntryCard.vue` | `:150-152` | **删除** `files?.[0]?.id` 死代码分支，导航统一为 `router.push('/' + slug)` | 47 |
| `src/components/EntryListRow.vue` | `:153-155` | 同上 | 47 |
| `src/utils/file-bytes.ts` | 新建 | `resolveFileSize(fileLike, content): number` —— `size` 为有限非负数时用 `size`（真实字节），否则 `content.length` 兜底（保留既有语义） | 42、43、44 |
| `src/components/HtmlViewer.vue` | `:82-104` | 新增 `file?: { size: number } \| null` prop；`contentSize` = `testContentSize ?? resolveFileSize(props.file, props.content)`；阈值 `SIZE_WARN/SIZE_BLOCK` 数值与 `>=` 语义**不动** | 42、43 |
| `src/components/TreeView.vue` | `:73-75` | 新增 `size?: number \| null` prop；`truncated` = `resolveFileSize({size: props.size}, props.content) > MAX_SIZE`；`MAX_SIZE` 数值不动 | 44 |
| `src/composables/useCsvParser.ts` | `:1-67` | 重写为单次状态机：`parsedDataRows`（始终计数）与 `constructedRows`（达 `maxRows` 后停止 push）**解耦**；**未闭合引号校验仍在扫完全文之后**（`:57-59` 语义保持）；返回值新增 `constructedRows` | 35、36、37 |
| `src/types/structured-data.ts` | `:11-16` | `CsvParseResult` 新增 `constructedRows: number`（必填，观测面） | 35 |
| `src/components/TableView.vue` | `:4-7` 截断 banner 的 `:message` | **字面文案（design M4）**：`` `数据量过大，已显示前 ${parsed.constructedRows.toLocaleString()} 行，共 ${parsed.totalRows.toLocaleString()} 行` ``。**为何用 `constructedRows` 而非 `maxRows`**：两者在截断态相等（都 == `maxRows`），但 `constructedRows` 是「实际进了数组的行数」的**同一个观测面**（D1），避免「banner 说 5 行、表格其实只渲染了 4 行」这类双源漂移；`totalRows` 直接消费 D2 的精确计数，不做第二份计算（防 R8 误用）。BDD-34 判据「文本含 `5` 与 `11`」由该串直接满足（10 数据行 / `maxRows: 5` → `已显示前 5 行，共 11 行`） | 34 |
| `src/components/TableView.vue` | `:5`、`:22-38`、`:127`、`:136`、`:183` | ① 两个 `shallowRef` 初值补 `constructedRows: 0`；② 截断提示文案见上一行；③ **`.th-sort-btn` 与 `.th-filter` 用 `v-if`/`v-else` 双分支**（不是「给既有 span 加条件」——`.th-label` 已存在于 `.th-sort-btn` **内部** `TableView.vue:28`，给 button 整体加 `v-if` 会连它一起消失）：`<button v-if="!parsed.truncated" class="th-sort-btn">…<span class="th-label">{{header}}</span>…</button>` + `<span v-else class="th-label">{{header}}</span>` + `<input v-if="!parsed.truncated" class="th-filter" … />`（表头文字仍可见、但**无可点击排序控件、无 input**） | 32、33、34 |
| `CHANGELOG.md` | `[Unreleased]` | P1 §5 列的 7 项用户可见变更 + V-05 文档说明（P8 执行，此处登记落点） | — |

#### C. 测试（P3 产出，此处只登记归属）

| 文件 | 动作 | 覆盖 |
|---|---|---|
| `frontend-v3/e2e/tpv0104-viewer-hardening.spec.ts` | **新建** | V-02 DOM 锚点/去重/层级/纯文本（01–05）、默认入口（08–12）、`?file=` 与 URL 一致性（14–22、51）、全屏入口与位置（23–31）、`/f` DOM 计数（28、53）、正文字节判定（42、44）、正文文件链接切换（54）、人工体验（52）、**TOC h1 与 h2 可区分（BDD-04 的视觉加强项，判据见 UI 设计校验点 ⑦）**、**标题不截断三档（M7，校验点 ⑥）** |
| `frontend-v3/e2e/tpv0104-mobile-bar-widths.spec.ts` | **新建（design M1 专用）** | 底栏**三档宽度守护**：360 / 375 / 390 各断言 `scrollWidth <= clientWidth` 且 `height <= 64`（`P5_e2e_mobile_widths` 的执行体；360 为最小支持宽度，P1 BDD-24 只钉 390 故需独立守护） |
| `frontend-v3/e2e/viewer.spec.ts`（2 处）、`t091-…`（4 处）、`tpv0099-…`（3 处） | `firstFileId` → `file` **迁移**（共 9 处字面量归零） | 50 |
| 单测 | `src/utils/__tests__/default-file.spec.ts`、`file-bytes.spec.ts`、`useCsvParser.spec.ts` 扩展（`constructedRows`）、`TableView.spec.ts` 扩展（截断态控件 0 / 未截断态生效）、`TreeView.spec.ts` + `HtmlViewer.spec.ts` 扩展（真实 `size` 通道）；`t031`/`t067` 的 `extractHeadings: vi.fn()` mock 同步删除 | 01–07、32–37、42–44 |

### 0.2 不改什么（Not Modify）— 看起来该改但决定不改

| 范围 | 决定 | 理由（含证据） |
|---|---|---|
| **`api/files.py:272` 的 `file_record.size > _BINARY_SIZE_LIMIT`**——**它就是 `_build_sibling_data` 内部那一行，且在注入路径上** | **必须改**（列入 0.1A，不属本栏） | **本轮独立复核更正了两处既有误判**：<br>① P1 §6.5 称「`api/files.py:272` 属二进制内容 serving 路径、不在注入路径上」→ **实测不成立**。`grep -n "_BINARY_SIZE_LIMIT" backend/peekview/api/files.py` 只有两行：`:48` 定义、**`:272` 消费**；`:272` 位于 `def _build_sibling_data`（`:270`）体内（`:271` 是其 docstring），而该函数的**唯一调用方**是 `render_html_file`（`:336`，在 `if inject_ids:` 块内）→ **这就是注入路径**。`download_file`（`:185-225`）与 `get_file_content`（`:226-268`）内**完全没有** `size` / `_BINARY_SIZE_LIMIT` 判断（实测 `grep -c "size"` 均为 0）→ 全仓**不存在**任何「按大小挡二进制」的 serving 逻辑。<br>② 上一版本设计称「`files.py:272` 与 `_build_sibling_data:272` 是同文件两个不同函数」→ **也不成立**，二者是**同一行**。<br>**结论**：`_BINARY_SIZE_LIMIT` 在全仓只有**一个消费点**，且就在注入路径上 → **没有「serving 路径那一处保持不动」的豁免**，这一行必须纳入 `skipped` 记账（`reason="binary_too_large"`）。**P1 基线不改**（其 §6.5 的措辞偏差已上报主 Agent，见 §11.7） |
| `html_render_service.py:18` `_BINARY_SIZE_LIMIT` | **不动**（也不删） | 该文件内**仅定义行、零消费**（实测 grep 计数 == 1）。删除属纯清理，但会让 `files.py` 的同名常量看起来像「唯一权威」而掩盖两处重复；保留并在文档注明「本文件内未使用」，避免顺手扩大 diff |
| `_CSS_RECURSION_LIMIT = 3` | **不动** | 与字节/数量预算不同维度，已有测试覆盖（P1 §6.5 明确「不处理」） |
| **最终 HTML 字节上限**（P0 决策 4 的第 4 级） | **不新增阻断，仅观测** | P1 §6.5 只说「不存在」，但**无任何 BDD 要求它存在**；而加上它会让「20MB 主 HTML + 零注入」也在现状可用的场景下失败（主文件上限 `max_file_size=20MB`），属 P1 未声明的用户可见限制。故第 4 级以「主文件字节 + 已完成注入字节」的派生计数**写入跳过清单的 `limits` 字段供观测**，不做阻断。理由与偏差登记见 §5 风险 R3 |
| `main.py:300` 主应用 CSP、`packages/mcp-server/**` | **不动** | P1 §6.4/§6.9 已判「不处理」：MCP 的 `content.length` 属另一子系统（跨包、后果不同）；主应用 CSP 与 HTML render 独立 |
| `markdown-test` 的 `team_id` / `playwright.config.ts` 的 `storageState` | **不动** | BDD-50 判据是「失败集不劣于基线」，不是全绿。改可见性或加登录态属**范围蔓延**（P1 §3.10 + dispatch 约束 7 明令） |
| `EntryDetailView.vue:239` 的 `f` 键 keydown、`useZenMode.ts` | **不动** | BDD-30 锁定「普通态 `f` 只切 zen、不改 URL」；`locked()` 首行 return 是决策 A 的既有意图（BDD-29） |
| `/f` 下的**退出入口** | **不新增** | BDD-29 约束型判据（决策 A + `DESIGN.md:210-212`） |
| `layout.css:650-657` 的全局 zen 隐藏集 | **保留不改** | 侧栏改为 DOM 不存在后，CSS 规则自然失效但仍服务 `.detail-header` 等 `v-show` 项；删它会造成 `f` 键 zen 的回归 |
| `useEntryDetailComputed.ts` 的 `scrollToHeading`/`handleNavigateFile` 语义 | **保留**（`handleNavigateFile` 只加 URL 同步，行为不变） | BDD-06/54 依赖既有 `scrollIntoView` 与页内切换 |
| `mapActiveFile`/`FileTree` 的树构建与排序 | **不动** | `FileTree.sortNodes` 已字典序；后端 `order_by` 只影响 `entry.files` 数组（resolver 输入）与 `raw` 接口，不改 UI 树序 |
| `backend/tests/**` 里 22 处 `files[0]` | **不动**（实测确认零连带） | **实测更正（eng B1）**：`_create_entry`（`test_html_render.py:44-55`）返回的是 **POST 创建响应**的 `files`（`create_entry()` 内的 `file_responses`，源是逐条 `session.add` 的 `file_records` = **构造序**），**不经 `select(File)`** → 补 `order_by`（只作用于 `get_entry`/`get_entry_files` 等 GET 侧查询）对本文件 `files[0]` **零影响**。全量实测：把 6 处 `order_by` 打进副本后跑 `tests/`，**零新增真实失败**。故「改该用例取 id 方式」这个动作**取消**（见 R1）。副作用：`POST` 序 ≠ `GET` 序这一事实需显式钉住 → 由新建 `test_entry_file_order.py` 断言 |
| `_MAX_INJECT_IDS` 的**跳标承载形态**（即 D7 的 `<script type="application/json">` 块本身） | **保留形态，但序列化必须转义 `<`** | eng B3：`path` 用户可控且实测无过滤（`POST` 接受 `</script><img src=x onerror=...>.css` → 201），`json.dumps` 不转义 `<` → 提前闭合 `<script>` 使其后内容成为活跃 DOM（`RENDER_CSP` 含 `unsafe-inline` → 会执行），同时破坏方案自定的 pytest 取证通道（BS4 `.string` 被截断 → `json.loads` 失败）。修法取「最小改动、不变更承载形态」：`json.dumps(...).replace("<", "\\u003c")`，实测还原无损（V9 重做） |
| `agate/scripts/` 下任何文件 | **不新增/不改名** | 本任务无协议脚本改动 → `agate/scripts/README.md`「新增脚本登记面」的实测要求**不适用**（显式声明，非跳过；理由：无新增文件即 CHECK 9 / SG.6 / CHECK 10 三处均不触发） |

### 0.3 风险在哪（Risk）— 每条配缓解措施

| # | 风险 | 证据 / 触发面 | 缓解措施 |
|---|---|---|---|
| **R1** | ~~补 `order_by` 让既有后端测试变红~~ → **实测更正：后端测试零连带失败；真实风险是「POST 序 ≠ GET 序」这一契约无人守护** | **实测（eng B1 复现）**：`POST(create) files order` = `['index.html','app.js']`（构造序）；`GET(detail)` / `raw` = `['app.js','index.html']`（`order_by` 生效）。`_create_entry`（`test_html_render.py:44-55`）取 **POST 响应**，不经 `select(File)` → 本文件 `files[0]` 断言**零影响**；全量打补丁后 **零新增真实失败** | ① 「改 `test_render_inject_js` 取 id 方式」这个动作**取消**（原判断为空转）；② BDD-13 风险由**中降为低**；③ 在新建 `test_entry_file_order.py` 里**显式断言「POST 序 ≠ GET 序」**（`assert post_filenames != get_filenames`，用构造序与字典序确实不同的素材）——否则未来有人把 `order_by` 也加到 POST 响应构造上时无人发现；④ `gate_commands.P5`（`make test-quick` 全量）作为兜底保留 |
| **R2** | **`?file=` 与初始加载竞态**：`watch(activeFile.id)` 可能在 `onMounted` 的 URL 清理之后触发，把刚删掉的 `file` 又写回 / 或把 `firstFileId` 语义复活 | 现状 `loadEntry` 内 `activeFile` 在 `await` 后赋值 → watcher 是异步后触发的 | 用 `suppressUrlSync` 标志：`onMounted` 内置 true → 加载 + 首次 URL 归一 → 置 false；watcher 首行 `if (suppressUrlSync) return`。**可观测性（eng N3）**：`suppressUrlSync` 是组件内局部 `ref`、未导出，为它开导出 = 为测试改生产 API → **不测该标志**，改为把 URL 归一逻辑抽成纯函数 `normalizeFileQuery(route.query, activeFileId, defaultFileId) -> query` 单独单测（默认文件 → 无 `file` 键；非默认 → `file=<id>`；`share` 恒保留）；真实 URL 与 `history.length` 仍在 E2E 层按 BDD-19/20/21 验 |
| **R3** | **预算数值选错**：上限过松时 BDD-38 的构造路径仍要覆写 `max_entry_files`（可接受），过紧时把合法多资源 demo 从可用变不可用（用户可见退化） | 实测：debug 造 6 sibling / 1.29MB 的真实形态 demo，注入后响应 1.28MB（**放大率 ≈ 0.994**，注入不放大体积）；仓库自身最重前端产物 7.28MB / 1.45MB / 2.64MB 是**应用 vendor 而非 entry sibling** | 取 `40 / 2MB / 8MB`：① `40 < 50-1=49` 满足 BDD-38 ④；② 40 个 sibling 覆盖绝大多数真实 demo（实测 49 个 sibling 的场景在本仓 seed 中不存在，seed 最大文件数 8）；③ 2MB 单文件与前端 `SIZE_BLOCK` 同数，两端同语言；④ 8MB 总量 ≈ 实测真实 demo（1.29MB）的 6 倍，且远小于 `max_entry_size`(100MB)。全部数值集中定义在 `html_render_service.py` 常量区，P6 可按 `limits` 字段核对 |
| **R4** | **跳过清单成为「第二权威源」**（常量一处、清单里再报一份）→ 双源漂移 | `limits` 字段既写数值又会被前端/测试读 | 清单内的 `limits` 由**同一批常量**直接序列化（不做第二份字面量）；P6 只断言「条目数 == N − 内联数」与文件名可对应，**不断言具体数值**（P1 BDD-38 判据本就不依赖数值） |
| **R5** | **TOC 默认展开时机**：`tocHeadings` 改为 render 上报后，`onMounted` 的 `nextTick()` 时点 headings 仍为空 → 桌面默认不展开 → BDD-01/03/04/52 找不到 `[aria-label="Table of Contents"]`（`v-if` 依赖 `tocHeadings.length>0`） | 实测桌面 1280×800：现状 `aria-expanded="true"`（`EntryDetailView.vue:243-246` 同步成立），因为现状 TOC 是**同步逐行正则** | 改 `watch(tocHeadings, (v) => { if (isDesktop && isMarkdown && v.length && !userToggledToc) isTocOpen = true }, {flush:'post'})`；用 `userToggledToc` 标志避免用户手动收起后被重新打开。P1 的幂等 When 已容忍 `"false"` 分支（点一次），故即使顺序有偏差也不产生假 FAIL |
| **R6** | **`zenMode` 注入到 `EntryDetailContent` 后影响移动端抽屉** | 移动端 TOC 走 `showTocDrawer` 抽屉，与 `.toc-sidebar` 不是同一条 `v-if` 链（P1 §3 实测） | 只给**两个 desktop sidebar** 加 `!zenMode`，抽屉分支（`:97-123`）一律不动；`/f` 下 mobile bar 本身 `v-show="!zenMode"` 已不可见 → 无法打开抽屉 |
| **R7** | **移动端底部栏新增按钮溢出**（**最小支持宽度 = 360px**，见 §UI 设计「移动端最小支持宽度」） | 实测（4 个 entry × 360/375，最坏情况 `nBtns=7` 含 wrap 按钮）：baseline 全部 `overflow=0`；插入 44px `icon-btn` 后 **@360 `scrollW 370 / clientW 360` → 溢出 10px**（`k8s-deployment` / `unicode-filenames` / `multi-format-demo` 三例复现；`json-api-config` 因只有 6 子元素不溢出）；@375 恰好用尽（`spacer 44.39 → 0`）；@390 有余量（`59.39 → 7.39`） | **定 360 为最小支持宽度**（Android Galaxy S 系列 360dp 属主流，`DESIGN.md §9` 只给 `<=640px` 上界未给下界，不声明即为事实遗漏）。解法：**把生效的那一处 `gap` 由 8px 收到 4px**——实测 @360 `overflow 10 → 0`（spacer 余 5.39px）、@375/@390 更宽余。**落点只有一个文件**：`EntryDetailMobileBar.vue` 的 scoped `.mobile-bottom-bar { gap: var(--space-2) }`（`--space-2` = 8px，这是**实际生效**的规则）；`layout.css:538` 里同名选择器写的是 `gap: 4px`，但被 scoped 规则覆盖（scoped 属性选择器特异性更高），改 scoped 后该行**自然与生效值一致、无需改动**（勿「顺手统一」去动它——那会扩大 diff 而不改变渲染）。**不选**「新按钮 ≤375 时进 overflow」（实测把 wrap 按钮移出后 @360 仍 `overflow 10`——单个 44px 按钮的代价与哪个按钮无关）也不选「把按钮做小」（38px 仍 `overflow 4`、40px 仍 `6`，且违反 `DESIGN.md §9` 触控目标 ≥44px）。**三档全绑死到 `P5_e2e`**：`scrollWidth <= clientWidth` 在 360/375/390 各断言一次（§UI 设计 ⑤） |
| **R8** | **`constructedRows` 语义被误用**：后续有人把它当「返回行数」 | 与 `rows.length` 数值在未超限时相等 | 类型注释写明「实际构造进数组的**数据行**数（不含表头），达 `maxRows` 即停止增长」；P3 用例同时断言「超限时 == maxRows」与「未超限时 == 数据行数」，形成双向锚点 |
| **R9** | **`HtmlViewer` 新增 `file` prop 后，测试/调用点遗漏** | 现有 `HtmlViewer.spec.ts` 与 `HtmlViewerIntegration.spec.ts` 用 `content` + 注入键 | prop 设为**可选**且缺省走 `content.length` 兜底 → 既有 8 个用例零改动保持绿；新用例显式传 `file: { size }` 走真实通道（BDD-42） |
| **R10** | **BDD-11 的 Given 形态与 API 语义不符**（P1 字面 `path=sub` 的 `README.md` 在磁盘上其实是**根级**名为 `sub` 的文件——`storage.get_disk_path` 把 `path` 当完整相对路径，实测 `POST path=sub` 落盘为 `sub`） | 实测：`{"path":"sub","filename":"README.md"}` 返回 `path='sub', filename='README.md'`；`FileTree` 以 `path?.trim() \|\| filename` 作树路径 → UI 显示根级文件 `sub` | **不改 P1 基线**。resolver 的根判定用 `basename(有效路径) == 文件名 && 路径不含 '/'`，对两种形态都成立：`path='sub'` → basename `sub` ≠ readme → 不选中（Then 满足）；真嵌套 `path='sub/README.md'` → 含 `/` → 非根 → 不选中。**P6 按 P1 字面执行即可 PASS**，另建议 P3 额外补一条真嵌套用例（不算新 BDD，属同一判据的加强覆盖） |
| **R11** | **`share` 参数不再被清理**（现状 `:238` 一锅端） | 实测：`?share=bogus&file=14` 打开后 URL 变成 `/k8s-deployment`（share 被抹）。BDD-22 要求 share 保留 | 清理逻辑白名单化：**只删 `firstFileId`**。风险：分享链接 token 会长期留在地址栏（隐私面）。缓解：不影响任何既有测试（实测全仓无「share 被移除」断言的用例），且 BDD-22/49 明确要求保留；P8 CHANGELOG 明示该变化 |
| **R12** | **批量 `v-if="!parsed.truncated"` 把表头做空** | `<th>` 内若只有被 `v-if` 掉的控件，表头会变成空列。**注意既有结构**：`.th-label` **已存在**于 `.th-sort-btn` **内部**（`TableView.vue:28`）——给 button 整体加 `v-if` 会**连同它一起消失**，此时「补一个 `span.th-label`」是**在另一分支再写一份**（不是「回退既有 span」） | 落点写成**明确的 v-if/v-else 双分支**（eng N4）：`<button v-if="!parsed.truncated" class="th-sort-btn">…<span class="th-label">{{ header.column.columnDef.header }}</span>…</button>` + `<span v-else class="th-label">{{ header.column.columnDef.header }}</span>` + `<input v-if="!parsed.truncated" class="th-filter" … />`。截断态表头文字仍可见、但**无可点击排序控件、无 input**（BDD-32 只禁这两者，不禁纯文本；BDD-33 回归守护未超限态控件存在）。**实测正面结论（保留）**：截断态换成 `span.th-label` 后表头**不塌陷**——`thead` 高 −28px、`tbody` 首行 top 同步 −28px、标签垂直居中偏差 −0.25px（design probe7）。`.th-filter` 删除后 `.th-filter` 样式（`:331`）与响应式覆盖（`:473`）无布局塌陷 |
| **R14** | **桌面全屏按钮缺显隐守卫 → 运行时 TypeError**（design M2） | 实测 `/definitely-not-an-entry-xyz`：`.actions-area` **DOM 仍为 1**，子元素只剩 `action-sep ×2 + overflow-menu + user-menu-wrapper + theme-toggle`（`canCopy`/`showShareButton`/`currentEntry` 各自 `v-if` 已把其余撤掉）。此时 `activeFile` 为 `null` → 点击处理里 `activeFile.id` 抛 **TypeError**；即使不抛也会 `router.push` 到不存在 slug 的 `/f` | 新按钮加 **`v-if="currentEntry && activeFile"`**（与点击处理的前置条件同源），明确「entry 不存在 / 无 activeFile 时不渲染」。移动底栏**已安全**（整栏 `v-if="isMobile && currentEntry"`），桌面 header 的 `v-if="isDesktop"` 与 entry 状态**无关**故必须单独加 |
| **R15** | **跳过清单 JSON 成为 XSS 载体 + 破坏自家取证通道**（eng B3） | `path` 用户可控且实测无过滤（`POST` 接受 `</script><img src=x onerror=alert(1)>.css` → **201**）；`json.dumps` 不转义 `<`。实测（V9 重做）：未转义时 JSON 文本内含字面 `</script`（位于 JSON 起点后 178 字符处）→ 其后的 `<img onerror>` **成为真实 DOM**（`stray img parsed: True`）；`BeautifulSoup(...).find("script",...).string` 取到 **178 字符半截** → `json.loads` 抛 `Unterminated string` | **序列化即转义**：`json.dumps(report, ensure_ascii=False).replace("<", "\\u003c")`。实测效果：JSON 文本**无字面 `</script`**、`stray img = False`、`json.loads` 成功且 `path` **roundtrip 完全一致**（`JSON.parse` / `json.loads` 均正确还原 `\u003c`）。同时消除 `</script` 与 `<!--` 两类问题，**不改承载形态、不改 CSP**。P3 用例必含 HTML 敏感字符素材（G2） |
| **R16** | **TOC h1 新规则吃掉 `.active` 强调色 / 或反过来丢掉加粗**（design R2-1 + 本轮细化） | `.toc-item.active a`（`TocNav.vue:41`，编译后 `0,4,1`）与新规则 `.toc-item.toc-level-1 a`（`0,4,1`）**特异性相同**，新规则源码在后 → 顺序胜出。实测 V18：A 原设计下 h1 **active 也变 `rgb(233,238,244)`**（强调色消失），且 `fw/mt` 三项与 inactive 完全相同 → 只断正向的判据对此缺陷**全真 = 漏检**。反过来，design 处方的「一条 `:not(.active)` 同时挡颜色+字重」会让 active 态 `fw` 掉回 **400**（实测）——**强调色回来了但层级信号在 active 态消失** | **颜色与字重拆两条规则**：`.toc-item.toc-level-1 a { font-weight: 600; }`（无条件）+ `.toc-item.toc-level-1:not(.active) a { color: var(--c-text); }`（只挡颜色）；`margin-top` 那条挂在 `li` 上、不挂 `:not(.active)`。实测 V18 `C 拆分` → inactive `rgb(233,238,244)/fw 600`、active `rgb(77,141,255)/fw 600`，两向都对。**并补反向断言**（UI 校验点 ⑦ / 完成标志 #10）：h1 active 时 `color == --accent-color` 的解析值 **且** `fontWeight !== '400'` |
| **R17** | **`not_injectable` 记账漏埋点 → 不变式在假值上"成立"**（B4 的实现侧风险） | 若只用 `used_text_keys` + `_sibling_keys()` 做「是否被消费」的判定，会漏三条真实消费路径：`b.css` 只经 CSS `@import`、`bg.svg` 只经 CSS `url()`、`fav.png` 只经 `<link rel=icon>`；二进制侧**连 used 集合都不存在**。实测 V17-④：「未引用二进制 + README.md」形态下报表自称 `inlined=1` 而实际嵌入 **0** → `2 - 0 = 2 ≠ len(skipped)=1`，**报表数字自洽但与事实不符**（比不改还危险：它看起来"有清单"） | **`consumed` 按 sibling 身份（`set[int]` of `id(f)`）建集合 + `owners` 全 map（text 与 binary 共用）+ 七处埋点**：① `<link rel=stylesheet>` ② `<script src>` ③ kind 追加 ④ `img/video/audio/source/track[src]`→二进制 ⑤ 同处→文本 SVG ⑥ `<link rel=icon\|shortcut icon>` ⑦ **CSS 内部**（`_process_css_refs` 透传 `owners`/`consumed_out`，含 `@import` 递归与 `url()` 两处）。**新参数必须关键字可选**（默认 `None`）→ 该函数既有 5 处测试调用零改动。实测 V17：七形态全部满足不变式 |
| **R13** | **P3 gate 不覆盖后端红灯**（残余风险，已实测量化） | 协议限制 `P3` 只能单 key/单命令/单 formatter（`agate-read-gate-commands.py:104-110`）；而「两端合一」会让命令超 `AGATE_TDD_TIMEOUT`(120s)、实测复合命令 **107s** → 触发 `judge_result` 的 exit 124 → **判为通过**（fail-open）；且 `make test-quick` 有预存失败（`test_cli_remote` 沙箱只读，另有偶发第二项未稳定复现 → **不计入裁决依据**，见 V12） | ① §5.1 把后端红灯取证写成**明确命令**（只选 `test_html_render.py` + 新建 `test_entry_file_order.py`，**不含**预存失败所在文件，实测当前基线 **73 passed / 0 failed / 0 error**）；② `P3-test-cases.md` 设「后端红灯证据」必填节，漏做即明显缺节；③ P7 一致性检查列为核对项。**残余风险接受理由**：把它并入 P3 的代价（gate 永久空转 = 假绿）严格大于漏做取证的代价，且后端用例写错的兜底还有 P5 全量 + P6 逐条 BDD 实跑 |

---

## 1. 候选方案（6 个 = 3 架构层 + 3 布局层，含权衡与选择理由）

> **候选分两层**（`candidate_count: 6`）：
> - **架构层 3 个（A / B / C）** 在**两处关键选型**上分叉：(i) TOC/正文锚点的**唯一生成点**落在哪一层；(ii) 注入超限的**反馈承载形态**。其余实现（resolver、CSV 计数解耦、字节数工具、表头 `v-if`、zen DOM 移除）三方案一致，**不制造假分叉**。
> - **布局层 3 组（L / V / I）** 见 `## UI 设计` →「布局层候选」节：移动入口位置（3 候选选 L1）、TOC h1 可区分性（3 候选选 W1+W2）、桌面入口位置（3 候选选 I1）。这是把架构级候选**下沉到 UI 层**的补充（角色要求布局/视觉/交互三维各须 ≥2 候选 + 权衡）——上一版只有架构层 3 个，UI 节零候选，本轮补齐。

> **三处机制判断的更正（eng B1/B2/B3）与本节的候选选择无关**：B1（`order_by` 实际零连带失败）、B2（`inject_resources` 保持签名 + `_build_sibling_data` 纳账）、B3（清单序列化转义 `<`）都是**同一候选项内的实现细节修正**，不改变 A/B/C 的选型，也不新增候选（详见 §0.1A / R1 / R15 / 修订记录）。

### 候选 A（选定）：渲染期单点生成 + 响应体 JSON 注记

**做法**

1. **锚点 id 的唯一点在 `useMarkdown` 的 `heading_open` renderer**：一次遍历内完成「层级过滤 1–4 → 纯文本抽取 → `slugify` → 去重 → `attrSet('id')` → `headings.push`」。正文 DOM 的 `id` 与 TOC 的 `href` 由**同一行代码**写入，不可能漂移。
2. TOC 数据流：`MarkdownViewer`（已 `emit('headings')`）→ `EntryDetailContent` 透传 `@headings` → `EntryDetailView` 调 `useEntryDetailComputed.setTocHeadings()`；`extractHeadings` 整段删除。
3. 注入超限反馈：在渲染结果 `<body>` 末尾追加 `<script type="application/json" id="peekview-inject-report">`（序列化时转义 `<` → `\u003c`，见 D7/R15），内含 `limits` / `requested` / `inlined` / `skipped[]`（每项 `filename` / `path` / `reason` / `size`）。CSP 与响应头**不动**。

**优点**
- BDD-01/03/04/05 的判据是 **DOM 级**（`id` 与 `href` 必须一致、去重必须两两不同）→ 由构造保证，不需要「两处同步」的纪律。
- BDD-07 的代码级断言（`useEntryDetailComputed.ts` 内 `/^(#{1,6})\s+/` 命中数 == 0）**天然满足**：那段代码被整段删除，而不是改写。
- 跳过清单是**单一载体**（body 内 JSON），pytest（`resp.text` 正则/BS4）与 Playwright（`getElementById().textContent`）**都能读**；实测在 `RENDER_CSP` 下 `type="application/json"` 不执行、无 console error（见 minimal_validation V9）。
- 改动面落在 3 个 composable/组件内，不动渲染管线。

**风险 / 代价**
- TOC 依赖异步 render 完成 → 桌面「默认展开」需要一条 `watch(tocHeadings)`（R5），比现状多一跳。
- 首屏 TOC 有 ~100–300ms 空窗（Shiki 异步）。

**工作量**：中（frontend 3 文件 + 2 处 spec mock 删除 + 后端预算编排）。

---

### 候选 B：token 解析期预生成 + 响应头 `X-Peekview-Skipped`

**做法**

1. TOC/锚点在 **`md.parse()` 的 token 流上同步预生成**：新增 `buildOutline(content): {headings, tokenEnv}`，用 `env` 把预生成的 id 表传给 `heading_open` renderer（renderer 只 `attrSet`，不生成）。`tocHeadings` 可在 `computed` 内**同步**得到。
2. 注入超限反馈：响应头 `X-Peekview-Skipped: <count>` + `X-Peekview-Skipped-Detail: <base64 json>`。

**优点**
- TOC **同步可得**：桌面默认展开逻辑完全不用改（`onMounted` 的 `nextTick()` 就够），无 R5 风险，无首屏空窗。
- 纯前端单测可以直接断言 `buildOutline()` 的返回值，比「等 render 完成」更好写。

**风险 / 代价**
- **两处生成点**：`buildOutline` 与 renderer 必须共享同一 id 表；一旦有人改了 renderer 的过滤条件而没改 `buildOutline`，就回到 V-02 的原始缺陷形态（这正是本任务要消灭的漂移）。为保证一致必须走 `env` 传递，而 `md.render` 的 `env` 目前在本仓未被使用（新增机制面）。
- **响应头形态在读侧不可达**：iframe 内的页面读不到自己响应的头；P6 要用 `fetch()` 或 `expect(response.headers())` 另开通道 → 「用户可观测」这条需求（P0 决策 4 的核心诉求）在**渲染结果里**看不到，只能被脚本看到。
- 头部携带 base64 明细受 header 长度限制（40 项 × 文件名会接近 8KB 上限），需要截断规则；截断后又破坏「每一项都可查」。

**工作量**：中高（要引入 env 通道 + header 编解码 + 截断规则）。

---

### 候选 C（排除）：双通道 reconcile（保留逐行正则 + 用 render headings 校正）

**做法**：保留 `extractHeadings` 的逐行扫描，渲染完成后用 `result.headings` 覆盖/校正，取「以 render 为准」。

**优点**：TOC 首屏同步（正则快）；对未渲染完成的中间态有兜底。

**风险 / 代价（为何排除）**
- **直接违反 BDD-07**：该条要求 `useEntryDetailComputed.ts` 中 `/^(#{1,6})\s+/` 命中数 **== 0** 且「存在从 render 返回值到 TOC 的单一数据通路」。保留正则即命中数 ≥ 1 → 改动后仍 FAIL。
- 即使满足 BDD-07，双通道仍会在「围栏内的 `## 示例`」上产生一闪而过的错误 TOC 项（正则看不见围栏状态机，实测现状即误收）。
- 属「用一层覆盖另一层」的加固反模式：新增一条永久性的纠错路径，替代一次性的正确实现。

**结论**：不满足 P1 硬判据，**不进入权衡**，仅记录排除理由。

### 选择理由（A vs B）

| 维度 | 候选 A | 候选 B | 谁更好 |
|---|---|---|---|
| BDD-07 满足方式 | 删除正则（结构性满足） | 仍需保证两处一致（纪律性满足） | **A** |
| 锚点 DOM 一致性 | 同一行写入，构造性保证 | 依赖 `env` 传递正确 | **A** |
| TOC 首屏同步性 | 异步一跳（需 watcher） | 同步 | **B** |
| 跳过清单可观测性 | 渲染结果内 JSON（人+机器可读） | 响应头（仅脚本可读，长度受限） | **A** |
| 新增机制面 | 无（复用既有 `emit('headings')`） | 引入 `env` 通道 + 头部编解码 | **A** |
| 承载形态安全性 | JSON 块——**须转义 `<`** 才能安全（eng B3，实测未转义可注入；转义后安全，V9 重做） | 响应头天然不参与 HTML 解析，无此风险 | **B（此单维）** |
| 工作量 | 中 | 中高 | **A** |

**选 A**：本任务的根因是「两套逻辑必然漂移」，候选 B 虽换来同步性，但把「一致性」从**结构性保证**降级为**纪律性保证**——正是 P0 决策 1 要消灭的东西；其同步性收益可以用一条 3 行 watcher 买到（R5 已有缓解，且 P1 的幂等 When 本就容忍 `"false"` 分支）。

**「承载形态安全性」这一维 B 更优，为何仍选 A**（eng B3 的诚实处理）：header 确实不参与 HTML 解析、天然免疫注入；但 B 的 header 形态有**两个更硬的否决理由**——① 40 项 × 文件名会逼近 8KB header 上限，截断后直接**破坏 BDD-40 ②「每一项都可查」**；② iframe 内的页面**读不到自己响应的头**，P0 决策 4 要的「超限反馈」在渲染结果里完全不可达（只能被脚本 `fetch` 另开通道）。而 A 的注入风险是**可消除的实现细节**（转义 `<`，一行 `.replace`，实测彻底消除 `</script` 与 `<!--` 两类问题且 `json.loads`/`JSON.parse` 均无损还原），不是形态固有的。**用一行转义换掉「长度上限 + 读侧不可达」两个结构性缺陷**，故选 A 成立。

---

## 2. 关键设计决策（逐条对应 dispatch 列出的设计难点）

### D1. BDD-35 的「观测面」承载形态 = **返回值新增字段 `constructedRows`**

- **形态**：「解析器新增暴露的构造行数」三选一中选 **返回值新增字段**（`CsvParseResult.constructedRows`）。P1 明文许可此形态（"返回值新增字段 / 公开的解析统计 / 可注入的计数回调"）。
- **为何不选另两种**：可注入回调会让 `parseCsv` 多一个仅测试使用的参数（污染生产签名，且 P3 之外无人消费）；公开解析统计对象（`stats`）需要额外的生命周期约定（同一次解析的 stats 属于谁）——两者都不如「同一次调用的返回值字段」直接。
- **取值定义**：**实际 push 进 `rows` 数组的数据行数（不含表头）**。达到 `maxRows` 后不再增长。
- **为何有区分力**：实测双实现对照——现状（先全量后 `slice`）该字段 `undefined`（改动前**无法读数** → FAIL）；朴素修法（`break` 出状态机）得 `5` 但 `totalRows` 掉到 `6`；正确修法得 `5` 且 `totalRows` 仍 `1001`。正向对照（3 数据行 / `maxRows=5`）两侧均 `3`，排除「恒返回 0」。
- **与 `rows.length` 的区别**：未超限时两者相等（故不可用它），超限时 `rows.length` 恒 == `maxRows`（实测 1000→5），完全无区分力。

### D2. 计数与构造解耦（BDD-35 × BDD-36 联合约束）

单次状态机扫描，`commit()` 内两个独立计数器：

```
commit():
  if 还没有表头: rows.push(row); headerSeen = true
  else:
    parsedDataRows++                                  # 永远计数（决定 totalRows）
    if constructedRows < maxRows: rows.push(row); constructedRows++   # 只在这时构造

# 收口：totalRows = headerSeen ? parsedDataRows + 1 : 0
```

- `totalRows = headerSeen ? parsedDataRows + 1 : 0` → 精确总行数不受截断影响（BDD-36）。**`headerSeen` 前置不可省**（eng N1）：空输入 / 无表头 → `totalRows = 0`，这是既有契约 `useCsvParser.spec.ts:51-57`（`:51` 是 `it()` 行、**断言在 `:55`**，N6 实测）的断言（现状实现 `useCsvParser.ts:9` 用的是 `headers.length > 0 ? dataRows.length + 1 : 0`，方案上一版骨架把前置判断丢了，实测输入 `''` 会得 `totalRows: 1` → 打断既有 spec）。
- `constructedRows ≤ maxRows` → 构造上界（BDD-35 ①）。
- **不 `break` 出状态机** → 未闭合引号校验仍在全文扫描之后（BDD-37），既有契约 `useCsvParser.spec.ts:68` 保持。
- 实测（`csv-proto2.ts`）：`1000 数据行 / maxRows=5` → `{rows:5, totalRows:1001, truncated:true, constructedRows:5}`；`3 数据行` → `{rows:3, totalRows:4, constructedRows:3}`；`1000 + '"unclosed'` → 抛 `CSV 解析失败：存在未闭合的引号`；空输入 / 只有表头 / 引号内换行 / 尾部换行四种边界均正确。

### D3. 默认入口 resolver 单点

`frontend-v3/src/utils/default-file.ts`：

```ts
export function resolveDefaultFile(files: File[]): File | null
// 规则（P0 决策 7.2）：根 README.md（大小写不敏感）> 根 index.md > 稳定排序首个
// 根判定：effectivePath = (path 非空 ? path : filename)；effectivePath 不含 '/' 才是根
// 匹配键：basename(effectivePath)（= 根级文件名）；子目录项永不被选中
// 排序：path 非空取 path、否则 filename 的字典升序；同键按 id 升序
```

- **唯一消费点**：`stores/entryDetail.ts:49-53`（详情页三条来源——卡片/列表/直接访问——最终都汇聚到 `loadEntry`）。`EntryCard.vue`/`EntryListRow.vue` 的 `files[0]` 分支**删除**（BDD-47 代码级断言）。
- **后端前置**：`entry_service.py` 六处 `select(File)` 统一 `order_by(func.coalesce(File.path, File.filename), File.id)` → 前端「稳定排序首个」有确定输入（BDD-13）。
- `?file=` 无效时的回退也走它（BDD-16/17/18/51）：`loadEntry` 内 `entry.files.find(f => f.id === fileId) ?? resolveDefaultFile(entry.files)`。
- **resolver 的直接单测（eng G7，护住 R10）**：`resolveDefaultFile([{path:'sub', filename:'README.md'}, …])` 的返回值必须是**回退项**而非 `README.md`（`path='sub'` 落盘为根级文件 `sub`，basename 非 readme → 不选中）；同批补真嵌套 `{path:'sub/README.md'}` 的非根用例。两条都断言返回值 `id`，不靠 E2E 间接观察。

### D4. `?file=` 持续态：**初始化消费 + activeFile 单向同步 URL**

| 时机 | 行为 |
|---|---|
| 首次加载 | 读 `route.query.file`（`Number` 转换 + `Number.isInteger` 校验，失败即 `undefined`）→ `loadEntry(slug, fileId, shareToken)` |
| 加载后归一 | `suppressUrlSync = true` 期间；完成后按「当前是否默认文件」决定 URL：默认 → 删除 `file`；非默认 → 确保 `file=<id>` 存在 |
| 一次性参数清理 | **只删 `firstFileId`**（白名单化）；`file` / `share` 一律保留（BDD-22/51） |
| 页内切换 | `watch(activeFile.id)` → `router.replace` + **合并** query（`{...route.query}`），非默认写 `file`、默认删 `file`；**不新增历史**（BDD-19 ③） |
| 刷新 | 走首次加载路径 → 保留 `file`（BDD-21） |

**实测依据（router-query 探针，vue-router 4 实跑）**：
- `router.replace({query:{file:'99'}})` → `?file=99`，**`share` 被丢弃**（证明现状 `query:{}` 一锅端的危险在「合并 vs 覆写」上同样成立）；
- `{...route.query, file:'99'}` → `?share=TOK&file=99`（**必须显式合并**）；
- `delete q.file` 后 replace → `?share=TOK`（删参数用「键不出现」而非 `null`——实测 `file: null` 会得到 `?file`（空值键，仍在 search 里），会让 BDD-20 的 `不含 file=` 断言变脆）。

**可单测的形态（eng N3）**：把上面「按 activeFile 归一 query」的规则抽成**纯函数**，放在 `src/utils/default-file.ts`（与 resolver 同文件，同属 URL/文件选择逻辑）或新建 `src/utils/file-query.ts`：

```ts
export function normalizeFileQuery(
  query: Record<string, string | string[]>,   // 即 route.query 的结构
  activeFileId: number | null,
  defaultFileId: number | null,
): Record<string, string | string[]>          // 恒保留非 file 键（含 share），按上表增删 file
```

- 单测断言输入输出三例：默认文件 → **无 `file` 键**；非默认 → `file=<id>`（字符串）；`share` 在两例中都保留。
- **`suppressUrlSync` 本身不测**（组件内 `ref`、未导出；为它开导出 = 为测试改生产 API）。它只作为 `onMounted` 与 watcher 之间的实现细节存在。
- 真实 URL 与 `history.length` 仍按 BDD-19/20/21/22 **在 E2E 层验**（P1 §9 已如此定级）。

**静默回退的权衡（design N6，MINOR）**：`?file=` 无效时**静默回退默认入口、不给任何可见提示**——这是 P1 的明确要求（BDD-16 Then② / BDD-18 Then② 均写「页面**无**错误横幅、不白屏」）。定位上它是**无感知降级**：用户从一个过期/被改写的深链进来时，看到的是这个 entry 的正常首屏（默认入口），而不是一个解释「参数错了」的新 UI 面。**不引入新 UI 面**的理由：① P1 未要求；② 深链失效在生产里多来自转发/复制粘贴截断，用户此时更需要内容而非报错；③ 加横幅会让「分享出去的链接打开后多一条黄条」成为新的观感问题。代价（明确记录）：用户不会知道自己请求的具体文件不存在。

### D5. 全屏入口（桌面 `.actions-area` + 移动底栏）+ zen 侧栏 DOM 移除

- **前置：prop / emit / 绑定三处扩容（R2-2，实测必做）**。设计上一版把入口写成「在 `.actions-area` 加按钮 + `v-if="currentEntry && activeFile"`」，但实测该组件的输入（`activeFile`）与输出（`$emit('fullscreen')` 的接收方）**在作用域内一处都不存在**：`grep -c activeFile EntryDetailHeader.vue` = **0**、`defineEmits`（`:146-155`）无 `'fullscreen'`、`EntryDetailView.vue` 传给 Header 的 24 个 prop 无 `:active-file`。按字面实现 → `vue-tsc` 报 **TS2339**（`activeFile` 不存在）+ **TS2345**（`'fullscreen'` 不在 emits）→ `make typecheck` 必红。故 D5 的落地点必须先补齐这条 I/O 链（三处，缺一不可）：
  1. `EntryDetailHeader.vue` `defineProps` 加 `activeFile?: File | null`（`withDefaults` 默认 `null`）——**`File` 必须 `import type { ... } from '@/types'`**，否则解析成 DOM `File` → `TS2322`（实弹验证过一次）；
  2. `EntryDetailHeader.vue` `defineEmits` 加 `'fullscreen': []`；
  3. `EntryDetailView.vue` 的 `<EntryDetailHeader>` 加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`，script 内新增 `handleFullscreen()`（处理体见下方「点击目标计算」段）。
  **实测闭合证据（V19）**：按上述三处补丁 + 本段落的按钮，`npx vue-tsc --noEmit` **exit 0**，且 `T079-entry-detail-header` / `tpv0095-detail-visibility-tag` / `t082-error-format` 三个既有 spec **32 passed**（探针改动已还原，未进生产代码）。
  **移动端同样缺（连带核对结论）**：`EntryDetailMobileBar.vue` 的 props（14 项）无 `activeFile`、emits（7 项）无 `'fullscreen'` → 一并按同样方式补齐（`EntryDetailView.vue` 的 `<EntryDetailMobileBar>` 加 `:active-file` + `@fullscreen`）。**但两端的守卫语义不同**：移动端整栏已 `v-if="isMobile && currentEntry"`（`:2`），不补 `activeFile` 也不会 TypeError；桌面端 `.actions-area` 的 `v-if="isDesktop"` 与 entry 状态**无关**，故桌面的 `v-if` 是**功能性必需**。
- 桌面：`EntryDetailHeader.vue` 的 `.actions-area` 内新增 `icon-btn`（`Maximize` / `aria-label="全屏阅读"` / `data-testid="detail-fullscreen-btn"`）。该区带 `v-show="!zenMode"` → 全屏态自然隐藏（不会命中 BDD-29 的「退出入口」词表）。
  - **显隐守卫（design M2 / R14，必须）**：`v-if="currentEntry && activeFile"`。实测 404 页 `.actions-area` 仍渲染（DOM 1）而 `activeFile` 为 `null` → 无守卫会在 404 页出现一个「全屏阅读」按钮，点击执行 `activeFile.id` 抛 **TypeError**。移动端已由整栏 `v-if="isMobile && currentEntry"` 守卫，**桌面端 `v-if="isDesktop"` 与 entry 状态无关，故必须单独加**。
  - **图标尺寸与论证更正（design M3）**：`:size="16"`，**理由改为「跟随既有 `.icon-btn` 的兄弟按钮」**——实测 `CopyIcon :size="16"` / `Share2Icon :size="16"` / `StarToggle` 的 `Star :size="16"`。**不引用 `DESIGN.md §7` 来论证 16px**：§7 的档位是「16px (inline), **18px (compact buttons)**, 20px (buttons/lists)」，`.icon-btn`（32×32）按 §7 应取 18px —— 即**既有代码与 §7 本就存在偏差**。本任务**不修正该偏差**（一致性优先；改 16→18 会让新按钮与兄弟按钮不一致，且属 P1 未声明的范围扩张）。
  - **按钮变体选择依据（补 §6 官方口径）**：`DESIGN.md:162` 的 Selection rule ——「persistent-state icon action（有 on/off 态）用 `.toggle-btn`；stateless one-shot action（如 copy）用 `.icon-btn`」。全屏入口是**一次性跳转动作**（跳走页面，无持久 on/off 态），故 **`.icon-btn` 正确**，不发明新变体。
  - **过渡态（design M5）**：**继承**既有 `.icon-btn` 的 `transition: all var(--transition-fast)`（`DESIGN.md §8` Fast=150ms，`layout.css:270` 实文），**不加自定义过渡**。
  - **禁用态（design M5）**：**不设 `disabled` 属性**——用 `v-if` 让元素「不存在」而非「存在但灰」。理由：全屏入口在 entry 未就绪 / 无 activeFile 时没有可表达的语义（不是「暂时不可用」，而是「无从全屏」），留一个灰按钮反而制造「为什么点不动」的疑问；且 BDD-31 的全页计数断言要求「名称匹配 `fullscreen|全屏` 的可点击元素 == 1」，灰按钮会让计数口径复杂化。→ **`v-if` 即禁用态**。
- 移动：`EntryDetailMobileBar.vue` 左簇新增同型 `icon-btn`（`data-testid="mobile-bar-fullscreen-btn"`）；栏高由 `min-height: var(--mobile-bar-height)`=64px 锁定。
  - **间距必须收窄（design M1 / R7）**：把**生效的那一处**改为 4px —— `EntryDetailMobileBar.vue` 的 scoped `.mobile-bottom-bar { gap: var(--space-2) → var(--space-1) }`（`--space-2`=8px、`--space-1`=4px）。**`layout.css:538` 的 `gap: 4px` 不要动**：它已被 scoped 规则覆盖、当前不生效，改它既无渲染效果又扩大 diff（实测生效值为 8px）。实测 @360（最小支持宽度）插 44px 按钮：`gap 8px` → **溢出 10px**；`gap 4px` → **溢出 0**（spacer 余 5.39px）。
  - **移动端无 tooltip 的取舍（design M6，显式声明）**：桌面给 `<span class="tooltip">全屏阅读</span>`，移动端**只给 `aria-label`、不加 tooltip**——实测移动底栏 `tooltipCount = 0`（Files / TOC / Source / Copy 全部如此，`.mobile-bottom-bar` 既无 `.tooltip` 样式也无 `.tooltip` 元素）。**这是跟随既有底栏形态**，不是疏漏。与 1612「图标 + 文字」的偏差与理由：① 触屏无 hover，tooltip 无可达触发方式；② 底栏横向预算在 360px 下已用尽（M1），加文字标签必然溢出；③ 一致性优先——单独给一个按钮加可见文字会让底栏出现唯一一个异类。可发现性由 `aria-label`（读屏）+ 图标语义（`Maximize` 四角扩展）承担。
- 点击目标计算（`EntryDetailView.vue`）：
  ```ts
  const isDefault = activeFile.id === resolveDefaultFile(currentEntry.files)?.id
  const query = { ...route.query }                 // 保留 share
  if (isDefault) delete query.file; else query.file = String(activeFile.id)
  router.push({ path: `/${slug}/f`, query })       // BDD-25 / BDD-26
  ```
  > **前置条件**：由 R14 的 `v-if="currentEntry && activeFile"` 保证进入该处理函数时两者均非 `null`（不改处理函数内部的写法，避免两处重复判空）。
- **侧栏 DOM 移除**（BDD-28 / BDD-53 ③）：`EntryDetailContent.vue` 注入 `ZenModeKey`，两个 desktop `<aside>` 的 `v-if` 各加 `&& !zenMode`。实测现状两者 DOM 各 1 + 全局 CSS `display:none`（见 V5）；改为 DOM 0 后全局 CSS 规则对它们失效但保留（继续服务 `.detail-header` 等 `v-show` 项）。
- **移动抽屉残开状态（design N5，MINOR，声明不处理）**：`showTocDrawer` / `showFileDrawer`（`EntryDetailView.vue:184-185` 的独立 `ref`）**不在** `watch(() => props.slug)`（`:246-248` 只重置 `isFileTreeOpen` / `isTocOpen`）里重置 → 从 `/f` 后退回普通态理论上可能带一个残开抽屉。**本任务不处理**，理由：① 不属 P1 任何 BDD 的范围（新增入口引入的新状态转移，非既有缺陷）；② 实际路径受限——`/f` 下底栏 `v-show="!zenMode"` 不可见，用户在 `/f` 内无法新开抽屉；③ 若 P6 实测发现可稳定复现且影响 BDD-53 的可视计数，再回 P2 补（已在 R6 的处置范围内记录）。

### D6. 注入预算模型（数值已实测冻结）

| 层级 | 常量 | 值 | 依据 |
|---|---|---|---|
| 数量上限 | `_MAX_INJECT_IDS` | **40** | 须 `< max_entry_files-1 = 49`（BDD-38 ④，现状 50 < 49 不成立 → FAIL）；选 40 而非更小值，避免把「≤40 个资源的合法 demo」从可用变不可用；实测 `51 sibling` 时现状静默丢 1 个（V7） |
| 单文件文本上限 | `_MAX_INJECT_FILE_BYTES` | **2 MiB** (`2*1024*1024`) | 与前端 `HtmlViewer.SIZE_BLOCK` 同数（两端同一语言）；现状文本 sibling **零大小检查**（`_BINARY_SIZE_LIMIT` 在本文件零消费） |
| 总字节预算 | `_MAX_INJECT_TOTAL_BYTES` | **8 MiB** | 实测真实形态 demo 6 sibling = 1.29MB（放大率 0.994，注入不放大体积）→ 8MB ≈ 6 倍余量；且远小于 `max_entry_size`=100MB。二进制 sibling 的 base64 长度计入 |
| 最终 HTML | *（不阻断）* | 派生观测值 | 见 0.2 与 R3：加阻断会让「20MB 主 HTML + 零注入」在现状可用场景下失败，属 P1 未声明的限制 |

预算编排顺序（`render_html_file`）：`select_inject_ids`（含 `overflow`）→ `get_files_by_ids` → 逐 id 判定 `not_found` / `binary_too_large`（`_build_sibling_data` 返回 `None` 时）/ `file_too_large` / `total_budget` → 剩余进 `inject_resources(..., skipped_out=skipped)`（**该函数在返回前把自己未消费的 sibling 以 `reason="not_injectable"` 追加进同一个 `skipped` 列表**，B4）→ 追加 JSON 注记。**注意顺序不可颠倒**：`skipped` 必须先过预算层、再交给 `inject_resources` 追加，否则 `requested - inlined == len(skipped)` 会被重复计数打破（每个 id 恰好落一类）。

**BDD-38 ④ 的代码级关系断言（eng N2，落点钉死）**：

```python
def test_inject_id_limit_below_entry_file_limit():
    declared = PeekLimits.model_fields["max_entry_files"].default
    assert _MAX_INJECT_IDS < declared - 1          # 正向：40 < 49
    # 反向：若有人把 max_entry_files 下调到恰好 40，上式即失效——用一条显式守卫说明该前提
    assert declared == 50, "max_entry_files 默认值已变更，须重核 _MAX_INJECT_IDS 取值"
```

- **读 `model_fields[...].default` 而非 `PeekLimits()`**：BDD-38 ④ 要求「仓库默认配置下」，而实例化会受 `PEEKVIEW_LIMITS__MAX_ENTRY_FILES` env 漂移（eng N2）。实测（V14）：`.default` = **50**（`int`），`40 < 49` → `True`。
- 反向断言写成「前提守卫 + 明确失败信息」，而不是一条永远成立的空断言——`max_entry_files` 真被改动时它会失败并指出要重核什么。

### D7. 超限反馈形态（可机器解析）

渲染结果 `<body>` 末尾：

```html
<script type="application/json" id="peekview-inject-report">
{"version":1,
 "limits":{"maxInjectIds":40,"maxFileBytes":2097152,"maxTotalBytes":8388608},
 "requested":45,"inlined":36,
 "skipped":[{"filename":"d3.min.js","path":"vendor/d3.min.js","reason":"count_limit","size":286720},
            {"filename":"huge.css","path":"huge.css","reason":"file_too_large","size":3145728},
            {"filename":"big.png","path":"big.png","reason":"binary_too_large","size":921608},
            {"filename":"big.svg","path":"big.svg","reason":"total_budget","size":1048576},
            {"filename":"README.md","path":"README.md","reason":"not_injectable","size":1204}]}
</script>
```

> **样例数字自洽性说明（[eng W1] 已修正）**：本样例的 `limits.maxInjectIds = 40`，故 `count_limit` 类**必须**恰有 `45 - 40 = 5` 项（上例仅展开 1 项作形态示意，其余 4 项同类省略）。**完整自洽形态应为**：`requested 45 / inlined 36 / skipped 9`（5 项 `count_limit` + 4 项其余），势 `45 - 36 = 9 == len(skipped)` 成立；其中 `inlined = 40 - 4`（40 个放行项里，`file_too_large`/`binary_too_large`/`total_budget`/`not_injectable` 共 4 项未真正进入响应体）。
> **P3 造件时不得照抄本节数值**——必须按自己实际的 `limits` 与素材重算这三个数字（照抄会在红灯阶段暴露，浪费一轮但不产生假绿）。

> **`skipped[]` 字段来源定死（[eng W4/W5]）** —— 本节为 P4 实现前的权威口径：
> - **`size` 是「已知时的近似值」，可为 `null`**：`SiblingFileData`（`html_render_service.py:26-32`）**6 字段中无 `size`**；文本项的 `len(content)` 是**字符数**（非字节），二进制项若由 base64 反解需 `×3/4` 折算。→ 实现要求：**取不到就不写**（`null`），**不得**为此给 `SiblingFileData` 加字段（那会破坏 B2a 的「13 处既有 `inject_resources` 调用零改动」）。判据**不断言 `size` 数值**（P1 BDD-38~40 均未要求），只断言其存在性或为 `null`。
> - **`not_found` / `count_limit` 项的 `filename` / `path` 可为 `null`**：`get_files_by_ids`（`entry_service.py:1431-1441`）**只返回命中行**——溢出 id（`count_limit`）从未被查询、跨 entry / 不存在的 id（`not_found`）查不到行，故二者拿不到文件名。→ schema 因此**必须含 `file_id`**（后两类 `reason` 才有可定位标识），且 `filename`/`path` 允许 `null`。**不为这两类补额外查询**（避免为报告引入新的 DB 往返与穿透风险）。
>   > **[DESIGN_GAP_REVIEWED: P6.5 judge 退回后更正，2026-11-26]** 上面这条对 `count_limit` 的判断**已被实测证伪**：`overflow` 的 id 只是「超过 `_MAX_INJECT_IDS` 上限、未被选中」，**文件本身在 DB 中存在**（`get_files_by_ids` 传 `inject_ids.overflow` 即可查到）。原判断把「**未发起查询**」当成了「**查不到**」，据此允许 `filename: null`，实质上削弱了 P1 BDD-38 Then③「清单中每一项可对应到具体文件名」而**未走 `[BASELINE_CHANGE]` 程序**。→ **现行为**：`count_limit` 项**必须**带真实 `filename`/`path`/`size`（补一次批量 IN 查询，非 N+1）；只有 `not_found`（DB 中确实无此 id）才允许 `null`。P1 无改动。
> - **据此，`skipped[]` 每项字段为**：`file_id: int`（必填）+ `reason: str`（必填，六元闭集）+ `filename: str|null` + `path: str|null` + `size: int|null`。
> - **不变式同步**：`requested - inlined == len(skipped)`（势）与 `{s["reason"]} ⊆ REASONS`（值）**不变**；但**「不重复计数」断言须按 `file_id` 而非 `filename`**（后者可为 `null`，多个 `null` 会误判重复）。

**样例数字按写死的不变式对齐**：`requested 45 - inlined 40 = 5 == len(skipped)`（B4 前后这一条是要点——上一版样例写 `49/40` 而只列 5 项，按新语义即自相矛盾；`count_limit` 项对应 40 上限之外的溢出，`not_injectable` 项对应一个被请求但不可注入的 `README.md`）。

- **序列化必须转义 `<`**（eng B3 / R15）：`json.dumps(report, ensure_ascii=False).replace("<", "\\u003c")`。`path` 用户可控且实测无过滤 —— 未转义时 `</script>` 会提前闭合脚本块、其后内容成为活跃 DOM（实测 `stray img parsed: True`），并让 BS4 取证通道取到半截（`json.loads` 抛 `Unterminated string`）。转义后实测：无字面 `</script`、`stray img False`、`json.loads` 成功、`path` roundtrip 一致。**`ensure_ascii=False` 保留中文可读性**（V9 素材含中文文件名），`\u003c` 只影响 `<` 一个字符。
- **`inlined` 的语义（写死，单一定义句，B4 第 3 项）**：

  > **`inlined` = 实际进入响应体的 sibling 个数**——即 `inject_resources()` 真正把该 sibling 的内容写进了返回 HTML 的个数（命中 `<link rel=stylesheet>` / `<script src>` / kind 追加 / `img|video|audio|source|track[src]` / `<link rel=icon>` / CSS `@import` 与 `url()` 中任一消费路径）。**不是**「预算层放行的个数」（那是 `requested - len(预算四类 skipped)`，与本字段不是同一量）。

  **为什么必须选这一个读法**：另一读法（「预算层放行数」）会让 `requested - inlined == len(skipped)` 恒成立、但**直接违反 P1 BDD-40 ②**「未被内联的每一个都必须可查」——kind-drop 与未引用二进制两条路径都不在预算层，按该读法它们既不算 skipped 也不算未内联，等于「静默丢弃仍在」。选「实际进入响应体」后不变式才有内容：**每一项没进去的都必须给得出 reason**。代价是 `inject_resources()` 内部必须做消费追踪（见下条），这是本读法的实现成本，已实测可行（V17）。

- `reason` **六元闭集**（B4 第 1 项，由五元扩一项）：`count_limit` / `file_too_large` / `binary_too_large` / `total_budget` / `not_found` / **`not_injectable`**。
  - **前五项**是 `inject_resources()` **之前**的预算编排层判定点（`render_html_file`）；
  - **`not_injectable`** 是 `inject_resources()` **内部**的判定点，语义写死为：**「进入了 `inject_resources()`，但既未被主 HTML 以可注入形态引用、且本身不属于可追加类型（css/js），因此没有任何注入落点」**。它覆盖两条既有静默丢弃路径：① **kind-drop**——`_detect_kind()`（`:78-95`）只认 `.css`/`.js`（含 `language ∈ {css, javascript, js}`），`.md`/`.json`/`.csv`/`.yaml`/`.txt` 一律 `None` → `:258-260` 的 `if not kind: continue` 静默跳过；② **未被引用的二进制/SVG**——二进制只在命中 `img|video|audio|source|track[src]` 或 `link[rel=icon]` 时才被内联，未被引用的（即使远小于 768KB）同样零记录。
  - **`not_injectable` 不是「用户写错了」的诊断**：它是**可观测性记录**，告诉调用方「这个 sibling 你要了、但它对这份 HTML 没有意义」。
  - **每个请求了但未内联的 id 必出现且仅出现一次**（BDD-40 ②）→ `requested - inlined == len(skipped)`，**其中 `inlined` 严格取上面写死的「实际进入响应体」读法**。`binary_too_large` 是**既有**静默丢弃路径（`_build_sibling_data` 的 `>768KB` 二进制 `return None`）纳账后的取值，不是新增预算层。

- **`not_injectable` 的判定点必须落在 `inject_resources()` 内部**（只有它知道主 HTML 引用了什么），**且需要完整的消费追踪**（B4 第 2 项）：
  - 复用 B2a 已加的 `skipped_out` 出参（**不新增出参**）：`inject_resources(html, siblings, *, skipped_out=None) -> str`；函数返回前遍历 `siblings`，对**不在 `consumed` 集合**中的每一项追加 `{"filename", "path", "reason": "not_injectable", "size"}`。
  - **`consumed` 必须是按 sibling 身份的集合**（`set[int]` 存 `id(SiblingFileData)`），并配一张 `owners: dict[str, SiblingFileData]`（key → sibling，text 与 binary **共用一张**）。**不能只用 `used_text_keys` + `_sibling_keys()`**——实测（V17）该最小钩子会漏三条真实消费路径并给出**假绿报表**：`b.css` 只经 CSS `@import` 被消费、`bg.svg` 只经 CSS `url()` 被消费、`fav.png` 只经 `<link rel=icon>` 被消费，三者都不会进 `used_text_keys`；二进制侧连 used 集合都不存在 → 「未引用二进制 + README.md」形态下报表会自称 `inlined=1` 而实际嵌入 **0**（`requested(2) - actual(0) = 2 ≠ len(skipped)=1`，**不变式在假值上"成立"**）。
  - 落点（**七处埋点，缺一处不变式即破**；行号已逐个实测核对）：① `<link rel=stylesheet>` 命中 `:231`（`used_text_keys.add` 那行）；② `<script src>` 命中 `:249`；③ kind 追加 css/js `:263`（`if kind == "css"`，js 分支紧随）；④ `img/video/audio/source/track[src]` 命中二进制 `:292`；⑤ 同处命中文本 SVG `:298`；⑥ `<link rel=icon|shortcut icon>` 命中二进制 `:315`；⑦ **CSS 内部消费**——把 `owners` 与 `consumed_out` 透传进 `_process_css_refs()`（`:127`），在 `_replace_import()` 命中处（`:145` 的 `_lookup_key`）与 `_replace_url()` 的二进制/SVG 两处（`:162`/`:166`）登记，**含递归分支**（`:151` 的自调用必须继续透传，否则 `@import` 链第 2 层起的消费全部漏记）。该函数既有 5 处测试调用（`test_html_render.py:372-410`）按位置传 3–4 个参数，新参数必须是**关键字可选**（默认 `None` → 不登记），故零改动。
  - **实测覆盖**（V17，7 个形态全过）：S1 V8 真实形态（link+svg+script + README.md + data.json）→ `requested 5 / inlined 3 / len(skipped) 2`；S2 零引用形态（a.css/a.js/a.svg/a.png/a.md/a.json）→ `6/2/4`；S3 三条此前未跟踪路径（`@import` + CSS `url(svg)` + favicon）→ `4/4/0`；S4 未引用小二进制 + 被 `<script src>` 引用的 json → `2/1/1`（引用者胜出）；S5 全不可注入 → `2/0/2`；S6 空 siblings 不崩；S7 嵌套 `path` 按 basename 引用 → `1/1/0`。**七形态全部满足 `requested - inlined == len(skipped)` 且 `inlined` = 实际嵌入数**。
- `limits` 由**同一批常量**序列化（不做第二份字面量，防 R4 双源）。
- P6 读取：`page.evaluate(() => JSON.parse(document.getElementById('peekview-inject-report')!.textContent!))`；pytest 读取：`BeautifulSoup(resp.text).find("script", {"id": "peekview-inject-report"}).string` → `json.loads(...)`（**转义后该通道才可靠**，V9 重做已证）。
- **`reason` 闭集的完整枚举断言（G10，P3 用例须含）**：只断「`{s.reason} ⊆ 闭集`」不足以检出「丢弃了但没记」——必须同时断**势**。建议写成：

  ```python
  REASONS = {"count_limit", "file_too_large", "binary_too_large", "total_budget", "not_found", "not_injectable"}
  report = json.loads(...)
  assert report["requested"] - report["inlined"] == len(report["skipped"])   # 势：无一遗漏
  assert {s["reason"] for s in report["skipped"]} <= REASONS                  # 值：闭集
  # 不重复计数：按 file_id 而非 filename——[eng W5] not_found/count_limit 项的 filename 可为 null，
  # 多个 null 会让按 filename 的去重断言误判为「重复」而假红。
  ids = [s["file_id"] for s in report["skipped"]]
  assert len(set(ids)) == len(ids)                                            # 不重复计数（按身份）
  ```

  其中 `inlined` 由实现按「实际进入响应体」计数（见上条语义定义），**不得**由 `requested - len(预算层 skipped)` 反推——那会让这条势断言变成恒等式、失去检出力。

- **实测**（V9 重做）：在 `RENDER_CSP` 下该块不执行（console errors = `[]`）、正文与内联 `<style>` 均正常、CSP 头 367 字符**未变**；**含 `</script>` / `<` / `>` 的文件名与 path 素材下 `json.loads` 成功且值无损**。

### D8. 字节数工具单点

`utils/file-bytes.ts` 的 `resolveFileSize(fileLike, content)`：`size` 为有限非负数 → 用真实字节；否则 `content.length` 兜底。

- `HtmlViewer.vue`（`:92-94`）与 `TreeView.vue`（`:75`）**共用**该函数 → BDD-42/44 同源修复，也满足 P1 §6.10 的「第二处出现即为审查锚点」。
- 阈值常量 `SIZE_WARN=512KB` / `SIZE_BLOCK=2MB` / `MAX_SIZE=2MB` 与 `>=` 语义**不动**（BDD-43 左闭右开是既有契约）。
- `file.size` 是真实字节（实测：API `size` 与 `wc -c` 逐项相同；后端 `entry_service.py:319` `size=len(content_bytes)`）。

### D9. 测试标识清单（P3 用稳定标识定位，不绑 class）

| `data-testid` / `id` | 元素 | 新增/既有 |
|---|---|---|
| `detail-fullscreen-btn` | 桌面 header 全屏入口 | 新增 |
| `mobile-bar-fullscreen-btn` | 移动底栏全屏入口 | 新增 |
| `peekview-inject-report`（**id**，非 testid） | 注入跳过清单 JSON 块 | 新增 |
| `table-truncation-banner` | 表格截断提示（`TruncationBanner` 透传 testid） | 新增 |
| `norm-file-query`（vitest 纯函数，非 DOM） | `normalizeFileQuery(route.query, activeFileId, defaultFileId)` 单测入口（R2/N3） | 新增 |
| `file-sidebar` / `toc-sidebar`（class，既有） | 侧栏（BDD-28/53 断 DOM 计数，沿用既有 class） | 既有 |
| `mobile-bottom-bar` / `content-area` / `markdown-body` | 既有 | 既有 |

> 允许 P3 继续使用既有 class 选择器（`file-sidebar`/`toc-sidebar` 在 P1 判据里已按 class 写死），新增元素一律给 `data-testid`。

### D10. BDD → 方案落点 → 验证层 全覆盖矩阵（54/54，无遗漏）

> 逐条确认「这条 BDD 由哪个设计点满足、在哪一层验」。**不改写任何 Given/When/Then**，只标实现落点。验证层按 P1 §9 的分层（`vitest` / `pytest` / `E2E` / 文档 grep / 源码扫描）。

| BDD | 方案落点（本文 §/D） | 验证层 | 备注 |
|---|---|---|---|
| 01 重复同名标题正文 id 互异 | D1（`heading_open` 同一处去重 + `attrSet`） | E2E（DOM）+ vitest（headings） | 键为纯文本 `slugify` |
| 02 围栏内标题不进 TOC | D1（token 流天然不含围栏内 heading，实测 V4） | E2E + vitest | 现状误收，改后不误收 |
| 03 Setext h1 两侧都有锚点 | D1（层级扩为 1–4，h1 也 `attrSet`） | E2E + vitest | 决策 B |
| 04 TOC 覆盖 h1–h4 且排除 h5 | D1（`level>=1 && level<=4`）+ **TocNav 的 h1 可区分样式**（视觉组 V 选定 W1+W2） | E2E + vitest | 计数 == 4（BDD 判据）；**h1 与 h2 视觉可区分属设计加强项**（BDD 不要求，由 UI 校验点 ⑦ 断言，防 D-2 的「层级信号消失」） |
| 05 TOC 文本剥离标记且与正文一致 | D1（`text` = inline 纯文本，实测 V4 `粗体与链接`） | E2E（`.toc-list a` 可见文本 + `.markdown-body h2`） | 区分力在 Then② |
| 06 点 TOC 条目目标进视口（回归） | 不动 `scrollToHeading` + `TocNav.scrollTo`（0.2） | E2E | 回归守护 |
| 07 目录数据源单点（代码级） | D1 + 0.1B（删 `extractHeadings`） | vitest 源码扫描 | 正则命中 == 0 |
| 08 根 README 优先于排序靠前文件 | D3（resolver + 后端 `order_by`） | E2E（现造 entry） | 素材 `AAA.txt` |
| 09 无 README 时根 index 优先 | D3 | E2E | 素材 `[aaa.md, index.md]` |
| 10 都无 → 稳定排序首个 | D3（`order_by` 保证输入确定） | E2E | 构造序 ≠ 排序序 |
| 11 只匹配根目录 | D3（`effectivePath` 不含 `/` 才是根） | E2E + vitest | 见 R10（`path=sub` 形态） |
| 12 文件名匹配大小写不敏感 | D3（`toLowerCase` 比较） | E2E | 素材 `[AAA.txt, readme.md]` |
| 13 后端文件顺序确定性 | 0.1A（六处 `order_by` + `_files_of_entry` 单点） | pytest | 两次请求逐元素相同；**并显式断言 POST 序 ≠ GET 序**（B1/G3，护住「POST 表达刚提交了什么、GET 表达契约序」这一差异不被顺手统一）；**风险已由中降为低**（实测零连带失败） |
| 14 `?file=` 打开指定文件且参数保留 | D4（初始化消费；清理白名单只删 `firstFileId`） | E2E | |
| 15 `/f?file=` 全屏 + 指定文件 | D4 + D5（`zenMode` 由路由 meta 决定，与 query 正交） | E2E | `kind: Service` |
| 16 不存在 id 安全回退（成对对照） | D4（`find ?? resolveDefaultFile`） | E2E | 前置校验有效 id 确实切换 |
| 17 跨 entry id 拒绝并回退 | D4（`entry.files.find` 天然限本 entry；后端 `get_file_record` 也带 `entry_id`） | E2E | 正文不含 B 的独有串 |
| 18 非数字 file 安全回退 | D4（`Number.isInteger` 校验失败即 `undefined`） | E2E | |
| 19 页内切换同步 URL 且不增历史 | D4（`watch(activeFile.id)` + `router.replace` 合并） | E2E（`history.length`） | 页内切换入口唯一：`handleNavigateFile`/`selectFile` |
| 20 切回默认文件移除 `file` | D4（默认 → `delete query.file`） | E2E | 用删键不用 `null`（实测 V1） |
| 21 刷新后仍打开指定文件 | D4（首屏读取路径；参数不在清理名单内） | E2E（reload） | |
| 22 `file` 与 `share` 各自生效不误删 | D4 + R11（清理白名单化） | E2E | 现状 share 被抹（实测 V6） |
| 23 桌面全屏入口可发现且在 `.actions-area` | D5（Header 新增 `icon-btn`） | E2E（`title` 不计入名称） | Given 钉「正文无图表」 |
| 24 移动入口在底栏且不遮挡 | D5 + R7 + UI 视觉 checklist ②⑤ | E2E（rect 度量） | 栏高 ≤64（实测 64）；Given 钉 390×844。**最小支持宽度 360px 的守护性断言另由 `P5_e2e_mobile_widths`（360/375/390 三档）承担**——360 不在 BDD-24 的 Given 内，故本条按字面在 390 判 PASS 属预期（M1） |
| 25 默认文件 → `/{slug}/f` 无 file | D5（点击时 `delete query.file`） | E2E | |
| 26 非默认文件 → `/f?file=<id>` | D5（`query.file = String(activeFile.id)`） | E2E | |
| 27 手动 `/f` 进全屏展示默认文件（回归） | D5（路由 meta `zen: 'locked'` 不变）+ D3 | E2E | 回归守护 |
| 28 `/f` 下侧栏 DOM 不存在 | D5（两个 aside 加 `&& !zenMode`） | E2E（DOM 计数） | 实测现状各 1（V5） |
| 29 全屏无退出入口、`f`/`Escape` 无效（约束型） | 0.2（不改 `useZenMode`，不加按钮） | E2E | 决策 A |
| 30 普通态 `f` 只切 zen 不改 URL（回归） | 0.2（不动 `EntryDetailView.vue:239`） | E2E | 回归守护 |
| 31 文件树条目无独立全屏按钮 | D5（入口只加 header/底栏，不加进 `FileTree`） | E2E（全页计数 == 1） | Given 钉「正文无图表」 |
| 32 超 maxRows 时表头无排序/过滤控件 | 0.1B（`.th-sort-btn`/`.th-filter` 用 **v-if/v-else 双分支**：截断态渲染独立 `span.th-label`） | vitest | `.th-label` 已存在于 `.th-sort-btn` **内部**（`TableView.vue:28`）→ 给 button 整体加 `v-if` 会连它一起消失，故是「另一分支再写一份 span」而非「给既有 span 加条件」（R12/N4） |
| 33 未超限时控件存在且生效（回归） | 0.1B（截断态回退 `span.th-label`，未截断分支零改动） | vitest | 回归守护 |
| 34 截断提示含 5 与 11 | 0.1B（**字面文案**：`数据量过大，已显示前 ${constructedRows.toLocaleString()} 行，共 ${totalRows.toLocaleString()} 行`） | vitest | 用户可见文案变更；10 数据行 / maxRows=5 → `已显示前 5 行，共 11 行`，判据的两个数字由该串直接满足（M4） |
| 35 解析达上限后不再构造数据行数组 | D1 + D2（`constructedRows` 观测面） | vitest | 观测面新字段 |
| 36 截断时 `totalRows` 仍精确（回归） | D2（`parsedDataRows` 独立计数） | vitest | 与 35 联合约束 |
| 37 超限且未闭合引号仍抛错（回归） | D2（不 `break`，全文扫完再判 `inQuotes`） | vitest | `useCsvParser.spec.ts:68` 契约（文件在 `composables/__tests__/`） |
| 38 数量超限进「被跳过清单」+ 代码级关系 | D6（`40 < 49`）+ D7（清单）+ 0.1A（`overflow` 落账） | pytest | 覆写 `max_entry_files` 造件 |
| 39 单文件文本超限被跳过并记录 | D6（`_MAX_INJECT_FILE_BYTES` 新增）+ D7 | pytest | 正反双向 |
| 40 累计超总预算必须有可机器解析反馈 | D6（`_MAX_INJECT_TOTAL_BYTES`）+ D7（合取断言：`requested-inlined==len(skipped)`，`reason` ∈ **六元闭集**，`inlined` = **实际进入响应体**的个数）+ **序列化转义 `<`** | pytest | 实测 V9 重做：载体可行**且**在含 `</script` 的 `path` 下可解析、无 DOM 注入。**用例必含三件素材**：① >768KB 二进制 sibling（`binary_too_large`，B2/G1）；② 含 `<` `>` `</script` 的文件名与 path（B3/G2）；③ **一个非 css/js 的 sibling（`README.md` 或 `data.json`）** → 必须出现在清单里且 `reason="not_injectable"`（B4/G8）。「未被内联的每一个都必须在清单里可查」覆盖**既有**静默丢弃路径（含 kind-drop 与未引用二进制），不只新增三条预算。**实测 V17 已证七形态不变式成立** |
| 41 未超预算时与现状等价（回归） | D6（默认路径不改注入语义）+ 0.2（不动 `inject_resources` 匹配逻辑） | pytest | 既有注入用例 |
| 42 大 HTML 按真实 `file.size` 判定 | D8（`resolveFileSize` + `HtmlViewer` 新 `file` prop） | E2E（中文素材走真实 size） | 禁注入假值 |
| 43 512KB/2MB 左闭右开语义不变（回归） | D8（阈值与 `>=` 语义不动） | vitest | 既有边界用例 |
| 44 TreeView 截断也用真实字节 | D8（`TreeView` 新 `size` prop 共用同一工具） | vitest + E2E | 正反两向 |
| 45 两档模式与当前默认已文档化 | 0.1A（新建 `docs/architecture/html-preview-security-modes.md`） | 文档 grep | 三要素逐项可 grep |
| 46 CSP 契约与 sandbox 不变 | 0.2（`RENDER_CSP` 一字不改；D7 清单走 body 不走头） | pytest | 实测 V9：CSP 367 字符未变 |
| 47 卡片/列表不再引用 `files[0]`（代码级） | 0.1B（两处死代码删除） | vitest 源码扫描 | 命中 == 0 |
| 48 单文件 entry 行为不变（回归） | D3（resolver 对单文件返回该文件）+ 0.2 | E2E（`dsh-architecture`） | 实测 DOM：无 file-sidebar |
| 49 Share 链接权限不变（回归） | R11（保留 `share` 参数）+ 不动后端鉴权 | E2E | 无 token 仍 404 |
| 50 三 spec 迁移后回归等价 | 测试产物（`firstFileId`→`file` 9 处）+ 本文 §8 | E2E（4 个 key） | 缺 `known-failures.md` 判 FAIL |
| 51 旧 `?firstFileId=` 安全回退默认入口 | D4 + R11（该参数被忽略并清理，不重定向） | E2E | 实测现状会选中 `service.yaml`（V6） |
| 52 人工体验：seed 后详情页有内容且 TOC == 4 | D1（h1 入目录）+ D3 | E2E（桌面 1280×800） | `k8s-deployment` |
| 53 全屏态为纯内容（① ② 回归 + ③ 新增） | D5（②③）+ 0.2（①②） | E2E（可视计数 + DOM 计数） | 区分力全在 ③ |
| 54 全屏态正文文件链接仍可切换且 URL 同步 | D4（`handleNavigateFile` → `selectFile` + URL 同步，zen 态由路由决定不受影响） | E2E（`unicode-filenames/f`） | 实测链接已渲染为 `?file=34`（V10 附带观察） |

> 覆盖核对方式：脚本枚举本文显式 `BDD-NN` 引用 + 上表逐行，**54/54 全部有落点与验证层**；其中 12 条为 P1 标注的回归守护/约束型/不变守护（06、27、29、30、33、36、37、41、43、46、48、49），方案对它们的处置均为「不动 + 回归验证」，与 P1 定性一致。

---

## UI 设计

### 渲染形态声明（必填，与 P1 形态声明一致）
- 渲染形态: `layout`（布局型——本任务改动集中在详情页的分区结构、容器显隐与控件位置，无画布/WebGL/时序动画）
- 适用维度: 布局结构 / 交互行为 / 视觉呈现（与 P1 `ui_ux_dimensions` 一致）

### 布局层候选（布局结构维度 — 三组各 ≥2 候选 + 权衡）

> **与 §1 架构候选的关系**：§1 的候选 A/B/C 在**架构层**分叉（锚点生成点 / 超限反馈承载形态），三者在 UI 布局、视觉、交互上完全一致（原 `:171` 已诚实声明「不制造假分叉」）。本节按角色要求把 `candidate_count` **下沉到 UI 层**，对**布局 / 视觉 / 交互**三个启用维度各给一组真分叉。**frontmatter 的 `candidate_count: 6` = §1 的 3 个架构候选 + 本节 3 组布局层候选（每组择一后计入，A/B 为比较项）**——即 3 架构 + 3 布局层选定方案。分叉点不凭空发明：全部来自 `P2-review-design.md §3` 实测出的现成选择点。

#### 布局组 L：移动端全屏入口的位置（兼解 360px 溢出）

| 候选 | 做法 | 优点 | 风险 / 代价 | 实测数据 |
|---|---|---|---|---|
| **L1** | 底栏左簇、`flex-spacer` **之前**，并**把 `.mobile-bottom-bar` 的 `gap` 由 8px 收到 4px** | ① 与 Files/TOC/Source 同属「当前文件的操作」语义簇；② 44px 触控热区不缩水；③ 一处间距改动即让 360px 达标 | 底栏所有相邻控件间距同步变紧 4px（视觉密度上升，但仍在 `--space-1`/`--space-2` token 范围内） | 4 entry × 360/375 实测：`gap 8px` @360 **溢出 10px**；`gap 4px` @360 **溢出 0**（spacer 余 5.39px）、@375 余 20.39px、@390 余 35.39px（V14） |
| **L2** | 移入 `OverflowMenu`（`variant="sheet"`）的 `overflowItems` | 底栏零新增控件 → 360px 天然不溢出；语义上「低频操作」收进更多菜单 | ① **可发现性显著下降**（要两次点击、且 `sheet` 是 `Teleport` 到 body 的浮层）；② BDD-24 ① 要求「入口热区完全落在底部操作栏矩形内」——`Teleport` 出的 sheet 不在栏内 → **BDD-24 ① 直接 FAIL**，除非改 P1 判据（禁止） | sheet 经 `Teleport to="body"`（`OverflowMenuSheet.vue:2`），`position: fixed` —— 不属底栏子元素 |
| **L3** | 底栏**右簇**（`flex-spacer` 之后、Copy/overflow 之前） | 与 Copy 同属「输出类动作」；左侧浏览簇与右侧动作簇语义更分明 | 右簇是 44px 逻辑按钮的密集区（Copy + overflow trigger），横向预算更紧；@360 在 `gap 8px` 下同样溢出 10px，**不解决 M1** | 同 V14 的量测口径 |

**选 L1**：唯一同时满足「不降可发现性」「BDD-24 ① 判据不动」「360px 达标」三项的候选。L2 的致命问题是它让 BDD-24 ① 无法在**不改 P1 基线**的前提下通过；L3 与 L1 的溢出表现相同但不解决 M1，且破坏「浏览簇 / 动作簇」的既有分组（左簇已含 Star 这类非纯浏览控件，但右侧 `spacer` 的语义就是「把动作推到末端的弹性槽」，往里塞会挤压 Copy 的固定位置）。

#### 视觉组 V：TOC 中 h1 与 h2 的可区分性（D-2 核心）

> **前提事实（实测）**：`.toc-item` **只有 `margin`、无 `padding`**（`TocNav.vue:38`），且 `TocNav.vue:42-44` **只有 `.toc-level-2/3/4` 三条规则、无 `.toc-level-1`**。故原方案写的 `.toc-level-1 { padding-left: 0 }` 是 **no-op**（该属性默认已 0，写与不写渲染完全相同）——它不是层级手段。实测 baseline：`.toc-level-1` 与 `.toc-level-2` 的 `paddingLeft 0 / marginLeft 0 / fontSize 14px / fontWeight 400 / x 1057 / aWidth 207 / 高度 29` **逐项相同**（V16）。

| 候选 | 做法 | 优点 | 风险 / 代价 | 实测数据（1280×800，`k8s-deployment`） |
|---|---|---|---|---|
| **W1** | **加粗 + 主文字色**（**颜色与字重拆两条，见 R16**）：`.toc-item.toc-level-1 a { font-weight: 600; }` + `.toc-item.toc-level-1:not(.active) a { color: var(--c-text); }` | ① 不引入缩进 → 不改变条目可点击区域的横向范围（`aW` 仍 207）；② 与正文 h1 的视觉权重呼应；③ **与 `.toc-item.active a`（`--accent-color`）和平共存**——`:not(.active)` 只挡颜色、字重仍作用于 active 态 | 字重变化在 14px 小字上辨识度弱于几何差异 | `aWeight 400 → 599.5`、`aColor rgb(154,167,180) → rgb(233,238,244)`（inactive）、`ax 1057 不变`；对比度 **15.26:1**（远超 AA 4.5）。**active 态实测见 V18** |
| **W2** | **上间距 + 顶分隔**：`.toc-item.toc-level-1 { margin-top: var(--space-3); border-top: 1px solid var(--border-color); padding-top: var(--space-2); }` | 用「组边界」表达 h1 是标题而非章节之一；不依赖字号/字重（对高对比度模式最稳） | ① 多出 9px 高度（29 → 38px），TOC 变长；② 顶分隔在只有 1 个 h1 时视觉上像「TOC 标题下的第二条分割线」，与 `.toc-title` 的 `border-bottom` 形成双线 | `liMarT 4 → 12px`（仅上间距时 `liH` 仍 29）；加 `border-top` 后 `liH 29 → 38`、`liBorderTop 1px` |
| **W3** | **缩进体系整体重排**：`.toc-list .toc-item.toc-level-N` 提特异性后改 `h1=0 / h2=--space-2(8px) / h3=--space-4(16px) / h4=--space-6(32px)` | 层级用几何递进表达，最符合「目录」的心智模型；h5 虽被排除，但 4 级仍在侧栏宽度内 | ① **改动面最大**：h2/h3 的 `padding-left` 现值也被改写（h2 `0→8`、h3 `12→16`），会连带影响既有 3 条 TOC 视觉用例的观感；② 须用 `.toc-list .toc-item.toc-level-N`（特异性 0,2,0）才能压过既有 `.toc-level-N`（0,1,0），否则**规则静默不生效**——这正是 D-2 第 8 项点出的陷阱 | 特殊版实测：`ax` 1057/1065/1073/1089 → h1−h2 差 **8px**、h2−h3 8px、h3−h4 16px（低特异性版实测**无变化**，证明特异性陷阱真实存在） |

**选 W1 + W2 组合（加粗主色 + 上间距，不含顶分隔）**：

- **为什么不选 W3**：它确实能产生最清晰的几何层级，但代价是**重写 h2/h3 的既有缩进**——那是既有 3 条 TOC 视觉用例与既有观感的基线，属 P1 未声明的范围扩张（P1 BDD-04 只要求「覆盖 h1–h4 且排除 h5」，不要求改既有缩进）。此外它最容易被「特异性不够」静默吃掉（实测已证），实现风险最高。
- **为什么不单用 W2**：顶分隔的双线问题（与 `.toc-title` 的 `border-bottom`）需要额外调 `--space-*` 才能消解，收益不抵。
- **最终组合（颜色与字重拆两条——R2-1 / R16）**：`.toc-item.toc-level-1 a { font-weight: 600; }` + `.toc-item.toc-level-1:not(.active) a { color: var(--c-text); }` + `.toc-item.toc-level-1 { margin-top: var(--space-3); }`。实测：inactive `aWeight 599.75 / aColor rgb(233,238,244)`、active `aColor rgb(77,141,255)`（强调色保住）且 `aWeight` 仍 **600**；`liMarT 12px / ax 1057 不变 / 对比度 15.26:1`。**不写 `.toc-level-1 { padding-left: 0 }`**（no-op，删除原论证）。
- **R16：为什么不能只写一条 `.toc-item.toc-level-1:not(.active) a { font-weight:600; color:... }`**（design 处方的一处需细化）：`:not()` 同时挡掉了**颜色与字重**两条声明 → h1 被点亮成 active 时，`font-weight` 回落到 `.toc-item a` 的继承值 **400**，accent 色回来了但「h1 加粗」这个层级信号在 active 态消失（实测 V18：`B :not(.active) 整条` → active `color rgb(77,141,255)` + **`fw 400`**）。故必须**把字重与颜色拆成两条规则**：字重无条件作用（active 也要粗），只有颜色按 `.active` 让位。V18 实测 `C 拆分` → active `color rgb(77,141,255)` + **`fw 600`**，inactive `rgb(233,238,244)` + `fw 600`，两个方向都对。
- **`.toc-level-1` 规则的实际存在性（D-2 第 8 项）**：本轮选定的三条规则都用 `.toc-item.toc-level-1` 双类选择器（特异性 0,2,0），**确实存在且可压过**任何 `0,1,0` 级规则；P4 的验证判据用 **`getComputedStyle(a).fontWeight !== '400'`** 与 **`li.marginTop === '12px'`** 两条，比 `getBoundingClientRect().x` 差异更直接（x 在选定方案里**本来就不变**，故不能拿 x 当判据——这正是 W3 与 W1/W2 的关键区别）。
- **不做「h1 与 h2 视觉同级」的有意设计**：那会让「决策 B（扩 h1 进 TOC）」只增加一个与 h2 同款的条目，「层级」这个视觉信号消失——而 P1 §3.2 采纳决策 B 的动机正是「Setext h1 也是正文结构的一级」，若视觉上无从分辨则该动机落空。BDD-04 只断计数 == 4，**不要求可区分**，所以这条缺陷不被任何 BDD 捕获，必须在设计层显式解决。

#### 交互组 I：桌面全屏入口的位置

| 候选 | 做法 | 优点 | 风险 / 代价 | 实测数据 |
|---|---|---|---|---|
| **I1** | `.actions-area` 内，Copy 之后、Share 之前 | 与 Copy/Share/TOC/Source 同属「页面级操作」簇；既有全部交互动词（tooltip / `:focus-visible` / hover 色）零新增 | 标题固定让出 36px | 三档 `clientW == scrollW`（423→459）、`bodyScrollW == bodyClientW`、`title-group` `scrollWidth == clientWidth` 且 `truncated:false`（1024 `377→341`、1280 `633→597`、1440 `793→757`）（V15） |
| **I2** | `.actions-area` 的 `OverflowMenu`（`variant="dropdown"`）内 | 不占横向空间（标题让位 0） | ① **BDD-23 直接 FAIL**——判据钉死「位于页面 header 的工具区内（`.actions-area`）」且「可点击元素 `offsetParent` 非 null」+ 名称匹配计数 == 1；dropdown 收起时元素不存在；② 可发现性下降 | `OverflowMenu` 的 dropdown 分支为 `v-if="isOpen"` → 收起时 DOM 不存在 |
| **I3** | 标题行右侧独立区（`.title-group` 之后新建一段） | 与「当前文件」语义最近 | ① 新增一个横向分区 → 破既有「左侧 title-group 弹性 + 右侧 actions-area 固定」的两段式结构；② 三档下 title-group 的弹性让位关系要重算；③ 属 `DESIGN.md §6`「不得发明新按钮变体/新层级」的边界 | 无独立区可复用（`EntryDetailHeader` 现为 title-group + actions-area 两段） |

**选 I1**：P1 §4 的 `[SUGGEST]` 已明确推荐「桌面 `.actions-area` + 移动 `mobile-bottom-bar`」组合，且 BDD-23 的判据本身就把位置钉死在 `.actions-area` 内——I2 会在不改 P1 的前提下无法通过，I3 属新增布局层级。I1 的「标题让出 36px」已实测无副作用（三档不截断、无文档级横向滚动）。

### 布局 checklist（布局结构维度）
- [ ] 页面/组件层级结构已描述：详情页 `EntryDetailView`（根 `.entry-detail`，`zen-mode` 修饰类）→ `EntryDetailHeader`（`.actions-area` 工具区）+ `EntryDetailBanners` + `EntryDetailContent`（`.detail-content` 三段式：`.file-sidebar` 左 + `.content-area` 主 + `.toc-sidebar` 右）+ `EntryDetailMobileBar`（移动底栏）+ `EntryDetailDialogs`
- [ ] 关键区域占位关系已描述：桌面三栏（左文件树 160–500px 可拖拽 / 中正文 flex:1 / 右 TOC 150–400px 可拖拽）；移动单列 + 固定底栏；全屏态**只保留中间主区**——`.file-sidebar` 与 `.toc-sidebar` **DOM 不渲染**（非 CSS 隐藏），`.detail-header` / `.mobile-sticky-header` / `.mobile-bottom-bar` 保留 DOM 但 `v-show` 隐藏，`.meta-tags-bar` 由 `v-if="isMobile && currentEntry"` 决定（桌面 DOM 0）
- [ ] 桌面与移动两档 viewport 布局均说明：桌面 **1280×800**（三栏、TOC 默认展开、全屏入口在 `.actions-area`）；移动 **390×844**（BDD-24 的 Given 视口；单列、底栏 64px、全屏入口在底栏左簇）+ **移动端最小支持宽度 360px**（见下「最小支持宽度声明」）。全屏态两档都不得出现侧栏 DOM 与可点击的退出入口

### 移动端最小支持宽度声明（必填 — design D-3 / M1）

**最小支持宽度 = 360px**（`DESIGN.md §9` 只给 `<= 640px` 的 Mobile 档**上界**、未给下界；360px 是 Android Galaxy S 系列等主流设备的逻辑宽度，`360dp` 属最常见窄档）。

- **360 / 375 / 390 三档都必须通过底栏无横向溢出**（`scrollWidth <= clientWidth`），不是「只保 390」。
- **该项的必要性**：BDD-24 的 Given 钉死 390×844，**P6 按字面跑会 PASS**，360 的缺陷不会被任何 BDD 捕获 → 必须由本设计的显式声明 + `P5_e2e` 守护性断言承担（不新增 BDD，P1 基线不动）。
- **实测（V14）**：`gap: 8px` 下 @360 溢出 10px（`overflow-menu-trigger` 右缘 370 > 360，被裁的是「更多操作」入口 → **功能损失**）；`gap: 4px` 下 @360 溢出 0。@375 恰好用尽（spacer `44.39 → 0`），@390 有余量。
- **落地改动**：`EntryDetailMobileBar.vue` 的 scoped `.mobile-bottom-bar { gap: var(--space-2) → var(--space-1) }`（即 8px → 4px，这是**生效**的规则；`layout.css:538` 的同名 `gap: 4px` 被它覆盖、当前不生效，**不动**）：

  | 档位 | `gap: 8px` | `gap: 4px` |
  |---|---|---|
  | 360 | **溢出 10px**（spacer 0） | **溢出 0**（spacer 5.39px） |
  | 375 | 溢出 0（spacer 0，恰好用尽） | 溢出 0（spacer 20.39px） |
  | 390 | 溢出 0（spacer 7.39px） | 溢出 0（spacer 35.39px） |

- **不采用的两条路**：① 缩小新按钮（38px 仍溢出 4px、40px 仍溢出 6px，且违反 `DESIGN.md §9` 触控目标 ≥44px）；② 「新按钮在 ≤375 时进 overflow」（实测把 wrap 按钮移出后 @360 仍溢出 10px —— 代价由「多一个 44px 按钮」本身决定，与挤掉哪个按钮无关，除非把整个入口移走 → 那就是 L2，已因 BDD-24 ① FAIL 否决）。
- **守护性断言落点**：`gate_commands.P5_e2e_mobile_widths`（独立 spec `e2e/tpv0104-mobile-bar-widths.spec.ts`，见 §5 口径说明 + 下方视觉 checklist ⑤）。

### 交互 checklist（交互行为维度）
- [ ] 键盘可达性：新增两个全屏按钮均为原生 `<button>`，`tabindex` 自然顺序（桌面在 Copy 之后 / 移动在左簇末位）；`:focus-visible` 由既有 `.icon-btn:focus-visible` 提供可见焦点；`aria-label="全屏阅读"` 保证可访问名称；`Enter`/`Space` 由 `<button>` 内建激活。既有 `f` 键 zen（普通态）与 `/f` locked 态**不改**
- [ ] 输入态变化：无新增文本输入；`?file=` 属 URL 输入态——变化路径为「URL → 首屏选中文件」与「页内切换 → URL 同步（`replace`，不增历史）」，两向均由 BDD-14/19/20/21 覆盖；表格过滤输入框在截断态**不渲染**（`v-if`）
- [ ] 反馈（loading/error/empty/disable）：① 表格截断态显示截断提示（含已显示行数 + 总行数）+ 排序列控件降级为纯文本；② 注入超限显示跳过清单（结构化 JSON 块，**对用户不可见**——见下方「跳过清单为何是机读而非可见横幅」）；③ 文件切换沿用既有 `fileLoading` 骨架屏 / `fileError` 错误态；④ 无效 `?file=` **静默回退默认入口**（BDD-16/18 要求「页面无错误横幅」，权衡见 D4 末段）
- [ ] **跳过清单为何是「机读 JSON」而非可见横幅（对 P0 决策 4 的说明 — 主 Agent 指定的归因更正项）**：P0 决策 4 的原文要求是「超限时**反馈而非静默**」，其**反义面是「静默丢弃、零记录」**（这正是 V7 复现的现状：51 sibling 静默丢 1 个、>768KB 二进制静默丢 1 个，两者都无任何记录）。本方案的处置是**把不可观测变为可观测**：清单以 `<script type="application/json" id="peekview-inject-report">` 承载，**`requested - inlined == len(skipped)` 恒成立、每一项都带 `filename` / `path` / `reason` / `size`**，因此「哪些资源为什么没被内联」从**无从得知**变成**可机器解析、可被工具/脚本/Agent 读取**——反馈通道成立。**不新增可见横幅**的三条理由：① P1 的 54 条 BDD 中**无任何一条**要求用户可见的超限提示（BDD-40 的判据是「可机器解析」，非「可见」），加横幅属**超出基线**；② 该清单落在 `render` 路由的 iframe 内（`sandbox="allow-scripts allow-forms"`、无 `allow-same-origin`），在此新增 UI 面会与「demo 页面内容」混排，破坏「用户发布的内容原样呈现」的语义；③ P1 §5 的用户可见变更清单（7 项）已冻结，新增横幅会让 P8 的 CHANGELOG 与 P6 的视觉验收同时扩面。**明确承认的残留**：普通终端用户（不跑脚本、不开 devtools）确实看不到这条反馈——即「反馈对象是**工具与 Agent**，不是终端用户的视觉」。这与 P0 决策 4 的**字面**「用户可感知」有落差；但因 P1 未把它立为 BDD，本阶段**不擅自扩张为可见 UI**，如需可见面应回 P1 增补基线（登记见 §9）。
- [ ] 输入态变化类用例若存在：**无纯输入态用例**（无表单输入 → 界面状态变化的判据）；`?file=` 属导航态，由 E2E 覆盖，不需人工复核
- [ ] [渲染组件型可选] 手势/动作交互：**维度不适用**（本任务无画布/3D 手势）

### 视觉 checklist（视觉呈现维度）

> 视觉契约断言 = 可表达子集：宽度 / 高度 / 对齐 / 重叠 / 溢出 五类 DOM 度量，E2E 以 `getBoundingClientRect` 量化采集；主观视觉归截图人工复核。

- [ ] 颜色/对比度：新增按钮沿用 `.icon-btn`（默认 `--c-text-secondary`、hover `--c-text`），不引入新颜色；对比度由既有 token 保证（正文 4.5:1 / 大字 3:1）；跳过错清单 JSON 块**不可见**（`<script>` 无渲染），不参与视觉
- [ ] 字体层级与间距节奏：新增按钮无文字标签（仅图标 + `aria-label` + 桌面端既有 `.tooltip`），不新增字号层级；**图标尺寸 16px——跟随既有 `.icon-btn` 内的兄弟按钮**（实测 `CopyIcon :size="16"` / `Share2Icon :size="16"` / `StarToggle` 的 `Star :size="16"`），**不是** `DESIGN.md §7` 的规定：§7 的档位为「16px (inline) / **18px (compact buttons)** / 20px (buttons/lists)」，`.icon-btn`（32×32）按 §7 应取 18px → **既有代码与 §7 本就存在偏差，本任务不修正它**（一致性优先，改 16→18 会让新按钮与兄弟按钮不一致，且属 P1 未声明的范围扩张）。TOC h1 视觉层级见「布局层候选 · 视觉组 V」：选定 `.toc-item.toc-level-1 a { font-weight: 600; color: var(--c-text) }` + `.toc-item.toc-level-1 { margin-top: var(--space-3) }`（**实测 `fontWeight 600 / liMarT 12px / 对比度 15.26:1`**）；**不写 `.toc-level-1 { padding-left: 0 }`** —— 该属性默认已 0，是 no-op，不构成层级手段。既有 h2/h3/h4 缩进（`0 / --space-3 / --space-6`）**不改**
- [ ] 组件一致性：全屏入口用既有 `.icon-btn` + `Maximize`（Lucide）图标；变体选择依据 `DESIGN.md:162` 的 Selection rule（**stateless one-shot action → `.icon-btn`**；persistent-state → `.toggle-btn`；有文字标签 → `BaseButton`），符合 §6「不得发明新按钮变体」；**图标 16px 的理由是跟随既有兄弟按钮，不引用 §7**（§7 的 compact 档为 18px，与本仓既有 `icon-btn` 内的 16px **存在既有偏差**，本任务不修正——见视觉 checklist 第二项）；过渡继承既有 `.icon-btn` 的 `transition: all var(--transition-fast)`（150ms，§8 Fast 档），**不加自定义过渡**；截断态表头的纯文本 `span.th-label` 复用既有 `.th-label` 样式；底栏按钮复用 `.mobile-bottom-bar .icon-btn`（`min-width/min-height: 44px` 触达热区，满足 `DESIGN.md §9`「触控目标 ≥44px」）
- [ ] **可量化校验点（供 P6 直接执行）**：① 桌面 `.actions-area` 内 `[data-testid="detail-fullscreen-btn"]` 的 `rect` 完全落在 `.actions-area` 矩形内（BDD-23）；② 移动 `[data-testid="mobile-bar-fullscreen-btn"]` 的 `rect` 完全落在 `[data-testid="mobile-bottom-bar"]` 矩形内，且栏 `rect.height ≤ 64`（BDD-24 ①②）；③ 正文滚动到底时最后一个块的 `rect.bottom ≤ 栏 rect.top`（BDD-24 ③）；④ 全屏态 `.content-area` 的 `rect.width ≥ 0.95 × innerWidth`（BDD-53 ②）；⑤ **移动底栏无横向溢出，三档宽度各断一次**：`bar.scrollWidth <= bar.clientWidth` 在 **360 / 375 / 390** 三档分别断言（M1 守护性测量；390 对应 BDD-24 的 Given 视口，360 为最小支持宽度声明、375 为临界档）；⑥ **标题未被截断**：`.title-group` 的 `scrollWidth <= clientWidth` 在 1024 / 1280 / 1440 三档各断一次（M7；实测三档插按钮后为 `341/597/757` 且 `truncated:false`）；⑦ **TOC h1 与 h2 可区分，且 h1 的 active 态不被新规则吃掉（正向 + 反向各一条）**：
   - **正向（inactive）**：`getComputedStyle(h1Link).fontWeight !== '400'`（实测 `599.5+`）且 `getComputedStyle(h1Item).marginTop === '12px'`，同时 `h1Link.getBoundingClientRect().x === h2Link.getBoundingClientRect().x`（**缩进不变**——选定方案不靠缩进，故 x 相等是正向判据而非缺陷信号）；
   - **反向（active，R2-1 的检出能力）**：把 h1 条目置为 `.active`（等价于滚到文章开头让 scroll-spy 点亮它）后断言 **`getComputedStyle(h1Link).color === getComputedStyle(注入探针).color`，探针色为 `var(--accent-color)`**（实测解析为 `rgb(77, 141, 255)`），**且 `fontWeight !== '400'` 仍成立**（R16：`:not(.active)` 只挡颜色不挡字重）。
   - **为什么必须有反向断言**：R2-1 存在时**正向三项全真**（实测 A 原设计 inactive 与 active 的 fw/mt/x 完全一致）→ 只断正向等于判据漏检；这条补的是「判据的检出能力」，比修 CSS 更重要。
   - **实测依据**：V16（inactive）+ V18（active 四组对照）。

---

## 3. 完成标志（实现完成的判定标准，供 P3/P5 使用）

1. 前端单测：新增/扩展用例全绿，且 `useCsvParser.spec.ts:51-57`（**空输入 `totalRows === 0`**，N1；`:51` 是 `it()` 行、断言在 `:55`）与 `:68`（`toThrow`，BDD-37）两条既有契约仍在。
2. `make typecheck` exit 0（新增 `default-file.ts` / `file-bytes.ts` / `normalizeFileQuery` / 新 props 的类型闭合）。
3. `make lint` exit 0。
4. 后端 `make test-quick` 失败集不新增（既有失败 `test_cli_remote::test_config_set_remote_api_key` 属沙箱只读，与本任务无关；「偶发第二失败项」未稳定复现 → 按 `known-failures.md` 的失败集判定，不把未复现计数当基线）。
5. 新建 e2e spec（`tpv0104-viewer-hardening` + `tpv0104-mobile-bar-widths`）全绿；三个迁移 spec 失败集不劣于基线（`viewer` 18F/20P、`t091` 12F/12P、`tpv0099` 6P/0F）。
6. 代码级断言可机械执行：`EntryCard.vue`/`EntryListRow.vue` 中 `files[0]`/`files?.[0]` 命中 0；`useEntryDetailComputed.ts` 中 `/^(#{1,6})\s+/` 命中 0；`_MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1`（**读声明默认值**，N2）。
7. **`inject_resources` 的 13 处既有调用零改动**（`grep -c "= inject_resources(" backend/tests/test_html_render.py` 仍为 13 且全绿；该文件进 `tests_filter` 的理由就是护住这 13 处）。
8. **超限清单可解析且无注入，且未内联项无一遗漏**：`requested - inlined == len(skipped)` 成立（**`inlined` 取「实际进入响应体」读法**）、`reason` 全部落在**六元闭集**内、**含 `</script` 的 `path` 素材下 `json.loads` 成功且 `path` 值无损**（B3/R15）；**并至少有一个非 css/js sibling（`README.md`/`data.json`）出现在 `skipped` 里且 `reason == "not_injectable"`**（B4）。断言形态须**两条都写**：`len(skipped) == requested - inlined` **且** `{s.reason for s in skipped} ⊆ 六元闭集`——只写后者时「丢弃了但没记」仍会绿（G10）。
9. **移动底栏三档无溢出**：360 / 375 / 390 均 `scrollWidth <= clientWidth` 且 `height <= 64`（M1，`P5_e2e_mobile_widths`）。
10. **TOC h1 与 h2 在视觉可区分，且 active 态不吃掉强调色**：inactive `h1Link.fontWeight !== '400'` 且 `h1Item.marginTop === '12px'`；**active（反向）`h1Link.color` 等于 `--accent-color` 的解析值（`rgb(77, 141, 255)`）且 `fontWeight` 仍非 `400`**（D-2 + R2-1/R16，UI 校验点 ⑦）。
11. **桌面全屏按钮不在 404 页渲染**：`/definitely-not-an-entry-xyz` 下 `[data-testid="detail-fullscreen-btn"]` 计数 == 0（M2/R14）。
12. **全屏入口的 I/O 链类型闭合（R2-2）**：`make typecheck` exit 0，且 `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` 的 `defineProps` 均含 `activeFile`、`defineEmits` 均含 `'fullscreen'`；`EntryDetailView.vue` 对两个组件的绑定均含 `:active-file` 与 `@fullscreen`（源码级 grep 可核，`grep -c activeFile EntryDetailHeader.vue` 不得为 0）。

---

## 4. files_to_read（P4 实现导航，控上下文）

```yaml
files_to_read:
  - path: frontend-v3/src/composables/useCsvParser.ts
    why: V-03 全部改写面（67 行全文）；:57-59 是 BDD-37 的契约边界，:7/:12 是现状"先全量后截断"
  - path: frontend-v3/src/composables/useMarkdown.ts:317-400
    why: heading_open renderer（:329-343）是 V-02 的唯一点；:383 render、:396-399 restore 顺序必须保持
  - path: frontend-v3/src/composables/useMarkdown.ts:460-484
    why: 唯一 return 点（html 常量空串）+ MarkdownRenderResult 结构，确认 headings 出口
  - path: frontend-v3/src/composables/useEntryDetailComputed.ts:40-80
    why: extractHeadings（删除）+ tocHeadings（改 ref 容器）+ handleNavigateFile（URL 同步挂载点）
  - path: frontend-v3/src/views/EntryDetailView.vue:228-276
    why: onMounted 读参/清参（:234/:238）+ 默认展开（:243-246）+ 重复展开（:262-276）+ 需要新增的 watcher 落点
  - path: frontend-v3/src/stores/entryDetail.ts:36-71
    why: loadEntry 的 files[0] 兜底（:49-53）→ resolveDefaultFile；fileId 无效回退
  - path: frontend-v3/src/components/EntryDetailContent.vue:1-95
    why: 两个 aside 的 v-if（:4/:78）、无效 :headings 绑定（:56）、HtmlViewer/TreeView prop 透传（:54/:62）
  - path: frontend-v3/src/components/EntryDetailHeader.vue:13-60
    why: .actions-area 插入点（Copy 之后 Share 之前）+ 既有 icon-btn/tooltip 写法
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue:1-60
    why: 底栏左簇插入点 + flex-spacer 位置（决定不溢出）
  - path: frontend-v3/src/components/TableView.vue:1-60,120-200
    why: 截断提示文案（:5）、.th-sort-btn/.th-filter（:22-38）、maxRows 默认（:127）、两个 shallowRef 初值（:136/:183）
  - path: frontend-v3/src/components/HtmlViewer.vue:75-160
    why: contentSize（:92-94）+ 阈值 + renderUrl；新增 file prop 的接入点
  - path: frontend-v3/src/components/TreeView.vue:60-130
    why: MAX_SIZE/truncated（:73-75）+ props 声明（须增 size）
  - path: frontend-v3/src/utils/file-bytes.ts
    why: 新建文件（与 HtmlViewer/TreeView 共用）
  - path: frontend-v3/src/utils/default-file.ts
    why: 新建文件（resolver 单点）
  - path: backend/peekview/services/html_render_service.py:1-80
    why: 常量区（:17-19）+ parse_inject_ids（:54-74）扩展点
  - path: backend/peekview/services/html_render_service.py:177-230
    why: inject_resources 入口（text_siblings 构造、text_map 建立）——单文件上限的落点
  - path: backend/peekview/api/files.py:269-355
    why: **_build_sibling_data（:270-300）是 B2 的改动落点**（`>768KB` 二进制 `return None` 的静默丢弃须由调用方补记 `binary_too_large`；`:272` 是全仓 `_BINARY_SIZE_LIMIT` **唯一**消费点）+ render_html_file 预算编排（`:304-354`）+ Response 头（`:346-354` 不得改）
  - path: backend/peekview/services/entry_service.py:440-460,1281-1310,1410-1441
    why: get_entry 分支（:432）+ _build_response（:1281）+ entry.files/get_entry_files（:1423/:1429）——order_by 统一落点
  - path: backend/tests/test_html_render.py:20-70
    why: client fixture（create_app + mkdtemp）与 _create_entry/_render_url helper，新增预算用例照此写。**注意 `_create_entry`（:44-55）返回的是 POST 响应的 `files`（构造序）**——这是 B1「补 order_by 对本文件零影响」的机制依据；另 :291,308,329,347,363,461,483,499,514,529,619,635,651 是 **13 处 `= inject_resources(...)` 既有调用**，B2 的「不改签名」要求它们零改动（grep 计数须保持 13）
  - path: frontend-v3/src/composables/__tests__/useCsvParser.spec.ts:45-70
    why: 该文件在 composables/__tests__/（**不是** components/__tests__/，N6 实测更正）；:51-57 是空输入 `totalRows === 0` 契约（`:51` 是 `it()` 行、断言在 `:55`），:68 的 toThrow 契约，扩展 constructedRows 断言照此写
  - path: frontend-v3/src/components/__tests__/TableView.spec.ts:180-200
    why: maxRows=5 的先例（:184），BDD-32 用例照此写
  - path: frontend-v3/src/components/__tests__/HtmlViewer.spec.ts:330-370
    why: 512KB/2MB 左闭右开边界契约（BDD-43 不得破坏）
  - path: DESIGN.md:155-165,210-212,235-244,258-286
    why: Zen locked 语义（决策 A）+ **:162 的 Selection rule（`.icon-btn`=stateless one-shot / `.toggle-btn`=persistent-state）——变体选择的官方口径**、**§7 Iconography（`:239` 明确「16px (inline), **18px (compact buttons)**, 20px」→ 本仓 `icon-btn` 内既有的 16px 与 §7 存在既有偏差，M3 已更正论证引用）**、Responsive（触控 44px、底栏）
```

---

## 5. gate_commands（冻结窗口）

写入正文（非 frontmatter），供 P3/P5/P6 读取。每个校验独立 key，不做 `&&` 串联（协议 `--strict` 反模式）。

> **`P3` 只跑前端，后端红灯按 §5.1 的规定动作取证**。这不是「图省事」——`P3` 的取值受协议硬约束（只能一个 key、一条命令、一个 formatter），而唯一可行的「两端合一」写法会让 P3 gate **永久空转**。完整推演见 §5.1，P3 执行者必读。

```yaml
gate_commands:
  P3: "make test-frontend"
  P3_formatter: "vitest.sh"
  P5: "make test-quick"
  P5_frontend: "make test-frontend"
  P5_typecheck: "make typecheck"
  P5_lint: "make lint"
  P5_docs: "make check-docs"
  P5_e2e: "E2E_SPEC=e2e/tpv0104-viewer-hardening.spec.ts make debug-test"
  P5_e2e_mobile_widths: "E2E_SPEC=e2e/tpv0104-mobile-bar-widths.spec.ts make debug-test"
  P5_e2e_legacy_viewer: "E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  P5_e2e_legacy_t091: "E2E_SPEC=e2e/t091-mobile-detail-visual-polish.spec.ts make debug-test"
  P5_e2e_legacy_tpv0099: "E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test"
  P5_timeout_seconds: 600
  P5_frontend_timeout_seconds: 300
  P5_typecheck_timeout_seconds: 300
  P5_lint_timeout_seconds: 180
  P5_docs_timeout_seconds: 120
  P5_e2e_timeout_seconds: 900
  P5_e2e_mobile_widths_timeout_seconds: 600
  P5_e2e_legacy_viewer_timeout_seconds: 900
  P5_e2e_legacy_t091_timeout_seconds: 900
  P5_e2e_legacy_tpv0099_timeout_seconds: 900
  project_module: "src/"
```

**口径说明**

- `P3` 选 `make test-frontend`：54 条 BDD 中 30+ 条的**新行为判据**落在 vitest 层（CSV 观测面、resolver、headings 一致性、截断态控件、字节判断、源码扫描断言）。**后端预算用例的红灯按 §5.1 的规定动作取证**（不是「另跑一下写进证据」这种软要求）。
- `P5` 用 `make test-quick`（后端全量 1205 项，含新增预算/排序用例）；`P5_frontend` 用 `make test-frontend`（vitest 全量）。两者分开，避免一条命令失败掩盖另一条。
- `P5_e2e` 钉死新建 spec（`ui_affected: true` 的必填项）；三个 legacy spec 各自独立 key，按 BDD-50 的「失败集不劣于基线」判，**不要求全绿**。
- **`P5_e2e_mobile_widths`（新增，design M1 / D-3 的落点）**：独立 spec `e2e/tpv0104-mobile-bar-widths.spec.ts`，专职**三档宽度守护性断言**——在 **360 / 375 / 390** 各打开一个最坏形态 entry（多文件 + wrap 按钮可见，实测取 `k8s-deployment` / `unicode-filenames`），断言 `bottomBar.scrollWidth <= bottomBar.clientWidth` 且 `bottomBar.height <= 64`。**为什么独立 key 而不塞进 `P5_e2e`**：① 失败含义不同——`P5_e2e` 红 = 功能没做对，本 key 红 = **布局回归 / 最小支持宽度破线**，分开才能一眼归因；② BDD-24 的 Given 只钉 390，**360 属 P1 未覆盖的守护面**，独立成 key 让它在 P5 报告里显式可见（不被大 spec 的其它失败淹没）；③ 独立 spec 可在 P5/P6 按需单跑。timeout 600s（3 档视口 × 页面加载，低于单 spec 的 900s 档但仍留足余量）。
- 架构适应度检查（判据三）：`P5_typecheck`（vue-tsc，含新模块类型闭合）、`P5_lint`（ruff）、`P5_docs`（`make check-docs` 文档一致性——本任务新增 `docs/architecture/html-preview-security-modes.md` 并改 CHANGELOG，文档一致性属本任务涉及的架构约束）。另三条**代码级**适应度断言写进 P3 用例（源码扫描型）：`files[0]` 归零、`/^(#{1,6})\s+/` 归零、`_MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1`。
- `{key}_timeout_seconds` 按三档基准：单元测试类 120s 起档、E2E 900s（本仓 `run-e2e-tests.sh` 内层 `E2E_TIMEOUT=600` + 浏览器启动 + 多 BDD，留足余量）、构建/lint/typecheck 180–300s。`P3` 不声明 `timeout_seconds`（走 `AGATE_TDD_TIMEOUT`，per-key 字段对 P3 不适用）。

### 5.1 `P3` 为何不把后端并入（协议约束下的推演 + 规定动作）

**协议事实（读源码实测，非推测）**

1. `agate-read-gate-commands.py:104-110` 只对 `key == "P3"` 收集一次 → **`P3` 只能是单 key、单命令、单 formatter**；`P3_backend` 之类的键不会被收集。
2. `agate_common.run_test_with_formatter()` 用 `AGATE_TDD_TIMEOUT`（默认 **120s**）包住**整条**命令字符串；超时返回 exit 124。
3. `check-tdd-red.py::judge_result()` 对 **exit 124 打印「视为红灯可推进」并 return 0**——即**超时 = P3 通过**（fail-open）。
4. 实测全量耗时：`make test-frontend` **22–25s**、`make test-quick` **31–34s**、两者复合 **107s**（加 `set -o pipefail` 与 `tail` 后）。**107s 距 120s 默认上限只剩 13s**，而 P4 之后用例只增不减、CI 机器更慢 → 复合命令一旦超时，P3 gate 会**静默判通过**。

**因此「方案 A」（`P3: "make test-frontend && make test-quick"`）被否决**：它的失败模式不是「失去 A/B 区分度」这种可承受的降级，而是「**P3 gate 变成必然空转**」——超时路径把红灯吞掉，恰好是 agate 最不能接受的假绿。要让它安全就得给 P3 调高 `AGATE_TDD_TIMEOUT`，但那会让**后端写错导致的挂死**也一起被放过，风险对调而非消除。

**另一个实测坑（方案 A/C 都踩）**：`make test-quick` **从不返回全绿**——既有失败 `test_cli_remote::TestCLIRemoteConfig::test_config_set_remote_api_key`（沙箱 `~/.peekview/` 只读，Errno 30）稳定存在；**观察到偶发第二失败项（未稳定复现，主 Agent 与 eng 各连跑 3 次均为 `1 failed`）**。若后端并入 P3，这条预存失败会让「有红」的判定永远为真 → **P3 的红灯不再由本任务的新用例决定**，判据失去意义。
>
> ⚠️ **该理由只是次要理由，本方案的裁决不依赖它**：首要理由是 `AGATE_TDD_TIMEOUT` + exit 124 fail-open（V11 已证，硬约束——即便 `test-quick` 完全稳定，复合命令 107s 逼近 120s 上限仍会在 P4 用例增长后假绿）。故 P5 的基线判定按 `known-failures.md` 的「失败集不劣于基线」，**不把未稳定复现的计数当基线**。

**规定动作（P3 执行者必须照做，写进 `P3-test-cases.md`）**

`P3` gate 只覆盖前端红/绿；后端预算与排序用例的红灯用**下面这条命令**取证，并把**完整输出**粘进 `P3-test-cases.md` 的「后端红灯证据」节：

```bash
cd backend && .venv/bin/python -m pytest tests/test_html_render.py tests/test_entry_file_order.py -q --tb=line
```

> ⚠️ **不要给这条命令加 `| tail`**（N5）。管道会把 pytest 的非零 exit 变成 `tail` 的 exit **0** —— 实测：文件不存在时裸跑得 `exit 4`（collection error，可归因），而 `pytest … 2>&1 | tail -30` 得 `exit 0`（**假绿**）。判据取的是**命令自身的 exit code 与输出**，不是管道的。若确需截断输出，用 `set -o pipefail` 后再管道，或直接整段粘贴（该命令输出本就短）。

- 判据：**改动前**该命令输出 **≥1 个 assertion failure**（新用例因 `skipped`/`order_by`/`constructedRows` 不存在而红），且**恰好是 assertion failure**（不是 collection error）。
- **文件名统一为 `test_entry_file_order.py`**（N5）：本任务新增的排序测试文件**只有这一个名字**，全设计不再出现 `test_entry_order.py`。它是**新建**文件，故改动前该命令的红灯来自**两边**：`test_entry_file_order.py` 整个文件不存在（`exit 4 / collection error`）+ `test_html_render.py` 的预算用例 assert 失败。**红灯取证因此要分两步**（否则会被 collection error 掩盖成「不是 assertion failure」）：
  1. 先用 `--ignore` 排除未创建的新文件，单独取得 `test_html_render.py` 的 assertion failure：
     `cd backend && .venv/bin/python -m pytest tests/test_html_render.py -q --tb=line`（期望 ≥1 assert failure、exit 1）；
  2. 再跑完整命令确认文件已建后**全绿**（P4 完成后）。
- 该命令只选**本任务新增/改动的那两个测试文件**，因此**不含**预存失败 `test_cli_remote`（它在 `tests/test_cli_remote.py`，不在选择集内）→ 红灯来源唯一、可归因。实测基线（N7）：`tests/test_html_render.py + tests/test_entry_service.py` = **73 passed / 0 failed / 0 error**（`-v` 覆盖 `addopts=-q` 才拿到汇总行；`+ tests/test_file_service.py` = 78 passed）。**注意：本命令的选择集是 `test_html_render.py + test_entry_file_order.py`，不是上面这个 73 的组合**——73 是「既有两个后端测试文件全绿」的基线读数，供 P5 做「失败集不劣于基线」的参照。
- P5 的 `P5`（`make test-quick` 全量）会连同预存失败一起跑 → 按 `known-failures.md` 的「失败集不劣于基线」判，**不要求全绿**。

**为降低「靠自觉」的成分，做了三件事**：① 判据写进本文（P3 执行者的直接输入）；② 红灯命令**只选两个文件**，输出短、可整段粘贴，漏做时 `P3-test-cases.md` 会明显缺节；③ §7 风险 R13 登记该残余风险，P7 一致性检查把它作为核对项。

---

## 6. env_constraints（确认/细化 P0-brief，不得弱化）

```yaml
env_constraints:
  debug_env: "debug backend http://127.0.0.1:8888（make debug-quick，或 make debug-start + make debug-seed）；数据目录 /tmp/peekview-debug/，DB /tmp/peekview-debug/peekview.db；anon 基线 total=15、alice 登录后 22"
  prod_isolation: "严禁接触生产 :8080；严禁触碰 ~/.peekview/；严禁 pip3 install --break-system-packages；状态标记二值 [PROD_TOUCHED]/[PROD_NOT_TOUCHED]"
  isolation_check: "make debug-verify-isolation（依赖 :8080 在线；不在线时改用 sqlite3 /tmp/peekview-debug/peekview.db \"SELECT COUNT(*) FROM entries\" 手工核对）；E2E 一律经 make debug-test（内含 4 道安全检查：E2E_GUARD_ENABLED / 非 8080 / 服务在线 / DB 路径含 /tmp/peekview-debug）"
  entry_fixture: "测试 entry 只经 debug HTTP API 创建（禁 CLI `peekview create`）；造件须同时给 path 与 filename（只给 path → filename=untitled、language=null → 前端退化 CodeViewer）；DELETE 用 slug 不用 id；用完立即删除，复查 anon total 回到 15"
  backend_test_env: "backend/.venv/bin/python -m pytest（conftest autouse 隔离：PEEKVIEW_STORAGE__DATA_DIR/DB_PATH → tmp_path）；新增预算用例可直接 create_app(config=PeekConfig(limits=PeekLimits(max_entry_files=N+1)))"
  tmp_artifacts: "临时脚本与截图落 <项目根>/.agate-tmp/（不用 /tmp——per-call tmpfs 跨调用不可见）"
  playwright: "npx tsx 不可用（~/.npm 只读 EROFS）→ /home/kity/oclab/deepseek-harness/node_modules/.bin/tsx + NODE_PATH=$(npm root -g)；CDP Chrome localhost:18800 在线（connectOverCDP，勿 browser.close()）；evaluate 传字符串避免 esbuild __name 注入"
  sandbox: "~/.peekview/ 只读（Errno 30）→ 既有失败 test_cli_remote::test_config_set_remote_api_key 属预存失败，登记 known-failures 不阻断"
  e2e_baseline: "viewer.spec.ts 18F/20P、t091 12F/12P、tpv0099 6P/0F（根因 markdown-test 属 frontend-team → 匿名 404，TPV0095 遗留）；BDD-50 判「失败集不劣于基线」，缺 known-failures.md 判 FAIL"
  no_commit: "P2–P6 全程不 commit；P8 由主 Agent 统一 bump-version + commit"
```

---

## 7. minimal_validation（本阶段实测，19 项 + §7.1 的 4 项 gate 机制实测）

> **编号约定**：本节 `V1–V19` 是**验证项**编号；UI 设计节「视觉组 V」的**候选项**用 `W1/W2/W3` 命名，不与验证项混号。**第 2 轮**：V9 重做（B3），新增 V14/V15/V16（M1 / M7 / D-2）。**第 3 轮**：新增 **V17**（B4 的不变式与钩子充分性）、**V18**（R2-1 的 active 态四组对照）、**V19**（R2-2 的 typecheck 闭合与移动端连带）。

本任务**依赖浏览器行为 + 后端真实 HTTP 行为**，故不做「纯代码逻辑」声明。全部验证在 debug `:8888` 与 pytest 临时 app 上完成，探针 entry 全部删除（anon total 复查 15），探针源码文件全部删除（`git status` 已核对工作树只含预期产出）。

| # | 假设 | 方法 | 结果 | 结论 |
|---|---|---|---|---|
| **V1** | 「逐参数清理 query」必须显式合并，`replace({query:{...}})` 会覆写而丢 `share`；删除参数应用「键不出现」而非 `null` | `vue-router` 内存 history 实跑（`router-query.mjs`） | `replace({query:{file:'99'}})` → `?file=99`（**share 丢失**）；`{...route.query, file:'99'}` → `?share=TOK&file=99`；`delete q.file` → `?share=TOK`；`file: null` → `?file`（空值键仍在 search） | **confirmed** → D4 采用「显式合并 + 删键」两规则；BDD-20 的 `不含 file=` 断言要求删键而非置 null |
| **V2** | 计数与构造可在**同一状态机**内解耦（BDD-35 × 36 联合约束），且不 `break` 才能保住未闭合引号校验（BDD-37） | TS 实跑双实现对照（`csv-proto2.ts`），含 4 类边界 | `1000/maxRows=5` → `{rows:5,totalRows:1001,truncated:true,constructedRows:5}`；`3/5` → `{rows:3,totalRows:4,constructedRows:3}`；`1000+'"unclosed'` → 抛「CSV 解析失败：存在未闭合的引号」；空输入/仅表头/引号内换行/尾部换行 全部正确 | **confirmed** → D1/D2 方案落地无冲突；朴素「break」实现会把 `totalRows` 砍到 6（P1 预警成立） |
| **V3** | 现状观测面不存在（BDD-35 改动前 FAIL），`rows.length` 无区分力 | 同上（读现状实现返回值） | `constructedRows` 等字段全 `undefined`；`rows.length` 现状 = 5 = 修后 5（不可区分） | **confirmed** → 观测面必须新增字段 |
| **V4** | markdown-it token 流可一次产出「正文 id + TOC 文本」，且能同时满足 BDD-01/02/03/04/05 | Node 实跑 `md.parse` + renderer（`md-headings.mts`），探针含 3 重名 + 围栏 + Setext + 内联强调 + h1/h2/h3/h4/h5 | 重名 → `设计方案` / `设计方案-1`；围栏内「示例」**未入** TOC；Setext h1 → `level=1, id='setext-标题'`；内联标题 `text='粗体与链接'`（**纯文本，标记已剥离**），id `粗体与链接`；h5 被排除；渲染后 8 个 heading 的 id **两两不同** | **confirmed** → D1 的「纯文本 + 去重 + h1–h4」一次遍历可全满足 |
| **V5** | `/f` 下侧栏现状是「DOM 存在 + CSS 隐藏」（故 BDD-28 必须断 DOM 计数） | Playwright CDP 实测 4 态（桌面/移动 × 普通/全屏） | 桌面 `/f`：`.file-sidebar` DOM **1**、`.toc-sidebar` DOM **1**、`.detail-header` DOM 1 可视 0、`.meta-tags-bar` DOM 0、`.content-area` 宽 1280 == innerWidth；桌面普通态：`.toc-sidebar` DOM 1、`aria-expanded="true"`、TOC 3 项；移动普通态：`aria-expanded=null`、`.toc-sidebar` DOM 0、底栏高 **64**、`.meta-tags-bar` DOM 1 | **confirmed** → BDD-28/53③ 现状 FAIL；zen 侧栏必须改 `v-if`（D5） |
| **V6** | `?file=` 现状完全不被读取；`firstFileId` 是一次性种子且会清空**全部** query | Playwright 实测 3 个 URL | `?file=14` → 仍展示 `README.md`（参数被忽略、URL **保留**）；`?firstFileId=15` → 选中 `service.yaml` 且 `search` 变为空串；`?share=bogus&file=14` → `search` 变空（**share 被一锅端删掉**） | **confirmed** → BDD-14~22/51 现状全 FAIL；D4 的「只删 firstFileId、保留 share/file」是必需修正（R11） |
| **V7** | 注入数量上限静默截断可被真实 HTTP 触发；二进制大 sibling 被静默丢弃；现状无任何跳过清单 | pytest 临时 app（`create_app(config=PeekLimits(max_entry_files=N+1))`）+ debug HTTP | `N=51/max_files=52` → requested 51、**inlined 50、silently_skipped 1、无任何记录**；`N=49/max_files=50`（现状默认上限）→ 全内联（证明 50 上限在真实配置下**休眠**）；二进制 `768KB+1024B` 的 png → **未内联且无记录**，同 entry 小 svg 正常内联；响应头无跳过字段 | **confirmed** → BDD-38/39/40 现状 FAIL；`_MAX_INJECT_IDS < max_entry_files-1` 现状 `50 < 49` = **False**（BDD-38 ④ FAIL） |
| **V8** | 真实注入体积可测，用于冻结总量预算数值 | debug HTTP 现造真实形态 demo（6 sibling：bootstrap 200KB + vue 600KB + d3 280KB + app.css 50KB + chart.js 120KB + logo.svg 8KB） | 主 HTML 303B、sibling 源 1,288,236B、注入后响应 1,280,361B → **放大率 0.994**（注入不放大体积）；CSP 头长度 367（与代码常量逐字符一致） | **confirmed** → 总量预算取 8MiB（≈6× 实测真实形态）；D6 数值有实测锚点 |
| **V9** | 跳过清单可选 `type="application/json"` 内嵌块，在 `RENDER_CSP` 下不执行、不破坏渲染、不改 CSP，**且承载形态在用户可控的 `path` 下安全可解析** | ① 现造 entry（含中文文件名的清单）+ Playwright 打开 render 路由；② **重做（eng B3）**：序列化层实测（`.agate-tmp/probe-escape.py`，BS4 4.15 + `json.loads` 双路），素材含 `</script>` / `<` / `>`：`path = "evil</script><img src=x onerror=alert(1)>.css"`，对比未转义 vs `.replace("<","\\u003c")` | ① 块存在、`type=application/json`、`JSON.parse` 成功、正文正常、内联 `<style>` 生效、**console errors = `[]`**、CSP 头 367 字符未变；② **未转义**：JSON 文本内含字面 `</script`（距 JSON 起点 178 字符）→ BS4 `.string` 只取到 **178 字符半截**、`json.loads` 抛 `Unterminated string starting at ... char 173`、**`stray <img> parsed: True`**（注入成真）；**转义后**：无字面 `</script`、`stray img False`、`json.loads` 成功、`path` **roundtrip 完全一致** | **confirmed**（承载形态可行**且**安全），**前提是序列化必须转义 `<`** → D7 / R15；eng 指出的「V9 选材不足」已补齐（原探针只用中文文件名，证明的是「普通文件名可行」） |
| **V14** | 移动端底栏在**最小支持宽度 360px** 下插 44px 按钮不溢出，且「缩短间距」是可解 | Playwright CDP 实测 4 entry × 360/375（最坏情况 `nBtns=7` 含 wrap 按钮），DOM 注入 44px `icon-btn` 后量 `scrollWidth / clientWidth / spacer` 余量；再逐档调 `gap` | baseline 全部 `overflow=0`；插 44px @360 → **`scrollW 370 / clientW 360`（溢出 10px）**（`k8s-deployment` / `unicode-filenames` / `multi-format-demo` 三例；`json-api-config` 6 子元素不溢出）；@375 `spacer 44.39 → 0`（恰好用尽）；@390 `59.39 → 7.39`。**`gap: 8px → 4px` 后 @360 `overflow 0`（spacer 5.39px）**；按钮缩到 40px/38px 仍溢出 6px/4px（且违反 §9 ≥44px 触控）。另实测确认**生效的 `gap` 是组件 scoped 的 `--space-2`(8px)**（`layout.css:538` 的 `gap: 4px` 被覆盖）→ 落点见 R7 | **confirmed** → 定 **360px 为最小支持宽度** + scoped `gap` 8px → 4px（R7 / UI 设计）；三档断言绑进 `P5_e2e` |
| **V15** | 桌面插 32px 按钮**不溢出**、标题仅固定让出 36px 且不截断（design §2.6 自我更正的独立复核） | Playwright CDP 1024/1280/1440 三档，插 32px `.icon-btn` 到 `.actions-area` 前后量 `.actions-area` / `.title-group` / `document.body` | 三档插前后均 `clientW == scrollW`（`423 → 459`）、`bodyScrollW == bodyClientW`（1024/1280/1440）；`title-group` `scrollWidth == clientWidth` 且 `truncated: false`（1024 `377→341`、1280 `633→597`、1440 `793→757`） | **confirmed** → design 的更正成立（**原「溢出 40px」读数不成立，不得回退**）；M7 的标题截断校验点有可用判据 |
| **V16** | `.toc-level-1 { padding-left: 0 }` 是 no-op（h1 与 h2 视觉不可区分），且 4 个候选各自产生**可测**差异 | Playwright CDP 桌面 1280×800（`k8s-deployment`），DOM 注入 `#probe-lvl-1/3/4` 的 `li` 后逐项量 `paddingLeft / marginLeft / marginTop / fontWeight / color / x / aWidth / 高度`；再逐候选注入 `<style>` 重测 | **baseline**：`.toc-level-1` 与 `.toc-level-2` **逐项相同**（`liPadL 0 / liMarT 4px / aWeight 400 / aColor rgb(154,167,180) / ax 1057 / aW 207 / liH 29`）→ no-op 成立。**候选 W1**（加粗主色）：`aWeight 599.5`、`aColor rgb(233,238,244)`、**ax 不变 1057**；**候选 W2**（上间距+顶分隔）：`liMarT 4→12px`、加 border 后 `liH 29→38`；**候选 W3**（缩进重排）：用 `.toc-list .toc-item.toc-level-N`（0,2,0）时 `ax` = 1057/1065/1073/1089（h1−h2 = 8px），而**低特异性 `.toc-level-N`(0,1,0) 写法实测零变化**（规则静默失效）。选定 W1+W2 后对比度 **15.26:1** | **confirmed** → D-2 的 no-op 判断成立；W1+W2 是「有可测差异且不改既有缩进」的解法；P4 判据用 `fontWeight` / `marginTop`（x 在选定方案里本就不变） |
| **V17** | B4 的「未内联项必须可查」在**所有真实形态**下可满足，且 `inlined` 取「实际进入响应体」时不变式成立 | `.agate-tmp/probe-b4.py / probe-b4b.py / probe-b4c.py / probe-b4d.py / probe-b4e.py`：① 直测 `_detect_kind` 8 个扩展名；② 用 `inject_resources` 原实现跑 V8 形态与零引用形态；③ **原型实现完整消费追踪**（`consumed: set[id]` + `owners` map + `_process_css_refs` 透传 `owners`/`consumed_out`，含递归）后跑 7 个形态 | **① kind 判定**：`README.md`(markdown) / `data.json` / `a.csv` / `a.yaml` / `notes.txt` / `logo.svg` → **全 `None`**；`app.css` → `css`、`app.js` → `js`。**② 现状静默丢弃**：V8 形态 `requested 5 / inlined 3`（README.md + data.json 零记录）；零引用形态 `6 / 2`（a.svg/a.png/a.md/a.json 全静默丢）。**③ 原型七形态**：S1 `5/3/2`、S2 `6/2/4`、S3（`@import`+CSS`url(svg)`+favicon）`4/4/0`、S4（未引用小二进制 + 被引用 json）`2/1/1`、S5（全不可注入）`2/0/2`、S6（空 siblings，不崩）、S7（嵌套 path 按 basename 引用）`1/1/0` → **全部满足 `requested - inlined == len(skipped)`，且 `reason` ⊆ 六元闭集**。**④ 反例（决定性）**：eng 建议的最小钩子（只用 `used_text_keys` + `_sibling_keys`）在「未引用二进制 + README.md」形态下 → `inlined` 报 **1** 而实际嵌入 **0**（漏 `unref.png`）→ `2 - 0 = 2 ≠ len(skipped)=1`，**不变式在假值上"成立"**；在 S3 形态下把已被 `url()` 内联的 `bg.svg` 误报为 `not_injectable` | **confirmed** → 采纳「按 `id(SiblingFileData)` 记 consumed + 七处埋点 + `_process_css_refs` 透传」；**不采纳** eng 的最小钩子（会给假绿报表） |
| **V18** | R2-1：h1 新规则是否吃掉 `.active` 强调色；`design` 处方的 `:not(.active)` 整条是否够 | `.agate-tmp/r21matrix.ts`（隔离页 + `setContent`，**逐字复刻 Vue scoped 编译形态** `.toc-item.toc-level-1 a[data-v-a]`，四组对照：baseline / A 原设计 / B `:not(.active)` 整条 / C 颜色与字重拆两条；每组分 inactive 与 active 两次测量） | **baseline**：h1 inactive `rgb(154,167,180)/fw 400/mt 4px`、active `rgb(77,141,255)/fw 400`。**A（原设计，无 `:not`）**：inactive `rgb(233,238,244)/fw 600`、**active 也 `rgb(233,238,244)`** → **强调色被吃掉（R2-1 复现成立）**，且 fw/mt 三项与 inactive 完全相同（**正向判据对此缺陷全真 = 漏检**）。**B（`:not(.active)` 整条）**：active `rgb(77,141,255)` **但 `fw 400`**（accent 回来、加粗丢失）。**C（拆分：`a{fw:600}` + `:not(.active) a{color}`）**：inactive `rgb(233,238,244)/fw 600/mt 12px`、**active `rgb(77,141,255)/fw 600`** → 两个信号都在 | **confirmed** → R2-1 成立；处方**细化为 C**（design 的「一条 `:not(.active)`」会连带丢字重，见 R16）；反向断言必须同时断 `color == --accent-color` **与** `fontWeight !== '400'` |
| **V19** | R2-2 的补丁是否真能类型闭合；移动端是否同样缺 | 实弹改三个文件（Header `defineProps`+`defineEmits`+`MaximizeIcon` 按钮 / View `:active-file`+`@fullscreen`+`handleFullscreen()` / MobileBar `defineProps`+`defineEmits`+按钮），跑 `npx vue-tsc --noEmit` + 三个 header 相关既有 spec；**跑完即 `git checkout` 还原，生产代码零残留** | **① 补齐后 `vue-tsc --noEmit` exit 0**；`T079-entry-detail-header`(19) + `tpv0095-detail-visibility-tag` + `t082-error-format` = **32 passed**。**② 坑**：Header 内不 import `File` 时 TS 解析成 **DOM `File`** → `TS2322`（`EntryDetailView.vue(20,8)`：`{id,path,filename,...}` 缺 `lastModified`/`name`/`webkitRelativePath`/`type` 等 5 项）→ **必须 `import type { Entry, File, ... } from '@/types'`**。**③ 基线确认**：改动前 header 的 9 个按钮无全屏项、`[data-testid=detail-fullscreen-btn]`=**0**；移动底栏 7 子元素（`toggle-btn×3 + star-toggle + flex-spacer + icon-btn + overflow-menu`）、`gap` 实测 **8px**（证实 R7 的「生效的是 scoped `--space-2`」）、`mobile-bar-fullscreen-btn`=**0** | **confirmed** → R2-2 的处方可落地且类型闭合；移动端同样缺、需一并补 |

**未在本阶段验证、留给 P3/P4 的项目（不作为方案假设，仅记录）**

1. ~~移动端 390×844 新增底栏按钮后的实测不溢出~~ → **本轮已实测（V14，4 entry × 360/375 最坏形态）**：390 有余量、375 恰好用尽、**360 在 `gap: 8px` 下溢出 10px → 改 `gap: 4px` 后 0**（R7 / UI 设计「移动端最小支持宽度」）。仍留给 P3 的只是把该式写进 E2E 断言。
2. `watch(tocHeadings)` 下桌面默认展开的**时序稳定性**（R5；P1 幂等 When 已消除假 FAIL 风险）。
3. BDD-42 的**中文 ≥2MB** 素材（P1 §3.8 已实测造件成功：`chars=700084 / bytes=2100088`），P3 造件脚本沿用该数值。
4. ~~后端 `order_by` 后 `test_render_inject_js` 的实际红/绿~~ → **eng B1 已实测证伪该风险**（`_create_entry` 读 POST 响应、不经 `select(File)`）→ **零连带失败**，该动作已取消（R1）。留 P3 的动作改为「在 `test_entry_file_order.py` 断言 POST 序 ≠ GET 序」。
5. BDD-17 跨 entry 成对对照的**造件要点（eng G6）**：两个 entry；取 **A 的非默认文件 id**；准备 **B 的一个独有串 Z**（如 `BDD17-MARKER-B`）。**同一测试内先验无效前置**——先用 A 的非默认 id 断言「确实切换到了该文件、页面含其独有串」（前置校验不成立即整条 FAIL，不许跳过），再用「A 的 URL + B 的 file id」断言回退默认入口且**正文不含 Z**。
6. BDD-32 截断态表头换 `span.th-label` 后的布局实测 → **design probe7 已给正面结论**（不塌陷、thead −28px、tbody 首行同步 −28px、居中偏差 −0.25px），P3 只需写断言，不需重新判定可行性。

### 7.1 `P3` gate 机制的补充实测（V10–V13，为 §5.1 的裁决提供证据）

| # | 假设 | 方法 | 结果 | 结论 |
|---|---|---|---|---|
| **V10** | `P3` 只能是单 key 单命令 | 读 `agate-read-gate-commands.py` 实码 | `:104-110` 仅 `key == "P3"` 收集一次；`P3_backend` 不进入 `commands[]` | **confirmed** → 无法用多 key 表达双端 |
| **V11** | 复合命令会因 `AGATE_TDD_TIMEOUT`(120s) 触发超时 → 被判通过 | 实测耗时 + 读 `run_test_with_formatter`/`judge_result` | 全量 frontend **22–25s**、backend **31–34s**、复合 **107s**；`judge_result` 对 exit 124 打印「视为红灯可推进」并 **return 0** | **confirmed** → 方案 A 会让 P3 gate **静默空转**，故否决 |
| **V12** | `make test-quick` 的预存失败会让「有红」恒真，故不能并入 P3 | `make test-quick` 连跑 3 次 | `2 failed, 1204 passed` / `1 failed, 1205 passed` / `1 failed, 1205 passed`；失败项恒为 `test_cli_remote::test_config_set_remote_api_key`（`~/.peekview/` 只读 Errno 30），**观察到偶发第二失败项（未稳定复现——主 Agent 连跑 3 次均为 `1 failed`，eng 亦未复现）** | **confirmed（结论不依赖不稳定项）** → 后端不整体并入 P3 的**首要**理由是 exit 124 fail-open（V11 已证，硬约束）；「有红恒真」只是次要理由。故**不把未复现的计数当基线**，P5 按 `known-failures.md` 的「失败集不劣于基线」判。须**只选本任务新增/改动的两个测试文件**（实测 **73 passed / 0 failed / 0 error** 干净基线） |
| **V13** | 前端真实 B 类红灯（新模块未实现）会被 `vitest.sh` + `judge_result` 判成 A 类错误（gate FAIL）——P3 执行者必须知道 | 造 `@/utils/default-file-does-not-exist` 的 import 探针实跑 | vitest 报 `Failed to resolve import` → `Failed Suites 1`；`vitest.sh` 输出 `errors:1`（`import_errors:[]`）→ `judge_result` 判 **A 类错误 → exit 1（gate 失败）**；而经典断言红灯（`constructedRows` 不存在）→ `failed:1` → 判「classic red-light」→ **exit 0（通过）** | **confirmed** → P3 写红灯**必须用断言形态**（引用已存在模块 + 断言新行为），**不可**用「import 尚不存在的模块」；探针文件已删除 |

> V13 的实际影响：`project_module: "src/"` 在 vitest 路径下不改变结论（实测两种取值都判 A 类），因为 `vitest.sh` 不填 `import_errors`、只把模块解析失败计入 `errors`。这是**本项目的既有特性**，不属本任务改动范围；P3 只需按 V13 的结论选择红灯写法即可。

> **第 3 轮新增的 V17–V19 全部落在 §7 主表**（不在本节）：V17 是 B4 的机制验证（消费追踪充分性 + 不变式），V18 是 R2-1 的 active 态四组对照，V19 是 R2-2 的 typecheck 闭合 + 移动端连带。三项都是**在隔离页 / 原型实现 / 探针补丁上**完成的，未改生产代码（V19 的探针改动已 `git checkout` 还原）。

---

## 8. 批次设计（dispatch_plan 正文说明）

`mode: static-batch`，`parallel_limit: 4`，4 批。**同一文件不跨批改两轮**（`output` 列表逐批互斥，已交叉核对）。

| 批 id | complexity | 交付能力（判据二 Vertical Slice） | 文件面 | tests_filter（批级绿灯） | 顺序依赖 |
|---|---|---|---|---|---|
| `backend-render-budget` | high | 「HTML 注入的资源边界可被观测」——数量/单文件/总量三级预算 + 可机器解析跳过清单 + 文件顺序确定性 + 安全边界文档 | `html_render_service.py`、`api/files.py`、`entry_service.py`、`backend/tests/test_html_render.py`、**新建** `backend/tests/test_entry_file_order.py`、`docs/architecture/html-preview-security-modes.md` | `pytest tests/test_html_render.py tests/test_entry_service.py tests/test_entry_file_order.py -q` | 无（可并行） |
| `detail-outline` | medium | 「TOC 与正文锚点单一来源」——h1–h4 覆盖、正文去重、纯文本、围栏排除 | `useMarkdown.ts`、`useEntryDetailComputed.ts`、`MarkdownViewer.vue`、`TocNav.vue` | `vitest run src/composables/__tests__ src/components/__tests__/MarkdownViewer.spec.ts src/components/__tests__/TocNav.spec.ts` | 无（可并行） |
| `detail-navigation` | high | 「打开即默认入口 + 深链 `?file=` + 全屏阅读入口 + 全屏纯内容」 | `utils/default-file.ts`、`stores/entryDetail.ts`、`EntryDetailView.vue`、`EntryDetailContent.vue`、`EntryDetailHeader.vue`、`EntryDetailMobileBar.vue`、`EntryCard.vue`、`EntryListRow.vue` | `vitest run src/utils src/components/__tests__/t031-*.spec.ts src/components/__tests__/t067-*.spec.ts` | **依赖 `detail-outline`**：`EntryDetailView` 要调 `setTocHeadings()`（由 outline 批在 `useEntryDetailComputed.ts` 提供）。两批**串行**（outline 先） |
| `data-viewers` | medium | 「大产物的判定与截断态控件正确」——CSV 构造上界 + 表头控件降级 + 真实字节判断 | `utils/file-bytes.ts`、`types/structured-data.ts`、`useCsvParser.ts`、`TableView.vue`、`TreeView.vue`、`HtmlViewer.vue` | `vitest run src/composables/__tests__/useCsvParser.spec.ts src/components/__tests__/{TableView,HtmlViewer,TreeView}.spec.ts` | 无（可并行） |

**切批理由与判据对照**

- **判据一（Tracer Bullet）**：本任务不存在「单条端到端路径可先打通」的形态——8 项缺陷分属 5 个互不调用的渲染分支（TOC / 文件导航 / 表格 / 树 / HTML iframe），没有一条路径能同时触达 ≥2 项。故首个批按「后端侧最大未知量」切（`backend-render-budget`，含预算数值与清单形态——P2 已实测但实现风险最高），以 `tests_filter` 取得「管道确实通」的反馈；**不套用 tracer bullet**（记明理由，避免形式化套用）。
- **判据二（Vertical Slice）**：4 个批 id 都是「交付了什么能力」而非「动了哪层代码」；唯一按技术层切的边界是 `detail-outline` 与 `detail-navigation` 的拆分（前者是「锚点数据源」、后者是「导航状态」），**单独说明理由**：两者共享 `useEntryDetailComputed.ts` 的 `tocHeadings` 接口，若合并为一批则单批输出 12 个文件、超「单批产出 ≤3」的粒度基准太多且不可并行；拆开后通过**显式接口契约**（`tocHeadings: Ref<TocHeading[]>` + `setTocHeadings(list)`）解耦，串行执行消除类型缺口窗口。
- **判据三（Architecture Fitness）**：见 §5 的 `P5_typecheck` / `P5_lint` / `P5_docs` + P3 的三条源码扫描断言。
- **e2e 归属**：新建 `tpv0104-viewer-hardening.spec.ts`、`tpv0104-mobile-bar-widths.spec.ts` 与三个 spec 的 `firstFileId → file` 迁移（共 9 处）属**测试产物**，归 **P3**（test-designer 写红），不占 P4 批次；P5 按 `gate_commands.P5_e2e*` 执行。
- **跨批共享件**：`useEntryDetailComputed.ts`（outline 批独占，navigation 批只消费接口）、`types/structured-data.ts`（data-viewers 批独占）、`utils/default-file.ts`（navigation 批独占）——无一件跨批被改两轮。
- **资源密集型批**：`P5_e2e*` 与 `P5`（后端 `-n auto`）默认**串行**执行（E2E 走同一 debug backend 与同一 Chrome CDP，并行会互相污染 DOM/数据）；批次实现本身可并行（纯文件写入）。

---

## 9. [SCOPE+] 登记

**机械结论：无 [SCOPE+] 标记**（本阶段未发现必须增补 P1 基线的新需求，54 条 BDD 语义未改）。

> 说明四处**看似**需要 SCOPE+ 但判定为「P1 已覆盖 / 不属新需求 / 属实现细节」的项，并**显式登记一处语义落差供主 Agent 决策**：
> 1. **BDD-11 的 `path=sub` 形态与 API 语义不符**（实测 `path` 是含文件名的完整相对路径 → 落盘为根级文件 `sub`）。这不改变 Then 语义（`sub` 不是 readme → 回退 `aaa.md`），且真嵌套形态（`path='sub/README.md'`）同时被 resolver 的根判定排除 → **判据无需增补**，仅需在实现里对两种形态都成立（已写入 R10，并由 D3 的 resolver 直接单测覆盖）。
> 2. **P0 决策 4 的第 4 级「最终 HTML 上限」不做阻断**。P1 未把它写成 BDD，且加阻断会引入 P1 未声明的用户可见限制 → 降级为观测字段（0.2 / R3 记录）。这属**收缩**而非扩张，不触发 SCOPE+。
> 3. **移动端最小支持宽度 360px（M1）**：P1 BDD-24 的 Given 只钉 390×844，**360 是 P1 未声明的守护面**。它**不是新需求**——「新增入口不得破坏既有无溢出的底栏」属 BDD-24 ②「不因新增入口增高」的近邻语义、且 `DESIGN.md §9` 的 Mobile 档（`<=640px`）本就隐含覆盖 360。故以**设计的守护性断言**（`P5_e2e_mobile_widths`）承担，不新增 BDD、不改 P1 基线。
> 4. **超限反馈的「机读 vs 可见」语义落差（显式登记，交主 Agent 判断）**：P0 决策 4 的字面要求是「超限时**反馈而非静默**」，方案以**机读 JSON 清单**满足（`requested - inlined == len(skipped)`、每项带 `reason`），但**不给终端用户可见横幅** → 「反馈对象是工具与 Agent，不是终端用户的视觉」。**为什么不自行按 SCOPE+ 扩张**：P1 的 54 条 BDD 中无一条要求可见提示（BDD-40 的判据是「可机器解析」）；新增可见 UI 属超出已 approved 的 P1 基线，且会让 P8 的 CHANGELOG 与 P6 的视觉验收同时扩面。**若主 Agent 判定该落差必须闭环**，最小增补路径是：P1 增一条 BDD（「超限时 render 页出现可见提示，文案含被跳过项数」）+ 本方案加一个轻量可见提示（如 `<body>` 顶部一条与前端 `TruncationBanner` 同型的 bar，读同一份 JSON）——**本阶段不擅自实施**，仅登记。

---

## 11. 修订记录（第 2 轮 / 第 3 轮）

> **阅读顺序**：§11.1–§11.7 是**第 2 轮**记录（按 `P2-review.md` §6 清单）；**§11.8 是第 3 轮**（按 `P2-review-eng.md` 的 B4 + N5–N8、`P2-review-design.md` 的 R2-1/R2-2）。第 3 轮**未推翻**第 2 轮的任何已闭环项。

## 10. 变更记录

- 2026-11-24 首版（architect）：基于 `P1-requirements.md`（54 条 BDD）+ `P1-review.md`（approved，2 项残留 WARNING）+ `P0-brief.md`（决策 1–7）。产出 3 个候选方案（A 选定 / B 对比 / C 排除）、9 项最小验证实测、影响面三栏（改 21 文件 / 不改 12 项 / 12 条风险）、注入预算数值实测冻结（40 / 2MiB / 8MiB）、跳过清单承载形态（body 内 JSON 注记，实测 CSP 下不执行）、4 批 dispatch_plan、gate_commands 冻结（含 `P5_e2e` 钉死新建 spec + 3 个 legacy spec 独立 key + typecheck/lint/check-docs 适应度检查）。W-r3-1（BDD-35 措辞）在 D1 以肯定句重述观测面；W-r3-2（BDD-53 ① 的 DOM 归宿）在 V5 用实测值重申（`.detail-header` DOM 1 可视 0 / `.meta-tags-bar` DOM 0 / 移动两项 `v-if="isMobile"` → 桌面 DOM 0），判据不变。

---

### 11.0 第 2 轮修订边界与锁定项复核

> **修订边界**：本轮**不是重写**。两位专家的结论是「方案主体设计经实测成立、方向正确」「架构层质量很高」——候选权衡、原有 13 项最小验证（**本轮重做 V9 + 新增 V14/V15/V16，共 16 项**）、54/54 BDD 落点矩阵、风险表全部保留。改动集中在 **3 处机制判断**（eng B1/B2/B3）+ **UI 布局层**（design D-1/D-2/D-3→M1 + M2–M7）+ 建议项。
> **`P2-review.md §7` 的锁定项逐条复核未推翻**：锚点单点（候选 A）/ `setTocHeadings()` 导出名 / **不 break** / 观测面 `constructedRows` / resolver 单点 + 删死代码 / `resolveFileSize` 单点 + 可选 prop / `/f` 改 `v-if` / 删键而非置 `null` / 预算数值 `40 / 2MiB / 8MiB` / `P3` 只跑前端 / `gate_commands` 全 key 合法（本轮 **21 → 23 key**：新增 `P5_e2e_mobile_widths` + 其 `P5_e2e_mobile_widths_timeout_seconds`；`_gate_commands_block_keys` 实测 23 条，逐条 `is_legal_gate_key` 全 `True`、无 `P3_*` 违规键）/ 4 批 output 互斥 / **桌面 `.actions-area` 不溢出**（更正结论保持）/ **截断态表头不塌陷**（正面结论保持）。

### 11.1 5 项 BLOCKER（B1 / B2 / B3 / D-1 / D-2；B2 拆 B2a+B2b 两行展开）+ M1

> **编号口径**：`P2-review.md §2` 的 BLOCKER 计数是 **5**（eng 的 B1/B2/B3 + design 的 D-1/D-2）。本表因 eng B2 含**两个独立缺陷**（返回结构连带面 + 漏记一条既有静默丢弃路径）而拆成 **B2a / B2b** 两行，故实际 6 行对应 5 个 BLOCKER。
> **M1 为何在本表**：`P2-review.md §3.1` 记录了 design 对 360px 溢出的**严重度标注不一致**（其 §0 主表标 MAJOR，§5「通过前必须补」列入 BLOCKER 第 3 条），汇总按**较严口径**把它计入 `§6.1 必须改`（编号 7）。本轮按该口径处置，但**不重复计入 5 个 BLOCKER 数**。

| # | 来源 | 改了什么 | 落在哪 |
|---|---|---|---|
| **B1** | eng B1 + G3 | **§0.3 R1 整条重写**：从「补 `order_by` 会让 `test_render_inject_js` 变红 → 必须改该用例取 id 方式」改为实测结论「**后端测试零连带失败**」（机制：`_create_entry` 返回 **POST 响应**的 `files`，源是构造序 `file_records`，**不经 `select(File)`**，`order_by` 只作用于 GET 侧）。**删掉「改该用例」这个动作**；BDD-13 风险由**中降为低**；`gate_commands.P5` 全量兜底**保留**。**新增动作**：在 `test_entry_file_order.py` 里**显式断言「POST 序 ≠ GET 序」**（护住契约，G3）。§0.2「22 处 `files[0]` 不动」的理由同步更正为「实测零连带」 | §0.3 R1、§0.2、§0.1A 测试行、D10 的 BDD-13 行 |
| **B2a** | eng B2 问题一 + G5 | **`inject_resources()` 不再改返回结构**：改为 `inject_resources(html, siblings, skipped_out: list[SkippedResource] \| None = None) -> str`（**返回 `str` 不变**，新逻辑经可选**出参**回传）→ **13 处既有测试调用零改动**（`grep -c "= inject_resources(" tests/test_html_render.py` = 13 实测）。13 处行号已写进 `files_to_read` 的 `why`，并说明「该文件进 `tests_filter` 的真因就是护住这 13 处」 | §0.1A 后端表、§4 `files_to_read`、§3 完成标志 #7 |
| **B2b** | eng B2 问题二 + G1（**本轮独立复核进一步更正**） | **`_build_sibling_data` 的静默丢弃纳入 `skipped` 记账**：`>768KB` 二进制 `return None`（docstring 自述 "None if skipped (oversized binary)"）由**调用方**补记 `reason="binary_too_large"`；`reason` 闭集由四元扩为**五元**。**§0.2 那条判断整条更正**（不是拆两行）：**`files.py:272` 就是 `_build_sibling_data` 体内那一行、且在注入路径上**——① P1 §6.5 的「属 serving 路径、不在注入路径上」实测**不成立**（`download_file`/`get_file_content` 内零 `size` 判断；`:272` 的唯一调用方是 `render_html_file:336`）；② eng 原表述「同文件两个不同函数」也**不成立**（是同一行）。故**全仓只有一个消费点，没有可豁免的 serving 侧对应物**。BDD-40 的 pytest 用例**必含 >768KB 二进制 sibling 场景** | §0.1A（新增一行显式写明 `_build_sibling_data`）、§0.2（整条重写）、D7（reason 闭集）、D6（编排顺序）、D10 的 BDD-40 行、§11.7（P1 措辞偏差上报） |
| **B3** | eng B3 + G2 | **清单序列化必须转义 `<`**：`json.dumps(report, ensure_ascii=False).replace("<", "\\u003c")`；`reason` 样例补 `binary_too_large`。**并重做 V9**：原探针只用中文文件名（证明的是「普通文件名可行」而非「承载形态安全」）→ 新探针含 `</script>` / `<` / `>`，对比未转义（`stray img parsed: True`、BS4 取到 178 字符半截、`json.loads` 抛 `Unterminated string`）与转义后（无字面 `</script`、无 stray img、`json.loads` 成功、`path` roundtrip 一致）。新增 **R15** 记录该风险与修法 | §0.1A、D7、§7 V9、§0.3 R15、§1 权衡表（新增「承载形态安全性」维度）、D10 的 BDD-40 行 |
| **D-1** | design D-1 | **UI 设计节新增「布局层候选」节，3 组各 ≥2 候选 + 权衡 + 选定**：**布局组 L**（移动入口位置：底栏左簇+收窄间距 / 移入 OverflowMenu / 底栏右簇 → 选 **L1**）、**视觉组 V**（TOC h1 可区分性：加粗主色 / 上间距+顶分隔 / 缩进体系重排 → 选 **W1+W2**）、**交互组 I**（桌面入口位置：`.actions-area` / OverflowMenu dropdown / 标题行独立区 → 选 **I1**）。每组带**真实浏览器实测数据**与「为什么不选另两个」。`candidate_count: 3 → 6`（3 架构 + 3 布局层选定），§1 引言同步说明两层关系 | `## UI 设计`→「布局层候选」、frontmatter、§1 引言 |
| **D-2** | design D-2 + §6.1-#8 | **重做 TOC h1 视觉层级**：**删除**原「`.toc-level-1 { padding-left: 0 }` 与 `.toc-level-2` 对齐」论证（实测 no-op——`.toc-item` **只有 margin 无 padding**，该属性默认已 0；且 `TocNav.vue:42-44` **根本没有 `.toc-level-1` 规则**）。给 3 候选 + 实测差异 + 选定 **W1+W2**：`.toc-item.toc-level-1 a { font-weight: 600; color: var(--c-text) }` + `.toc-item.toc-level-1 { margin-top: var(--space-3) }`（实测 `aWeight 599.5 / aColor rgb(233,238,244) / liMarT 12px / 对比度 15.26:1`）。**第 8 项（规则存在性）**：新规则用 `.toc-item.toc-level-1` 双类（特异性 0,2,0，可压过 `0,1,0`），P4 判据改为 `fontWeight !== '400'` + `marginTop === '12px'`（**不再用 x 差异**——选定方案 x 本就不变，这正是与「缩进重排」候选的关键区别；实测低特异性写法**完全没有效果**，证明陷阱真实） | §0.1B 的 `TocNav.vue` 行、UI 视觉组 V、UI 视觉 checklist、UI 校验点 ⑦、D10 的 BDD-04 行、§3 完成标志 #10 |
| **M1** | design D-3→M1 + §6.1-#7 | **声明移动端最小支持宽度 = 360px**（`DESIGN.md §9` 只给 `<=640px` 上界、未给下界；360dp 是 Android 主流窄档）。新增独立节「移动端最小支持宽度声明」含三档实测表与「不采用的两条路」。**解法实测确定**：`gap: 8px → 4px` 使 @360 溢出 `10 → 0`；实际生效的是 **`EntryDetailMobileBar.vue` scoped 的 `gap: var(--space-2)`**，`layout.css:538` 的同名 `gap: 4px` 已被覆盖（**只改 scoped、不动 layout.css**）。**三档全绑死到 `gate_commands.P5_e2e_mobile_widths`**（新增 key + 新 spec + per-key timeout），不再只笼统写「`scrollWidth ≤ clientWidth`」 | §0.3 R7、`## UI 设计`（新节 + 布局 checklist + 校验点 ⑤）、§0.1B MobileBar 行、§0.1C、§5 `gate_commands` + 口径说明、D10 的 BDD-24 行、§7 V14、§3 完成标志 #9 |

### 11.2 7 项 MAJOR

| # | 来源 | 改了什么 | 落在哪 |
|---|---|---|---|
| **M2** | design §2.7/§5-4 | 桌面全屏按钮补 **`v-if="currentEntry && activeFile"`**；说明「404 页面 `.actions-area` 仍渲染（DOM 1）而 `activeFile` 为 null → 无守卫点击抛 **TypeError**」、移动端已由整栏 `v-if="isMobile && currentEntry"` 守卫而桌面 `v-if="isDesktop"` 与 entry 状态无关。新增 **R14** | §0.1B Header 行、D5、§0.3 R14、§3 完成标志 #11 |
| **M3** | design §2.5 | 图标尺寸 **16px 的论证改为「跟随既有 `.icon-btn` 兄弟按钮」**（实测 `CopyIcon`/`Share2Icon`/`Star` 均 `:size="16"`），**不再引用 `DESIGN.md §7`**——§7 的 compact 档是 **18px**，本仓既有 16px 与 §7 **本就存在偏差，本任务不修正**（一致性优先）。并补 §6:162 Selection rule 作为「为何用 `.icon-btn` 而非 `.toggle-btn`」的官方口径 | §0.1B Header 行、D5、UI 视觉 checklist、UI 组件一致性项、§4 `DESIGN.md` 的 `why` |
| **M4** | design §4 关注点 | 截断 banner 给**字面文案**：`` `数据量过大，已显示前 ${parsed.constructedRows.toLocaleString()} 行，共 ${parsed.totalRows.toLocaleString()} 行` ``（10 数据行 / maxRows=5 → `已显示前 5 行，共 11 行`，直接满足 BDD-34 的 `5` 与 `11`）；并说明**为何用 `constructedRows` 而非 `maxRows`**（前者是 D1 的同一观测面，避免双源漂移） | §0.1B TableView 行、D10 的 BDD-34 行 |
| **M5** | design §2.7 分项 3 | **过渡**：显式声明**继承**既有 `.icon-btn` 的 `transition: all var(--transition-fast)`（150ms，§8 Fast 档），**不加自定义过渡**。**禁用态**：**不设 `disabled`**，用 `v-if` 让元素「不存在」——理由（全屏入口在无 activeFile 时是「无从全屏」而非「暂不可用」；且 BDD-31 的全页计数口径会被灰按钮复杂化）。**`v-if` 即禁用态** | D5、UI 交互 checklist（禁用态见 D5）、UI 组件一致性项 |
| **M6** | design §2.4 | **移动端无 tooltip 的取舍显式声明**：实测移动底栏 `tooltipCount = 0`（Files/TOC/Source/Copy 全部如此）→ **跟随既有形态**；与 1612「图标 + 文字」的偏差及三条理由（触屏无 hover / 360px 横向预算已用尽 / 一致性优先），可发现性由 `aria-label` + 图标语义承担 | D5 |
| **M7** | design §2.6 | 补「**标题未被截断**」度量校验点：`.title-group` 的 `scrollWidth <= clientWidth` 在 **1024 / 1280 / 1440** 三档各断一次（实测插 32px 按钮后为 `341 / 597 / 757`，`truncated: false`；标题固定让出 36px）。新增 **V15** 独立复核 design 的「不溢出」更正结论 | UI 校验点 ⑥、§7 V15、§0.1C |
| **D-3 延伸（第 8 项）** | design §5-2 | 已并入 **D-2**：`TocNav.vue:42` 只有 `.toc-level-2 { padding-left: 0 }`、**无 `.toc-level-1` 规则**——修正时**不只改数值**，新规则须**真的产生可测差异**（P4 判据 `fontWeight` / `marginTop`，实测低特异性写法零效果作为反证） | 见 D-2 行 |

### 11.3 12 项建议改 + 2 项可选

| # | 来源 | 处置 |
|---|---|---|
| 1 | eng N1 / G4 | **D2 公式补 `headerSeen` 前置**：`totalRows = headerSeen ? parsedDataRows + 1 : 0`，并显式标注「空输入 / 无表头 → 0 是既有 `useCsvParser.spec.ts:51-57` 契约（断言在 `:55`）」。§3 完成标志 #1 把 `:51` 与 `:68` 两条既有契约并列 |
| 2 | eng N2 | **BDD-38 ④ 断言钉死**：`assert _MAX_INJECT_IDS < PeekLimits.model_fields["max_entry_files"].default - 1`（读**声明默认值**，不受 env 漂移；实测 `.default = 50`、`40 < 49 True`），并加一条**前提守卫** `assert declared == 50, "max_entry_files 默认值已变更，须重核 _MAX_INJECT_IDS 取值"`（反向断言，可执行且有失败信息） |
| 3 | eng N3 | **URL 归一抽纯函数** `normalizeFileQuery(route.query, activeFileId, defaultFileId)` 供单测（三例断言：默认→无 `file` 键 / 非默认→`file=<id>` / `share` 恒保留）；**`suppressUrlSync` 本身不测**（未导出、为测试开导出=改生产 API）；真实 URL 与 `history.length` 仍在 E2E。D9 加该纯函数的登记行 |
| 4 | eng N4 | **BDD-32 落点写成明确 v-if/v-else**（含「`.th-label` 已存在于 `.th-sort-btn` 内部 → 给 button 加 `v-if` 会连它一起消失，故是另一分支再写一份」的说明）；`.th-filter` 删除后样式与响应式覆盖无布局塌陷 |
| 5 | eng G6 | **BDD-17 跨 entry 成对对照的造件要点**写进「未在本阶段验证」#5：两个 entry / A 的非默认 id / B 的独有串 Z / **同一测试内先验有效前置再验跨 entry**（前置不成立即整条 FAIL） |
| 6 | eng G7 | **resolver 对 `path='sub'` 的直接单测**写进 D3（并补真嵌套 `path='sub/README.md'` 的非根用例），断言返回值 `id`，不靠 E2E 间接观察 |
| 7 | eng（分歧项） | **降级 V12 的稳定性表述**：「稳定存在 `test_cli_remote` 预存失败 + **观察到偶发第二失败项（未稳定复现，主 Agent 与 eng 各连跑 3 次均为 `1 failed`）**」，并明确「**结论不依赖此项**——首要理由是 exit 124 fail-open」。R13 与 §5.1 的对应段落同步降级 |
| 8 | design M2 | 见 11.2 M2（`v-if="currentEntry && activeFile"`） |
| 9 | design M3 | 见 11.2 M3（16px 论证改为跟随既有代码 + §7 偏差显式声明） |
| 10 | design M4 | 见 11.2 M4（字面文案） |
| 11 | design M5 | 见 11.2 M5（继承 `--transition-fast` + `v-if` 即禁用态） |
| 12 | design M6 + M7 | 见 11.2 M6 / M7 |
| 可选 1 | design N5 | **移动抽屉残开状态**：在 D5 末段**显式声明「不处理 + 三条理由」**（不属 P1 范围 / `/f` 下底栏不可见故无法新开抽屉 / 若 P6 可稳定复现且影响 BDD-53 再回补） |
| 可选 2 | design N6 | **静默回退权衡**：在 D4 末段补「静默为**无感知降级**，不引入新 UI 面」的三条理由 + 明确记录的代价（用户不会知道自己请求的具体文件不存在） |

### 11.4 本轮新增/重做的实测（共 6 项，全部落 `.agate-tmp/`，探针 entry 已 DELETE、anon total 复查 15）

| 项 | 结论 |
|---|---|
| **V9 重做**（B3） | `raw json.dumps` → JSON 内含字面 `</script` → BS4 `.string` 只取 178 字符半截、`json.loads` 抛 `Unterminated string`、**stray `<img>` 解析进 DOM = True**；`.replace("<","\\u003c")` → 无字面 `</script`、stray img **False**、`json.loads` **成功**且 `path` roundtrip **完全一致**。→ 序列化必须转义 `<` |
| **V14**（M1） | 4 entry × 360/375 最坏形态：baseline 全 `overflow=0`；插 44px 按钮 @360 **溢出 10px**（三例复现）、@375 恰好用尽、@390 有余；**`gap 8→4px` 后 @360 溢出 0**（spacer 5.39px）；按钮缩 40px/38px 仍溢出 6/4px。并确认**生效 gap 是 scoped `--space-2`（8px）**，`layout.css:538` 的 4px 被覆盖 |
| **V15**（M7 + §7.3 锁定项复核） | 桌面 1024/1280/1440 插 32px 按钮前后 `.actions-area` 均 `clientW == scrollW`（423→459）、`bodyScrollW == bodyClientW`；`title-group` 三档 `scrollWidth == clientWidth` 且 `truncated:false`（377→341 / 633→597 / 793→757）→ **不溢出（design 的更正成立，不回退）+ 标题不截断判据可用** |
| **TOC 候选实测**（D-2） | baseline：`.toc-level-1` 与 `.toc-level-2` **逐项相同**（liPadL 0 / liMarT 4px / aWeight 400 / aColor rgb(154,167,180) / ax 1057 / aW 207 / liH 29）→ no-op 成立。候选：加粗主色 → `aWeight 599.5`、`aColor rgb(233,238,244)`、**ax 不变**；上间距 → `liMarT 12px`；顶分隔 → `liH 29→38`；缩进重排（须 `.toc-list .toc-item.toc-level-N` 提特异性）→ `ax` 1057/1065/1073/1089，**低特异性写法实测零效果**。选定 W1+W2 的对比度 **15.26:1** |
| **M2 复现** | `/definitely-not-an-entry-xyz`：`.actions-area` **DOM 1**，子元素只剩 `action-sep ×2 + overflow-menu + user-menu-wrapper + theme-toggle`（`canCopy`/`showShareButton`/`currentEntry` 各自 `v-if` 已撤）→ 无 `v-if` 守卫时新按钮会在 404 页渲染且 `activeFile` 为 null |
| **BDD-38④ 断言形态**（N2） | `PeekLimits.model_fields["max_entry_files"].default` = **50**（`int`）、`PeekLimits().max_entry_files` = 50、`40 < 50-1` = **True** → 采纳 `.default` 读法 |

### 11.5 未推翻的锁定项（逐条自查）

| `P2-review.md §7` 锁定项 | 本轮是否触碰 |
|---|---|
| 锚点唯一生成点 = `useMarkdown.heading_open`（候选 A） | 未改（§1 候选 A 保持选定） |
| TOC 走 `emit('headings')` → `setTocHeadings()`，导出名不变 | 未改（D5/TocNav 只改样式） |
| 计数与构造解耦、**不 `break`** | 未改（D2 只补 `headerSeen` 前置，符合 §6.2-1 的要求） |
| 观测面 = `CsvParseResult.constructedRows` | 未改（M4 的文案改为消费它，强化而非削弱） |
| resolver 单点 + 删 EntryCard/EntryListRow 死代码 | 未改（D3 只加直接单测） |
| `resolveFileSize` 单点 + 可选 prop | 未改 |
| `/f` 改 `v-if` 而非只加 CSS | 未改 |
| 逐参数清理用**删键**而非 `null` | 未改（D4 原文保留，只加纯函数抽取） |
| 预算数值 `40 / 2MiB / 8MiB` | **未改数值**（B2b 只把 `>768KB` 二进制的**既有**丢弃纳入记账，不是新增预算层） |
| `P3` 只跑前端 | 未改（V12 表述降级，裁决理由不变） |
| `gate_commands` 全 key 合法 | **21 → 23 key**（新增 `P5_e2e_mobile_widths` + 其 `P5_e2e_mobile_widths_timeout_seconds`）；`_gate_commands_block_keys` 实测 23 条，逐条 `is_legal_gate_key` 全 `True`；无 `P3_*` 违规键 |
| 4 批 `output` 互斥 | 未改 |
| 桌面 `.actions-area` **不溢出**（更正结论） | **保持**（V15 独立复核再次确认；未回退为「溢出」） |
| 截断态表头换 `span.th-label` 后**不塌陷** | **保持**（R12 保留 design probe7 的正面结论：thead −28px、tbody 首行同步 −28px、居中偏差 −0.25px） |
| 对比度全过 AA（亮 5.25/5.19/5.25、暗 7.26/5.57） | 未改既有 token；**新增**的 TOC h1 用 `--c-text`，实测 **15.26:1** 亦过 AA |

### 11.6 P1 基线未动

**54 条 BDD 的 Given/When/Then 一字未改。** 本轮所有改动都在 `P2-design.md` 的实现方案层。两处需要主 Agent 知晓的边界：

1. **M1 的 360px**：BDD-24 的 Given 钉 390，**360 不在其中** → 以设计的守护性断言（`P5_e2e_mobile_widths`）承担，**不新增 BDD**。
2. **超限反馈的「机读 vs 可见」落差**：P0 决策 4 要求「反馈而非静默」，方案以机读 JSON 满足、**不给终端用户可见横幅**。已在 §9 第 4 条**显式登记**并给出最小增补路径，**本阶段不擅自扩充 P1 基线**（是否闭环由主 Agent 决策）。

### 11.7 ⚠️ 需主 Agent 知晓：一处 **P1 基线措辞失实**（本轮独立复核发现，非评审提出）

> **性质**：不是 P1 的 BDD 判据错误（54 条 BDD 语义全部成立、本方案未改一字），而是 **P1 §6.5 的一句实现层附注失实**，且该失实**被上一版 P2 与 eng 评审共同继承**。本轮按实测更正了 P2 的处置，但**不改 P1 正文**（约束 1：不得改 P1 基线），故在此显式上报。

| 项 | 内容 |
|---|---|
| **失实原句** | `P1-requirements.md:589`：「`:272` 的 `file_record.size > _BINARY_SIZE_LIMIT` 在**二进制内容 serving** 路径（`is_binary` 前置），**不在注入路径上**」 |
| **实测反驳** | ① `grep -n "_BINARY_SIZE_LIMIT" backend/peekview/api/files.py` → 仅 **2 行**：`:48`（定义）、`:272`（消费）。<br>② `:272` 位于 `def _build_sibling_data`（`:270`）函数体内，`:271` 是该函数的 docstring（自述 "None if skipped (oversized binary)"）。<br>③ `_build_sibling_data` 的**唯一调用方**是 `render_html_file`（`:336`，在 `if inject_ids:` 块内）→ **注入路径**。<br>④ `download_file`（`:185-225`）与 `get_file_content`（`:226-268`）内**没有任何** `size` / `_BINARY_SIZE_LIMIT` 判断（`grep -c "size"` 均为 **0**）→ 全仓**不存在**「按大小挡二进制的 serving 逻辑」。 |
| **连带影响** | 上一版 P2 与 eng B2 都基于该句进一步推断「`files.py:272` 与 `_build_sibling_data:272` 是**同文件两个不同函数**、前者属 serving 路径可豁免」→ **该推断也不成立**：二者是**同一行**。正确结论是「`_BINARY_SIZE_LIMIT` 全仓**只有一个消费点**，就在注入路径上，**无可豁免的对应物**」。 |
| **本轮处置** | ① P2 §0.2 该条**整条重写**为「必须改」（不再拆成「serving 不动 + 注入要改」两行）；② §0.1A 保留 `_build_sibling_data` 的记账落点（结论不变——它本来就要改，只是**理由**从「漏了另一条路径」变成「它就是唯一那条路径」）；③ BDD-40 的 >768KB 用例要求不变。 |
| **对 P1 的建议** | P1 §6.5 第 589 行那句附注宜更正为「`:272` 在 `_build_sibling_data` 内，属**注入路径**；全仓无按大小挡二进制的 serving 逻辑」。**是否改 P1 由主 Agent 决定**（属 P1 活基线的措辞勘误，不影响任何 BDD 判据，故不触发 `[BASELINE_CHANGE]` 的必要性——但按约束 1 本角色不动 P1）。 |
| **对评审的影响** | 该更正**不削弱** eng B2 的结论（eng 对「必须纳入记账」的判断是对的，只是对「serving 侧还有一处」的旁证错了）。B2b 的处置因此**更简单**：不需要拆两行、不存在豁免侧。 |

### 11.8 第 3 轮修订记录（按 `P2-review-eng.md` 的 B4 + N5–N8、`P2-review-design.md` 的 R2-1 / R2-2）

> **修订边界**：仍**不是重写**。第 2 轮获两位专家认可的项（eng 已闭环的 B1/B2a/B2b/B3；design 已闭环的 D-1/D-2/D-3；`P2-review.md §7` 锁定项；`candidate_count: 6` / `gate_commands` 23 key / 4 批 output 互斥 / 预算数值 `40+2MiB+8MiB` / `P3` 只跑前端）**一处未动**。本轮只落 1 BLOCKER + 2 MAJOR + 4 项非阻塞，并**在两处把专家处方按实测细化**（R16 / R17，见下）。

#### 11.8.1 B4（BLOCKER）—— `reason` 闭集补 `not_injectable` + `inlined` 语义写死 + 完整消费追踪

| 项 | 结论 / 改动 | 落点 |
|---|---|---|
| **① 闭集扩项** | `reason` 五元 → **六元**，补 **`not_injectable`**。语义写死为「进入了 `inject_resources()`，但既未被主 HTML 以可注入形态引用、且本身不属于可追加类型（css/js），因此没有任何注入落点」。它覆盖两条**既有**静默丢弃路径：**kind-drop**（`_detect_kind` 只认 `.css`/`.js`，`:258-260` 的 `if not kind: continue`）与**未被引用的二进制/SVG**（只在命中 `img/video/audio/source/track[src]` 或 `link[rel=icon]` 时才内联） | D7、§0.1A `render_html_file` 行、D6 编排顺序、D10 的 BDD-40 行、§3 完成标志 #8 |
| **② 复用 `skipped_out`（不新增出参）** | `inject_resources(html, siblings, *, skipped_out=None) -> str`——返回 `str` 不变，函数末尾遍历 `siblings`、把未消费项以 `not_injectable` 追加进同一个 `skipped` 列表；`render_html_file` 先过预算层（五类）再交给它追加（第六类），**顺序不可颠倒**（否则重复计数打破不变式） | D7、D6、§0.1A |
| **③ `inlined` 语义写死** | **`inlined` = 实际进入响应体的 sibling 个数**（命中七条消费路径任一）。**不取「预算层放行数」**——那会让不变式恒成立但**直接违反 P1 BDD-40 ②**「未被内联的每一个都必须可查」（kind-drop 与未引用二进制两条路径既不算 skipped 也不算未内联 = 静默丢弃仍在）。代价是必须做消费追踪，已实测可行 | D7（新增语义定义句）、§3 #8、D10 |
| **④ BDD-40 素材补非 css/js sibling** | 用例素材由两件扩到**三件**：① >768KB 二进制（`binary_too_large`）② 含 `<` `>` `</script` 的文件名+path ③ **`README.md` 或 `data.json` → 必须出现在 `skipped` 且 `reason == "not_injectable"`** | D10 的 BDD-40 行、§3 #8 |
| **⑤ 补齐 minimal_validation 选材缺口** | V8 的六个素材（bootstrap/vue/d3/app.css/chart.js/logo.svg）**全是资源**，恰好绕开 kind 维度 → 新增 **V17** 覆盖「非资源 sibling」与「未被引用二进制」 | §7 V17 |
| **⑥ 断言形态补检出力（G10）** | 只断 `{reason} ⊆ 闭集` 检不出「丢弃了但没记」→ 必须同时断**势**：`requested - inlined == len(skipped)`、闭集、文件名不重复。`inlined` 不得由 `requested - len(预算层 skipped)` 反推（会让势断言变恒等式） | D7（新增断言片段）、§3 #8 |

**⚠️ 对 eng 处方的一处修正（R17，实测依据）**：eng 建议「用现成钩子 `used_text_keys` + `_sibling_keys`」判定某 sibling 是否被消费——**实测该最小钩子不够，会产出假绿报表**：

- `b.css` 只经 CSS `@import` 被消费 → 不进 `used_text_keys`；
- `bg.svg` 只经 CSS `url()` 被消费 → 不进 `used_text_keys`（`_process_css_refs` 完全不碰 used 集合）；
- `fav.png` 只经 `<link rel=icon>` 被消费 → **二进制侧连 used 集合都不存在**；
- 决定性反例：**「未引用二进制 + README.md」**形态下该钩子**漏掉 `unref.png`** → 报表自称 `inlined=1` 而实际嵌入 **0**，`requested(2) - actual(0) = 2 ≠ len(skipped)=1`——**数字自洽但与事实不符**，比没有清单更危险（它看起来"有清单"）。

故改为：**`consumed: set[int]`（`id(SiblingFileData)`）+ `owners: dict[str, SiblingFileData]`（text/binary 共用）+ 七处埋点**（行号实测：`:231` / `:249` / `:263` / `:292` / `:298` / `:315` + **CSS 内部**——把 `owners` 与 `consumed_out` 透传进 `_process_css_refs`（`:127`），在 `:145` 与 `:162`/`:166` 登记、随 `:151` 递归继续透传）；新参数**关键字可选**（默认 `None`）→ 该函数既有 5 处测试调用零改动。实测 V17 七形态全过（S1 `5/3/2`、S2 `6/2/4`、S3 `4/4/0`、S4 `2/1/1`、S5 `2/0/2`、S6 不崩、S7 `1/1/0`）。

#### 11.8.2 R2-1（MAJOR）—— h1 规则吃掉 `.active` 强调色

| 项 | 结论 / 改动 | 落点 |
|---|---|---|
| **复现** | 实测 V18：`A` 原设计（无 `:not`）→ h1 **active 也变 `rgb(233,238,244)`**，强调色消失；且 `fw/mt` 与 inactive **完全相同** → 只断正向的判据对此缺陷**三项全真 = 漏检** | §7 V18、R16 |
| **处方细化（关键）** | design 的「一条 `:not(.active)`」**会连带丢掉字重**：实测 `B` 整条加 `:not(.active)` → active `color rgb(77,141,255)` **但 `fw 400`**（强调色回来、层级信号消失）。→ 改为**颜色与字重拆两条**：`.toc-item.toc-level-1 a { font-weight: 600; }` + `.toc-item.toc-level-1:not(.active) a { color: var(--c-text); }`；`margin-top` 挂 `li`、不挂 `:not(.active)`。实测 `C` → inactive `rgb(233,238,244)/fw 600`、active `rgb(77,141,255)/fw 600`，两向都对 | §0.1B `TocNav.vue` 行、UI 视觉组 W1、选定组合段、新增 **R16** |
| **补反向断言** | UI 校验点 ⑦ 增补：h1 置 `.active` 后 **`color == --accent-color` 的解析值（`rgb(77,141,255)`）** 且 **`fontWeight !== '400'`**；§3 完成标志 #10 同步 | UI 校验点 ⑦、§3 #10 |

#### 11.8.3 R2-2（MAJOR）—— `activeFile` / `'fullscreen'` 在组件作用域内不存在

| 项 | 结论 / 改动 | 落点 |
|---|---|---|
| **桌面复现** | 实测：`EntryDetailHeader.vue` `grep -c activeFile` = **0**、`defineEmits`（`:146-155`）无 `'fullscreen'`、props 无 `activeFile`、`EntryDetailView.vue` 的 24 个 Header prop 无 `:active-file` | §0.1B 两行、D5 |
| **处方（三处，缺一不可）** | ① Header `defineProps` 加 `activeFile?: File \| null`（`withDefaults` 默认 `null`）② Header `defineEmits` 加 `'fullscreen': []` ③ View 加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"` + `handleFullscreen()` 处理体（即 D5 原 `:345-349` 那段） | §0.1B、D5、§3 #12 |
| **新增实测坑** | `File` 必须**从 `@/types` 显式 import**——不 import 时 TS 解析成 **DOM `File`** → `TS2322`（实测 `EntryDetailView.vue(20,8)`） | §0.1B、D5 |
| **移动端连带核对结论** | `EntryDetailMobileBar.vue` **同样缺**：props 14 项无 `activeFile`、emits 7 项无 `'fullscreen'`。→ 一并补齐（`defineProps` + `defineEmits` + View 侧 `:active-file` / `@fullscreen`）。**但两端守卫语义不同**：移动端整栏已 `v-if="isMobile && currentEntry"`（`:2`），**不补也不 TypeError**；桌面端 `.actions-area` 的 `v-if="isDesktop"` 与 entry 状态无关，**故桌面的 `v-if` 是功能性必需** | §0.1B MobileBar 行、D5 |
| **闭合实测（V19）** | 实弹改三个文件（Header props+emits+按钮、View `:active-file`+`@fullscreen`+handler、MobileBar props+emits+按钮）→ `npx vue-tsc --noEmit` **exit 0**，且 `T079-entry-detail-header` / `tpv0095-detail-visibility-tag` / `t082-error-format` **32 passed**。探针改动已全部还原，**生产代码零残留** | §7 V19、§3 #12 |

#### 11.8.4 四项非阻塞（N5–N8）

| # | 问题 | 处置 | 落点 |
|---|---|---|---|
| **N5** | `test_entry_order.py` / `test_entry_file_order.py` **双名并存**，且 §5.1 的取证命令指向不存在的名字；**且命令带 `| tail -30`** → 管道把 exit 4 变 exit 0（**假绿**） | **统一为 `test_entry_file_order.py`**（全文 `test_entry_order.py` 归零）；§5.1 命令**去掉 `| tail`**，并加显式警告「管道会把非零 exit 变 0」+ 备选 `set -o pipefail`；因该文件是**新建**，红灯取证改为**两步**（先 `pytest tests/test_html_render.py` 单独取 assert failure，再跑完整命令确认建文件后全绿），避免 collection error 掩盖判据 | §0.1A 测试行、§0.3 R13、§5.1、§4 `files_to_read` |
| **N7** | 设计称「119P/0F/0E」实测不符 | 实测（`-v` 覆盖 `addopts=-q` 才拿到汇总行）：`test_html_render.py + test_entry_service.py` = **73 passed**；`+ test_file_service.py` = **78 passed**。**没有任何组合得到 119** → 三处「119」（R13 / §5.1 / V12）全部改为 **73**，并注明选择集差异 | §0.3 R13、§5.1、§7 V12 |
| **N8** | `backend-render-budget` 批的 `output` 未含新建的排序测试文件；`tests_filter` 亦未含 → 与 N5 叠加会让取证命令跑不起来 | `output` 补 `backend/tests/test_entry_file_order.py`（5 → **6** 项）；`tests_filter` 同步补该文件；§8 批表两列同步。**4 批 output 仍逐项互斥**（脚本校验通过） | frontmatter `dispatch_plan`、§8 |
| **N6** | `files_to_read` 的 useCsvParser spec 路径写成 `components/__tests__/`（实际在 `composables/__tests__/`）；`:51` 是 `it()` 行、断言在 `:55` | 路径改为 `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts:45-70` 并注明「不是 components/」；三处 `:51` 全部改为 **`:51-57`** 并注明断言在 `:55` | §4 `files_to_read`、D2、§3 #1、§11.3 第 1 项 |

#### 11.8.5 本轮新增实测（3 项：V17 / V18 / V19）

| 项 | 一句话结论 |
|---|---|
| **V17**（B4） | 原型实现「`consumed: set[id]` + `owners` + `_process_css_refs` 透传」后，**7 个形态全部满足 `requested - inlined == len(skipped)`**；同时证明 eng 建议的 `used_text_keys` 最小钩子在「未引用二进制」形态下漏记 → 假绿 |
| **V18**（R2-1） | 隔离页复刻 Vue scoped 编译形态四组对照：A 原设计 **active 色被吃掉**（R2-1 成立）；B `:not(.active)` 整条 **fw 掉回 400**；**C 颜色/字重拆两条 → 两向都对** |
| **V19**（R2-2） | 三处补丁实弹落地后 `vue-tsc --noEmit` **exit 0** + 三个既有 header 相关 spec **32 passed**；并发现「`File` 未 import 会被解析成 DOM `File`」这一 `TS2322` 坑 |

#### 11.8.6 本轮未推翻（逐条自查）

| 锁定项 | 本轮是否触碰 |
|---|---|
| eng 已闭环的 B1 / B2a / B2b / B3 | **未改**（B4 只在 B2a 的 `skipped_out` 出参上追加第六类 reason，不改 B2a 的签名/零改动结论；B2b 的 `binary_too_large` 记账原样保留） |
| design 已闭环的 D-1 / D-2 / D-3 | **除 R2-1 的补丁外未改**（D-1 三组布局层候选、D-3 的 360px + `gap` 8→4px scoped 落点全部保留；D-2 的 `fontWeight`+`marginTop` 判据保留，仅**细化选择器写法**与补反向断言） |
| `candidate_count: 6` | 未改 |
| `gate_commands` 23 key | **未改**（N5 只改正文 §5.1 的取证命令，未动 `gate_commands` 块——该块内无 `test_entry_order` 引用，故无需 `agate-md-field-set-gate-commands.py`） |
| 4 批 `output` 互斥 | **仍互斥**（N8 只给 backend 批**新增**一个文件，未与其它批重复；脚本校验通过） |
| 预算数值 `40 / 2MiB / 8MiB` | 未改 |
| `P3` 只跑前端 | 未改 |
| `P2-review.md §7` 锁定项 | 未改（含「桌面 `.actions-area` 不溢出」「截断态表头不塌陷」「对比度全过 AA」三条正面结论） |
| P1 基线（54 条 BDD + 4 处 `[BASELINE_CHANGE]`） | **一字未改**（B4 只要求在 BDD-40 的**用例素材**里补一个非 css/js sibling，不动 Then 语义） |


> **环境状态**：[PROD_NOT_TOUCHED]。本轮全程只用 debug `:8888`（现造 1 个探针 entry `ofpnpi`，用完即 `DELETE`，anon total 复查 **15**）+ CDP Chrome `localhost:18800` 只读测量（DOM 注入均在 `element.remove()` / `style` 还原后结束，未写持久状态）+ `backend/.venv` 跑 pydantic 读默认值。**未接触生产 `:8080`**，**未触碰 `~/.peekview/`**，未跑 CLI 写命令，未 commit，未改任何 `P2-review*.md`。
