---
phase: P3
task_id: T075-structured-data-viewer
type: test-cases
parent: P2-design.md
trace_id: T075-P3-20260801
status: draft
created: 2026-08-01
agent: test-designer
---

# P3 测试用例 — T075 结构化数据查看器（TableView + TreeView + 源码/渲染切换）

test_code_dir: docs/tasks/T075-structured-data-viewer/P3-test-code

## 测试文件清单

| 文件（P3-test-code/ 下，P4 复制到最终位置） | 框架 | 覆盖 BDD | 红灯机制（当前实现） |
|------|------|----------|---------------------|
| `useEntryDetailComputed.structured.spec.ts` | vitest (jsdom) | BDD-07~11 + isRichRenderable | isCsv/isTsv/isJson/isYaml/isXml 未返回 → 断言失败（classic red） |
| `useCsvParser.spec.ts` | vitest (jsdom) | BDD-14/15/16/22(parse)/23/49 | useCsvParser.ts 不存在 → import 失败（B 类红灯） |
| `useTreeData.spec.ts` | vitest (jsdom) | BDD-24/25/26/29/32/36 | useTreeData.ts 不存在 → import 失败（B 类红灯） |
| `TableView.spec.ts` | vitest (jsdom) | BDD-12~22（含 22 UI 层）/23/49(emit) | TableView.vue 不存在 → import 失败（B 类红灯） |
| `TreeView.spec.ts` | vitest (jsdom) | BDD-24~36 | TreeView.vue 不存在 → import 失败（B 类红灯） |
| `structured-data-viewer.spec.ts` | Playwright (E2E) | BDD-12~53 交互（37~48 切换、49~53 异常/主题/响应式/端到端） | 页面无 TableView/TreeView/切换按钮 → E2E 断言失败（需 debug backend :8888） |

最终落位（P4 implementer 复制目标）：
- `frontend-v3/src/composables/__tests__/useEntryDetailComputed.structured.spec.ts`
- `frontend-v3/src/composables/__tests__/useCsvParser.spec.ts`
- `frontend-v3/src/composables/__tests__/useTreeData.spec.ts`
- `frontend-v3/src/components/__tests__/TableView.spec.ts`
- `frontend-v3/src/components/__tests__/TreeView.spec.ts`
- `frontend-v3/e2e/structured-data-viewer.spec.ts`

## 全部 53 BDD 总表

| BDD | 描述 | 责任方 | 测试文件 |
|-----|------|--------|----------|
| BDD-01 | .csv 后端 language='csv' | **backend test-designer**（pytest test_language.py） | — |
| BDD-02 | .tsv 后端 language='tsv' | **backend test-designer**（pytest test_language.py） | — |
| BDD-03 | .json 后端 language='json' | **backend test-designer**（pytest test_language.py） | — |
| BDD-04 | .yaml 后端 language='yaml' | **backend test-designer**（pytest test_language.py） | — |
| BDD-05 | .yml 后端 language='yaml' | **backend test-designer**（pytest test_language.py） | — |
| BDD-06 | .xml 后端 language='xml' | **backend test-designer**（pytest test_language.py） | — |
| BDD-07 | isCsv 检测属性 | frontend | useEntryDetailComputed.structured.spec.ts |
| BDD-08 | isTsv 检测属性 | frontend | useEntryDetailComputed.structured.spec.ts |
| BDD-09 | isJson 检测属性 | frontend | useEntryDetailComputed.structured.spec.ts |
| BDD-10 | isYaml 检测属性 | frontend | useEntryDetailComputed.structured.spec.ts |
| BDD-11 | isXml 检测属性 | frontend | useEntryDetailComputed.structured.spec.ts |
| BDD-12 | CSV 渲染为表格 | frontend | TableView.spec.ts + E2E |
| BDD-13 | TSV 渲染为表格 | frontend | TableView.spec.ts + E2E |
| BDD-14 | CSV 引号内逗号不拆列 | frontend | useCsvParser.spec.ts + TableView.spec.ts + E2E |
| BDD-15 | CSV 引号内换行不拆行 | frontend | useCsvParser.spec.ts + TableView.spec.ts + E2E |
| BDD-16 | CSV 双引号转义 | frontend | useCsvParser.spec.ts + TableView.spec.ts + E2E |
| BDD-17 | 列头排序三态 | frontend | TableView.spec.ts + E2E |
| BDD-18 | 列头筛选 | frontend | TableView.spec.ts + E2E |
| BDD-19 | 默认每页 100 行 | frontend | TableView.spec.ts + E2E |
| BDD-20 | 每页行数切换回第一页 | frontend | TableView.spec.ts + E2E |
| BDD-21 | 表格横向滚动 | frontend | TableView.spec.ts + E2E |
| BDD-22 | >50000 行截断 + 下载 | frontend | useCsvParser.spec.ts（parse 层）+ TableView.spec.ts（UI 层）+ E2E |
| BDD-23 | 空 CSV 不崩溃 | frontend | useCsvParser.spec.ts + TableView.spec.ts + E2E |
| BDD-24 | JSON 渲染为树 | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-25 | YAML 渲染为树 | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-26 | XML 渲染为树 | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-27 | 树节点展开 | frontend | TreeView.spec.ts + E2E |
| BDD-28 | 树节点折叠 | frontend | TreeView.spec.ts + E2E |
| BDD-29 | 类型标签（6 种） | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-30 | 路径搜索高亮 | frontend | TreeView.spec.ts + E2E |
| BDD-31 | 点击复制值 | frontend | TreeView.spec.ts + E2E |
| BDD-32 | YAML SAFE_SCHEMA 拒绝 | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-33 | JSON >2MB 截断 | frontend | TreeView.spec.ts + E2E |
| BDD-34 | YAML >2MB 截断 | frontend | TreeView.spec.ts + E2E |
| BDD-35 | XML >2MB 截断 | frontend | TreeView.spec.ts + E2E |
| BDD-36 | 空 JSON 不崩溃 | frontend | useTreeData.spec.ts + TreeView.spec.ts + E2E |
| BDD-37 | 富渲染默认渲染视图 | frontend | E2E |
| BDD-38 | 切到源码视图 | frontend | E2E |
| BDD-39 | 切回渲染视图 | frontend | E2E |
| BDD-40 | Markdown 切源码 | frontend | E2E |
| BDD-41 | Markdown 回渲染恢复 TOC | frontend | E2E |
| BDD-42 | 文件切换重置渲染视图 | frontend | E2E |
| BDD-43 | CSV 支持切换 | frontend | E2E |
| BDD-44 | TSV 支持切换 | frontend | E2E |
| BDD-45 | JSON 支持切换 | frontend | E2E |
| BDD-46 | YAML 支持切换 | frontend | E2E |
| BDD-47 | XML 支持切换 | frontend | E2E |
| BDD-48 | Markdown 支持切换 | frontend | E2E |
| BDD-49 | CSV 解析失败降级源码 | frontend | useCsvParser.spec.ts + TableView.spec.ts + E2E |
| BDD-50 | JSON 解析失败错误提示 | frontend | E2E |
| BDD-51 | 深色/浅色主题 | frontend | E2E |
| BDD-52 | 移动端响应式 | frontend | E2E |
| BDD-53 | 后端 language 驱动渲染器 | frontend | E2E（后端部分由 backend test-designer 覆盖 BDD-02） |

## BDD → 测试用例详细映射

### 格式检测（BDD-07~11）→ useEntryDetailComputed.structured.spec.ts

| 字段 | 值 |
|------|-----|
| 测试名 | `test_bdd_07_is_csv_true_when_language_csv` 等 5 条 |
| 输入 | vi.mock `@/stores/entryDetail`（activeFile ref），`useEntryDetailComputed()` 返回对象 |
| 断言 | 对应 language 时该属性 true、其余 4 个 false；BDD-07 额外断言 isRichRenderable=true |
| 红灯原因 | 当前 composable 未返回 isCsv 等 → `result.isCsv?.value` 为 undefined → 断言失败 |

### TableView（BDD-12~22/23/49）

| BDD | 测试名（TableView.spec.ts） | 预期 |
|-----|------|------|
| BDD-12 | `test_bdd_12_csv_renders_table_with_headers_and_rows` | mount content=`a,b,c\n1,2,3` → table 存在，thead 3 列，tbody 1 行 |
| BDD-13 | `test_bdd_13_tsv_tab_delimited_parses_columns` | delimiter=`\t`，tab 分隔 → 正确分列 |
| BDD-14 | `test_bdd_14_quoted_comma_stays_single_cell` | `"hello, world"` → 单元格文本 `hello, world` |
| BDD-15 | `test_bdd_15_quoted_newline_stays_single_cell` | `"line1\nline2"` → 单元格含换行 |
| BDD-16 | `test_bdd_16_double_quote_escape_rendered` | `"say ""hi"""` → 单元格 `say "hi"` |
| BDD-17 | `test_bdd_17_sort_cycle_asc_desc_original` | 点列头 → aria-sort 升序；再点 → 降序；三点 → 原序 |
| BDD-18 | `test_bdd_18_filter_column_contains_only` | 筛选框输入 → 仅匹配行显示 |
| BDD-19 | `test_bdd_19_default_per_page_100` | 250 行 → 首行区 100 行 + Pagination 出现 |
| BDD-20 | `test_bdd_20_per_page_switch_resets_page_one` | 第 3 页 → 切 50 → 第一页、50 行 |
| BDD-21 | `test_bdd_21_horizontal_scroll_container` | 表格容器 overflow-x auto |
| BDD-22 | `test_bdd_22_truncation_banner_with_download` | 50001 行 → 仅前 50000 行 + 截断提示 + 下载按钮触发 downloadFn |
| BDD-23 | `test_bdd_23_empty_csv_no_data_no_crash` | 空内容 → "无数据"或空表格，不崩溃 |
| BDD-49 | `test_bdd_49_parse_error_emits` | 损坏内容 → emit('parse-error', msg) |

### TreeView（BDD-24~36）

| BDD | 测试名（TreeView.spec.ts） | 预期 |
|-----|------|------|
| BDD-24 | `test_bdd_24_json_renders_tree` | format=json → 树容器 + 根节点 + 展开图标 |
| BDD-25 | `test_bdd_25_yaml_renders_tree` | format=yaml → YAML 内容转为树 |
| BDD-26 | `test_bdd_26_xml_renders_tree` | format=xml → 元素/属性(@)/文本(#text)节点 |
| BDD-27 | `test_bdd_27_expand_shows_children` | 点展开 → 子节点显示，aria-expanded=true |
| BDD-28 | `test_bdd_28_collapse_hides_children` | 点折叠 → 子节点隐藏 |
| BDD-29 | `test_bdd_29_type_labels_all_six` | string/number/boolean/array/object/null 标签齐全 |
| BDD-30 | `test_bdd_30_search_highlights_matches` | 搜索框输入 → 匹配节点高亮 class + aria-live 播报数量 |
| BDD-31 | `test_bdd_31_click_leaf_copies_value` | stub clipboard → 点叶子值 → writeText 被调 |
| BDD-32 | `test_bdd_32_yaml_unsafe_tag_rejected` | !!python/object → parse 错误/emit parse-error |
| BDD-33 | `test_bdd_33_json_2mb_truncation` | >2MB → 截断提示 + 下载按钮 |
| BDD-34 | `test_bdd_34_yaml_2mb_truncation` | 同上（format=yaml） |
| BDD-35 | `test_bdd_35_xml_2mb_truncation` | 同上（format=xml） |
| BDD-36 | `test_bdd_36_empty_json_no_crash` | `{}`/`[]`/`null` → 空树/无数据，不崩溃 |

### 解析逻辑（useCsvParser.spec.ts / useTreeData.spec.ts）

| BDD | 测试名 | 预期 |
|-----|--------|------|
| BDD-14 | `test_bdd_14_quoted_comma_not_split` | `a,b\n"hello, world",x` → 第 1 行第 1 列 `hello, world` |
| BDD-15 | `test_bdd_15_quoted_newline_not_split` | 引号内换行 → 单元格含换行，不产生新行 |
| BDD-16 | `test_bdd_16_double_quote_unescaped` | `""` → `"` |
| BDD-22 | `test_bdd_22_parser_truncates_over_max_rows` | maxRows=2、5 行 → rows.length=2、truncated=true |
| BDD-23 | `test_bdd_23_empty_csv_no_rows` | `''` → headers/rows 空、totalRows=0、truncated=false |
| BDD-49 | `test_bdd_49_unclosed_quote_throws` | `"unclosed` → 抛错 |
| BDD-24 | `test_bdd_24_json_to_tree_data` | 嵌套对象 → TreeDataNode[] 结构正确 |
| BDD-25 | `test_bdd_25_yaml_to_tree_data` | yamlToTreeData 字符串 → 根 children 键值正确 |
| BDD-26 | `test_bdd_26_xml_to_tree_data` | DOMParser → 元素/属性/文本映射正确 |
| BDD-29 | `test_bdd_29_type_labels_all_six_types` | 6 种类型 → 对应 type 字段 |
| BDD-32 | `test_bdd_32_yaml_safe_schema_rejects` | !!python/object → 抛错 |
| BDD-36 | `test_bdd_36_empty_json_no_crash` | `{}`/`[]`/`null` → 空数组，不抛错 |

### E2E（structured-data-viewer.spec.ts）

| BDD | 测试名 | 关键断言 |
|-----|--------|----------|
| BDD-12 | `test_bdd_12_csv_renders_table` | /t075-csv → `.table-view` 可见，thead+tbody 渲染 |
| BDD-13 | `test_bdd_13_tsv_renders_table` | /t075-tsv → 表格可见，tab 分列正确 |
| BDD-14 | `test_bdd_14_quoted_comma_single_cell` | /t075-csv-quoted → 单元格含 `hello, world` |
| BDD-15 | `test_bdd_15_quoted_newline_single_cell` | 引号内换行单元格 |
| BDD-16 | `test_bdd_16_escaped_quotes_rendered` | 单元格含 `say "hi"` |
| BDD-17 | `test_bdd_17_sort_cycle` | 列头三次点击 aria-sort 三态 |
| BDD-18 | `test_bdd_18_filter_contains` | 筛选后行数减少 |
| BDD-19 | `test_bdd_19_default_per_page_100` | 120 行 CSV → 首页 100 行 |
| BDD-20 | `test_bdd_20_per_page_switch_page_one` | 切 50 → 第 1 页 |
| BDD-21 | `test_bdd_21_horizontal_scroll` | 宽表容器可横向滚动 |
| BDD-22 | `test_bdd_22_truncation_banner_download` | 50001 行 → 提示 + 下载按钮 |
| BDD-23 | `test_bdd_23_empty_csv_no_crash` | 空 CSV → "无数据"，页面存活 |
| BDD-24 | `test_bdd_24_json_tree` | /t075-json → 树可见 |
| BDD-25 | `test_bdd_25_yaml_tree` | /t075-yaml → 树可见 |
| BDD-26 | `test_bdd_26_xml_tree` | /t075-xml → 树可见 |
| BDD-27 | `test_bdd_27_expand_node` | 点展开 → 子节点出现 |
| BDD-28 | `test_bdd_28_collapse_node` | 点折叠 → 子节点消失 |
| BDD-29 | `test_bdd_29_type_tags` | 类型标签可见 |
| BDD-30 | `test_bdd_30_search_highlight` | 搜索 → 高亮 class + 匹配数 |
| BDD-31 | `test_bdd_31_click_copy_value` | clipboard 权限 → 点叶子 → 剪贴板值 |
| BDD-32 | `test_bdd_32_yaml_unsafe_error` | !!python/object → 错误提示 |
| BDD-33 | `test_bdd_33_json_2mb_truncation` | /t075-big file big.json → 截断提示 |
| BDD-34 | `test_bdd_34_yaml_2mb_truncation` | big.yaml 同上 |
| BDD-35 | `test_bdd_35_xml_2mb_truncation` | big.xml 同上 |
| BDD-36 | `test_bdd_36_empty_json_no_crash` | /t075-json-empty → 页面存活 |
| BDD-37 | `test_bdd_37_default_render_view` | CSV → 默认表格（无 CodeViewer） |
| BDD-38 | `test_bdd_38_switch_to_source` | 点切换按钮 → CodeViewer |
| BDD-39 | `test_bdd_39_switch_back_to_render` | 再点 → 表格 |
| BDD-40 | `test_bdd_40_markdown_switch_source` | md → 源码视图（CodeViewer） |
| BDD-41 | `test_bdd_41_markdown_back_toc_restored` | 回渲染 → MarkdownViewer + TOC 可见 |
| BDD-42 | `test_bdd_42_file_switch_resets_render` | 多文件 entry 切文件 → 渲染视图 |
| BDD-43 | `test_bdd_43_csv_toggle_cycle` | CSV 切换往返 |
| BDD-44 | `test_bdd_44_tsv_toggle_cycle` | TSV 切换往返 |
| BDD-45 | `test_bdd_45_json_toggle_cycle` | JSON 切换往返 |
| BDD-46 | `test_bdd_46_yaml_toggle_cycle` | YAML 切换往返 |
| BDD-47 | `test_bdd_47_xml_toggle_cycle` | XML 切换往返 |
| BDD-48 | `test_bdd_48_markdown_toggle_cycle` | Markdown 切换往返 |
| BDD-49 | `test_bdd_49_broken_csv_downgrade_source` | /t075-csv-broken → 错误提示 + CodeViewer |
| BDD-50 | `test_bdd_50_broken_json_error_banner` | /t075-json-broken → 错误 banner + 查看源码入口 |
| BDD-51 | `test_bdd_51_theme_both_dark_light` | 深浅主题切换 → 渲染器正常 |
| BDD-52 | `test_bdd_52_mobile_responsive` | 390×844 → 表格横滚、触摸目标、切换按钮可见（截图 mobile_390x844.png） |
| BDD-53 | `test_bdd_53_backend_tsv_drives_tsv_branch` | /t075-tsv → TSV 表格分支（非 CSV/CodeViewer） |

## Playwright viewport 配置（B3 规范）

E2E spec 内 `test.use({ viewport })` 声明两个视口（遵循仓库 t084/t052 惯例，不修改共享 playwright.config.ts）：
- 桌面：1280×800（BDD-12~51 主体）
- 移动：390×844（BDD-52，截图 `mobile_390x844.png`）

截图存入 `docs/tasks/T075-structured-data-viewer/evidences/`：
- `desktop_1280x800.png`（BDD-12 表格渲染桌面）
- `mobile_390x844.png`（BDD-52 移动端）
- 操作类 BDD（排序/筛选/切换/主题）各自独立截图，避免重复

## 测试选择器契约（P4 implementer 须满足）

测试通过选择器断言行为，以下为测试定义的组件 DOM 契约：

| 组件 | 契约 |
|------|------|
| TableView | 根 `.table-view`；语义 `table/thead/tbody/tr/th/td`；列头 `th` 绑定 `aria-sort`（ascending/descending，原序无）；筛选框 `input[aria-label="Filter {列名}"]`；每页行数 `select.per-page-select`（50/100/500 默认 100）；横向滚动容器 `.table-scroll`（overflow-x:auto）；截断条 `.truncation-banner` + 下载 `button`；空数据 `.no-data` 或空 tbody；emit `parse-error`(string) |
| TreeView | 根 `.tree-view`；搜索框 `input[aria-label="Search tree nodes"]`；匹配数 `[aria-live="polite"]`；节点 `.tree-node` + 展开钮 `.expand-toggle`（`aria-expanded`）+ `.tree-node-label` + `.type-tag`；搜索命中 `.search-highlight`；截断条 `.truncation-banner` + 下载 `button`；空数据 `.no-data` 或空节点；emit `parse-error`(string) |
| 切换按钮 | `button[aria-label="Show source code"]`（渲染态）↔ `button[aria-label="Show rendered view"]`（源码态），桌面 EntryDetailHeader + 移动 EntryDetailMobileBar |
| 解析错误 | 降级视图：`.parse-error-banner` 或 `[role="alert"]` + CodeViewer |
| 文件树 | `.file-item`（切换文件） |

## vitest mock hoisting 注意事项

- `useEntryDetailComputed.structured.spec.ts` 使用 `vi.hoisted()` 声明 mutable ref 供 `vi.mock('@/stores/entryDetail')` factory 引用（仓库 CodeViewer.spec.ts 同款安全模式），不引用模块级外部变量
- 其余 spec 不依赖 `vi.mock()`（直接 import 待实现模块），无 hoisting 风险
- 测试代码不直接依赖 `@tanstack/vue-table` / `js-yaml`（P4 才安装）——useTreeData 的 YAML 测试只调用 `yamlToTreeData()` 断言结果，js-yaml 由实现内部导入

## 验收说明

- 每条 BDD-07~53 至少一个测试用例（1:1 映射），测试名引用 BDD 编号
- vitest 5 个 spec：当前红灯（4 个 B 类 import 失败 + 1 个断言失败）
- E2E spec：P3 阶段无法运行（需 debug backend），P5/P6 用 `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test` 运行，当前页面无渲染器必然失败
