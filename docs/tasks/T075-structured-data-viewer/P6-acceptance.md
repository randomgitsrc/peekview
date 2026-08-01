---
phase: P6
task_id: T075-structured-data-viewer
type: acceptance
parent: P1-requirements.md
trace_id: T075-P6-20260801
status: draft
created: 2026-08-01
agent: verifier
---

# P6 验收报告 — T075 structured-data-viewer

## 验收范围与方式

- 验收依据：P1-requirements.md 共 53 条 BDD（BDD-01~53），全部实跑，无跳过、无裁剪
- 后端 BDD-01~06：`.venv/bin/python -m pytest tests/test_language.py -q --tb=no`（63 passed，test_bdd_01~06 对应用例）
- 前端 BDD-07~11（格式检测）：vitest `useEntryDetailComputed.structured.spec.ts`（6 tests）
- 前端 BDD-12~49（组件/解析层）：vitest `TableView.spec.ts`（13 tests）+ `TreeView.spec.ts`（13 tests）+ `useCsvParser.spec.ts`（9 tests）+ `useTreeData.spec.ts`（11 tests）
- 前端 BDD-12~53（交互层）：Playwright E2E `structured-data-viewer.spec.ts`（84/84 passed，chromium + Mobile Chrome 双 project，CDP :18800 → debug backend :8888）
- UI 视觉验证：vision-engine 分析关键截图（表格/树/源码/双主题/移动端），全部无 blocker
- 执行日志：P6-evidence/test-output.log（末行 EXIT_CODE: 0）

## 结论

- 53/53 BDD 全部 PASS，0 FAIL，0 NEED_CONFIRM

[NO_NEED_CONFIRM]

## 格式检测（BDD-01~11）

- PASS BDD-01: 后端 .csv 文件返回 language='csv'(test-output.log)
- PASS BDD-02: 后端 .tsv 文件返回 language='tsv'（不是 'csv'）(test-output.log)
- PASS BDD-03: 后端 .json 文件返回 language='json'(test-output.log)
- PASS BDD-04: 后端 .yaml 文件返回 language='yaml'(test-output.log)
- PASS BDD-05: 后端 .yml 文件返回 language='yaml'(test-output.log)
- PASS BDD-06: 后端 .xml 文件返回 language='xml'(test-output.log)
- PASS BDD-07: language='csv' 时 isCsv=true 且 isTsv/isJson/isYaml/isXml=false(test-output.log)
- PASS BDD-08: language='tsv' 时 isTsv=true 且 isCsv/isJson/isYaml/isXml=false(test-output.log)
- PASS BDD-09: language='json' 时 isJson=true 且 isCsv/isTsv/isYaml/isXml=false(test-output.log)
- PASS BDD-10: language='yaml' 时 isYaml=true 且 isCsv/isTsv/isJson/isXml=false(test-output.log)
- PASS BDD-11: language='xml' 时 isXml=true 且 isCsv/isTsv/isJson/isYaml=false(test-output.log)

## TableView 渲染（BDD-12~23）

- PASS BDD-12: CSV 文件渲染为表格视图（表头行+数据行），而非代码高亮(screenshots/bdd-12-table-view.png) (vision: P6-evidence/vision-reports/bdd-12.yaml)
- PASS BDD-13: TSV 文件渲染为表格视图，tab 分隔数据正确解析为列(screenshots/bdd-13-tsv-table.png) (vision: P6-evidence/vision-reports/bdd-13.yaml)
- PASS BDD-14: CSV 引号内逗号不拆列（"hello, world" 为单单元格）(test-output.log)
- PASS BDD-15: CSV 引号内换行不拆行（"line1\nline2" 为单单元格含换行）(test-output.log)
- PASS BDD-16: CSV 双引号转义正确（"say ""hi""" → say "hi"）(test-output.log)
- PASS BDD-17: 表格列头排序三态（升序→降序→原序）(test-output.log)
- PASS BDD-18: 表格列头筛选（文本包含匹配，filter 'user5' 命中 11 行）(test-output.log)
- PASS BDD-19: 表格默认每页 100 行 + 底部分页控件(test-output.log)
- PASS BDD-20: 每页行数切换后回到第一页（300 行第 3 页切 50 → 第 1 页 50 行）(test-output.log)
- PASS BDD-21: 表格横向滚动（30 列 scrollWidth > clientWidth）(test-output.log)
- PASS BDD-22: CSV 超过 50000 行截断，顶部提示 + 下载按钮(test-output.log)
- PASS BDD-23: 空 CSV 文件渲染不崩溃，显示空表格(test-output.log)

## TreeView 渲染（BDD-24~36）

- PASS BDD-24: JSON 文件渲染为树视图，根节点可展开/折叠，子节点带类型标签(screenshots/bdd-24-json-tree.png) (vision: P6-evidence/vision-reports/bdd-24.yaml)
- PASS BDD-25: YAML 文件渲染为树视图，内容正确解析为树结构(test-output.log)
- PASS BDD-26: XML 文件渲染为树视图，元素/属性/文本映射为树节点(test-output.log)
- PASS BDD-27: 树节点展开（点击折叠态 meta 节点后子节点显示）(test-output.log)
- PASS BDD-28: 树节点折叠（再次点击后子节点隐藏）(test-output.log)
- PASS BDD-29: 树节点类型标签（string/number/boolean/array/object/null 六种齐全）(test-output.log)
- PASS BDD-30: 树路径搜索高亮（输入 alice 命中 .search-highlight + 计数播报）(test-output.log)
- PASS BDD-31: 树节点点击复制值（点击 age 节点剪贴板含 '30'）(test-output.log)
- PASS BDD-32: YAML 使用 SAFE_SCHEMA 解析，!!python/object 标签被拒绝并显示错误提示(test-output.log)
- PASS BDD-33: JSON 超过 2MB 截断提示 + 下载按钮(test-output.log)
- PASS BDD-34: YAML 超过 2MB 截断提示 + 下载按钮(test-output.log)
- PASS BDD-35: XML 超过 2MB 截断提示 + 下载按钮(test-output.log)
- PASS BDD-36: 空 JSON（{} / [] / null）渲染不崩溃，显示空树(test-output.log)

## 源码/渲染切换（BDD-37~48）

- PASS BDD-37: 富渲染格式默认显示渲染视图（.csv 默认表格，非源码）(test-output.log)
- PASS BDD-38: 点击源码切换按钮后内容区切换为 CodeViewer 代码高亮视图(screenshots/bdd-38-source-view.png) (vision: P6-evidence/vision-reports/bdd-38.yaml)
- PASS BDD-39: 点击渲染切换按钮后内容区切回表格渲染视图(test-output.log)
- PASS BDD-40: Markdown 点击源码切换显示源码（CodeViewer + markdown）(test-output.log)
- PASS BDD-41: Markdown 切回渲染视图后 TOC 功能正常(test-output.log)
- PASS BDD-42: 文件切换时重置为渲染视图（data.csv 切源码 → 点 data.json → 显示树视图）(test-output.log)
- PASS BDD-43: CSV 格式支持源码↔渲染双向切换(test-output.log)
- PASS BDD-44: TSV 格式支持源码↔渲染双向切换(test-output.log)
- PASS BDD-45: JSON 格式支持源码↔渲染双向切换(test-output.log)
- PASS BDD-46: YAML 格式支持源码↔渲染双向切换(test-output.log)
- PASS BDD-47: XML 格式支持源码↔渲染双向切换(test-output.log)
- PASS BDD-48: Markdown 格式支持源码↔渲染双向切换(test-output.log)

## 异常处理（BDD-49~50）

- PASS BDD-49: CSV 解析失败（引号未闭合）时降级显示源码视图，页面不崩溃(test-output.log)
- PASS BDD-50: JSON 解析失败时显示错误提示（parse-error-banner）+ 源码入口(test-output.log)

## 主题与响应式（BDD-51~52）

- PASS BDD-51: 深色/浅色双主题下 TableView 和 TreeView 正常显示，无对比度问题(screenshots/bdd-51-dark-table.png, screenshots/bdd-51-light-yaml.png) (vision: P6-evidence/vision-reports/bdd-51.yaml)
- PASS BDD-52: 移动端表格可横向滚动、树节点触摸目标 ≥44px（DOM 实测 44px）、切换按钮可见(screenshots/bdd-52-mobile-table.png, screenshots/bdd-52-mobile-tree.png) (vision: P6-evidence/vision-reports/bdd-52.yaml)

## 端到端（BDD-53）

- PASS BDD-53: 后端对 .tsv 返回 language='tsv'，前端进入 TSV 表格分支（非 CSV 分支或 CodeViewer），全链路一致(bdd-53-assert.json)

## 验收环境说明

- 执行环境：debug backend :8888（/tmp/peekview-debug/，独立数据目录），CDP Chrome :18800（Chrome/151）
- E2E 数据：T075 全部 17 个测试 entry 由 beforeAll 通过 debug backend HTTP API 创建（t075-csv/tsv/json/yaml/xml/markdown/multi/broken/big/empty/huge/wide 等）
- 与生产环境差异：debug 模式 captcha 禁用，数据隔离于 /tmp/peekview-debug/，不影响生产 :8080
- [PROD_NOT_TOUCHED] 全程仅访问 :8888 debug backend 与 CDP Chrome :18800，未触碰生产服务/生产数据库/~/.peekview/

## 证据索引

| 证据文件 | 对应 BDD |
|---------|---------|
| test-output.log | BDD-01~11, 14~23, 25~37, 39~50（测试执行日志） |
| screenshots/bdd-12-table-view.png | BDD-12 |
| screenshots/bdd-13-tsv-table.png | BDD-13 |
| screenshots/bdd-24-json-tree.png | BDD-24 |
| screenshots/bdd-38-source-view.png | BDD-38 |
| screenshots/bdd-51-dark-table.png, bdd-51-light-yaml.png | BDD-51 |
| screenshots/bdd-52-mobile-table.png, bdd-52-mobile-tree.png | BDD-52 |
| bdd-53-assert.json | BDD-53（查询类断言记录） |
| vision-reports/bdd-12/13/24/38/51/52.yaml | 对应 UI BDD 视觉分析（blocker_count=0） |

EXIT_CODE: 0
