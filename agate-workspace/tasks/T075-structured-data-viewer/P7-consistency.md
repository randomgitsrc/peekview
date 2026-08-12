---
phase: P7
task_id: T075-structured-data-viewer
type: consistency
parent: P6-acceptance.md
trace_id: T075-P7-20260801
status: approved
created: 2026-08-01
agent: consistency-reviewer
---

# P7 一致性检查结论 — T075 structured-data-viewer

## 检查清单结果

### 1. DESIGN_GAP 配对

P4-implementation-frontend.md 声明 2 个 DESIGN_GAP，已逐条转抄并配对 REVIEWED：

- [DESIGN_GAP: G1 §4 TableView.spec.ts 三条断言数学上不可能成立（BDD-12 thead th===3 / BDD-18 filter 'alice' 期望 2 行 / BDD-20 第 3 页 100 行），实现按 P1 语义正确行为]
- [DESIGN_GAP_REVIEWED: G1 已确认 — 断言数字为 P3 测试作者笔误，非实现缺陷。客观核实：test-designer 已修正 frontend-v3/src/components/__tests__/TableView.spec.ts（BDD-12 改用 3 列 content `'name,age,city\n...'` + headers.length toBe(3)；BDD-18 改用 filter 'ali' 期望 2 行；BDD-20 改用 csvRows(300) 共 3 页），与 P3-test-code/ 副本 diff 为空。E2E 版同源修复（BDD-18 toBe(11) / BDD-20 t075-csv-300）。P1 BDD-12/18/20 原文未指定矛盾数字（P1§BDD-12 只要求「表头行+数据行」、P1§BDD-18「包含该文本」、P1§BDD-20「切换后回第一页」），P6 验收 PASS 与 P1 语义一致，确认闭环]

- [DESIGN_GAP: G2 §5 测试文件机械性修复（未使用 import 移除 / @types/js-yaml 追加 / withDefaults 默认值 / 模板压缩）]
- [DESIGN_GAP_REVIEWED: G2 已确认 — 均为编译必需补充或非逻辑改动：① TableView.spec.ts 未使用 import 移除（tsconfig noUnusedLocals:true，vue-tsc TS6133）② @types/js-yaml@^4.0.9 追加（js-yaml@4.3.1 无内置类型，P2§3.12 只声明运行时依赖）③ EntryDetailHeader.vue withDefaults 默认值（既有 T079 测试 mount 不带新 props，默认 false 不渲染按钮）④ EntryDetailContent.vue 模板压缩至 194 行 <200（t082 架构守卫）。四项均不改变测试语义，客观核实：frontend-v3/package.json 含 @types/js-yaml@^4.0.9、EntryDetailHeader.vue:109/131-132 withDefaults 存在、EntryDetailContent.vue 194 行、TableView.spec.ts:1 无未使用 import，确认闭环]

### 2. SCOPE+ 闭环

- P1-requirements.md 无 SCOPE+ 增补（53 BDD 固定，BDD-01~53 无增删），P1§6 范围声明与 P2/P4 改动范围一致
- P2-design.md §7 [SCOPE+] 检查声明「无新增隐含需求」，P4-implementation-frontend.md §7 [SCOPE+] 检查声明「无新增隐含需求」
- [SCOPE_RESOLVED] 无待增补项——P1 的 11 个隐含需求（P1§2.1~2.11）全部在 P2§3 有对应设计节，P4 实现无范围外新增（@types/js-yaml 为编译必需补充，已在 G2 声明）

### 3. 跨文件一致性

#### 3.1 P2§packages 与 P4 改动范围 / P8 bump 范围

- P2§0 packages: backend + frontend，domains: frontend + backend，ui_affected: true
- P4-implementation-backend.md implementation_dir `backend/peekview/`：改 language.py EXTENSION_MAP L69 `.tsv: "tsv"` + PLAIN_TEXT_LANGS 加 tsv（P2§3.1 吻合）。客观核实 backend/peekview/language.py:69 与 :259
- P4-implementation-frontend.md implementation_dir `frontend-v3/`：新增 7 文件（TableView/TreeView/DataTreeNode/TruncationBanner/useCsvParser/useTreeData/structured-data.ts）全部落盘，修改 6 文件（useEntryDetailComputed/EntryDetailContent/EntryDetailHeader/EntryDetailMobileBar/EntryDetailView/package.json）——与 P2§2.1 新增+修改清单完全一致，另补 treeExpandKey.ts（P4§9 修订项 L，P2 未列但属 composables 目录内重构）。客观核实：7 新增 + 6 修改 + treeExpandKey.ts 均存在（ls 确认）
- MarkdownViewer.vue：P1§6 列入修改范围，但 P2§2.2 明确「不改什么——MarkdownViewer 内部逻辑不改（源码切换在调度层处理）」，P4 未改。属 P2 主动设计裁剪，非 DEViation
- 依赖：P2§3.12 声明 @tanstack/vue-table@^8.21.3 + js-yaml@^4.3.1，P4 追加 @types/js-yaml@^4.0.9（G2 已声明，compile-time 必需）。package.json 核实一致
- P8 bump 范围：后端包（language.py）+ 前端包（新渲染器/切换）均落在 P2 packages 声明内，无超出

#### 3.2 P1§BDD 与 P6§acceptance 数量匹配

- P1-requirements.md BDD-01~53（grep BDD- 计数 = 53），P6-acceptance.md PASS 行数 = 53（grep PASS BDD- 计数 = 53），数量匹配
- 逐条内容核对抽样：BDD-02（.tsv→'tsv'）→ P6 PASS 引用 test-output.log；BDD-18（筛选包含）→ P6 写「filter 'user5' 命中 11 行」与修正后 spec 一致；BDD-42（文件切换重置）→ P6 PASS 且 P4§10 已修复真 bug；BDD-53（端到端链路）→ P6 PASS 引用 bdd-53-assert.json。无错位映射
- P6 声明「53/53 BDD 全部 PASS，0 FAIL，0 NEED_CONFIRM」+ [NO_NEED_CONFIRM]

#### 3.3 P4§impl-path 与 P2 方案设计吻合

- 切换状态管理：P2 方案 A（EntryDetailView sourceViewMode ref + watch(activeFile) 重置）→ P4§3.4 实现一致（EntryDetailView.vue watch activeFile.id 重置 sourceViewMode）
- 调度链：P2§3.3 v-if 链（isHtml→isMarkdown→结构化→isImage→CodeViewer + showSourceView 统一判断）→ P4§3.1 实现一致（结构化分支合并 + parseError banner 提到分支外）
- 格式检测：P2§3.2 isCsv/isTsv/isJson/isYaml/isXml + isRichRenderable → P4 useEntryDetailComputed.ts 新增一致
- TableView：P2§3.8（TanStack headless + Pagination 复用 + perPage 50/100/500 + 横向滚动 + 50000 行截断）→ P4§3.2 实现一致（含 BDD-22 截断直渲 50000 行、BDD-21 overflow-x:auto）
- TreeView：P2§3.9/3.10（TreeDataNode 递归 + 搜索 aria-live + 复制 + 类型标签语义变量）→ P4§3.3 实现一致（单根自动展开、js-yaml v4 默认安全、XML DOMParser、TreeExpandKey）
- 截断策略：P2§3.13（CSV>50000 行 / JSON/YAML/XML>2MB）→ P4 TruncationBanner + useCsvParser maxRows 一致
- 切换按钮：P2§3.11 toggle-btn + Code/Eye 图标 + isRichRenderable 条件 → P4 Header/MobileBar 一致（修订项 I 将 aria-expanded 改 aria-pressed，P4§9）

#### 3.4 P2 gate_commands 与 P5 实际执行一致

- P2 gate_commands.P5_backend `cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no` → P5 backend-unit.md 实际执行同命令，63 passed
- P2 gate_commands.P5_frontend `cd frontend-v3 && npx vitest run --reporter=dot 2>&1 | tail -30` → P5 frontend-unit.md 实际执行同命令，1177 passed（2 RPC timeout 环境问题，分离验证全绿）
- P2 gate_commands.P5_typecheck `npx vue-tsc --noEmit` → P5 执行，0 errors
- P2 gate_commands.P5_build `npm run build` → P5 执行，success
- P2 gate_commands.P5_e2e `E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test` → P5 e2e.md 实际执行，修复后 84/84

#### 3.5 测试文件两处副本一致

- P3-test-code/ 6 个文件（TableView/TreeView/useCsvParser/useTreeData/useEntryDetailComputed.structured/structured-data-viewer.spec）与 frontend-v3 实际位置（src/components/__tests__/ ×2、src/composables/__tests__/ ×3、e2e/ ×1）逐文件 diff 全部 IDENTICAL（含 P4§9 修订选择器改动后的同步）

### 4. 未决项清零

- 全阶段产出（P1/P2/P3/P4/P5/P6）无残留行首 [NEED_CONFIRM]、[DEVIATION-CRITICAL]；[BLOCKER] 仅出现在 P4-review-frontend.md（已评审修复，P4§9 逐项闭环）与 P4 修复记录（A/B/C 三 BLOCKER 均标注修复），非残留
- P1-requirements.md §4 [NO_NEED_CONFIRM] 存在
- P6-acceptance.md [NO_NEED_CONFIRM] 存在 + EXIT_CODE: 0
- P4 §6 观察项（E2E BDD-18/20 计数问题、BDD-22 性能）已由 test-designer specfix + P5 分离验证 + P6 验收闭环，无未决

## 其他确认

- P0-brief 任务范围（A TableView / B TreeView / C 切换 / D 格式检测）全部覆盖，P1§1 需求复述与 P0 一致
- 环境隔离：P4/P5/P6 各产出均带 [PROD_NOT_TOUCHED]，P6 验收仅访问 debug :8888 + CDP :18800，未触碰生产
- 跨文件引用锚点：P1§BDD、P2§packages、P2§3.3/3.8/3.9/3.11/3.12/3.13、P4§implementation、P4§impl-path、P4§3.1/3.2/3.3、P4§9、P4§10、P6§acceptance、P5-test-results

## 门槛确认

- P7-consistency.md 存在 ✓
- 无 [BLOCKER] / [DEVIATION-CRITICAL] ✓（- [BLOCKER]: 0 条）
- DESIGN_GAP 全部 REVIEWED 配对（G1/G2）✓
- SCOPE+ 闭环声明 ✓
- 跨文件引用（P2§packages、P4§impl-path、P1§BDD、P6§acceptance）✓

- [BLOCKER]: 0 条
- [DEVIATION-CRITICAL]: 0 条
- [PROD_NOT_TOUCHED] 本轮仅读取任务产出文件 + 客观核实文件系统/git 状态，未触碰任何运行环境
