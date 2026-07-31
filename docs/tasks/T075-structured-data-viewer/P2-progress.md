## P2 architect 进度记录

### 步骤 1: 读取 P1-requirements.md + P0-brief.md
- 时间: 2026-08-01
- 发现:
  - 4 个子任务: A(TableView CSV/TSV), B(TreeView JSON/YAML/XML), C(源码/渲染切换), D(格式检测修正)
  - 53 条 BDD, 11 个隐含需求
  - domains: frontend, backend
  - risk_level: medium
  - requires_minimal_validation: true
  - P1 范围声明列出了所有需修改的文件
  - P0 明确: TanStack Table v8 headless + js-yaml SAFE_SCHEMA + DOMParser for XML
  - P0 明确: 不做虚拟滚动、不做编码检测、不做 code block 内嵌渲染
  - 关键约束: 离线可用(npm install + Vite 打包内嵌)、零 UI 框架、复用 Pagination.vue

### 步骤 2: 读取核心源码文件
- 时间: 2026-08-01
- 发现:
  - **EntryDetailContent.vue**: v-if 调度链 = isHtml → isMarkdown → isImage → CodeViewer(fallback)。新渲染器需在 CodeViewer 之前插入。Props 从父组件传入(isMarkdown/isHtml/isImage/isBinary)。
  - **useEntryDetailComputed.ts**: 格式检测基于 activeFile.language。现有: isMarkdown/isHtml/isImage/isBinary。downloadFile() 已存在可复用。return 对象列出所有导出。
  - **Pagination.vue**: props(page/perPage/total/maxVisible), emit(update:page)。无 perPage 选择器。需在 TableView 中包装或扩展。CSS 变量: --bg-secondary, --border-color, --accent-color 等。
  - **CodeViewer.vue**: props(content/filename/language/wrap/canWrap/loading)。通过 useShiki 高亮。可直接复用于源码视图。

### 步骤 3: 读取 MarkdownViewer.vue + language.py + DESIGN.md
- 时间: 2026-08-01
- 发现:
  - **MarkdownViewer.vue**: props(content/pathMap/slug), emit(headings/navigate-file)。无源码切换。slot name="toc"。渲染 blocks 数组(html/diagram)。
  - **language.py**: 第 69 行 `.tsv: "csv"` — 确认 bug。PLAIN_TEXT_LANGS 包含 'csv' 但不包含 'tsv'。需: .tsv→'tsv' + PLAIN_TEXT_LANGS 加 'tsv'。其余 .json/.yaml/.yml/.xml 映射已正确。
  - **DESIGN.md**: 
    - 语义 CSS 变量: --bg-primary/secondary/tertiary, --text-primary/secondary/tertiary, --border-color, --accent-color, --c-success/warning/error
    - 4px 基础单位, spacing --space-1~7
    - 移动端 <= 640px 单列, 触摸目标 ≥44px
    - .content-area 是唯一垂直滚动容器, viewer 组件不能 overflow-y: auto
    - CodeViewer 保留 overflow-x: auto
    - 深色主题优先
    - 按钮用 BaseButton, 图标用 Lucide
    - Content Viewers 列表: CodeViewer, MarkdownViewer, DiagramBlock, ImageViewer, HtmlViewer — 需新增 TableView, TreeView

### 步骤 4: 读取 EntryDetailView.vue + EntryDetailHeader.vue
- 时间: 2026-08-01
- 发现:
  - **EntryDetailView.vue**: 状态管理中心。isFileTreeOpen/isTocOpen/showFileDrawer/showTocDrawer 都是 ref(false)。watch(slug) 重置。useEntryDetailComputed 返回 isMarkdown/isHtml/isImage/isBinary 等。需要在此管理 sourceViewMode 状态。
  - **EntryDetailHeader.vue**: actions-area 有 toggle-btn(icon-btn) 模式。Desktop header 有 Copy/Share/OverflowMenu。需在此加源码切换按钮。props 从父传入。
  - 源码切换状态应在 EntryDetailView 管理，通过 props 传给 EntryDetailContent + EntryDetailHeader + EntryDetailMobileBar。
  - 文件切换时重置: watch(activeFile) → sourceViewMode = false

### 步骤 5: 读取 EntryDetailMobileBar + DiagramBlock + 测试模式 + variables.css
- 时间: 2026-08-01
- 发现:
  - **EntryDetailMobileBar.vue**: isMobile + !zenMode 条件。toggle-btn / bottom-btn 模式。需在此加移动端源码切换按钮。
  - **DiagramBlock.vue**: 有 per-component isCodeMode ref(false) + toggleView()。这是 per-component 的，不统一。
  - **TreeNodeItem.vue**: 已存在！用于 FileTree 的递归树组件。但它是文件树专用(isDir/file)，不是通用树节点。TreeView 渲染器需要自己的递归组件。
  - **测试模式**: vitest + @vue/test-utils mount。.spec.ts 后缀。composables 测试在 __tests__/ 目录。
  - **variables.css**: 语义别名 --bg-primary/secondary/tertiary, --text-primary/secondary/tertiary, --border-color, --accent-color, --c-success/warning/error。深色/浅色双套。
  - **Pagination.vue**: 无 perPage 选择器。TableView 需在其上方加 perPage selector。

### 步骤 6: 读取 package.json + test_language.py + types/index.ts
- 时间: 2026-08-01
- 发现:
  - **package.json**: 当前依赖无 TanStack Table、无 js-yaml。需新增。Vue 3.4+, Vite 5.2+, vitest 1.6+, vue-tsc 2.0+。
  - **test_language.py**: 有 TestPlainTextLanguages class，test_plain_text_langs_count 断言 len==14。加 'tsv' 后变为 15，需更新断言。无 .csv/.tsv 单独测试用例，需补充。
  - **types/index.ts**: TreeNode 类型已存在(name/fullPath/isDir/children/file?)，但这是文件树专用。TreeView 渲染器需要自己的 TreeData 类型。
  - **File interface**: id/path/filename/language/isBinary/size/lineCount。
  - **Entry interface**: 含 files 数组。
  - 后端测试断言 PLAIN_TEXT_LANGS count==14，加 tsv 后改为 15。

### 步骤 7: 读取 entryDetail store
- 时间: 2026-08-01
- 发现:
  - **entryDetail store**: selectFile(file) 切换文件。activeFile 是 ref<File|null>。fileContent 是 ref<string>。
  - selectFile 重置 fileContent='', 然后 fetch 新内容。
  - 文件切换时重置源码视图: 可在 EntryDetailView watch(activeFile) 时重置，或在 selectFile 内部处理。
  - 推荐在 EntryDetailView 层管理 sourceViewMode ref，watch(activeFile) → sourceViewMode=false，因为 store 不应知道渲染模式（关注点分离）。

### 步骤 8: 最小验证 — TanStack Table v8 + js-yaml 兼容性
- 时间: 2026-08-01
- 验证内容:
  1. TanStack Table v8 是否支持 Vue 3（@tanstack/vue-table 包存在性）
  2. js-yaml SAFE_SCHEMA / load 安全 API
  3. DOMParser XML 解析在 jsdom 环境可用性（vitest 测试环境）
- 验证方式: npm registry 查包存在性 + 已知 API 文档验证

### 步骤 8b: 最小验证 — js-yaml 版本选择
- 时间: 2026-08-01
- 发现:
  - js-yaml latest = v5.2.2 (2026-06-20 发布，breaking changes)
  - js-yaml v4-legacy = 4.3.1
  - v4.0.0 CHANGELOG: "removed safe* functions. Use load, loadAll, dump instead which are all now safe by default"
  - v4: load() 默认安全(DEFAULT_SCHEMA = DEFAULT_SAFE_SCHEMA), safeLoad() deprecated
  - v5: load() 默认安全(CORE_SCHEMA), safeLoad() 完全移除, DEFAULT_SAFE_SCHEMA 移除
  - **决策**: 使用 js-yaml@4 (v4-legacy tag, ^4.3.1)
    - 理由1: v5 是 2026-06 刚发布的大版本，生态稳定性未验证
    - 理由2: v4 的 load() 已默认安全，满足 BDD-32 要求
    - 理由3: v4 API 更稳定，社区文档丰富
    - 理由4: P0 提到 safeLoad()，在 v4 中 load() 等价（v4 changelog 明确）
  - **安全验证**: js-yaml@4 load() 默认使用 DEFAULT_SCHEMA (= DEFAULT_SAFE_SCHEMA)，拒绝 !!python/object 等危险标签
  - TanStack vue-table v8.21.3, peerDep vue>=3.2 ✓
  - DOMParser: 浏览器原生 API, jsdom 环境可用(vitest 已用 jsdom)

### 步骤 9: P2-design.md 完成
- 时间: 2026-08-01
- 产出: docs/tasks/T075-structured-data-viewer/P2-design.md
- 内容:
  - 4 个设计决策点各含 ≥2 候选方案 + 权衡 + 选择理由
  - 四字段齐全: packages / domains / ui_affected / gate_commands
  - files_to_read 清单（15 个文件，标行号范围）
  - minimal_validation: 5 项（3 confirmed + 2 not_needed 纯代码逻辑）
  - env_constraints: debug_env + isolation_check + [PROD_NOT_TOUCHED]
  - 影响域分析: 改什么(3 后端 + 12 前端文件) / 不改什么(8 项) / 风险(7 项)
  - 实现完成标志: 6 大类 ~35 条 checklist
  - SCOPE 检查: 无新增隐含需求
